/**
 * =============================================
 *      MODULE ANALYSE & HEATMAP ENTREPÔT
 * =============================================
 */

const heatmap = {
    state: {
        allData: null,
        orders: null,
        displayMode: 'frequency',
        panZoomInstance: null
    },

    async renderView(appState) {
        return `
            <h2>🔥 Analyse de Fréquentation de l'Entrepôt</h2>
            <div class="heatmap-controls">
                <div class="control-group">
                    <label for="heatmap-date-filter">Choisir une date :</label>
                    <select id="heatmap-date-filter">
                        <option value="all">Toutes les dates</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Mode d'affichage :</label>
                    <div class="button-group">
                        <button id="btn-mode-frequency" class="mode-button active" data-mode="frequency">Fréquence des arrêts</button>
                        <button id="btn-mode-quantity" class="mode-button" data-mode="quantity">Quantité vendue</button>
                    </div>
                </div>
            </div>
            <div id="error-message" class="error"></div>
            <div id="warehouse-heatmap-container" class="warehouse-map">
                <div class="loading-spinner">Chargement des données...</div>
            </div>
        `;
    },

    async postRenderSetup(appState) {
        console.log("Heatmap View: postRenderSetup initié.");
        const container = document.getElementById('warehouse-heatmap-container');
        const errorDiv = document.getElementById('error-message');

        try {
            // ▼▼▼ CORRECTION FINALE : On charge le bon fichier, celui que vous avez modifié ! ▼▼▼
            const [racks, segments, products, orders] = await Promise.all([
                utils.fetchCSV('data/area1.csv', ';'),
                utils.fetchCSV('data/segement.csv', ';'),
                utils.fetchCSV('data/data_product.csv', ';'),
                utils.fetchCSV('data/Input_data_order.csv', ';') // Le nom est corrigé !
            ]);

            this.state.allData = { racks, segments, products };
            this.state.orders = orders;

            console.log("Heatmap: Données chargées avec succès !");
            errorDiv.textContent = '';

            this.populateDateFilter();
            this.drawWarehousePlan();
            this.attachEventListeners();
            this.calculateAndApplyHeatmap();

        } catch (error) {
            console.error("Erreur critique dans postRenderSetup de la heatmap :", error);
            if (container) container.innerHTML = '';
            if(errorDiv) errorDiv.innerHTML = `<strong>Impossible de charger les données.</strong><br><small>Détail : ${error.message}</small>`;
        }
    },

    populateDateFilter() {
        const dateFilter = document.getElementById('heatmap-date-filter');
        if (!dateFilter || !this.state.orders) return;

        const dateColumnName = 'picking_date'; 

        const dates = this.state.orders.map(order => order[dateColumnName]).filter(Boolean);
        if (dates.length === 0) {
            console.warn(`Aucune date trouvée dans la colonne '${dateColumnName}'.`);
            return;
        }

        const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
        
        uniqueDates.forEach(dateValue_YYYY_MM_DD => {
            const option = document.createElement('option');
            option.value = dateValue_YYYY_MM_DD;
            
            const [year, month, day] = dateValue_YYYY_MM_DD.split('-');
            option.textContent = `${day}.${month}.${year}`;
            
            dateFilter.appendChild(option);
        });
    },

    drawWarehousePlan() {
        const container = document.getElementById('warehouse-heatmap-container');
        if (!container || !this.state.allData) return;

        const warehouseMapHtml = picking.drawWarehouse(this.state.allData.racks, this.state.allData.segments, 'all');
        container.innerHTML = warehouseMapHtml;

        if (this.state.panZoomInstance) this.state.panZoomInstance.destroy();
        const svgElement = document.getElementById('warehouse-svg');
        if (svgElement && svgElement.hasChildNodes()) {
            this.state.panZoomInstance = svgPanZoom(svgElement, { controlIconsEnabled: true, fit: true, center: true });
            window.addEventListener('resize', () => this.state.panZoomInstance.resize());
        }
    },

    attachEventListeners() {
        const dateFilter = document.getElementById('heatmap-date-filter');
        const modeButtons = document.querySelectorAll('.mode-button');

        dateFilter.addEventListener('change', () => this.calculateAndApplyHeatmap());

        modeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                modeButtons.forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.state.displayMode = e.currentTarget.dataset.mode;
                this.calculateAndApplyHeatmap();
            });
        });

        document.querySelectorAll('.warehouse-rack-group').forEach(rackElement => {
            rackElement.addEventListener('click', (event) => {
                const clickedRackId = event.currentTarget.dataset.rackId;
                const productsInRack = this.state.allData.products.filter(p => p.rack_id === clickedRackId);
                let modalContentHtml = `<h2>Contenu du Rack : ${clickedRackId}</h2>`;
                if (productsInRack.length > 0) {
                     modalContentHtml += `<table class="modal-table"><thead><tr><th>Produit</th><th>Description</th><th>Position</th></tr></thead><tbody>${productsInRack.map(p => `<tr><td>${p.product_id||'N/A'}</td><td>${p['PRODUCT DESCRIPTION DE']||'N/A'}</td><td>${p.position_id||'N/A'}</td></tr>`).join('')}</tbody></table>`;
                } else {
                    modalContentHtml += `<p>Aucun produit n'est enregistré dans ce rack.</p>`;
                }
                ui.showModal(modalContentHtml);
            });
        });
    },

    calculateAndApplyHeatmap() {
        if (!this.state.orders || !this.state.allData.racks) return;

        const dateFilter = document.getElementById('heatmap-date-filter');
        const selectedDate = dateFilter.value;
        const mode = this.state.displayMode;

        const filteredOrders = selectedDate === 'all'
            ? this.state.orders
            : this.state.orders.filter(order => order.picking_date === selectedDate);
        
        const rackValues = {};
        filteredOrders.forEach(order => {
            const productInfo = this.state.allData.products.find(p => p.product_id === order.product_id);
            if(!productInfo || !productInfo.rack_id) return;
            const rackId = productInfo.rack_id;

            if (!rackValues[rackId]) {
                rackValues[rackId] = { frequency: 0, quantity: 0 };
            }
            rackValues[rackId].frequency += 1;
            rackValues[rackId].quantity += parseInt(order.quantity, 10) || 0;
        });

        const allValues = Object.values(rackValues).map(v => v[mode]).filter(v => v > 0);
        const maxValue = Math.max(...allValues, 1);

        document.querySelectorAll('.warehouse-rack-group').forEach(group => {
            const rackId = group.dataset.rackId;
            const rect = group.querySelector('rect');
            if (!rect) return;

            const valueData = rackValues[rackId];
            const value = valueData ? valueData[mode] : 0;
            
            const rackInfo = this.state.allData.racks.find(r => r.Rack_Id === rackId);
            const defaultColor = rackInfo ? picking.getColorForEmplacement(rackInfo.Emplacement) : '#D3D3D3';

            let color = defaultColor;
            if (value > 0) {
                const intensity = Math.min(value / maxValue, 1.0);
                const hue = (1 - intensity) * 120;
                color = `hsl(${hue}, 90%, 50%)`;
            }
            
            rect.style.transition = 'fill 0.3s ease';
            rect.setAttribute('fill', color);
        });

        document.getElementById('error-message').textContent = '';
    }
};
