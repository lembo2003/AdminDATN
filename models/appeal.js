const { adminFirestore } = require('../config/firebase');

class Appeal {
  /**
   * Create a new appeal
   * @param {Object} appealData - Appeal data
   * @returns {Promise<Object>} - Created appeal
   */
  static async create(appealData) {
    try {
      // Create the appeal document
      const appealRef = await adminFirestore.collection('appeals').add({
        ...appealData,
        submitted: new Date(),
        status: 'pending' // pending, approved, rejected
      });
      
      // Get the created appeal
      const appealDoc = await appealRef.get();
      return { id: appealDoc.id, ...appealDoc.data() };
    } catch (error) {
      console.error('Create appeal error:', error);
      throw error;
    }
  }

  /**
   * Get all appeals with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of appeals
   */
  static async getAll(filters = {}) {
    try {
      let query = adminFirestore.collection('appeals');
      
      // Apply filters
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      
      if (filters.status && filters.status !== 'all') {
        query = query.where('status', '==', filters.status);
      }
      
      // Sort by submission date (most recent first)
      query = query.orderBy('submitted', 'desc');
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submitted: doc.data().submitted ? 
          new Date(doc.data().submitted.seconds * 1000).toLocaleString() : 'Unknown'
      }));
    } catch (error) {
      console.error('Get appeals error:', error);
      throw error;
    }
  }

  /**
   * Get an appeal by ID
   * @param {string} appealId - Appeal ID
   * @returns {Promise<Object|null>} - Appeal data or null if not found
   */
  static async getById(appealId) {
    try {
      const appealDoc = await adminFirestore.collection('appeals').doc(appealId).get();
      
      if (!appealDoc.exists) {
        return null;
      }
      
      return { 
        id: appealDoc.id, 
        ...appealDoc.data(),
        submitted: appealDoc.data().submitted ? 
          new Date(appealDoc.data().submitted.seconds * 1000).toLocaleString() : 'Unknown'
      };
    } catch (error) {
      console.error('Get appeal error:', error);
      throw error;
    }
  }

  /**
   * Update an appeal
   * @param {string} appealId - Appeal ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} - Updated appeal
   */
  static async update(appealId, updateData) {
    try {
      await adminFirestore.collection('appeals').doc(appealId).update({
        ...updateData,
        processedAt: new Date()
      });
      
      return this.getById(appealId);
    } catch (error) {
      console.error('Update appeal error:', error);
      throw error;
    }
  }
}

module.exports = Appeal;