const planning = {
    allData: null,

    PROD_CONSTANTS: {
        PICKS_PAR_HEURE_PAR_PERSONNE: 95,
        HEURES_SHIFT_JOUR: 11,
        HEURES_SHIFT_NUIT: 7.5,
        PICKS_PAR_COMMANDE: 56
    },

    externalData: {
        planificationMarketingCommandes: {
            "2025-09-08": 3864, "2025-09-09": 3330, "2025-09-10": 3176, "2025-09-11": 3470, "2025-09-12": 3891,
        }
    },

    async loadData() {
        if (this.allData) return;
        console.log("Planning.js: Chargement des données...");
        try {
            const collaborateurs = generateCollaborateursData(); 
            const appData = app.state.allData || {};
            const zoneLabels = appData.zones || { Z1: 'Zone 1', Z2: 'Zone 2', Z3: 'Zone 3', Z4: 'Zone 4' };
            const shifts = appData.shifts || ['Jour', 'Nuit', 'Matin', 'Soir'];

            this.allData = {
                collaborateurs,
                zoneLabels,
                shifts
            };
        } catch (error) {
            console.error("Planning.js: Erreur de chargement des données:", error);
            this.allData = { collaborateurs: [], zoneLabels: {}, shifts: [] };
        }
    },

    async renderView(appState) {
        await this.loadData();
        if (!this.allData) return `<div class="error-message">Impossible de charger les données du planning.</div>`;

        const snapshot = {};
        this.computePresenceSnapshot(snapshot, this.allData.collaborateurs, appState.planningStartDate, 28);
        
        return `
            ${this.renderPlanningControls(appState)}
            <div class="planning-table-container">
                <table class="planning-table">
                    ${this.renderPlanningHeader(snapshot.days)}
                    ${this.renderCollaborateursView(snapshot, appState)}
                    ${appState.currentUser.role === 'chef_depot' ? this.renderKpiFooter(snapshot) : ""}
                </table>
            </div>
        `;
    },

    postRenderSetup() {
        const yearSelector = document.getElementById('year-selector');
        const weekSelector = document.getElementById('week-selector');
        const zoneFilter = document.getElementById('zone-filter');
        const shiftFilter = document.getElementById('shift-filter');
        
        const updateDate = () => {
            if (!yearSelector || !weekSelector) return;
            app.setPlanningDate(utils.getDateOfISOWeek(parseInt(yearSelector.value), parseInt(weekSelector.value)));
        };

        if (yearSelector) yearSelector.addEventListener('change', updateDate);
        if (weekSelector) weekSelector.addEventListener('change', updateDate);
        if (zoneFilter) zoneFilter.addEventListener('change', () => app.setFilters({ planningZone: zoneFilter.value }));
        if (shiftFilter) shiftFilter.addEventListener('change', () => app.setFilters({ planningShift: shiftFilter.value }));
        
        document.querySelectorAll('.collaborateur-row').forEach(row => {
            row.addEventListener('dblclick', (event) => {
                const collabId = parseInt(event.currentTarget.dataset.collabId);
                if (collabId) app.showCollaborateurFiche(collabId);
            });
        });
    },
    
    renderPlanningControls(appState) {
        const currentYear = appState.planningStartDate.getFullYear();
        const currentWeek = utils.getWeekNumber(appState.planningStartDate);
        
        const yearOptions = [currentYear -1, currentYear, currentYear + 1].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('');
        const weekOptions = Array.from({length: 53}, (_, i) => i + 1).map(w => `<option value="${w}" ${w === currentWeek ? 'selected' : ''}>S${w}</option>`).join('');

        const zoneOptions = `<option value="all">Toutes</option>` + Object.entries(this.allData.zoneLabels).map(([code, label]) => `<option value="${code}" ${appState.filters.planningZone === code ? 'selected' : ''}>${label}</option>`).join('');
        const shiftOptions = `<option value="all">Tous</option>` + this.allData.shifts.map(s => `<option value="${s}" ${appState.filters.planningShift === s ? 'selected' : ''}>${s}</option>`).join('');

        return `
            <div class="planning-controls">
                <label for="year-selector">Année:</label>
                <select id="year-selector">${yearOptions}</select>
                <label for="week-selector">Semaine:</label>
                <select id="week-selector">${weekOptions}</select>
                <label for="zone-filter">Zone:</label>
                <select id="zone-filter">${zoneOptions}</select>
                <label for="shift-filter">Shift:</label>
                <select id="shift-filter">${shiftOptions}</select>
            </div>
        `;
    },

    computePresenceSnapshot(snapshot, collaborateurs, startDate, numDays) {
        snapshot.days = []; 
        snapshot.present = {}; 
        snapshot.empDay = {};

        for (let i = 0; i < numDays; i++) {
            const date = new Date(startDate); date.setDate(startDate.getDate() + i); date.setHours(0,0,0,0);
            const dayString = utils.dateToISOString(date);
            snapshot.days.push({ date, dayString, dayOfWeek: date.getDay() });
            snapshot.present[dayString] = { 
                total: 0, jour: 0, nuit: 0, 
                absences: { V: 0, M: 0, R: 0, A: 0, F: 0, D: 0 },
                maladie: 0
            };
        }

        collaborateurs.forEach(collab => {
            snapshot.empDay[collab.id] = {};
            snapshot.days.forEach(day => {
                const info = this.getCollaborateurInfoAtDate(collab, day.date);
                const absenceType = this.getAbsenceOnDate(collab, day.date);
                const isJourTravail = info.joursTravailles[day.dayOfWeek]; // Respecte les jours travaillés
                const isWorkingDay = isJourTravail && !absenceType;
                const isPresent = isWorkingDay && day.date >= new Date(collab.dateEntree) && (!collab.dateFin || day.date <= new Date(collab.dateFin));
                
                snapshot.empDay[collab.id][day.dayString] = { isPresent, absence: absenceType, zone: info.zone, shift: info.shift, isJourTravail };

                if (isPresent) {
                    snapshot.present[day.dayString].total++;
                    if (info.shift === 'Nuit') snapshot.present[day.dayString].nuit++;
                    else snapshot.present[day.dayString].jour++;
                }
                if (absenceType && snapshot.present[day.dayString].absences.hasOwnProperty(absenceType)) {
                    snapshot.present[day.dayString].absences[absenceType]++;
                    if (absenceType === 'M') snapshot.present[day.dayString].maladie++;
                }
            });
        });
    },

    renderPlanningHeader: (days) => {
        const dayHeaders = days.map(d => `<th class="${[0,6].includes(d.dayOfWeek) ? 'weekend-header':''}">${d.date.toLocaleDateString('fr-FR',{weekday:'short'})}<br>${d.date.getDate()}</th>`).join('');
        return `<thead><tr><th class="sticky-col">Collaborateur</th><th class="sticky-col">Zone</th><th class="sticky-col">Shift</th><th class="sticky-col">Taux</th>${dayHeaders}</tr></thead>`;
    },

    renderCollaborateursView(snapshot, appState) {
        const filteredCollaborateurs = this.allData.collaborateurs.filter(collab => {
            const { planningZone, planningShift } = appState.filters;
            const currentInfo = this.getCollaborateurInfoAtDate(collab, appState.planningStartDate);
            return (planningZone === 'all' || currentInfo.zone === planningZone) && (planningShift === 'all' || currentInfo.shift === planningShift);
        });

        const bodyRows = filteredCollaborateurs.map(collab => {
            const currentInfo = this.getCollaborateurInfoAtDate(collab, appState.planningStartDate);
            let rowHtml = `<tr class="collaborateur-row" data-collab-id="${collab.id}">
                <td class="sticky-col">${collab.prenom} ${collab.nom}</td>
                <td class="sticky-col">${currentInfo.zone}</td>
                <td class="sticky-col">${currentInfo.shift}</td>
                <td class="sticky-col">${currentInfo.taux}%</td>`;
            rowHtml += snapshot.days.map(day => {
                const empDayInfo = snapshot.empDay[collab.id]?.[day.dayString];
                const cellClass = [0, 6].includes(day.dayOfWeek) ? 'weekend-cell' : '';
                // Absence = M (Maladie) : bleu, s'affiche que sur les jours travaillés
                if (!empDayInfo) return `<td class="${cellClass} absence-cell">ERR</td>`;
                if (empDayInfo.absence && empDayInfo.isJourTravail) {
                    return `<td class="${cellClass} absence-cell absence-${empDayInfo.absence}">${empDayInfo.absence}</td>`;
                }
                return `<td class="${cellClass}">${empDayInfo.isPresent && empDayInfo.isJourTravail ? '1' : ''}</td>`;
            }).join('');
            return rowHtml + `</tr>`;
        }).join('');
        return `<tbody>${bodyRows}</tbody>`;
    },

    getCollaborateurInfoAtDate(collab, date) { let info = { zone: collab.zone, shift: collab.shift, taux: collab.taux, joursTravailles: collab.joursTravailles }; (collab.changements || []).filter(ch => new Date(ch.dateEffet) <= date).sort((a, b) => new Date(a.dateEffet) - new Date(b.dateEffet)).forEach(ch => { if(ch.zone) info.zone = ch.zone; if(ch.shift) info.shift = ch.shift; if(ch.taux) info.taux = ch.taux }); return info; },
    
    getAbsenceOnDate(collab, date) { 
        // Absence est prise en compte uniquement sur les jours travaillés !
        const absence = (collab.absences || []).find(ab => ab.status === 'Validé' && date >= ab.start && date <= ab.end);
        return absence && absence.type ? absence.type : null; 
    },
    
    renderKpiFooter(snapshot) {
        const C = this.PROD_CONSTANTS;
        const dailyCalculations = snapshot.days.map(day => {
            const dayData = snapshot.present[day.dayString];
            const capacitePicks = Math.round((dayData.jour * C.PICKS_PAR_HEURE_PAR_PERSONNE * C.HEURES_SHIFT_JOUR) + (dayData.nuit * C.PICKS_PAR_HEURE_PAR_PERSONNE * C.HEURES_SHIFT_NUIT));
            const capaciteCommandes = capacitePicks > 0 ? Math.round(capacitePicks / C.PICKS_PAR_COMMANDE) : 0;
            const marketingCommandes = this.externalData.planificationMarketingCommandes[day.dayString] || 0;
            const marketingPicks = marketingCommandes * C.PICKS_PAR_COMMANDE;
            const vsPrevision = marketingCommandes > 0 ? Math.round((capaciteCommandes / marketingCommandes) * 100) : 0;

            return {
                effectifNuit: dayData.nuit, effectifJour: dayData.jour,
                conges: Object.values(dayData.absences).reduce((a, b) => a + b, 0),
                maladie: dayData.maladie,
                capacitePicks, capaciteCommandes, marketingPicks, marketingCommandes, vsPrevision
            };
        });

        const footerRows = [
            { label: 'Effectif picking nuit', data: dailyCalculations.map(d => d.effectifNuit), class: 'cat-effectif' },
            { label: 'Effectif picking jour', data: dailyCalculations.map(d => d.effectifJour), class: 'cat-effectif' },
            { label: 'Congés/absences', data: dailyCalculations.map(d => d.conges), class: 'cat-effectif' },
            { label: 'Nombre de maladie', data: dailyCalculations.map(d => d.maladie), class: 'cat-effectif' }, // Ajout KPI maladie
            { label: 'Capacité théorique en picks', data: dailyCalculations.map(d => d.capacitePicks), class: 'cat-capacite' },
            { label: 'Capacité théorique en commandes', data: dailyCalculations.map(d => d.capaciteCommandes), class: 'cat-capacite' },
            { label: 'Capacité théorique vs prévision', data: dailyCalculations.map(d => `${d.vsPrevision}%`), class: 'cat-capacite', format: (val) => {
                const num = parseInt(val); if (num >= 100) return 'kpi-green'; if (num >= 90) return 'kpi-orange'; return 'kpi-red';
            }},
            { label: 'Planification Marketing - picks', data: dailyCalculations.map(d => d.marketingPicks), class: 'cat-marketing' },
            { label: 'Planification Marketing - commandes', data: dailyCalculations.map(d => d.marketingCommandes), class: 'cat-marketing' },
            { label: 'Picking nuit (manuel)', data: snapshot.days.map(() => '<input type="text" class="kpi-input" value="0" />'), class: 'cat-manuel' },
            { label: 'Nombre de picks soir (manuel)', data: snapshot.days.map(() => '<input type="text" class="kpi-input" value="0" />'), class: 'cat-manuel' }
        ];

        const footerHtml = footerRows.map(row => {
            let rowHtml = `<tr class="${row.class}">`;
            rowHtml += `<td class="sticky-col kpi-label-col" colspan="4">${row.label}</td>`;
            rowHtml += row.data.map((val, index) => {
                const day = snapshot.days[index];
                let cellClass = [0, 6].includes(day.dayOfWeek) ? 'weekend-cell ' : '';
                if (row.format) cellClass += row.format(val);
                return `<td class="${cellClass}">${val.toLocaleString ? val.toLocaleString('fr-FR') : val}</td>`;
            }).join('');
            return rowHtml + '</tr>';
        }).join('');

        return `<tfoot>${footerHtml}</tfoot>`;
    }
};