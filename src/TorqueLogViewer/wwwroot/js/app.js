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
                    x: { ticks: { display: false } },
                    y: {
                        display: false // Hides the Y axis because the 0-1 scale is just visual
                    }
                },
                plugins: {
                    zoom: {
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
                        pan: { enabled: true, mode: 'x' }
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
    },

    updateChart: function (labels, datasets) {
        if (!this.chart) return;
        this.chart.data.labels = labels;
        this.chart.data.datasets = datasets;
        this.chart.update();
    },

    resetChartZoom: function () {
        if (this.chart) this.chart.resetZoom();
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
    }
};