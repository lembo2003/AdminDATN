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
      
      // Add dietary information
      isVegetarian: itemData.isVegetarian || false,
      isVegan: itemData.isVegan || false,
      isGlutenFree: itemData.isGlutenFree || false,
      isDairyFree: itemData.isDairyFree || false,
      isSpicy: itemData.isSpicy || false,
      
      // Add nutritional information
      calories: itemData.calories || null,
      protein: itemData.protein || null, 
      carbs: itemData.carbs || null,
      fat: itemData.fat || null,
      allergens: itemData.allergens || '',
      
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
    
    // Dietary filters - can only apply one at a time in Firebase due to limitations
    // We'll apply remaining filters in memory
    let hasAppliedFirestoreFilter = false;
    
    if (filters.isVegetarian && !hasAppliedFirestoreFilter) {
      query = query.where('isVegetarian', '==', true);
      hasAppliedFirestoreFilter = true;
    }
    
    if (filters.isVegan && !hasAppliedFirestoreFilter) {
      query = query.where('isVegan', '==', true);
      hasAppliedFirestoreFilter = true;
    }
    
    if (filters.isGlutenFree && !hasAppliedFirestoreFilter) {
      query = query.where('isGlutenFree', '==', true);
      hasAppliedFirestoreFilter = true;
    }
    
    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Apply any additional in-memory filters
    if (filters.minPrice) {
      items = items.filter(item => item.price >= filters.minPrice);
    }
    
    // Apply remaining dietary filters in memory if they couldn't be applied in Firestore
    if (filters.isVegetarian && hasAppliedFirestoreFilter) {
      items = items.filter(item => item.isVegetarian);
    }
    
    if (filters.isVegan && hasAppliedFirestoreFilter) {
      items = items.filter(item => item.isVegan);
    }
    
    if (filters.isGlutenFree && hasAppliedFirestoreFilter) {
      items = items.filter(item => item.isGlutenFree);
    }
    
    if (filters.isDairyFree) {
      items = items.filter(item => item.isDairyFree);
    }
    
    if (filters.isSpicy) {
      items = items.filter(item => item.isSpicy);
    }
    
    return items;
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
      
      // Ensure dietary information is properly updated
      isVegetarian: itemData.isVegetarian || false,
      isVegan: itemData.isVegan || false, 
      isGlutenFree: itemData.isGlutenFree || false,
      isDairyFree: itemData.isDairyFree || false,
      isSpicy: itemData.isSpicy || false,
      
      // Ensure nutritional information is properly updated
      calories: itemData.calories || null,
      protein: itemData.protein || null,
      carbs: itemData.carbs || null,
      fat: itemData.fat || null,
      allergens: itemData.allergens || '',
      
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