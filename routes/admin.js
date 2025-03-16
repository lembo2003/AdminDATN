const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const amenityController = require('../controllers/amenityController');
const isAdmin = require('../middleware/isAdmin');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Apply admin middleware to all routes
router.use(isAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Room Management
router.get('/rooms', adminController.getRooms);
router.get('/rooms/add', adminController.getAddRoom);
router.post('/rooms/add', upload.single('image'), adminController.postAddRoom);
router.get('/rooms/edit/:roomId', adminController.getEditRoom);
router.post('/rooms/edit/:roomId', upload.single('image'), adminController.postEditRoom);
router.delete('/rooms/delete/:roomId', adminController.deleteRoom);

// Room Type Management
router.get('/room-types', adminController.getRoomTypes);
router.get('/room-types/add', adminController.getAddRoomType);
router.post('/room-types/add', adminController.postAddRoomType);
router.get('/room-types/edit/:roomTypeId', adminController.getEditRoomType);
router.post('/room-types/edit/:roomTypeId', adminController.postEditRoomType);
router.delete('/room-types/delete/:roomTypeId', adminController.deleteRoomType);

// Amenity Management
router.get('/amenities', amenityController.getAmenities);
router.get('/amenities/add', amenityController.getAddAmenity);
router.post('/amenities/add', amenityController.postAddAmenity);
router.get('/amenities/edit/:amenityId', amenityController.getEditAmenity);
router.post('/amenities/edit/:amenityId', amenityController.postEditAmenity);
router.delete('/amenities/delete/:amenityId', amenityController.deleteAmenity);

// Booking Management
router.get('/bookings', adminController.getBookings);
router.get('/bookings/details/:bookingId', adminController.getBookingDetails);
router.post('/bookings/update-status/:bookingId', adminController.updateBookingStatus);
router.delete('/bookings/delete/:bookingId', adminController.deleteBooking);

// Order Management
router.get('/orders', adminController.getOrders);
router.get('/orders/details/:orderId', adminController.getOrderDetails);
router.post('/orders/update-status/:orderId', adminController.updateOrderStatus);
router.delete('/orders/delete/:orderId', adminController.deleteOrder);

// Order Items Management
router.get('/order-items', adminController.getOrderItems);
router.get('/order-items/add', adminController.getAddOrderItem);
router.post('/order-items/add', upload.single('image'), adminController.postAddOrderItem);
router.get('/order-items/edit/:itemId', adminController.getEditOrderItem);
router.post('/order-items/edit/:itemId', upload.single('image'), adminController.postEditOrderItem);
router.delete('/order-items/delete/:itemId', adminController.deleteOrderItem);

// User Management
router.get('/users', adminController.getUsers);
router.get('/users/edit/:userId', adminController.getEditUser);
router.post('/users/edit/:userId', adminController.postEditUser);
router.delete('/users/delete/:userId', adminController.deleteUser);

// Staff Management
router.get('/staff', adminController.getStaff);
router.get('/staff/add', adminController.getAddStaff);
router.post('/staff/add', upload.single('image'), adminController.postAddStaff);
router.get('/staff/edit/:staffId', adminController.getEditStaff);
router.post('/staff/edit/:staffId', upload.single('image'), adminController.postEditStaff);
router.delete('/staff/delete/:staffId', adminController.deleteStaff);

module.exports = router;