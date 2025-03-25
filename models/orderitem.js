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
      const uploadDir = path.join(__dirname, '../public/uploads/menu');

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
      const filepath = path.join(uploadDir, filename);

      // Write the file to disk
      fs.writeFileSync(filepath, imageFile);

      imageUrl = `/uploads/menu/${filename}`;
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

      // Dietary information
      isVegetarian: itemData.isVegetarian || false,
      isVegan: itemData.isVegan || false,
      isGlutenFree: itemData.isGlutenFree || false,
      isDairyFree: itemData.isDairyFree || false,
      isSpicy: itemData.isSpicy || false,

      // Nutritional information
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

    // Apply single-condition filters directly to the query
    // Note: Firestore has limitations on compound queries,
    // so we'll apply some filters in-memory after fetching

    // Apply category filter if provided
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }

    // Apply availability filter if provided
    if (filters.isAvailable !== undefined) {
      query = query.where('isAvailable', '==', filters.isAvailable);
    }

    // Get all items matching the initial filters
    const snapshot = await query.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply additional filters in-memory

    // Price range filters
    if (filters.minPrice !== undefined) {
      items = items.filter(item => item.price >= filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      items = items.filter(item => item.price <= filters.maxPrice);
    }

    // Dietary filters - apply in-memory if not already applied to query
    if (filters.isVegetarian) {
      items = items.filter(item => item.isVegetarian === true);
    }

    if (filters.isVegan) {
      items = items.filter(item => item.isVegan === true);
    }

    if (filters.isGlutenFree) {
      items = items.filter(item => item.isGlutenFree === true);
    }

    if (filters.isDairyFree) {
      items = items.filter(item => item.isDairyFree === true);
    }

    if (filters.isSpicy) {
      items = items.filter(item => item.isSpicy === true);
    }

    // Sort items by name as default order
    items.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

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
      const uploadDir = path.join(__dirname, '../public/uploads/menu');

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
      const filepath = path.join(uploadDir, filename);

      // Write the file to disk
      fs.writeFileSync(filepath, imageFile);

      imageUrl = `/uploads/menu/${filename}`;
    } else if (itemData.imageUrl) {
      imageUrl = itemData.imageUrl;
    }

    const updateData = {
      name: itemData.name,
      description: itemData.description || '',
      price: itemData.price || 0,
      imageUrl,
      category: itemData.category || 'general',
      isAvailable: itemData.isAvailable !== false,

      // Dietary information
      isVegetarian: itemData.isVegetarian || false,
      isVegan: itemData.isVegan || false,
      isGlutenFree: itemData.isGlutenFree || false,
      isDairyFree: itemData.isDairyFree || false,
      isSpicy: itemData.isSpicy || false,

      // Nutritional information
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