const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const Room = require('./room');
const RoomType = require('./roomType');
const User = require('./user');
const QRCode = require('qrcode');

const bookingsCollection = adminFirestore.collection('bookings');
const bookingRoomsCollection = adminFirestore.collection('bookingRooms');

class Booking {
  /**
   * Create a new booking with support for multiple rooms
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} - Created booking with QR code
   */
  static async create(bookingData) {
    const bookingId = `booking_${uuidv4()}`;
    
    // Verify user exists
    const user = await User.getByUid(bookingData.userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Process room selections - expect an array of {roomTypeId, quantity}
    const roomSelections = bookingData.roomSelections || [];
    if (roomSelections.length === 0) {
      throw new Error('No rooms selected for booking');
    }
    
    const bookingType = bookingData.bookingType || 'daily';
    const checkInDate = new Date(bookingData.checkInDate);
    const checkOutDate = new Date(bookingData.checkOutDate);
    
    // Validate dates
    if (checkOutDate <= checkInDate) {
      throw new Error('Check-out date must be after check-in date');
    }
    
    let totalPrice = 0;
    const bookedRooms = [];
    
    // Process each room selection
    for (const selection of roomSelections) {
      const { roomTypeId, quantity } = selection;
      
      if (!roomTypeId || quantity <= 0) {
        continue; // Skip invalid selections
      }
      
      // Verify room type exists
      const roomType = await RoomType.getById(roomTypeId);
      if (!roomType) {
        throw new Error(`Room type not found: ${roomTypeId}`);
      }
      
      // Calculate price for this room type
      const roomTypePrice = await RoomType.calculatePrice(
        roomTypeId, 
        bookingType, 
        checkInDate, 
        checkOutDate
      );
      
      // Find available rooms of this type
      const availableRooms = await Room.getAvailableByType(roomTypeId, quantity);
      
      if (availableRooms.length < quantity) {
        throw new Error(`Not enough available rooms of type ${roomType.roomTypeName}. Requested: ${quantity}, Available: ${availableRooms.length}`);
      }
      
      // Add selected rooms to bookedRooms array
      for (let i = 0; i < quantity; i++) {
        bookedRooms.push({
          roomId: availableRooms[i].id,
          roomName: availableRooms[i].roomName,
          roomTypeId: roomTypeId,
          roomTypeName: roomType.roomTypeName,
          price: roomTypePrice
        });
      }
      
      // Add to total price
      totalPrice += roomTypePrice * quantity;
    }
    
    // Generate QR code data
    const qrData = JSON.stringify({
      bookingId,
      userId: user.id,
      userName: user.name,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate,
      roomCount: bookedRooms.length
    });
    
    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(qrData);
    
    // Create the booking record
    const newBooking = {
      bookingId,
      userId: user.id,
      checkInDate,
      checkOutDate,
      bookingType,
      numberOfGuests: bookingData.numberOfGuests || 1,
      totalPrice,
      status: bookingData.status || 'booked', // booked, checked-in, checked-out, cancelled
      paymentStatus: bookingData.paymentStatus || 'pending', // pending, paid, refunded
      qrCodeUrl,
      specialRequests: bookingData.specialRequests || '',
      roomCount: bookedRooms.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Begin transaction to create booking and update room statuses
    const batch = adminFirestore.batch();
    
    // Add booking document
    const bookingRef = bookingsCollection.doc(bookingId);
    batch.set(bookingRef, newBooking);
    
    // Add booking room links and update room status
    for (const bookedRoom of bookedRooms) {
      // Create booking-room link
      const bookingRoomId = `${bookingId}_${bookedRoom.roomId}`;
      const bookingRoomRef = bookingRoomsCollection.doc(bookingRoomId);
      
      batch.set(bookingRoomRef, {
        bookingId,
        roomId: bookedRoom.roomId,
        roomName: bookedRoom.roomName,
        roomTypeId: bookedRoom.roomTypeId,
        roomTypeName: bookedRoom.roomTypeName,
        price: bookedRoom.price,
        createdAt: new Date()
      });
      
      // Update room status to booked
      const roomRef = adminFirestore.collection('rooms').doc(bookedRoom.roomId);
      batch.update(roomRef, {
        isBooked: true,
        bookingState: 'booked',
        updatedAt: new Date()
      });
    }
    
    // Commit transaction
    await batch.commit();
    
    // Return booking with rooms
    return { 
      id: bookingId,
      ...newBooking,
      rooms: bookedRooms 
    };
  }

  /**
   * Get a booking by ID with all booked rooms
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object|null>} - Booking data with rooms and user info
   */
  static async getById(bookingId) {
    const bookingDoc = await bookingsCollection.doc(bookingId).get();
    
    if (!bookingDoc.exists) {
      return null;
    }
    
    const bookingData = bookingDoc.data();
    
    // Get booking rooms
    const bookingRoomsSnapshot = await bookingRoomsCollection
      .where('bookingId', '==', bookingId)
      .get();
    
    const rooms = bookingRoomsSnapshot.docs.map(doc => doc.data());
    
    // Get user info
    const user = await User.getByUid(bookingData.userId);
    
    return { 
      id: bookingDoc.id, 
      ...bookingData,
      rooms,
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
      
      // Get rooms for this booking
      const bookingRoomsSnapshot = await bookingRoomsCollection
        .where('bookingId', '==', doc.id)
        .get();
      
      const rooms = bookingRoomsSnapshot.docs.map(roomDoc => roomDoc.data());
      
      // Get user info
      const user = await User.getByUid(bookingData.userId);
      
      bookings.push({
        id: doc.id,
        ...bookingData,
        rooms,
        user
      });
    }
    
    return bookings;
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
    
    // Begin transaction
    const batch = adminFirestore.batch();
    
    // Update booking status
    const bookingRef = bookingsCollection.doc(bookingId);
    batch.update(bookingRef, {
      status,
      updatedAt: new Date()
    });
    
    // Update room statuses based on booking status
    const bookingRoomsSnapshot = await bookingRoomsCollection
      .where('bookingId', '==', bookingId)
      .get();
    
    for (const doc of bookingRoomsSnapshot.docs) {
      const roomData = doc.data();
      const roomRef = adminFirestore.collection('rooms').doc(roomData.roomId);
      
      if (status === 'checked-out' || status === 'cancelled') {
        // Free up the room
        batch.update(roomRef, {
          isBooked: false,
          bookingState: 'available',
          updatedAt: new Date()
        });
      } else if (status === 'checked-in') {
        // Update to occupied
        batch.update(roomRef, {
          bookingState: 'occupied',
          updatedAt: new Date()
        });
      }
    }
    
    // Commit transaction
    await batch.commit();
    
    return this.getById(bookingId);
  }

  /**
   * Delete a booking
   * @param {string} bookingId - Booking ID to delete
   * @returns {Promise<void>}
   */
  static async delete(bookingId) {
    // Get booking rooms
    const bookingRoomsSnapshot = await bookingRoomsCollection
      .where('bookingId', '==', bookingId)
      .get();
    
    // Begin transaction
    const batch = adminFirestore.batch();
    
    // Update all rooms to available
    for (const doc of bookingRoomsSnapshot.docs) {
      const roomData = doc.data();
      
      // Update room status to available
      const roomRef = adminFirestore.collection('rooms').doc(roomData.roomId);
      batch.update(roomRef, {
        isBooked: false,
        bookingState: 'available',
        updatedAt: new Date()
      });
      
      // Delete booking room link
      batch.delete(doc.ref);
    }
    
    // Delete the booking
    batch.delete(bookingsCollection.doc(bookingId));
    
    // Commit transaction
    await batch.commit();
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
  
  /**
   * Handle late checkout
   * @param {string} bookingId - Booking ID
   * @param {number} extraHours - Number of extra hours
   * @returns {Promise<Object>} - Updated booking with late checkout fee
   */
  static async handleLateCheckout(bookingId, extraHours) {
    const booking = await this.getById(bookingId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    if (booking.rooms.length === 0) {
      throw new Error('No rooms found for this booking');
    }
    
    // Get the room type of the first room (assuming all rooms are same type)
    const roomTypeId = booking.rooms[0].roomTypeId;
    const roomType = await RoomType.getById(roomTypeId);
    
    if (!roomType) {
      throw new Error('Room type not found');
    }
    
    // Calculate late checkout fee
    const lateCheckoutFee = roomType.lateCheckoutFee * extraHours * booking.rooms.length;
    
    // Update booking
    await bookingsCollection.doc(bookingId).update({
      lateCheckoutFee: lateCheckoutFee,
      totalPrice: booking.totalPrice + lateCheckoutFee,
      updatedAt: new Date()
    });
    
    return this.getById(bookingId);
  }
}

module.exports = Booking;