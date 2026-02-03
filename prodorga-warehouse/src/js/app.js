// src/js/app.js
const app = {
  state: {
    currentView: 'planning-28',
    currentUser: null,
    allData: {
      users: [],
      zones: { Z1:'Zone 1', Z2:'Zone 2', Z3:'Zone 3', Z4:'Zone 4', Z5:'Zone 5', Z6:'Zone 6', Z7:'Zone 7', Z8:'Zone 8', Z9:'Zone 9' },
      shifts: ['Matin', 'Soir', 'Jour', 'Nuit']
    },
    filters: { planningZone: 'all', planningShift: 'all', pickingZone: 'all' },
    planningStartDate: new Date(),
    archives: [],
    integration: { inboxUrl: "" },

    // Évaluations d’intégration
    evaluations: []
  },

  // helpers d’isolation
  isPlanningReady() {
    return !!(window.planning && planning.allData && Array.isArray(planning.allData.collaborateurs));
  },
  whenPlanningReady(fn, tries = 50) {
    if (this.isPlanningReady()) return fn();
    if (tries <= 0) return;
    setTimeout(() => this.whenPlanningReady(fn, tries - 1), 120);
  },

  async init() {
    this.state.planningStartDate = utils.getMonday(new Date());
    await this.loadBaseData();

    // On ne touche pas à planning tant qu’il n’est pas prêt
    this.whenPlanningReady(() => {
      this.bootstrapEvaluations();
      // démo uniquement s'il n'y a aucun collab
      if (!this.state.evaluations.length && planning.allData.collaborateurs.length === 0) {
        this.seedEvaluationDemo();
      }
      this.refreshEvalBadge();
    });

    this.attachNavEventListeners();
    this.attachModalEventListeners();
    this.setupUserSelector();
    this.updateNavVisibility();
    this.render();
  },

  async loadBaseData() {
    const usersData = [
      { id:1,  name:'Jean Depot',     role:'chef_depot' },
      { id:2,  name:'Sophie Zone1',   role:'chef_zone', zone:'Z1' },
      { id:3,  name:'Luc Zone2',      role:'chef_zone', zone:'Z2' },
      { id:4,  name:'Mina Zone3',     role:'chef_zone', zone:'Z3' },
      { id:5,  name:'Omar Zone4',     role:'chef_zone', zone:'Z4' },
      { id:6,  name:'Léa Zone5',      role:'chef_zone', zone:'Z5' },
      { id:7,  name:'Noé Zone6',      role:'chef_zone', zone:'Z6' },
      { id:8,  name:'Iris Zone7',     role:'chef_zone', zone:'Z7' },
      { id:9,  name:'Paul Zone8',     role:'chef_zone', zone:'Z8' },
      { id:10, name:'Nora Zone9',     role:'chef_zone', zone:'Z9' },
      { id:11, name:'Marc Assistant', role:'assistant_logistique' },
      { id:12, name:'Ana Direction',  role:'direction' }
    ];
    this.state.allData.users = usersData;
    this.state.currentUser = usersData[0];
  },

  // ---------- Évaluations ----------
  bootstrapEvaluations(){
    if (!this.isPlanningReady()) return;
    const collabs = planning.allData.collaborateurs;
    const existing = new Set(this.state.evaluations.map(e => e.collabId));
    collabs.forEach(c => {
      if (!c?.id || !c?.dateEntree || existing.has(c.id)) return;
      const d0 = new Date(c.dateEntree);
      const due = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 7, 10, 0, 0);
      this.state.evaluations.push({
        id: 'ev_'+c.id,
        collabId: c.id,
        dueAt: due.toISOString(),
        status: 'pending',
        delayDays: 0,
        delayReason: '',
        createdAt: new Date().toISOString(),
        completedAt: null,
        scores: { perf:null, comport:null },
        comments: ''
      });
    });
  },

  // Démo autonome: ne dépend PAS de planning
  seedEvaluationDemo() {
    if (this.state.evaluations.length > 0) return;

    const now = new Date();
    const mkDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const demos = [
      { prenom:'Lina',  nom:'Dupont', zone:'Z1', dateEntree: mkDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-10)) },
      { prenom:'Yanis', nom:'Martin', zone:'Z2', dateEntree: mkDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-8)) },
      { prenom:'Caro',  nom:'Schmid', zone:'Z3', dateEntree: mkDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-6)) },
      { prenom:'Marek', nom:'Rossi',  zone:'Z4', dateEntree: mkDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-4)) },
      { prenom:'Sofia', nom:'Novak',  zone:'Z5', dateEntree: mkDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-2)) },
    ];

    demos.forEach((c, i) => {
      const due = new Date(now);
      if (i === 0) due.setDate(now.getDate() - 3);
      if (i === 1) due.setHours(now.getHours(), 0, 0, 0);
      if (i === 2) due.setDate(now.getDate() + 2);
      if (i === 3) due.setDate(now.getDate() + 5);
      if (i === 4) due.setDate(now.getDate() - 5);

      this.state.evaluations.push({
        id: 'ev_demo_' + (900 + i),
        collabId: 'demo_' + i,     // id fictif
        dueAt: due.toISOString(),
        status: i === 4 ? 'done' : (i === 3 ? 'delayed' : 'pending'),
        delayDays: i === 3 ? 3 : 0,
        delayReason: i === 3 ? 'Chef indisponible' : '',
        createdAt: new Date().toISOString(),
        completedAt: i === 4 ? new Date(now.getTime() - 2*86400000).toISOString() : null,
        scores: i === 4 ? { perf: 4, comport: 5 } : { perf: null, comport: null },
        comments: i === 4 ? 'Très bonne intégration.' : '',
        // snapshot collab pour l'affichage sans planning
        _demo: { prenom: c.prenom, nom: c.nom, zone: c.zone, dateEntree: c.dateEntree }
      });
    });

    this.refreshEvalBadge();
    this.render();
  },

  evalDueCount(){
    const now = new Date();
    return this.state.evaluations.filter(e => e.status !== 'done' && new Date(e.dueAt) <= now).length;
  },

  setupUserSelector() {
    const selector = document.getElementById('user-selector');
    if (!selector) return;
    selector.innerHTML = this.state.allData.users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    selector.value = this.state.currentUser.id;
    selector.addEventListener('change', e => {
      this.state.currentUser = this.state.allData.users.find(u => u.id === parseInt(e.target.value));
      this.updateNavVisibility();
      this.render();
    });
  },

  updateNavVisibility() {
    const role = this.state.currentUser?.role;
    const show = id => { const el = document.getElementById(id); if (el) el.style.display = ''; };
    const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
    ['btn-planning-28','btn-semaine-dp','btn-picking','btn-heatmap','btn-collaborateur','btn-zones','btn-demandes','btn-archives','btn-qr','btn-formulaire','btn-simulation','nav-evaluations'].forEach(show);

    if (role === 'direction') {
      ['btn-planning-28','btn-semaine-dp','btn-picking','btn-heatmap','btn-collaborateur','btn-zones','btn-demandes','btn-qr','btn-formulaire'].forEach(hide);
      show('btn-simulation'); show('btn-archives'); show('nav-evaluations');
    }

    const btnArchives = document.getElementById('btn-archives');
    if (btnArchives) btnArchives.style.display = (role === 'chef_depot' || role === 'assistant_logistique' || role === 'direction') ? '' : 'none';
  },

  async render() {
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = '<h2>Chargement...</h2>';
    let viewHtml = '';
    try {
      switch (this.state.currentView) {
        case 'planning-28': viewHtml = await planning.renderView(this.state); break;
        case 'semaineDP':  viewHtml = await semaineDP.renderView(this.state); break;
        case 'picking':    viewHtml = await picking.renderView(this.state); break;
        case 'demandes':   viewHtml = await demandes.renderView(this.state); break;
        case 'heatmap':    viewHtml = await heatmap.renderView(this.state); break;
        case 'archives':
          viewHtml = (window.archivesView && archivesView.renderView)
            ? await archivesView.renderView(this.state)
            : '<div class="view-container"><h3>Archives indisponibles</h3></div>';
          break;
        case 'simulation':
          viewHtml = (window.simulationView && simulationView.renderView)
            ? await simulationView.renderView(this.state)
            : '<div class="view-container"><h3>Simulation indisponible</h3></div>';
          break;
        case 'evaluations':
          viewHtml = await evaluationsView.renderView(this.state);
          break;
        default:
          viewHtml = `<h2>Vue "${this.state.currentView}" non trouvée</h2>`;
      }
    } catch (err) {
      console.error(`Erreur de rendu pour la vue '${this.state.currentView}':`, err);
      viewHtml = `<div class="error-message">Erreur d'affichage. Vérifiez la console pour les détails.</div>`;
    }
    appContainer.innerHTML = viewHtml;

    if (this.state.currentView === 'planning-28') planning.postRenderSetup?.();
    if (this.state.currentView === 'picking')     picking.postRenderSetup?.(this.state);
    if (this.state.currentView === 'demandes')    demandes.postRenderSetup?.();
    if (this.state.currentView === 'heatmap')     heatmap.postRenderSetup?.(this.state);
    if (this.state.currentView === 'archives')    archivesView?.postRenderSetup?.(this.state);
    if (this.state.currentView === 'simulation')  simulationView?.postRenderSetup?.(this.state);
    if (this.state.currentView === 'evaluations') evaluationsView?.postRenderSetup?.(this.state);

    this.updatePendingBadge();
    this.refreshEvalBadge();
  },

  setFilters(newFilters){ Object.assign(this.state.filters, newFilters); this.render(); },
  setPlanningDate(newDate){ this.state.planningStartDate = newDate; this.render(); },

  // Délégations UI
  showCollaborateurFiche(collabId){
    const collab = planning.allData?.collaborateurs.find(c => c.id === collabId);
    if (collab) ui.showCollaborateurFiche(collab, this.state.currentUser, this.state.allData.zones, this.state.allData.shifts);
  },
  showCollaborateurForm(collabId){
    const collab = collabId ? planning.allData.collaborateurs.find(c => c.id === collabId) : null;
    ui.showCollaborateurForm(collab, this.state.allData.zones, this.state.allData.shifts);
  },
  showAbsenceFormForCollab(collabId){
    const collab = planning.allData.collaborateurs.find(c => c.id === collabId);
    if (collab) ui.showAbsenceForm(collab, this.state.currentUser);
  },
  showChangementFormForCollab(collabId){
    const collab = planning.allData.collaborateurs.find(c => c.id === collabId);
    if (collab) ui.showChangementForm(collab, this.state.allData.zones, this.state.allData.shifts);
  },

  // Archives
  archiveAbsence(collab, absence, processedBy) {
    if (!Array.isArray(this.state.archives)) this.state.archives = [];
    const snap = {
      id: `${collab.id}-${Date.now()}`,
      collabId: collab.id,
      prenom: collab.prenom,
      nom: collab.nom,
      type: absence.type,
      start: absence.start ? new Date(absence.start) : null,
      end:   absence.end   ? new Date(absence.end)   : null,
      status: absence.status,
      assignedZone: absence.assignedZone || collab.zone,
      processedBy: processedBy?.name || 'Système',
      processedAt: new Date()
    };
    this.state.archives.push(snap);
  },

  getInitialWorkflowForCreation(role){
    if (role === 'assistant_logistique') {
      return { approvals: { zone:'approved', depot:'approved', assist:'done' }, status:'Validé' };
    }
    if (role === 'chef_zone') {
      return { approvals: { zone:'approved', depot:'pending', assist:'todo' }, status:'En attente' };
    }
    return { approvals: { zone:'pending', depot:'pending', assist:'todo' }, status:'En attente' };
  },

  updateRequestStage(collabId, absenceIndex, stage, action, note=''){
    const collab = planning.allData?.collaborateurs.find(c => c.id === collabId);
    if (!collab || !collab.absences?.[absenceIndex]) return;

    const req = collab.absences[absenceIndex];
    const currentUser = this.state.currentUser || { name:'Système', role:'system' };
    req.approvals ||= { zone:'pending', depot:'pending', assist:'todo' };

    if (stage === 'depot' && req.approvals.zone !== 'approved') {
      ui.showToastNotification("Impossible: la zone n'a pas encore validé.", "error");
      return;
    }
    if (stage === 'assist' && req.approvals.depot !== 'approved') {
      ui.showToastNotification("Impossible: le chef de dépôt n'a pas encore validé.", "error");
      return;
    }

    if (stage === 'zone')   req.approvals.zone  = (action === 'approve') ? 'approved' : 'rejected';
    if (stage === 'depot')  req.approvals.depot = (action === 'approve') ? 'approved' : 'rejected';
    if (stage === 'assist') req.approvals.assist = 'done';

    if (req.approvals.zone === 'rejected' || req.approvals.depot === 'rejected') {
      req.status = 'Refusé';
    } else if (req.approvals.zone === 'approved' && req.approvals.depot === 'approved') {
      req.status = 'Validé';
    } else {
      req.status = 'En attente';
    }

    (req.history ||= []).push({
      at: new Date(),
      byRole: currentUser.role,
      byName: currentUser.name,
      stage, action, note
    });

    if (stage === 'depot' && (action === 'approve' || action === 'reject')) {
      this.archiveAbsence(collab, req, currentUser);
    }

    ui.showToastNotification(`Action enregistrée: ${stage}/${action}`, "success");
    this.render();
  },

  computePendingForRole(){
    const role = this.state.currentUser?.role;
    const myZone = this.state.currentUser?.zone;
    let count = 0;
    (planning.allData?.collaborateurs || []).forEach(collab => {
      (collab.absences || []).forEach(a => {
        const ap = a.approvals || {};
        if (role === 'chef_zone') {
          if (a.assignedZone === myZone && ap.zone === 'pending') count++;
        } else if (role === 'chef_depot') {
          if (ap.zone === 'approved' && ap.depot === 'pending') count++;
        } else if (role === 'assistant_logistique') {
          if (ap.depot === 'approved' && ap.assist === 'todo') count++;
        }
      });
    });
    return count;
  },

  updatePendingBadge(){
    const btn = document.getElementById('btn-demandes');
    if (!btn) return;
    const count = this.computePendingForRole();
    let badge = btn.querySelector('.pending-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'pending-badge';
      btn.appendChild(badge);
    }
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  },

  refreshEvalBadge(){
    const b = document.getElementById('eval-badge');
    if (!b) return;
    const n = this.evalDueCount();
    b.textContent = n;
    b.style.display = n > 0 ? 'inline-flex' : 'none';
  },

  async syncInbox(){
    const url = this.state.integration?.inboxUrl;
    if (!url) { ui.showToastNotification("Inbox non configuré.", "error"); return; }
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error("Réponse invalide");
      const rows = json.rows || [];
      let imported = 0;

      rows.forEach(r => {
        const collab = planning.allData?.collaborateurs.find(c => String(c.id) === String(r.collabId));
        if (!collab) return;

        const key = `${r.type}|${r.start}|${r.end}`;
        const exists = (collab.absences||[]).some(a => `${a.type}|${fmt(a.start)}|${fmt(a.end)}` === key && a.status === 'En attente');
        if (!exists) {
          (collab.absences ||= []).push({
            type: String(r.type).toUpperCase(),
            start: new Date(r.start),
            end: new Date(r.end),
            status: 'En attente',
            assignedZone: planning.getCollaborateurInfoAtDate ? planning.getCollaborateurInfoAtDate(collab, new Date())?.zone : collab.zone,
            approvals: { zone:'pending', depot:'pending', assist:'todo' },
            _source: 'inbox'
          });
          imported++;
        }
      });

      ui.showToastNotification(`${imported} demande(s) importée(s).`, "success");
      this.render();
    } catch (err) {
      ui.showToastNotification("Erreur de synchronisation.", "error");
      console.error(err);
    }
    function fmt(d){ return new Date(d).toISOString().slice(0,10); }
  },

  attachModalEventListeners(){
    document.getElementById('modal-content').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const fd = new FormData(form);

      if (form.id === 'collab-form') {
        ui.showToastNotification("Collaborateur sauvegardé (simulation).", "success");
        ui.hideModal(); this.render();
      }
      else if (form.id === 'absence-form') {
        const collabId = fd.get("collabId");
        const typeAbsence = fd.get("type");
        const startDate = new Date(fd.get("start"));
        const endDate = new Date(fd.get("end"));

        const collab = planning.allData.collaborateurs.find(c => c.id === parseInt(collabId, 10));
        if (!collab) { ui.showToastNotification("Erreur: collaborateur introuvable.", "error"); ui.hideModal(); this.render(); return; }

        const role = this.state.currentUser?.role;
        const { approvals, status } = this.getInitialWorkflowForCreation(role);
        const currentInfo = planning.getCollaborateurInfoAtDate ? planning.getCollaborateurInfoAtDate(collab, new Date()) : { zone: collab.zone };

        const newAbs = {
          type: (typeAbsence || '').toUpperCase(),
          start: startDate,
          end: endDate,
          status,
          assignedZone: currentInfo.zone || collab.zone,
          approvals,
          _source: 'app',
          requestedByRole: role
        };
        (collab.absences ||= []).push(newAbs);

        if (role === 'assistant_logistique') this.archiveAbsence(collab, newAbs, this.state.currentUser);

        ui.showToastNotification(
          role === 'assistant_logistique'
            ? "Absence saisie et appliquée au planning."
            : role === 'chef_zone'
              ? "Demande créée: en attente de validation du chef de dépôt."
              : "Demande enregistrée: en attente de validation du chef de zone.",
          "success"
        );
        ui.hideModal(); this.render();
      }
      else if (form.id === 'changement-form') {
        ui.showToastNotification("Changement enregistré (simulation).", "success");
        ui.hideModal(); this.render();
      }
      else {
        ui.hideModal(); this.render();
      }
    });
  },

  attachNavEventListeners(){
    const navButtons = {
      'btn-planning-28':'planning-28',
      'btn-semaine-dp':'semaineDP',
      'btn-picking':'picking',
      'btn-heatmap':'heatmap',
      'btn-demandes':'demandes',
      'btn-archives':'archives',
      'btn-simulation':'simulation'
    };
    for (const [btnId, viewName] of Object.entries(navButtons)) {
      const el = document.getElementById(btnId);
      if (!el) continue;
      el.addEventListener('click', () => { this.state.currentView = viewName; this.render(); });
    }

    const btnCollab = document.getElementById('btn-collaborateur');
    const btnZones  = document.getElementById('btn-zones');
    if (btnCollab) btnCollab.addEventListener('click', () => this.showCollaborateurForm(null));
    if (btnZones)  btnZones.addEventListener('click', () => ui.showToastNotification("Gestion des zones en construction.", "info"));

    document.getElementById('btn-qr')?.addEventListener('click', () => ui.showQrForm?.());
    document.getElementById('btn-formulaire')?.addEventListener('click', () => ui.showFormDirect?.());

    document.getElementById('nav-evaluations')?.addEventListener('click', () => {
      this.state.currentView = 'evaluations';
      this.render();
    });
  }
};

