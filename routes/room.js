const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const auth = require('../middleware/auth');

// Public routes
router.get('/', roomController.getRooms);
router.get('/search', roomController.searchRooms);
router.get('/:roomId', roomController.getRoomDetails);

// Protected routes
router.post('/:roomId/comment', auth, roomController.postComment);

module.exports = router;
