const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const User = require('./user');
const OrderItem = require('./orderItem');

const ordersCollection = adminFirestore.collection('orders');

class Order {
  /**
   * Create a new order
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} - Created order
   */
  static async create(orderData) {
    const orderId = `order_${uuidv4()}`;
    
    // Verify user exists
    const user = await User.getByUid(orderData.userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify items exist and calculate total price
    let totalPrice = 0;
    const itemsList = [];
    
    for (const item of orderData.items) {
      const orderItem = await OrderItem.getById(item.itemId);
      
      if (!orderItem) {
        throw new Error(`Order item ${item.itemId} not found`);
      }
      
      if (!orderItem.isAvailable) {
        throw new Error(`Order item ${orderItem.name} is not available`);
      }
      
      const itemTotal = orderItem.price * item.quantity;
      totalPrice += itemTotal;
      
      itemsList.push({
        itemId: item.itemId,
        name: orderItem.name,
        price: orderItem.price,
        quantity: item.quantity,
        total: itemTotal
      });
    }
    
    const newOrder = {
      orderId,
      userId: user.id,
      userName: user.name || user.email,
      items: itemsList,
      totalPrice,
      status: orderData.status || 'ordered', // ordered, delivering, completed, cancelled
      paymentMethod: orderData.paymentMethod || 'cash', // cash, card, online
      paymentStatus: orderData.paymentStatus || 'pending', // pending, paid, refunded
      deliveryAddress: orderData.deliveryAddress || '',
      roomNumber: orderData.roomNumber || '',
      specialInstructions: orderData.specialInstructions || '',
      staffId: orderData.staffId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await ordersCollection.doc(orderId).set(newOrder);
    return { id: orderId, ...newOrder };
  }

  /**
   * Get an order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object|null>} - Order data with user info
   */
  static async getById(orderId) {
    const orderDoc = await ordersCollection.doc(orderId).get();
    
    if (!orderDoc.exists) {
      return null;
    }
    
    const orderData = orderDoc.data();
    
    // Get user info
    const user = await User.getByUid(orderData.userId);
    
    return { 
      id: orderDoc.id, 
      ...orderData,
      user
    };
  }

  /**
   * Get all orders with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of orders
   */
  static async getAll(filters = {}) {
    let query = ordersCollection;
    
    // Apply filters
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }
    
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters.paymentStatus) {
      query = query.where('paymentStatus', '==', filters.paymentStatus);
    }
    
    if (filters.staffId) {
      query = query.where('staffId', '==', filters.staffId);
    }
    
    // Date range filters
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate);
      query = query.where('createdAt', '>=', fromDate);
    }
    
    // Order by creation date by default
    query = query.orderBy('createdAt', filters.order === 'asc' ? 'asc' : 'desc');
    
    const snapshot = await query.get();
    
    const orders = [];
    for (const doc of snapshot.docs) {
      const orderData = doc.data();
      
      // Get user info for each order
      const user = await User.getByUid(orderData.userId);
      
      orders.push({
        id: doc.id,
        ...orderData,
        user
      });
    }
    
    return orders;
  }

  /**
   * Update an order
   * @param {string} orderId - Order ID
   * @param {Object} orderData - Order data to update
   * @returns {Promise<Object>} - Updated order
   */
  static async update(orderId, orderData) {
    const updateData = {
      ...orderData,
      updatedAt: new Date()
    };
    
    await ordersCollection.doc(orderId).update(updateData);
    return this.getById(orderId);
  }

  /**
   * Update order status
   * @param {string} orderId - Order ID
   * @param {string} status - New status
   * @param {string|null} staffId - Staff ID for delivery
   * @returns {Promise<Object>} - Updated order
   */
  static async updateStatus(orderId, status, staffId = null) {
    const updateData = {
      status,
      updatedAt: new Date()
    };
    
    if (staffId && status === 'delivering') {
      updateData.staffId = staffId;
    }
    
    await ordersCollection.doc(orderId).update(updateData);
    return this.getById(orderId);
  }

  /**
   * Delete an order
   * @param {string} orderId - Order ID to delete
   * @returns {Promise<void>}
   */
  static async delete(orderId) {
    await ordersCollection.doc(orderId).delete();
  }
}

module.exports = Order;
