// Modern WooCommerce Filter System
window.nasaFilters = {
    filterText: 'Filter by:',
    showMoreText: 'More +',
    showLessText: 'Less -',
    limitWidgets: 4
};

class NasaFilterSystem {
    constructor() {
        this.initialized = false;
        this.filterAccordion = null;
        this.topSidebar = null;
        this.widgets = new Map();
        this.activeWidget = null;
        this.shop_load = false;
        this.shop_load_more = false;
        this._scroll_to_top = true;
        
        // Add protection limits
        this.maxFiltersPerType = 5;
        this.maxTotalFilters = 8;
        this.requestDelay = 300;
        this.lastRequestTime = 0;
        this.blockedCombinations = new Set();
    }

    init() {
        if (this.initialized) return;

        // Get filter values from hidden inputs
        const filterText = document.querySelector('[name="nasa-labels-filter-text"]')?.value;
        const showMoreText = document.querySelector('[name="nasa-widget-show-more-text"]')?.value;
        const showLessText = document.querySelector('[name="nasa-widget-show-less-text"]')?.value;
        const limitWidgets = document.querySelector('[name="nasa-limit-widgets-show-more"]')?.value;

        // Update filter values if found
        if (filterText) window.nasaFilters.filterText = filterText;
        if (showMoreText) window.nasaFilters.showMoreText = showMoreText;
        if (showLessText) window.nasaFilters.showLessText = showLessText;
        if (limitWidgets) window.nasaFilters.limitWidgets = parseInt(limitWidgets, 10);

        // Initialize core components
        this.initializeComponents();
        
        // Only proceed if components were initialized successfully
        if (this.filterAccordion && this.topSidebar) {
            this.setupEventListeners();
            this.setupOrderingSystem();
            this.initialized = true;
        }
    }

    initializeComponents() {
        // Find main filter elements
        this.filterAccordion = document.querySelector('.nasa-labels-filter-accordion');
        this.topSidebar = document.querySelector('.nasa-top-sidebar');

        // Add this check and return early if elements missing
        if (!this.filterAccordion || !this.topSidebar) {
            console.warn('Required filter elements not found');
            this.initialized = false;
            return;
        }

        // Remove hidden-tag from main sidebar to ensure it's visible on desktop
        this.topSidebar.classList.remove('hidden-tag');

        // Add necessary classes to filter accordion
        this.filterAccordion.classList.add('nasa-flex', 'nasa-inited');

        // Handle mobile filter toggle visibility based on screen size
        const mobileToggles = document.querySelectorAll('.toggle-topbar-shop-mobile');
        const isMobile = window.matchMedia("(max-width: 767px)").matches;

        mobileToggles.forEach(el => {
            if (isMobile) {
                el.classList.remove('hidden-tag');
            } else {
                el.classList.add('hidden-tag');
            }
        });

        // Add missing classes to elements
        document.querySelectorAll('.nasa-labels-filter-accordion').forEach(el => {
            el.classList.add('nasa-inited');
        });

        document.querySelectorAll('.nasa-top-sidebar').forEach(el => {
            el.classList.add('nasa-top-sidebar-desktop');
        });

        // Add row wrapper for widgets only
        if (!this.topSidebar.querySelector('.row')) {
            const row = document.createElement('div');
            row.className = 'row nasa-show nasa-top-sidebar-off-canvas';

            // Move only widgets into the row
            Array.from(this.topSidebar.children).forEach(child => {
                if (
                    child.classList.contains('widget') ||
                    child.classList.contains('nasa-widget-wrap') ||
                    child.id === 'nasa_woocommerce_filter_variations-4'
                ) {
                    row.appendChild(child);
                }
            });

            this.topSidebar.appendChild(row);
        }

        // Remove hidden-tag from filter header and close button
        const sidebarHeader = this.topSidebar.querySelector('.ns-sidebar-heading.hidden-tag');
        if (sidebarHeader) {
            sidebarHeader.classList.remove('hidden-tag');
        }

        const closeButton = this.topSidebar.querySelector('.nasa-close-sidebar.hidden-tag');
        if (closeButton) {
            closeButton.classList.remove('hidden-tag');
        }

        // Add mobile-only elements handling
        const closeSidebarWrap = this.topSidebar.querySelector('.nasa-close-sidebar-wrap');
        if (closeSidebarWrap) {
            closeSidebarWrap.classList.add('nasa-mobile-only');
            this.updateMobileElementsVisibility();
            window.addEventListener('resize', () => this.updateMobileElementsVisibility());
        }
        
        // Add clear button to sidebar (Mobile)
        const clearBtnMobile = this.topSidebar.querySelector('.nasa-clear-filters-mobile');
        if (!clearBtnMobile && this.topSidebar) {
            const clearWrap = document.createElement('div');
            clearWrap.className = 'nasa-clear-filters-mobile nasa-mobile-only';
            clearWrap.innerHTML = `
                <a href="javascript:void(0);" class="nasa-reset-filters-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.984 6.422l-5.578 5.578 5.578 5.578-1.406 1.406-5.578-5.578-5.578 5.578-1.406-1.406 5.578-5.578-5.578-5.578 1.406-1.406 5.578 5.578 5.578-5.578z"/>
                    </svg>
                    Clear Filters
                </a>
            `;
            this.topSidebar.insertBefore(clearWrap, this.topSidebar.firstChild);
        }

        // Initialize widgets
        this.initializeWidgets();
        this.createFilterInterface();

        // Fix filter URLs - this is the key fix
        this.fixFilterUrls();
    }

