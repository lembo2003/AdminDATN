const Order = require('../models/order');
const OrderItem = require('../models/orderItem');
const Booking = require('../models/booking');
const auth = require('../middleware/auth');

/**
 * Render menu items page
 */
exports.getMenu = async (req, res) => {
  try {
    // Get all available menu items
    const menuItems = await OrderItem.getAll({ isAvailable: true });
    
    // Group items by category
    const categories = {};
    
    menuItems.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      
      categories[item.category].push(item);
    });
    
    // Get user's active booking for room number
    let activeBooking = null;
    
    if (req.session.user) {
      const bookings = await Booking.getAll({ 
        userId: req.session.user.id,
        status: 'checked-in'
      });
      
      if (bookings.length > 0) {
        activeBooking = bookings[0];
      }
    }
    
    res.render('order/menu', {
      title: 'Room Service Menu',
      user: req.session.user,
      categories,
      activeBooking
    });
  } catch (error) {
    console.error('Get menu error:', error);
    req.flash('error_msg', 'Error loading menu');
    res.redirect('/');
  }
};

/**
 * Render cart page
 */
exports.getCart = async (req, res) => {
  try {
    // Initialize cart if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = {
        items: [],
        total: 0
      };
    }
    
    // Get details for each item in cart
    const cartItems = [];
    let total = 0;
    
    for (const cartItem of req.session.cart.items) {
      const item = await OrderItem.getById(cartItem.itemId);
      
      if (item) {
        const itemTotal = item.price * cartItem.quantity;
        total += itemTotal;
        
        cartItems.push({
          ...item,
          quantity: cartItem.quantity,
          total: itemTotal
        });
      }
    }
    
    // Update cart total
    req.session.cart.total = total;
    
    // Get user's active booking for room number
    let activeBooking = null;
    
    if (req.session.user) {
      const bookings = await Booking.getAll({ 
        userId: req.session.user.id,
        status: 'checked-in'
      });
      
      if (bookings.length > 0) {
        activeBooking = bookings[0];
      }
    }
    
    res.render('order/cart', {
      title: 'Your Cart',
      user: req.session.user,
      cartItems,
      total,
      activeBooking
    });
  } catch (error) {
    console.error('Get cart error:', error);
    req.flash('error_msg', 'Error loading cart');
    res.redirect('/orders/menu');
  }
};

/**
 * Add item to cart
 */
exports.addToCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    // Verify item exists and is available
    const item = await OrderItem.getById(itemId);
    
    if (!item || !item.isAvailable) {
      req.flash('error_msg', 'Item is not available');
      return res.redirect('/orders/menu');
    }
    
    // Initialize cart if it doesn't exist
    if (!req.session.cart) {
      req.session.cart = {
        items: [],
        total: 0
      };
    }
    
    // Check if item is already in cart
    const existingItemIndex = req.session.cart.items.findIndex(i => i.itemId === itemId);
    
    if (existingItemIndex !== -1) {
      // Update quantity if item exists
      req.session.cart.items[existingItemIndex].quantity += parseInt(quantity, 10);
    } else {
      // Add new item to cart
      req.session.cart.items.push({
        itemId,
        quantity: parseInt(quantity, 10)
      });
    }
    
    req.flash('success_msg', `${item.name} added to cart`);
    res.redirect('/orders/cart');
  } catch (error) {
    console.error('Add to cart error:', error);
    req.flash('error_msg', 'Error adding item to cart');
    res.redirect('/orders/menu');
  }
};

/**
 * Update cart item quantity
 */
exports.updateCartItem = (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    // Verify cart exists
    if (!req.session.cart || !req.session.cart.items) {
      return res.redirect('/orders/menu');
    }
    
    // Find item in cart
    const existingItemIndex = req.session.cart.items.findIndex(i => i.itemId === itemId);
    
    if (existingItemIndex === -1) {
      return res.redirect('/orders/cart');
    }
    
    const newQuantity = parseInt(quantity, 10);
    
    if (newQuantity <= 0) {
      // Remove item if quantity is zero or negative
      req.session.cart.items.splice(existingItemIndex, 1);
    } else {
      // Update quantity
      req.session.cart.items[existingItemIndex].quantity = newQuantity;
    }
    
    res.redirect('/orders/cart');
  } catch (error) {
    console.error('Update cart error:', error);
    req.flash('error_msg', 'Error updating cart');
    res.redirect('/orders/cart');
  }
};

