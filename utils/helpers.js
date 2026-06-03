// Convert time string to minutes for comparison
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Generate time slots every 30 minutes from 8 AM to 8 PM
function generateTimeSlots() {
  const slots = [];
  for (let hour = 8; hour <= 20; hour++) {
    for (let minute of ['00', '30']) {
      const time = `${hour.toString().padStart(2, '0')}:${minute}`;
      slots.push(time);
    }
  }
  return slots;
}

// Check for double booking
async function checkDoubleBooking(Booking, userId, date, startTime, endTime, role) {
  const query = {
    date: new Date(date),
    status: { $in: ['confirmed', 'pending'] }
  };
  
  if (role === 'student') {
    query.student = userId;
  } else {
    query.tutor = userId;
  }
  
  const existingBookings = await Booking.find(query);
  
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  for (const booking of existingBookings) {
    const existingStart = timeToMinutes(booking.startTime);
    const existingEnd = timeToMinutes(booking.endTime);
    
    if (startMinutes < existingEnd && endMinutes > existingStart) {
      return true;
    }
  }
  return false;
}

// Calculate end time from start time and duration
function calculateEndTime(startTime, durationHours) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  let endHour = startHour;
  let endMinute = startMinute + (durationHours * 60);
  while (endMinute >= 60) {
    endHour++;
    endMinute -= 60;
  }
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
}

// ============ MACHINE LEARNING FUNCTIONS ============

// 1. No-Show Risk Prediction
function predictNoShowRisk(studentHistory) {
  let riskScore = 0;
  riskScore += (studentHistory.cancellations || 0) * 0.2;
  riskScore += (studentHistory.lateBookings || 0) * 0.15;
  const attendanceRate = studentHistory.attended / (studentHistory.total || 1);
  if (attendanceRate < 0.7) riskScore += 0.3;
  if (attendanceRate < 0.5) riskScore += 0.2;
  if (studentHistory.earlyMorningSessions > 0) riskScore += 0.1;
  if (studentHistory.fridaySessions > 0) riskScore += 0.05;
  return Math.min(Math.max(riskScore, 0), 1);
}

// 2. Sentiment Analysis on Reviews
function analyzeSentiment(reviewText) {
  const positiveWords = ['excellent', 'great', 'amazing', 'helpful', 'clear', 'patient', 'knowledgeable', 'awesome', 'fantastic', 'wonderful', 'perfect', 'best', 'love', 'thank', 'appreciate'];
  const negativeWords = ['bad', 'poor', 'unclear', 'rushed', 'late', 'confusing', 'terrible', 'awful', 'disappointed', 'waste', 'useless', 'unhelpful'];
  
  let score = 0;
  const words = reviewText.toLowerCase().split(' ');
  
  positiveWords.forEach(word => { if (words.includes(word)) score += 1; });
  negativeWords.forEach(word => { if (words.includes(word)) score -= 1; });
  
  if (score >= 2) return { sentiment: 'Very Positive', score: 5, color: '#10B981', emoji: '🌟🌟🌟🌟🌟' };
  if (score >= 1) return { sentiment: 'Positive', score: 4, color: '#34D399', emoji: '🌟🌟🌟🌟' };
  if (score >= -1) return { sentiment: 'Neutral', score: 3, color: '#FBBF24', emoji: '🌟🌟🌟' };
  if (score >= -2) return { sentiment: 'Negative', score: 2, color: '#F87171', emoji: '🌟🌟' };
  return { sentiment: 'Very Negative', score: 1, color: '#EF4444', emoji: '🌟' };
}

// 3. Dynamic Pricing Based on Demand
function calculateDynamicPrice(subjectCode, timeSlot, dayOfWeek, demandData) {
  let basePrice = 20;
  let multiplier = 1;
  const highDemandSubjects = demandData?.highDemandSubjects || ['WPR37(8)1', 'DBD37(8)1', 'MLG37(8)1'];
  if (highDemandSubjects.includes(subjectCode)) multiplier += 0.3;
  const mediumDemandSubjects = ['PRG271', 'DAL371'];
  if (mediumDemandSubjects.includes(subjectCode)) multiplier += 0.15;
  const hour = parseInt(timeSlot.split(':')[0]);
  if (hour >= 16 && hour <= 20) multiplier += 0.2;
  if (hour >= 12 && hour <= 14) multiplier -= 0.1;
  if (dayOfWeek >= 5) multiplier += 0.15;
  if (hour >= 20) multiplier -= 0.1;
  if (hour >= 8 && hour <= 10) multiplier -= 0.05;
  return Math.round(basePrice * multiplier);
}