    // NEW METHOD: Fix filter URLs to work properly
    fixFilterUrls() {
        document.querySelectorAll('.nasa-filter-by-attrs, .nasa-filter-by-variations').forEach(link => {
            const realUrl = link.getAttribute('data-filter-url') || link.getAttribute('href');
            
            // Only process if we have a real filter URL
            if (realUrl && realUrl !== '#' && realUrl.includes('filter_')) {
                // Store the real URL in data attribute
                link.setAttribute('data-filter-url', realUrl);
                // Set href to # to prevent default navigation
                link.setAttribute('href', '#');
                // Add our custom class for identification
                link.classList.add('nasa-ajax-filter');
            }
        });
    }

    updateMobileElementsVisibility() {
        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        
        const closeSidebarWrap = this.topSidebar.querySelector('.nasa-close-sidebar-wrap');
        if (closeSidebarWrap) {
            closeSidebarWrap.style.display = isMobile ? 'block' : 'none';
        }
        
        document.querySelectorAll('.nasa-clear-filters-mobile').forEach(el => {
            el.style.display = isMobile ? 'block' : 'none';
        });
    }

    initializeWidgetContent(widget) {
        // Create content box if missing
        let contentWrap = widget.querySelector('.nasa-filter-variations-widget-wrap');
        if (!contentWrap) {
            contentWrap = document.createElement('div');
            contentWrap.className = 'nasa-filter-variations-widget-wrap';
            contentWrap.innerHTML = widget.innerHTML;
            widget.innerHTML = '';
            widget.appendChild(contentWrap);
        }

        // Add toggle button if missing
        let toggleBtn = widget.querySelector('.nasa-toggle-widget');
        if (!toggleBtn) {
            toggleBtn = document.createElement('a');
            toggleBtn.href = 'javascript:void(0);';
            toggleBtn.className = 'nasa-toggle-widget';
            widget.insertBefore(toggleBtn, widget.firstChild);
        }

        // Add open/close switch and wrap content
        let openToggle = widget.querySelector('.nasa-open-toggle');
        if (!openToggle) {
            openToggle = document.createElement('div');
            openToggle.className = 'nasa-open-toggle';
            openToggle.style.display = 'block';
            
            const existingContent = widget.querySelector('.nasa-filter-variations-widget-wrap');
            if (existingContent) {
                openToggle.appendChild(existingContent);
            }
            
            widget.appendChild(openToggle);
        }

        // Ensure title comes after toggle button
        const title = widget.querySelector('.widget-title');
        if (title && title.previousElementSibling !== toggleBtn) {
            widget.insertBefore(title, toggleBtn.nextSibling);
        }
        
        // Initialize price slider if needed
        if (widget.classList.contains('widget_price_filter')) {
            this.setupPriceFilter(widget);
        }
    }

