const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const staffCollection = adminFirestore.collection('staff');

class Staff {
  /**
   * Create a new staff member
   * @param {Object} staffData - Staff data
   * @param {Object|null} imageFile - Uploaded image file object
   * @returns {Promise<Object>} - Created staff
   */
  static async create(staffData, imageFile = null) {
    const staffId = `staff_${uuidv4()}`;

    let imageUrl = '';

    // Handle image upload to local storage
    if (imageFile) {
      const uploadDir = path.join(__dirname, '../public/uploads/staff');

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
      const filepath = path.join(uploadDir, filename);

      // Write the file to disk
      fs.writeFileSync(filepath, imageFile);

      imageUrl = `/uploads/staff/${filename}`;
    } else if (staffData.imageUrl) {
      imageUrl = staffData.imageUrl;
    }

    const newStaff = {
      staffId,
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone || '',
      position: staffData.position || '',
      department: staffData.department || '',
      imageUrl,
      isActive: staffData.isActive !== false,

      // Employee specific details
      employeeId: staffData.employeeId || '',
      joinDate: staffData.joinDate ? new Date(staffData.joinDate) : new Date(),
      emergencyContact: staffData.emergencyContact || '',
      notes: staffData.notes || '',

      createdAt: new Date(),
      updatedAt: new Date()
    };

    await staffCollection.doc(staffId).set(newStaff);
    return { id: staffId, ...newStaff };
  }

  /**
   * Get a staff member by ID
   * @param {string} staffId - Staff ID
   * @returns {Promise<Object|null>} - Staff data
   */
  static async getById(staffId) {
    const staffDoc = await staffCollection.doc(staffId).get();

    if (!staffDoc.exists) {
      return null;
    }

    return { id: staffDoc.id, ...staffDoc.data() };
  }

  /**
   * Get all staff members with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} - Array of staff members
   */
  static async getAll(filters = {}) {
    let query = staffCollection;

    // Apply filters
    if (filters.department) {
      query = query.where('department', '==', filters.department);
    }

    if (filters.position) {
      query = query.where('position', '==', filters.position);
    }

    if (filters.isActive !== undefined) {
      query = query.where('isActive', '==', filters.isActive);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Update a staff member
   * @param {string} staffId - Staff ID
   * @param {Object} staffData - Staff data to update
   * @param {Object|null} imageFile - New image file
   * @returns {Promise<Object>} - Updated staff
   */
  static async update(staffId, staffData, imageFile = null) {
    const staffDoc = await staffCollection.doc(staffId).get();

    if (!staffDoc.exists) {
      throw new Error('Staff member not found');
    }

    let imageUrl = staffDoc.data().imageUrl;

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
      const uploadDir = path.join(__dirname, '../public/uploads/staff');

      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Generate a unique filename
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
      const filepath = path.join(uploadDir, filename);

      // Write the file to disk
      fs.writeFileSync(filepath, imageFile);

      imageUrl = `/uploads/staff/${filename}`;
    } else if (staffData.imageUrl) {
      imageUrl = staffData.imageUrl;
    }

    // Prepare update data object with only the fields we want to update
    const updateData = {
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone || '',
      position: staffData.position || '',
      department: staffData.department || '',
      imageUrl,
      isActive: staffData.isActive !== false,

      // Employee specific details (handle null/undefined cases)
      employeeId: staffData.employeeId || staffDoc.data().employeeId || '',
      emergencyContact: staffData.emergencyContact || staffDoc.data().emergencyContact || '',
      notes: staffData.notes || staffDoc.data().notes || '',

      updatedAt: new Date()
    };

    // Only add joinDate if it exists in staffData or in the existing document
    if (staffData.joinDate) {
      updateData.joinDate = new Date(staffData.joinDate);
    } else if (staffDoc.data().joinDate) {
      // Use existing joinDate from document
      updateData.joinDate = staffDoc.data().joinDate;
    }

    await staffCollection.doc(staffId).update(updateData);
    return this.getById(staffId);
  }

  /**
   * Delete a staff member
   * @param {string} staffId - Staff ID to delete
   * @returns {Promise<void>}
   */
  static async delete(staffId) {
    // Get the staff first to get image URL
    const staff = await this.getById(staffId);

    if (staff && staff.imageUrl && staff.imageUrl.startsWith('/uploads/')) {
      // Delete image file
      const imagePath = path.join(__dirname, '../public', staff.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the staff
    await staffCollection.doc(staffId).delete();
  }

  /**
   * Get available staff for delivery
   * @returns {Promise<Array>} - Array of active staff members
   */
  static async getAvailableForDelivery() {
    const snapshot = await staffCollection
      .where('isActive', '==', true)
      .where('department', '==', 'Room Service')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

module.exports = Staff;