const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', roomController.getRooms);
router.get('/search', roomController.searchRooms);
router.get('/:roomId', roomController.getRoomDetails);

// Room availability check route - Only add if implemented in controller
 router.get('/availability/:roomTypeId', roomController.getRoomAvailability);

// Protected routes (require authentication)
router.post('/:roomId/comment', auth, roomController.postComment);

module.exports = router;