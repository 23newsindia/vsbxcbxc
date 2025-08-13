<?php
// Force Nasa filter widget to output bot-safe URLs
add_filter('widget_display_callback', function($instance, $widget, $args) {
    if ($widget->id_base === 'nasa_woocommerce_filter_variations') {
        ob_start();
        $widget->widget($args, $instance);
        $output = ob_get_clean();

        // Replace href with data-filter-url (for all links containing filter_)
        $output = preg_replace_callback(
            '/<a\s+([^>]*href="([^"]+)"[^>]*)>/i',
            function($matches) {
                $link = html_entity_decode($matches[2]);
                if (strpos($link, 'filter_') !== false) {
                    return '<a ' . preg_replace(
                        '/href="[^"]*"/',
                        'href="#" data-filter-url="' . esc_url($link) . '"',
                        $matches[1]
                    ) . '>';
                }
                return $matches[0];
            },
            $output
        );

        echo $output;
        return false; // Prevent default widget output
    }
    return $instance;
}, 10, 3);
