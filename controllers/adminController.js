const fs = require('fs');
const path = require('path');
const Room = require('../models/room');
const RoomType = require('../models/roomType');
const Amenity = require('../models/amenity');
const Booking = require('../models/booking');
const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const User = require('../models/user');
const Staff = require('../models/staff');
const Comment = require('../models/comment');

/**
 * Render admin dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    // Get counts for dashboard
    const [rooms, bookings, orders, users] = await Promise.all([
      Room.getAll(),
      Booking.getAll(),
      Order.getAll(),
      User.getAll()
    ]);

    // Recent bookings
    const recentBookings = bookings.slice(0, 5);

    // Available rooms count
    const availableRooms = rooms.filter(room => !room.isBooked).length;

    // Calculate stats
    const stats = {
      totalRooms: rooms.length,
      availableRooms,
      occupancyRate: rooms.length > 0 ? ((rooms.length - availableRooms) / rooms.length * 100).toFixed(2) : 0,
      totalBookings: bookings.length,
      totalOrders: orders.length,
      totalUsers: users.length,
      pendingBookings: bookings.filter(b => b.status === 'booked').length,
      checkedInGuests: bookings.filter(b => b.status === 'checked-in').length,
      pendingOrders: orders.filter(o => o.status === 'ordered').length
    };
    // Revenue stats
    const totalBookingRevenue = bookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, booking) => sum + booking.totalPrice, 0);

    const totalOrderRevenue = orders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, order) => sum + order.totalPrice, 0);

    const totalRevenue = totalBookingRevenue + totalOrderRevenue;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      stats,
      recentBookings,
      totalRevenue,
      path: '/admin/dashboard'
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error_msg', 'Error loading dashboard data');
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.session.user,
      stats: {},
      recentBookings: [],
      totalRevenue: 0,
      path: '/admin/dashboard'
    });
  }
};

/**
 * Room Management
 */

// Render rooms list
exports.getRooms = async (req, res) => {
  try {
    // Get filter parameters
    const { roomType, status, search } = req.query;

    // Prepare filters
    const filters = {};

    if (roomType) {
      filters.roomTypeId = roomType;
    }

    if (status) {
      filters.bookingState = status;
    }

    // Get rooms based on filters
    const rooms = await Room.getAll(filters);

    // Apply name search filter in memory if search term provided
    // (Firestore doesn't support LIKE queries directly)
    let filteredRooms = rooms;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredRooms = rooms.filter(room =>
        room.roomName.toLowerCase().includes(searchLower) ||
        (room.description && room.description.toLowerCase().includes(searchLower)) ||
        (room.roomType && room.roomType.roomTypeName.toLowerCase().includes(searchLower))
      );
    }

    // Get all room types for the filter dropdown
    const roomTypes = await RoomType.getAll();

    res.render('admin/rooms/index', {
      title: 'Room Management',
      user: req.session.user,
      rooms: filteredRooms,
      roomTypes,
      filters: req.query, // Pass the filter parameters back to the view
      path: '/admin/rooms'
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    req.flash('error_msg', 'Error loading rooms');
    res.redirect('/admin/dashboard');
  }
};

// Render add room form
exports.getAddRoom = async (req, res) => {
  try {
    const roomTypes = await RoomType.getAll();
    const amenities = await Amenity.getAll();

    res.render('admin/rooms/add', {
      title: 'Add New Room',
      user: req.session.user,
      roomTypes,
      amenities,
      path: '/admin/rooms'
    });
  } catch (error) {
    console.error('Get add room error:', error);
    req.flash('error_msg', 'Error loading room form');
    res.redirect('/admin/rooms');
  }
};

// Process add room form
exports.postAddRoom = async (req, res) => {
  try {
    const { roomName, roomTypeId, description, price, bookingState } = req.body;

    // Get array of amenityIds (handle empty selection)
    let amenityIds = req.body.amenityIds || [];

    // Ensure amenityIds is an array (it's a string when only one is selected)
    if (!Array.isArray(amenityIds)) {
      amenityIds = [amenityIds];
    }

    // Check if file was uploaded
    if (!req.file) {
      req.flash('error_msg', 'Room image is required');
      return res.redirect('/admin/rooms/add');
    }

    // Create a temporary file path for the image
    const uploadDir = path.join(__dirname, '../public/uploads/rooms');

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate a unique filename
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
    const filepath = path.join(uploadDir, filename);

    // Write the file to disk
    fs.writeFileSync(filepath, req.file.buffer);

    // Create file object with path
    const fileObj = {
      path: filepath,
      filename: filename
    };
    // Create the room
    await Room.create({
      roomName,
      roomTypeId,
      description,
      price: parseFloat(price),
      bookingState: bookingState || 'available',
      amenityIds: amenityIds
    }, fileObj);

    req.flash('success_msg', 'Room added successfully');
    res.redirect('/admin/rooms');
  } catch (error) {
    console.error('Add room error:', error);
    req.flash('error_msg', error.message || 'Error adding room');
    res.redirect('/admin/rooms/add');
  }
};

// Render edit room form
exports.getEditRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.getById(roomId, true, true); // Include comments and amenities
    const roomTypes = await RoomType.getAll();
    const amenities = await Amenity.getAll();

    if (!room) {
      req.flash('error_msg', 'Room not found');
      return res.redirect('/admin/rooms');
    }
    res.render('admin/rooms/edit', {
      title: 'Edit Room',
      user: req.session.user,
      room,
      roomTypes,
      amenities,
      path: '/admin/rooms'
    });
  } catch (error) {
    console.error('Get edit room error:', error);
    req.flash('error_msg', 'Error loading room');
    res.redirect('/admin/rooms');
  }
};

