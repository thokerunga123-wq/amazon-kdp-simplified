/**
 * Amazon KDP Simplified - Main App Interactions & Utilities
 * Instructor: Thokerunga Innocent
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initFaqAccordions();
  initDynamicLinks();
  initFooterYear();
});

/**
 * Mobile Navigation Drawer Toggle
 */
function initMobileNav() {
  const hamburgerBtn = document.querySelector('.hamburger-btn');
  const mobileDrawer = document.querySelector('.mobile-nav-drawer');

  if (hamburgerBtn && mobileDrawer) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileDrawer.classList.toggle('open');
      const isOpen = mobileDrawer.classList.contains('open');
      hamburgerBtn.setAttribute('aria-expanded', isOpen);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!mobileDrawer.contains(e.target) && !hamburgerBtn.contains(e.target)) {
        mobileDrawer.classList.remove('open');
      }
    });

    // Close when clicking any nav link
    mobileDrawer.querySelectorAll('.nav-link, .btn').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
      });
    });
  }
}

/**
 * FAQ Accordion Toggle
 */
function initFaqAccordions() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close all others
        faqItems.forEach(other => other.classList.remove('open'));
        // Toggle clicked
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });
}

/**
 * Dynamically attach configured URLs (Selar, WhatsApp) to CTA buttons
 */
function initDynamicLinks() {
  if (typeof APP_CONFIG === 'undefined') return;

  // Selar checkout buttons
  document.querySelectorAll('.btn-enroll, .selar-checkout-btn').forEach(btn => {
    if (btn.tagName === 'A' && (!btn.getAttribute('href') || btn.getAttribute('href') === '#')) {
      btn.href = APP_CONFIG.SELAR_CHECKOUT_URL;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
    }
  });

  // WhatsApp support buttons
  document.querySelectorAll('.btn-whatsapp, .whatsapp-support-link').forEach(btn => {
    if (btn.tagName === 'A' && (!btn.getAttribute('href') || btn.getAttribute('href') === '#')) {
      btn.href = APP_CONFIG.WHATSAPP_SUPPORT_URL;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
    }
  });
}

/**
 * Set current year in footer
 */
function initFooterYear() {
  const yearEls = document.querySelectorAll('.current-year');
  const currentYear = new Date().getFullYear();
  yearEls.forEach(el => {
    el.textContent = currentYear;
  });
}

/**
 * Global Toast Notification
 */
function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * Modal Helper
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}
