const Room = require('../models/room');
const RoomType = require('../models/roomType');
const Comment = require('../models/comment');

/**
 * Render rooms listing page
 */
exports.getRooms = async (req, res) => {
  try {
    // Get filter parameters
    const { roomType, minPrice, maxPrice } = req.query;

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

    res.render('room/details', {
      title: room.roomName,
      user: req.session.user,
      room,
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
    const { query, checkIn, checkOut, guests } = req.query;

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

    res.render('room/search-results', {
      title: 'Search Results',
      user: req.session.user,
      rooms: filteredRooms,
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