/**
 * Special fix specifically for room type delete modals
 */
document.addEventListener('DOMContentLoaded', function() {
    // Get all delete buttons
    const deleteButtons = document.querySelectorAll('[data-bs-toggle="modal"][data-bs-target^="#deleteModal"]');
    
    // Remove Bootstrap's default modal behavior and implement our own
    deleteButtons.forEach(button => {
      // Remove the default data-bs-toggle attribute
      button.removeAttribute('data-bs-toggle');
      
      // Add our custom click handler
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get the target modal ID and find the modal
        const modalId = this.getAttribute('data-bs-target');
        const modal = document.querySelector(modalId);
        
        // If modal exists, manually show it
        if (modal) {
          // Create and store the Bootstrap modal instance
          if (!modal._bsModal) {
            modal._bsModal = new bootstrap.Modal(modal, {
              backdrop: 'static',
              keyboard: false
            });
          }
          
          // Show the modal
          modal._bsModal.show();
        }
      });
    });
    
    // Fix form submission in modals
    document.querySelectorAll('.modal form').forEach(form => {
      form.addEventListener('submit', function(e) {
        e.stopPropagation();
      });
    });
    
    // Fix modal backdrop issues
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('shown.bs.modal', function() {
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          backdrop.style.pointerEvents = 'none';
        }
      });
    });
  });