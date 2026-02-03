// src/js/demandes.js
const demandes = {
  async renderView(appState) {
    await planning.loadData?.();
    if (!planning.allData || !planning.allData.collaborateurs) {
      return `<div class="error-message">Impossible de charger les données des collaborateurs.</div>`;
    }

    const role = appState.currentUser?.role;
    const myZone = appState.currentUser?.zone;
    const collaborateurs = planning.allData.collaborateurs;

    const rowsToShow = [];
    collaborateurs.forEach(collab => {
      (collab.absences || []).forEach((a, idx) => {
        a.approvals = a.approvals || { zone:'pending', depot:'pending', assist:'todo' };

        if (role === 'chef_zone') {
          // La zone ne traite que les siennes et uniquement quand c'est en attente zone
          if ((a.assignedZone === myZone) && a.approvals.zone === 'pending') rowsToShow.push({ collab, a, idx });
        } else if (role === 'chef_depot') {
          // Le dépôt ne voit que ce qui a déjà été approuvé par la zone
          if (a.approvals.zone === 'approved' && a.approvals.depot === 'pending') rowsToShow.push({ collab, a, idx });
        } else if (role === 'assistant_logistique') {
          // L’assistant marque "vu & traité" après la décision dépôt
          if (a.approvals.depot === 'approved' && a.approvals.assist === 'todo') rowsToShow.push({ collab, a, idx });
        }
      });
    });

    const header = `
      <thead>
        <tr>
          <th>Collaborateur</th>
          <th>Type</th>
          <th>Début</th>
          <th>Fin</th>
          <th>Zone</th>
          <th>Étape</th>
          <th>Action</th>
        </tr>
      </thead>`;

    const body = rowsToShow.map(({ collab, a, idx }) => this.makeRow(appState, collab, a, idx)).join('');
    const syncBtn = (role === 'chef_depot') ? `<button id="btn-sync-inbox" class="btn-sync">🔄 Synchroniser</button>` : "";

    const contentHtml = rowsToShow.length > 0
      ? `<h3>Demandes à traiter ${syncBtn}</h3><table class="requests-table">${header}<tbody>${body}</tbody></table>`
      : `<div style="display:flex;gap:12px;align-items:center;"><h3>Aucune demande à cette étape.</h3>${syncBtn}</div>`;

    return `<div class="view-container">${contentHtml}</div>`;
  },

  makeRow(appState, collab, a, idx) {
    const role = appState.currentUser?.role;
    const typeLabel = a.type || '-';
    const start = a.start ? new Date(a.start).toLocaleDateString('fr-FR') : '-';
    const end   = a.end   ? new Date(a.end).toLocaleDateString('fr-FR')   : '-';
    const zone  = a.assignedZone || '-';

    const step = (role === 'chef_zone') ? 'Validation zone'
              : (role === 'chef_depot') ? 'Validation dépôt'
              : 'Traitement assistant';

    let actions = '';
    if (role === 'chef_zone' || role === 'chef_depot') {
      const stage = role === 'chef_zone' ? 'zone' : 'depot';
      actions = `
        <button class="btn-approve" data-cid="${collab.id}" data-i="${idx}" data-stage="${stage}">✅ Valider</button>
        <button class="btn-reject"  data-cid="${collab.id}" data-i="${idx}" data-stage="${stage}">❌ Refuser</button>`;
    } else if (role === 'assistant_logistique') {
      actions = `<button class="btn-done" data-cid="${collab.id}" data-i="${idx}" data-stage="assist">👀 Vu & traité</button>`;
    }

    return `<tr>
      <td>${collab.prenom} ${collab.nom}</td>
      <td>${typeLabel}</td>
      <td>${start}</td>
      <td>${end}</td>
      <td>${zone}</td>
      <td>${step}</td>
      <td>${actions}</td>
    </tr>`;
  },

  postRenderSetup() {
    // Actions zone/dépôt
    document.querySelectorAll('.btn-approve,.btn-reject').forEach(btn => {
      btn.addEventListener('click', e => {
        const b = e.currentTarget;
        const collabId = parseInt(b.dataset.cid, 10);
        const idx = parseInt(b.dataset.i, 10);
        const stage = b.dataset.stage; // 'zone' | 'depot'
        const action = b.classList.contains('btn-approve') ? 'approve' : 'reject';
        app.updateRequestStage(collabId, idx, stage, action);
      });
    });

    // Action assistant
    document.querySelectorAll('.btn-done').forEach(btn => {
      btn.addEventListener('click', e => {
        const b = e.currentTarget;
        const collabId = parseInt(b.dataset.cid, 10);
        const idx = parseInt(b.dataset.i, 10);
        app.updateRequestStage(collabId, idx, 'assist', 'done');
      });
    });

    // Sync éventuelle
    const sync = document.getElementById('btn-sync-inbox');
    if (sync) sync.addEventListener('click', () => app.syncInbox?.());
  }
};
