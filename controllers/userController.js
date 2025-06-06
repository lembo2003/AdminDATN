const User = require('../models/user');
const Booking = require('../models/booking');
const Order = require('../models/order');
const Appeal = require('../models/appeal');
const { auth, adminFirestore } = require('../config/firebase');
const auth_middleware = require('../middleware/auth');

/**
 * Check if user is suspended or banned
 * @param {Object} userData - User data
 * @returns {Object|null} - Returns error object with details if user is restricted, null otherwise
 */
const checkUserRestrictions = (userData) => {
  if (!userData) return null;
  
  // Check if user is banned
  if (userData.status === 'banned') {
    return {
      status: 'banned',
      message: 'Your account has been banned. Please contact customer support for assistance.',
      restricted: true
    };
  }
  
  // Check if user is suspended
  if (userData.status === 'suspended') {
    let suspensionDays = 0;
    let suspensionEnd = null;
    
    // Check if suspension period is over
    if (userData.suspensionEnd) {
      suspensionEnd = userData.suspensionEnd.seconds 
        ? new Date(userData.suspensionEnd.seconds * 1000) 
        : new Date(userData.suspensionEnd);
      
      const now = new Date();
      
      if (now < suspensionEnd) {
        suspensionDays = Math.ceil((suspensionEnd - now) / (1000 * 60 * 60 * 24));
        
        return {
          status: 'suspended',
          message: `Your account is suspended for ${suspensionDays} more day(s). Please try again later.`,
          suspensionEnd: suspensionEnd,
          suspensionDays: suspensionDays,
          restricted: true
        };
      } else {
        // Suspension period is over, reactivate user
        User.update(userData.id, { status: 'active' });
        return null;
      }
    }
    
    return {
      status: 'suspended',
      message: 'Your account is suspended. Please contact customer support for assistance.',
      restricted: true
    };
  }
  
  return null;
};

exports.getAccountRestricted = (req, res) => {
  // Get restriction info from query params or session
  const restrictionInfo = req.session.restrictionInfo || {
    status: req.query.status || 'suspended',
    suspensionEnd: req.query.end ? new Date(parseInt(req.query.end)) : null,
    suspensionDays: req.query.days || 0
  };
  
  // Clear the restriction info from session after use
  req.session.restrictionInfo = null;
  
  // Convert suspensionEnd to a timestamp number for simplicity
  let suspensionEndTime = null;
  
  if (restrictionInfo.suspensionEnd) {
    try {
      // Handle Firestore Timestamp
      if (restrictionInfo.suspensionEnd.seconds && restrictionInfo.suspensionEnd.nanoseconds) {
        suspensionEndTime = restrictionInfo.suspensionEnd.seconds * 1000;
      }
      // Handle JavaScript Date
      else if (restrictionInfo.suspensionEnd instanceof Date) {
        suspensionEndTime = restrictionInfo.suspensionEnd.getTime();
      }
      // Handle number timestamp
      else if (typeof restrictionInfo.suspensionEnd === 'number') {
        suspensionEndTime = restrictionInfo.suspensionEnd;
      }
      // Handle string date
      else if (typeof restrictionInfo.suspensionEnd === 'string') {
        suspensionEndTime = new Date(restrictionInfo.suspensionEnd).getTime();
      }
    } catch (e) {
      console.error('Error parsing suspension end date:', e);
      // Default to 1 day from now
      suspensionEndTime = Date.now() + (24 * 60 * 60 * 1000);
    }
  }
  
  res.render('user/account-restricted', {
    title: 'Account Restricted',
    user: req.session.user,
    status: restrictionInfo.status,
    suspensionEndTime: suspensionEndTime,
    suspensionDays: restrictionInfo.suspensionDays || 0
  });
};

/**
 * Custom middleware to check for suspended/banned users
 */
