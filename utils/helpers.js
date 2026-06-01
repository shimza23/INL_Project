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

module.exports = { timeToMinutes, generateTimeSlots, checkDoubleBooking, calculateEndTime };