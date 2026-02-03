const semaineDP = {
    /**
     * Rend la vue "Semaine DP".
     * @param {object} appState - L'état complet de l'application.
     */
    async renderView(appState) {
        // Pour l'instant, c'est une vue en construction.
        // Plus tard, on pourra y ajouter des calculs de KPI basés sur les données chargées.
        return `
            <div class="view-container">
                <h2>Semaine DP (Pilotage Hebdo)</h2>
                <p>Cette vue est en cours de reconstruction avec la nouvelle architecture de données.</p>
                <div class="kpi-container">
                    <div class="kpi"><div class="value">--</div><div class="label">Présents Jour</div></div>
                    <div class="kpi"><div class="value">--</div><div class="label">Présents Nuit</div></div>
                    <div class="kpi"><div class="value">--</div><div class="label">Vacances</div></div>
                </div>
            </div>
        `;
    }
};