// Process edit room form
exports.postEditRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { roomName, roomTypeId, description, price, bookingState } = req.body;

    // Get array of amenityIds (handle empty selection)
    let amenityIds = req.body.amenityIds || [];

    // Ensure amenityIds is an array (it's a string when only one is selected)
    if (!Array.isArray(amenityIds)) {
      amenityIds = [amenityIds];
    }

    let fileObj = null;

    // If a new image was uploaded
    if (req.file) {
      // Create a temporary file path for the image
      const uploadDir = path.join(__dirname, '../public/uploads/rooms');
      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
      const filepath = path.join(uploadDir, filename);

      // Write the file to disk
      fs.writeFileSync(filepath, req.file.buffer);

      // Create file object with path
      fileObj = {
        path: filepath,
        filename: filename
      };
    }
    // Update the room
    await Room.update(roomId, {
      roomName,
      roomTypeId,
      description,
      price: parseFloat(price),
      bookingState,
      amenityIds: amenityIds
    }, fileObj);

    req.flash('success_msg', 'Room updated successfully');
    res.redirect('/admin/rooms');
  } catch (error) {
    console.error('Edit room error:', error);
    req.flash('error_msg', error.message || 'Error updating room');
    res.redirect(`/admin/rooms/edit/${req.params.roomId}`);
  }
};

// Delete room
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    await Room.delete(roomId);
    req.flash('success_msg', 'Room deleted successfully');
    res.redirect('/admin/rooms');
  } catch (error) {
    console.error('Delete room error:', error);
    req.flash('error_msg', 'Error deleting room');
    res.redirect('/admin/rooms');
  }
};

/**
 * Room Type Management
 */

// Render room types list
exports.getRoomTypes = async (req, res) => {
  try {
    const roomTypes = await RoomType.getAll();
    res.render('admin/roomTypes/index', {
      title: 'Room Types',
      user: req.session.user,
      roomTypes,
      path: '/admin/room-types'
    });
  } catch (error) {
    console.error('Get room types error:', error);
    req.flash('error_msg', 'Error loading room types');
    res.redirect('/admin/dashboard');
  }
};

