const { auth, adminAuth, adminFirestore } = require('../config/firebase');
const User = require('../models/user');
const nodemailer = require('nodemailer');
const { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  confirmPasswordReset
} = require('firebase/auth');

/**
 * Render login page
 */
exports.getLogin = (req, res) => {
  // Redirect to appropriate dashboard if already logged in
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/');
    }
  }
  
  // Get form data from flash if available
  const form_data = req.flash('form_data')[0] || {};
  
  res.render('auth/login', {
    title: 'Login',
    user: null,
    form_data
  });
};


/**
 * Process login form
 */
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Clear any existing session data first
    req.session.user = null;
    req.session.restrictionInfo = null;
    
    console.log("Login attempt for email:", email);
    
    // First, check if the user exists and is banned in our database
    // This happens BEFORE any Firebase authentication attempt
    const userByEmail = await User.getByEmail(email);
    
    // If user exists in our database and is banned or suspended
    if (userByEmail) {
      console.log("Found user in database:", userByEmail.id, "Status:", userByEmail.status || 'active');
      
      // If user is banned, redirect to restricted page
      if (userByEmail.status === 'banned') {
        console.log("User is banned, redirecting to restricted page");
        
        // Set a session for the banned user with limited access
        req.session.user = {
          id: userByEmail.id,
          email: userByEmail.email,
          name: userByEmail.name || email.split('@')[0],
          restricted: true
        };
        
        // Set restriction info
        req.session.restrictionInfo = {
          status: 'banned',
          message: 'Your account has been banned. Please contact customer support for assistance.',
          restricted: true
        };
        
        // Redirect to restricted page
        return res.redirect('/users/account-restricted');
      }
      
      // If user is suspended, check if suspension period is over
      if (userByEmail.status === 'suspended') {
        console.log("User is suspended, checking suspension period");
        
        let suspensionEndTime = null;
        let suspensionDays = 0;
        
        // Calculate remaining suspension time
        if (userByEmail.suspensionEnd) {
          try {
            // Convert various date formats to timestamp
            if (userByEmail.suspensionEnd.seconds && userByEmail.suspensionEnd.nanoseconds) {
              suspensionEndTime = userByEmail.suspensionEnd.seconds * 1000;
            } else if (userByEmail.suspensionEnd instanceof Date) {
              suspensionEndTime = userByEmail.suspensionEnd.getTime();
            } else if (typeof userByEmail.suspensionEnd === 'number') {
              suspensionEndTime = userByEmail.suspensionEnd;
            } else if (typeof userByEmail.suspensionEnd === 'string') {
              suspensionEndTime = new Date(userByEmail.suspensionEnd).getTime();
            }
            
            const now = Date.now();
            
            // If suspension is still active
            if (suspensionEndTime && suspensionEndTime > now) {
              suspensionDays = Math.ceil((suspensionEndTime - now) / (1000 * 60 * 60 * 24));
              console.log("Suspension is active, days remaining:", suspensionDays);
              
              // Create a limited session
              req.session.user = {
                id: userByEmail.id,
                email: userByEmail.email,
                name: userByEmail.name || email.split('@')[0],
                restricted: true
              };
              
              // Set restriction info
              req.session.restrictionInfo = {
                status: 'suspended',
                message: `Your account is suspended for ${suspensionDays} more day(s).`,
                suspensionEndTime: suspensionEndTime,
                suspensionDays: suspensionDays,
                restricted: true
              };
              
              // Redirect to restricted page
              return res.redirect('/users/account-restricted');
            } else {
              // Suspension period is over, reactivate user
              console.log("Suspension period is over, reactivating user");
              await User.update(userByEmail.id, { status: 'active' });
            }
          } catch (dateError) {
            console.error("Error processing suspension date:", dateError);
            // Continue with authentication if date processing fails
          }
        }
      }
    }
    
    // If we reach here, the user is either not banned/suspended or doesn't exist
    // Continue with normal Firebase authentication
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log("User authenticated with Firebase:", firebaseUser.uid);
      
      // Get user data from Firestore
      let userData = await User.getByUid(firebaseUser.uid);
      
      if (!userData) {
        console.log("User not found in Firestore by UID, checking by email");
        
        // Try to find by email again (in case UID doesn't match for some reason)
        userData = userByEmail;
        
        if (!userData) {
          console.log("User still not found, creating basic user");
          userData = await User.create(firebaseUser.uid, {
            email: firebaseUser.email,
            role: 'user',
            status: 'active'
          });
        } else {
          console.log("Found user by email, updating Firebase UID");
          // Update the user document to have the correct UID
          await adminFirestore.collection('users').doc(userData.id).delete();
          userData = await User.create(firebaseUser.uid, {
            ...userData,
            email: firebaseUser.email
          });
        }
      }
      
      console.log("Setting session with user data:", userData.id, userData.email, userData.role);
      
      // Normal login flow for active users
      req.session.user = userData;
      
      // Redirect based on role
      if (userData.role === 'admin') {
        req.flash('success_msg', 'Welcome to the admin dashboard');
        return res.redirect('/admin/dashboard');
      } else {
        req.flash('success_msg', 'Login successful');
        return res.redirect('/');
      }
    } catch (authError) {
      console.error('Firebase Auth error:', authError);
      
      // Handle specific Firebase auth errors
      if (authError.code === 'auth/wrong-password') {
        req.flash('error_msg', 'Invalid password');
      } else if (authError.code === 'auth/user-not-found') {
        req.flash('error_msg', 'User not found');
      } else if (authError.code === 'auth/invalid-credential') {
        req.flash('error_msg', 'Invalid credentials. Try again or reset your password.');
      } else if (authError.code === 'auth/user-disabled') {
        req.flash('error_msg', 'This account is disabled.');
      } else {
        req.flash('error_msg', 'Login failed: ' + (authError.message || 'Unknown error'));
      }
      
      // Save the email to repopulate the form
      req.flash('form_data', { email });
      return res.redirect('/auth/login');
    }
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error_msg', 'An error occurred during login. Please try again.');
    // Save the email to repopulate the form
    req.flash('form_data', { email });
    return res.redirect('/auth/login');
  }
};

