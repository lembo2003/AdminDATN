/**
 * Firebase utility functions for common operations
 */

const { firebase, firestore, adminFirestore } = require('../config/firebase');

/**
 * Convert Firestore document to object with ID
 * @param {FirebaseFirestore.DocumentSnapshot} doc - Firestore document
 * @returns {Object} Document data with ID
 */
const docToObject = (doc) => {
  if (!doc.exists) {
    return null;
  }
  
  return { id: doc.id, ...doc.data() };
};

/**
 * Convert Firestore timestamp to Date
 * @param {FirebaseFirestore.Timestamp} timestamp - Firestore timestamp
 * @returns {Date} JavaScript Date object
 */
const timestampToDate = (timestamp) => {
  if (!timestamp) {
    return null;
  }
  
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  return new Date(timestamp);
};

/**
 * Get documents from collection with optional query
 * @param {string} collectionName - Collection name
 * @param {Object} conditions - Query conditions
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of documents
 */
const getCollection = async (collectionName, conditions = {}, options = {}) => {
  try {
    let query = adminFirestore.collection(collectionName);
    
    // Apply conditions
    Object.entries(conditions).forEach(([field, value]) => {
      if (value !== undefined && value !== null) {
        query = query.where(field, '==', value);
      }
    });
    
    // Apply ordering
    if (options.orderBy) {
      const [field, direction = 'asc'] = Array.isArray(options.orderBy)
        ? options.orderBy
        : [options.orderBy, 'asc'];
      
      query = query.orderBy(field, direction);
    }
    
    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(docToObject);
  } catch (error) {
    console.error(`Error getting collection ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get document by ID
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document or null if not found
 */
const getDocument = async (collectionName, docId) => {
  try {
    const docRef = adminFirestore.collection(collectionName).doc(docId);
    const doc = await docRef.get();
    return docToObject(doc);
  } catch (error) {
    console.error(`Error getting document ${collectionName}/${docId}:`, error);
    throw error;
  }
};

/**
 * Create document in collection
 * @param {string} collectionName - Collection name
 * @param {Object} data - Document data
 * @param {string} docId - Optional document ID
 * @returns {Promise<Object>} Created document
 */
const createDocument = async (collectionName, data, docId = null) => {
  try {
    const docRef = docId
      ? adminFirestore.collection(collectionName).doc(docId)
      : adminFirestore.collection(collectionName).doc();
    
    // Add timestamps
    const docData = {
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await docRef.set(docData);
    
    // Get the created document
    const doc = await docRef.get();
    return docToObject(doc);
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Update document in collection
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @param {Object} data - Document data to update
 * @returns {Promise<Object>} Updated document
 */
const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = adminFirestore.collection(collectionName).doc(docId);
    
    // Add updated timestamp
    const updateData = {
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await docRef.update(updateData);
    
    // Get the updated document
    const doc = await docRef.get();
    return docToObject(doc);
  } catch (error) {
    console.error(`Error updating document ${collectionName}/${docId}:`, error);
    throw error;
  }
};

/**
 * Delete document from collection
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<boolean>} Success status
 */
const deleteDocument = async (collectionName, docId) => {
  try {
    await adminFirestore.collection(collectionName).doc(docId).delete();
    return true;
  } catch (error) {
    console.error(`Error deleting document ${collectionName}/${docId}:`, error);
    throw error;
  }
};

/**
 * Create a batch operation
 * @returns {FirebaseFirestore.WriteBatch} Firebase batch
 */
const createBatch = () => {
  return adminFirestore.batch();
};

/**
 * Execute a transaction
 * @param {Function} transactionCallback - Transaction callback
 * @returns {Promise<any>} Transaction result
 */
const runTransaction = async (transactionCallback) => {
  return adminFirestore.runTransaction(transactionCallback);
};

module.exports = {
  docToObject,
  timestampToDate,
  getCollection,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  createBatch,
  runTransaction
};