/**
 * Common utility functions for the hotel management system
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string to generate
 * @returns {string} Random string
 */
const generateRandomString = (length = 8) => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Calculate nights between two dates
 * @param {Date|string} checkIn - Check-in date
 * @param {Date|string} checkOut - Check-out date
 * @returns {number} Number of nights
 */
const calculateNights = (checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

/**
 * Save uploaded file to local storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Name of the file
 * @param {string} directory - Directory to save the file
 * @returns {Promise<string>} File URL
 */
const saveFile = async (fileBuffer, fileName, directory = 'uploads') => {
  try {
    // Ensure directory exists
    const dir = path.join(__dirname, '../public', directory);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${generateRandomString(6)}-${fileName}`;
    const filePath = path.join(dir, uniqueFilename);
    
    // Save file
    fs.writeFileSync(filePath, fileBuffer);
    
    // Return public URL
    return `/${directory}/${uniqueFilename}`;
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error('Failed to save file');
  }
};

/**
 * Delete file from local storage
 * @param {string} fileUrl - URL of the file to delete
 * @returns {Promise<boolean>} Success status
 */
const deleteFile = async (fileUrl) => {
  try {
    if (!fileUrl || !fileUrl.startsWith('/')) {
      return false;
    }
    
    const filePath = path.join(__dirname, '../public', fileUrl);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Paginate array of items
 * @param {Array} items - Array of items to paginate
 * @param {number} page - Current page
 * @param {number} perPage - Items per page
 * @returns {Object} Pagination result
 */
const paginate = (items, page = 1, perPage = 10) => {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / perPage);
  
  const currentPage = parseInt(page) || 1;
  const offset = (currentPage - 1) * perPage;
  
  const paginatedItems = items.slice(offset, offset + perPage);
  
  return {
    items: paginatedItems,
    page: currentPage,
    perPage,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency
 */
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
};

/**
 * Format phone number
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhone = (phone) => {
  if (!phone) return '';
  
  // Remove non-numeric characters
  const cleaned = ('' + phone).replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};

/**
 * Sanitize HTML content
 * @param {string} content - HTML content to sanitize
 * @returns {string} Sanitized HTML
 */
const sanitizeHtml = (content) => {
  if (!content) return '';
  
  // Basic sanitization - replace HTML tags
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

module.exports = {
  generateRandomString,
  formatDate,
  calculateNights,
  saveFile,
  deleteFile,
  paginate,
  formatCurrency,
  formatPhone,
  sanitizeHtml
};