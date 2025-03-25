const OrderItem = require('../models/orderItem');
const fs = require('fs');
const path = require('path');

/**
 * Render order items list
 */
exports.getOrderItems = async (req, res) => {
    try {
        // Process filter parameters
        const filters = {};

        if (req.query.category && req.query.category !== '') {
            filters.category = req.query.category;
        }

        if (req.query.availability) {
            filters.isAvailable = req.query.availability === 'available';
        }

        // Handle price range filter
        if (req.query.minPrice && !isNaN(parseFloat(req.query.minPrice))) {
            filters.minPrice = parseFloat(req.query.minPrice);
        }

        if (req.query.maxPrice && !isNaN(parseFloat(req.query.maxPrice))) {
            filters.maxPrice = parseFloat(req.query.maxPrice);
        }

        // Handle dietary filters
        if (req.query.isVegetarian === 'true') {
            filters.isVegetarian = true;
        }

        if (req.query.isVegan === 'true') {
            filters.isVegan = true;
        }

        if (req.query.isGlutenFree === 'true') {
            filters.isGlutenFree = true;
        }

        // Get order items based on filters
        const orderItems = await OrderItem.getAll(filters);

        // Apply search filter in-memory if provided
        let filteredItems = orderItems;
        if (req.query.search && req.query.search.trim() !== '') {
            const searchTerm = req.query.search.toLowerCase();
            filteredItems = orderItems.filter(item =>
                item.name.toLowerCase().includes(searchTerm) ||
                (item.description && item.description.toLowerCase().includes(searchTerm)) ||
                (item.category && item.category.toLowerCase().includes(searchTerm))
            );
        }

        // Get a list of all unique categories for the filter dropdown
        const allItems = await OrderItem.getAll();
        const categories = [...new Set(allItems.map(item => item.category))].filter(Boolean).sort();

        res.render('admin/orderItems/index', {
            title: 'Menu Items Management',
            user: req.session.user,
            orderItems: filteredItems,
            categories: categories,
            filters: req.query,
            path: '/admin/order-items'
        });
    } catch (error) {
        console.error('Get order items error:', error);
        req.flash('error_msg', 'Error loading menu items');
        res.redirect('/admin/dashboard');
    }
};

/**
 * Render add order item form
 */
exports.getAddOrderItem = (req, res) => {
    res.render('admin/orderItems/add', {
        title: 'Add Menu Item',
        user: req.session.user,
        path: '/admin/order-items'
    });
};

/**
 * Process add order item form
 */
exports.postAddOrderItem = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            price,
            calories,
            protein,
            carbs,
            fat,
            allergens
        } = req.body;

        // Boolean values
        const isAvailable = req.body.isAvailable === 'true';
        const isVegetarian = req.body.isVegetarian === 'true';
        const isVegan = req.body.isVegan === 'true';
        const isGlutenFree = req.body.isGlutenFree === 'true';
        const isDairyFree = req.body.isDairyFree === 'true';
        const isSpicy = req.body.isSpicy === 'true';

        // Validate required fields
        if (!name || !category || !price) {
            req.flash('error_msg', 'Name, category and price are required');
            return res.redirect('/admin/order-items/add');
        }

        let imageBuffer = null;

        if (req.file) {
            imageBuffer = req.file.buffer;
        }

        // Create the order item
        await OrderItem.create({
            name,
            description,
            category,
            price: parseFloat(price),
            isAvailable,
            isVegetarian,
            isVegan,
            isGlutenFree,
            isDairyFree,
            isSpicy,
            calories: calories ? parseInt(calories) : null,
            protein: protein ? parseFloat(protein) : null,
            carbs: carbs ? parseFloat(carbs) : null,
            fat: fat ? parseFloat(fat) : null,
            allergens
        }, imageBuffer);

        req.flash('success_msg', 'Menu item added successfully');
        res.redirect('/admin/order-items');
    } catch (error) {
        console.error('Add order item error:', error);
        req.flash('error_msg', 'Error adding menu item');
        res.redirect('/admin/order-items/add');
    }
};

/**
 * Render edit order item form
 */
exports.getEditOrderItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const orderItem = await OrderItem.getById(itemId);

        if (!orderItem) {
            req.flash('error_msg', 'Menu item not found');
            return res.redirect('/admin/order-items');
        }

        res.render('admin/orderItems/edit', {
            title: 'Edit Menu Item',
            user: req.session.user,
            orderItem,
            path: '/admin/order-items'
        });
    } catch (error) {
        console.error('Get edit order item error:', error);
        req.flash('error_msg', 'Error loading menu item');
        res.redirect('/admin/order-items');
    }
};

/**
 * Process edit order item form
 */
exports.postEditOrderItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const {
            name,
            description,
            category,
            price,
            calories,
            protein,
            carbs,
            fat,
            allergens
        } = req.body;

        // Boolean values
        const isAvailable = req.body.isAvailable === 'true';
        const isVegetarian = req.body.isVegetarian === 'true';
        const isVegan = req.body.isVegan === 'true';
        const isGlutenFree = req.body.isGlutenFree === 'true';
        const isDairyFree = req.body.isDairyFree === 'true';
        const isSpicy = req.body.isSpicy === 'true';

        // Validate required fields
        if (!name || !category || !price) {
            req.flash('error_msg', 'Name, category and price are required');
            return res.redirect(`/admin/order-items/edit/${itemId}`);
        }

        let imageBuffer = null;

        if (req.file) {
            imageBuffer = req.file.buffer;
        }

        // Update the order item
        await OrderItem.update(itemId, {
            name,
            description,
            category,
            price: parseFloat(price),
            isAvailable,
            isVegetarian,
            isVegan,
            isGlutenFree,
            isDairyFree,
            isSpicy,
            calories: calories ? parseInt(calories) : null,
            protein: protein ? parseFloat(protein) : null,
            carbs: carbs ? parseFloat(carbs) : null,
            fat: fat ? parseFloat(fat) : null,
            allergens
        }, imageBuffer);

        req.flash('success_msg', 'Menu item updated successfully');
        res.redirect('/admin/order-items');
    } catch (error) {
        console.error('Edit order item error:', error);
        req.flash('error_msg', 'Error updating menu item');
        res.redirect(`/admin/order-items/edit/${req.params.itemId}`);
    }
};

/**
 * Delete order item
 */
exports.deleteOrderItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        // Delete the order item
        await OrderItem.delete(itemId);

        req.flash('success_msg', 'Menu item deleted successfully');
        res.redirect('/admin/order-items');
    } catch (error) {
        console.error('Delete order item error:', error);
        req.flash('error_msg', 'Error deleting menu item');
        res.redirect('/admin/order-items');
    }
};