// 4. Calculate consistency score
function calculateConsistencyScore(bookings) {
  if (bookings.length < 2) return 0.5;
  const days = bookings.map(b => new Date(b.date).getDay());
  const uniqueDays = new Set(days);
  const dayConsistency = 1 - (uniqueDays.size / 7);
  const times = bookings.map(b => b.startTime);
  const uniqueTimes = new Set(times);
  const timeConsistency = 1 - (uniqueTimes.size / Math.min(times.length, 12));
  let weeklyConsistency = 0;
  if (bookings.length >= 3) {
    const dayCounts = {};
    days.forEach(day => dayCounts[day] = (dayCounts[day] || 0) + 1);
    const mostCommonDay = Math.max(...Object.values(dayCounts));
    weeklyConsistency = mostCommonDay / bookings.length;
  }
  return (dayConsistency * 0.4 + timeConsistency * 0.3 + weeklyConsistency * 0.3);
}

// 5. Get recommendation based on success score
function getRecommendation(score) {
  if (score >= 0.8) return "🎉 You're on track! Consider advanced topics and challenging projects.";
  if (score >= 0.6) return "📈 Good progress! Try to maintain consistency and explore related subjects.";
  if (score >= 0.4) return "💪 Keep going! Increasing session frequency could boost your progress.";
  return "📚 Book more sessions and maintain regular attendance for better results.";
}

// 6. Calculate tutor recommendation score
function calculateTutorRecommendationScore(tutor, studentPastBookings, subjectCode) {
  let score = tutor.rating || 0;
  const previousSessions = studentPastBookings.filter(b => 
    b.tutor && b.tutor._id && b.tutor._id.toString() === tutor._id.toString() && b.status === 'completed'
  );
  if (previousSessions.length > 0) {
    score += previousSessions.length * 0.3;
    score += (previousSessions[0].studentRating || 0) * 0.2;
  }
  if (tutor.modules && tutor.modules.includes(subjectCode)) score += 0.5;
  score += (tutor.totalSessions || 0) * 0.02;
  return Math.min(score, 5);
}

// 7. Get recommendation reason
function getRecommendationReason(score, previousCount) {
  if (previousCount > 0) return "⭐ You've worked with this tutor before successfully";
  if (score > 4.5) return "🏆 Highly rated by other students (4.5+ stars)";
  if (score > 4) return "👍 Well-rated tutor for this subject";
  if (score > 3.5) return "📚 Experienced tutor available";
  return "👋 Available tutor for this subject";
}

// 8. Calculate performance trend
function calculatePerformanceTrend(ratingHistory) {
  if (ratingHistory.length < 3) return { trend: 'stable', message: 'Need more data to determine trend' };
  const firstHalf = ratingHistory.slice(0, Math.floor(ratingHistory.length / 2));
  const secondHalf = ratingHistory.slice(Math.floor(ratingHistory.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const improvement = secondAvg - firstAvg;
  if (improvement > 0.5) return { trend: 'improving', message: '📈 Your performance is improving! Keep going!', percentage: Math.round(improvement * 20) };
  if (improvement < -0.5) return { trend: 'declining', message: '📉 Your performance needs attention. Consider more focused study.', percentage: Math.round(Math.abs(improvement) * 20) };
  return { trend: 'stable', message: '📊 Your performance is stable. Try to push harder!', percentage: 0 };
}

// 9. Predict best study time
function predictBestStudyTime(bookingHistory) {
  if (bookingHistory.length === 0) {
    return { time: '16:00', reason: 'Based on general student data, late afternoon is most productive' };
  }
  const hourPerformance = {};
  for (let i = 0; i < 24; i++) hourPerformance[i] = { count: 0, rating: 0 };
  bookingHistory.forEach(booking => {
    const hour = parseInt(booking.startTime.split(':')[0]);
    hourPerformance[hour].count++;
    hourPerformance[hour].rating += booking.studentRating || 3;
  });
  let bestHour = 16;
  let bestScore = 0;
  for (let hour = 8; hour <= 20; hour++) {
    if (hourPerformance[hour].count > 0) {
      const avgRating = hourPerformance[hour].rating / hourPerformance[hour].count;
      const score = avgRating * (1 + Math.log(hourPerformance[hour].count + 1));
      if (score > bestScore) {
        bestScore = score;
        bestHour = hour;
      }
    }
  }
  const timeSlot = `${bestHour.toString().padStart(2, '0')}:00`;
  let reason = '';
  if (bestHour < 12) reason = 'Morning sessions work well for you';
  else if (bestHour < 17) reason = 'Afternoon sessions are your most productive time';
  else reason = 'Evening sessions suit your schedule best';
  return { time: timeSlot, reason };
}

module.exports = { 
  timeToMinutes, 
  generateTimeSlots, 
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
};