const { adminFirestore } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const amenitiesCollection = adminFirestore.collection('amenities');

class Amenity {
    /**
     * Create a new amenity
     * @param {Object} amenityData - Amenity data
     * @returns {Promise<Object>} - Created amenity
     */
    static async create(amenityData) {
        const amenityId = amenityData.amenityId || `amenity_${uuidv4()}`;

        const newAmenity = {
            amenityId,
            name: amenityData.name,
            icon: amenityData.icon || 'fas fa-check',
            description: amenityData.description || '',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await amenitiesCollection.doc(amenityId).set(newAmenity);
        return { id: amenityId, ...newAmenity };
    }

    /**
     * Get an amenity by ID
     * @param {string} amenityId - Amenity ID
     * @returns {Promise<Object|null>} - Amenity data
     */
    static async getById(amenityId) {
        const amenityDoc = await amenitiesCollection.doc(amenityId).get();

        if (!amenityDoc.exists) {
            return null;
        }

        return { id: amenityDoc.id, ...amenityDoc.data() };
    }

    /**
     * Get multiple amenities by IDs
     * @param {Array<string>} amenityIds - Array of amenity IDs
     * @returns {Promise<Array>} - Array of amenities
     */
    static async getByIds(amenityIds) {
        if (!amenityIds || amenityIds.length === 0) {
            return [];
        }

        const amenities = [];

        for (const amenityId of amenityIds) {
            const amenity = await this.getById(amenityId);
            if (amenity) {
                amenities.push(amenity);
            }
        }

        return amenities;
    }

    /**
     * Get all amenities
     * @returns {Promise<Array>} - Array of amenities
     */
    static async getAll() {
        const snapshot = await amenitiesCollection.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Update an amenity
     * @param {string} amenityId - Amenity ID
     * @param {Object} amenityData - Amenity data to update
     * @returns {Promise<Object>} - Updated amenity
     */
    static async update(amenityId, amenityData) {
        const updateData = {
            ...amenityData,
            updatedAt: new Date()
        };

        await amenitiesCollection.doc(amenityId).update(updateData);
        return this.getById(amenityId);
    }

    /**
     * Delete an amenity
     * @param {string} amenityId - Amenity ID to delete
     * @returns {Promise<void>}
     */
    static async delete(amenityId) {
        await amenitiesCollection.doc(amenityId).delete();
    }
}

module.exports = Amenity;