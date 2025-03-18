const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const Comment = require('./comment');
const RoomType = require('./roomType');
const Amenity = require('./amenity');
const { saveFile, deleteFile } = require('../utils/helpers');

const roomsCollection = adminFirestore.collection('rooms');

class Room {
  /**
   * Create a new room
   * @param {Object} roomData - Room data
   * @param {Object|null} imageFile - Uploaded image file object
   * @returns {Promise<Object>} - Created room
   */
  static async create(roomData, imageFile = null) {
    const roomId = roomData.roomId || `room_${uuidv4()}`;

    let imageUrl = '';

    // Handle image upload to local storage
    if (imageFile) {
      imageUrl = imageFile.path
        ? `/uploads/rooms/${path.basename(imageFile.path)}`
        : imageFile.fileUrl || '';
    } else if (roomData.imageUrl) {
      imageUrl = roomData.imageUrl;
    } else {
      throw new Error('Room image is required');
    }
    // Verify room type exists
    const roomType = await RoomType.getById(roomData.roomTypeId);
    if (!roomType) {
      throw new Error('Invalid room type');
    }
    const newRoom = {
      roomId,
      roomName: roomData.roomName,
      roomTypeId: roomData.roomTypeId,
      imageUrl,
      description: roomData.description || '',
      price: roomData.price || 0,
      isBooked: roomData.isBooked || false,
      bookingState: roomData.bookingState || 'available', // available, booked, maintenance
      amenityIds: roomData.amenityIds || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await roomsCollection.doc(roomId).set(newRoom);
    return { id: roomId, ...newRoom };
  }

  /**
   * Get a room by ID
   * @param {string} roomId - Room ID
   * @param {boolean} includeComments - Whether to include comments
   * @param {boolean} includeAmenities - Whether to include amenities
   * @returns {Promise<Object|null>} - Room data with room type info
   */
  static async getById(roomId, includeComments = false, includeAmenities = false) {
    const roomDoc = await roomsCollection.doc(roomId).get();

    if (!roomDoc.exists) {
      return null;
    }

    const roomData = roomDoc.data();

    // Get room type info
    const roomType = await RoomType.getById(roomData.roomTypeId);

    let result = {
      id: roomDoc.id,
      ...roomData,
      roomType
    };

    // Include comments if requested
    if (includeComments) {
      const comments = await Comment.getByRoomId(roomId);
      result.comments = comments;
    }

    // Include amenities if requested
    if (includeAmenities && roomData.amenityIds && roomData.amenityIds.length > 0) {
      const amenities = await Amenity.getByIds(roomData.amenityIds);
      result.amenities = amenities;
    }

    return result;
  }

  /**
   * Get all rooms with optional filtering
   * @param {Object} filters - Filter criteria
   * @param {boolean} includeAmenities - Whether to include amenities
   * @returns {Promise<Array>} - Array of rooms with room type info
   */
  static async getAll(filters = {}, includeAmenities = false) {
    let query = roomsCollection;

    // Apply filters
    if (filters.roomTypeId) {
      query = query.where('roomTypeId', '==', filters.roomTypeId);
    }

    if (filters.bookingState) {
      query = query.where('bookingState', '==', filters.bookingState);
    }

    if (filters.isBooked !== undefined) {
      query = query.where('isBooked', '==', filters.isBooked);
    }

    if (filters.maxPrice) {
      query = query.where('price', '<=', filters.maxPrice);
    }

    const snapshot = await query.get();

    const rooms = [];
    for (const doc of snapshot.docs) {
      const roomData = doc.data();

      // Get room type info for each room
      const roomType = await RoomType.getById(roomData.roomTypeId);

      const room = {
        id: doc.id,
        ...roomData,
        roomType
      };

      // Include amenities if requested
      if (includeAmenities && roomData.amenityIds && roomData.amenityIds.length > 0) {
        const amenities = await Amenity.getByIds(roomData.amenityIds);
        room.amenities = amenities;
      }

      rooms.push(room);
    }

    return rooms;
  }

  /**
   * Update a room
   * @param {string} roomId - Room ID
   * @param {Object} roomData - Room data to update
   * @param {Object|null} imageFile - New image file
   * @returns {Promise<Object>} - Updated room
   */
  static async update(roomId, roomData, imageFile = null) {
    const roomDoc = await roomsCollection.doc(roomId).get();

    if (!roomDoc.exists) {
      throw new Error('Room not found');
    }

    let imageUrl = roomDoc.data().imageUrl;

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
        ? `/uploads/rooms/${path.basename(imageFile.path)}`
        : imageFile.fileUrl || '';
    } else if (roomData.imageUrl) {
      imageUrl = roomData.imageUrl;
    }
    const updateData = {
      ...roomData,
      imageUrl,
      updatedAt: new Date()
    };

    await roomsCollection.doc(roomId).update(updateData);
    return this.getById(roomId, false, true);
  }

  /**
   * Delete a room
   * @param {string} roomId - Room ID to delete
   * @returns {Promise<void>}
   */
  static async delete(roomId) {
    // Get the room first to get image URL
    const room = await this.getById(roomId);
    if (room && room.imageUrl && room.imageUrl.startsWith('/uploads/')) {
      // Delete image file
      const imagePath = path.join(__dirname, '../public', room.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    // Delete all comments for this room
    const comments = await Comment.getByRoomId(roomId);
    for (const comment of comments) {
      await Comment.delete(comment.id);
    }
    // Delete the room
    await roomsCollection.doc(roomId).delete();
  }

  /**
   * Update booking state
   * @param {string} roomId - Room ID
   * @param {string} bookingState - New booking state
   * @returns {Promise<Object>} - Updated room
   */
  static async updateBookingState(roomId, bookingState) {
    const isBooked = bookingState !== 'available';
    await roomsCollection.doc(roomId).update({
      bookingState,
      isBooked,
      updatedAt: new Date()
    });
    return this.getById(roomId);
  }
}

module.exports = Room;