    setupPriceFilter(widget) {
        const priceSlider = widget.querySelector('.price_slider');
        if (!priceSlider) return;

        const minPrice = widget.querySelector('#min_price');
        const maxPrice = widget.querySelector('#max_price');
        const form = priceSlider.closest('form');

        if (!minPrice || !maxPrice || !form) return;

        // Create slider container
        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'price_slider_wrapper';

        // Create slider elements
        const range = document.createElement('div');
        range.className = 'price_slider ui-slider ui-corner-all ui-slider-horizontal ui-widget ui-widget-content';
        
        const rangeBar = document.createElement('div');
        rangeBar.className = 'ui-slider-range ui-corner-all ui-widget-header';
        
        const handleMin = document.createElement('span');
        handleMin.className = 'ui-slider-handle ui-corner-all ui-state-default';
        
        const handleMax = document.createElement('span');
        handleMax.className = 'ui-slider-handle ui-corner-all ui-state-default';

        // Build slider structure
        range.appendChild(rangeBar);
        range.appendChild(handleMin);
        range.appendChild(handleMax);
        sliderWrapper.appendChild(range);

        // Replace original slider with our custom slider
        priceSlider.parentNode.replaceChild(sliderWrapper, priceSlider);

        // Initialize slider values
        const min = parseFloat(minPrice.dataset.min);
        const max = parseFloat(maxPrice.dataset.max);
        const currentMin = parseFloat(minPrice.value);
        const currentMax = parseFloat(maxPrice.value);

        this.initializeSlider(range, rangeBar, handleMin, handleMax, {
            min,
            max,
            current_min: currentMin,
            current_max: currentMax
        });
    }

    initializeWidgets() {
        this.widgets.clear();

        const widgetElements = this.topSidebar.querySelectorAll('.widget');
        widgetElements.forEach((widget, index) => {
            const type = this.getWidgetType(widget);
            if (!this.widgets.has(type)) {
                this.initializeWidgetContent(widget);
                const wrapper = this.createWidgetWrapper(widget, index);
                this.widgets.set(type, wrapper);
            }
        });
    }

    getWidgetType(widget) {
        const id = widget.getAttribute('id') || '';
        const classList = Array.from(widget.classList);
        
        if (classList.includes('widget_layered_nav')) return 'layered_nav';
        if (classList.includes('widget_price_filter')) return 'price_filter';
        if (classList.includes('widget_product_categories')) return 'categories';
        
        return id.split('-')[0] || 'unknown';
    }

    createWidgetWrapper(widget, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'nasa-widget-wrap';
        wrapper.id = `nasa-widget-key-${index}`;
        wrapper.dataset.old_id = widget.id || '';
        
        widget.classList.add('nasa-widget-has-active', 'nasa-inited');
        
        widget.parentNode.insertBefore(wrapper, widget);
        wrapper.appendChild(widget);

        return wrapper;
    }

    createFilterInterface() {
        const filterRow = document.createElement('ul');
        filterRow.className = 'nasa-top-row-filter';

        // Add filter label
        filterRow.appendChild(this.createFilterLabel());

        // Add widget tabs
        Array.from(this.widgets.values()).forEach((wrapper, index) => {
            filterRow.appendChild(this.createWidgetTab(wrapper, index));
        });

        // Add show more button if needed
        if (this.widgets.size > window.nasaFilters.limitWidgets) {
            filterRow.appendChild(this.createShowMoreButton());
        }

        // Add results count
        filterRow.appendChild(this.createResultsCount());

        // Clear and update filter accordion
        this.filterAccordion.innerHTML = '';
        this.filterAccordion.appendChild(filterRow);
    }

    createFilterLabel() {
        const li = document.createElement('li');
        li.innerHTML = `<span class="nasa-labels-filter-text">${window.nasaFilters.filterText}</span>`;
        return li;
    }

    createWidgetTab(wrapper, index) {
        const widget = wrapper.querySelector('.widget');
        const title = widget.querySelector('.widget-title')?.textContent?.trim() || 'Filter';
        const isCategory = widget.querySelector('.product-categories, .nasa-widget-filter-cats-topbar');

        const li = document.createElement('li');
        li.className = `nasa-widget-toggle nasa-widget-show${index >= window.nasaFilters.limitWidgets ? ' nasa-widget-show-less' : ''}`;
        if (isCategory) li.classList.add('nasa-widget-categories');

        const link = document.createElement('a');
        link.className = isCategory ? 'nasa-tab-filter-topbar nasa-tab-push-cats' : 'nasa-tab-filter-topbar';
        link.href = 'javascript:void(0);';
        link.title = title;
        link.dataset.widget = `#${wrapper.id}`;
        link.dataset.key = index.toString();
        link.dataset.old_id = wrapper.dataset.old_id;

        link.innerHTML = `
            ${isCategory ? this.getPushIcon() : ''}
            ${title}
            ${!isCategory ? this.getDropdownIcon() : ''}
        `;

        li.appendChild(link);
        return li;
    }