// Render add room type form
exports.getAddRoomType = (req, res) => {
  res.render('admin/roomTypes/add', {
    title: 'Add Room Type',
    user: req.session.user,
    path: '/admin/room-types'
  });
};

// Process add room type form
exports.postAddRoomType = async (req, res) => {
  try {
    const { roomTypeName, description } = req.body;
    await RoomType.create({
      roomTypeName,
      description
    });
    req.flash('success_msg', 'Room type added successfully');
    res.redirect('/admin/room-types');
  } catch (error) {
    console.error('Add room type error:', error);
    req.flash('error_msg', 'Error adding room type');
    res.redirect('/admin/room-types/add');
  }
};

// Render edit room type form
exports.getEditRoomType = async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const roomType = await RoomType.getById(roomTypeId);
    if (!roomType) {
      req.flash('error_msg', 'Room type not found');
      return res.redirect('/admin/room-types');
    }
    res.render('admin/roomTypes/edit', {
      title: 'Edit Room Type',
      user: req.session.user,
      roomType,
      path: '/admin/room-types'
    });
  } catch (error) {
    console.error('Get edit room type error:', error);
    req.flash('error_msg', 'Error loading room type');
    res.redirect('/admin/room-types');
  }
};

// Process edit room type form
exports.postEditRoomType = async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { roomTypeName, description } = req.body;
    await RoomType.update(roomTypeId, {
      roomTypeName,
      description
    });
    req.flash('success_msg', 'Room type updated successfully');
    res.redirect('/admin/room-types');
  } catch (error) {
    console.error('Edit room type error:', error);
    req.flash('error_msg', 'Error updating room type');
    res.redirect(`/admin/room-types/edit/${req.params.roomTypeId}`);
  }
};

// Delete room type
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
    req.flash('error_msg', 'Error deleting room type');
    res.redirect('/admin/room-types');
  }
};

/**
 * Amenity Management
 */

// Render amenities list
exports.getAmenities = async (req, res) => {
  try {
    const amenities = await Amenity.getAll();

    res.render('admin/amenities/index', {
      title: 'Amenities Management',
      user: req.session.user,
      amenities,
      path: '/admin/amenities'
    });
  } catch (error) {
    console.error('Get amenities error:', error);
    req.flash('error_msg', 'Error loading amenities');
    res.redirect('/admin/dashboard');
  }
};

// Render add amenity form
exports.getAddAmenity = (req, res) => {
  res.render('admin/amenities/add', {
    title: 'Add Amenity',
    user: req.session.user,
    path: '/admin/amenities'
  });
};

// Process add amenity form
exports.postAddAmenity = async (req, res) => {
  try {
    const { name, icon, description } = req.body;

    // Validate input
    if (!name) {
      req.flash('error_msg', 'Amenity name is required');
      return res.redirect('/admin/amenities/add');
    }

    // Create the amenity
    await Amenity.create({
      name,
      icon: icon || 'fas fa-check',
      description
    });

    req.flash('success_msg', 'Amenity added successfully');
    res.redirect('/admin/amenities');
  } catch (error) {
    console.error('Add amenity error:', error);
    req.flash('error_msg', 'Error adding amenity');
    res.redirect('/admin/amenities/add');
  }
};

// Render edit amenity form
exports.getEditAmenity = async (req, res) => {
  try {
    const { amenityId } = req.params;
    const amenity = await Amenity.getById(amenityId);

    if (!amenity) {
      req.flash('error_msg', 'Amenity not found');
      return res.redirect('/admin/amenities');
    }

    res.render('admin/amenities/edit', {
      title: 'Edit Amenity',
      user: req.session.user,
      amenity,
      path: '/admin/amenities'
    });
  } catch (error) {
    console.error('Get edit amenity error:', error);
    req.flash('error_msg', 'Error loading amenity');
    res.redirect('/admin/amenities');
  }
};