const checkUserStatusMiddleware = async (req, res, next) => {
  try {
    // Skip for non-authenticated requests
    if (!req.session.user) {
      return next();
    }
    
    // Skip for the account-restricted route to avoid redirect loops
    if (req.path === '/account-restricted') {
      return next();
    }
    
    const userId = req.session.user.id;
    const user = await User.getByUid(userId);
    
    if (!user) {
      req.flash('error_msg', 'User account not found');
      return res.redirect('/auth/logout');
    }
    
    // Check if user is suspended or banned
    const restriction = checkUserRestrictions(user);
    if (restriction && restriction.restricted) {
      // Store restriction info in session for the restricted page
      req.session.restrictionInfo = restriction;
      
      // Redirect to the restricted account page
      return res.redirect('/users/account-restricted');
    }
    
    next();
  } catch (error) {
    console.error('Check user status error:', error);
    next();
  }
};

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
    
    // Check if user is suspended or banned
    const restriction = checkUserRestrictions(user);
    if (restriction) {
      req.flash('error_msg', restriction.message);
      return res.redirect(restriction.redirect);
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
    const user = await User.getByUid(userId);
    
    // Check if user is suspended or banned
    const restriction = checkUserRestrictions(user);
    if (restriction) {
      req.flash('error_msg', restriction.message);
      return res.redirect(restriction.redirect);
    }
    
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
exports.getChangePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.getByUid(userId);
    
    // Check if user is suspended or banned
    const restriction = checkUserRestrictions(user);
    if (restriction) {
      req.flash('error_msg', restriction.message);
      return res.redirect(restriction.redirect);
    }
    
    res.render('user/change-password', {
      title: 'Change Password',
      user: req.session.user
    });
  } catch (error) {
    console.error('Get change password error:', error);
    req.flash('error_msg', 'Error loading change password page');
    res.redirect('/users/profile');
  }
};

/**
 * Process change password
 */
exports.changePassword = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.getByUid(userId);
    
    // Check if user is suspended or banned
    const restriction = checkUserRestrictions(user);
    if (restriction) {
      req.flash('error_msg', restriction.message);
      return res.redirect(restriction.redirect);
    }
    
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Verify new passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/users/change-password');
    }
    
    // Reauthenticate user with current password
    const authUser = auth.currentUser;
    
    if (!authUser) {
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
    const user = await User.getByUid(userId);
    
    // Check if user is suspended or banned
    const restriction = checkUserRestrictions(user);
    if (restriction) {
      req.flash('error_msg', restriction.message);
      return res.redirect(restriction.redirect);
    }
    
    // Safely fetch bookings and orders with error handling
    const [bookingsRaw, ordersRaw] = await Promise.all([
      safelyFetchData(Booking.getAll, { userId }),
      safelyFetchData(Order.getAll, { userId })
    ]);
    
    // Safely sort data in memory to avoid Firestore ordering issues
    const bookings = safelySort(bookingsRaw, (a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      const timeA = a.createdAt.seconds ? a.createdAt.seconds : a.createdAt;
      const timeB = b.createdAt.seconds ? b.createdAt.seconds : b.createdAt;
      return timeB - timeA;
    });
    
    const orders = safelySort(ordersRaw, (a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      const timeA = a.createdAt.seconds ? a.createdAt.seconds : a.createdAt;
      const timeB = b.createdAt.seconds ? b.createdAt.seconds : b.createdAt;
      return timeB - timeA;
    });
    
    // Get active booking - safely with null checks
    const activeBooking = bookings.find(b => b && b.status === 'checked-in');
    
    // Get active order - safely with null checks
    const activeOrder = orders.find(o => o && (o.status === 'ordered' || o.status === 'delivering'));
    
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

/**
 * Process account appeal form
 */
exports.submitAppeal = async (req, res) => {
  console.log('==========================================');
  console.log('APPEAL SUBMISSION STARTED');
  console.log('Request method:', req.method);
  console.log('Request path:', req.path);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  console.log('Session user:', req.session.user);
  console.log('==========================================');
  
  try {
    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      console.error('ERROR: User not authenticated for appeal submission');
      return res.status(401).json({ 
        success: false, 
        message: 'You must be logged in to submit an appeal',
        error: 'NOT_AUTHENTICATED'
      });
    }
    
    const userId = req.session.user.id;
    console.log('User ID from session:', userId);
    
    // Check if the request body contains form data
    if (!req.body) {
      console.error('ERROR: Empty request body');
      return res.status(400).json({ 
        success: false, 
        message: 'No data provided',
        error: 'EMPTY_BODY' 
      });
    }
    
    const { appealReason, explanation, contactMethod } = req.body;
    console.log('Form data extracted:', { appealReason, explanation, contactMethod });
    
    // Validate form data
    if (!appealReason || !explanation || !contactMethod) {
      console.error('ERROR: Missing required fields:', { appealReason, explanation, contactMethod });
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required',
        error: 'MISSING_FIELDS',
        missing: {
          appealReason: !appealReason,
          explanation: !explanation,
          contactMethod: !contactMethod
        }
      });
    }
    
    // Get the user data
    console.log('Attempting to get user data for userId:', userId);
    const user = await User.getByUid(userId);
    
    if (!user) {
      console.error('ERROR: User not found for appeal submission, userId:', userId);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found',
        error: 'USER_NOT_FOUND' 
      });
    }
    
    console.log('User found:', { id: user.id, email: user.email });
    
    // Store the appeal in Firestore
    const appealData = {
      userId,
      userName: user.name || user.email,
      userEmail: user.email,
      reason: appealReason,
      explanation,
      preferredContact: contactMethod,
      accountStatus: user.status || 'unknown',
      submitted: new Date(),
      status: 'pending' // pending, approved, rejected
    };
    
    console.log('Appeal data prepared:', appealData);
    
    // Check if Appeal model exists
    console.log('Appeal model type:', typeof Appeal);
    console.log('adminFirestore available:', typeof adminFirestore !== 'undefined');
    
    try {
      // Try using Appeal model
      if (typeof Appeal === 'function') {
        console.log('Using Appeal model to create appeal');
        const createdAppeal = await Appeal.create(appealData);
        console.log('Appeal created successfully using model:', createdAppeal);
      } else {
        // Fallback to direct Firestore
        console.log('Appeal model not available as function, using direct Firestore call');
        if (!adminFirestore) {
          throw new Error('adminFirestore is not defined');
        }
        
        const appealsCollection = adminFirestore.collection('appeals');
        console.log('Appeals collection reference created');
        
        const appealRef = await appealsCollection.add(appealData);
        console.log('Appeal created successfully using direct Firestore, ID:', appealRef.id);
      }
      
      console.log('Appeal submission completed successfully');
      
      return res.json({ 
        success: true, 
        message: 'Your appeal has been submitted successfully. We will review it and contact you soon.'
      });
    } catch (firestoreError) {
      console.error('FIRESTORE ERROR while saving appeal:', firestoreError);
      console.error('Error name:', firestoreError.name);
      console.error('Error message:', firestoreError.message);
      console.error('Error stack:', firestoreError.stack);
      
      return res.status(500).json({ 
        success: false, 
        message: 'Error saving your appeal to our system. Please try again or contact support directly.',
        error: 'FIRESTORE_ERROR',
        details: firestoreError.message
      });
    }
  } catch (error) {
    console.error('GENERAL ERROR in submit appeal:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error submitting your appeal. Please try again or contact support directly.',
      error: 'GENERAL_ERROR',
      details: error.message
    });
  } finally {
    console.log('==========================================');
    console.log('APPEAL SUBMISSION PROCESS COMPLETED');
    console.log('==========================================');
  }
};

