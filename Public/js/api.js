// Frontend API client
const API = {
  async request(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return response.json();
  },

  login(email, password) {
    return this.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },
  
  register(userData) {
    return this.request('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },
  
  getProfile(userId) {
    return this.request(`/api/users/profile/${userId}`);
  },
  
  createBooking(bookingData) {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },
  
  getUserBookings(userId, role) {
    return this.request(`/api/bookings/user/${userId}?role=${role}`);
  },
  
  updateBookingStatus(bookingId, status) {
    return this.request(`/api/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },
  
  getAllSubjects() {
    return this.request('/api/subjects');
  },
  
  getUserNotifications(userId) {
    return this.request(`/api/notifications/user/${userId}`);
  },
  
  markNotificationRead(notificationId) {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  },
  
  submitReview(reviewData) {
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },
  
  getTutorReviews(tutorId) {
    return this.request(`/api/reviews/tutor/${tutorId}`);
  },
  
  setAvailability(availData) {
    return this.request('/api/availability', {
      method: 'POST',
      body: JSON.stringify(availData)
    });
  },
  
  getTutorAvailability(tutorId) {
    return this.request(`/api/availability/tutor/${tutorId}`);
  }
};