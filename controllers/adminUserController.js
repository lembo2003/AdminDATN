const User = require('../models/user');
const Booking = require('../models/booking');
const Order = require('../models/order');
const { auth, adminAuth, adminFirestore } = require('../config/firebase');
const nodemailer = require('nodemailer');

/**
 * Admin User Management Functions
 */

/**
 * Render users list
 */
exports.getUsers = async (req, res) => {
    try {
        // Process search and filter parameters
        const filters = {};

        if (req.query.search) {
            filters.search = req.query.search;
        }

        if (req.query.status) {
            filters.status = req.query.status;
        }

        if (req.query.role) {
            filters.role = req.query.role;
        }

        // Get all users first
        const allUsers = await User.getAll();
        let users = [...allUsers];

        // Apply filters manually (since Firestore doesn't support complex queries)
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            users = users.filter(user =>
                (user.name && user.name.toLowerCase().includes(searchLower)) ||
                (user.email && user.email.toLowerCase().includes(searchLower))
            );
        }

        if (filters.status) {
            users = users.filter(user => (user.status || 'active') === filters.status);
        }

        if (filters.role) {
            users = users.filter(user => user.role === filters.role);
        }

        // Enrich user data with booking and order counts
        for (let user of users) {
            const bookings = await Booking.getAll({ userId: user.id });
            user.bookingsCount = bookings.length;

            const orders = await Order.getAll({ userId: user.id });
            user.ordersCount = orders.length;
        }

        res.render('admin/users/index', {
            title: 'User Management',
            user: req.session.user,
            users,
            filters: req.query,
            path: '/admin/users'
        });
    } catch (error) {
        console.error('Get users error:', error);
        req.flash('error_msg', 'Error loading users');
        res.redirect('/admin/dashboard');
    }
};

/**
 * Update user status (suspend, ban, activate)
 */
exports.updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newStatus, suspensionDuration } = req.body;

        // Validate the status
        if (!['active', 'suspended', 'banned'].includes(newStatus)) {
            req.flash('error_msg', 'Invalid status');
            return res.redirect('/admin/users');
        }

        // Validate user exists
        const userData = await User.getByUid(userId);
        if (!userData) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/admin/users');
        }

        // Update status in Firestore
        let updateData = { status: newStatus };

        // Handle suspension time if applicable
        if (newStatus === 'suspended' && suspensionDuration) {
            const days = parseInt(suspensionDuration) || 3;
            const suspensionEnd = new Date();
            suspensionEnd.setDate(suspensionEnd.getDate() + days);
            updateData.suspensionEnd = suspensionEnd;
        }

        await User.update(userId, updateData);

        // We no longer modify Firebase Auth disabled status
        // This allows users to still authenticate while being restricted in our app
        
        // Flash appropriate message
        let message = 'User status updated successfully';
        if (newStatus === 'suspended') {
            message = `User suspended for ${suspensionDuration} days`;
        } else if (newStatus === 'banned') {
            message = 'User banned successfully';
        } else if (newStatus === 'active') {
            message = 'User reactivated successfully';
        }

        req.flash('success_msg', message);
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Update user status error:', error);
        req.flash('error_msg', 'Error updating user status');
        res.redirect('/admin/users');
    }
};

/**
 * Update user role
 */
exports.updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newRole } = req.body;

        // Validate the role
        if (!['admin', 'user'].includes(newRole)) {
            req.flash('error_msg', 'Invalid role');
            return res.redirect('/admin/users');
        }

        // Validate user exists
        const userData = await User.getByUid(userId);
        if (!userData) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/admin/users');
        }

        // Prevent self-demotion (admin can't remove their own admin role)
        if (userId === req.session.user.id && newRole !== 'admin') {
            req.flash('error_msg', 'You cannot remove your own admin privileges');
            return res.redirect('/admin/users');
        }

        // Update role
        await User.update(userId, { role: newRole });

        const message = newRole === 'admin'
            ? 'User promoted to administrator successfully'
            : 'Administrator privileges removed successfully';

        req.flash('success_msg', message);
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Update user role error:', error);
        req.flash('error_msg', 'Error updating user role');
        res.redirect('/admin/users');
    }
};

/**
 * Reset user password
 */