    createShowMoreButton() {
        const li = document.createElement('li');
        li.className = 'nasa-widget-show-more';
        
        const link = document.createElement('a');
        link.className = 'nasa-widget-toggle-show';
        link.href = 'javascript:void(0);';
        link.dataset.show = '0';
        link.textContent = window.nasaFilters.showMoreText;
        
        li.appendChild(link);
        return li;
    }

    createResultsCount() {
        const li = document.createElement('li');
        li.className = 'last nasa-flex';
        
        const resultCount = document.querySelector('.woocommerce-result-count');
        if (resultCount) {
            const countWrapper = document.createElement('div');
            countWrapper.className = 'showing_info_top';
            countWrapper.innerHTML = resultCount.outerHTML;
            
            const clearBtn = document.createElement('div');
            clearBtn.className = 'nasa-clear-filters-desktop nasa-desktop-only';
            clearBtn.innerHTML = `
                <a href="javascript:void(0);" class="nasa-reset-filters-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.984 6.422l-5.578 5.578 5.578 5.578-1.406 1.406-5.578-5.578-5.578 5.578-1.406-1.406 5.578-5.578-5.578-5.578 1.406-1.406 5.578 5.578 5.578-5.578z"/>
                    </svg>
                    Clear Filters
                </a>
            `;
            
            li.appendChild(countWrapper);
            li.appendChild(clearBtn);
        }
        
        return li;
    }

    setupOrderingSystem() {
        const orderingWrap = document.querySelector('.woocommerce-ordering');
        if (!orderingWrap) return;

        const select = orderingWrap.querySelector('select');
        if (!select) return;

        select.addEventListener('change', function() {
            const form = this.closest('form');
            if (form) {
                form.submit();
            }
        });

        const currentValue = select.value;
        const options = Array.from(select.options);

        const nasaOrdering = document.createElement('div');
        nasaOrdering.className = 'nasa-ordering';

        const currentOrderBy = document.createElement('a');
        currentOrderBy.className = 'nasa-current-orderby nasa-bold-700';
        currentOrderBy.href = 'javascript:void(0);';
        currentOrderBy.textContent = options.find(opt => opt.value === currentValue)?.textContent || 'Default sorting';

        const subOrdering = document.createElement('div');
        subOrdering.className = 'sub-ordering';

        options.forEach(option => {
            const link = document.createElement('a');
            link.href = 'javascript:void(0);';
            link.dataset.value = option.value;
            link.className = `nasa-orderby${option.value === currentValue ? ' nasa-active' : ''}`;
            link.textContent = option.textContent;
            subOrdering.appendChild(link);
        });

        nasaOrdering.appendChild(currentOrderBy);
        nasaOrdering.appendChild(subOrdering);

        select.style.display = 'none';
        orderingWrap.appendChild(nasaOrdering);
    }

