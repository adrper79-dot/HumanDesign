<?php
/**
 * Prime Self API Client
 * 
 * Handles communication with Prime Self API
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class PrimeSelf_API_Client {
    
    /**
     * API base URL
     */
    const API_BASE_URL = 'https://api.primeself.app';
    
    /**
     * Make API request
     */
    public static function request($endpoint, $method = 'GET', $data = null) {
        $api_key = get_option('primeself_api_key');
        
        if (empty($api_key)) {
            return new WP_Error('no_api_key', 'API key not configured');
        }
        
        $url = self::API_BASE_URL . $endpoint;
        
        $args = array(
            'method' => $method,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key' => $api_key,
                'User-Agent' => 'PrimeSelf-WordPress/' . PRIMESELF_VERSION
            ),
            'timeout' => 15
        );
        
        if ($data !== null && in_array($method, array('POST', 'PUT', 'PATCH'))) {
            $args['body'] = json_encode($data);
        }
        
        $response = wp_remote_request($url, $args);
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code >= 400) {
            $error_data = json_decode($body, true);
            return new WP_Error(
                'api_error',
                $error_data['error'] ?? 'API request failed',
                array('status' => $status_code)
            );
        }
        
        return json_decode($body, true);
    }
    
    /**
     * Calculate chart
     */
    public static function calculate_chart($birth_data) {
        return self::request('/api/chart/calculate', 'POST', $birth_data);
    }
    
    /**
     * Get gate information
     */
    public static function get_gate($gate_number) {
        return self::request("/api/gates/{$gate_number}");
    }
    
    /**
     * Validate API key
     */
    public static function validate_api_key($api_key = null) {
        $key_to_test = $api_key ?? get_option('primeself_api_key');
        
        if (empty($key_to_test)) {
            return false;
        }
        
        // Store current key
        $current_key = get_option('primeself_api_key');
        
        // Temporarily set test key
        update_option('primeself_api_key', $key_to_test);
        
        // Try a simple request
        $result = self::request('/api/gates/1');
        
        // Restore original key
        update_option('primeself_api_key', $current_key);
        
        return !is_wp_error($result);
    }
    
    /**
     * Get API usage stats
     */
    public static function get_usage_stats() {
        // Fetch from Prime Self API if endpoint exists
        // For now, return local stats
        global $wpdb;
        $table_name = $wpdb->prefix . 'primeself_charts';
        
        $total_requests = $wpdb->get_var("SELECT SUM(hit_count) FROM $table_name");
        $unique_charts = $wpdb->get_var("SELECT COUNT(*) FROM $table_name");
        
        return array(
            'totalRequests' => (int) $total_requests,
            'uniqueCharts' => (int) $unique_charts,
            'period' => 'all_time'
        );
    }
}
