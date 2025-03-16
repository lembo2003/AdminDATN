const express = require('express');
const router = express.Router();
const roomTypeController = require('../controllers/roomTypeController');
const isAdmin = require('../middleware/isAdmin');

// Apply admin middleware to all routes
router.use(isAdmin);

// Room type routes
router.get('/', roomTypeController.getRoomTypes);
router.get('/add', roomTypeController.getAddRoomType);
router.post('/add', roomTypeController.postAddRoomType);
router.get('/edit/:roomTypeId', roomTypeController.getEditRoomType);
router.post('/edit/:roomTypeId', roomTypeController.postUpdateRoomType);
router.post('/delete/:roomTypeId', roomTypeController.deleteRoomType);

module.exports = router;