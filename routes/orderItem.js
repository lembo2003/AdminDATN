const express = require('express');
const router = express.Router();
const orderItemController = require('../controllers/orderItemController');
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

// Order Item Management Routes
router.get('/', orderItemController.getOrderItems);
router.get('/add', orderItemController.getAddOrderItem);
router.post('/add', upload.single('image'), orderItemController.postAddOrderItem);
router.get('/edit/:itemId', orderItemController.getEditOrderItem);
router.post('/edit/:itemId', upload.single('image'), orderItemController.postEditOrderItem);
router.delete('/delete/:itemId', orderItemController.deleteOrderItem);

module.exports = router;