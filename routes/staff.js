const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
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

// Staff Management Routes
router.get('/', staffController.getStaff);
router.get('/add', staffController.getAddStaff);
router.post('/add', upload.single('image'), staffController.postAddStaff);
router.get('/edit/:staffId', staffController.getEditStaff);
router.post('/edit/:staffId', upload.single('image'), staffController.postEditStaff);
router.delete('/delete/:staffId', staffController.deleteStaff);

module.exports = router;