/**
 * Authentication middleware with special handling for restricted users
 */
module.exports = (req, res, next) => {
  // Check if user is in session
  if (req.session.user) {
    // List of allowed paths for restricted users
    const allowedRestrictedPaths = [
      '/account-restricted',
      '/submit-appeal'  // Allow restricted users to submit appeals
    ];
    
    // Special handling for allowed paths
    if (allowedRestrictedPaths.includes(req.path)) {
      // Always allow access to these paths if the user has any session
      return next();
    }
    
    // Check if this is a restricted user
    if (req.session.user.restricted === true) {
      // Restricted users can only access the specifically allowed pages
      return res.redirect('/users/account-restricted');
    }
    
    // Normal authenticated user - allow access
    return next();
  }
  
  // No user in session
  req.flash('error_msg', 'Please login to access this feature');
  return res.redirect('/auth/login');
};