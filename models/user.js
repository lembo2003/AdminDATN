const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * User model for interacting with Firestore via Admin SDK
 */
class User {
  /**
   * Create a new user in Firestore with profile information
   * @param {string} uid - Firebase Auth user ID
   * @param {Object} userData - User profile data
   * @returns {Promise<Object>} - Created user data
   */
  static async create(uid, userData) {
    try {
      console.log(`Creating user in Firestore with ID: ${uid}`);
      
      const newUser = {
        uid,
        name: userData.name || '',
        email: userData.email,
        gender: userData.gender || '',
        province: userData.province || '',
        country: userData.country || '',
        phone: userData.phone || '',
        role: userData.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await adminFirestore.collection('users').doc(uid).set(newUser);
      console.log(`User created successfully with ID: ${uid}`);
      return { id: uid, ...newUser };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Get user by Firebase Auth UID
   * @param {string} uid - Firebase Auth user ID
   * @returns {Promise<Object|null>} - User data or null if not found
   */
  static async getByUid(uid) {
    try {
      console.log(`Getting user with ID: ${uid}`);
      const userDoc = await adminFirestore.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        console.log(`User with ID ${uid} not found`);
        return null;
      }
      
      console.log(`User ${uid} found`);
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error(`Error getting user by UID ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User data or null if not found
   */
  static async getByEmail(email) {
    try {
      console.log(`Getting user with email: ${email}`);
      const snapshot = await adminFirestore.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        console.log(`User with email ${email} not found`);
        return null;
      }
      
      const userDoc = snapshot.docs[0];
      console.log(`User with email ${email} found`);
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error(`Error getting user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Update user profile information
   * @param {string} uid - Firebase Auth user ID
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} - Updated user data
   */
  static async update(uid, userData) {
    try {
      console.log(`Updating user with ID: ${uid}`);
      
      const updateData = {
        ...userData,
        updatedAt: new Date()
      };
      
      await adminFirestore.collection('users').doc(uid).update(updateData);
      console.log(`User ${uid} updated successfully`);
      
      // Get the updated user
      return this.getByUid(uid);
    } catch (error) {
      console.error(`Error updating user ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Get all users
   * @returns {Promise<Array>} - Array of all users
   */
  static async getAll() {
    try {
      console.log(`Getting all users`);
      const snapshot = await adminFirestore.collection('users').get();
      
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Found ${users.length} users`);
      
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Delete a user by ID
   * @param {string} uid - Firebase Auth user ID
   * @returns {Promise<void>}
   */
  static async delete(uid) {
    try {
      console.log(`Deleting user with ID: ${uid}`);
      await adminFirestore.collection('users').doc(uid).delete();
      console.log(`User ${uid} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting user ${uid}:`, error);
      throw error;
    }
  }
}

module.exports = User;