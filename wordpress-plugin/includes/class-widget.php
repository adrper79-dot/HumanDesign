<?php
/**
 * Prime Self Chart Widget
 * 
 * Sidebar/footer widget for displaying Human Design chart calculator
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class PrimeSelf_Chart_Widget extends WP_Widget {
    
    /**
     * Constructor
     */
    public function __construct() {
        parent::__construct(
            'primeself_chart_widget',
            'Prime Self - Chart Calculator',
            array(
                'description' => 'Display a Human Design chart calculator in your sidebar',
                'classname' => 'primeself-chart-widget'
            )
        );
    }
    
    /**
     * Widget front-end display
     */
    public function widget($args, $instance) {
        $title = !empty($instance['title']) ? $instance['title'] : 'Calculate Your Chart';
        $style = !empty($instance['style']) ? $instance['style'] : 'compact';
        $show_description = !empty($instance['show_description']);
        
        echo $args['before_widget'];
        
        if (!empty($title)) {
            echo $args['before_title'] . esc_html($title) . $args['after_title'];
        }
        
        if ($show_description) {
            echo '<p class="primeself-widget-description">';
            echo esc_html(!empty($instance['description']) 
                ? $instance['description'] 
                : 'Discover your unique Human Design blueprint');
            echo '</p>';
        }
        
        // Use shortcode to render calculator
        echo do_shortcode('[primeself_chart style="' . esc_attr($style) . '"]');
        
        echo $args['after_widget'];
    }
    
    /**
     * Widget settings form
     */
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : 'Calculate Your Chart';
        $description = !empty($instance['description']) ? $instance['description'] : '';
        $style = !empty($instance['style']) ? $instance['style'] : 'compact';
        $show_description = !empty($instance['show_description']);
        ?>
        
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>">
                Title:
            </label>
            <input class="widefat" 
                   type="text" 
                   id="<?php echo esc_attr($this->get_field_id('title')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('title')); ?>" 
                   value="<?php echo esc_attr($title); ?>">
        </p>
        
        <p>
            <input type="checkbox" 
                   id="<?php echo esc_attr($this->get_field_id('show_description')); ?>" 
                   name="<?php echo esc_attr($this->get_field_name('show_description')); ?>" 
                   <?php checked($show_description); ?>>
            <label for="<?php echo esc_attr($this->get_field_id('show_description')); ?>">
                Show description
            </label>
        </p>
        
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('description')); ?>">
                Description:
            </label>
            <textarea class="widefat" 
                      id="<?php echo esc_attr($this->get_field_id('description')); ?>" 
                      name="<?php echo esc_attr($this->get_field_name('description')); ?>" 
                      rows="3"><?php echo esc_textarea($description); ?></textarea>
        </p>
        
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('style')); ?>">
                Widget Style:
            </label>
            <select class="widefat" 
                    id="<?php echo esc_attr($this->get_field_id('style')); ?>" 
                    name="<?php echo esc_attr($this->get_field_name('style')); ?>">
                <option value="compact" <?php selected($style, 'compact'); ?>>Compact</option>
                <option value="modern" <?php selected($style, 'modern'); ?>>Modern</option>
                <option value="minimal" <?php selected($style, 'minimal'); ?>>Minimal</option>
            </select>
        </p>
        
        <?php
    }
    
    /**
     * Save widget settings
     */
    public function update($new_instance, $old_instance) {
        $instance = array();
        $instance['title'] = !empty($new_instance['title']) ? strip_tags($new_instance['title']) : '';
        $instance['description'] = !empty($new_instance['description']) ? strip_tags($new_instance['description']) : '';
        $instance['style'] = !empty($new_instance['style']) ? strip_tags($new_instance['style']) : 'compact';
        $instance['show_description'] = !empty($new_instance['show_description']);
        
        return $instance;
    }
}
