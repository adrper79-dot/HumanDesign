/**
 * Prime Self — Embeddable Chart Calculator Widget
 * 
 * Usage:
 * <div id="primeself-widget"></div>
 * <script src="https://primeself.app/embed.js"></script>
 * <script>
 *   PrimeSelf.init({
 *     elementId: 'primeself-widget',
 *     theme: 'dark', // or 'light'
 *     accentColor: '#c9a84c',
 *     hideAttribution: false, // Set to true for Practitioner tier+
 *     width: '100%',
 *     apiEndpoint: 'https://primeself.app/api'
 *   });
 * </script>
 */

(function(window, document) {
  'use strict';

  const PrimeSelf = {
    version: '1.0.0',
    instances: [],

    /**
     * Initialize widget
     * @param {Object} options - Configuration options
     */
    init: function(options) {
      const config = {
        elementId: options.elementId || 'primeself-widget',
        theme: options.theme || 'dark',
        accentColor: options.accentColor || '#c9a84c',
        hideAttribution: options.hideAttribution || false,
        width: options.width || '100%',
        height: options.height || '600px',
        apiEndpoint: options.apiEndpoint || 'https://primeself.app/api',
        onChartCalculated: options.onChartCalculated || null,
        onError: options.onError || null,
      };

      const container = document.getElementById(config.elementId);
      
      if (!container) {
        console.error(`PrimeSelf: Element with id "${config.elementId}" not found`);
        return null;
      }

      // Build iframe URL with parameters
      const params = new URLSearchParams({
        theme: config.theme,
        accent: config.accentColor,
        hideAttribution: config.hideAttribution.toString(),
        apiEndpoint: config.apiEndpoint,
      });

      const iframeUrl = `https://primeself.app/embed.html?${params.toString()}`;

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.style.width = config.width;
      iframe.style.height = config.height;
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.style.borderRadius = '12px';
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('title', 'Prime Self Chart Calculator');

      // Clear container and append iframe
      container.innerHTML = '';
      container.appendChild(iframe);

      // Create instance object
      const instance = {
        config: config,
        container: container,
        iframe: iframe,
        chartData: null,
      };

      // Store instance
      this.instances.push(instance);

      // Setup message listener for this instance
      this._setupMessageListener(instance);

      return instance;
    },

    /**
     * Setup postMessage listener for iframe communication
     * @private
     */
    _setupMessageListener: function(instance) {
      // BL-R-M18: Strict origin validation — only accept from exact primeself.app or localhost origins
      const ALLOWED_ORIGINS = new Set(['https://primeself.app', 'http://localhost:3000', 'http://localhost:8787']);

      // BL-R-L1: Store handler reference so destroy() can remove it and avoid listener leak
      instance._messageHandler = function(event) {
        if (!ALLOWED_ORIGINS.has(event.origin)) {
          return;
        }

        const message = event.data;

        // Handle resize messages
        if (message.type === 'primeself-resize' && message.height) {
          instance.iframe.style.height = message.height + 'px';
        }

        // Handle chart calculation complete
        if (message.type === 'primeself-chart-calculated' && message.data) {
          instance.chartData = message.data;
          
          if (instance.config.onChartCalculated) {
            instance.config.onChartCalculated(message.data);
          }
        }

        // Handle open full chart request
        if (message.type === 'primeself-open-chart' && message.url) {
          window.open(message.url, '_blank');
        }

        // Handle errors
        if (message.type === 'primeself-error' && message.error) {
          console.error('PrimeSelf widget error:', message.error);
          
          if (instance.config.onError) {
            instance.config.onError(message.error);
          }
        }
      };

      window.addEventListener('message', instance._messageHandler);
    },

    /**
     * Get chart data from a widget instance
     * @param {string} elementId - Container element ID
     * @returns {Object|null} Chart data or null
     */
    getChartData: function(elementId) {
      const instance = this.instances.find(inst => inst.config.elementId === elementId);
      return instance ? instance.chartData : null;
    },

    /**
     * Destroy a widget instance
     * @param {string} elementId - Container element ID
     */
    destroy: function(elementId) {
      const index = this.instances.findIndex(inst => inst.config.elementId === elementId);
      
      if (index !== -1) {
        const instance = this.instances[index];
        // BL-R-L1: Remove the message listener to avoid unbounded listener accumulation
        if (instance._messageHandler) {
          window.removeEventListener('message', instance._messageHandler);
        }
        instance.container.innerHTML = '';
        this.instances.splice(index, 1);
      }
    },

    /**
     * Destroy all widget instances
     */
    destroyAll: function() {
      this.instances.forEach(instance => {
        // BL-R-L1: Remove each instance's message listener before clearing
        if (instance._messageHandler) {
          window.removeEventListener('message', instance._messageHandler);
        }
        instance.container.innerHTML = '';
      });
      this.instances = [];
    },
  };

  // Expose to global scope
  window.PrimeSelf = PrimeSelf;

  // Auto-initialize if data attribute is present
  document.addEventListener('DOMContentLoaded', function() {
    const autoInitElements = document.querySelectorAll('[data-primeself-widget]');
    
    autoInitElements.forEach(function(element) {
      const config = {
        elementId: element.id || 'primeself-widget-' + Date.now(),
        theme: element.getAttribute('data-theme') || 'dark',
        accentColor: element.getAttribute('data-accent') || '#c9a84c',
        hideAttribution: element.getAttribute('data-hide-attribution') === 'true',
      };

      // Set ID if not present
      if (!element.id) {
        element.id = config.elementId;
      }

      PrimeSelf.init(config);
    });
  });

})(window, document);
