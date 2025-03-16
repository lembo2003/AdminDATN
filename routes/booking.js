const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Apply routes with auth middleware included
bookingController.routes(router);

module.exports = router;
