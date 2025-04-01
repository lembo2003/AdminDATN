const express = require('express');
const router = express.Router();
const Room = require('../models/room');
const RoomType = require('../models/roomType');
const isAdmin = require('../middleware/isAdmin');

// Check if a room type has associated rooms
router.get('/room-types/:roomTypeId/room-count', isAdmin, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    
    // Check if room type exists
    const roomType = await RoomType.getById(roomTypeId);
    
    if (!roomType) {
      return res.status(404).json({ 
        success: false,
        error: 'Room type not found'
      });
    }
    
    // Count rooms using this room type
    const rooms = await Room.getAll({ roomTypeId });
    const count = rooms.length;
    
    return res.json({
      success: true,
      roomTypeId,
      count
    });
  } catch (error) {
    console.error('Error checking room dependencies:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking room dependencies'
    });
  }
});

module.exports = router;