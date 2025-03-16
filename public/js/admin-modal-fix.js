/**
 * Comprehensive fix for modal flickering issues in admin pages
 */
document.addEventListener('DOMContentLoaded', function() {
  // Fix for delete modals
  const fixDeleteModals = () => {
    // Apply static backdrop behavior to all modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(function(modal) {
      modal.setAttribute('data-bs-backdrop', 'static');
      modal.setAttribute('data-bs-keyboard', 'false');
    });

    // Fix the button to trigger modals properly
    const deleteButtons = document.querySelectorAll('[data-bs-toggle="modal"]');
    deleteButtons.forEach(button => {
      // Remove existing event listener to avoid duplicates
      button.removeEventListener('click', handleDeleteButtonClick);
      // Add new event listener
      button.addEventListener('click', handleDeleteButtonClick);
    });

    // Ensure modal forms have proper styling
    const modalForms = document.querySelectorAll('.modal form');
    modalForms.forEach(form => {
      form.style.display = 'inline';
      form.style.margin = '0';
    });
  };

  // Handler for delete button click
  const handleDeleteButtonClick = (e) => {
    e.stopPropagation();
    const targetModalId = e.currentTarget.getAttribute('data-bs-target');
    const targetModal = document.querySelector(targetModalId);
    
    if (targetModal) {
      const modalInstance = new bootstrap.Modal(targetModal);
      modalInstance.show();
    }
  };

  // Apply initial fix
  fixDeleteModals();

  // Optional: Re-apply fix when content might change dynamically
  const observer = new MutationObserver(fixDeleteModals);
  observer.observe(document.body, { childList: true, subtree: true });
});