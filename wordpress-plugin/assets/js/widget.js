/**
 * Prime Self WordPress Plugin - Frontend Widget JavaScript
 */

(function($) {
    'use strict';
    
    const PrimeSelfWidget = {
        
        /**
         * Initialize widget
         */
        init: function() {
            this.bindEvents();
            this.initLocationAutocomplete();
        },
        
        /**
         * Bind event handlers
         */
        bindEvents: function() {
            const self = this;
            
            // Form submission
            $(document).on('submit', '.primeself-form', function(e) {
                e.preventDefault();
                self.handleFormSubmit($(this));
            });
            
            // Reset button
            $(document).on('click', '.primeself-reset-btn', function(e) {
                e.preventDefault();
                self.resetForm($(this).closest('.primeself-chart-calculator'));
            });
            
            // Unknown time checkbox
            $(document).on('change', '#primeself-unknown-time', function() {
                const timeInput = $('#primeself-birth-time');
                if ($(this).is(':checked')) {
                    timeInput.val('12:00').prop('disabled', true);
                } else {
                    timeInput.prop('disabled', false);
                }
            });
            
            // Mini calculator modal
            $(document).on('click', '[data-primeself-modal]', function(e) {
                e.preventDefault();
                self.openModal();
            });
        },
        
        /**
         * Initialize location autocomplete
         */
        initLocationAutocomplete: function() {
            let timeout = null;
            
            $(document).on('input', '#primeself-birth-location', function() {
                const input = $(this);
                const value = input.val().trim();
                const suggestions = $('#primeself-location-suggestions');
                
                clearTimeout(timeout);
                
                if (value.length < 3) {
                    suggestions.hide().empty();
                    return;
                }
                
                timeout = setTimeout(function() {
                    // Use OpenStreetMap Nominatim API for location search
                    $.ajax({
                        url: 'https://nominatim.openstreetmap.org/search',
                        data: {
                            q: value,
                            format: 'json',
                            limit: 5,
                            addressdetails: 1
                        },
                        dataType: 'json',
                        success: function(data) {
                            if (data.length === 0) {
                                suggestions.hide().empty();
                                return;
                            }
                            
                            let html = '';
                            data.forEach(function(place) {
                                const name = place.display_name;
                                const lat = place.lat;
                                const lon = place.lon;
                                
                                html += `<div class="primeself-suggestion-item" 
                                              data-name="${name}" 
                                              data-lat="${lat}" 
                                              data-lon="${lon}">
                                    ${name}
                                </div>`;
                            });
                            
                            suggestions.html(html).show();
                        }
                    });
                }, 300);
            });
            
            // Select suggestion
            $(document).on('click', '.primeself-suggestion-item', function() {
                const item = $(this);
                const name = item.data('name');
                const lat = item.data('lat');
                const lon = item.data('lon');
                
                $('#primeself-birth-location').val(name).data({
                    lat: lat,
                    lon: lon,
                    name: name
                });
                
                $('#primeself-location-suggestions').hide().empty();
            });
            
            // Hide suggestions when clicking outside
            $(document).on('click', function(e) {
                if (!$(e.target).closest('#primeself-birth-location, #primeself-location-suggestions').length) {
                    $('#primeself-location-suggestions').hide();
                }
            });
        },
        
        /**
         * Handle form submission
         */
        handleFormSubmit: function(form) {
            const self = this;
            const container = form.closest('.primeself-chart-calculator');
            const locationInput = $('#primeself-birth-location');
            
            // Validate location has been selected from autocomplete
            const locationData = locationInput.data();
            if (!locationData.lat || !locationData.lon) {
                self.showError(container, 'Please select a location from the dropdown suggestions');
                return;
            }
            
            // Gather form data
            const formData = {
                birthDate: $('#primeself-birth-date').val(),
                birthTime: $('#primeself-birth-time').val(),
                birthLocation: {
                    name: locationData.name,
                    latitude: parseFloat(locationData.lat),
                    longitude: parseFloat(locationData.lon)
                },
                unknownTime: $('#primeself-unknown-time').is(':checked')
            };
            
            // Validate
            if (!formData.birthDate) {
                self.showError(container, 'Please enter your birth date');
                return;
            }
            
            if (!formData.birthTime && !formData.unknownTime) {
                self.showError(container, 'Please enter your birth time or check "Unknown time"');
                return;
            }
            
            // Show loading
            container.find('.primeself-calculator-form').hide();
            container.find('.primeself-error').hide();
            container.find('.primeself-loading').show();
            
            // Call API via WordPress REST endpoint (with caching)
            $.ajax({
                url: primeselfConfig.cacheEndpoint,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(formData),
                success: function(response) {
                    if (response.success && response.chart) {
                        self.displayChart(container, response.chart, response.cached);
                    } else {
                        self.showError(container, 'Failed to calculate chart. Please try again.');
                    }
                },
                error: function(xhr) {
                    let errorMsg = 'An error occurred. Please try again.';
                    
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMsg = xhr.responseJSON.message;
                    } else if (xhr.status === 429) {
                        errorMsg = 'Rate limit exceeded. Please try again later.';
                    } else if (xhr.status === 401) {
                        errorMsg = 'API key not configured. Please contact site administrator.';
                    }
                    
                    self.showError(container, errorMsg);
                }
            });
        },
        
        /**
         * Display calculated chart
         */
        displayChart: function(container, chart, cached) {
            const self = this;
            
            container.find('.primeself-loading').hide();
            container.find('.primeself-chart-result').show();
            
            // Populate chart details
            const hd = chart.humanDesign || chart.design;
            
            if (hd.type) {
                container.find('.primeself-type-value').text(hd.type);
                container.find('.primeself-type-description').text(this.getTypeDescription(hd.type));
            }
            
            if (hd.strategy) {
                container.find('.primeself-strategy-value').text(hd.strategy);
            }
            
            if (hd.authority) {
                container.find('.primeself-authority-value').text(hd.authority);
            }
            
            if (hd.profile) {
                const profileText = typeof hd.profile === 'object' 
                    ? `${hd.profile.line1}/${hd.profile.line2}` 
                    : hd.profile;
                container.find('.primeself-profile-value').text(profileText);
            }
            
            // Add visual chart (bodygraph) if available
            if (chart.bodygraphSvg || chart.svg) {
                const svg = chart.bodygraphSvg || chart.svg;
                container.find('.primeself-chart-content').html(svg);
            } else {
                // Generate simple bodygraph representation
                const bodygraph = self.generateBodygraph(hd);
                container.find('.primeself-chart-content').html(bodygraph);
            }
            
            // Add cache indicator
            if (cached) {
                console.log('[Prime Self] Chart loaded from cache');
            }
        },
        
        /**
         * Generate simple bodygraph visualization
         */
        generateBodygraph: function(hd) {
            let html = '<div class="primeself-bodygraph-simple">';
            html += '<p class="primeself-bodygraph-note">Your chart has been calculated! Upgrade to Prime Self for visual bodygraph and deeper insights.</p>';
            
            if (hd.definedCenters && hd.definedCenters.length > 0) {
                html += '<div class="primeself-centers">';
                html += '<h4>Defined Centers:</h4>';
                html += '<ul>';
                hd.definedCenters.forEach(function(center) {
                    html += `<li>${center}</li>`;
                });
                html += '</ul>';
                html += '</div>';
            }
            
            if (hd.gates && hd.gates.length > 0) {
                html += '<div class="primeself-gates">';
                html += '<h4>Activated Gates:</h4>';
                html += '<div class="primeself-gates-grid">';
                hd.gates.forEach(function(gate) {
                    const gateNumber = typeof gate === 'object' ? gate.gate : gate;
                    html += `<span class="primeself-gate-badge">Gate ${gateNumber}</span>`;
                });
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        },
        
        /**
         * Get type description
         */
        getTypeDescription: function(type) {
            const descriptions = {
                'Manifestor': 'You are designed to initiate and make things happen. Your strategy is to inform before you act.',
                'Generator': 'You are designed to respond to life. Your strategy is to wait for things to respond to.',
                'Manifesting Generator': 'You are a multi-passionate doer. Your strategy is to respond and then inform.',
                'Projector': 'You are designed to guide and direct others. Your strategy is to wait for recognition and invitation.',
                'Reflector': 'You are designed to reflect the health of your community. Your strategy is to wait a lunar cycle before making major decisions.'
            };
            
            return descriptions[type] || 'Discover your unique design.';
        },
        
        /**
         * Show error message
         */
        showError: function(container, message) {
            container.find('.primeself-loading').hide();
            container.find('.primeself-calculator-form').show();
            container.find('.primeself-error').text(message).show();
            
            setTimeout(function() {
                container.find('.primeself-error').fadeOut();
            }, 5000);
        },
        
        /**
         * Reset form
         */
        resetForm: function(container) {
            container.find('.primeself-chart-result').hide();
            container.find('.primeself-calculator-form').show();
            container.find('.primeself-form')[0].reset();
            container.find('#primeself-birth-location').removeData('lat lon name');
        },
        
        /**
         * Open modal (for mini calculator)
         */
        openModal: function() {
            // TODO: Implement modal functionality
            alert('Modal calculator coming soon! For now, add [primeself_chart] shortcode to a page.');
        }
    };
    
    // Initialize on document ready
    $(document).ready(function() {
        PrimeSelfWidget.init();
    });
    
})(jQuery);