/**
 * Remove item from cart
 */
exports.removeFromCart = (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Verify cart exists
    if (!req.session.cart || !req.session.cart.items) {
      return res.redirect('/orders/menu');
    }
    
    // Remove item from cart
    req.session.cart.items = req.session.cart.items.filter(i => i.itemId !== itemId);
    
    res.redirect('/orders/cart');
  } catch (error) {
    console.error('Remove from cart error:', error);
    req.flash('error_msg', 'Error removing item from cart');
    res.redirect('/orders/cart');
  }
};

/**
 * Process checkout
 */
exports.checkout = async (req, res) => {
  try {
    const { roomNumber, deliveryAddress, paymentMethod, specialInstructions } = req.body;
    
    // Verify user is logged in
    if (!req.session.user) {
      req.flash('error_msg', 'Please log in to place an order');
      return res.redirect('/auth/login');
    }
    
    // Verify cart is not empty
    if (!req.session.cart || !req.session.cart.items || req.session.cart.items.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/orders/menu');
    }
    
    // Create order
    const order = await Order.create({
      userId: req.session.user.id,
      items: req.session.cart.items.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity
      })),
      roomNumber,
      deliveryAddress,
      paymentMethod,
      specialInstructions,
      status: 'ordered',
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'paid'
    });
    
    // Clear cart after successful order
    req.session.cart = {
      items: [],
      total: 0
    };
    
    req.flash('success_msg', 'Your order has been placed!');
    res.redirect(`/orders/confirmation/${order.id}`);
  } catch (error) {
    console.error('Checkout error:', error);
    req.flash('error_msg', error.message || 'Error processing your order');
    res.redirect('/orders/cart');
  }
};

/**
 * Render order confirmation page
 */
exports.getOrderConfirmation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.getById(orderId);
    
    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/orders/my-orders');
    }
    
    // Only allow the order owner or admin to view confirmation
    if (order.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      req.flash('error_msg', 'You are not authorized to view this order');
      return res.redirect('/');
    }
    
    res.render('order/confirmation', {
      title: 'Order Confirmation',
      user: req.session.user,
      order
    });
  } catch (error) {
    console.error('Get order confirmation error:', error);
    req.flash('error_msg', 'Error loading order confirmation');
    res.redirect('/orders/my-orders');
  }
};

/**
 * Render user's orders list
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get user's orders
    const orders = await Order.getAll({ userId });
    
    res.render('order/my-orders', {
      title: 'My Orders',
      user: req.session.user,
      orders
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    req.flash('error_msg', 'Error loading your orders');
    res.redirect('/');
  }
};

/**
 * Cancel an order
 */
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.getById(orderId);
    
    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/orders/my-orders');
    }
    
    // Only allow cancellation of orders in 'ordered' status
    if (order.status !== 'ordered') {
      req.flash('error_msg', 'Cannot cancel order in current status');
      return res.redirect('/orders/my-orders');
    }
    
    // Only allow the order owner or admin to cancel
    if (order.userId !== req.session.user.id && req.session.user.role !== 'admin') {
      req.flash('error_msg', 'You are not authorized to cancel this order');
      return res.redirect('/orders/my-orders');
    }
    
    // Update order status to cancelled
    await Order.updateStatus(orderId, 'cancelled');
    
    req.flash('success_msg', 'Your order has been cancelled');
    res.redirect('/orders/my-orders');
  } catch (error) {
    console.error('Cancel order error:', error);
    req.flash('error_msg', 'Error cancelling your order');
    res.redirect('/orders/my-orders');
  }
};

// Export routes with auth middleware
exports.routes = (router) => {
  // Public routes
  router.get('/menu', exports.getMenu);
  
  // Semi-protected routes (cart can be used before login)
  router.get('/cart', exports.getCart);
  router.post('/cart/add/:itemId', exports.addToCart);
  router.post('/cart/update/:itemId', exports.updateCartItem);
  router.post('/cart/remove/:itemId', exports.removeFromCart);
  
  // Protected routes
  router.post('/checkout', auth, exports.checkout);
  router.get('/confirmation/:orderId', auth, exports.getOrderConfirmation);
  router.get('/my-orders', auth, exports.getMyOrders);
  router.post('/cancel/:orderId', auth, exports.cancelOrder);
  
  return router;
};
