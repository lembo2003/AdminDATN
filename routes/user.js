const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Apply routes with auth middleware included
userController.routes(router);

module.exports = router;
