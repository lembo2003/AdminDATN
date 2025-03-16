const User = require('../models/user');
const Booking = require('../models/booking');
const Order = require('../models/order');
const { auth } = require('../config/firebase');
const auth_middleware = require('../middleware/auth');

/**
 * Render user profile page
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.getByUid(userId);
    
    if (!user) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/');
    }
    
    res.render('user/profile', {
      title: 'My Profile',
      user: req.session.user,
      userData: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/');
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, gender, province, country, phone } = req.body;
    
    // Update user profile
    const updatedUser = await User.update(userId, {
      name,
      gender,
      province,
      country,
      phone
    });
    
    // Update session data
    req.session.user = updatedUser;
    
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/users/profile');
  } catch (error) {
    console.error('Update profile error:', error);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/users/profile');
  }
};

/**
 * Render change password form
 */
exports.getChangePassword = (req, res) => {
  res.render('user/change-password', {
    title: 'Change Password',
    user: req.session.user
  });
};

/**
 * Process change password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Verify new passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/users/change-password');
    }
    
    // Reauthenticate user with current password
    const user = auth.currentUser;
    
    if (!user) {
      // Re-login to Firebase if session exists but Firebase auth state is lost
      await auth.signInWithEmailAndPassword(req.session.user.email, currentPassword);
    }
    
    // Update password
    await auth.currentUser.updatePassword(newPassword);
    
    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/users/profile');
  } catch (error) {
    console.error('Change password error:', error);
    
    // Handle specific Firebase auth errors
    let errorMessage = 'Error changing password';
    
    if (error.code === 'auth/wrong-password') {
      errorMessage = 'Current password is incorrect';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'New password is too weak';
    } else if (error.code === 'auth/requires-recent-login') {
      // Force user to log in again
      req.flash('error_msg', 'For security reasons, please log in again before changing your password');
      return res.redirect('/auth/logout');
    }
    
    req.flash('error_msg', errorMessage);
    res.redirect('/users/change-password');
  }
};

/**
 * Render user dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get user's recent bookings and orders
    const [bookings, orders] = await Promise.all([
      Booking.getAll({ userId }),
      Order.getAll({ userId })
    ]);
    
    // Sort bookings and orders by date (most recent first)
    bookings.sort((a, b) => b.createdAt - a.createdAt);
    orders.sort((a, b) => b.createdAt - a.createdAt);
    
    // Get active booking
    const activeBooking = bookings.find(b => b.status === 'checked-in');
    
    // Get active order
    const activeOrder = orders.find(o => o.status === 'ordered' || o.status === 'delivering');
    
    res.render('user/dashboard', {
      title: 'My Dashboard',
      user: req.session.user,
      recentBookings: bookings.slice(0, 3),
      recentOrders: orders.slice(0, 3),
      activeBooking,
      activeOrder,
      bookingsCount: bookings.length,
      ordersCount: orders.length
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

// Export routes with auth middleware
exports.routes = (router) => {
  // All routes require authentication
  router.use(auth_middleware);
  
  router.get('/profile', exports.getProfile);
  router.post('/profile', exports.updateProfile);
  router.get('/change-password', exports.getChangePassword);
  router.post('/change-password', exports.changePassword);
  router.get('/dashboard', exports.getDashboard);
  
  return router;
};
