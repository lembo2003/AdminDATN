const Booking = require('../models/booking');
const Room = require('../models/room');
const RoomType = require('../models/roomType');
const auth = require('../middleware/auth');

/**
 * Render main booking form (new implementation)
 */
exports.getBookingForm = async (req, res) => {
  try {
    // Get all room types for the selection
    const roomTypes = await RoomType.getAll();
    
    // Process and transform room types with availability counts
    const roomTypesWithAvailability = await Promise.all(
      roomTypes.map(async (roomType) => {
        const availableCount = await Room.countAvailableByType(roomType.id);
        return {
          ...roomType,
          availableCount
        };
      })
    );
    
    // Filter out room types with no availability
    const availableRoomTypes = roomTypesWithAvailability.filter(rt => rt.availableCount > 0);
    
    // Get default dates - today for display and tomorrow for min value
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    
    // Format dates as YYYY-MM-DD for the date inputs
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };
    
    // Get query parameters or set defaults
    const checkIn = req.query.checkIn || formatDate(tomorrow);
    const checkOut = req.query.checkOut || formatDate(dayAfterTomorrow);
    const guests = req.query.guests || 1;
    const bookingType = req.query.bookingType || 'daily';
    
    // Get time presets based on booking type
    let timePresets = {};
    
    switch(bookingType) {
      case 'hourly':
        timePresets = {
          checkInTime: '10:00',
          checkOutTime: '14:00'
        };
        break;
      case 'overnight':
        timePresets = {
          checkInTime: '18:00',
          checkOutTime: '10:00'
        };
        break;
      case 'dayUse':
        timePresets = {
          checkInTime: '09:00',
          checkOutTime: '18:00'
        };
        break;
      case 'daily':
      default:
        timePresets = {
          checkInTime: '14:00',
          checkOutTime: '11:00'
        };
    }
    
    res.render('booking/new-create', {
      title: 'Book Your Stay',
      user: req.session.user,
      roomTypes: availableRoomTypes,
      checkIn,
      checkOut,
      guests,
      bookingType,
      timePresets,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error('Get booking form error:', error);
    req.flash('error_msg', 'Error loading booking form');
    res.redirect('/rooms');
  }
};

/**
 * Process booking form submission with multiple rooms
 */
exports.createBooking = async (req, res) => {
  try {
    const { 
      bookingType, 
      checkInDate, 
      checkInTime, 
      checkOutDate, 
      checkOutTime,
      numberOfGuests, 
      specialRequests 
    } = req.body;
    
    const userId = req.session.user.id;
    
    // Create full date-time objects by combining date and time
    const checkIn = new Date(`${checkInDate}T${checkInTime}`);
    const checkOut = new Date(`${checkOutDate}T${checkOutTime}`);
    
    // Validate dates
    const now = new Date();
    
    if (checkIn < now) {
      req.flash('error_msg', 'Check-in date/time cannot be in the past');
      return res.redirect('/bookings/create');
    }
    
    if (checkOut <= checkIn) {
      req.flash('error_msg', 'Check-out date/time must be after check-in date/time');
      return res.redirect('/bookings/create');
    }
    
    // Extract room selections
    const roomSelections = [];
    
    // Room selection inputs will be named like "roomQuantity_ROOM_TYPE_ID"
    for (const key in req.body) {
      if (key.startsWith('roomQuantity_')) {
        const roomTypeId = key.replace('roomQuantity_', '');
        const quantity = parseInt(req.body[key], 10) || 0;
        
        if (quantity > 0) {
          roomSelections.push({
            roomTypeId,
            quantity
          });
        }
      }
    }
    
    if (roomSelections.length === 0) {
      req.flash('error_msg', 'Please select at least one room');
      return res.redirect('/bookings/create');
    }
    
    // Create the booking
    const booking = await Booking.create({
      userId,
      roomSelections,
      bookingType,
      checkInDate: checkIn,
      checkOutDate: checkOut,
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
    res.redirect(`/bookings/create`);
  }
};

/**
 * Calculate price for room selection preview (AJAX endpoint)
 */
exports.calculatePrice = async (req, res) => {
  try {
    const { 
      roomTypeId, 
      quantity, 
      bookingType, 
      checkInDate, 
      checkInTime, 
      checkOutDate, 
      checkOutTime 
    } = req.body;
    
    // Create full date-time objects
    const checkIn = new Date(`${checkInDate}T${checkInTime}`);
    const checkOut = new Date(`${checkOutDate}T${checkOutTime}`);
    
    // Validate input
    if (!roomTypeId || quantity <= 0 || !bookingType || checkOut <= checkIn) {
      return res.status(400).json({ 
        error: 'Invalid input parameters' 
      });
    }
    
    // Calculate price for the room type
    const roomTypePrice = await RoomType.calculatePrice(
      roomTypeId,
      bookingType,
      checkIn,
      checkOut
    );
    
    // Get room type details for the response
    const roomType = await RoomType.getById(roomTypeId);
    
    // Calculate total price
    const totalPrice = roomTypePrice * quantity;
    
    res.json({
      success: true,
      roomTypeName: roomType.roomTypeName,
      quantity,
      pricePerRoom: roomTypePrice,
      totalPrice
    });
  } catch (error) {
    console.error('Calculate price error:', error);
    res.status(500).json({ 
      error: error.message || 'Error calculating price' 
    });
  }
};

/**
 * Get availability for a room type (AJAX endpoint)
 */
exports.getRoomTypeAvailability = async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    
    // Count available rooms
    const availableCount = await Room.countAvailableByType(roomTypeId);
    
    // Get room type details
    const roomType = await RoomType.getById(roomTypeId);
    
    if (!roomType) {
      return res.status(404).json({
        error: 'Room type not found'
      });
    }
    
    res.json({
      success: true,
      roomTypeId,
      roomTypeName: roomType.roomTypeName,
      availableCount
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ 
      error: error.message || 'Error getting availability' 
    });
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
      booking,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
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
      bookings,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
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

/**
 * Handle late checkout
 */
exports.handleLateCheckout = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { extraHours } = req.body;
    
    if (!bookingId || !extraHours || extraHours <= 0) {
      req.flash('error_msg', 'Invalid late checkout request');
      return res.redirect(`/admin/bookings/details/${bookingId}`);
    }
    
    // Process late checkout
    const updatedBooking = await Booking.handleLateCheckout(bookingId, extraHours);
    
    req.flash('success_msg', `Late checkout fee applied: $${updatedBooking.lateCheckoutFee}`);
    res.redirect(`/admin/bookings/details/${bookingId}`);
  } catch (error) {
    console.error('Late checkout error:', error);
    req.flash('error_msg', error.message || 'Error processing late checkout');
    res.redirect(`/admin/bookings/details/${req.params.bookingId}`);
  }
};

// Export routes with auth middleware
exports.routes = (router) => {
  // Public routes
  router.get('/confirmation/:bookingId', auth, exports.getBookingConfirmation);
  
  // Protected routes
  router.get('/create', auth, exports.getBookingForm); // New multi-room booking form
  router.get('/create/:roomId', auth, exports.getBookingForm); // Keep for backwards compatibility
  router.post('/create', auth, exports.createBooking);
  router.post('/calculate-price', auth, exports.calculatePrice);
  router.get('/room-type-availability/:roomTypeId', auth, exports.getRoomTypeAvailability);
  router.get('/my-bookings', auth, exports.getMyBookings);
  router.post('/cancel/:bookingId', auth, exports.cancelBooking);
  router.post('/verify-qr', auth, exports.verifyQrCode);
  router.post('/late-checkout/:bookingId', auth, exports.handleLateCheckout);
  
  return router;
};