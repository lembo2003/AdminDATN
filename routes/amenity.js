const express = require('express');
const router = express.Router();
const amenityController = require('../controllers/amenityController');
const isAdmin = require('../middleware/isAdmin');

// Apply admin middleware to all routes
router.use(isAdmin);

// Amenity Management Routes
router.get('/', amenityController.getAmenities);
router.get('/add', amenityController.getAddAmenity);
router.post('/add', amenityController.postAddAmenity);
router.get('/edit/:amenityId', amenityController.getEditAmenity);
router.post('/edit/:amenityId', amenityController.postEditAmenity);
router.delete('/delete/:amenityId', amenityController.deleteAmenity);

module.exports = router;