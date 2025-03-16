const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const commentsCollection = adminFirestore.collection('comments');
const usersCollection = adminFirestore.collection('users');

class Comment {
  /**
   * Create a new comment
   * @param {Object} commentData - Comment data
   * @returns {Promise<Object>} - Created comment
   */
  static async create(commentData) {
    const commentId = `comment_${uuidv4()}`;
    
    const newComment = {
      commentId,
      roomId: commentData.roomId,
      userId: commentData.userId,
      text: commentData.text,
      rating: commentData.rating || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await commentsCollection.doc(commentId).set(newComment);
    return { id: commentId, ...newComment };
  }

  /**
   * Get a comment by ID
   * @param {string} commentId - Comment ID
   * @returns {Promise<Object|null>} - Comment data
   */
  static async getById(commentId) {
    const commentDoc = await commentsCollection.doc(commentId).get();
    
    if (!commentDoc.exists) {
      return null;
    }
    
    const commentData = commentDoc.data();
    
    // Get user info for the comment
    const userDoc = await usersCollection.doc(commentData.userId).get();
    let userData = null;
    
    if (userDoc.exists) {
      userData = {
        id: userDoc.id,
        name: userDoc.data().name,
        email: userDoc.data().email
      };
    }
    
    return { 
      id: commentDoc.id, 
      ...commentData,
      user: userData
    };
  }

  /**
   * Get all comments for a room
   * @param {string} roomId - Room ID
   * @returns {Promise<Array>} - Array of comments with user info
   */
  static async getByRoomId(roomId) {
    const snapshot = await commentsCollection.where('roomId', '==', roomId).orderBy('createdAt', 'desc').get();
    
    const comments = [];
    for (const doc of snapshot.docs) {
      const commentData = doc.data();
      
      // Get user info for each comment
      const userDoc = await usersCollection.doc(commentData.userId).get();
      let userData = null;
      
      if (userDoc.exists) {
        userData = {
          id: userDoc.id,
          name: userDoc.data().name,
          email: userDoc.data().email
        };
      }
      
      comments.push({
        id: doc.id,
        ...commentData,
        user: userData
      });
    }
    
    return comments;
  }

  /**
   * Get all comments by a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of user comments
   */
  static async getByUserId(userId) {
    const snapshot = await commentsCollection.where('userId', '==', userId).orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Update a comment
   * @param {string} commentId - Comment ID
   * @param {Object} commentData - Comment data to update
   * @returns {Promise<Object>} - Updated comment
   */
  static async update(commentId, commentData) {
    const updateData = {
      ...commentData,
      updatedAt: new Date()
    };
    
    await commentsCollection.doc(commentId).update(updateData);
    return this.getById(commentId);
  }

  /**
   * Delete a comment
   * @param {string} commentId - Comment ID to delete
   * @returns {Promise<void>}
   */
  static async delete(commentId) {
    await commentsCollection.doc(commentId).delete();
  }
}

module.exports = Comment;