/**
 * Render signup page
 */
exports.getSignup = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  
  // Get form data from flash if available
  const form_data = req.flash('form_data')[0] || {};
  
  res.render('auth/signup', {
    title: 'Sign Up',
    user: null,
    form_data
  });
};

/**
 * Process signup form
 */
exports.postSignup = async (req, res) => {
  const { name, email, password, confirmPassword, gender, province, country, phone } = req.body;
  
  try {
    // Store form data in case of validation error
    const formData = { name, email, gender, province, country, phone };
    
    // Validate form data
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
      req.flash('form_data', formData);
      return res.redirect('/auth/signup');
    }
    
    // Validate password length
    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters long');
      req.flash('form_data', formData);
      return res.redirect('/auth/signup');
    }
    
    console.log("Creating user with Firebase Authentication");
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    console.log("User created in Firebase Auth:", firebaseUser.uid);
    
    // Create user in Firestore
    const userData = {
      name,
      email,
      gender,
      province,
      country,
      phone,
      role: 'user',
      status: 'active'
    };
    
    console.log("Creating user in Firestore");
    const newUser = await User.create(firebaseUser.uid, userData);
    
    // Save user to session
    req.session.user = newUser;
    
    req.flash('success_msg', 'Account created successfully! You are now logged in.');
    return res.redirect('/');
  } catch (error) {
    console.error('Signup error:', error);
    
    // Store form data to repopulate the form
    const formData = { name, email, gender, province, country, phone };
    req.flash('form_data', formData);
    
    let errorMessage = error.message || 'Error creating account';
    
    // Handle Firebase specific errors
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email is already in use. Please use a different email or try logging in.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please choose a stronger password.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email format.';
    }
    
    req.flash('error_msg', errorMessage);
    return res.redirect('/auth/signup');
  }
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
  // Clear session completely
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    
    // Redirect to login page
    res.redirect('/auth/login');
  });
};

/**
 * Render forgot password page
 */
exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    user: null
  });
};

/**
 * Process forgot password form
 */
exports.postForgotPassword = async (req, res) => {
  const { email } = req.body;
  
  try {
    // Send password reset email
    await sendPasswordResetEmail(auth, email);
    
    req.flash('success_msg', 'Password reset email sent. Please check your inbox.');
    return res.redirect('/auth/login');
  } catch (error) {
    console.error('Forgot password error:', error);
    req.flash('error_msg', 'Error sending password reset email');
    return res.redirect('/auth/forgot-password');
  }
};

/**
 * Render reset password page
 */
exports.getResetPassword = (req, res) => {
  const { oobCode } = req.query; // Reset code from the reset password email
  
  if (!oobCode) {
    req.flash('error_msg', 'Invalid password reset link');
    return res.redirect('/auth/login');
  }
  
  res.render('auth/reset-password', {
    title: 'Reset Password',
    oobCode,
    user: null
  });
};

/**
 * Process reset password form
 */
exports.postResetPassword = async (req, res) => {
  const { oobCode, password } = req.body;
  
  try {
    await confirmPasswordReset(auth, oobCode, password);
    
    req.flash('success_msg', 'Password reset successful. Please log in with your new password.');
    return res.redirect('/auth/login');
  } catch (error) {
    console.error('Reset password error:', error);
    req.flash('error_msg', 'Error resetting password. Please try again.');
    return res.redirect(`/auth/reset-password?oobCode=${oobCode}`);
  }
};