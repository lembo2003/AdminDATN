const Staff = require('../models/staff');
const fs = require('fs');
const path = require('path');

/**
 * Render staff list
 */
exports.getStaff = async (req, res) => {
    try {
        const staff = await Staff.getAll();
        res.render('admin/staff/index', {
            title: 'Staff Management',
            user: req.session.user,
            staff,
            path: '/admin/staff'
        });
    } catch (error) {
        console.error('Get staff error:', error);
        req.flash('error_msg', 'Error loading staff');
        res.redirect('/admin/dashboard');
    }
};

/**
 * Render add staff form
 */
exports.getAddStaff = (req, res) => {
    res.render('admin/staff/add', {
        title: 'Add Staff Member',
        user: req.session.user,
        path: '/admin/staff'
    });
};

/**
 * Process add staff form
 */
exports.postAddStaff = async (req, res) => {
    try {
        const { name, email, phone, position, department } = req.body;
        const isActive = req.body.isActive === 'true';

        // Optional fields
        const dietaryOptions = {
            isVegetarian: req.body.isVegetarian === 'true',
            isVegan: req.body.isVegan === 'true',
            isGlutenFree: req.body.isGlutenFree === 'true',
            isDairyFree: req.body.isDairyFree === 'true',
            isSpicy: req.body.isSpicy === 'true'
        };

        // Validate required fields
        if (!name || !email || !position || !department) {
            req.flash('error_msg', 'Please fill in all required fields');
            return res.redirect('/admin/staff/add');
        }

        let imageBuffer = null;

        if (req.file) {
            imageBuffer = req.file.buffer;
        }

        // Create staff member
        await Staff.create({
            name,
            email,
            phone,
            position,
            department,
            isActive,
            ...dietaryOptions
        }, imageBuffer);

        req.flash('success_msg', 'Staff member added successfully');
        res.redirect('/admin/staff');
    } catch (error) {
        console.error('Add staff error:', error);
        req.flash('error_msg', 'Error adding staff member');
        res.redirect('/admin/staff/add');
    }
};

/**
 * Render edit staff form
 */
exports.getEditStaff = async (req, res) => {
    try {
        const { staffId } = req.params;
        const staffMember = await Staff.getById(staffId);

        if (!staffMember) {
            req.flash('error_msg', 'Staff member not found');
            return res.redirect('/admin/staff');
        }

        res.render('admin/staff/edit', {
            title: 'Edit Staff Member',
            user: req.session.user,
            staffMember,
            path: '/admin/staff'
        });
    } catch (error) {
        console.error('Get edit staff error:', error);
        req.flash('error_msg', 'Error loading staff member');
        res.redirect('/admin/staff');
    }
};

/**
 * Process edit staff form
 */
exports.postEditStaff = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { name, email, phone, position, department } = req.body;
        const isActive = req.body.isActive === 'true';

        // Optional fields
        const dietaryOptions = {
            isVegetarian: req.body.isVegetarian === 'true',
            isVegan: req.body.isVegan === 'true',
            isGlutenFree: req.body.isGlutenFree === 'true',
            isDairyFree: req.body.isDairyFree === 'true',
            isSpicy: req.body.isSpicy === 'true'
        };

        // Validate required fields
        if (!name || !email || !position || !department) {
            req.flash('error_msg', 'Please fill in all required fields');
            return res.redirect(`/admin/staff/edit/${staffId}`);
        }

        let imageBuffer = null;

        if (req.file) {
            imageBuffer = req.file.buffer;
        }

        // Update staff member
        await Staff.update(staffId, {
            name,
            email,
            phone,
            position,
            department,
            isActive,
            ...dietaryOptions
        }, imageBuffer);

        req.flash('success_msg', 'Staff member updated successfully');
        res.redirect('/admin/staff');
    } catch (error) {
        console.error('Edit staff error:', error);
        req.flash('error_msg', 'Error updating staff member');
        res.redirect(`/admin/staff/edit/${req.params.staffId}`);
    }
};

/**
 * Delete staff
 */
exports.deleteStaff = async (req, res) => {
    try {
        const { staffId } = req.params;

        // Delete the staff member
        await Staff.delete(staffId);

        req.flash('success_msg', 'Staff member deleted successfully');
        res.redirect('/admin/staff');
    } catch (error) {
        console.error('Delete staff error:', error);
        req.flash('error_msg', 'Error deleting staff member');
        res.redirect('/admin/staff');
    }
};