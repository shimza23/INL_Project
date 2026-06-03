// Frontend API client with JWT handling
const API = {
  async request(endpoint, options = {}) {
    const response = await fetch(endpoint, {
      headers: { 
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (response.status === 401) {
      window.location.href = '/login';
      return null;
    }
    
    return response.json();
  },

  // Auth
  async login(email, password, role) {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password, role })
    });
    return response;
  },
  
  async register(userData) {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(userData)
    });
    return response;
  },
  
  async logout() {
    window.location.href = '/logout';
  },
  
  // Bookings
  async createBooking(bookingData) {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  },
  
  async getUserBookings(userId, role) {
    return this.request(`/api/bookings/user/${userId}?role=${role}`);
  },
  
  async updateBookingStatus(bookingId, status) {
    return this.request(`/api/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },
  
  async cancelBooking(bookingId) {
    return this.request(`/api/bookings/${bookingId}`, {
      method: 'DELETE'
    });
  },
  
  // Subjects
  async getAllSubjects() {
    return this.request('/api/subjects');
  },
  
  // Notifications
  async getUserNotifications(userId) {
    return this.request(`/api/notifications/user/${userId}`);
  },
  
  async markNotificationRead(notificationId) {
    return this.request(`/api/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  },
  
  async markAllNotificationsRead(userId) {
    return this.request(`/api/notifications/user/${userId}/read-all`, {
      method: 'PUT'
    });
  },
  
  // Reviews
  async submitReview(reviewData) {
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },
  
  async getTutorReviews(tutorId) {
    return this.request(`/api/reviews/tutor/${tutorId}`);
  },
  
  // Availability
  async setAvailability(availData) {
    return this.request('/api/availability', {
      method: 'POST',
      body: JSON.stringify(availData)
    });
  },
  
  async getTutorAvailability(tutorId) {
    return this.request(`/api/availability/tutor/${tutorId}`);
  },
  
  // Reports (Admin only)
  async getAnalytics() {
    return this.request('/api/reports/analytics');
  },
  
  // Users (Admin only)
  async getAllUsers() {
    return this.request('/api/users');
  },
  
  async updateUser(userId, userData) {
    return this.request(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    });
  },
  
  async deleteUser(userId) {
    return this.request(`/api/users/${userId}`, {
      method: 'DELETE'
    });
  }
};

// Navigation builder (client-side for static pages)
const NAV_PAGES = {
  student: [
    { href: '/student-dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/my-bookings', icon: '📅', label: 'My Bookings' },
    { href: '/book-session', icon: '🔍', label: 'Find a Tutor' },
    { href: '/notifications', icon: '🔔', label: 'Notifications' },
    { href: '/profile-settings', icon: '👤', label: 'Profile' },
  ],
  tutor: [
    { href: '/tutor-dashboard', icon: '📅', label: 'My Schedule' },
    { href: '/student-requests', icon: '📋', label: 'Student Requests' },
    { href: '/my-bookings', icon: '📊', label: 'Sessions' },
    { href: '/profile-settings', icon: '👤', label: 'Profile' },
  ],
  admin: [
    { href: '/admin-analytics', icon: '📈', label: 'Analytics' },
    { href: '/admin-bookings', icon: '📅', label: 'Bookings' },
    { href: '/admin-tutors', icon: '👩‍🏫', label: 'Tutors' },
    { href: '/admin-students', icon: '🎓', label: 'Students' },
    { href: '/admin-settings', icon: '⚙️', label: 'Settings' },
  ]
};

function buildSidebar(role, userName, userRole, currentPage) {
  const items = NAV_PAGES[role] || NAV_PAGES.student;
  const navHTML = items.map(item => {
    const isActive = item.href === currentPage;
    return `<a href="${item.href}" class="nav-item${isActive ? ' active' : ''}">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </a>`;
  }).join('');

  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

  return `
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">🎓</div>
        <div class="brand">
          <span class="brand-name">SmartTutor</span>
          <span class="brand-sub">Belgium Campus iTversity</span>
        </div>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
      <div class="sidebar-user">
        <div class="user-avatar">${initials}</div>
        <div>
          <div class="user-name">${userName}</div>
          <div class="user-role">${userRole}</div>
        </div>
      </div>
    </aside>`;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.API = API;
  window.buildSidebar = buildSidebar;
  window.NAV_PAGES = NAV_PAGES;
}