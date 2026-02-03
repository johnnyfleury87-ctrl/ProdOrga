// ui.js — version augmentée (ajout Performance + chart + exports) — respecte ta structure existante

const ui = {
    init() {
        document.getElementById('modal-close-btn')?.addEventListener('click', () => this.hideModal());
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.hideModal(); });
    },

    showModal(content) {
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal-container').classList.remove('modal-hidden');
    },

    hideModal() {
        document.getElementById('modal-container').classList.add('modal-hidden');
    },

    showToastNotification(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000);
    },

    // ===================== FICHE COLLAB =====================
    showCollaborateurFiche(collab, currentUser, allZones, allShifts) {
        if (!collab) return this.showToastNotification("Erreur: Collaborateur non trouvé.", "error");

        const title = `Fiche de ${collab.prenom} ${collab.nom}`;
        const absenceStats = { V: 0, M: 0, F: 0, A: 0, R: 0, D: 0 };
        let absenceListHtml = '<h4>Périodes d\'absence</h4><ul>';
        (collab.absences || []).forEach(ab => {
            const duration = (new Date(ab.end) - new Date(ab.start)) / 86400000 + 1;
            if (absenceStats.hasOwnProperty(ab.type)) absenceStats[ab.type] += duration;
            absenceListHtml += `<li><strong>${ab.type}</strong>: du ${new Date(ab.start).toLocaleDateString('fr-FR')} au ${new Date(ab.end).toLocaleDateString('fr-FR')} (${duration}j) - <em>Statut: ${ab.status || 'Validé'}</em></li>`;
        });
        if (!collab.absences || collab.absences.length === 0) absenceListHtml += '<li>Aucune absence enregistrée.</li>';
        absenceListHtml += '</ul>';

        let changementsListHtml = '<h4>Historique des changements</h4><ul>';
        (collab.changements || []).forEach(ch => {
            changementsListHtml += `<li>Le ${new Date(ch.dateEffet).toLocaleDateString('fr-FR')}: Zone: ${ch.zone || 'inchangée'}, Shift: ${ch.shift || 'inchangé'}</li>`;
        });
        if (!collab.changements || collab.changements.length === 0) changementsListHtml += '<li>Aucun changement enregistré.</li>';
        changementsListHtml += '</ul>';

        const buttonText = currentUser.role === 'assistant_logistique' ? "Saisir une absence" : "Faire une demande d'absence";
        const buttonsHtml = `
            <button onclick="app.showAbsenceFormForCollab(${collab.id})">${buttonText}</button>
            <button onclick="app.showChangementFormForCollab(${collab.id})">Enregistrer un changement</button>
            <button onclick="app.showCollaborateurForm(${collab.id})">Modifier l'identité</button>
            <button id="btn-fiche-performance">Performance</button>
        `;

        const content = `
            <h2>${title}</h2>
            <div class="fiche-grid">
                <div><strong>Zone actuelle:</strong> ${collab.zone}</div> <div><strong>Shift actuel:</strong> ${collab.shift}</div>
                <div><strong>Taux:</strong> ${collab.taux}%</div> <div><strong>Date d'entrée:</strong> ${new Date(collab.dateEntree).toLocaleDateString('fr-FR')}</div>
            </div> <hr>
            <h4>Résumé des absences (en jours)</h4>
            <div class="stats-grid">
                <div><strong>Vacances:</strong> ${absenceStats.V}</div> <div><strong>Maladie:</strong> ${absenceStats.M}</div>
                <div><strong>Récup.:</strong> ${absenceStats.R}</div> <div><strong>Autre:</strong> ${absenceStats.A + absenceStats.D + absenceStats.F}</div>
            </div> <hr>
            ${absenceListHtml} ${changementsListHtml}
            <div class="fiche-buttons">${buttonsHtml}</div>
        `;
        this.showModal(content);

        // branche le bouton Performance pour ouvrir la modale dédiée
        document.getElementById('btn-fiche-performance')?.addEventListener('click', () => {
            this.showPerformanceModal(collab, { granularity: 'week' });
        });
    },

    // ===================== FORMULAIRES =====================
    showCollaborateurForm(collab, allZones, allShifts) {
        const isNew = collab === null;
        const currentData = isNew ? { id: '', prenom: '', nom: '', taux: 100, zone: '', shift: '', dateEntree: new Date(), joursTravailles: [false, true, true, true, true, true, false] } : collab;
        const title = isNew ? "Ajouter un collaborateur" : `Modifier ${currentData.prenom} ${currentData.nom}`;
        const jours = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
        const joursCheckboxes = jours.map((jour, index) => `<label><input type="checkbox" name="jour" value="${index === 6 ? 0 : index + 1}" ${currentData.joursTravailles[index === 6 ? 0 : index + 1] ? 'checked' : ''}> ${jour}</label>`).join('');
        const zoneOptions = Object.entries(allZones).map(([id, label]) => `<option value="${id}" ${currentData.zone === id ? 'selected' : ''}>${label}</option>`).join('');
        const shiftOptions = allShifts.map(shift => `<option value="${shift}" ${currentData.shift === shift ? 'selected' : ''}>${shift}</option>`).join('');
        const content = `
            <h2>${title}</h2>
            <form id="collab-form"><input type="hidden" name="collabId" value="${currentData.id}">
                <div class="form-grid">
                    <label>Prénom:</label> <input type="text" name="prenom" value="${currentData.prenom}" required>
                    <label>Nom:</label> <input type="text" name="nom" value="${currentData.nom}" required>
                    <label>Taux (%):</label> <input type="number" name="taux" min="0" max="100" value="${currentData.taux}">
                    <label>Zone:</label> <select name="zone">${zoneOptions}</select>
                    <label>Shift:</label> <select name="shift">${shiftOptions}</select>
                    <label>Date d'entrée:</label> <input type="date" name="dateEntree" value="${utils.dateToISOString(new Date(currentData.dateEntree))}" required>
                </div>
                <label style="margin-top: 1rem; display: block;">Jours travaillés:</label>
                <div class="jours-travail">${joursCheckboxes}</div>
                <button type="submit" style="margin-top: 1rem;">${isNew ? 'Ajouter' : 'Sauvegarder'}</button>
            </form>
        `;
        this.showModal(content);
    },

    /**
     * Affiche le formulaire pour une demande ou saisie d'absence.
     */
    showAbsenceForm(collab, currentUser) {
        const formTitle = currentUser.role === 'assistant_logistique' ? `Saisir une absence pour ${collab.prenom}` : `Demande d'absence pour ${collab.prenom}`;
        const buttonText = currentUser.role === 'assistant_logistique' ? "Enregistrer l'absence" : "Soumettre la demande";
        const absenceTypes = { V: 'Vacances', R: 'Récupération', D: 'Décès', M: 'Maladie', F: 'Formation', A: 'Autre' };
        const typeOptions = Object.entries(absenceTypes).map(([code, label]) => `<option value="${code}">${label}</option>`).join('');

        const content = `
            <h2>${formTitle}</h2>
            <form id="absence-form">
                <input type="hidden" name="collabId" value="${collab.id}">
                <div class="form-grid">
                    <label for="type">Type d'absence:</label> <select name="type">${typeOptions}</select>
                    <label for="start">Date de début:</label> <input type="date" name="start" required>
                    <label for="end">Date de fin:</label> <input type="date" name="end" required>
                </div>
                <button type="submit" style="margin-top: 1rem;">${buttonText}</button>
            </form>
        `;
        this.showModal(content);
    },

    /**
     * Affiche le formulaire pour enregistrer un changement d'affectation.
     */
    showChangementForm(collab, allZones, allShifts) {
        const title = `Enregistrer un changement pour ${collab.prenom}`;
        const zoneOptions = '<option value="">Ne pas changer</option>' + Object.entries(allZones).map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
        const shiftOptions = '<option value="">Ne pas changer</option>' + allShifts.map(s => `<option value="${s}">${s}</option>`).join('');

        const content = `
            <h2>${title}</h2>
            <p>Ce formulaire enregistre un changement qui prendra effet à la date choisie.</p>
            <form id="changement-form">
                <input type="hidden" name="collabId" value="${collab.id}">
                <div class="form-grid">
                    <label for="dateEffet">Date d'effet:</label> <input type="date" name="dateEffet" required>
                    <label for="zone">Nouvelle Zone:</label> <select name="zone">${zoneOptions}</select>
                    <label for="shift">Nouveau Shift:</label> <select name="shift">${shiftOptions}</select>
                </div>
                <button type="submit" style="margin-top: 1rem;">Enregistrer le changement</button>
            </form>
        `;
        this.showModal(content);
    },

    // ===================== IMPRESSION & QR =====================
    printHtml(html) {
        const w = window.open('', '_blank', 'noopener,noreferrer');
        if (!w) return;
        w.document.open();
        w.document.write(`
            <html><head>
                <meta charset="utf-8">
                <title>Impression</title>
                <style>
                    @media print {
                        @page { margin: 12mm; }
                        body { font-family: Arial, sans-serif; }
                    }
                </style>
            </head><body>${html}
                <script>window.onload = () => { window.focus(); window.print(); };</script>
            </body></html>`);
        w.document.close();
    },

    showQrForm() {
        const urlForm = location.origin + "/public-portal.html";
        const content = `
            <h2>Scanner pour faire une demande</h2>
            <div id="qr-code" style="margin:20px auto;display:flex;justify-content:center;"></div>
            <p style="text-align:center">${urlForm}</p>
        `;
        this.showModal(content);
        // QRCode doit déjà être chargé par ta page
        new QRCode(document.getElementById("qr-code"), { text: urlForm, width: 220, height: 220 });
    },

    showFormDirect() {
        const urlForm = location.origin + "/public-portal.html";
        window.open(urlForm, "_blank");
    },

    // ==========================================================
    //                AJOUTS "PERFORMANCE" CI-DESSOUS
    // ==========================================================

    /**
     * Modale Performance avec choix période + granularité, graphe Canvas, export CSV.
     * opts: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', granularity: 'day'|'week' }
     */
    showPerformanceModal(collab, opts = {}) {
        const now = new Date();
        const dTo   = (opts.to   || now.toISOString().slice(0,10));
        const dFrom = (opts.from || new Date(now.getTime() - 14*86400000).toISOString().slice(0,10));
        const gran  = (opts.granularity || 'week');

        const html = `
          <div style="min-width:760px">
            <h2>Performance — ${collab.prenom || ''} ${collab.nom || ''} (${collab.zone || '-'})</h2>
            <div style="display:flex;gap:10px;align-items:center;margin:10px 0 14px">
              <label>Du <input id="perf-from" type="date" value="${dFrom}"></label>
              <label>Au <input id="perf-to" type="date" value="${dTo}"></label>
              <label>Vue
                <select id="perf-gran">
                  <option value="day" ${gran==='day'?'selected':''}>Jour</option>
                  <option value="week" ${gran==='week'?'selected':''}>Semaine</option>
                </select>
              </label>
              <button id="perf-refresh">Mettre à jour</button>
              <button id="perf-export">Exporter CSV</button>
            </div>
            <canvas id="perf-canvas" width="900" height="360" style="width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:10px"></canvas>
            <div style="display:flex;gap:16px;margin-top:8px;font-size:13px;color:#6b7280">
              <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;background:#2563eb;display:inline-block;border-radius:2px"></i> picking_PTT_sec_per_qty</span>
              <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;background:#ef4444;display:inline-block;border-radius:2px"></i> picking_pur_sec_per_qty</span>
              <span style="display:inline-flex;align-items:center;gap:6px"><i style="width:12px;height:12px;background:#8b5cf6;display:inline-block;border-radius:2px"></i> picking_UF_sec_per_qty</span>
            </div>
          </div>`;
        this.showModal(html);

        const els = {
            from: document.getElementById('perf-from'),
            to:   document.getElementById('perf-to'),
            gran: document.getElementById('perf-gran'),
            btn:  document.getElementById('perf-refresh'),
            exp:  document.getElementById('perf-export'),
            cvs:  document.getElementById('perf-canvas')
        };

        const render = () => {
            const from = new Date(els.from.value);
            const to   = new Date(els.to.value);
            if (isNaN(from) || isNaN(to) || from > to) {
                this.showToastNotification("Période invalide.", "error");
                return;
            }
            const data = this._getPerfPoints(collab, from, to, els.gran.value);
            this._drawPerfChart(els.cvs, data);
        };

        els.btn.addEventListener('click', render);
        els.gran.addEventListener('change', render);
        els.from.addEventListener('change', render);
        els.to.addEventListener('change', render);

        els.exp.addEventListener('click', () => {
            const from = new Date(els.from.value);
            const to   = new Date(els.to.value);
            const data = this._getPerfPoints(collab, from, to, els.gran.value);
            const rows = data.labels.map((label, i) => ({
                label,
                picking_PTT_sec_per_qty: data.series[0][i],
                picking_pur_sec_per_qty: data.series[1][i],
                picking_UF_sec_per_qty:  data.series[2][i]
            }));
            const csv = this._toCSV(rows);
            this._download(`perf_${(collab.prenom||'')}_${(collab.nom||'')}.csv`, csv, "text/csv");
        });

        render();
    },

    // Génère des points démo mais stables par collab + date (quand tu auras les vraies données, remplace cette méthode)
    _getPerfPoints(collab, from, to, granularity) {
        const stepMs = granularity === 'day' ? 86400000 : 7*86400000;
        const labels = [];
        const s1 = [], s2 = [], s3 = [];
        let t = new Date(from.getTime());
        const seed = this._hash(`${collab.id||0}|${collab.zone||''}`) % 1000;

        while (t <= to) {
            const lbl = granularity === 'day'
                ? t.toISOString().slice(0,10)
                : `${t.getUTCFullYear()}-w${this._isoWeek(t)}`;
            labels.push(lbl);

            const jitter = (k) => this._seededNoise(seed + k + t.getUTCDate() + t.getUTCMonth()*3, -0.9, 0.9);
            const v1 = +(30.5 + jitter(1) - (granularity==='week'? (labels.length-1)*0.4 : 0)).toFixed(2);
            const v2 = +(24.5 + jitter(2) + (granularity==='week'? ((labels.length%3)-1)*0.2 : 0)).toFixed(2);
            const v3 = +(17.2 + jitter(3) - (granularity==='week'? ((labels.length%4)-2)*0.15 : 0)).toFixed(2);

            s1.push(Math.max(10, v1));
            s2.push(Math.max(10, v2));
            s3.push(Math.max(10, v3));

            t = new Date(t.getTime() + stepMs);
        }
        return { labels, series: [s1, s2, s3] };
    },

    _drawPerfChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0,0,W,H);

        const m = { left: 48, right: 16, top: 20, bottom: 36 };

        const allVals = data.series.flat();
        const ymin = Math.floor(Math.min(...allVals)) - 1;
        const ymax = Math.ceil(Math.max(...allVals)) + 1;
        const yToPix = v => m.top + (H - m.top - m.bottom) * (1 - (v - ymin) / (ymax - ymin));

        // grille
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        const gridSteps = 5;
        for (let i = 0; i <= gridSteps; i++) {
            const vv = ymin + (i*(ymax - ymin)/gridSteps);
            const y  = yToPix(vv);
            ctx.beginPath(); ctx.moveTo(m.left, y); ctx.lineTo(W - m.right, y); ctx.stroke();
            ctx.fillStyle = '#9ca3af';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(vv.toFixed(0), m.left - 6, y + 4);
        }

        // abscisses
        const n = data.labels.length;
        const xAt = i => m.left + (i * (W - m.left - m.right) / Math.max(1, n - 1));
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.font = '11px sans-serif';
        const every = Math.max(1, Math.ceil(n/8));
        for (let i=0;i<n;i+= every) ctx.fillText(data.labels[i], xAt(i), H - 10);

        // séries
        const colors = ['#2563eb', '#ef4444', '#8b5cf6'];
        data.series.forEach((serie, si) => {
            ctx.strokeStyle = colors[si];
            ctx.lineWidth = 2;
            ctx.beginPath();
            serie.forEach((v, i) => {
                const x = xAt(i), y = yToPix(v);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // points
            ctx.fillStyle = colors[si];
            serie.forEach((v, i) => {
                const x = xAt(i), y = yToPix(v);
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
            });
        });
    },

    // ===================== UTILITAIRES EXPORT =====================
    _download(filename, content, mime="text/plain") {
        const blob = new Blob([content], { type: mime + ";charset=utf-8" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
    },

    _toCSV(rows){
        if (!rows?.length) return '';
        const headers = Object.keys(rows[0]);
        const head = headers.join(';');
        const body = rows.map(r => headers.map(h => String(r[h]).replace(/"/g,'""')).join(';')).join('\n');
        return head + '\n' + body;
    },

    // ===================== HELPERS DÉTERMINISTES =====================
    _hash(s){ let h=0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return Math.abs(h); },
    _isoWeek(d){ const td=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); const day=(td.getUTCDay()+6)%7; td.setUTCDate(td.getUTCDate()-day+3); const firstThursday=new Date(Date.UTC(td.getUTCFullYear(),0,4)); const week=1+Math.round(((td-firstThursday)/86400000-3+((firstThursday.getUTCDay()+6)%7))/7); return String(week).padStart(2,'0'); },
    _seededNoise(seed, a=-1, b=1){ const x = Math.sin(seed*12.9898)*43758.5453; const f = x - Math.floor(x); return a + f * (b - a); }
};
// ===== Modale d'évaluation (notes + commentaire) =====
ui.showEvaluationForm = function(collab, evalObj, onSave){
  const full = `${collab?.prenom||''} ${collab?.nom||''}`.trim();
  const tardiness = (collab?.retardsSemaine1 ?? 0); // si tu as une vraie source, mets-la ici
  const html = `
    <h2>Évaluation d'intégration — ${full}</h2>
    <div class="form-grid" style="grid-template-columns:1fr 1fr">
      <label>Performance (1–5)
        <input id="ev-perf" type="range" min="1" max="5" step="1" value="${evalObj?.scores?.perf ?? 3}" oninput="this.nextElementSibling.value=this.value">
        <output>${evalObj?.scores?.perf ?? 3}</output>
      </label>
      <label>Comportement (1–5)
        <input id="ev-comp" type="range" min="1" max="5" step="1" value="${evalObj?.scores?.comport ?? 3}" oninput="this.nextElementSibling.value=this.value">
        <output>${evalObj?.scores?.comport ?? 3}</output>
      </label>
    </div>
    <div style="margin:.5rem 0;color:#6b7280">Retards semaine 1: <b>${tardiness}</b></div>
    <label>Commentaires
      <textarea id="ev-comments" rows="4" style="width:100%">${evalObj?.comments||''}</textarea>
    </label>
    <div class="fiche-buttons" style="display:flex;gap:8px;justify-content:flex-end;margin-top:.8rem">
      <button id="ev-save">Valider l'évaluation</button>
      <button id="ev-cancel" class="btn-secondary">Annuler</button>
    </div>`;
  ui.showModal(html);

  document.getElementById('ev-cancel')?.addEventListener('click', ui.hideModal);
  document.getElementById('ev-save')?.addEventListener('click', () => {
    const perf = Number(document.getElementById('ev-perf').value);
    const comport = Number(document.getElementById('ev-comp').value);
    const comments = document.getElementById('ev-comments').value || '';
    if (onSave) onSave({ scores:{ perf, comport }, comments });
    ui.hideModal();
  });
};

// ===== Modale de décalage (ajouter un délai + motif) =====
ui.showEvalDelayModal = function(evalObj, onDelay){
  const html = `
    <h2>Décaler l'évaluation</h2>
    <div class="form-grid" style="grid-template-columns:1fr 2fr">
      <label>Nombre de jours
        <input id="ev-delay-days" type="number" min="1" step="1" value="1">
      </label>
      <label>Motif
        <input id="ev-delay-reason" type="text" placeholder="ex: absence chef, formation, etc.">
      </label>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:.8rem">
      <button id="ev-apply-delay">Appliquer</button>
      <button id="ev-delay-cancel" class="btn-secondary">Annuler</button>
    </div>`;
  ui.showModal(html);

  document.getElementById('ev-delay-cancel')?.addEventListener('click', ui.hideModal);
  document.getElementById('ev-apply-delay')?.addEventListener('click', () => {
    const days = Number(document.getElementById('ev-delay-days').value || 0);
    const reason = document.getElementById('ev-delay-reason').value || '';
    if (days <= 0) { ui.showToastNotification('Nombre de jours invalide.', 'error'); return; }
    if (onDelay) onDelay(days, reason);
    ui.hideModal();
  });
};

ui.init();
