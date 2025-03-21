require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(methodOverride('_method'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'hotel-management-secret',
  resave: false,
  saveUninitialized: true
}));

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// Create upload directories if they don't exist
const fs = require('fs');
const uploadDirs = [
  path.join(__dirname, 'public/uploads'),
  path.join(__dirname, 'public/uploads/rooms'),
  path.join(__dirname, 'public/uploads/menu'),
  path.join(__dirname, 'public/uploads/staff'),
  path.join(__dirname, 'public/uploads/users')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Routes
const authRoutes = require('./routes/auth');

// Import routes that are implemented
try {
  // Enable routes as they become available

  // User routes
  if (fs.existsSync(path.join(__dirname, 'routes/user.js'))) {
    const userRoutes = require('./routes/user');
    app.use('/users', userRoutes);
    console.log('User routes enabled');
  }

  // Room routes
  if (fs.existsSync(path.join(__dirname, 'routes/room.js'))) {
    const roomRoutes = require('./routes/room');
    app.use('/rooms', roomRoutes);
    console.log('Room routes enabled');
  }

  // Booking routes
  if (fs.existsSync(path.join(__dirname, 'routes/booking.js'))) {
    const bookingRoutes = require('./routes/booking');
    app.use('/bookings', bookingRoutes);
    console.log('Booking routes enabled');
  }

  // Order routes
  if (fs.existsSync(path.join(__dirname, 'routes/order.js'))) {
    const orderRoutes = require('./routes/order');
    app.use('/orders', orderRoutes);
    console.log('Order routes enabled');
  }

  // Admin routes
  if (fs.existsSync(path.join(__dirname, 'routes/admin.js'))) {
    const adminRoutes = require('./routes/admin');
    app.use('/admin', adminRoutes);
    console.log('Admin routes enabled');
  }
} catch (error) {
  console.error('Error loading routes:', error);
}

// Auth routes (always available)
app.use('/auth', authRoutes);

// Home route
app.get('/', (req, res) => {
  // For development, check if views/index.ejs exists
  const indexPath = path.join(__dirname, 'views', 'index.ejs');
  if (fs.existsSync(indexPath)) {
    res.render('index', {
      title: 'Hotel Management System',
      user: req.session.user
    });
  } else {
    // Fallback if index view doesn't exist yet
    res.send(`
      <h1>Hotel Management System</h1>
      <p>Welcome! The system is under development.</p>
      <p><a href="/auth/login">Login</a> | <a href="/auth/signup">Sign Up</a></p>
      ${req.session.user ? `<p>Logged in as: ${req.session.user.email} (${req.session.user.role})</p>
        <p><a href="/auth/logout">Logout</a></p>
        ${req.session.user.role === 'admin' ? `<p><a href="/admin/dashboard">Admin Dashboard</a></p>` : ''}
        <p><a href="/users/profile">My Profile</a></p>
        <p><a href="/rooms">Browse Rooms</a></p>
      ` : ''}
    `);
  }
});

// 404 handler
app.use((req, res, next) => {
  // For development, check if views/error.ejs exists
  const errorPath = path.join(__dirname, 'views', 'error.ejs');
  if (fs.existsSync(errorPath)) {
    res.status(404).render('error', {
      title: '404 Not Found',
      message: 'The page you requested does not exist.',
      user: req.session.user
    });
  } else {
    // Fallback if error view doesn't exist yet
    res.status(404).send(`
      <h1>404 - Page Not Found</h1>
      <p>The page you requested does not exist.</p>
      <p><a href="/">Return to Home</a></p>
    `);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('App Error:', err);

  // For development, check if views/error.ejs exists
  const errorPath = path.join(__dirname, 'views', 'error.ejs');
  if (fs.existsSync(errorPath)) {
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Something went wrong on the server.',
      user: req.session.user
    });
  } else {
    // Fallback if error view doesn't exist yet
    res.status(500).send(`
      <h1>500 - Server Error</h1>
      <p>Something went wrong on the server.</p>
      <p>Error: ${err.message}</p>
      <p><a href="/">Return to Home</a></p>
    `);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access application at http://localhost:${PORT}`);
});