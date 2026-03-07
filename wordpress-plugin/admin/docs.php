<?php
/**
 * Admin Documentation Page
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap primeself-admin">
    <h1>
        <span class="dashicons dashicons-book"></span>
        Documentation
    </h1>
    
    <div class="primeself-docs-grid">
        <div class="primeself-docs-main">
            <!-- Shortcodes -->
            <div class="postbox">
                <h2 class="hndle">Shortcodes</h2>
                <div class="inside">
                    <h3>[primeself_chart]</h3>
                    <p>Display a full Human Design chart calculator.</p>
                    
                    <h4>Parameters:</h4>
                    <ul>
                        <li><code>style</code> - Widget style: <em>modern</em>, <em>compact</em>, or <em>minimal</em> (default: modern)</li>
                        <li><code>show_branding</code> - Show "Powered by Prime Self" link: <em>1</em> or <em>0</em> (default: 1)</li>
                        <li><code>width</code> - Widget width (default: 100%)</li>
                        <li><code>height</code> - Widget height (default: auto)</li>
                    </ul>
                    
                    <h4>Examples:</h4>
                    <code>[primeself_chart]</code><br>
                    <code>[primeself_chart style="compact"]</code><br>
                    <code>[primeself_chart style="minimal" show_branding="0"]</code><br>
                    <code>[primeself_chart width="600px"]</code>
                    
                    <hr style="margin: 30px 0;">
                    
                    <h3>[primeself_mini]</h3>
                    <p>Display a compact button that opens a modal calculator.</p>
                    
                    <h4>Parameters:</h4>
                    <ul>
                        <li><code>button_text</code> - Button text (default: "Calculate Human Design Chart")</li>
                        <li><code>button_style</code> - Button style: <em>primary</em>, <em>secondary</em>, or <em>outline</em> (default: primary)</li>
                    </ul>
                    
                    <h4>Examples:</h4>
                    <code>[primeself_mini]</code><br>
                    <code>[primeself_mini button_text="Get Your Chart"]</code><br>
                    <code>[primeself_mini button_text="Calculate Chart" button_style="outline"]</code>
                </div>
            </div>
            
            <!-- Widget Usage -->
            <div class="postbox">
                <h2 class="hndle">Widget Usage</h2>
                <div class="inside">
                    <h3>Adding to Sidebar/Footer</h3>
                    <ol>
                        <li>Go to <strong>Appearance → Widgets</strong></li>
                        <li>Find "Prime Self - Chart Calculator" widget</li>
                        <li>Drag it to your desired widget area</li>
                        <li>Configure widget settings (title, style, etc.)</li>
                        <li>Click "Save"</li>
                    </ol>
                    
                    <h3>Using in Theme Files</h3>
                    <p>Add this code to your theme template:</p>
                    <code style="display: block; white-space: pre-wrap;">&lt;?php echo do_shortcode('[primeself_chart]'); ?&gt;</code>
                    
                    <h3>Gutenberg Block</h3>
                    <p>When editing a page/post in Gutenberg:</p>
                    <ol>
                        <li>Click the "+" button to add a block</li>
                        <li>Search for "Shortcode"</li>
                        <li>Paste your shortcode: <code>[primeself_chart]</code></li>
                    </ol>
                </div>
            </div>
            
            <!-- Styling & Customization -->
            <div class="postbox">
                <h2 class="hndle">Styling & Customization</h2>
                <div class="inside">
                    <h3>Custom CSS</h3>
                    <p>Add custom CSS in <strong>Appearance → Customize → Additional CSS</strong>:</p>
                    
                    <code style="display: block; white-space: pre-wrap; margin-bottom: 15px;">/* Change primary color */
.primeself-submit-btn {
    background-color: #your-color !important;
}

/* Customize form fields */
.primeself-form input {
    border-radius: 8px;
}

/* Hide branding */
.primeself-branding {
    display: none;
}

