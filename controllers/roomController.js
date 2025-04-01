const Room = require('../models/room');
const RoomType = require('../models/roomType');
const Comment = require('../models/comment');

/**
 * Render rooms listing page
 */
exports.getRooms = async (req, res) => {
  try {
    // Get filter parameters
    const { roomType, maxPrice } = req.query;

    // Prepare filters
    const filters = {};

    if (roomType) {
      filters.roomTypeId = roomType;
    }

    if (maxPrice) {
      filters.maxPrice = parseFloat(maxPrice);
    }

    // Only show available rooms
    filters.isBooked = false;

    // Get rooms based on filters - Include amenities
    const rooms = await Room.getAll(filters, true); // true = includeAmenities

    // Get all room types for the filter dropdown
    const roomTypes = await RoomType.getAll();

    res.render('room/index', {
      title: 'Our Rooms',
      user: req.session.user,
      rooms,
      roomTypes,
      filters: req.query,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    req.flash('error_msg', 'Error loading rooms');
    res.redirect('/');
  }
};

/**
 * Render room details page
 */
exports.getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Get room with comments AND amenities included
    const room = await Room.getById(roomId, true, true); // true for includeComments, true for includeAmenities

    if (!room) {
      req.flash('error_msg', 'Room not found');
      return res.redirect('/rooms');
    }

    // Get similar rooms (same room type)
    const similarRooms = await Room.getAll({
      roomTypeId: room.roomTypeId,
      isBooked: false
    });

    // Filter out the current room from similar rooms
    const filteredSimilarRooms = similarRooms.filter(similar => similar.id !== room.id);

    // Get room type pricing information
    const roomType = room.roomType || {};
    
    // Format pricing for display
    const pricing = {
      daily: roomType.pricing?.daily || 0,
      hourly: {
        base: roomType.pricing?.hourly?.basePrice || 0,
        additional: roomType.pricing?.hourly?.additionalHourPrice || 0
      },
      overnight: roomType.pricing?.overnight || 0,
      dayUse: roomType.pricing?.dayUse || 0,
      weekly: roomType.pricing?.weekly || 0,
      monthly: roomType.pricing?.monthly || 0
    };

    res.render('room/details', {
      title: room.roomName,
      user: req.session.user,
      room,
      pricing,
      similarRooms: filteredSimilarRooms.slice(0, 3), // Show up to 3 similar rooms
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error('Get room details error:', error);
    req.flash('error_msg', 'Error loading room details');
    res.redirect('/rooms');
  }
};

/**
 * Add a comment/review to a room
 */
exports.postComment = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { text, rating } = req.body;
    const userId = req.session.user.id;

    // Verify room exists
    const room = await Room.getById(roomId);

    if (!room) {
      req.flash('error_msg', 'Room not found');
      return res.redirect('/rooms');
    }

    // Create the comment
    await Comment.create({
      roomId,
      userId,
      text,
      rating: parseInt(rating, 10)
    });

    req.flash('success_msg', 'Your review has been added');
    res.redirect(`/rooms/${roomId}`);
  } catch (error) {
    console.error('Add comment error:', error);
    req.flash('error_msg', 'Error adding your review');
    res.redirect(`/rooms/${req.params.roomId}`);
  }
};

/**
 * Search rooms
 */
exports.searchRooms = async (req, res) => {
  try {
    const { query, checkIn, checkOut, guests, bookingType } = req.query;

    // Get all available rooms with amenities
    const rooms = await Room.getAll({ isBooked: false }, true); // true = includeAmenities

    // Filter rooms based on search query (room name or description)
    let filteredRooms = rooms;

    if (query) {
      const searchQuery = query.toLowerCase();
      filteredRooms = rooms.filter(room =>
        room.roomName.toLowerCase().includes(searchQuery) ||
        room.description.toLowerCase().includes(searchQuery) ||
        (room.roomType && room.roomType.roomTypeName.toLowerCase().includes(searchQuery))
      );
    }

    // If booking type and dates are provided, calculate prices
    if (bookingType && checkIn && checkOut) {
      // Add calculated prices based on booking type
      for (const room of filteredRooms) {
        if (room.roomType && room.roomType.id) {
          try {
            const calculatedPrice = await RoomType.calculatePrice(
              room.roomType.id,
              bookingType,
              new Date(checkIn),
              new Date(checkOut)
            );
            
            room.calculatedPrice = calculatedPrice;
          } catch (error) {
            console.error(`Error calculating price for room ${room.id}:`, error);
          }
        }
      }
    }

    // Get all room types for filtering
    const roomTypes = await RoomType.getAll();

    res.render('room/search-results', {
      title: 'Search Results',
      user: req.session.user,
      rooms: filteredRooms,
      roomTypes,
      searchParams: req.query,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error('Search rooms error:', error);
    req.flash('error_msg', 'Error searching for rooms');
    res.redirect('/rooms');
  }
};

/**
 * Get room availability by room type
 */
exports.getRoomAvailability = async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    
    // Get available rooms for this room type
    const availableCount = await Room.countAvailableByType(roomTypeId);
    
    // Get room type details
    const roomType = await RoomType.getById(roomTypeId);
    
    if (!roomType) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }
    
    res.json({
      success: true,
      roomTypeId,
      roomTypeName: roomType.roomTypeName,
      availableCount,
      capacity: roomType.capacity || 2
    });
  } catch (error) {
    console.error('Get room availability error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting room availability'
    });
  }
};