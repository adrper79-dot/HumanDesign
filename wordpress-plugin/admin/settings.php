<?php
/**
 * Admin Settings Page
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

$api_key = get_option('primeself_api_key', '');
$affiliate_id = get_option('primeself_affiliate_id', '');
$widget_style = get_option('primeself_widget_style', 'modern');
$primary_color = get_option('primeself_primary_color', '#6366f1');
$show_branding = get_option('primeself_show_branding', '1');
$cache_duration = get_option('primeself_cache_duration', '7');
$enable_lazy_load = get_option('primeself_enable_lazy_load', '1');
$collect_analytics = get_option('primeself_collect_analytics', '1');
$privacy_policy_url = get_option('primeself_privacy_policy_url', '');

$status = PrimeSelf_Admin::get_status();
?>

<div class="wrap primeself-admin">
    <h1>
        <span class="dashicons dashicons-chart-line"></span>
        Prime Self - Settings
    </h1>
    
    <?php if (!$status['apiConfigured']): ?>
    <div class="notice notice-warning inline">
        <h3>Get Started with Prime Self</h3>
        <p>To use the Human Design chart calculator, you'll need a Prime Self API key:</p>
        <ol>
            <li>Visit <a href="https://primeself.app/api" target="_blank">primeself.app/api</a></li>
            <li>Sign up for a free account or log in</li>
            <li>Generate an API key from your dashboard</li>
            <li>Copy and paste the key below</li>
        </ol>
        <p><strong>Free tier includes:</strong> 100 chart calculations per day</p>
    </div>
    <?php endif; ?>
    
    <div class="primeself-admin-grid">
        <div class="primeself-admin-main">
            <form method="post" action="options.php">
                <?php settings_fields('primeself_options'); ?>
                
                <!-- API Configuration -->
                <div class="postbox">
                    <h2 class="hndle">API Configuration</h2>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="primeself_api_key">API Key</label>
                                </th>
                                <td>
                                    <input type="text" 
                                           id="primeself_api_key" 
                                           name="primeself_api_key" 
                                           value="<?php echo esc_attr($api_key); ?>" 
                                           class="regular-text code"
                                           placeholder="ps_...">
                                    <p class="description">
                                        Get your API key from <a href="https://primeself.app/api" target="_blank">primeself.app/api</a>
                                    </p>
                                    
                                    <?php if (!empty($api_key)): ?>
                                    <div class="primeself-api-status" style="margin-top: 10px;">
                                        <span class="dashicons dashicons-yes-alt" style="color: #46b450;"></span>
                                        <strong>API key configured</strong>
                                        <form method="post" style="display: inline-block; margin-left: 10px;">
                                            <?php wp_nonce_field('primeself_test_connection'); ?>
                                            <input type="hidden" name="primeself_api_key" value="<?php echo esc_attr($api_key); ?>">
                                            <button type="submit" name="primeself_test_connection" class="button button-small">
                                                Test Connection
                                            </button>
                                        </form>
                                    </div>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            
                            <tr>
                                <th scope="row">
                                    <label for="primeself_affiliate_id">Affiliate ID (Optional)</label>
                                </th>
                                <td>
                                    <input type="text" 
                                           id="primeself_affiliate_id" 
                                           name="primeself_affiliate_id" 
                                           value="<?php echo esc_attr($affiliate_id); ?>" 
                                           class="regular-text"
                                           placeholder="your-affiliate-id">
                                    <p class="description">
                                        Earn commission when visitors upgrade. 
                                        <a href="https://primeself.app/affiliates" target="_blank">Join affiliate program</a>
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Widget Appearance -->
                <div class="postbox">
                    <h2 class="hndle">Widget Appearance</h2>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="primeself_widget_style">Widget Style</label>
                                </th>
                                <td>
                                    <select id="primeself_widget_style" name="primeself_widget_style">
                                        <option value="modern" <?php selected($widget_style, 'modern'); ?>>Modern</option>
                                        <option value="compact" <?php selected($widget_style, 'compact'); ?>>Compact</option>
                                        <option value="minimal" <?php selected($widget_style, 'minimal'); ?>>Minimal</option>
                                    </select>
                                    <p class="description">Choose the default widget style</p>
                                </td>
                            </tr>
                            
                            <tr>
                                <th scope="row">
                                    <label for="primeself_primary_color">Primary Color</label>
                                </th>
                                <td>
                                    <input type="text" 
                                           id="primeself_primary_color" 
                                           name="primeself_primary_color" 
                                           value="<?php echo esc_attr($primary_color); ?>" 
                                           class="primeself-color-picker">
                                    <p class="description">Widget button and accent color</p>
                                </td>
                            </tr>
                            
                            <tr>
                                <th scope="row">Show Branding</th>
                                <td>
                                    <label>
                                        <input type="checkbox" 
                                               id="primeself_show_branding" 
                                               name="primeself_show_branding" 
                                               value="1" 
                                               <?php checked($show_branding, '1'); ?>>
                                        Display "Powered by Prime Self" link
                                    </label>
                                    <p class="description">
                                        Keep this enabled to support the project (and for better SEO)
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Performance -->
                <div class="postbox">
                    <h2 class="hndle">Performance & Caching</h2>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row">
                                    <label for="primeself_cache_duration">Cache Duration</label>
                                </th>
                                <td>
                                    <input type="number" 
                                           id="primeself_cache_duration" 
                                           name="primeself_cache_duration" 
                                           value="<?php echo esc_attr($cache_duration); ?>" 
                                           min="0" 
                                           max="365" 
                                           class="small-text"> days
                                    <p class="description">
                                        Cache chart calculations locally to reduce API calls. 
                                        Set to 0 to disable caching.
                                        <?php if ($status['cachedCharts'] > 0): ?>
                                        <br><strong><?php echo $status['cachedCharts']; ?> charts currently cached</strong>
                                        <?php endif; ?>
                                    </p>
                                </td>
                            </tr>
                            
                            <tr>
                                <th scope="row">Lazy Loading</th>
                                <td>
                                    <label>
                                        <input type="checkbox" 
                                               id="primeself_enable_lazy_load" 
                                               name="primeself_enable_lazy_load" 
                                               value="1" 
                                               <?php checked($enable_lazy_load, '1'); ?>>
                                        Load widget JavaScript only when needed
                                    </label>
                                    <p class="description">Improves page load speed</p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Privacy -->
                <div class="postbox">
                    <h2 class="hndle">Privacy & Data</h2>
                    <div class="inside">
                        <table class="form-table">
                            <tr>
                                <th scope="row">Analytics</th>
                                <td>
                                    <label>
                                        <input type="checkbox" 
                                               id="primeself_collect_analytics" 
                                               name="primeself_collect_analytics" 
                                               value="1" 
                                               <?php checked($collect_analytics, '1'); ?>>
                                        Collect anonymous usage analytics
                                    </label>
                                    <p class="description">
                                        Helps improve the plugin. No personal data is collected.
                                    </p>
                                </td>
                            </tr>
                            
                            <tr>
                                <th scope="row">
                                    <label for="primeself_privacy_policy_url">Privacy Policy URL</label>
                                </th>
                                <td>
                                    <input type="url" 
                                           id="primeself_privacy_policy_url" 
                                           name="primeself_privacy_policy_url" 
                                           value="<?php echo esc_url($privacy_policy_url); ?>" 
                                           class="regular-text"
                                           placeholder="https://yoursite.com/privacy">
                                    <p class="description">
                                        Link to your privacy policy (displayed in widget footer)
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <?php submit_button('Save Settings'); ?>
            </form>
        </div>
        
        <div class="primeself-admin-sidebar">
            <!-- Quick Start -->
            <div class="postbox">
                <h3 class="hndle">Quick Start</h3>
                <div class="inside">
                    <h4>Add to any page/post:</h4>
                    <code>[primeself_chart]</code>
                    
                    <h4 style="margin-top: 15px;">Mini button:</h4>
                    <code>[primeself_mini]</code>
                    
                    <h4 style="margin-top: 15px;">As a widget:</h4>
                    <p>Go to <a href="<?php echo admin_url('widgets.php'); ?>">Appearance → Widgets</a> and drag "Prime Self - Chart Calculator"</p>
                    
                    <h4 style="margin-top: 15px;">In your theme:</h4>
                    <code style="display: block; white-space: pre-wrap; font-size: 11px;">&lt;?php echo do_shortcode('[primeself_chart]'); ?&gt;</code>
                </div>
            </div>
            
            <!-- Support -->
            <div class="postbox">
                <h3 class="hndle">Support & Resources</h3>
                <div class="inside">
                    <ul>
                        <li><a href="https://primeself.app/docs/wordpress" target="_blank">Documentation</a></li>
                        <li><a href="https://primeself.app/api" target="_blank">API Documentation</a></li>
                        <li><a href="https://primeself.app/support" target="_blank">Support Forum</a></li>
                        <li><a href="https://primeself.app/affiliates" target="_blank">Affiliate Program</a></li>
                    </ul>
                </div>
            </div>
            
            <!-- Stats Preview -->
            <?php if ($status['apiConfigured']): ?>
            <div class="postbox">
                <h3 class="hndle">Usage Stats</h3>
                <div class="inside">
                    <?php
                    $stats = PrimeSelf_API_Client::get_usage_stats();
                    ?>
                    <p>
                        <strong><?php echo number_format($stats['uniqueCharts']); ?></strong> 
                        unique charts calculated
                    </p>
                    <p>
                        <strong><?php echo number_format($stats['totalRequests']); ?></strong> 
                        total requests
                    </p>
                    <p>
                        <a href="<?php echo admin_url('admin.php?page=primeself-stats'); ?>" class="button">
                            View Detailed Stats
                        </a>
                    </p>
                </div>
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<style>
.primeself-admin-grid {
    display: flex;
    gap: 20px;
    margin-top: 20px;
}

.primeself-admin-main {
    flex: 1;
    max-width: 800px;
}

.primeself-admin-sidebar {
    width: 300px;
    flex-shrink: 0;
}

.primeself-admin h1 {
    display: flex;
    align-items: center;
    gap: 10px;
}

.primeself-admin .postbox {
    margin-bottom: 20px;
}

.primeself-admin .postbox h2,
.primeself-admin .postbox h3 {
    padding: 12px 15px;
    margin: 0;
    border-bottom: 1px solid #ddd;
}

.primeself-admin .inside {
    padding: 15px;
}

.primeself-admin code {
    display: inline-block;
    padding: 5px 10px;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 13px;
}

.primeself-admin-sidebar ul {
    margin: 0;
    padding-left: 20px;
}

.primeself-admin-sidebar li {
    margin-bottom: 8px;
}

@media (max-width: 782px) {
    .primeself-admin-grid {
        flex-direction: column;
    }
    
    .primeself-admin-sidebar {
        width: 100%;
    }
}
</style>