    setupEventListeners() {
        if (!this.filterAccordion) return;

        // Filter tab clicks
        this.filterAccordion.addEventListener('click', (e) => {
            const tab = e.target.closest('.nasa-tab-filter-topbar');
            if (!tab) return;

            e.preventDefault();
            e.stopPropagation();

            if (tab.classList.contains('nasa-tab-push-cats')) {
                this.handleCategoryPush(tab);
            } else {
                this.handleWidgetToggle(tab);
            }
        });

        // Show more button clicks
        this.filterAccordion.addEventListener('click', (e) => {
            const showMoreBtn = e.target.closest('.nasa-widget-toggle-show');
            if (!showMoreBtn) return;

            e.preventDefault();
            const isShowing = showMoreBtn.dataset.show === '1';

            document.querySelectorAll('.nasa-widget-toggle.nasa-widget-show-less')
                .forEach(item => item.style.display = isShowing ? 'none' : 'block');

            showMoreBtn.dataset.show = isShowing ? '0' : '1';
            showMoreBtn.textContent = isShowing ? window.nasaFilters.showMoreText : window.nasaFilters.showLessText;
        });

        // MAIN FILTER CLICK HANDLER - This is the key fix
        document.addEventListener('click', (e) => {
            // Handle filter clicks with proper URL processing
            const filterLink = e.target.closest('.nasa-ajax-filter, .nasa-filter-by-attrs, .nasa-filter-by-variations');
            if (filterLink) {
                e.preventDefault();
                e.stopPropagation();
                
                if (!this.validateFilterClick(filterLink)) {
                    console.log('Filter click blocked');
                    return;
                }

                const realUrl = filterLink.getAttribute('data-filter-url');
                if (realUrl && realUrl !== '#') {
                    this.handleFilterClick(realUrl);
                }
                return;
            }

            // Ordering click handlers
            const orderbyLink = e.target.closest('.nasa-orderby');
            if (orderbyLink) {
                e.preventDefault();
                const value = orderbyLink.dataset.value;
                const select = document.querySelector('.woocommerce-ordering select');
                if (select) {
                    select.value = value;
                    const form = select.closest('form');
                    if (form) {
                        form.submit();
                    }
                }

                const currentOrderby = orderbyLink.closest('.nasa-ordering').querySelector('.nasa-current-orderby');
                if (currentOrderby) {
                    currentOrderby.textContent = orderbyLink.textContent;
                }

                document.querySelectorAll('.nasa-orderby').forEach(link => {
                    link.classList.toggle('nasa-active', link === orderbyLink);
                });
            }

            // Filter reset handler
            const resetBtn = e.target.closest('.nasa-reset-filters-btn');
            if (resetBtn) {
                e.preventDefault();
                this.resetFilters();
            }

            // Close tab handler for filter widgets
            const closeBtn = e.target.closest('.nasa-close-tab');
            if (closeBtn) {
                const tabToClose = closeBtn.closest('.nasa-tab');
                if (tabToClose) {
                    tabToClose.classList.remove('active');

                    if (this.activeWidget) {
                        this.activeWidget.classList.remove('nasa-active');
                        this.activeWidget.style.display = 'none';
                    }

                    const tabId = tabToClose.id;
                    const correspondingTab = this.filterAccordion.querySelector(`[data-widget="#${tabId}"]`);
                    if (correspondingTab) {
                        correspondingTab.classList.remove('nasa-active');
                    }
                }
            }

            // Toggle widget handler
            const toggleBtn = e.target.closest('.nasa-toggle-widget');
            if (toggleBtn) {
                e.preventDefault();
                const widget = toggleBtn.closest('.widget');
                if (!widget) return;

                const openToggle = widget.querySelector('.nasa-open-toggle');
                if (!openToggle) return;

                if (openToggle.style.display === 'none') {
                    openToggle.style.display = 'block';
                    toggleBtn.classList.remove('nasa-hide');
                } else {
                    openToggle.style.display = 'none';
                    toggleBtn.classList.add('nasa-hide');
                }
            }
        });

        // Mobile filter setup
        this.setupMobileFilters();
    }

    validateFilterClick(filterLink) {
        const now = Date.now();
        if (now - this.lastRequestTime < this.requestDelay) {
            return false;
        }
        
        const href = filterLink.href || '';
        if (href.length > 500) {
            return false;
        }
        
        if (this.detectBotBehavior()) {
            return false;
        }
        
        return true;
    }
    
    detectBotBehavior() {
        const userAgent = navigator.userAgent.toLowerCase();
        const botPatterns = ['bot', 'crawler', 'spider', 'scraper'];
        
        return botPatterns.some(pattern => userAgent.includes(pattern));
    }

    handleWidgetToggle(tab) {
        const widgetId = tab.dataset.widget;
        const widget = document.querySelector(widgetId);
        if (!widget) return;

        const sidebar = document.querySelector('.nasa-top-sidebar');
        if (!sidebar) return;

        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        const wasActive = tab.classList.contains('nasa-active');

        // Reset all widgets
        this.widgets.forEach(wrapper => {
            wrapper.classList.remove('nasa-active');
            wrapper.style.display = 'none';
            
            const w = wrapper.querySelector('.widget');
            if (w) {
                w.classList.remove('nasa-active');
                w.querySelectorAll('.nasa-filter-variations-widget-wrap, .widget-content')
                    .forEach(content => content.style.display = 'none');
            }
        });

        // Toggle current widget
        if (!wasActive) {
            widget.classList.add('nasa-active');
            widget.style.display = 'block';
            
            const widgetInner = widget.querySelector('.widget');
            if (widgetInner) {
                widgetInner.classList.add('nasa-active');
                widgetInner.querySelectorAll('.nasa-filter-variations-widget-wrap, .widget-content')
                    .forEach(content => content.style.display = 'block');
            }
            
            tab.classList.add('nasa-active');
            this.activeWidget = widget;

            if (isMobile) {
                sidebar.classList.remove('hidden-tag');
            }
        } else {
            tab.classList.remove('nasa-active');
            widget.classList.remove('nasa-active', 'nasa-show', 'nasa-open');
            widget.style.display = 'none';
            this.activeWidget = null;

            if (isMobile) {
                sidebar.classList.add('hidden-tag');
            }
        }
    }

