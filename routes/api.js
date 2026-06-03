const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const { 
  generateTimeSlots, 
  timeToMinutes, 
  checkDoubleBooking, 
  calculateEndTime,
  predictNoShowRisk,
  analyzeSentiment,
  calculateDynamicPrice,
  calculateConsistencyScore,
  getRecommendation,
  calculateTutorRecommendationScore,
  getRecommendationReason,
  calculatePerformanceTrend,
  predictBestStudyTime
} = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

// Get available time slots for a tutor on a specific date
router.get('/available-slots/:tutorId/:date', async (req, res) => {
  try {
    const { tutorId, date } = req.params;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const bookings = await Booking.find({
      tutor: tutorId,
      date: { $gte: targetDate, $lt: nextDay },
      status: { $in: ['confirmed', 'pending'] }
    });
    
    const bookedSlots = new Set();
    for (const booking of bookings) {
      const startMinutes = timeToMinutes(booking.startTime);
      const endMinutes = timeToMinutes(booking.endTime);
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        bookedSlots.add(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
      }
    }
    
    const allSlots = generateTimeSlots();
    const availableSlots = allSlots.filter(slot => !bookedSlots.has(slot));
    
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      return res.json(availableSlots.filter(slot => timeToMinutes(slot) > currentMinutes + 30));
    }
    
    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tutors for a specific subject
router.get('/tutors/by-subject/:subjectId', async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.json([]);
    const tutors = await User.find({ role: 'tutor', modules: { $in: [subject.code] } }).select('name rating modules totalSessions');
    res.json(tutors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ATTENDANCE ROUTES ============

// Mark attendance for a session (tutor only) - WITH REDIRECT
router.put('/attendance/:bookingId', requireAuth, async (req, res) => {
  try {
    const { attendance } = req.body; // 'attended' or 'missed'
    const booking = await Booking.findById(req.params.bookingId)
      .populate('student', 'name')
      .populate('tutor', 'name')
      .populate('subject', 'name');
    
    if (!booking) {
      return res.redirect('/tutor-dashboard?error=Booking not found');
    }
    
    // Check if user is the tutor or admin
    if (booking.tutor._id.toString() !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.redirect('/tutor-dashboard?error=Unauthorized');
    }
    
    booking.attendance = attendance;
    
    if (attendance === 'attended') {
      booking.status = 'completed';
      await User.findByIdAndUpdate(booking.tutor._id, { $inc: { totalSessions: 1 } });
      
      await new Notification({
        user: booking.student._id,
        title: '✅ Session Completed!',
        message: `Your ${booking.subject.name} session with ${booking.tutor.name} has been marked as completed. Please leave a review!`,
        type: 'attendance',
        relatedBooking: booking._id
      }).save();
      
    } else if (attendance === 'missed') {
      await new Notification({
        user: booking.student._id,
        title: '⚠️ Session Missed',
        message: `You missed your ${booking.subject.name} session on ${new Date(booking.date).toDateString()}. Please contact your tutor to reschedule.`,
        type: 'attendance',
        relatedBooking: booking._id
      }).save();
    }
    
    await booking.save();
    
    // Redirect back to tutor dashboard with success message
    res.redirect('/tutor-dashboard?success=Attendance+marked+as+' + attendance);
    
  } catch (error) {
    console.error(error);
    res.redirect('/tutor-dashboard?error=Failed+to+mark+attendance');
  }
});

// Get attendance analytics for a tutor
router.get('/attendance-analytics/:tutorId', requireAuth, async (req, res) => {
  try {
    const tutorId = req.params.tutorId;
    
    if (tutorId !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const bookings = await Booking.find({ 
      tutor: tutorId,
      status: { $in: ['completed', 'cancelled'] }
    });
    
    const totalSessions = bookings.length;
    const attendedSessions = bookings.filter(b => b.attendance === 'attended').length;
    const missedSessions = bookings.filter(b => b.attendance === 'missed').length;
    const pendingAttendance = await Booking.countDocuments({ 
      tutor: tutorId, 
      attendance: 'pending',
      status: 'confirmed',
      date: { $lt: new Date() }
    });
    
    const attendanceRate = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const last30Days = bookings.filter(b => b.date > thirtyDaysAgo);
    const recentMissed = last30Days.filter(b => b.attendance === 'missed').length;
    const recentAttended = last30Days.filter(b => b.attendance === 'attended').length;
    const noShowTrend = last30Days.length > 0 ? (recentMissed / last30Days.length) * 100 : 0;
    
    let recommendation = '';
    let trendIcon = '';
    if (noShowTrend > 30) {
      recommendation = `⚠️ High no-show rate (${Math.round(noShowTrend)}%). Consider sending reminders 24h before sessions.`;
      trendIcon = '⚠️';
    } else if (noShowTrend > 15) {
      recommendation = `📌 Moderate no-show rate (${Math.round(noShowTrend)}%). Send gentle reminders to students.`;
      trendIcon = '📌';
    } else if (noShowTrend > 0) {
      recommendation = `✅ Good attendance! Only ${Math.round(noShowTrend)}% no-show rate. Keep it up!`;
      trendIcon = '✅';
    } else {
      recommendation = '🎉 Excellent! 0% no-show rate in the last 30 days. Great job!';
      trendIcon = '🎉';
    }
    
    res.json({
      totalSessions,
      attendedSessions,
      missedSessions,
      pendingAttendance,
      attendanceRate: Math.round(attendanceRate),
      noShowTrend: Math.round(noShowTrend),
      recentSessions: last30Days.length,
      recentAttended,
      recentMissed,
      recommendation,
      trendIcon
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get pending attendance sessions
router.get('/pending-attendance/:tutorId', requireAuth, async (req, res) => {
  try {
    const tutorId = req.params.tutorId;
    
    const pendingSessions = await Booking.find({
      tutor: tutorId,
      attendance: 'pending',
      status: 'confirmed',
      date: { $lt: new Date() }
    }).populate('student', 'name').populate('subject', 'name').sort({ date: -1 });
    
    res.json({
      count: pendingSessions.length,
      sessions: pendingSessions.map(s => ({
        id: s._id,
        studentName: s.student.name,
        subjectName: s.subject.name,
        date: s.date,
        startTime: s.startTime
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk mark attendance
router.post('/attendance/bulk', requireAuth, async (req, res) => {
  try {
    const { attendanceData } = req.body;
    
    for (const item of attendanceData) {
      const booking = await Booking.findById(item.bookingId);
      if (booking && booking.tutor.toString() === req.session.user.id) {
        booking.attendance = item.attendance;
        if (item.attendance === 'attended') {
          booking.status = 'completed';
          await User.findByIdAndUpdate(booking.tutor, { $inc: { totalSessions: 1 } });
        }
        await booking.save();
      }
    }
    
    res.json({ success: true, message: 'Bulk attendance updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ML ENDPOINTS ============

// 1. Predict student success score
router.get('/predict-success/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const bookings = await Booking.find({ student: studentId });
    const completed = bookings.filter(b => b.status === 'completed');
    const cancelled = bookings.filter(b => b.status === 'cancelled');
    const reviews = await Review.find({ student: studentId });
    const ratingHistory = reviews.map(r => r.rating);
    const performanceTrend = calculatePerformanceTrend(ratingHistory);
    const attendanceRate = completed.length / (bookings.length || 1);
    const avgSessionDuration = completed.reduce((sum, b) => sum + (b.duration || 1), 0) / (completed.length || 1);
    const consistencyScore = calculateConsistencyScore(bookings);
    let successScore = 0;
    successScore += attendanceRate * 0.35;
    successScore += (avgSessionDuration / 2) * 0.25;
    successScore += consistencyScore * 0.25;
    successScore += (completed.length / 20) * 0.15;
    successScore = Math.min(successScore, 1);
    const bestStudyTime = predictBestStudyTime(bookings);
    let prediction = '';
    if (successScore >= 0.8) prediction = '🎉 High chance of academic success';
    else if (successScore >= 0.5) prediction = '📈 Moderate chance of success - keep attending sessions';
    else prediction = '⚠️ Consider increasing session frequency for better results';
    
    res.json({
      successScore: Math.round(successScore * 100),
      attendanceRate: Math.round(attendanceRate * 100),
      avgSessionDuration: avgSessionDuration.toFixed(1),
      consistencyScore: Math.round(consistencyScore * 100),
      totalSessions: bookings.length,
      completedSessions: completed.length,
      cancelledSessions: cancelled.length,
      prediction,
      recommendation: getRecommendation(successScore),
      performanceTrend,
      bestStudyTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Predict no-show risk for a session
router.get('/predict-noshow/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId).populate('student');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const studentBookings = await Booking.find({ student: booking.student._id });
    const completed = studentBookings.filter(b => b.status === 'completed').length;
    const cancelled = studentBookings.filter(b => b.status === 'cancelled').length;
    const hour = parseInt(booking.startTime.split(':')[0]);
    const day = new Date(booking.date).getDay();
    const studentHistory = {
      cancellations: cancelled,
      attended: completed,
      total: studentBookings.length,
      lateBookings: 0,
      earlyMorningSessions: hour < 9 ? 1 : 0,
      fridaySessions: day === 5 ? 1 : 0
    };
    const riskScore = predictNoShowRisk(studentHistory);
    let riskLevel = '', recommendation = '', color = '';
    if (riskScore > 0.7) {
      riskLevel = 'High'; recommendation = 'Send urgent reminder 2 hours before session'; color = '#EF4444';
    } else if (riskScore > 0.4) {
      riskLevel = 'Medium'; recommendation = 'Send gentle reminder 1 day before session'; color = '#FBBF24';
    } else {
      riskLevel = 'Low'; recommendation = 'Student has good attendance record'; color = '#10B981';
    }
    
    res.json({
      riskScore: Math.round(riskScore * 100),
      riskLevel, color, recommendation,
      factors: {
        previousCancellations: cancelled,
        attendanceRate: Math.round((completed / (studentBookings.length || 1)) * 100) + '%',
        isEarlyMorning: hour < 9, isFriday: day === 5
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get AI tutor recommendations
router.get('/recommend-tutors/:studentId/:subjectId', async (req, res) => {
  try {
    const { studentId, subjectId } = req.params;
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    const tutors = await User.find({ role: 'tutor', modules: { $in: [subject.code] } }).select('name rating modules totalSessions');
    const studentPastBookings = await Booking.find({ student: studentId, status: 'completed' }).populate('tutor');
    const recommendations = [];
    for (const tutor of tutors) {
      const score = calculateTutorRecommendationScore(tutor, studentPastBookings, subject.code);
      const previousCount = studentPastBookings.filter(b => b.tutor && b.tutor._id && b.tutor._id.toString() === tutor._id.toString()).length;
      recommendations.push({
        tutor: { id: tutor._id, name: tutor.name, rating: tutor.rating || 0, totalSessions: tutor.totalSessions || 0, modules: tutor.modules },
        score: Math.round(score * 20),
        reason: getRecommendationReason(score, previousCount),
        previousSessions: previousCount
      });
    }
    recommendations.sort((a, b) => b.score - a.score);
    res.json({
      subject: subject.name, subjectCode: subject.code,
      recommendations: recommendations.slice(0, 5),
      message: recommendations.length === 0 ? 'No tutors available for this subject yet' : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get dynamic pricing for a session
router.get('/dynamic-price/:subjectCode/:timeSlot/:date', async (req, res) => {
  try {
    const { subjectCode, timeSlot, date } = req.params;
    const dayOfWeek = new Date(date).getDay();
    const lastMonthBookings = await Booking.find({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      status: 'confirmed'
    }).populate('subject');
    const subjectCounts = {};
    lastMonthBookings.forEach(booking => {
      if (booking.subject) { const code = booking.subject.code; subjectCounts[code] = (subjectCounts[code] || 0) + 1; }
    });
    const allSubjects = Object.keys(subjectCounts);
    const sortedSubjects = allSubjects.sort((a, b) => subjectCounts[b] - subjectCounts[a]);
    const highDemandSubjects = sortedSubjects.slice(0, 3);
    const demandData = { highDemandSubjects };
    const price = calculateDynamicPrice(subjectCode, timeSlot, dayOfWeek, demandData);
    let priceCategory = '', savingsMessage = '';
    if (price > 25) { priceCategory = 'Peak pricing - High demand period'; savingsMessage = 'Consider booking during off-peak hours for better rates'; }
    else if (price < 18) { priceCategory = 'Off-peak discount available'; savingsMessage = `Save R${20 - price} by booking now!`; }
    else { priceCategory = 'Standard pricing'; savingsMessage = 'Regular rate applies'; }
    res.json({
      basePrice: 20, finalPrice: price, savings: price < 20 ? 20 - price : 0,
      surcharge: price > 20 ? price - 20 : 0, category: priceCategory, savingsMessage,
      breakdown: {
        subjectDemand: highDemandSubjects.includes(subjectCode) ? '+30%' : '0%',
        peakHour: (parseInt(timeSlot.split(':')[0]) >= 16 && parseInt(timeSlot.split(':')[0]) <= 20) ? '+20%' : '0%',
        weekend: dayOfWeek >= 5 ? '+15%' : '0%',
        discount: (parseInt(timeSlot.split(':')[0]) >= 12 && parseInt(timeSlot.split(':')[0]) <= 14) ? '-10%' : '0%'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Analyze review sentiment
router.get('/analyze-review/:reviewId', async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId).populate('student', 'name').populate('tutor', 'name');
    if (!review) return res.status(404).json({ error: 'Review not found' });
    const sentiment = analyzeSentiment(review.comment);
    let insight = '';
    if (sentiment.sentiment === 'Very Positive' || sentiment.sentiment === 'Positive') insight = '🎉 This tutor is highly recommended by students.';
    else if (sentiment.sentiment === 'Negative' || sentiment.sentiment === 'Very Negative') insight = '⚠️ Consider addressing the concerns raised.';
    else insight = '📝 Neutral feedback - no immediate action needed.';
    res.json({ review: { id: review._id, student: review.student.name, tutor: review.tutor.name, rating: review.rating, comment: review.comment, date: review.createdAt }, sentiment, insight, emoji: sentiment.emoji });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get peak booking times prediction
router.get('/peak-times', async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'confirmed' });
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    bookings.forEach(booking => {
      const hour = parseInt(booking.startTime.split(':')[0]);
      const day = new Date(booking.date).getDay();
      hourCounts[hour]++; dayCounts[day]++;
    });
    const peakHours = hourCounts.map((count, hour) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 3);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const peakDays = dayCounts.map((count, day) => ({ day: days[day], count })).sort((a, b) => b.count - a.count).slice(0, 2);
    let trend = 'stable', trendMessage = '';
    if (bookings.length >= 4) {
      const weeklyCounts = [];
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
        const weekCount = bookings.filter(b => new Date(b.date) >= weekStart && new Date(b.date) < weekEnd).length;
        weeklyCounts.push(weekCount);
      }
      if (weeklyCounts[0] > weeklyCounts[3] * 1.1) { trend = 'increasing'; trendMessage = '📈 Booking demand is increasing - book early!'; }
      else if (weeklyCounts[0] < weeklyCounts[3] * 0.9) { trend = 'decreasing'; trendMessage = '📉 Booking demand is decreasing - more availability!'; }
      else trendMessage = '📊 Booking demand is stable';
    } else trendMessage = '📊 Need more data to determine trend';
    res.json({
      peakHours: peakHours.map(p => ({ time: `${p.hour}:00`, bookings: p.count })),
      peakDays: peakDays.map(p => ({ day: p.day, bookings: p.count })),
      trend, trendMessage,
      recommendation: `📅 Best time to book: ${peakDays[0].day} between ${peakHours[0].hour}:00 - ${peakHours[0].hour + 1}:00`,
      insight: trendMessage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get overall ML dashboard insights
router.get('/ml-insights/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'student') {
      const bookings = await Booking.find({ student: userId });
      const completed = bookings.filter(b => b.status === 'completed');
      const cancelled = bookings.filter(b => b.status === 'cancelled');
      const attendanceRate = completed.length / (bookings.length || 1);
      const consistencyScore = calculateConsistencyScore(bookings);
      let successScore = 0;
      successScore += attendanceRate * 0.4;
      successScore += consistencyScore * 0.3;
      successScore += (completed.length / 10) * 0.3;
      successScore = Math.min(successScore, 1);
      const reviews = await Review.find({ student: userId });
      const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;
      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
      reviews.forEach(review => {
        const sentiment = analyzeSentiment(review.comment);
        if (sentiment.sentiment === 'Very Positive' || sentiment.sentiment === 'Positive') sentimentCounts.positive++;
        else if (sentiment.sentiment === 'Negative' || sentiment.sentiment === 'Very Negative') sentimentCounts.negative++;
        else sentimentCounts.neutral++;
      });
      const bestStudyTime = predictBestStudyTime(bookings);
      const performanceTrend = calculatePerformanceTrend(reviews.map(r => r.rating));
      res.json({
        role: 'student',
        insights: {
          successScore: Math.round(successScore * 100),
          attendanceRate: Math.round(attendanceRate * 100),
          consistencyScore: Math.round(consistencyScore * 100),
          totalSessions: bookings.length,
          completedSessions: completed.length,
          cancelledSessions: cancelled.length,
          averageRating: avgRating,
          recommendation: getRecommendation(successScore),
          bestStudyTime, performanceTrend, sentimentBreakdown: sentimentCounts
        }
      });
    } else if (user.role === 'tutor') {
      const bookings = await Booking.find({ tutor: userId });
      const completed = bookings.filter(b => b.status === 'completed');
      const reviews = await Review.find({ tutor: userId });
      const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : user.rating || 0;
      const sentiments = reviews.map(r => analyzeSentiment(r.comment));
      const positiveCount = sentiments.filter(s => s.sentiment === 'Very Positive' || s.sentiment === 'Positive').length;
      const negativeCount = sentiments.filter(s => s.sentiment === 'Negative' || s.sentiment === 'Very Negative').length;
      const ratingTrend = calculatePerformanceTrend(reviews.map(r => r.rating));
      res.json({
        role: 'tutor',
        insights: {
          totalSessions: bookings.length, completedSessions: completed.length,
          totalReviews: reviews.length, averageRating: avgRating,
          positiveReviewRate: Math.round((positiveCount / (reviews.length || 1)) * 100),
          negativeReviewRate: Math.round((negativeCount / (reviews.length || 1)) * 100),
          recommendation: positiveCount > reviews.length / 2 ? '🌟 Excellent work! Keep it up!' : negativeCount > reviews.length / 3 ? '📝 Consider reviewing student feedback.' : '👍 Good job! Continue engaging with students.',
          ratingTrend,
          sentimentBreakdown: { positive: positiveCount, neutral: sentiments.filter(s => s.sentiment === 'Neutral').length, negative: negativeCount }
        }
      });
    } else {
      const totalBookings = await Booking.countDocuments();
      const totalStudents = await User.countDocuments({ role: 'student' });
      const totalTutors = await User.countDocuments({ role: 'tutor' });
      const totalReviews = await Review.countDocuments();
      const avgRatingOverall = await Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);
      res.json({
        role: 'admin',
        insights: {
          totalBookings, totalStudents, totalTutors, totalReviews,
          averageRating: avgRatingOverall[0]?.avg?.toFixed(1) || 0,
          message: 'Full analytics dashboard available at /admin-analytics',
          quickStats: {
            bookingsThisMonth: await Booking.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
            newStudentsThisMonth: await User.countDocuments({ role: 'student', createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
          }
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking
router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { subjectId, tutorId, date, startTime, duration, location, notes } = req.body;
    const studentId = req.session.user.id;
    const durationNum = parseFloat(duration);
    const endTime = calculateEndTime(startTime, durationNum);
    const subject = await Subject.findById(subjectId);
    const tutor = await User.findById(tutorId);
    if (!tutor.modules.includes(subject.code)) return res.redirect('/book-session?error=Tutor does not teach this subject');
    const studentDouble = await checkDoubleBooking(Booking, studentId, date, startTime, endTime, 'student');
    if (studentDouble) return res.redirect('/book-session?error=You already have a session at this time');
    const tutorDouble = await checkDoubleBooking(Booking, tutorId, date, startTime, endTime, 'tutor');
    if (tutorDouble) return res.redirect('/book-session?error=Tutor is already booked at this time');
    const booking = new Booking({ student: studentId, tutor: tutorId, subject: subjectId, date: new Date(date), startTime, endTime, duration: durationNum, location, notes, status: 'pending' });
    await booking.save();
    const studentBookings = await Booking.find({ student: studentId });
    const completed = studentBookings.filter(b => b.status === 'completed').length;
    const cancelled = studentBookings.filter(b => b.status === 'cancelled').length;
    const hour = parseInt(startTime.split(':')[0]);
    const day = new Date(date).getDay();
    const studentHistory = { cancellations: cancelled, attended: completed, total: studentBookings.length, lateBookings: 0, earlyMorningSessions: hour < 9 ? 1 : 0, fridaySessions: day === 5 ? 1 : 0 };
    const noShowRisk = predictNoShowRisk(studentHistory);
    if (noShowRisk > 0.6) {
      await new Notification({ user: studentId, title: '⚠️ Attendance Reminder', message: 'Our system predicts a high chance of no-show. Please confirm your attendance or reschedule.', type: 'alert', relatedBooking: booking._id }).save();
    }
    await new Notification({ user: tutorId, title: 'New Booking Request', message: `${req.session.user.name} requested a ${durationNum} hour session for ${subject.name} at ${startTime}`, type: 'booking', relatedBooking: booking._id }).save();
    res.redirect('/my-bookings?success=Booking created successfully');
  } catch (error) {
    console.error(error);
    res.redirect('/book-session?error=Failed to create booking');
  }
});

// Update booking status
router.put('/bookings/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('student', 'name').populate('subject', 'name');
    booking.status = status;
    await booking.save();
    await new Notification({ user: booking.student._id, title: `Booking ${status}`, message: `Your ${booking.subject.name} session has been ${status}`, type: 'booking', relatedBooking: booking._id }).save();
    res.redirect('/student-requests');
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit review with sentiment analysis
router.post('/reviews', requireAuth, async (req, res) => {
  try {
    const { tutorId, bookingId, rating, comment } = req.body;
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) return res.redirect('/my-bookings?error=You already reviewed this session');
    const sentiment = analyzeSentiment(comment);
    const review = new Review({ student: req.session.user.id, tutor: tutorId, booking: bookingId, rating: parseInt(rating), comment, sentiment: sentiment.sentiment });
    await review.save();
    const reviews = await Review.aggregate([{ $match: { tutor: tutorId } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]);
    const newRating = Math.round((reviews[0]?.avg || 0) * 10) / 10;
    await User.findByIdAndUpdate(tutorId, { rating: newRating });
    await new Notification({ user: tutorId, title: 'New Review Received!', message: `${req.session.user.name} rated you ${rating}/5 stars. Sentiment: ${sentiment.sentiment} ${sentiment.emoji}`, type: 'review', relatedBooking: bookingId }).save();
    res.redirect('/my-bookings?success=Thank you for your review!');
  } catch (error) {
    res.redirect('/my-bookings?error=Failed to submit review');
  }
});

// Cancel booking
router.delete('/bookings/:id', requireAuth, async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.redirect('/my-bookings?success=Booking cancelled');
  } catch (error) {
    res.redirect('/my-bookings?error=Failed to cancel');
  }
});

// Mark notification as read
router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/user/read-all', requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.session.user.id }, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all subjects (API)
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;