exports.resetUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;

        // Validate the password
        if (!newPassword || newPassword.length < 6) {
            req.flash('error_msg', 'Password must be at least 6 characters long');
            return res.redirect('/admin/users');
        }

        // Validate user exists
        const userData = await User.getByUid(userId);
        if (!userData) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/admin/users');
        }

        // Update password in Firebase Auth
        await adminAuth.updateUser(userId, { password: newPassword });

        // Optional: Send email notification to user
        try {
            // Setup email transport (configure with your own email service)
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: userData.email,
                subject: 'Your Password Has Been Reset',
                html: `
          <h3>Password Reset Notification</h3>
          <p>Your password has been reset by an administrator.</p>
          <p>Your new temporary password is: <strong>${newPassword}</strong></p>
          <p>Please login and change your password as soon as possible.</p>
          <p>If you did not request this change, please contact support immediately.</p>
        `
            };

            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            // Continue even if email fails
        }

        req.flash('success_msg', 'User password reset successfully');
        res.redirect('/admin/users');
    } catch (error) {
        console.error('Reset user password error:', error);
        req.flash('error_msg', 'Error resetting user password');
        res.redirect('/admin/users');
    }
};

/**
 * Get user details for the view modal
 */
exports.getUserDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // Get user data
        const userData = await User.getByUid(userId);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's bookings
        const bookings = await Booking.getAll({ userId });

        // Get user's orders
        const orders = await Order.getAll({ userId });
        
        // Get user's appeals (if any)
        const appealsSnapshot = await adminFirestore.collection('appeals')
            .where('userId', '==', userId)
            .orderBy('submitted', 'desc')
            .get();
            
        const appeals = appealsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submitted: doc.data().submitted ? new Date(doc.data().submitted.seconds * 1000).toLocaleString() : 'Unknown'
        }));

        // Return user details as JSON
        res.json({
            user: userData,
            bookings: bookings.slice(0, 5), // Just get the 5 most recent
            orders: orders.slice(0, 5),
            appeals: appeals,
            stats: {
                bookingsCount: bookings.length,
                ordersCount: orders.length,
                totalSpent: [...bookings, ...orders].reduce((sum, item) => sum + (item.totalPrice || 0), 0),
                appealsCount: appeals.length
            }
        });
    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({ error: 'Error loading user details' });
    }
};

/**
 * List user appeals
 */
exports.getAppeals = async (req, res) => {
    try {
        // Get filter parameters
        const { status } = req.query;
        
        // Prepare query
        let query = adminFirestore.collection('appeals').orderBy('submitted', 'desc');
        
        if (status && status !== 'all') {
            query = query.where('status', '==', status);
        }
        
        // Execute query
        const snapshot = await query.get();
        
        const appeals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submitted: doc.data().submitted ? new Date(doc.data().submitted.seconds * 1000).toLocaleString() : 'Unknown'
        }));
        
        res.render('admin/users/appeals', {
            title: 'User Appeals',
            user: req.session.user,
            appeals,
            status: status || 'all',
            path: '/admin/users/appeals'
        });
    } catch (error) {
        console.error('Get appeals error:', error);
        req.flash('error_msg', 'Error loading appeals');
        res.redirect('/admin/users');
    }
};

/**
 * Process appeal decision
 */
exports.processAppeal = async (req, res) => {
    try {
        const { appealId } = req.params;
        const { decision, notes } = req.body;
        
        // Get the appeal
        const appealDoc = await adminFirestore.collection('appeals').doc(appealId).get();
        
        if (!appealDoc.exists) {
            req.flash('error_msg', 'Appeal not found');
            return res.redirect('/admin/users/appeals');
        }
        
        const appealData = appealDoc.data();
        
        // Update the appeal status
        await adminFirestore.collection('appeals').doc(appealId).update({
            status: decision,
            adminNotes: notes || '',
            processedBy: req.session.user.id,
            processedAt: new Date()
        });
        
        // If approved, reactivate the user's account
        if (decision === 'approved') {
            await User.update(appealData.userId, {
                status: 'active'
            });
            
            // We no longer need to enable the Firebase Auth account
            // Since we're not disabling it in the first place
            
            // Send notification email to user (if configured)
            try {
                // This would be implemented with nodemailer if email service is configured
                console.log('Appeal approved notification for user:', appealData.userEmail);
            } catch (emailError) {
                console.error('Error sending appeal notification email:', emailError);
            }
        }
        
        req.flash('success_msg', `Appeal ${decision === 'approved' ? 'approved' : 'rejected'} successfully`);
        res.redirect('/admin/users/appeals');
    } catch (error) {
        console.error('Process appeal error:', error);
        req.flash('error_msg', 'Error processing appeal');
        res.redirect('/admin/users/appeals');
    }
};