    handleCategoryPush(tab) {
        tab.classList.toggle('nasa-push-cat-show');
        
        ['.nasa-push-cat-filter', '.nasa-products-page-wrap', '.black-window-mobile']
            .forEach(selector => {
                const element = document.querySelector(selector);
                if (element) element.classList.toggle('nasa-push-cat-show');
            });
    }

    async handleFilterClick(url) {
        // Validate URL BEFORE processing
        if (!this.validateFilterUrl(url)) {
            console.log('Filter URL blocked - invalid combination');
            return;
        }
        
        // Check if this combination is known to be empty
        const urlKey = this.getUrlKey(url);
        if (this.blockedCombinations && this.blockedCombinations.has(urlKey)) {
            console.log('Filter combination blocked - no products');
            return;
        }
        
        document.body.classList.add('nasa-loading');
        
        try {
            const response = await fetch(url);
            const html = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Check if products exist BEFORE updating anything
            const products = doc.querySelector('.products');
            const noProductsMessage = doc.querySelector('.woocommerce-info, .nasa-archive-no-result, .woocommerce-no-products-found');
            
            // If no products found, don't update URL or history
            if (!products || products.children.length === 0 || noProductsMessage) {
                console.log('No products found - not updating URL');
                
                // Remember this combination is empty
                if (!this.blockedCombinations) this.blockedCombinations = new Set();
                this.blockedCombinations.add(urlKey);
                
                return;
            }
            
            // Update products
            if (products) {
                document.querySelector('.products').innerHTML = products.innerHTML;
            }
            
            // Update filters
            const newFilters = doc.querySelector('.nasa-top-sidebar');
            if (newFilters) {
                this.topSidebar.innerHTML = newFilters.innerHTML;
                this.initializeComponents();
            }

            // Update pagination if exists
            const pagination = doc.querySelector('.woocommerce-pagination');
            const currentPagination = document.querySelector('.woocommerce-pagination');
            if (pagination && currentPagination) {
                currentPagination.innerHTML = pagination.innerHTML;
            }

            // Update result count
            const resultCount = doc.querySelector('.woocommerce-result-count');
            const currentResultCount = document.querySelector('.woocommerce-result-count');
            if (resultCount && currentResultCount) {
                currentResultCount.innerHTML = resultCount.innerHTML;
            }

            // Update URL without page reload - ONLY if we actually have products
            if (window.history && window.history.pushState && products && products.children.length > 0) {
                window.history.pushState(null, '', url);
            }

            // Auto-close mobile sidebar after selection
            const isMobile = window.matchMedia("(max-width: 767px)").matches;
            if (isMobile && this.topSidebar) {
                this.topSidebar.classList.remove('nasa-active');
                document.querySelector('.black-window')?.classList.remove('nasa-show');
                document.body.style.overflow = '';
            }
            
        } catch (error) {
            console.error('Filter update failed:', error);
        } finally {
            document.body.classList.remove('nasa-loading');
        }
    }

    validateFilterUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            let totalFilters = 0;
            const filterTypes = ['filter_colour', 'filter_size', 'filter_brand'];
            
            for (const filterType of filterTypes) {
                const filterValue = params.get(filterType);
                if (filterValue) {
                    const values = filterValue.split(',').filter(v => v.trim());
                    
                    if (values.length > 5) {
                        return false;
                    }
                    
                    totalFilters += values.length;
                }
            }
            
            if (totalFilters > 8) {
                return false;
            }
            