// Process edit amenity form
exports.postEditAmenity = async (req, res) => {
  try {
    const { amenityId } = req.params;
    const { name, icon, description } = req.body;

    // Validate input
    if (!name) {
      req.flash('error_msg', 'Amenity name is required');
      return res.redirect(`/admin/amenities/edit/${amenityId}`);
    }

    // Update the amenity
    await Amenity.update(amenityId, {
      name,
      icon: icon || 'fas fa-check',
      description
    });

    req.flash('success_msg', 'Amenity updated successfully');
    res.redirect('/admin/amenities');
  } catch (error) {
    console.error('Edit amenity error:', error);
    req.flash('error_msg', 'Error updating amenity');
    res.redirect(`/admin/amenities/edit/${req.params.amenityId}`);
  }
};

// Delete amenity
exports.deleteAmenity = async (req, res) => {
  try {
    const { amenityId } = req.params;

    // Check if amenity is used by any rooms
    const rooms = await Room.getAll();
    const roomsUsingAmenity = rooms.filter(room =>
      room.amenityIds && room.amenityIds.includes(amenityId)
    );

    if (roomsUsingAmenity.length > 0) {
      req.flash('error_msg', `Cannot delete amenity. It is used by ${roomsUsingAmenity.length} room(s)`);
      return res.redirect('/admin/amenities');
    }

    // Delete the amenity
    await Amenity.delete(amenityId);

    req.flash('success_msg', 'Amenity deleted successfully');
    res.redirect('/admin/amenities');
  } catch (error) {
    console.error('Delete amenity error:', error);
    req.flash('error_msg', 'Error deleting amenity');
    res.redirect('/admin/amenities');
  }
};

/**
 * Booking Management
 */

// Render bookings list
exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.getAll();
    res.render('admin/bookings/index', {
      title: 'Booking Management',
      user: req.session.user,
      bookings,
      path: '/admin/bookings'
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    req.flash('error_msg', 'Error loading bookings');
    res.redirect('/admin/dashboard');
  }
};

// Render booking details
exports.getBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.getById(bookingId);
    if (!booking) {
      req.flash('error_msg', 'Booking not found');
      return res.redirect('/admin/bookings');
    }
    res.render('admin/bookings/details', {
      title: 'Booking Details',
      user: req.session.user,
      booking,
      path: '/admin/bookings'
    });
  } catch (error) {
    console.error('Get booking details error:', error);
    req.flash('error_msg', 'Error loading booking details');
    res.redirect('/admin/bookings');
  }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    await Booking.updateStatus(bookingId, status);

    req.flash('success_msg', `Booking status updated to ${status}`);
    res.redirect(`/admin/bookings/details/${bookingId}`);
  } catch (error) {
    console.error('Update booking status error:', error);
    req.flash('error_msg', 'Error updating booking status');
    res.redirect(`/admin/bookings/details/${req.params.bookingId}`);
  }
};

// Delete booking
exports.deleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    await Booking.delete(bookingId);
    req.flash('success_msg', 'Booking deleted successfully');
    res.redirect('/admin/bookings');
  } catch (error) {
    console.error('Delete booking error:', error);
    req.flash('error_msg', 'Error deleting booking');
    res.redirect('/admin/bookings');
  }
};

/**
 * Order Management
 */

// Render orders list
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.getAll();
    res.render('admin/orders/index', {
      title: 'Order Management',
      user: req.session.user,
      orders,
      path: '/admin/orders'
    });
  } catch (error) {
    console.error('Get orders error:', error);
    req.flash('error_msg', 'Error loading orders');
    res.redirect('/admin/dashboard');
  }
};

// Render order details
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.getById(orderId);
    const staff = await Staff.getAvailableForDelivery();
    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/admin/orders');
    }
    res.render('admin/orders/details', {
      title: 'Order Details',
      user: req.session.user,
      order,
      staff,
      path: '/admin/orders'
    });
  } catch (error) {
    console.error('Get order details error:', error);
    req.flash('error_msg', 'Error loading order details');
    res.redirect('/admin/orders');
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, staffId } = req.body;

    await Order.updateStatus(orderId, status, staffId);

    req.flash('success_msg', `Order status updated to ${status}`);
    res.redirect(`/admin/orders/details/${orderId}`);
  } catch (error) {
    console.error('Update order status error:', error);
    req.flash('error_msg', 'Error updating order status');
    res.redirect(`/admin/orders/details/${req.params.orderId}`);
  }
};

