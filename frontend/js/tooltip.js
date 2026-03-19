// ── Tooltip Viewport Collision Detection ──────────────────────────────────
function initTooltipCollisionDetection() {
  const VIEWPORT_GUTTER = 12;
  const DEFAULT_TOOLTIP_WIDTH = 260;
  const DEFAULT_TOOLTIP_HEIGHT = 80;

  function positionTooltip(icon) {
    const rect = icon.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = Math.min(DEFAULT_TOOLTIP_WIDTH, Math.max(180, viewportWidth - (VIEWPORT_GUTTER * 2)));
    const gap = 8;

    let tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    let tooltipTop = rect.top - gap - DEFAULT_TOOLTIP_HEIGHT;

    if (tooltipLeft < VIEWPORT_GUTTER) {
      tooltipLeft = VIEWPORT_GUTTER;
      icon.classList.add('tooltip-left');
    } else if (tooltipLeft + tooltipWidth > viewportWidth - VIEWPORT_GUTTER) {
      tooltipLeft = viewportWidth - VIEWPORT_GUTTER - tooltipWidth;
      icon.classList.add('tooltip-right');
    } else {
      icon.classList.remove('tooltip-left', 'tooltip-right');
    }

    if (tooltipTop < VIEWPORT_GUTTER) {
      tooltipTop = Math.min(rect.bottom + gap, viewportHeight - DEFAULT_TOOLTIP_HEIGHT - VIEWPORT_GUTTER);
      icon.classList.add('tooltip-below');
    } else {
      icon.classList.remove('tooltip-below');
    }

    icon.style.setProperty('--tooltip-left', `${tooltipLeft}px`);
    icon.style.setProperty('--tooltip-top', `${tooltipTop}px`);
  }

  function clearTooltip(icon) {
    icon.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-below', 'tooltip-open');
    icon.style.removeProperty('--tooltip-left');
    icon.style.removeProperty('--tooltip-top');
  }

  // Add mouseenter listener to all help icons with titles
  document.querySelectorAll('.help-icon[title]').forEach(icon => {
    icon.addEventListener('mouseenter', function() {
      // Small delay to let CSS tooltip render
      setTimeout(() => {
        positionTooltip(this);
      }, 10);
    });

    icon.addEventListener('focus', function() {
      this.classList.add('tooltip-open');
      setTimeout(() => positionTooltip(this), 10);
    });

    icon.addEventListener('click', function(event) {
      if (window.matchMedia('(hover: none)').matches) {
        event.preventDefault();
        this.classList.toggle('tooltip-open');
        if (this.classList.contains('tooltip-open')) {
          positionTooltip(this);
        } else {
          clearTooltip(this);
        }
      }
    });
    
    icon.addEventListener('mouseleave', function() {
      clearTooltip(this);
    });

    icon.addEventListener('blur', function() {
      clearTooltip(this);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.help-icon[title]')) {
      document.querySelectorAll('.help-icon.tooltip-open').forEach(clearTooltip);
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initTooltipCollisionDetection);