            return true;
            
        } catch (error) {
            return false;
        }
    }
    
    getUrlKey(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            
            const filters = [];
            ['filter_colour', 'filter_size', 'filter_brand'].forEach(type => {
                const value = params.get(type);
                if (value) {
                    const sorted = value.split(',').sort().join(',');
                    filters.push(`${type}=${sorted}`);
                }
            });
            
            return urlObj.pathname + '?' + filters.join('&');
        } catch {
            return url;
        }
    }

    resetFilters() {
        document.querySelectorAll('.nasa-filter-var-chosen, .nasa-active').forEach(el => {
            el.classList.remove('nasa-filter-var-chosen', 'nasa-active');
        });

        const priceSlider = document.querySelector('.price_slider');
        if (priceSlider) {
            const minInput = document.querySelector('#min_price');
            const maxInput = document.querySelector('#max_price');
            if (minInput && maxInput) {
                minInput.value = minInput.dataset.min;
                maxInput.value = maxInput.dataset.max;
            }
        }

        const orderingSelect = document.querySelector('.woocommerce-ordering select');
        if (orderingSelect) {
            orderingSelect.value = 'menu_order';
            
            const currentOrderby = document.querySelector('.nasa-current-orderby');
            if (currentOrderby) {
                currentOrderby.textContent = 'Default sorting';
            }
            
            document.querySelectorAll('.nasa-orderby').forEach(link => {
                link.classList.toggle('nasa-active', link.dataset.value === 'menu_order');
            });
        }

        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        if (isMobile && this.topSidebar) {
            this.topSidebar.classList.remove('nasa-active');
            document.querySelector('.black-window')?.classList.remove('nasa-show');
            document.body.style.overflow = '';
        }

        const baseUrl = window.location.pathname;
        window.location.href = baseUrl;
    }
  
    setupPriceFilter() {
        const priceSlider = document.querySelector('.price_slider');
        if (!priceSlider) return;

        const minPrice = document.querySelector('#min_price');
        const maxPrice = document.querySelector('#max_price');
        const form = priceSlider.closest('form');

        if (!minPrice || !maxPrice || !form) return;

        const slider = document.createElement('div');
        slider.className = 'price_slider_wrapper';
        
        const range = document.createElement('div');
        range.className = 'price_slider ui-slider ui-corner-all ui-slider-horizontal';
        
        const rangeBar = document.createElement('div');
        rangeBar.className = 'ui-slider-range ui-corner-all ui-widget-header';
        
        const handleMin = document.createElement('span');
        handleMin.className = 'ui-slider-handle ui-corner-all ui-state-default';
        
        const handleMax = document.createElement('span');
        handleMax.className = 'ui-slider-handle ui-corner-all ui-state-default';
        
        range.appendChild(rangeBar);
        range.appendChild(handleMin);
        range.appendChild(handleMax);
        slider.appendChild(range);
        
        priceSlider.parentNode.insertBefore(slider, priceSlider);
        priceSlider.style.display = 'none';

        const min = parseFloat(minPrice.dataset.min);
        const max = parseFloat(maxPrice.dataset.max);
        const current_min = parseFloat(minPrice.value);
        const current_max = parseFloat(maxPrice.value);

        this.initializeSlider(range, rangeBar, handleMin, handleMax, {
            min, max, current_min, current_max
        });
    }

    initializeSlider(range, rangeBar, handleMin, handleMax, values) {
        const { min, max, current_min, current_max } = values;
        
        let isDragging = false;
        let activeHandle = null;
        
        const updateSlider = (e) => {
            if (!isDragging) return;
            
            const rect = range.getBoundingClientRect();
            const width = rect.width;
            const left = rect.left;
            
            let position = (e.clientX - left) / width;
            position = Math.max(0, Math.min(1, position));
            
            const value = min + (max - min) * position;
            
            if (activeHandle === handleMin) {
                const minValue = Math.min(value, current_max - 1);
                handleMin.style.left = `${(minValue - min) / (max - min) * 100}%`;
                rangeBar.style.left = handleMin.style.left;
                document.querySelector('#min_price').value = minValue.toFixed(2);
            } else {
                const maxValue = Math.max(value, current_min + 1);
                handleMax.style.left = `${(maxValue - min) / (max - min) * 100}%`;
                rangeBar.style.right = `${100 - parseFloat(handleMax.style.left)}%`;
                document.querySelector('#max_price').value = maxValue.toFixed(2);
            }
        };

        const startDragging = (e, handle) => {
            isDragging = true;
            activeHandle = handle;
            document.addEventListener('mousemove', updateSlider);
            document.addEventListener('mouseup', stopDragging);
        };

        const stopDragging = () => {
            if (!isDragging) return;
            
            isDragging = false;
            document.removeEventListener('mousemove', updateSlider);
            document.removeEventListener('mouseup', stopDragging);
            
            this.handlePriceFilter();
        };

        handleMin.addEventListener('mousedown', e => startDragging(e, handleMin));
        handleMax.addEventListener('mousedown', e => startDragging(e, handleMax));

        handleMin.style.left = `${((current_min - min) / (max - min)) * 100}%`;
        handleMax.style.left = `${((current_max - min) / (max - min)) * 100}%`;
        rangeBar.style.left = handleMin.style.left;
        rangeBar.style.right = `${100 - parseFloat(handleMax.style.left)}%`;
    }

    setupMobileFilters() {
        const filterToggle = document.querySelector('.toggle-topbar-shop-mobile');
        if (!filterToggle || !this.topSidebar) return;

        const blackOverlay = document.createElement('div');
        blackOverlay.className = 'black-window';
        document.body.appendChild(blackOverlay);

        if (window.matchMedia("(max-width: 767px)").matches) {
            this.topSidebar.classList.remove('nasa-active');
            this.topSidebar.classList.add('nasa-mobile-filter');
        }

        filterToggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.topSidebar.classList.add('nasa-active');
            
            blackOverlay.style.display = 'block';
            requestAnimationFrame(() => {
                blackOverlay.classList.add('nasa-show');
            });
            
            document.body.style.overflow = 'hidden';
            document.body.classList.add('nasa-opening');
        });

        const closeEvents = [
            { element: this.topSidebar.querySelector('.nasa-close-sidebar'), event: 'click' },
            { element: blackOverlay, event: 'click' }
        ];

        closeEvents.forEach(({ element, event }) => {
            if (element) {
                element.addEventListener(event, (e) => {
                    e.preventDefault();
                    this.topSidebar.classList.remove('nasa-active');
                    
                    blackOverlay.classList.remove('nasa-show');
                    setTimeout(() => {
                        blackOverlay.style.display = 'none';
                    }, 300);
                    
                    document.body.style.overflow = '';
                    document.body.classList.remove('nasa-opening');
                });
            }
        });
    }

    getPushIcon() {
        return `
            <svg class="ns-push-open" width="16" height="24" viewBox="0 2 25 32" fill="currentColor">
                <path d="M6.294 14.164h12.588v1.049h-12.588v-1.049z"/>
                <path d="M6.294 18.36h12.588v1.049h-12.588v-1.049z"/>
                <path d="M6.294 22.557h8.392v1.049h-8.392v-1.049z"/>
                <path d="M15.688 3.674c-0.25-1.488-1.541-2.623-3.1-2.623s-2.85 1.135-3.1 2.623h-9.489v27.275h25.176v-27.275h-9.488zM10.49 6.082v-1.884c0-1.157 0.941-2.098 2.098-2.098s2.098 0.941 2.098 2.098v1.884l0.531 0.302c1.030 0.586 1.82 1.477 2.273 2.535h-9.803c0.453-1.058 1.243-1.949 2.273-2.535l0.53-0.302zM24.128 29.9h-23.078v-25.177h8.392v0.749c-1.638 0.932-2.824 2.566-3.147 4.496h12.588c-0.322-1.93-1.509-3.563-3.147-4.496v-0.749h8.392v25.177z"/>
            </svg>
            <svg class="ns-push-close hidden-tag" width="16" height="24" viewBox="7 7 18 18" fill="currentColor">
                <path d="M10.722 9.969l-0.754 0.754 5.278 5.278-5.253 5.253 0.754 0.754 5.253-5.253 5.253 5.253 0.754-0.754-5.253-5.253 5.278-5.278-0.754-0.754-5.278 5.278z"/>
            </svg>
        `;
    }

    getDropdownIcon() {
        return `
            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
                <path d="M15.233 19.175l0.754 0.754 6.035-6.035-0.754-0.754-5.281 5.281-5.256-5.256-0.754 0.754 3.013 3.013z"/>
            </svg>
        `;
    }
}

// Initialize the filter system
const filterSystem = new NasaFilterSystem();

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    filterSystem.init();
});

// Fallback init if script loaded late
if (document.readyState !== 'loading') {
    filterSystem.init();
}
