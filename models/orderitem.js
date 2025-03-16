const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const orderItemsCollection = adminFirestore.collection('orderItems');

class OrderItem {
  /**
   * Create a new order item
   * @param {Object} itemData - Order item data
   * @param {Object|null} imageFile - Uploaded image file object
   * @returns {Promise<Object>} - Created order item
   */
  static async create(itemData, imageFile = null) {
    const itemId = `item_${uuidv4()}`;
    
    let imageUrl = '';
    
    // Handle image upload to local storage
    if (imageFile) {
      imageUrl = imageFile.path
        ? `/uploads/menu/${path.basename(imageFile.path)}`
        : imageFile.fileUrl || '';
    } else if (itemData.imageUrl) {
      imageUrl = itemData.imageUrl;
    }
    
    const newItem = {
      itemId,
      name: itemData.name,
      description: itemData.description || '',
      price: itemData.price || 0,
      imageUrl,
      category: itemData.category || 'general',
      isAvailable: itemData.isAvailable !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await orderItemsCollection.doc(itemId).set(newItem);
    return { id: itemId, ...newItem };
  }

  /**
   * Get an order item by ID
   * @param {string} itemId - Order item ID
   * @returns {Promise<Object|null>} - Order item data
   */
  static async getById(itemId) {
    const itemDoc = await orderItemsCollection.doc(itemId).get();
    
    if (!itemDoc.exists) {
      return null;
    }
    
    return { id: itemDoc.id, ...itemDoc.data() };
  }

  /**
   * Get all order items with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of order items
   */
  static async getAll(filters = {}) {
    let query = orderItemsCollection;
    
    // Apply filters
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }
    
    if (filters.isAvailable !== undefined) {
      query = query.where('isAvailable', '==', filters.isAvailable);
    }
    
    if (filters.maxPrice) {
      query = query.where('price', '<=', filters.maxPrice);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Update an order item
   * @param {string} itemId - Order item ID
   * @param {Object} itemData - Order item data to update
   * @param {Object|null} imageFile - New image file
   * @returns {Promise<Object>} - Updated order item
   */
  static async update(itemId, itemData, imageFile = null) {
    const itemDoc = await orderItemsCollection.doc(itemId).get();
    
    if (!itemDoc.exists) {
      throw new Error('Order item not found');
    }
    
    let imageUrl = itemDoc.data().imageUrl;
    
    // Upload new image if provided
    if (imageFile) {
      // Delete old image if it exists
      if (imageUrl && imageUrl.startsWith('/uploads/')) {
        const oldImagePath = path.join(__dirname, '../public', imageUrl);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Save new image
      imageUrl = imageFile.path
        ? `/uploads/menu/${path.basename(imageFile.path)}`
        : imageFile.fileUrl || '';
    } else if (itemData.imageUrl) {
      imageUrl = itemData.imageUrl;
    }
    
    const updateData = {
      ...itemData,
      imageUrl,
      updatedAt: new Date()
    };
    
    await orderItemsCollection.doc(itemId).update(updateData);
    return this.getById(itemId);
  }

  /**
   * Delete an order item
   * @param {string} itemId - Order item ID to delete
   * @returns {Promise<void>}
   */
  static async delete(itemId) {
    // Get the item first to get image URL
    const item = await this.getById(itemId);
    
    if (item && item.imageUrl && item.imageUrl.startsWith('/uploads/')) {
      // Delete image file
      const imagePath = path.join(__dirname, '../public', item.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete the item
    await orderItemsCollection.doc(itemId).delete();
  }
}

module.exports = OrderItem;