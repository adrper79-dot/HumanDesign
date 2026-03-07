/**
 * Prime Self WordPress Plugin - Admin JavaScript
 */

(function($) {
    'use strict';
    
    const PrimeSelfAdmin = {
        
        /**
         * Initialize
         */
        init: function() {
            this.initColorPicker();
            this.bindEvents();
        },
        
        /**
         * Initialize color picker
         */
        initColorPicker: function() {
            if ($.fn.wpColorPicker) {
                $('.primeself-color-picker').wpColorPicker();
            }
        },
        
        /**
         * Bind events
         */
        bindEvents: function() {
            // Test API connection button
            $('.primeself-test-api').on('click', function(e) {
                e.preventDefault();
                PrimeSelfAdmin.testApiConnection();
            });
        },
        
        /**
         * Test API connection
         */
        testApiConnection: function() {
            const apiKey = $('#primeself_api_key').val();
            
            if (!apiKey) {
                alert('Please enter an API key first');
                return;
            }
            
            const button = $('.primeself-test-api');
            const originalText = button.text();
            
            button.prop('disabled', true).text('Testing...');
            
            $.post(primeselfAdmin.ajaxUrl, {
                action: 'primeself_test_api',
                nonce: primeselfAdmin.nonce,
                api_key: apiKey
            }, function(response) {
                if (response.success) {
                    alert('✓ API connection successful!');
                } else {
                    alert('✗ API connection failed: ' + (response.data || 'Unknown error'));
                }
            }).fail(function() {
                alert('✗ Request failed. Please try again.');
            }).always(function() {
                button.prop('disabled', false).text(originalText);
            });
        }
    };
    
    // Initialize on document ready
    $(document).ready(function() {
        PrimeSelfAdmin.init();
    });
    
})(jQuery);
