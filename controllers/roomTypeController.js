const RoomType = require('../models/roomType');
const Room = require('../models/room');

/**
 * Render admin room types index page
 */
exports.getRoomTypes = async (req, res) => {
  try {
    // Get all room types
    const roomTypes = await RoomType.getAll();

    // For each room type, get the count of rooms using it
    for (const roomType of roomTypes) {
      const roomsUsingThisType = await Room.getAll({ roomTypeId: roomType.id });
      roomType.roomCount = roomsUsingThisType.length;
    }

    res.render('admin/roomTypes/index', {
      title: 'Room Type Management',
      roomTypes,
      user: req.session.user,
      path: '/admin/room-types',
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error('Get room types error:', error);
    req.flash('error_msg', 'Error loading room types');
    res.redirect('/admin/dashboard');
  }
};

/**
 * Render room type add form
 */
exports.getAddRoomType = (req, res) => {
  // Changed to render 'admin/roomTypes/add' instead of 'form'
  res.render('admin/roomTypes/add', {
    title: 'Add Room Type',
    user: req.session.user,
    path: '/admin/room-types',
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
};

/**
 * Handle room type creation
 */
exports.postAddRoomType = async (req, res) => {
  try {
    const {
      roomTypeName,
      description,
      capacity,
      // Pricing
      dailyPrice,
      hourlyBasePrice,
      hourlyAdditionalPrice,
      overnightPrice,
      dayUsePrice,
      weeklyPrice,
      monthlyPrice,
      // Minimum stays
      minimumStayDaily,
      minimumStayWeekly,
      minimumStayMonthly,
      // Other fees
      lateCheckoutFee,
      // Hourly settings
      minHourlyDuration,
      maxHourlyDuration
    } = req.body;

    // Validate input
    if (!roomTypeName) {
      req.flash('error_msg', 'Room type name is required');
      return res.redirect('/admin/room-types/add');
    }

    if (!dailyPrice) {
      req.flash('error_msg', 'Daily price is required');
      return res.redirect('/admin/room-types/add');
    }

    // Check if room type with same name already exists
    const roomTypes = await RoomType.getAll();
    const roomTypeExists = roomTypes.some(
      roomType => roomType.roomTypeName.toLowerCase() === roomTypeName.toLowerCase()
    );

    if (roomTypeExists) {
      req.flash('error_msg', 'A room type with this name already exists');
      return res.redirect('/admin/room-types/add');
    }

    // Create room type with structured pricing data
    await RoomType.create({
      roomTypeName,
      description,
      capacity: parseInt(capacity, 10) || 2,
      // Structured pricing object
      pricing: {
        daily: parseFloat(dailyPrice) || 0,
        hourly: {
          basePrice: parseFloat(hourlyBasePrice) || 0,
          additionalHourPrice: parseFloat(hourlyAdditionalPrice) || 0
        },
        overnight: parseFloat(overnightPrice) || 0,
        dayUse: parseFloat(dayUsePrice) || 0,
        weekly: parseFloat(weeklyPrice) || 0,
        monthly: parseFloat(monthlyPrice) || 0
      },
      // Minimum stay requirements
      minimumStay: {
        daily: parseInt(minimumStayDaily, 10) || 1,
        weekly: parseInt(minimumStayWeekly, 10) || 7,
        monthly: parseInt(minimumStayMonthly, 10) || 28
      },
      // Hourly settings
      hourlySettings: {
        minDuration: parseInt(minHourlyDuration, 10) || 1,
        maxDuration: parseInt(maxHourlyDuration, 10) || 6
      },
      // Fees
      lateCheckoutFee: parseFloat(lateCheckoutFee) || 0
    });

    req.flash('success_msg', 'Room type added successfully');
    res.redirect('/admin/room-types');
  } catch (error) {
    console.error('Add room type error:', error);
    req.flash('error_msg', 'Error adding room type: ' + error.message);
    res.redirect('/admin/room-types/add');
  }
};

/**
 * Render room type edit form
 */
exports.getEditRoomType = async (req, res) => {
  try {
    const { roomTypeId } = req.params;

    // Get room type
    const roomType = await RoomType.getById(roomTypeId);

    if (!roomType) {
      req.flash('error_msg', 'Room type not found');
      return res.redirect('/admin/room-types');
    }

    // Get rooms using this room type to display the count
    const roomsUsingThisType = await Room.getAll({ roomTypeId });

    // Add room count to the room type object
    roomType.roomCount = roomsUsingThisType.length;

    // Changed to render 'admin/roomTypes/edit' instead of 'form'
    res.render('admin/roomTypes/edit', {
      title: 'Edit Room Type',
      roomType,
      user: req.session.user,
      path: '/admin/room-types',
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (error) {
    console.error('Get edit room type error:', error);
    req.flash('error_msg', 'Error loading room type');
    res.redirect('/admin/room-types');
  }
};

/**
 * Handle room type update
 */
exports.postUpdateRoomType = async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const {
      roomTypeName,
      description,
      capacity,
      // Pricing
      dailyPrice,
      hourlyBasePrice,
      hourlyAdditionalPrice,
      overnightPrice,
      dayUsePrice,
      weeklyPrice,
      monthlyPrice,
      // Minimum stays
      minimumStayDaily,
      minimumStayWeekly,
      minimumStayMonthly,
      // Other fees
      lateCheckoutFee,
      // Hourly settings
      minHourlyDuration,
      maxHourlyDuration
    } = req.body;

    // Validate input
    if (!roomTypeName) {
      req.flash('error_msg', 'Room type name is required');
      return res.redirect(`/admin/room-types/edit/${roomTypeId}`);
    }

    if (!dailyPrice) {
      req.flash('error_msg', 'Daily price is required');
      return res.redirect(`/admin/room-types/edit/${roomTypeId}`);
    }

    // Check if room type exists
    const roomType = await RoomType.getById(roomTypeId);

    if (!roomType) {
      req.flash('error_msg', 'Room type not found');
      return res.redirect('/admin/room-types');
    }

    // Check if another room type has the same name
    const roomTypes = await RoomType.getAll();
    const nameConflict = roomTypes.some(
      type => type.roomTypeName.toLowerCase() === roomTypeName.toLowerCase() && type.id !== roomTypeId
    );

    if (nameConflict) {
      req.flash('error_msg', 'Another room type with this name already exists');
      return res.redirect(`/admin/room-types/edit/${roomTypeId}`);
    }

    // Update room type with structured pricing data
    await RoomType.update(roomTypeId, {
      roomTypeName,
      description,
      capacity: parseInt(capacity, 10) || 2,
      // Structured pricing object
      pricing: {
        daily: parseFloat(dailyPrice) || 0,
        hourly: {
          basePrice: parseFloat(hourlyBasePrice) || 0,
          additionalHourPrice: parseFloat(hourlyAdditionalPrice) || 0
        },
        overnight: parseFloat(overnightPrice) || 0,
        dayUse: parseFloat(dayUsePrice) || 0,
        weekly: parseFloat(weeklyPrice) || 0,
        monthly: parseFloat(monthlyPrice) || 0
      },
      // Minimum stay requirements
      minimumStay: {
        daily: parseInt(minimumStayDaily, 10) || 1,
        weekly: parseInt(minimumStayWeekly, 10) || 7,
        monthly: parseInt(minimumStayMonthly, 10) || 28
      },
      // Hourly settings
      hourlySettings: {
        minDuration: parseInt(minHourlyDuration, 10) || 1,
        maxDuration: parseInt(maxHourlyDuration, 10) || 6
      },
      // Fees
      lateCheckoutFee: parseFloat(lateCheckoutFee) || 0
    });

    req.flash('success_msg', 'Room type updated successfully');
    res.redirect('/admin/room-types');
  } catch (error) {
    console.error('Update room type error:', error);
    req.flash('error_msg', 'Error updating room type: ' + error.message);
    res.redirect(`/admin/room-types/edit/${req.params.roomTypeId}`);
  }
};

/**
 * Handle room type deletion
 */
exports.deleteRoomType = async (req, res) => {
  try {
    const { roomTypeId } = req.params;

    // Check if room type exists
    const roomType = await RoomType.getById(roomTypeId);

    if (!roomType) {
      req.flash('error_msg', 'Room type not found');
      return res.redirect('/admin/room-types');
    }

    // Check if any rooms are using this room type
    const rooms = await Room.getAll({ roomTypeId });

    if (rooms.length > 0) {
      req.flash('error_msg', `Cannot delete room type. It is used by ${rooms.length} room(s)`);
      return res.redirect('/admin/room-types');
    }

    // Delete room type
    await RoomType.delete(roomTypeId);

    req.flash('success_msg', 'Room type deleted successfully');
    res.redirect('/admin/room-types');
  } catch (error) {
    console.error('Delete room type error:', error);
    req.flash('error_msg', 'Error deleting room type: ' + error.message);
    res.redirect('/admin/room-types');
  }
};

//need to fix add and update for room type, missing attributes