<?php
/**
 * Plugin Name: Prime Self - Human Design Chart Calculator
 * Plugin URI: https://primeself.app/wordpress-plugin
 * Description: Embed a Human Design chart calculator on your WordPress site. Powered by Prime Self API.
 * Version: 1.0.0
 * Author: Prime Self
 * Author URI: https://primeself.app
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: primeself-chart
 * Domain Path: /languages
 * Requires at least: 5.0
 * Requires PHP: 7.4
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PRIMESELF_VERSION', '1.0.0');
define('PRIMESELF_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PRIMESELF_PLUGIN_URL', plugin_dir_url(__FILE__));
define('PRIMESELF_PLUGIN_FILE', __FILE__);

/**
 * Main PrimeSelf Plugin Class
 */
class PrimeSelf_Chart_Calculator {
    
    /**
     * Single instance of the class
     */
    private static $instance = null;
    
    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->init_hooks();
        $this->load_dependencies();
    }
    
    /**
     * Initialize WordPress hooks
     */
    private function init_hooks() {
        // Activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Admin hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        
        // Frontend hooks
        add_action('wp_enqueue_scripts', array($this, 'frontend_enqueue_scripts'));
        add_shortcode('primeself_chart', array($this, 'chart_calculator_shortcode'));
        add_shortcode('primeself_mini', array($this, 'mini_calculator_shortcode'));
        
        // Widget registration
        add_action('widgets_init', array($this, 'register_widgets'));
        
        // REST API endpoint for chart caching
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once PRIMESELF_PLUGIN_DIR . 'includes/class-widget.php';
        require_once PRIMESELF_PLUGIN_DIR . 'includes/class-admin.php';
        require_once PRIMESELF_PLUGIN_DIR . 'includes/class-api.php';
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Set default options
        if (!get_option('primeself_api_key')) {
            add_option('primeself_api_key', '');
        }
        if (!get_option('primeself_affiliate_id')) {
            add_option('primeself_affiliate_id', '');
        }
        if (!get_option('primeself_widget_style')) {
            add_option('primeself_widget_style', 'modern');
        }
        if (!get_option('primeself_show_branding')) {
            add_option('primeself_show_branding', '1');
        }
        if (!get_option('primeself_cache_duration')) {
            add_option('primeself_cache_duration', '7');
        }
        
        // Create custom table for chart cache (optional)
        global $wpdb;
        $table_name = $wpdb->prefix . 'primeself_charts';
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            chart_hash varchar(64) NOT NULL,
            chart_data longtext NOT NULL,
            birth_date date NOT NULL,
            birth_time time NOT NULL,
            birth_location varchar(255) NOT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            expires_at datetime NOT NULL,
            hit_count int DEFAULT 0,
            PRIMARY KEY (id),
            UNIQUE KEY chart_hash (chart_hash),
            KEY expires_at (expires_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
        
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Flush rewrite rules
        flush_rewrite_rules();
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            'Prime Self Settings',
            'Prime Self',
            'manage_options',
            'primeself-chart',
            array($this, 'render_admin_page'),
            'dashicons-chart-line',
            80
        );
        
        add_submenu_page(
            'primeself-chart',
            'Settings',
            'Settings',
            'manage_options',
            'primeself-chart',
            array($this, 'render_admin_page')
        );
        
        add_submenu_page(
            'primeself-chart',
            'Usage & Stats',
            'Usage & Stats',
            'manage_options',
            'primeself-stats',
            array($this, 'render_stats_page')
        );
        
        add_submenu_page(
            'primeself-chart',
            'Documentation',
            'Documentation',
            'manage_options',
            'primeself-docs',
            array($this, 'render_docs_page')
        );
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        // API Settings
        register_setting('primeself_options', 'primeself_api_key', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => ''
        ));
        
        register_setting('primeself_options', 'primeself_affiliate_id', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => ''
        ));
        
        // Widget Appearance
        register_setting('primeself_options', 'primeself_widget_style', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => 'modern'
        ));
        
        register_setting('primeself_options', 'primeself_primary_color', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_hex_color',
            'default' => '#6366f1'
        ));
        
        register_setting('primeself_options', 'primeself_show_branding', array(
            'type' => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
            'default' => true
        ));
        
        // Performance
        register_setting('primeself_options', 'primeself_cache_duration', array(
            'type' => 'integer',
            'sanitize_callback' => 'absint',
            'default' => 7
        ));
        
        register_setting('primeself_options', 'primeself_enable_lazy_load', array(
            'type' => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
            'default' => true
        ));
        
        // Privacy
        register_setting('primeself_options', 'primeself_collect_analytics', array(
            'type' => 'boolean',
            'sanitize_callback' => 'rest_sanitize_boolean',
            'default' => true
        ));
        
        register_setting('primeself_options', 'primeself_privacy_policy_url', array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => ''
        ));
    }
    
    /**
     * Enqueue admin scripts
     */
    public function admin_enqueue_scripts($hook) {
        if (strpos($hook, 'primeself') === false) {
            return;
        }
        
        wp_enqueue_style(
            'primeself-admin',
            PRIMESELF_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            PRIMESELF_VERSION
        );
        
        wp_enqueue_script(
            'primeself-admin',
            PRIMESELF_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'wp-color-picker'),
            PRIMESELF_VERSION,
            true
        );
        
        wp_enqueue_style('wp-color-picker');
        
        wp_localize_script('primeself-admin', 'primeselfAdmin', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('primeself_admin'),
            'apiKey' => get_option('primeself_api_key', '')
        ));
    }
    
    /**
     * Enqueue frontend scripts
     */
    public function frontend_enqueue_scripts() {
        wp_enqueue_style(
            'primeself-widget',
            PRIMESELF_PLUGIN_URL . 'assets/css/widget.css',
            array(),
            PRIMESELF_VERSION
        );
        
        wp_enqueue_script(
            'primeself-widget',
            PRIMESELF_PLUGIN_URL . 'assets/js/widget.js',
            array('jquery'),
            PRIMESELF_VERSION,
            true
        );
        
        $primary_color = get_option('primeself_primary_color', '#6366f1');
        $affiliate_id = get_option('primeself_affiliate_id', '');
        
        wp_localize_script('primeself-widget', 'primeselfConfig', array(
            'affiliateId' => $affiliate_id,
            'affiliateUrl' => $affiliate_id ? "https://primeself.app?ref={$affiliate_id}" : 'https://primeself.app',
            'primaryColor' => $primary_color,
            'showBranding' => (bool) get_option('primeself_show_branding', true),
            'nonce' => wp_create_nonce('primeself_widget'),
            'cacheEndpoint' => rest_url('primeself/v1/chart')
        ));
    }
    
    /**
     * Register widgets
     */
    public function register_widgets() {
        register_widget('PrimeSelf_Chart_Widget');
    }
    
    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('primeself/v1', '/chart', array(
            'methods' => 'POST',
            'callback' => array($this, 'api_calculate_chart'),
            'permission_callback' => function($request) {
                $nonce = $request->get_header('X-Primeself-Nonce');
                if (!$nonce) {
                    $nonce = $request->get_param('_wpnonce');
                }
                return wp_verify_nonce($nonce, 'primeself_widget') !== false;
            }
        ));
        
        register_rest_route('primeself/v1', '/stats', array(
            'methods' => 'GET',
            'callback' => array($this, 'api_get_stats'),
            'permission_callback' => function() {
                return current_user_can('manage_options');
            }
        ));
    }
    
    /**
     * Calculate chart via API (with caching)
     */
    public function api_calculate_chart($request) {
        $params = $request->get_json_params();
        
        // Validate required fields
        if (empty($params['birthDate']) || empty($params['birthTime']) || empty($params['birthLocation'])) {
            return new WP_Error('missing_params', 'Birth date, time, and location are required', array('status' => 400));
        }
        
        // Generate cache hash
        $cache_hash = hash('sha256', json_encode($params));
        
        // Check cache
        $cache_duration = get_option('primeself_cache_duration', 7);
        if ($cache_duration > 0) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'primeself_charts';
            
            $cached = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM $table_name WHERE chart_hash = %s AND expires_at > NOW()",
                $cache_hash
            ));
            
            if ($cached) {
                // Update hit count
                $wpdb->update(
                    $table_name,
                    array('hit_count' => $cached->hit_count + 1),
                    array('id' => $cached->id)
                );
                
                return rest_ensure_response(array(
                    'success' => true,
                    'cached' => true,
                    'chart' => json_decode($cached->chart_data, true)
                ));
            }
        }
        
        // Call Prime Self API
        $api_key = get_option('primeself_api_key');
        if (empty($api_key)) {
            return new WP_Error('no_api_key', 'API key not configured', array('status' => 500));
        }
        
        $response = wp_remote_post('https://api.primeself.app/api/chart/calculate', array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $api_key
            ),
            'body' => json_encode($params),
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            return new WP_Error('api_error', 'API request failed', array('status' => $status_code));
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        // Cache the result
        if ($cache_duration > 0 && !empty($body['chart'])) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'primeself_charts';
            
            $wpdb->insert($table_name, array(
                'chart_hash' => $cache_hash,
                'chart_data' => json_encode($body['chart']),
                'birth_date' => $params['birthDate'],
                'birth_time' => $params['birthTime'],
                'birth_location' => $params['birthLocation']['name'] ?? '',
                'expires_at' => date('Y-m-d H:i:s', strtotime("+{$cache_duration} days")),
                'hit_count' => 1
            ));
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'cached' => false,
            'chart' => $body['chart'] ?? null
        ));
    }
    
    /**
     * Get usage stats
     */
    public function api_get_stats($request) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'primeself_charts';
        
        $total_charts = $wpdb->get_var("SELECT COUNT(*) FROM $table_name");
        $total_hits = $wpdb->get_var("SELECT SUM(hit_count) FROM $table_name");
        $cache_hit_rate = $total_hits > 0 ? (($total_hits - $total_charts) / $total_hits) * 100 : 0;
        
        $recent_charts = $wpdb->get_results(
            "SELECT DATE(created_at) as date, COUNT(*) as count 
             FROM $table_name 
             WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at)
             ORDER BY date DESC",
            ARRAY_A
        );
        
        return rest_ensure_response(array(
            'success' => true,
            'stats' => array(
                'totalCharts' => (int) $total_charts,
                'totalHits' => (int) $total_hits,
                'cacheHitRate' => round($cache_hit_rate, 2),
                'recentActivity' => $recent_charts
            )
        ));
    }
    
    /**
     * Chart calculator shortcode: [primeself_chart]
     */
    public function chart_calculator_shortcode($atts) {
        $atts = shortcode_atts(array(
            'style' => get_option('primeself_widget_style', 'modern'),
            'show_branding' => get_option('primeself_show_branding', '1'),
            'width' => '100%',
            'height' => 'auto'
        ), $atts);
        
        ob_start();
        ?>
        <div class="primeself-chart-calculator" 
             data-style="<?php echo esc_attr($atts['style']); ?>"
             data-show-branding="<?php echo esc_attr($atts['show_branding']); ?>"
             style="width: <?php echo esc_attr($atts['width']); ?>; height: <?php echo esc_attr($atts['height']); ?>;">
            
            <div class="primeself-calculator-form">
                <h3>Calculate Your Human Design Chart</h3>
                
                <form class="primeself-form" id="primeself-form">
                    <div class="primeself-form-group">
                        <label for="primeself-birth-date">Birth Date</label>
                        <input type="date" id="primeself-birth-date" name="birthDate" required>
                    </div>
                    
                    <div class="primeself-form-row">
                        <div class="primeself-form-group">
                            <label for="primeself-birth-time">Birth Time</label>
                            <input type="time" id="primeself-birth-time" name="birthTime" required>
                        </div>
                        
                        <div class="primeself-form-group">
                            <label>
                                <input type="checkbox" id="primeself-unknown-time" name="unknownTime">
                                Unknown time
                            </label>
                        </div>
                    </div>
                    
                    <div class="primeself-form-group">
                        <label for="primeself-birth-location">Birth Location</label>
                        <input type="text" 
                               id="primeself-birth-location" 
                               name="birthLocation" 
                               placeholder="City, Country" 
                               required
                               autocomplete="off">
                        <div id="primeself-location-suggestions" class="primeself-suggestions"></div>
                    </div>
                    
                    <button type="submit" class="primeself-submit-btn">Calculate Chart</button>
                </form>
                
                <div class="primeself-loading" style="display: none;">
                    <div class="primeself-spinner"></div>
                    <p>Calculating your chart...</p>
                </div>
                
                <div class="primeself-error" style="display: none;"></div>
            </div>
            
            <div class="primeself-chart-result" style="display: none;">
                <div class="primeself-chart-header">
                    <h3>Your Human Design Chart</h3>
                    <button class="primeself-reset-btn">Calculate Another</button>
                </div>
                
                <div class="primeself-chart-content">
                    <!-- Chart SVG will be injected here -->
                </div>
                
                <div class="primeself-chart-details">
                    <div class="primeself-type-card">
                        <h4>Type</h4>
                        <p class="primeself-type-value"></p>
                        <p class="primeself-type-description"></p>
                    </div>
                    
                    <div class="primeself-strategy-card">
                        <h4>Strategy</h4>
                        <p class="primeself-strategy-value"></p>
                    </div>
                    
                    <div class="primeself-authority-card">
                        <h4>Authority</h4>
                        <p class="primeself-authority-value"></p>
                    </div>
                    
                    <div class="primeself-profile-card">
                        <h4>Profile</h4>
                        <p class="primeself-profile-value"></p>
                    </div>
                </div>
                
                <?php if ((bool) $atts['show_branding']): ?>
                <div class="primeself-branding">
                    <p>
                        Want a deeper analysis? 
                        <a href="<?php echo esc_url($this->get_affiliate_url()); ?>" target="_blank">
                            Get your full Prime Self reading
                        </a>
                    </p>
                </div>
                <?php endif; ?>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Mini calculator shortcode: [primeself_mini]
     */
    public function mini_calculator_shortcode($atts) {
        $atts = shortcode_atts(array(
            'button_text' => 'Calculate Human Design Chart',
            'button_style' => 'primary'
        ), $atts);
        
        ob_start();
        ?>
        <div class="primeself-mini-calculator">
            <button class="primeself-mini-btn primeself-btn-<?php echo esc_attr($atts['button_style']); ?>" 
                    data-primeself-modal="true">
                <?php echo esc_html($atts['button_text']); ?>
            </button>
        </div>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Render admin settings page
     */
    public function render_admin_page() {
        require_once PRIMESELF_PLUGIN_DIR . 'admin/settings.php';
    }
    
    /**
     * Render stats page
     */
    public function render_stats_page() {
        require_once PRIMESELF_PLUGIN_DIR . 'admin/stats.php';
    }
    
    /**
     * Render docs page
     */
    public function render_docs_page() {
        require_once PRIMESELF_PLUGIN_DIR . 'admin/docs.php';
    }
    
    /**
     * Get affiliate URL
     */
    private function get_affiliate_url() {
        $affiliate_id = get_option('primeself_affiliate_id', '');
        return $affiliate_id 
            ? "https://primeself.app?ref={$affiliate_id}" 
            : 'https://primeself.app';
    }
}

// Initialize the plugin
function primeself_init() {
    return PrimeSelf_Chart_Calculator::get_instance();
}

add_action('plugins_loaded', 'primeself_init');
