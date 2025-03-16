const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Apply routes with auth middleware included
orderController.routes(router);

module.exports = router;
