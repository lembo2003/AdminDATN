const Booking = require('../models/booking');
const Room = require('../models/room');
const auth = require('../middleware/auth');

/**
 * Render booking form for a room
 */
exports.getBookingForm = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Get room details
    const room = await Room.getById(roomId);
    
    if (!room) {
      req.flash('error_msg', 'Room not found');
      return res.redirect('/rooms');
    }
    
    if (room.isBooked) {
      req.flash('error_msg', 'This room is currently not available for booking');
      return res.redirect('/rooms');
    }
    
    // Get check-in and check-out dates from query or set defaults
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    // Format dates as YYYY-MM-DD for the date inputs
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };
    
    const checkIn = req.query.checkIn || formatDate(tomorrow);
    const checkOut = req.query.checkOut || formatDate(dayAfterTomorrow);
    const guests = req.query.guests || 1;
    
    res.render('booking/create', {
      title: `Book ${room.roomName}`,
      user: req.session.user,
      room,
      checkIn,
      checkOut,
      guests
    });
  } catch (error) {
    console.error('Get booking form error:', error);
    req.flash('error_msg', 'Error loading booking form');
    res.redirect('/rooms');
  }
};

/**
 * Process booking form submission
 */
exports.createBooking = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { checkInDate, checkOutDate, numberOfGuests, specialRequests } = req.body;
    const userId = req.session.user.id;
    
    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    
    if (checkIn < today) {
      req.flash('error_msg', 'Check-in date cannot be in the past');
      return res.redirect(`/bookings/create/${roomId}`);
    }
    
    if (checkOut <= checkIn) {
      req.flash('error_msg', 'Check-out date must be after check-in date');
      return res.redirect(`/bookings/create/${roomId}`);
    }
    
    // Create the booking
    const booking = await Booking.create({
      roomId,
      userId,
      checkInDate,
      checkOutDate,
      numberOfGuests: parseInt(numberOfGuests, 10),
      specialRequests,
      status: 'booked',
      paymentStatus: 'pending'
    });
    
    req.flash('success_msg', 'Your booking has been confirmed!');
    res.redirect(`/bookings/confirmation/${booking.id}`);
  } catch (error) {
    console.error('Create booking error:', error);
    req.flash('error_msg', error.message || 'Error creating booking');
    res.redirect(`/bookings/create/${req.params.roomId}`);
  }
};

/**
 * Render booking confirmation page
 */
exports.getBookingConfirmation = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.getById(bookingId);
    
    if (!booking) {
      req.flash('error_msg', 'Booking not found');
      return res.redirect('/bookings/my-bookings');
    }
    
    // Only allow the booking owner or admin to view confirmation
    if (booking.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      req.flash('error_msg', 'You are not authorized to view this booking');
      return res.redirect('/');
    }
    
    res.render('booking/confirmation', {
      title: 'Booking Confirmation',
      user: req.session.user,
      booking
    });
  } catch (error) {
    console.error('Get booking confirmation error:', error);
    req.flash('error_msg', 'Error loading booking confirmation');
    res.redirect('/bookings/my-bookings');
  }
};

/**
 * Render user's bookings list
 */
exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get user's bookings
    const bookings = await Booking.getAll({ userId });
    
    res.render('booking/my-bookings', {
      title: 'My Bookings',
      user: req.session.user,
      bookings
    });
  } catch (error) {
    console.error('Get my bookings error:', error);
    req.flash('error_msg', 'Error loading your bookings');
    res.redirect('/');
  }
};

/**
 * Cancel a booking
 */
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.getById(bookingId);
    
    if (!booking) {
      req.flash('error_msg', 'Booking not found');
      return res.redirect('/bookings/my-bookings');
    }
    
    // Only allow the booking owner or admin to cancel
    if (booking.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      req.flash('error_msg', 'You are not authorized to cancel this booking');
      return res.redirect('/bookings/my-bookings');
    }
    
    // Update booking status to cancelled
    await Booking.updateStatus(bookingId, 'cancelled');
    
    req.flash('success_msg', 'Your booking has been cancelled');
    res.redirect('/bookings/my-bookings');
  } catch (error) {
    console.error('Cancel booking error:', error);
    req.flash('error_msg', 'Error cancelling your booking');
    res.redirect('/bookings/my-bookings');
  }
};

/**
 * Verify booking with QR code
 */
exports.verifyQrCode = async (req, res) => {
  try {
    const { qrData } = req.body;
    
    // Verify the QR code data
    const booking = await Booking.verifyQrCode(qrData);
    
    if (!booking) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }
    
    // Return booking details
    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Verify QR code error:', error);
    res.status(400).json({ error: error.message || 'Error verifying QR code' });
  }
};

// Export routes with auth middleware
exports.routes = (router) => {
  // Public routes
  router.get('/confirmation/:bookingId', auth, exports.getBookingConfirmation);
  
  // Protected routes
  router.get('/create/:roomId', auth, exports.getBookingForm);
  router.post('/create/:roomId', auth, exports.createBooking);
  router.get('/my-bookings', auth, exports.getMyBookings);
  router.post('/cancel/:bookingId', auth, exports.cancelBooking);
  router.post('/verify-qr', auth, exports.verifyQrCode);
  
  return router;
};
