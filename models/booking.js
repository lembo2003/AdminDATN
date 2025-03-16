const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const Room = require('./room');
const User = require('./user');
const QRCode = require('qrcode');

const bookingsCollection = adminFirestore.collection('bookings');

class Booking {
  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} - Created booking with QR code
   */
  static async create(bookingData) {
    const bookingId = `booking_${uuidv4()}`;
    
    // Verify room exists and is available
    const room = await Room.getById(bookingData.roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (room.isBooked) {
      throw new Error('Room is already booked');
    }
    
    // Verify user exists
    const user = await User.getByUid(bookingData.userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Calculate total price
    const checkInDate = new Date(bookingData.checkInDate);
    const checkOutDate = new Date(bookingData.checkOutDate);
    const daysBooked = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalPrice = room.price * daysBooked;
    
    // Generate QR code data
    const qrData = JSON.stringify({
      bookingId,
      roomId: room.roomId,
      roomName: room.roomName,
      userId: user.id,
      userName: user.name,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate
    });
    
    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(qrData);
    
    const newBooking = {
      bookingId,
      roomId: room.roomId,
      userId: user.id,
      checkInDate: new Date(bookingData.checkInDate),
      checkOutDate: new Date(bookingData.checkOutDate),
      numberOfGuests: bookingData.numberOfGuests || 1,
      totalPrice,
      status: bookingData.status || 'booked', // booked, checked-in, checked-out, cancelled
      paymentStatus: bookingData.paymentStatus || 'pending', // pending, paid, refunded
      qrCodeUrl,
      specialRequests: bookingData.specialRequests || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create the booking
    await bookingsCollection.doc(bookingId).set(newBooking);
    
    // Update room booking state
    await Room.updateBookingState(room.roomId, 'booked');
    
    return { id: bookingId, ...newBooking };
  }

  /**
   * Get a booking by ID
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object|null>} - Booking data with room and user info
   */
  static async getById(bookingId) {
    const bookingDoc = await bookingsCollection.doc(bookingId).get();
    
    if (!bookingDoc.exists) {
      return null;
    }
    
    const bookingData = bookingDoc.data();
    
    // Get room info
    const room = await Room.getById(bookingData.roomId);
    
    // Get user info
    const user = await User.getByUid(bookingData.userId);
    
    return { 
      id: bookingDoc.id, 
      ...bookingData,
      room,
      user
    };
  }

  /**
   * Get all bookings with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of bookings with room and user info
   */
  static async getAll(filters = {}) {
    let query = bookingsCollection;
    
    // Apply filters
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }
    
    if (filters.roomId) {
      query = query.where('roomId', '==', filters.roomId);
    }
    
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters.paymentStatus) {
      query = query.where('paymentStatus', '==', filters.paymentStatus);
    }
    
    // Date range filters
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate);
      query = query.where('checkInDate', '>=', fromDate);
    }
    
    if (filters.toDate) {
      const toDate = new Date(filters.toDate);
      query = query.where('checkOutDate', '<=', toDate);
    }
    
    // Order by check-in date by default
    query = query.orderBy('checkInDate', filters.order === 'asc' ? 'asc' : 'desc');
    
    const snapshot = await query.get();
    
    const bookings = [];
    for (const doc of snapshot.docs) {
      const bookingData = doc.data();
      
      // Get room info for each booking
      const room = await Room.getById(bookingData.roomId);
      
      // Get user info for each booking
      const user = await User.getByUid(bookingData.userId);
      
      bookings.push({
        id: doc.id,
        ...bookingData,
        room,
        user
      });
    }
    
    return bookings;
  }

  /**
   * Update a booking
   * @param {string} bookingId - Booking ID
   * @param {Object} bookingData - Booking data to update
   * @returns {Promise<Object>} - Updated booking
   */
  static async update(bookingId, bookingData) {
    const updateData = {
      ...bookingData,
      updatedAt: new Date()
    };
    
    await bookingsCollection.doc(bookingId).update(updateData);
    return this.getById(bookingId);
  }

  /**
   * Update booking status
   * @param {string} bookingId - Booking ID
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated booking
   */
  static async updateStatus(bookingId, status) {
    const booking = await this.getById(bookingId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    // Update room status based on booking status
    if (status === 'checked-out') {
      await Room.updateBookingState(booking.roomId, 'available');
    } else if (status === 'cancelled') {
      await Room.updateBookingState(booking.roomId, 'available');
    } else if (status === 'checked-in') {
      await Room.updateBookingState(booking.roomId, 'occupied');
    }
    
    await bookingsCollection.doc(bookingId).update({
      status,
      updatedAt: new Date()
    });
    
    return this.getById(bookingId);
  }

  /**
   * Delete a booking
   * @param {string} bookingId - Booking ID to delete
   * @returns {Promise<void>}
   */
  static async delete(bookingId) {
    // Get the booking to check room status
    const booking = await this.getById(bookingId);
    
    if (booking) {
      // Update the room status to available
      await Room.updateBookingState(booking.roomId, 'available');
    }
    
    // Delete the booking
    await bookingsCollection.doc(bookingId).delete();
  }

  /**
   * Verify booking QR code
   * @param {string} qrData - QR code data
   * @returns {Promise<Object>} - Booking data if valid
   */
  static async verifyQrCode(qrData) {
    try {
      const data = JSON.parse(qrData);
      
      if (!data.bookingId) {
        throw new Error('Invalid QR code');
      }
      
      return this.getById(data.bookingId);
    } catch (error) {
      throw new Error('Invalid QR code');
    }
  }
}

module.exports = Booking;