// Export routes with auth middleware and status check
exports.routes = (router) => {
  // All routes require authentication
  router.use(auth_middleware);
  
  // Account restricted page needs special handling
  router.get('/account-restricted', exports.getAccountRestricted);
  
  // Appeal submission route (needs to be accessible for restricted users)
  router.post('/submit-appeal', exports.submitAppeal);
  
  // The rest of the routes should only be accessible to unrestricted users
  // Add status check middleware for these protected routes
  router.use((req, res, next) => {
    // Skip for the routes we've already handled
    if (req.path === '/account-restricted' || req.path === '/submit-appeal') {
      return next();
    }
    
    // Check if user is restricted
    if (req.session.user && req.session.user.restricted === true) {
      return res.redirect('/users/account-restricted');
    }
    
    // Check for suspended/banned status
    if (req.session.user) {
      User.getByUid(req.session.user.id)
        .then(userData => {
          if (userData) {
            const restriction = checkUserRestrictions(userData);
            if (restriction && restriction.restricted) {
              req.session.restrictionInfo = restriction;
              return res.redirect('/users/account-restricted');
            }
          }
          next();
        })
        .catch(err => {
          console.error("Error checking user status:", err);
          next(); // Continue anyway on error
        });
    } else {
      next();
    }
  });
  
  // Protected routes (require active account)
  router.get('/profile', exports.getProfile);
  router.post('/profile', exports.updateProfile);
  router.get('/change-password', exports.getChangePassword);
  router.post('/change-password', exports.changePassword);
  router.get('/dashboard', exports.getDashboard);
  
  return router;
};