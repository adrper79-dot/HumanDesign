<?php
/**
 * Prime Self Admin Panel Handler
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class PrimeSelf_Admin {
    
    /**
     * Initialize admin functionality
     */
    public static function init() {
        add_action('admin_init', array(__CLASS__, 'handle_actions'));
        add_action('admin_notices', array(__CLASS__, 'show_admin_notices'));
    }
    
    /**
     * Handle admin actions
     */
    public static function handle_actions() {
        // Test API connection
        if (isset($_POST['primeself_test_connection']) && check_admin_referer('primeself_test_connection')) {
            $api_key = sanitize_text_field($_POST['primeself_api_key']);
            $is_valid = PrimeSelf_API_Client::validate_api_key($api_key);
            
            if ($is_valid) {
                set_transient('primeself_admin_notice', array(
                    'type' => 'success',
                    'message' => 'API connection successful! Your API key is valid.'
                ), 30);
            } else {
                set_transient('primeself_admin_notice', array(
                    'type' => 'error',
                    'message' => 'API connection failed. Please check your API key.'
                ), 30);
            }
            
            wp_safe_redirect(admin_url('admin.php?page=primeself-chart'));
            exit;
        }
        
        // Clear cache
        if (isset($_POST['primeself_clear_cache']) && check_admin_referer('primeself_clear_cache')) {
            global $wpdb;
            $table_name = $wpdb->prefix . 'primeself_charts';
            $deleted = $wpdb->query("DELETE FROM $table_name WHERE expires_at < NOW()");
            
            set_transient('primeself_admin_notice', array(
                'type' => 'success',
                'message' => "Cache cleared! Removed {$deleted} expired chart(s)."
            ), 30);
            
            wp_safe_redirect(admin_url('admin.php?page=primeself-stats'));
            exit;
        }
    }
    
    /**
     * Show admin notices
     */
    public static function show_admin_notices() {
        $notice = get_transient('primeself_admin_notice');
        
        if ($notice) {
            $class = $notice['type'] === 'error' ? 'notice-error' : 'notice-success';
            ?>
            <div class="notice <?php echo esc_attr($class); ?> is-dismissible">
                <p><?php echo esc_html($notice['message']); ?></p>
            </div>
            <?php
            delete_transient('primeself_admin_notice');
        }
        
        // Show warning if API key not set
        $screen = get_current_screen();
        if ($screen && strpos($screen->id, 'primeself') !== false) {
            $api_key = get_option('primeself_api_key');
            if (empty($api_key)) {
                ?>
                <div class="notice notice-warning">
                    <p>
                        <strong>Prime Self:</strong> 
                        Please configure your API key in the 
                        <a href="<?php echo esc_url(admin_url('admin.php?page=primeself-chart')); ?>">settings page</a> 
                        to start using the chart calculator.
                    </p>
                </div>
                <?php
            }
        }
    }
    
    /**
     * Get plugin status
     */
    public static function get_status() {
        $api_key = get_option('primeself_api_key');
        $cache_duration = get_option('primeself_cache_duration', 7);
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'primeself_charts';
        $cached_charts = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE expires_at > NOW()");
        $expired_charts = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE expires_at <= NOW()");
        
        return array(
            'apiConfigured' => !empty($api_key),
            'cacheEnabled' => $cache_duration > 0,
            'cachedCharts' => (int) $cached_charts,
            'expiredCharts' => (int) $expired_charts
        );
    }
}

// Initialize admin
PrimeSelf_Admin::init();
