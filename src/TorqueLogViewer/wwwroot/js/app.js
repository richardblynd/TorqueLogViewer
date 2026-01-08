window.torqueApp = {
    // ... (keep map, chart, initMap, drawRoute, highlightPointOnMap as they were) ...
    // I'll repeat the essential parts and add the new function at the end

    map: null,
    chart: null,
    polyline: null,
    currentMarker: null,
    dotNetRef: null,

    initMap: function (dotNetReference) {
        this.dotNetRef = dotNetReference;
        if (this.map) return;

        this.map = L.map('map').setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        this.map.on('click', function (e) {
            window.torqueApp.dotNetRef.invokeMethodAsync('OnMapClick', e.latlng.lat, e.latlng.lng);
        });

        document.addEventListener('keydown', (e) => {
            // Added preventDefault so the page doesn't scroll with arrow keys
            if (e.key === "ArrowRight") {
                e.preventDefault();
                window.torqueApp.dotNetRef.invokeMethodAsync('MoveSelection', 1);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                window.torqueApp.dotNetRef.invokeMethodAsync('MoveSelection', -1);
            }
        });
    },

    // ... (drawRoute and highlightPointOnMap remain the same) ...
    drawRoute: function (coordinates) {
        if (!this.map) return;
        if (this.polyline) this.map.removeLayer(this.polyline);
        if (this.currentMarker) this.map.removeLayer(this.currentMarker);
        // Tip: Added interactive: false to ensure clicks on the line pass through to the map
        this.polyline = L.polyline(coordinates, { color: 'blue', weight: 4, interactive: false }).addTo(this.map);
        if (coordinates.length > 0) this.map.fitBounds(this.polyline.getBounds());
    },

    highlightPointOnMap: function (lat, lng) {
        if (!this.map) return;
        if (this.currentMarker) {
            this.currentMarker.setLatLng([lat, lng]);
        } else {
            this.currentMarker = L.circleMarker([lat, lng], {
                radius: 8, fillColor: "#ff0000", color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8
            }).addTo(this.map);
        }
    },

    initChart: function () {
        const ctx = document.getElementById('logChart');
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: { 
                        ticks: { display: false },
                        min: undefined,
                        max: undefined
                    },
                    y: {
                        display: false // Hides the Y axis because the 0-1 scale is just visual
                    }
                },
                plugins: {
                    zoom: {
                        zoom: { 
                            wheel: { enabled: true }, 
                            pinch: { enabled: true }, 
                            mode: 'x',
                            onZoom: function({chart}) {
                                window.torqueApp.updateScrollbar();
                            }
                        },
                        pan: { 
                            enabled: true, 
                            mode: 'x',
                            onPan: function({chart}) {
                                window.torqueApp.updateScrollbar();
                            }
                        },
                        limits: {
                            x: { min: 'original', max: 'original' }
                        }
                    },
                    tooltip: {
                        animation: false,
                        callbacks: {
                            // Customizes the Tooltip text to show the REAL value
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                // Gets the original value we passed from C#
                                const originalValue = context.dataset.originalData[context.dataIndex];

                                if (originalValue !== undefined && originalValue !== null) {
                                    // Formats with up to 2 decimal places
                                    label += originalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                }
                                return label;
                            }
                        }
                    }
                },
                onClick: (e, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        window.torqueApp.dotNetRef.invokeMethodAsync('OnChartClick', index);
                    }
                }
            }
        });

        // Initialize the scrollbar
        this.initScrollbar();
    },

    initScrollbar: function() {
        const scrollbar = document.getElementById('chartScrollbar');
        if (!scrollbar) return;

        scrollbar.addEventListener('input', (e) => {
            const scrollPosition = parseFloat(e.target.value);
            this.scrollChartToPosition(scrollPosition);
        });
    },

    updateScrollbar: function() {
        if (!this.chart) return;
        
        const scrollbar = document.getElementById('chartScrollbar');
        const scrollbarContainer = document.getElementById('scrollbarContainer');
        if (!scrollbar || !scrollbarContainer) return;

        const xScale = this.chart.scales.x;
        const totalLabels = this.chart.data.labels.length;
        
        if (!xScale || totalLabels === 0) return;

        const min = xScale.min || 0;
        const max = xScale.max || totalLabels - 1;
        const visibleRange = max - min;
        
        // If showing everything (no zoom), hide the scrollbar
        if (visibleRange >= totalLabels - 1) {
            scrollbarContainer.style.display = 'none';
            return;
        }

        scrollbarContainer.style.display = 'flex';
        
        // Update the scrollbar value (current position)
        scrollbar.value = min;
        scrollbar.min = 0;
        scrollbar.max = totalLabels - visibleRange;
        scrollbar.step = 1;
    },

    scrollChartToPosition: function(position) {
        if (!this.chart) return;

        const totalLabels = this.chart.data.labels.length;
        if (totalLabels === 0) return;

        const xScale = this.chart.scales.x;
        const currentMin = xScale.min || 0;
        const currentMax = xScale.max || totalLabels - 1;
        const visibleRange = currentMax - currentMin;

        // Calculate the new limits based on scroll position
        const newMin = position;
        const newMax = position + visibleRange;

        // Update the chart zoom
        this.chart.options.scales.x.min = newMin;
        this.chart.options.scales.x.max = newMax;
        this.chart.update('none'); // 'none' avoids animation for smooth scroll
    },

    updateChart: function (labels, datasets) {
        if (!this.chart) return;
        this.chart.data.labels = labels;
        this.chart.data.datasets = datasets;
        
        // Reset zoom when loading new data
        this.chart.options.scales.x.min = undefined;
        this.chart.options.scales.x.max = undefined;
        
        this.chart.update();
        
        // Hide the scrollbar initially
        const scrollbarContainer = document.getElementById('scrollbarContainer');
        if (scrollbarContainer) {
            scrollbarContainer.style.display = 'none';
        }
    },

    resetChartZoom: function () {
        if (this.chart) {
            this.chart.resetZoom();
            
            // Hide the scrollbar when resetting
            const scrollbarContainer = document.getElementById('scrollbarContainer');
            if (scrollbarContainer) {
                scrollbarContainer.style.display = 'none';
            }
        }
    },

    // --- NEW MAGIC FUNCTION ---
    highlightPointOnChart: function (index) {
        if (!this.chart) return;

        // Identifies the points corresponding to the index in all visible datasets
        const activeElements = this.chart.data.datasets.map((ds, i) => ({
            datasetIndex: i,
            index: index
        }));

        // Visually activates the points (hover effect)
        this.chart.setActiveElements(activeElements);

        // Forces the Tooltip to display
        this.chart.tooltip.setActiveElements(activeElements);

        // Renders the changes
        this.chart.update();
    },

    // Clipboard functions for sensor synchronization
    copyToClipboard: async function (text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('Sensors copied to clipboard!');
        } catch (err) {
            console.error('Error copying:', err);
            alert('Error copying to clipboard.');
        }
    },

    readFromClipboard: async function () {
        try {
            const text = await navigator.clipboard.readText();
            return text;
        } catch (err) {
            console.error('Error reading from clipboard:', err);
            alert('Error reading from clipboard. Please check browser permissions.');
            return '';
        }
    },

    // Compare page - dual chart management
    chart1: null,
    chart2: null,
    compareRef: null,

    initCompareCharts: function (dotNetReference) {
        this.compareRef = dotNetReference;
        
        // Initialize Chart 1
        const ctx1 = document.getElementById('logChart1');
        if (ctx1) {
            if (this.chart1) this.chart1.destroy();
            this.chart1 = this.createCompareChart(ctx1, 1);
            this.initCompareScrollbar(1);
        }

        // Initialize Chart 2
        const ctx2 = document.getElementById('logChart2');
        if (ctx2) {
            if (this.chart2) this.chart2.destroy();
            this.chart2 = this.createCompareChart(ctx2, 2);
            this.initCompareScrollbar(2);
        }

        // Setup keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === "ArrowRight") {
                e.preventDefault();
                this.compareRef?.invokeMethodAsync('MoveCompareSelection', 1);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                this.compareRef?.invokeMethodAsync('MoveCompareSelection', -1);
            }
        });
    },

    createCompareChart: function (ctx, chartNumber) {
        return new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: { 
                        ticks: { display: false },
                        min: undefined,
                        max: undefined
                    },
                    y: {
                        display: false
                    }
                },
                plugins: {
                    zoom: {
                        zoom: { 
                            wheel: { enabled: true }, 
                            pinch: { enabled: true }, 
                            mode: 'x',
                            onZoom: function({chart}) {
                                window.torqueApp.updateCompareScrollbar(chartNumber);
                            }
                        },
                        pan: { 
                            enabled: true, 
                            mode: 'x',
                            onPan: function({chart}) {
                                window.torqueApp.updateCompareScrollbar(chartNumber);
                            }
                        },
                        limits: {
                            x: { min: 'original', max: 'original' }
                        }
                    },
                    tooltip: {
                        animation: false,
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const originalValue = context.dataset.originalData[context.dataIndex];
                                if (originalValue !== undefined && originalValue !== null) {
                                    label += originalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                }
                                return label;
                            }
                        }
                    }
                },
                onClick: (e, elements) => {
                    if (elements && elements.length > 0) {
                        const index = elements[0].index;
                        window.torqueApp.compareRef?.invokeMethodAsync('OnCompareChartClick', chartNumber, index);
                    }
                }
            }
        });
    },

    updateCompareChart: function (chartNumber, labels, datasets) {
        const chart = chartNumber === 1 ? this.chart1 : this.chart2;
        if (!chart) return;

        chart.data.labels = labels;
        chart.data.datasets = datasets;
        
        chart.options.scales.x.min = undefined;
        chart.options.scales.x.max = undefined;
        
        chart.update();
        
        const scrollbarContainer = document.getElementById(`scrollbarContainer${chartNumber}`);
        if (scrollbarContainer) {
            scrollbarContainer.style.display = 'none';
        }
    },

    highlightPointOnCompareChart: function (chartNumber, index) {
        const chart = chartNumber === 1 ? this.chart1 : this.chart2;
        if (!chart) return;

        const activeElements = chart.data.datasets.map((ds, i) => ({
            datasetIndex: i,
            index: index
        }));

        chart.setActiveElements(activeElements);
        chart.tooltip.setActiveElements(activeElements);
        chart.update();
    },

    resetCompareChartZoom: function (chartNumber) {
        const chart = chartNumber === 1 ? this.chart1 : this.chart2;
        if (chart) {
            chart.resetZoom();
            
            const scrollbarContainer = document.getElementById(`scrollbarContainer${chartNumber}`);
            if (scrollbarContainer) {
                scrollbarContainer.style.display = 'none';
            }
        }
    },

    initCompareScrollbar: function(chartNumber) {
        const scrollbar = document.getElementById(`chartScrollbar${chartNumber}`);
        if (!scrollbar) return;

        scrollbar.addEventListener('input', (e) => {
            const scrollPosition = parseFloat(e.target.value);
            this.scrollCompareChartToPosition(chartNumber, scrollPosition);
        });
    },

    updateCompareScrollbar: function(chartNumber) {
        const chart = chartNumber === 1 ? this.chart1 : this.chart2;
        if (!chart) return;
        
        const scrollbar = document.getElementById(`chartScrollbar${chartNumber}`);
        const scrollbarContainer = document.getElementById(`scrollbarContainer${chartNumber}`);
        if (!scrollbar || !scrollbarContainer) return;

        const xScale = chart.scales.x;
        const totalLabels = chart.data.labels.length;
        
        if (!xScale || totalLabels === 0) return;

        const min = xScale.min || 0;
        const max = xScale.max || totalLabels - 1;
        const visibleRange = max - min;
        
        if (visibleRange >= totalLabels - 1) {
            scrollbarContainer.style.display = 'none';
            return;
        }

        scrollbarContainer.style.display = 'flex';
        
        scrollbar.value = min;
        scrollbar.min = 0;
        scrollbar.max = totalLabels - visibleRange;
        scrollbar.step = 1;
    },

    scrollCompareChartToPosition: function(chartNumber, position) {
        const chart = chartNumber === 1 ? this.chart1 : this.chart2;
        if (!chart) return;

        const totalLabels = chart.data.labels.length;
        if (totalLabels === 0) return;

        const xScale = chart.scales.x;
        const currentMin = xScale.min || 0;
        const currentMax = xScale.max || totalLabels - 1;
        const visibleRange = currentMax - currentMin;

        const newMin = position;
        const newMax = position + visibleRange;

        chart.options.scales.x.min = newMin;
        chart.options.scales.x.max = newMax;
        chart.update('none');
    },

    // Loading indicator
    showLoading: function(show) {
        let loader = document.getElementById('loadingOverlay');
        
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'loadingOverlay';
                loader.innerHTML = `
                    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                                background: rgba(0,0,0,0.8); display: flex; justify-content: center; 
                                align-items: center; z-index: 9999;">
                        <div style="background: white; padding: 40px; border-radius: 10px; text-align: center; min-width: 300px;">
                            <div style="border: 8px solid #f3f3f3; border-top: 8px solid #4CAF50; 
                                        border-radius: 50%; width: 60px; height: 60px; 
                                        animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                            <div id="loadingTitle" style="font-size: 18px; color: #333; margin-bottom: 10px;">Loading file...</div>
                            <div id="loadingSubtext" style="font-size: 14px; color: #666; margin-bottom: 15px;">Processing data</div>
                            <div id="loadingProgress" style="width: 100%; background: #e0e0e0; border-radius: 5px; height: 8px; overflow: hidden; margin-top: 10px;">
                                <div id="loadingProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s;"></div>
                            </div>
                        </div>
                    </div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                `;
                document.body.appendChild(loader);
            }
            loader.style.display = 'block';
        } else {
            if (loader) {
                loader.style.display = 'none';
            }
        }
    },

    updateLoadingProgress: function(percentage, text) {
        console.log(`[JS] updateLoadingProgress called: ${percentage}%, ${text}`);
        
        const progressBar = document.getElementById('loadingProgressBar');
        const subtext = document.getElementById('loadingSubtext');
        
        if (progressBar) {
            progressBar.style.width = percentage + '%';
            console.log(`[JS] Progress bar updated to ${percentage}%`);
        } else {
            console.error('[JS] Progress bar element not found');
        }
        
        if (subtext && text) {
            subtext.textContent = text;
            console.log(`[JS] Subtext updated to: ${text}`);
        } else if (!subtext) {
            console.error('[JS] Subtext element not found');
        }
    },
};