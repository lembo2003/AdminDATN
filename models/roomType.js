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
      
      // Price structure for different booking types
      pricing: {
        // Standard daily rate
        daily: parseFloat(roomTypeData.dailyPrice) || 0,
        
        // Hourly rates
        hourly: {
          basePrice: parseFloat(roomTypeData.hourlyBasePrice) || 0,
          additionalHourPrice: parseFloat(roomTypeData.hourlyAdditionalPrice) || 0
        },
        
        // Overnight rate (typically evening to morning)
        overnight: parseFloat(roomTypeData.overnightPrice) || 0,
        
        // Day use rate (no overnight stay)
        dayUse: parseFloat(roomTypeData.dayUsePrice) || 0,
        
        // Extended stay discounts
        weekly: parseFloat(roomTypeData.weeklyPrice) || 0,
        monthly: parseFloat(roomTypeData.monthlyPrice) || 0
      },
      
      // Minimum stay requirements
      minimumStay: {
        daily: parseInt(roomTypeData.minimumStayDaily) || 1,
        weekly: parseInt(roomTypeData.minimumStayWeekly) || 7,
        monthly: parseInt(roomTypeData.minimumStayMonthly) || 28
      },
      
      // Late checkout fees
      lateCheckoutFee: parseFloat(roomTypeData.lateCheckoutFee) || 0,
      
      // Maximum capacity
      capacity: parseInt(roomTypeData.capacity) || 2,
      
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
    // Get current room type to retain any fields not provided in the update
    const currentRoomType = await this.getById(roomTypeId);
    
    if (!currentRoomType) {
      throw new Error('Room type not found');
    }
    
    const updateData = {
      roomTypeName: roomTypeData.roomTypeName || currentRoomType.roomTypeName,
      description: roomTypeData.description || currentRoomType.description,
      
      // Update pricing structure
      pricing: {
        daily: parseFloat(roomTypeData.dailyPrice) || currentRoomType.pricing?.daily || 0,
        
        hourly: {
          basePrice: parseFloat(roomTypeData.hourlyBasePrice) || currentRoomType.pricing?.hourly?.basePrice || 0,
          additionalHourPrice: parseFloat(roomTypeData.hourlyAdditionalPrice) || currentRoomType.pricing?.hourly?.additionalHourPrice || 0
        },
        
        overnight: parseFloat(roomTypeData.overnightPrice) || currentRoomType.pricing?.overnight || 0,
        dayUse: parseFloat(roomTypeData.dayUsePrice) || currentRoomType.pricing?.dayUse || 0,
        weekly: parseFloat(roomTypeData.weeklyPrice) || currentRoomType.pricing?.weekly || 0,
        monthly: parseFloat(roomTypeData.monthlyPrice) || currentRoomType.pricing?.monthly || 0
      },
      
      // Update minimum stay requirements
      minimumStay: {
        daily: parseInt(roomTypeData.minimumStayDaily) || currentRoomType.minimumStay?.daily || 1,
        weekly: parseInt(roomTypeData.minimumStayWeekly) || currentRoomType.minimumStay?.weekly || 7,
        monthly: parseInt(roomTypeData.minimumStayMonthly) || currentRoomType.minimumStay?.monthly || 28
      },
      
      lateCheckoutFee: parseFloat(roomTypeData.lateCheckoutFee) || currentRoomType.lateCheckoutFee || 0,
      capacity: parseInt(roomTypeData.capacity) || currentRoomType.capacity || 2,
      
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
  
  /**
   * Calculate price for room type based on booking parameters
   * @param {string} roomTypeId - Room type ID
   * @param {string} bookingType - Type of booking (hourly, overnight, daily, dayUse, weekly, monthly)
   * @param {Date} checkInDate - Check-in date and time
   * @param {Date} checkOutDate - Check-out date and time
   * @returns {Promise<number>} - Calculated price
   */
  static async calculatePrice(roomTypeId, bookingType, checkInDate, checkOutDate) {
    const roomType = await this.getById(roomTypeId);
    
    if (!roomType) {
      throw new Error('Room type not found');
    }
    
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    // Ensure valid date range
    if (checkOut <= checkIn) {
      throw new Error('Check-out date must be after check-in date');
    }
    
    const pricing = roomType.pricing;
    let price = 0;
    
    switch(bookingType) {
      case 'hourly':
        // Calculate hours between check-in and check-out
        const hours = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60));
        
        if (hours <= 1) {
          price = pricing.hourly.basePrice;
        } else {
          price = pricing.hourly.basePrice + (pricing.hourly.additionalHourPrice * (hours - 1));
        }
        break;
        
      case 'overnight':
        // Fixed price for overnight stay
        price = pricing.overnight;
        break;
        
      case 'dayUse':
        // Fixed price for day use
        price = pricing.dayUse;
        break;
        
      case 'weekly':
        // Calculate weeks, round up
        const weeks = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24 * 7));
        price = pricing.weekly * weeks;
        break;
        
      case 'monthly':
        // Calculate months, round up
        const months = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24 * 30));
        price = pricing.monthly * months;
        break;
        
      case 'daily':
      default:
        // Calculate days, round up
        const days = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        price = pricing.daily * days;
    }
    
    return price;
  }
}

module.exports = RoomType;