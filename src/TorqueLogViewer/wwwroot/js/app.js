window.torqueApp = {
    // ... (manter map, chart, initMap, drawRoute, highlightPointOnMap como estavam) ...
    // Vou repetir as partes essenciais e adicionar a nova função no final

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
            // Adicionei preventDefault para a página não rolar com as setas
            if (e.key === "ArrowRight") {
                e.preventDefault();
                window.torqueApp.dotNetRef.invokeMethodAsync('MoveSelection', 1);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                window.torqueApp.dotNetRef.invokeMethodAsync('MoveSelection', -1);
            }
        });
    },

    // ... (drawRoute e highlightPointOnMap mantém iguais) ...
    drawRoute: function (coordinates) {
        if (!this.map) return;
        if (this.polyline) this.map.removeLayer(this.polyline);
        if (this.currentMarker) this.map.removeLayer(this.currentMarker);
        // Dica: Adicionamos interactive: false para garantir que cliques na linha passem para o mapa
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
                        display: false // Oculta o eixo Y pois a escala 0-1 é apenas visual
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
                            // Customiza o texto do Tooltip para mostrar o valor REAL
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                // Pega o valor original que passamos do C#
                                const originalValue = context.dataset.originalData[context.dataIndex];

                                if (originalValue !== undefined && originalValue !== null) {
                                    // Formata com até 2 casas decimais
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

    // --- NOVA FUNÇÃO MÁGICA ---
    highlightPointOnChart: function (index) {
        if (!this.chart) return;

        // Identifica os pontos correspondentes ao índice em todos os datasets visíveis
        const activeElements = this.chart.data.datasets.map((ds, i) => ({
            datasetIndex: i,
            index: index
        }));

        // Ativa visualmente os pontos (efeito de hover)
        this.chart.setActiveElements(activeElements);

        // Força a exibição do Tooltip
        this.chart.tooltip.setActiveElements(activeElements);

        // Renderiza as alterações
        this.chart.update();
    }
};