/* Adjust widget width */
.primeself-chart-calculator {
    max-width: 600px;
    margin: 0 auto;
}</code>
                    
                    <h3>Available CSS Classes</h3>
                    <ul>
                        <li><code>.primeself-chart-calculator</code> - Main container</li>
                        <li><code>.primeself-form</code> - Form element</li>
                        <li><code>.primeself-submit-btn</code> - Calculate button</li>
                        <li><code>.primeself-chart-result</code> - Results container</li>
                        <li><code>.primeself-type-card</code> - Type display card</li>
                        <li><code>.primeself-branding</code> - Powered-by footer</li>
                    </ul>
                </div>
            </div>
            
            <!-- API Integration -->
            <div class="postbox">
                <h2 class="hndle">API Integration</h2>
                <div class="inside">
                    <h3>Getting an API Key</h3>
                    <ol>
                        <li>Visit <a href="https://primeself.app/api" target="_blank">primeself.app/api</a></li>
                        <li>Sign up or log in to your account</li>
                        <li>Go to Settings → API Keys</li>
                        <li>Click "Generate New Key"</li>
                        <li>Copy the key (shown only once!)</li>
                        <li>Paste into WordPress plugin settings</li>
                    </ol>
                    
                    <h3>API Tiers</h3>
                    <table class="wp-list-table widefat fixed striped">
                        <thead>
                            <tr>
                                <th>Tier</th>
                                <th>Rate Limit</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Free</td>
                                <td>100 requests/day</td>
                                <td>$0</td>
                            </tr>
                            <tr>
                                <td>Basic</td>
                                <td>1,000 requests/day</td>
                                <td>$9/month</td>
                            </tr>
                            <tr>
                                <td>Pro</td>
                                <td>10,000 requests/day</td>
                                <td>$29/month</td>
                            </tr>
                            <tr>
                                <td>Enterprise</td>
                                <td>100,000+ requests/day</td>
                                <td>Custom</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <p style="margin-top: 15px;">
                        <strong>Note:</strong> The free tier is perfect for personal blogs and small sites. 
                        Upgrade if you exceed 100 charts per day.
                    </p>
                </div>
            </div>
            
            <!-- Performance Tips -->
            <div class="postbox">
                <h2 class="hndle">Performance Tips</h2>
                <div class="inside">
                    <h3>Enable Caching</h3>
                    <p>
                        In plugin settings, set cache duration to 7-30 days. This stores chart calculations 
                        in your WordPress database, reducing API calls and improving response time.
                    </p>
                    
                    <h3>Lazy Loading</h3>
                    <p>
                        Enable lazy loading to only load JavaScript when the widget is visible. 
                        This improves initial page load speed.
                    </p>
                    
                    <h3>CDN Integration</h3>
                    <p>
                        The plugin assets (CSS/JS) are already optimized. If using a CDN like Cloudflare, 
                        ensure it's caching static assets for fastest delivery.
                    </p>
                    
                    <h3>Cache Hit Rate</h3>
                    <p>
                        Monitor your cache hit rate in the <a href="<?php echo admin_url('admin.php?page=primeself-stats'); ?>">Usage & Stats</a> page. 
                        A rate above 70% means caching is working well.
                    </p>
                </div>
            </div>
            
            <!-- Troubleshooting -->
            <div class="postbox">
                <h2 class="hndle">Troubleshooting</h2>
                <div class="inside">
                    <h3>Calculator not appearing</h3>
                    <ul>
                        <li>Check that you've entered your API key in settings</li>
                        <li>Test API connection using "Test Connection" button</li>
                        <li>Clear browser cache and WordPress cache</li>
                        <li>Check browser console for JavaScript errors</li>
                    </ul>
                    
                    <h3>"API key not configured" error</h3>
                    <ul>
                        <li>Go to <strong>Prime Self → Settings</strong></li>
                        <li>Enter your API key</li>
                        <li>Click "Save Settings"</li>
                        <li>Click "Test Connection" to verify</li>
                    </ul>
                    
                    <h3>"Rate limit exceeded" error</h3>
                    <ul>
                        <li>Enable caching to reduce API calls</li>
                        <li>Upgrade to a higher API tier</li>
                        <li>Check <a href="<?php echo admin_url('admin.php?page=primeself-stats'); ?>">Usage Stats</a> to see request volume</li>
                    </ul>
                    
                    <h3>Chart not loading</h3>
                    <ul>
                        <li>Check your internet connection</li>
                        <li>Verify API key is valid (not expired)</li>
                        <li>Disable conflicting plugins (security/firewall plugins that block API calls)</li>
                        <li>Check server PHP error logs</li>
                    </ul>
                </div>
            </div>
        </div>
        
        <div class="primeself-docs-sidebar">
            <!-- Quick Links -->
            <div class="postbox">
                <h3 class="hndle">Quick Links</h3>
                <div class="inside">
                    <ul>
                        <li><a href="#shortcodes">Shortcodes</a></li>
                        <li><a href="#widget-usage">Widget Usage</a></li>
                        <li><a href="#styling">Styling & Customization</a></li>
                        <li><a href="#api">API Integration</a></li>
                        <li><a href="#performance">Performance Tips</a></li>
                        <li><a href="#troubleshooting">Troubleshooting</a></li>
                    </ul>
                </div>
            </div>
            
            <!-- External Resources -->
            <div class="postbox">
                <h3 class="hndle">External Resources</h3>
                <div class="inside">
                    <ul>
                        <li><a href="https://primeself.app/docs" target="_blank">Full Documentation</a></li>
                        <li><a href="https://primeself.app/api" target="_blank">API Docs</a></li>
                        <li><a href="https://primeself.app/support" target="_blank">Support Forum</a></li>
                        <li><a href="https://primeself.app/changelog" target="_blank">Changelog</a></li>
                    </ul>
                </div>
            </div>
            
            <!-- Support -->
            <div class="postbox">
                <h3 class="hndle">Need Help?</h3>
                <div class="inside">
                    <p>
                        Email: <a href="mailto:support@primeself.app">support@primeself.app</a><br>
                        Response time: Usually within 24 hours
                    </p>
                    <p>
                        <a href="https://primeself.app/support" target="_blank" class="button button-primary">
                            Get Support
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.primeself-docs-grid {
    display: flex;
    gap: 20px;
    margin-top: 20px;
}

.primeself-docs-main {
    flex: 1;
    max-width: 900px;
}

.primeself-docs-sidebar {
    width: 250px;
    flex-shrink: 0;
}

.primeself-docs-sidebar ul {
    margin: 0;
    padding-left: 20px;
}

.primeself-docs-sidebar li {
    margin-bottom: 8px;
}

@media (max-width: 782px) {
    .primeself-docs-grid {
        flex-direction: column;
    }
    
    .primeself-docs-sidebar {
        width: 100%;
    }
}
</style>