// Delete order
exports.deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    await Order.delete(orderId);
    req.flash('success_msg', 'Order deleted successfully');
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Delete order error:', error);
    req.flash('error_msg', 'Error deleting order');
    res.redirect('/admin/orders');
  }
};

/**
 * Order Items Management
 */

// Render order items list
exports.getOrderItems = async (req, res) => {
  try {
    const orderItems = await OrderItem.getAll();
    res.render('admin/orderItems/index', {
      title: 'Menu Items',
      user: req.session.user,
      orderItems,
      path: '/admin/order-items'
    });
  } catch (error) {
    console.error('Get order items error:', error);
    req.flash('error_msg', 'Error loading menu items');
    res.redirect('/admin/dashboard');
  }
};

// Render add order item form
exports.getAddOrderItem = (req, res) => {
  res.render('admin/orderItems/add', {
    title: 'Add Menu Item',
    user: req.session.user,
    path: '/admin/order-items'
  });
};

// Process add order item form
exports.postAddOrderItem = async (req, res) => {
  try {
    const { name, category, description, price } = req.body;
    let imageBuffer = null;

    if (req.file) {
      imageBuffer = req.file.buffer;
    }

    await OrderItem.create({
      name,
      category,
      description,
      price: parseFloat(price),
      isAvailable: true
    }, imageBuffer);
    req.flash('success_msg', 'Menu item added successfully');
    res.redirect('/admin/order-items');
  } catch (error) {
    console.error('Add order item error:', error);
    req.flash('error_msg', 'Error adding menu item');
    res.redirect('/admin/order-items/add');
  }
};

// Render edit order item form
exports.getEditOrderItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const orderItem = await OrderItem.getById(itemId);
    if (!orderItem) {
      req.flash('error_msg', 'Menu item not found');
      return res.redirect('/admin/order-items');
    }
    res.render('admin/orderItems/edit', {
      title: 'Edit Menu Item',
      user: req.session.user,
      orderItem,
      path: '/admin/order-items'
    });
  } catch (error) {
    console.error('Get edit order item error:', error);
    req.flash('error_msg', 'Error loading menu item');
    res.redirect('/admin/order-items');
  }
};

// Process edit order item form
exports.postEditOrderItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, category, description, price, isAvailable } = req.body;
    let imageBuffer = null;

    if (req.file) {
      imageBuffer = req.file.buffer;
    }

    await OrderItem.update(itemId, {
      name,
      category,
      description,
      price: parseFloat(price),
      isAvailable: isAvailable === 'true'
    }, imageBuffer);
    req.flash('success_msg', 'Menu item updated successfully');
    res.redirect('/admin/order-items');
  } catch (error) {
    console.error('Edit order item error:', error);
    req.flash('error_msg', 'Error updating menu item');
    res.redirect(`/admin/order-items/edit/${req.params.itemId}`);
  }
};

// Delete order item
exports.deleteOrderItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await OrderItem.delete(itemId);
    req.flash('success_msg', 'Menu item deleted successfully');
    res.redirect('/admin/order-items');
  } catch (error) {
    console.error('Delete order item error:', error);
    req.flash('error_msg', 'Error deleting menu item');
    res.redirect('/admin/order-items');
  }
};

/**
 * User Management
 */

// Render users list
exports.getUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    res.render('admin/users/index', {
      title: 'User Management',
      user: req.session.user,
      users,
      path: '/admin/users'
    });
  } catch (error) {
    console.error('Get users error:', error);
    req.flash('error_msg', 'Error loading users');
    res.redirect('/admin/dashboard');
  }
};

