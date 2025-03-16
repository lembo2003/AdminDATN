const Amenity = require('../models/amenity');
const Room = require('../models/room');

/**
 * Render amenities list
 */
exports.getAmenities = async (req, res) => {
    try {
        const amenities = await Amenity.getAll();

        res.render('admin/amenities/index', {
            title: 'Amenities Management',
            user: req.session.user,
            amenities,
            path: '/admin/amenities'
        });
    } catch (error) {
        console.error('Get amenities error:', error);
        req.flash('error_msg', 'Error loading amenities');
        res.redirect('/admin/dashboard');
    }
};

/**
 * Render add amenity form
 */
exports.getAddAmenity = (req, res) => {
    res.render('admin/amenities/add', {
        title: 'Add Amenity',
        user: req.session.user,
        path: '/admin/amenities'
    });
};

/**
 * Process add amenity form
 */
exports.postAddAmenity = async (req, res) => {
    try {
        const { name, icon, description } = req.body;

        // Validate input
        if (!name) {
            req.flash('error_msg', 'Amenity name is required');
            return res.redirect('/admin/amenities/add');
        }

        // Create the amenity
        await Amenity.create({
            name,
            icon: icon || 'fas fa-check',
            description
        });

        req.flash('success_msg', 'Amenity added successfully');
        res.redirect('/admin/amenities');
    } catch (error) {
        console.error('Add amenity error:', error);
        req.flash('error_msg', 'Error adding amenity');
        res.redirect('/admin/amenities/add');
    }
};

/**
 * Render edit amenity form
 */
exports.getEditAmenity = async (req, res) => {
    try {
        const { amenityId } = req.params;
        const amenity = await Amenity.getById(amenityId);

        if (!amenity) {
            req.flash('error_msg', 'Amenity not found');
            return res.redirect('/admin/amenities');
        }

        res.render('admin/amenities/edit', {
            title: 'Edit Amenity',
            user: req.session.user,
            amenity,
            path: '/admin/amenities'
        });
    } catch (error) {
        console.error('Get edit amenity error:', error);
        req.flash('error_msg', 'Error loading amenity');
        res.redirect('/admin/amenities');
    }
};

/**
 * Process edit amenity form
 */
exports.postEditAmenity = async (req, res) => {
    try {
        const { amenityId } = req.params;
        const { name, icon, description } = req.body;

        // Validate input
        if (!name) {
            req.flash('error_msg', 'Amenity name is required');
            return res.redirect(`/admin/amenities/edit/${amenityId}`);
        }

        // Update the amenity
        await Amenity.update(amenityId, {
            name,
            icon: icon || 'fas fa-check',
            description
        });

        req.flash('success_msg', 'Amenity updated successfully');
        res.redirect('/admin/amenities');
    } catch (error) {
        console.error('Edit amenity error:', error);
        req.flash('error_msg', 'Error updating amenity');
        res.redirect(`/admin/amenities/edit/${req.params.amenityId}`);
    }
};

/**
 * Delete amenity
 */
exports.deleteAmenity = async (req, res) => {
    try {
        const { amenityId } = req.params;

        // Check if amenity is used by any rooms
        const rooms = await Room.getAll();
        const roomsUsingAmenity = rooms.filter(room =>
            room.amenityIds && room.amenityIds.includes(amenityId)
        );

        if (roomsUsingAmenity.length > 0) {
            req.flash('error_msg', `Cannot delete amenity. It is used by ${roomsUsingAmenity.length} room(s)`);
            return res.redirect('/admin/amenities');
        }

        // Delete the amenity
        await Amenity.delete(amenityId);

        req.flash('success_msg', 'Amenity deleted successfully');
        res.redirect('/admin/amenities');
    } catch (error) {
        console.error('Delete amenity error:', error);
        req.flash('error_msg', 'Error deleting amenity');
        res.redirect('/admin/amenities');
    }
};