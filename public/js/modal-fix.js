/**
 * Complete solution for modal flickering issues
 */
document.addEventListener('DOMContentLoaded', function() {
    // ====== MODAL FIX ======
    // Remove standard bootstrap modal behavior for delete buttons
    document.querySelectorAll('button[data-bs-toggle="modal"]').forEach(button => {
      // Store the target
      const target = button.getAttribute('data-bs-target');
      
      // Remove the bootstrap attributes
      button.removeAttribute('data-bs-toggle');
      button.removeAttribute('data-bs-target');
      
      // Add our custom click handler
      button.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Get the modal
        const modal = document.querySelector(target);
        if (modal) {
          // Create a bootstrap modal instance if it doesn't exist
          if (!window.modalInstances) {
            window.modalInstances = {};
          }
          
          if (!window.modalInstances[target]) {
            window.modalInstances[target] = new bootstrap.Modal(modal, {
              backdrop: 'static',
              keyboard: false
            });
          }
          
          // Show the modal
          window.modalInstances[target].show();
        }
      });
    });
    
    // Ensure cancel buttons work properly
    document.querySelectorAll('.modal .btn-secondary').forEach(button => {
      button.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Find the closest modal
        const modal = button.closest('.modal');
        if (modal) {
          const modalId = '#' + modal.id;
          if (window.modalInstances && window.modalInstances[modalId]) {
            window.modalInstances[modalId].hide();
          }
        }
      });
    });
    
    // Make sure form submissions don't cause issues
    document.querySelectorAll('.modal form').forEach(form => {
      form.addEventListener('submit', function(event) {
        event.stopPropagation();
      });
    });
    
    // Prevent modal backdrop clicks from closing
    document.addEventListener('click', function(event) {
      if (event.target.classList.contains('modal')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    
    // Add custom CSS to fix modals
    const style = document.createElement('style');
    style.textContent = `
      .modal-backdrop { pointer-events: none !important; }
      .modal-dialog { pointer-events: all !important; }
      .modal-static { transform: none !important; }
    `;
    document.head.appendChild(style);
  });