/**
 * Hotel Management System
 * Main JavaScript file for common functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // Auto-hide flash messages after 5 seconds
  setTimeout(function() {
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(function(message) {
      const closeBtn = message.querySelector('.btn-close');
      if (closeBtn) {
        closeBtn.click();
      }
    });
  }, 5000);
  
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function(tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Initialize popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function(popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
  
  // Active link highlighting
  const currentLocation = window.location.pathname;
  const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
  
  navLinks.forEach(function(link) {
    const href = link.getAttribute('href');
    
    if (href === currentLocation || 
        (href !== '/' && currentLocation.startsWith(href))) {
      link.classList.add('active');
    }
  });
  
  // Date inputs - Set min date to today
  const dateInputs = document.querySelectorAll('input[type="date"]');
  const today = new Date().toISOString().split('T')[0];
  
  dateInputs.forEach(function(input) {
    if (!input.min) {
      input.min = today;
    }
  });
  
  // Form validation
  const forms = document.querySelectorAll('.needs-validation');
  
  Array.from(forms).forEach(function(form) {
    form.addEventListener('submit', function(event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      
      form.classList.add('was-validated');
    }, false);
  });
  
  // QR Code Scanner
  initQRScanner();
});

/**
 * Initialize QR Code Scanner if element exists
 */
function initQRScanner() {
  const scannerContainer = document.getElementById('qr-scanner');
  
  if (scannerContainer && typeof Html5Qrcode !== 'undefined') {
    const html5QrCode = new Html5Qrcode("qr-scanner");
    const qrResultElement = document.getElementById('qr-result');
    const scanButton = document.getElementById('scan-button');
    const stopButton = document.getElementById('stop-button');
    
    if (scanButton) {
      scanButton.addEventListener('click', function() {
        const config = { fps: 10, qrbox: 250 };
        
        html5QrCode.start(
          { facingMode: "environment" },
          config,
          function(decodedText, decodedResult) {
            // QR code detected
            html5QrCode.stop();
            
            if (qrResultElement) {
              qrResultElement.textContent = decodedText;
            }
            
            // Send to server for verification
            verifyQRCode(decodedText);
          },
          function(errorMessage) {
            // Error or QR code not detected
            console.log(errorMessage);
          }
        );
        
        this.style.display = 'none';
        if (stopButton) {
          stopButton.style.display = 'block';
        }
      });
    }
    
    if (stopButton) {
      stopButton.addEventListener('click', function() {
        html5QrCode.stop();
        this.style.display = 'none';
        if (scanButton) {
          scanButton.style.display = 'block';
        }
      });
    }
  }
}

/**
 * Verify QR Code with server
 * @param {string} qrData - QR code data to verify
 */
function verifyQRCode(qrData) {
  fetch('/bookings/verify-qr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ qrData })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('QR code verified successfully!', 'success');
      
      // Redirect to booking details
      window.location.href = `/bookings/confirmation/${data.booking.id}`;
    } else {
      showAlert(data.error || 'Invalid QR code', 'danger');
    }
  })
  .catch(error => {
    console.error('Error verifying QR code:', error);
    showAlert('Error verifying QR code', 'danger');
  });
}

/**
 * Show alert message
 * @param {string} message - Alert message
 * @param {string} type - Alert type (success, danger, warning, info)
 */
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alert-container');
  
  if (!alertContainer) {
    return;
  }
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.appendChild(alert);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alert);
    bsAlert.close();
  }, 5000);
}

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate nights between two dates
 * @param {Date|string} checkIn - Check-in date
 * @param {Date|string} checkOut - Check-out date
 * @returns {number} Number of nights
 */
function calculateNights(checkIn, checkOut) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}
