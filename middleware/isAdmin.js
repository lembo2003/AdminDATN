/**
 * Admin role verification middleware
 * Verifies that the logged-in user has admin role
 */
module.exports = (req, res, next) => {
  const user = req.session.user;
  
  if (!user) {
    req.flash('error_msg', 'Please log in to access this resource');
    return res.redirect('/auth/login');
  }
  
  if (user.role !== 'admin') {
    req.flash('error_msg', 'Access denied. Admin privileges required.');
    return res.redirect('/');
  }
  
  next();
};
