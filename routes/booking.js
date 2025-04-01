const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');

// Main booking form - Multiple rooms selection
router.get('/create', auth, bookingController.getBookingForm);

// Legacy single room booking route (for backward compatibility)
router.get('/create/:roomId', auth, bookingController.getBookingForm);

// Create booking
router.post('/create', auth, bookingController.createBooking);

// Price calculation endpoint (AJAX)
router.post('/calculate-price', auth, bookingController.calculatePrice);

// Room type availability check (AJAX)
router.get('/room-type-availability/:roomTypeId', auth, bookingController.getRoomTypeAvailability);

// View booking confirmation
router.get('/confirmation/:bookingId', auth, bookingController.getBookingConfirmation);

// List user's bookings 
router.get('/my-bookings', auth, bookingController.getMyBookings);

// Cancel booking
router.post('/cancel/:bookingId', auth, bookingController.cancelBooking);

// Verify QR code (for check-in)
router.post('/verify-qr', auth, bookingController.verifyQrCode);

// Handle late checkout (for admin/staff)
router.post('/late-checkout/:bookingId', auth, bookingController.handleLateCheckout);

module.exports = router;