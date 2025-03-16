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
  
  res.render('auth/login', {
    title: 'Login',
    user: null
  });
};

/**
 * Process login form
 */
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    console.log("User authenticated with Firebase:", firebaseUser.uid);
    
    // Get user data from Firestore
    const userData = await User.getByUid(firebaseUser.uid);
    
    if (!userData) {
      console.log("User not found in Firestore, creating basic user");
      // Create basic user if not in Firestore yet
      const newUser = await User.create(firebaseUser.uid, {
        email: firebaseUser.email,
        role: 'user'
      });
      
      req.session.user = newUser;
    } else {
      console.log("User found in Firestore:", userData.id);
      req.session.user = userData;
    }
    
    // Redirect based on role
    if (req.session.user.role === 'admin') {
      req.flash('success_msg', 'Welcome to the admin dashboard');
      return res.redirect('/admin/dashboard');
    } else {
      req.flash('success_msg', 'Login successful');
      return res.redirect('/');
    }
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error_msg', 'Invalid email or password');
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
  
  res.render('auth/signup', {
    title: 'Sign Up',
    user: null
  });
};

/**
 * Process signup form
 */
exports.postSignup = async (req, res) => {
  const { name, email, password, confirmPassword, gender, province, country, phone } = req.body;
  
  try {
    // Validate form data
    if (password !== confirmPassword) {
      req.flash('error_msg', 'Passwords do not match');
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
      role: 'user'
    };
    
    console.log("Creating user in Firestore");
    const newUser = await User.create(firebaseUser.uid, userData);
    
    // Save user to session
    req.session.user = newUser;
    
    req.flash('success_msg', 'Account created successfully! You are now logged in.');
    return res.redirect('/');
  } catch (error) {
    console.error('Signup error:', error);
    let errorMessage = error.message || 'Error creating account';
    
    // Handle Firebase specific errors
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'Email is already in use. Please use a different email or try logging in.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please choose a stronger password.';
    }
    
    req.flash('error_msg', errorMessage);
    return res.redirect('/auth/signup');
  }
};

/**
 * Logout user
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
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