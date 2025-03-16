const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const roomTypesCollection = adminFirestore.collection('roomTypes');

class RoomType {
  /**
   * Create a new room type
   * @param {Object} roomTypeData - Room type data
   * @returns {Promise<Object>} - Created room type
   */
  static async create(roomTypeData) {
    const roomTypeId = roomTypeData.roomTypeId || `type_${uuidv4()}`;
    
    const newRoomType = {
      roomTypeId,
      roomTypeName: roomTypeData.roomTypeName,
      description: roomTypeData.description || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await roomTypesCollection.doc(roomTypeId).set(newRoomType);
    return { id: roomTypeId, ...newRoomType };
  }

  /**
   * Get a room type by ID
   * @param {string} roomTypeId - Room type ID
   * @returns {Promise<Object|null>} - Room type data
   */
  static async getById(roomTypeId) {
    const roomTypeDoc = await roomTypesCollection.doc(roomTypeId).get();
    
    if (!roomTypeDoc.exists) {
      return null;
    }
    
    return { id: roomTypeDoc.id, ...roomTypeDoc.data() };
  }

  /**
   * Get all room types
   * @returns {Promise<Array>} - Array of room types
   */
  static async getAll() {
    const snapshot = await roomTypesCollection.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Update a room type
   * @param {string} roomTypeId - Room type ID
   * @param {Object} roomTypeData - Room type data to update
   * @returns {Promise<Object>} - Updated room type
   */
  static async update(roomTypeId, roomTypeData) {
    const updateData = {
      ...roomTypeData,
      updatedAt: new Date()
    };
    
    await roomTypesCollection.doc(roomTypeId).update(updateData);
    return this.getById(roomTypeId);
  }

  /**
   * Delete a room type
   * @param {string} roomTypeId - Room type ID to delete
   * @returns {Promise<void>}
   */
  static async delete(roomTypeId) {
    await roomTypesCollection.doc(roomTypeId).delete();
  }
}

module.exports = RoomType;
