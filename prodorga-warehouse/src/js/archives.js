// src/js/archives.js
window.archivesView = {
  async renderView(appState) {
    const role = appState.currentUser?.role;
    if (!(role === 'chef_depot' || role === 'assistant_logistique')) {
      return `
        <div class="view-container">
          <h3>Accès refusé</h3>
          <p>Réservé au chef de dépôt et à l’assistant logistique.</p>
        </div>`;
    }

    const data = Array.isArray(appState.archives) ? appState.archives.slice() : [];

    if (!data.length) {
      return `
        <div class="view-container">
          <h3>Archives</h3>
          <p>Aucune archive pour l’instant.</p>
        </div>`;
    }

    // Tri du plus récent au plus ancien
    data.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));

    const rows = data.map(d => `
      <tr>
        <td>${escapeHTML(d.prenom)} ${escapeHTML(d.nom)}</td>
        <td>${escapeHTML(d.type || '-')}</td>
        <td>${d.start ? new Date(d.start).toLocaleDateString('fr-FR') : '-'}</td>
        <td>${d.end ? new Date(d.end).toLocaleDateString('fr-FR') : '-'}</td>
        <td>${escapeHTML(d.status || '-')}</td>
        <td>${escapeHTML(d.assignedZone || '-')}</td>
        <td>${escapeHTML(d.processedBy || '-')}</td>
        <td>${d.processedAt ? new Date(d.processedAt).toLocaleString('fr-FR') : '-'}</td>
        <td>
          <button class="btn-print-archive" data-id="${escapeAttr(d.id)}">🖨️ Imprimer</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="view-container">
        <h3>Archives des demandes traitées</h3>
        <table class="requests-table" id="archives-table">
          <thead>
            <tr>
              <th>Collaborateur</th>
              <th>Type</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Statut</th>
              <th>Zone</th>
              <th>Traité par</th>
              <th>Traité le</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  postRenderSetup(appState) {
    document.querySelectorAll('.btn-print-archive').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.dataset.id;
        const rec = (appState.archives || []).find(a => String(a.id) === String(id));
        if (!rec) return;

        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;padding:16px;">
            <h2 style="margin:0 0 12px 0;">Demande d'absence — Archive</h2>
            <table style="border-collapse:collapse;width:100%;font-size:14px">
              <tr><td style="padding:6px 4px;"><b>Collaborateur</b></td><td style="padding:6px 4px;">${safe(rec.prenom)} ${safe(rec.nom)}</td></tr>
              <tr><td style="padding:6px 4px;"><b>Type</b></td><td style="padding:6px 4px;">${safe(rec.type)}</td></tr>
              <tr><td style="padding:6px 4px;"><b>Période</b></td><td style="padding:6px 4px;">${formatDate(rec.start)} au ${formatDate(rec.end)}</td></tr>
              <tr><td style="padding:6px 4px;"><b>Statut</b></td><td style="padding:6px 4px;">${safe(rec.status)}</td></tr>
              <tr><td style="padding:6px 4px;"><b>Zone</b></td><td style="padding:6px 4px;">${safe(rec.assignedZone || '-')}</td></tr>
              <tr><td style="padding:6px 4px;"><b>Traité par</b></td><td style="padding:6px 4px;">${safe(rec.processedBy)}</td></tr>
              <tr><td style="padding:6px 4px;"><b>Traité le</b></td><td style="padding:6px 4px;">${formatDateTime(rec.processedAt)}</td></tr>
            </table>
          </div>
        `;
        if (typeof ui?.printHtml === 'function') {
          ui.printHtml(html);
        } else {
          // Filet de sécurité si quelqu'un a encore décollé la fonction du bon endroit
          const w = window.open('', '_blank', 'noopener,noreferrer');
          if (!w) return;
          w.document.open();
          w.document.write(`
            <html><head><meta charset="utf-8"><title>Impression</title>
              <style>@media print {@page{margin:12mm} body{font-family:Arial,Helvetica,sans-serif}}</style>
            </head><body>${html}
              <script>window.onload=()=>{window.focus();window.print();};</script>
            </body></html>`);
          w.document.close();
        }
      });
    });

    // Helpers locaux d’impression
    function formatDate(d){ return d ? new Date(d).toLocaleDateString('fr-FR') : '-'; }
    function formatDateTime(d){ return d ? new Date(d).toLocaleString('fr-FR') : '-'; }
    function safe(v){ return (v ?? '').toString().replace(/[<>&"]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[s])); }
  }
};

// petits helpers d’échappement pour le HTML construit
function escapeHTML(str) {
  return (str ?? '').toString().replace(/[<>&"]/g, s => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[s]));
}
function escapeAttr(str) {
  return (str ?? '').toString().replace(/["']/g, s => (s === '"' ? '&quot;' : '&#39;'));
}