/* -------- Vue ÉVALUATIONS -------- */
const evaluationsView = {
  async renderView(state){
    const list = state.evaluations.slice().sort((a,b) => new Date(a.dueAt) - new Date(b.dueAt));

    const row = (e) => {
      // Fallback sur e._demo si le planning n’est pas dispo ou ne contient pas ce collab
      const c = (window.planning?.allData?.collaborateurs || []).find(x => x.id === e.collabId) || e._demo || {};
      const dueStr = new Date(e.dueAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const over = (e.status!=='done' && new Date(e.dueAt) <= new Date());
      const entree = c.dateEntree ? utils.dateToISOString(new Date(c.dateEntree)).slice(0,10) : '';

      return `<tr>
        <td>${(c.prenom||'')} ${(c.nom||'')}</td>
        <td>${c.zone||'-'}</td>
        <td>${entree}</td>
        <td ${over?'style="color:#b91c1c;font-weight:600"':''}>${dueStr}</td>
        <td>${e.status}</td>
        <td class="eval-actions">
          <button class="btn-eval" data-id="${e.id}">Évaluer</button>
          <button class="btn-delay" data-id="${e.id}">Décaler</button>
          ${e.status !== 'done' ? `<button class="btn-done" data-id="${e.id}">Confirmer</button>` : ''}
        </td>
      </tr>`;
    };

    const emptyBlock = `
      <tr><td colspan="6" style="color:#6b7280">
        Aucune évaluation.
        <button id="seed-eval-demo" style="margin-left:8px">Remplir avec un exemple</button>
      </td></tr>`;

    return `
      <div class="view-container">
        <h3>Évaluations d'intégration</h3>
        <p style="color:#6b7280">À faire maintenant: <b>${app.evalDueCount()}</b></p>
        <table class="eval-table">
          <thead><tr>
            <th>Collaborateur</th><th>Zone</th><th>Entrée</th><th>Échéance</th><th>Statut</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${list.length ? list.map(row).join('') : emptyBlock}
          </tbody>
        </table>
      </div>`;
  },

  postRenderSetup(){
    const btnSeed = document.getElementById('seed-eval-demo');
    if (btnSeed) btnSeed.addEventListener('click', () => app.seedEvaluationDemo());

    document.querySelectorAll('.btn-eval').forEach(b => b.addEventListener('click', ev => {
      const id = ev.currentTarget.dataset.id;
      const e = app.state.evaluations.find(x => x.id === id);
      const c = (window.planning?.allData?.collaborateurs || []).find(x => x.id === e.collabId) || e._demo || {};
      const full = `${c.prenom||''} ${c.nom||''}`.trim();

      const html = `
        <h2>Évaluation d'intégration — ${full}</h2>
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
          <label>Performance (1–5)
            <input id="ev-perf" type="range" min="1" max="5" step="1" value="${e?.scores?.perf ?? 3}" oninput="this.nextElementSibling.value=this.value">
            <output>${e?.scores?.perf ?? 3}</output>
          </label>
          <label>Comportement (1–5)
            <input id="ev-comp" type="range" min="1" max="5" step="1" value="${e?.scores?.comport ?? 3}" oninput="this.nextElementSibling.value=this.value">
            <output>${e?.scores?.comport ?? 3}</output>
          </label>
        </div>
        <label>Commentaires
          <textarea id="ev-comments" rows="4" style="width:100%">${e?.comments||''}</textarea>
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:.8rem">
          <button id="ev-save">Valider l'évaluation</button>
          <button id="ev-cancel" class="btn-secondary">Annuler</button>
        </div>`;
      ui.showModal(html);

      document.getElementById('ev-cancel')?.addEventListener('click', ui.hideModal);
      document.getElementById('ev-save')?.addEventListener('click', () => {
        const perf = Number(document.getElementById('ev-perf').value);
        const comport = Number(document.getElementById('ev-comp').value);
        const comments = document.getElementById('ev-comments').value || '';
        e.scores = { perf, comport };
        e.comments = comments;
        e.status = 'done';
        e.completedAt = new Date().toISOString();
        ui.showToastNotification('Évaluation enregistrée.', 'success');
        ui.hideModal();
        app.render();
      });
    }));

    document.querySelectorAll('.btn-delay').forEach(b => b.addEventListener('click', ev => {
      const id = ev.currentTarget.dataset.id;
      const e = app.state.evaluations.find(x => x.id === id);
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
        const d = new Date(e.dueAt);
        d.setDate(d.getDate() + days);
        e.dueAt = d.toISOString();
        e.delayDays = (e.delayDays||0) + days;
        e.delayReason = reason;
        e.status = 'delayed';
        ui.showToastNotification(`Décalée de ${days} jour(s).`, 'info');
        ui.hideModal();
        app.render();
      });
    }));

    document.querySelectorAll('.btn-done').forEach(b => b.addEventListener('click', ev => {
      const id = ev.currentTarget.dataset.id;
      const e = app.state.evaluations.find(x => x.id === id);
      e.status = 'done';
      e.completedAt = new Date().toISOString();
      ui.showToastNotification('Marquée comme faite.', 'success');
      app.render();
    }));
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
