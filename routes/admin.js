const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const roomTypeController = require('../controllers/roomTypeController');
const roomController = require('../controllers/roomController');
const amenityController = require('../controllers/amenityController');
const adminUserController = require('../controllers/adminUserController');
const isAdmin = require('../middleware/isAdmin');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for files
    fieldSize: 10 * 1024 * 1024 // 10MB limit for text fields (Quill description)
  }
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

// Room Type Management - Updated to use dedicated controller
router.get('/room-types', roomTypeController.getRoomTypes);
router.get('/room-types/add', roomTypeController.getAddRoomType);
router.post('/room-types/add', roomTypeController.postAddRoomType);
router.get('/room-types/edit/:roomTypeId', roomTypeController.getEditRoomType);
router.post('/room-types/edit/:roomTypeId', roomTypeController.postUpdateRoomType);
router.delete('/room-types/delete/:roomTypeId', roomTypeController.deleteRoomType);

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
// Remove undefined controller methods
router.post('/bookings/update-payment-status/:bookingId', adminController.updateBookingPaymentStatus);
// router.post('/bookings/late-checkout/:bookingId', adminController.handleLateCheckout);
router.delete('/bookings/delete/:bookingId', adminController.deleteBooking);

// Order Management
router.get('/orders', adminController.getOrders);
router.get('/orders/details/:orderId', adminController.getOrderDetails);
router.post('/orders/update-status/:orderId', adminController.updateOrderStatus);
router.post('/orders/update-payment-status/:orderId', adminController.updateOrderPaymentStatus);
router.delete('/orders/delete/:orderId', adminController.deleteOrder);

// Order Items Management
router.get('/order-items', adminController.getOrderItems);
router.get('/order-items/add', adminController.getAddOrderItem);
router.post('/order-items/add', upload.single('image'), adminController.postAddOrderItem);
router.get('/order-items/edit/:itemId', adminController.getEditOrderItem);
router.post('/order-items/edit/:itemId', upload.single('image'), adminController.postEditOrderItem);
router.delete('/order-items/delete/:itemId', adminController.deleteOrderItem);

// User Management
router.get('/users', adminUserController.getUsers);
router.post('/users/status/:userId', adminUserController.updateUserStatus);
router.post('/users/role/:userId', adminUserController.updateUserRole);
router.post('/users/reset-password/:userId', adminUserController.resetUserPassword);
router.get('/users/details/:userId', adminUserController.getUserDetails);

// User Appeals Management
router.get('/users/appeals', adminUserController.getAppeals);
router.post('/users/appeals/:appealId', adminUserController.processAppeal);

// Staff Management
router.get('/staff', adminController.getStaff);
router.get('/staff/add', adminController.getAddStaff);
router.post('/staff/add', upload.single('image'), adminController.postAddStaff);
router.get('/staff/edit/:staffId', adminController.getEditStaff);
router.post('/staff/edit/:staffId', upload.single('image'), adminController.postEditStaff);
router.delete('/staff/delete/:staffId', adminController.deleteStaff);

// Remove undefined controller methods
// router.get('/room-availability', adminController.getRoomAvailability);
// router.post('/room-availability/block/:roomId', adminController.blockRoom);
// router.post('/room-availability/unblock/:roomId', adminController.unblockRoom);

module.exports = router;