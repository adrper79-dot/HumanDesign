// ── Tooltip Viewport Collision Detection ──────────────────────────────────
function initTooltipCollisionDetection() {
  // Add mouseenter listener to all help icons with titles
  document.querySelectorAll('.help-icon[title]').forEach(icon => {
    icon.addEventListener('mouseenter', function(e) {
      // Small delay to let CSS tooltip render
      setTimeout(() => {
        const rect = this.getBoundingClientRect();
        const tooltipWidth = 260; // From CSS
        const tooltipHeight = 80; // Approximate with padding
        const gap = 8;
        
        // Calculate initial position (centered above)
        let tooltipLeft = rect.left + rect.width/2 - tooltipWidth/2;
        let tooltipTop = rect.top - gap - tooltipHeight;
        
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };
        
        // Check horizontal collision and adjust
        if (tooltipLeft < 10) {
          // Too far left, shift right
          tooltipLeft = 10;
          this.classList.add('tooltip-left');
        } else if (tooltipLeft + tooltipWidth > viewport.width - 10) {
          // Too far right, shift left
          tooltipLeft = viewport.width - 10 - tooltipWidth;
          this.classList.add('tooltip-right');
        } else {
          this.classList.remove('tooltip-left', 'tooltip-right');
        }
        
        // Check vertical collision (switch to below if needed)
        if (tooltipTop < 10) {
          // Switch to below the icon
          tooltipTop = rect.bottom + gap;
          this.classList.add('tooltip-below');
        } else {
          this.classList.remove('tooltip-below');
        }
        
        // Apply calculated position
        this.style.setProperty('--tooltip-left', `${tooltipLeft}px`);
        this.style.setProperty('--tooltip-top', `${tooltipTop}px`);
      }, 10);
    });
    
    icon.addEventListener('mouseleave', function() {
      this.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-below');
      this.style.removeProperty('--tooltip-left');
      this.style.removeProperty('--tooltip-top');
    });
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initTooltipCollisionDetection);
