/**
 * Account Restriction Page JavaScript
 * Provides a live countdown timer for suspension duration
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if we have a suspension end time element
    const suspensionEndElement = document.getElementById('suspension-end-time');
    if (!suspensionEndElement) return;
    
    // Get the suspension end timestamp from the data attribute
    const suspensionEndTimestamp = suspensionEndElement.getAttribute('data-end-time');
    if (!suspensionEndTimestamp) return;
    
    // Parse the timestamp
    const suspensionEndDate = new Date(parseInt(suspensionEndTimestamp));
    const countdownElement = document.getElementById('suspension-countdown');
    
    // Countdown timer update function
    function updateCountdown() {
      const now = new Date();
      const timeRemaining = suspensionEndDate - now;
      
      // If time has expired, reload page for automatic account activation
      if (timeRemaining <= 0) {
        location.reload();
        return;
      }
      
      // Calculate time units
      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      
      // Update the countdown display
      document.getElementById('countdown-days').textContent = days;
      document.getElementById('countdown-hours').textContent = hours.toString().padStart(2, '0');
      document.getElementById('countdown-minutes').textContent = minutes.toString().padStart(2, '0');
      document.getElementById('countdown-seconds').textContent = seconds.toString().padStart(2, '0');
      
      // Show the countdown element if it was hidden
      if (countdownElement.classList.contains('d-none')) {
        countdownElement.classList.remove('d-none');
      }
    }
    
    // Update immediately
    updateCountdown();
    
    // Update every second
    setInterval(updateCountdown, 1000);
    
    // Setup collapsible FAQ sections
    const faqToggles = document.querySelectorAll('.faq-toggle');
    faqToggles.forEach(toggle => {
      toggle.addEventListener('click', function() {
        const faqItem = this.closest('.faq-item');
        const faqAnswer = faqItem.querySelector('.faq-answer');
        const icon = this.querySelector('i');
        
        // Toggle the answer visibility
        if (faqAnswer.style.maxHeight) {
          faqAnswer.style.maxHeight = null;
          icon.classList.remove('fa-minus');
          icon.classList.add('fa-plus');
        } else {
          faqAnswer.style.maxHeight = faqAnswer.scrollHeight + "px";
          icon.classList.remove('fa-plus');
          icon.classList.add('fa-minus');
        }
      });
    });
  });