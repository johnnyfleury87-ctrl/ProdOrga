const picking = {
    panZoomInstance: null,
    allData: null, // Pour stocker toutes nos données chargées une seule fois

    /**
     * Charge toutes les données CSV nécessaires à cette vue.
     */
    async loadData() {
        if (this.allData) return; // Ne charge qu'une seule fois

        console.log("Picking.js: Chargement des données CSV...");
        try {
            // Utilisation de la fonction fetchCSV centralisée
            const [racks, segments, products, orders] = await Promise.all([
                utils.fetchCSV('data/area1.csv', ';'),
                utils.fetchCSV('data/segement.csv', ';'),
                utils.fetchCSV('data/data_product.csv', ';'),
                utils.fetchCSV('data/input_data_order.csv', ',') // On suppose que celui-ci utilise une virgule
            ]);

            this.allData = { racks, segments, products, orders };
            console.log("Picking.js: Données chargées avec succès !", this.allData);

        } catch (error) {
            console.error("Picking.js: ERREUR CRITIQUE lors du chargement des fichiers:", error);
            // On retourne un message d'erreur HTML qui sera affiché par le moteur de rendu
            return `<div class="error-message"><h3>Erreur de chargement de la vue Picking</h3><p>Impossible de charger les fichiers de données. Vérifiez la console pour plus de détails.</p></div>`;
        }
    },

    /**
     * Fonction principale qui génère le HTML de la vue.
     */
    async renderView(appState) {
        // On s'assure que les données sont chargées avant de continuer.
        const errorHtml = await this.loadData();
        if (errorHtml) return errorHtml; // Si le chargement a échoué, on affiche l'erreur.

        const selectedZone = appState.filters.pickingZone;
        const { racks, segments } = this.allData;

        const zones = [...new Set(racks.map(rack => rack.Zone).filter(z => z))].sort();
        const zoneSelectorHtml = `
            <div class="view-controls">
                <label for="zone-selector">Choisir une zone :</label>
                <select id="zone-selector">
                    <option value="all">Toutes les zones</option>
                    ${zones.map(zone => `<option value="${zone}" ${selectedZone === zone ? 'selected' : ''}>${zone}</option>`).join('')}
                </select>
            </div>`;

        const warehouseMapHtml = this.drawWarehouse(racks, segments, selectedZone);
        const kpiWidgetsHtml = this.renderKpiWidgets();

        return `
            <div class="view-with-controls">
                ${zoneSelectorHtml}
                <div class="picking-page-container">
                    <div id="warehouse-map-container" class="warehouse-map">${warehouseMapHtml}</div>
                    <div class="kpi-sidebar">${kpiWidgetsHtml}</div>
                </div>
            </div>`;
    },

    /**
     * Dessine le SVG de l'entrepôt.
     * MODIFIÉ pour une taille de police fixe sur les étiquettes.
     */
    drawWarehouse(allRacks, allSegments, filterZone) {
        const racksToDraw = (filterZone === 'all') ? allRacks : allRacks.filter(r => r.Zone === filterZone);
        const segmentsToDraw = (filterZone === 'all') ? allSegments : allSegments.filter(s => s.zone && String(s.zone).trim() === String(filterZone).trim());

        if ((!racksToDraw || racksToDraw.length === 0) && (!segmentsToDraw || segmentsToDraw.length === 0)) {
            return `<div class="placeholder"><p>Aucune donnée à afficher pour la zone '${filterZone}'.</p></div>`;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const updateBounds = (x, y) => {
            x = parseFloat(x); y = parseFloat(y);
            if (isNaN(x) || isNaN(y)) return;
            minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        };

        const validRacks = racksToDraw.filter(r => !['Position_X', 'Position_Y', 'L_x', 'L_Y'].some(k => isNaN(parseFloat(r[k]))));
        validRacks.forEach(r => {
            updateBounds(r.Position_X, r.Position_Y); updateBounds(parseFloat(r.Position_X) + parseFloat(r.L_x), parseFloat(r.Position_Y) + parseFloat(r.L_Y));
        });

        const pathElements = segmentsToDraw.map(segment => {
            const [sx, sy, ex, ey] = [segment.sx, segment.sy, segment.ex, segment.ey].map(parseFloat);
            if ([sx, sy, ex, ey].some(isNaN)) return '';
            updateBounds(sx, sy); updateBounds(ex, ey);
            const isPicking = String(segment.is_picking_path).toLowerCase() === 'true';
            return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${isPicking ? '#3182ce' : '#4a5568'}" stroke-width="${isPicking ? '15' : '10'}" stroke-opacity="0.6" stroke-dasharray="${!isPicking ? '10,10' : ''}" />`;
        }).join('');

        const padding = 100;
        const viewBox = `${minX - padding} ${minY - padding} ${(maxX - minX) + (padding * 2)} ${(maxY - minY) + (padding * 2)}`;

        const rackElements = validRacks.map(rack => {
            const [x, y, w, h] = [rack.Position_X, rack.Position_Y, rack.L_x, rack.L_Y].map(parseFloat);
            const color = this.getColorForEmplacement(rack.Emplacement);
            
            // ▼▼▼ MODIFICATION PRINCIPALE ICI ▼▼▼
            // On utilise une taille de police fixe pour une meilleure lisibilité.
            return `<g class="warehouse-rack-group" data-rack-id="${rack.Rack_Id}">
                        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" stroke="#1a202c" stroke-width="2" class="warehouse-rack" fill-opacity="0.85"></rect>
                        <text x="${x + w / 2}" y="${y + h / 2}" class="rack-label" font-size="14">${rack.Rack_Id}</text>
                    </g>`;
        }).join('');

        return `<svg id="warehouse-svg" viewBox="${viewBox}" style="background-color:#f8f9fa;">
                    <g id="paths-layer">${pathElements}</g>
                    <g id="racks-layer">${rackElements}</g>
                </svg>`;
    },

    /**
     * Met en place les interactions après le rendu.
     */
    postRenderSetup(appState) {
        if (!this.allData) return;

        if (this.panZoomInstance) this.panZoomInstance.destroy();
        const svgElement = document.getElementById('warehouse-svg');
        if (svgElement && svgElement.hasChildNodes()) {
            this.panZoomInstance = svgPanZoom(svgElement, { controlIconsEnabled: true, fit: true, center: true });
            window.addEventListener('resize', () => this.panZoomInstance.resize());
        }

        document.querySelectorAll('.warehouse-rack-group').forEach(rackElement => {
            rackElement.addEventListener('click', (event) => {
                const clickedRackId = event.currentTarget.dataset.rackId;
                const productsInRack = this.allData.products.filter(p => p.rack_id === clickedRackId);

                const floors = {};
                productsInRack.forEach(p => {
                    const floorNumber = p.position_id ? String(p.position_id).charAt(6) : 'N/A';
                    if (!floors[floorNumber]) floors[floorNumber] = [];
                    floors[floorNumber].push(p);
                });

                let modalContentHtml = `<h2>Contenu du Rack : ${clickedRackId}</h2>`;
                const sortedFloorKeys = Object.keys(floors).sort();
                if (sortedFloorKeys.length > 0) {
                    sortedFloorKeys.forEach(floorKey => {
                        modalContentHtml += `<h4 class="floor-title">Étage ${floorKey}</h4>
                            <table class="modal-table">
                                <thead><tr><th>Position</th><th>Produit</th><th>Description</th><th>Forecast</th></tr></thead>
                                <tbody>${floors[floorKey].map(p => `
                                    <tr>
                                        <td>${p.position_id || ''}</td>
                                        <td>${p.product_id || ''}</td>
                                        <td>${p['PRODUCT DESCRIPTION DE'] || ''}</td>
                                        <td>${p.Forecast || '0'}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>`;
                    });
                } else {
                    modalContentHtml += `<p>Aucun produit trouvé dans ce rack.</p>`;
                }
                
                ui.showModal(modalContentHtml);
            });
        });
        
        const zoneSelector = document.getElementById('zone-selector');
        if (zoneSelector) {
            zoneSelector.addEventListener('change', (event) => {
                app.setFilters({ pickingZone: event.target.value });
            });
        }
    },

    // Fonctions utilitaires
    getColorForEmplacement(emplacement) {
        const colorMap = { 'RA': '#a0aec0', 'PA': '#f6ad55', 'RB': '#90cdf4', 'RC': '#9ae6b4', 'URGENT': '#f56565', 'CDX': '#d69e2e' };
        return colorMap[emplacement] || '#a0aec0';
    },

    renderKpiWidgets() {
        return `<div class="picking-widget"><h3>Incidents & Flux</h3><div class="widget-list"><div class="list-item incident-haute"><span><strong>05:00</strong> - Badge manquant: Léa</span></div></div></div>
                <div class="picking-widget"><h3>Indicateurs Clés</h3><div class="kpi-grid"><div class="kpi-item"><span class="kpi-value">123</span><span class="kpi-label">Picks/Heure</span></div></div></div>`;
    }
};
