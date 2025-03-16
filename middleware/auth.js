/**
 * Authentication middleware to ensure users are logged in
 */
module.exports = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  
  req.flash('error_msg', 'Please log in to access this resource');
  return res.redirect('/auth/login');
};
