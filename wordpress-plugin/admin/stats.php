<?php
/**
 * Admin Stats Page
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;
$table_name = $wpdb->prefix . 'primeself_charts';

// Get stats
$total_charts = $wpdb->get_var("SELECT COUNT(*) FROM $table_name");
$total_hits = $wpdb->get_var("SELECT SUM(hit_count) FROM $table_name");
$cache_hit_rate = $total_hits > 0 ? (($total_hits - $total_charts) / $total_hits) * 100 : 0;
$active_cache = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE expires_at > NOW()");
$expired_cache = $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE expires_at <= NOW()");

// Recent activity (last 30 days)
$recent_charts = $wpdb->get_results(
    "SELECT DATE(created_at) as date, COUNT(*) as count, SUM(hit_count) as hits
     FROM $table_name 
     WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date DESC",
    ARRAY_A
);

// Top cached charts
$top_charts = $wpdb->get_results(
    "SELECT birth_location, hit_count, created_at
     FROM $table_name 
     WHERE expires_at > NOW()
     ORDER BY hit_count DESC
     LIMIT 10",
    ARRAY_A
);
?>

<div class="wrap primeself-admin">
    <h1>
        <span class="dashicons dashicons-chart-bar"></span>
        Usage & Statistics
    </h1>
    
    <div class="primeself-stats-grid">
        <!-- Overview Cards -->
        <div class="primeself-stat-card">
            <div class="primeself-stat-icon">
                <span class="dashicons dashicons-chart-line"></span>
            </div>
            <div class="primeself-stat-content">
                <h3><?php echo number_format($total_charts); ?></h3>
                <p>Unique Charts</p>
            </div>
        </div>
        
        <div class="primeself-stat-card">
            <div class="primeself-stat-icon">
                <span class="dashicons dashicons-update"></span>
            </div>
            <div class="primeself-stat-content">
                <h3><?php echo number_format($total_hits); ?></h3>
                <p>Total Requests</p>
            </div>
        </div>
        
        <div class="primeself-stat-card">
            <div class="primeself-stat-icon">
                <span class="dashicons dashicons-performance"></span>
            </div>
            <div class="primeself-stat-content">
                <h3><?php echo round($cache_hit_rate, 1); ?>%</h3>
                <p>Cache Hit Rate</p>
            </div>
        </div>
        
        <div class="primeself-stat-card">
            <div class="primeself-stat-icon">
                <span class="dashicons dashicons-database"></span>
            </div>
            <div class="primeself-stat-content">
                <h3><?php echo number_format($active_cache); ?></h3>
                <p>Cached Charts</p>
            </div>
        </div>
    </div>
    
    <!-- Recent Activity Chart -->
    <div class="postbox" style="margin-top: 20px;">
        <h2 class="hndle">Recent Activity (Last 30 Days)</h2>
        <div class="inside">
            <?php if (!empty($recent_charts)): ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>New Charts</th>
                        <th>Total Hits</th>
                        <th>Cache Effectiveness</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recent_charts as $row): ?>
                    <tr>
                        <td><?php echo esc_html(date('M j, Y', strtotime($row['date']))); ?></td>
                        <td><?php echo number_format($row['count']); ?></td>
                        <td><?php echo number_format($row['hits']); ?></td>
                        <td>
                            <?php 
                            $effectiveness = $row['count'] > 0 ? (($row['hits'] - $row['count']) / $row['hits']) * 100 : 0;
                            echo round($effectiveness, 1); 
                            ?>%
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
            <p>No activity in the last 30 days.</p>
            <?php endif; ?>
        </div>
    </div>
    
    <!-- Top Cached Charts -->
    <div class="postbox" style="margin-top: 20px;">
        <h2 class="hndle">Most Popular Charts</h2>
        <div class="inside">
            <?php if (!empty($top_charts)): ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Location</th>
                        <th>Times Accessed</th>
                        <th>First Calculated</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($top_charts as $chart): ?>
                    <tr>
                        <td><?php echo esc_html($chart['birth_location']); ?></td>
                        <td><?php echo number_format($chart['hit_count']); ?> times</td>
                        <td><?php echo esc_html(date('M j, Y', strtotime($chart['created_at']))); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php else: ?>
            <p>No cached charts yet.</p>
            <?php endif; ?>
        </div>
    </div>
    
    <!-- Cache Management -->
    <div class="postbox" style="margin-top: 20px;">
        <h2 class="hndle">Cache Management</h2>
        <div class="inside">
            <p>
                <strong>Active Cache:</strong> <?php echo number_format($active_cache); ?> charts<br>
                <strong>Expired Cache:</strong> <?php echo number_format($expired_cache); ?> charts
            </p>
            
            <form method="post">
                <?php wp_nonce_field('primeself_clear_cache'); ?>
                <button type="submit" 
                        name="primeself_clear_cache" 
                        class="button button-secondary"
                        onclick="return confirm('Are you sure you want to clear expired cache entries?');">
                    <span class="dashicons dashicons-trash"></span>
                    Clear Expired Cache (<?php echo $expired_cache; ?> entries)
                </button>
            </form>
            
            <p class="description" style="margin-top: 10px;">
                Clearing expired cache helps keep your database clean. Active cache entries will not be affected.
            </p>
        </div>
    </div>
</div>

<style>
.primeself-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.primeself-stat-card {
    display: flex;
    align-items: center;
    gap: 15px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.primeself-stat-icon {
    font-size: 32px;
    color: #6366f1;
}

.primeself-stat-icon .dashicons {
    width: 40px;
    height: 40px;
    font-size: 40px;
}

.primeself-stat-content h3 {
    margin: 0 0 5px 0;
    font-size: 28px;
    font-weight: 600;
    color: #1e3a8a;
}

.primeself-stat-content p {
    margin: 0;
    color: #666;
    font-size: 13px;
    font-weight: 500;
}
</style>