// Render edit user form
exports.getEditUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const userData = await User.getByUid(userId);
    if (!userData) {
      req.flash('error_msg', 'User not found');
      return res.redirect('/admin/users');
    }
    res.render('admin/users/edit', {
      title: 'Edit User',
      user: req.session.user,
      userData,
      path: '/admin/users'
    });
  } catch (error) {
    console.error('Get edit user error:', error);
    req.flash('error_msg', 'Error loading user');
    res.redirect('/admin/users');
  }
};

// Process edit user form
exports.postEditUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, gender, province, country, phone, role } = req.body;
    await User.update(userId, {
      name,
      email,
      gender,
      province,
      country,
      phone,
      role
    });
    req.flash('success_msg', 'User updated successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Edit user error:', error);
    req.flash('error_msg', 'Error updating user');
    res.redirect(`/admin/users/edit/${req.params.userId}`);
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await User.delete(userId);
    req.flash('success_msg', 'User deleted successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Delete user error:', error);
    req.flash('error_msg', 'Error deleting user');
    res.redirect('/admin/users');
  }
};

/**
 * Staff Management
 */

// Render staff list
exports.getStaff = async (req, res) => {
  try {
    const staff = await Staff.getAll();
    res.render('admin/staff/index', {
      title: 'Staff Management',
      user: req.session.user,
      staff,
      path: '/admin/staff'
    });
  } catch (error) {
    console.error('Get staff error:', error);
    req.flash('error_msg', 'Error loading staff');
    res.redirect('/admin/dashboard');
  }
};

// Render add staff form
exports.getAddStaff = (req, res) => {
  res.render('admin/staff/add', {
    title: 'Add Staff Member',
    user: req.session.user,
    path: '/admin/staff'
  });
};

// Process add staff form
exports.postAddStaff = async (req, res) => {
  try {
    const { name, email, phone, position, department } = req.body;
    let imageBuffer = null;

    if (req.file) {
      imageBuffer = req.file.buffer;
    }

    await Staff.create({
      name,
      email,
      phone,
      position,
      department,
      isActive: true
    }, imageBuffer);
    req.flash('success_msg', 'Staff member added successfully');
    res.redirect('/admin/staff');
  } catch (error) {
    console.error('Add staff error:', error);
    req.flash('error_msg', 'Error adding staff member');
    res.redirect('/admin/staff/add');
  }
};

// Render edit staff form
exports.getEditStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const staffMember = await Staff.getById(staffId);
    if (!staffMember) {
      req.flash('error_msg', 'Staff member not found');
      return res.redirect('/admin/staff');
    }
    res.render('admin/staff/edit', {
      title: 'Edit Staff Member',
      user: req.session.user,
      staffMember,
      path: '/admin/staff'
    });
  } catch (error) {
    console.error('Get edit staff error:', error);
    req.flash('error_msg', 'Error loading staff member');
    res.redirect('/admin/staff');
  }
};

// Process edit staff form
exports.postEditStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { name, email, phone, position, department, isActive } = req.body;
    let imageBuffer = null;

    if (req.file) {
      imageBuffer = req.file.buffer;
    }

    await Staff.update(staffId, {
      name,
      email,
      phone,
      position,
      department,
      isActive: isActive === 'true'
    }, imageBuffer);
    req.flash('success_msg', 'Staff member updated successfully');
    res.redirect('/admin/staff');
  } catch (error) {
    console.error('Edit staff error:', error);
    req.flash('error_msg', 'Error updating staff member');
    res.redirect(`/admin/staff/edit/${req.params.staffId}`);
  }
};

// Delete staff
exports.deleteStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    await Staff.delete(staffId);
    req.flash('success_msg', 'Staff member deleted successfully');
    res.redirect('/admin/staff');
  } catch (error) {
    console.error('Delete staff error:', error);
    req.flash('error_msg', 'Error deleting staff member');
    res.redirect('/admin/staff');
  }
};