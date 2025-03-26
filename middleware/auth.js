/**
 * Authentication middleware with special handling for restricted users
 */
module.exports = (req, res, next) => {
  // Check if user is in session
  if (req.session.user) {
    // Special handling for account-restricted page
    if (req.path === '/account-restricted') {
      // Always allow access to account-restricted page if the user has any session
      return next();
    }
    
    // Check if this is a restricted user
    if (req.session.user.restricted === true) {
      // Restricted users can only access the account-restricted page
      return res.redirect('/users/account-restricted');
    }
    
    // Normal authenticated user - allow access
    return next();
  }
  
  // No user in session
  req.flash('error_msg', 'Please login to access this feature');
  return res.redirect('/auth/login');
};