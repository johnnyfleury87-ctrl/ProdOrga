// src/js/simulation.js  — MODE PRÉSENTATION (sans dépendance aux CSV)

// =================== PARAMÈTRES GLOBAUX (démo) ===================
const ORDERS_PER_DAY = 3000;          // cible "marketing"
const AVG_ITEMS_PER_ORDER = 54;       // panier moyen
const TARGET_PICKS = ORDERS_PER_DAY * AVG_ITEMS_PER_ORDER; // 162'000

// Packaging (probas d'usage par pick + coût unitaire)
const PACK_CONSUMPTION = {
  'Protection verre':            { prob: 0.08, cost: 0.35 },
  'Carton 3e bouteille':         { prob: 0.06, cost: 0.40 },
  'Carton yaourt':               { prob: 0.05, cost: 0.25 },
  'Sachet transparent TK':       { prob: 0.14, cost: 0.07 },
  'Sachet transparent sac iso':  { prob: 0.02, cost: 1.20 },
  'Sac papier':                  { prob: 0.22, cost: 0.15 }
};

// Defaults présentation
const DEFAULT_BOX_PER_DAY = 10000;
const DEFAULT_BOX_COST   = 5;          // CHF/box

// Stock fictif (juste pour l'animation)
const STOCK_FAKE_PER_RACK = 2000;
const STOCK_ALERT_THRESHOLD = 0.85;

// =================== PLAN DE PRODUCTION (démo) ===================
const NIGHT_SHARE = 0.65;              // part nuit vs jour
const DAY_SHARE   = 0.35;

const NIGHT_HOURS = [19,20,21,22,23,0,1,2,3,4]; // 19h→04h
const DAY_HOURS   = [5,6,7,8,9,10,11,12,13,14]; // 05h→14h

function rnd(min, max){ return min + Math.random()*(max-min); }
function irnd(min, max){ return Math.round(rnd(min, max)); }
function pickN(arr, n){ const a=[...arr]; const out=[]; while(a.length && out.length<n){ out.push(a.splice(Math.floor(Math.random()*a.length),1)[0]); } return out; }
function p(prob){ return Math.random() < prob; }

// courbe lissée pour répartir la charge par heure
function bellSplit(total, arrLen){
  const mid = (arrLen-1)/2;
  const weights = Array.from({length:arrLen}, (_,i)=> 1 + 0.6 * Math.exp(-Math.pow((i-mid)/2.2,2)));
  const sum = weights.reduce((a,b)=>a+b,0);
  return weights.map(w => Math.round(total * (w/sum)));
}
const TARGET_NIGHT = Math.round(TARGET_PICKS * NIGHT_SHARE);
const TARGET_DAY   = Math.round(TARGET_PICKS * DAY_SHARE);
const PLAN_NIGHT   = bellSplit(TARGET_NIGHT, NIGHT_HOURS.length);
const PLAN_DAY     = bellSplit(TARGET_DAY,   DAY_HOURS.length);

// cumul planifié à l’instant t
function cumulativeTargetAt(date){
  const d = new Date(date);
  let cum = 0;

  // nuit (19h la veille → 04h le jour J)
  for (let i=0;i<NIGHT_HOURS.length;i++){
    const hh = NIGHT_HOURS[i];
    const seg = new Date(d);
    if (hh <= 4) seg.setDate(seg.getDate()); else seg.setDate(seg.getDate()-1);
    seg.setHours(hh,59,59,999);
    if (date >= seg) cum += PLAN_NIGHT[i];
  }
  // jour (05h → 14h)
  for (let i=0;i<DAY_HOURS.length;i++){
    const seg = new Date(d);
    seg.setHours(DAY_HOURS[i],59,59,999);
    if (date >= seg) cum += PLAN_DAY[i];
  }
  return cum;
}

// =================== VUE SIMULATION (démo) ===================
window.simulationView = {
  _timer: null,
  _speed: 300, // 1s = 5 min simulées
  _state: null,

  // Pour la démo, ETA stable et crédible
  _AVG_RATE_FOR_ETA: 25000, // picks/h utilisés pour l’ETA (fixe)

  async renderView(appState) {
    const role = appState.currentUser?.role;
    if (!(role === 'chef_depot' || role === 'direction')) {
      return `<div class="view-container"><h3>Accès refusé</h3><p>Réservé au chef de dépôt et à la Direction.</p></div>`;
    }

    const targetDay = this._state?.targetDay || this._defaultSimDay();
    if (!this._state) this._state = this.createInitialState(targetDay);
    const s = this._state;

    return `
      <div class="view-container">
        <h3>Simulation KPI – ${targetDay}</h3>

        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
          <label>Journée: <input id="sim-day" type="date" value="${targetDay}"></label>
          <button id="sim-play">${this._timer ? '⏸️ Pause' : '▶️ Play'}</button>
          <button id="sim-reset">🔁 Reset</button>
          <label>Vitesse
            <select id="sim-speed">
              <option value="1">x1</option>
              <option value="5">x5</option>
              <option value="15">x15</option>
              <option value="60">x60</option>
              <option value="300" selected>x300</option>
            </select>
          </label>
          <button id="sim-events">🧾 Événements</button>
          <button id="sim-report">🧾 Rapport</button>
          <button id="sim-export">📤 Export</button>
        </div>

        <!-- Flux flottant -->
        <div id="sim-feed" style="
          position: fixed; right: 18px; bottom: 18px;
          width: 340px; max-height: 46vh; overflow:auto;
          background:#fff; border:1px solid #e5e7eb; border-radius:10px;
          box-shadow:0 6px 24px rgba(0,0,0,.08); padding:10px; z-index:999;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <strong>Flux en direct</strong>
            <button id="feed-clear" style="font-size:12px;border:1px solid #ddd;border-radius:6px;padding:2px 6px;background:#f9fafb">vider</button>
          </div>
          <ul id="feed-list" style="margin:0;padding-left:18px;font-size:13px;line-height:1.35"></ul>
        </div>

        <div style="height:8px;background:#eee;border-radius:6px;overflow:hidden;margin-bottom:12px">
          <div style="height:100%;background:#10b981;width:${s.progressPct.toFixed(1)}%"></div>
        </div>

        <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:10px">
          ${this.kpiCard('⌛ Heure simulée', this._fmtTime(s.clock))}
          ${this.kpiCard('📦 Commandes (cible)', ORDERS_PER_DAY)}
          ${this.kpiCard('✅ Terminées (picks)', s.picksNight + s.picksDay)}
          ${this.kpiCard('🔄 En cours (picks)', s.inProgress)}
          ${this.kpiCard('⚡ Picks/h (global)', s.ratePH.toFixed(0))}
          ${this.kpiCard('🕒 ETA fin', s.etaText || '-')}
        </div>

        <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:10px">
          ${this.kpiCard('🌙 Picks nuit', s.picksNight)}
          ${this.kpiCard('🌤️ Picks jour', s.picksDay)}
          ${this.kpiCard('🙍 Absents (jour)', s.absents)}
          ${this.kpiCard('⏰ Retards', s.retards)}
          ${this.kpiCard('🚫 No badge 05:30', s.noBadge)}
          ${this.kpiCard('⏱️ Pauses dépassées', s.pauseOverruns)}
        </div>

        <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:10px">
          ${this.kpiEditable('📦 Box/jour', s.packaging.boxPerDay, 'boxPerDay')}
          ${this.kpiEditable('💸 Coût box (CHF)', s.packaging.boxCostUnit, 'boxCostUnit')}
          ${this.kpiCard('🧰 coût matériaux (CHF)', s.packaging.materialCost.toFixed(0))}
          ${this.kpiCard('🧮 total packaging (CHF)', s.packaging.totalCost.toFixed(0))}
          ${this.kpiCard('🔺 Évolution jour (%)', s.packaging.dayGrowth.toFixed(1))}
          ${this.kpiCard('⚠️ Alerte rupture', s.ruptureAlerts)}
        </div>

        ${this.renderZonesTable()}
      </div>
    `;
  },

  postRenderSetup() {
    const sp = document.getElementById('sim-speed');
    if (sp) {
      sp.value = String(this._speed);
      sp.addEventListener('change', e => {
        this._speed = parseInt(e.target.value, 10);
        if (this._timer) { clearInterval(this._timer); this._timer = setInterval(()=>this.tick(), 1000); }
      });
    }

    document.getElementById('sim-play')?.addEventListener('click', () => this.toggle());
    document.getElementById('sim-reset')?.addEventListener('click', () => this.reset());

    document.getElementById('sim-day')?.addEventListener('change', e => {
      const d = e.target.value;
      this._state = this.createInitialState(d);
      app.state.currentView = 'simulation';
      app.render();
    });

    document.getElementById('sim-events')?.addEventListener('click', () => this.showEvents());
    document.getElementById('feed-clear')?.addEventListener('click', () => { this._state.eventLog = []; this._renderFeed(); });

    document.getElementById('sim-report')?.addEventListener('click', () => this.showDailyReport());
    document.getElementById('sim-export')?.addEventListener('click', () => this.showExportMenu());

    const s = this._state;
    const boxPerDayInput   = document.getElementById('inp-boxPerDay');
    const boxCostUnitInput = document.getElementById('inp-boxCostUnit');

    if (boxPerDayInput) boxPerDayInput.addEventListener('change', e => {
      s.packaging.boxPerDay = Math.max(0, parseInt(e.target.value || 0, 10));
      s.packaging.boxCostToday = s.packaging.boxPerDay * s.packaging.boxCostUnit;
      s.packaging.totalCost = s.packaging.boxCostToday + s.packaging.materialCost;
      app.render();
    });

    if (boxCostUnitInput) boxCostUnitInput.addEventListener('change', e => {
      s.packaging.boxCostUnit = Math.max(0, parseFloat(e.target.value || 0));
      s.packaging.boxCostToday = s.packaging.boxPerDay * s.packaging.boxCostUnit;
      s.packaging.totalCost = s.packaging.boxCostToday + s.packaging.materialCost;
      app.render();
    });

    document.querySelectorAll('.inp-workers').forEach(inp => {
      inp.addEventListener('change', e => {
        const z = e.currentTarget.dataset.zone;
        const val = Math.max(0, parseInt(e.currentTarget.value || 0, 10));
        if (this._state.zones[z]) this._state.zones[z].workers = val;
        app.render();
      });
    });

    this._renderFeed();
  },

  // ================== INIT (démo) ==================
  createInitialState(targetDay) {
    const startNight = new Date(targetDay + 'T19:00:00');
    startNight.setDate(startNight.getDate() - 1);

    const state = {
      targetDay,
      clock: new Date(startNight),

      zones: {},                 // { Z#: { picksNight, picksDay, workers, left } }
      inProgress: 0, picksNight: 0, picksDay: 0,
      ratePH: 0, rateEMA: 0, etaText: '-', progressPct: 0,

      // RH & flux (un peu de vie)
      absents: 0, malades: 0, vacances: 0, recups: 0,
      retards: 0, noBadge: 0, pauseOverruns: 0,
      absentsList: [], retardsList: [], noBadgeList: [], pausesList: [], cmList: [],

      pickEvents: [],
      eventLog: [],

      // packaging dynamique
      packaging: {
        items: Object.keys(PACK_CONSUMPTION).reduce((a,k)=> (a[k]=0, a), {}),
        materialCost: 0,
        boxPerDay:   DEFAULT_BOX_PER_DAY,
        boxCostUnit: DEFAULT_BOX_COST,
        boxCostToday: DEFAULT_BOX_PER_DAY * DEFAULT_BOX_COST,
        totalCost:    DEFAULT_BOX_PER_DAY * DEFAULT_BOX_COST,
        dayGrowth: 0
      },

      rackStock: {},
      ruptureAlerts: 0
    };

    // Répartition fixe qui fait bouger toutes les zones
    const zones = Object.keys(app.state.allData.zones || { Z1:'Zone 1' });
    const demoShares = { Z1:0.25, Z2:0.15, Z3:0.10, Z4:0.10, Z5:0.10, Z6:0.10, Z7:0.05, Z8:0.10, Z9:0.05 };
    zones.forEach(z => state.zones[z] = { picksNight:0, picksDay:0, workers: irnd(5,7), left: 0 });
    zones.forEach(z => {
      const share = demoShares[z] ?? (1/zones.length);
      state.zones[z].left = Math.max(0, Math.round(TARGET_PICKS * share));
    });
    state.inProgress = zones.reduce((a,z)=> a + state.zones[z].left, 0);

    this.seedHR(state);
    return state;
  },

  seedHR(state) {
    const collabs = (planning.allData?.collaborateurs || []).filter(Boolean);
    const nVac = irnd(2,5);
    const nRec = irnd(1,3);
    const nMal = irnd(1,3);

    const vac = pickN(collabs, nVac);
    const rec = pickN(collabs.filter(c=>!vac.includes(c)), nRec);
    const mal = pickN(collabs.filter(c=>!vac.includes(c) && !rec.includes(c)), nMal);

    state.vacances = vac.length;
    state.recups   = rec.length;
    state.malades  = mal.length;
    state.absents  = vac.length + rec.length + mal.length;

    state.absentsList = [
      ...vac.map(c => ({ type:'Vacances', name:`${c.prenom} ${c.nom}`, zone:c.zone })),
      ...rec.map(c => ({ type:'Récup',    name:`${c.prenom} ${c.nom}`, zone:c.zone })),
      ...mal.map(c => ({ type:'Maladie',  name:`${c.prenom} ${c.nom}`, zone:c.zone }))
    ];

    state.eventLog.unshift({ t:new Date(state.clock), kind:'RH', msg:`Absents: ${state.absents} (V:${state.vacances} R:${state.recups} M:${state.malades})` });
  },

  // ================== MOTEUR ==================
  toggle() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; app.render(); return; }
    this._timer = setInterval(()=>this.tick(), 1000);
    app.render();
  },

  reset() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._state = this.createInitialState(this._state.targetDay);
    app.render();
  },

  tick() {
    const s = this._state;

    // avance horloge
    s.clock = new Date(s.clock.getTime() + this._speed*1000);
    const hh = s.clock.getHours(), mm = s.clock.getMinutes();
    const hhmm = hh*100 + mm;
    const isNight = (hh >= 19 || hh < 5);

    // ---- événements RH / flux pour l’animation ----
    if (hhmm === 500) {
      const collabs = (planning.allData?.collaborateurs || []).filter(Boolean);
      const n = irnd(1,5);
      const late = pickN(collabs, n);
      s.retards += late.length;
      late.forEach(c => s.retardsList.push(`${c.prenom} ${c.nom} (${c.zone||'-'})`));
      if (late.length) s.eventLog.unshift({ t:new Date(s.clock), kind:'Retard', msg:`${late.length} retard(s)` });
    }
    if (hhmm === 530) {
      const collabs = (planning.allData?.collaborateurs || []).filter(Boolean);
      const n = irnd(0,3);
      const nb = pickN(collabs, n);
      s.noBadge += nb.length;
      nb.forEach(c => s.noBadgeList.push(`${c.prenom} ${c.nom} (${c.zone||'-'})`));
      if (nb.length) s.eventLog.unshift({ t:new Date(s.clock), kind:'NoBadge', msg:`${nb.length} non badgé(s)` });
    }
    if (mm === 0 && (hh % 2 === 0)) {
      const n = irnd(0,3);
      s.pauseOverruns += n;
      if (n) s.eventLog.unshift({ t:new Date(s.clock), kind:'Pause', msg:`${n} pause(s) dépassée(s)` });
    }
    if (hh === 9 && mm === 15 && !s._cmEmitted) {
      s._cmEmitted = true;
      const start = new Date(s.clock); start.setDate(start.getDate() - irnd(1,3));
      const end   = new Date(start);   end.setDate(start.getDate() + irnd(2,5));
      s.cmList.push({ name:`Collab#${irnd(100,999)}`, start, end });
      s.eventLog.unshift({ t:new Date(s.clock), kind:'CM', msg:`CM reçu: ${start.toLocaleDateString('fr-CH')} → ${end.toLocaleDateString('fr-CH')} (planning à vérifier)` });
    }

    // ---- capacité “humaine” → picks potentiels (démo) ----
    const globalWorkers = Math.max(0,
      Object.values(s.zones).reduce((a,z)=>a+z.workers,0) - s.absents - s.retards - s.noBadge
    );
    const workerRate = isNight ? rnd(24, 30) : rnd(26, 32); // picks/h/worker
    const baseRate = globalWorkers * workerRate;
    const dtHours = this._speed / 3600;
    let picksThisTick = Math.min(s.inProgress, Math.round(baseRate * dtHours));

    // borne par plan de production cumulée
    const plannedCum = cumulativeTargetAt(s.clock);
    const alreadyDone = s.picksNight + s.picksDay;
    const maxAllowedNow = Math.max(0, plannedCum - alreadyDone);
    picksThisTick = Math.min(picksThisTick, Math.max(0, maxAllowedNow));

    if (picksThisTick > 0) {
      // répartition proportionnelle au reste par zone
      const zones = Object.keys(s.zones);
      const totalLeft = zones.reduce((a,z)=> a + s.zones[z].left, 0) || 1;
      const shuffled = zones.slice().sort(()=>Math.random()-0.5);

      for (const z of shuffled) {
        if (!picksThisTick) break;
        const share = Math.round((s.zones[z].left / totalLeft) * picksThisTick);
        const give = Math.min(s.zones[z].left, Math.max(share, 0));
        if (give <= 0) continue;

        s.zones[z].left -= give;
        s.inProgress -= give;
        if (isNight){ s.zones[z].picksNight += give; s.picksNight += give; }
        else        { s.zones[z].picksDay   += give; s.picksDay   += give; }

        this._afterPicks(z, give);
      }

      const totalTarget = TARGET_PICKS;
      const doneNow = s.picksNight + s.picksDay;
      s.progressPct = (doneNow / (totalTarget || 1)) * 100;
    }

    // KPI instant: débit mesuré pour l'affichage
    s.ratePH = kpi.avgRate(s.pickEvents, 60);

    // ETA stable basé sur un débit moyen fixe (démo)
    const eta = kpi.etaFinish(s.clock, s.inProgress, this._AVG_RATE_FOR_ETA);
    s.etaText = eta ? this._fmtDate(eta) : '-';

    // packaging: mise à jour des coûts
    s.packaging.boxCostToday = s.packaging.boxPerDay * s.packaging.boxCostUnit;
    s.packaging.totalCost    = s.packaging.boxCostToday + s.packaging.materialCost;
    s.packaging.dayGrowth    = ((s.packaging.totalCost - s.packaging.boxCostToday) / (s.packaging.boxCostToday || 1)) * 100;

    // fin de journée
    if (s.inProgress <= 0) {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
      s.eventLog.unshift({ t:new Date(s.clock), kind:'Fin', msg:`Journée terminée à ${this._fmtTime(s.clock)}` });
    }

    this._renderFeed();
    app.render();
  },

  _afterPicks(zone, qty) {
    const s = this._state;
    s.pickEvents.push({ t:new Date(s.clock), zone });

    // packaging: consommation stochastique
    let matCost = 0;
    for (const [k, cfg] of Object.entries(PACK_CONSUMPTION)) {
      let used = 0;
      for (let i=0;i<qty;i++) if (p(cfg.prob)) used++;
      s.packaging.items[k] += used;
      matCost += used * cfg.cost;
    }
    s.packaging.materialCost += matCost;
    s.packaging.totalCost = s.packaging.boxPerDay * s.packaging.boxCostUnit + s.packaging.materialCost;
    s.packaging.dayGrowth = ((s.packaging.totalCost - s.packaging.boxPerDay * s.packaging.boxCostUnit) / (s.packaging.boxPerDay * s.packaging.boxCostUnit || 1)) * 100;

    // rupture fictive rare
    if (p(0.0005)) {
      s.ruptureAlerts++;
      s.eventLog.unshift({ t:new Date(s.clock), kind:'Rupture', msg:`Rupture probable sur une allée (zone ${zone})` });
    }
  },

  // ================== UI HELPERS ==================
  kpiCard(label, value) {
    return `<div class="card" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px">
      <div style="font-size:12px;color:#6b7280">${label}</div>
      <div style="font-size:20px;font-weight:600">${value}</div>
    </div>`;
  },

  kpiEditable(label, value, key) {
    const id = `inp-${key}`;
    return `<div class="card" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px">
      <div style="font-size:12px;color:#6b7280">${label}</div>
      <input id="${id}" type="number" step="${key==='boxCostUnit' ? '0.1' : '1'}"
             value="${Number(value)}"
             style="width:100%;margin-top:6px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px">
    </div>`;
  },

  renderZonesTable() {
    const s = this._state;
    const rows = Object.keys(s.zones).map(z=>{
      const r = s.zones[z];
      return `<tr>
        <td>${z}</td>
        <td><input class="inp-workers" data-zone="${z}" type="number" min="0" value="${r.workers}" style="width:70px"></td>
        <td>${r.picksNight}</td>
        <td>${r.picksDay}</td>
        <td>${r.left}</td>
      </tr>`;
    }).join('');
    return `<div class="card" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px">
      <h4>Par zone</h4>
      <table class="requests-table">
        <thead><tr>
          <th>Zone</th><th>Effectif théorique</th><th>Picks nuit</th><th>Picks jour</th><th>Reste à faire</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  },

  showEvents() {
    const s = this._state;
    const log = s.eventLog.map(e => `<li>[${this._fmtTime(e.t)}] <b>${e.kind}</b> — ${e.msg}</li>`).join('') || '<li>Aucun</li>';
    const abs = s.absentsList.map(a => `<li>${a.type} — ${a.name} (${a.zone||'-'})</li>`).join('') || '<li>Aucun</li>';
    const rtd = s.retardsList.map(n => `<li>${n}</li>`).join('') || '<li>Aucun</li>';
    const nbg = s.noBadgeList.map(n => `<li>${n}</li>`).join('') || '<li>Aucun</li>';
    const pzz = s.pausesList.map(n => `<li>${n}</li>`).join('') || '<li>—</li>';
    const cms = s.cmList.map(c => `<li>${c.name} — ${c.start.toLocaleDateString('fr-CH')} → ${c.end.toLocaleDateString('fr-CH')}</li>`).join('') || '<li>—</li>';

    const html = `
      <div style="max-height:70vh;overflow:auto">
        <h3>Flux d'information</h3>
        <h4>Absences</h4><ul>${abs}</ul>
        <h4>Retards</h4><ul>${rtd}</ul>
        <h4>No-badge</h4><ul>${nbg}</ul>
        <h4>Pauses dépassées</h4><ul>${pzz}</ul>
        <h4>CM reçus</h4><ul>${cms}</ul>
        <h4>Journal</h4><ul>${log}</ul>
      </div>`;
    ui.showModal(html);
  },

  _renderFeed() {
    const ul = document.getElementById('feed-list');
    if (!ul) return;
    const s = this._state;
    const items = (s.eventLog || []).slice(0,20).map(e =>
      `<li><span style="color:#6b7280">${this._fmtTime(e.t)}</span> <b>${e.kind}:</b> ${e.msg}</li>`
    ).join('');
    ul.innerHTML = items || '<li style="color:#9ca3af">Aucun événement</li>';
  },

  _fmtTime(d){ return d ? d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '-'; },
  _fmtDate(d){ return d ? d.toLocaleString('fr-FR',   {hour:'2-digit', minute:'2-digit'}) : '-'; },
  _defaultSimDay() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0,10); },

  // ================== EXPORTS & RAPPORT ==================
  _download(filename, content, mime="text/plain") {
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  },

  _csvEscape(v){ if(v==null) return ''; const s=String(v).replace(/"/g,'""'); return /[",;\n]/.test(s) ? `"${s}"` : s; },

  _toCSV(rows){
    if(!rows?.length) return '';
    const headers = Object.keys(rows[0]);
    const head = headers.map(h=>this._csvEscape(h)).join(';');
    const body = rows.map(r=> headers.map(h=>this._csvEscape(r[h])).join(';')).join('\n');
    return head+'\n'+body;
  },

  _buildRateSeries(s, bucketMinutes=5){
    const buckets = {};
    s.pickEvents.forEach(e=>{
      const t = new Date(e.t);
      t.setSeconds(0,0);
      const key = new Date(Math.floor(t.getTime()/(bucketMinutes*60000))*(bucketMinutes*60000)).toISOString();
      buckets[key] = (buckets[key]||0)+1;
    });
    const rows = Object.keys(buckets).sort().map(k=>{
      const picks = buckets[k];
      const ratePH = picks * (60 / bucketMinutes);
      return { timestamp:k, picks, rate_per_hour: Math.round(ratePH) };
    });
    return rows;
  },

  _buildAbsencesRows(s){
    return (s.absentsList||[]).map(a=>({
      type: a.type, nom: a.name, zone: a.zone||'-'
    }));
  },
  _buildRetardsRows(s){
    return (s.retardsList||[]).map(n=>{
      const m = /^(.*) \((.*)\)$/.exec(n) || [];
      return { nom: m[1]||n, zone: m[2]||'-' };
    });
  },
  _buildNoBadgeRows(s){
    return (s.noBadgeList||[]).map(n=>{
      const m = /^(.*) \((.*)\)$/.exec(n) || [];
      return { nom: m[1]||n, zone: m[2]||'-' };
    });
  },
  _buildJournalRows(s){
    return (s.eventLog||[]).slice().reverse().map(e=>({
      time: e.t.toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
      kind: e.kind, message: e.msg
    }));
  },

  showExportMenu(){
    const html = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <h3>Exports CSV</h3>
        <button id="exp-retards" class="btn">Retards.csv</button>
        <button id="exp-absences" class="btn">Absences.csv</button>
        <button id="exp-nobadge" class="btn">NoBadge.csv</button>
        <button id="exp-journal" class="btn">Journal.csv</button>
        <button id="exp-rate" class="btn">PickRateSeries.csv</button>
      </div>`;
    ui.showModal(html);

    const s = this._state;
    document.getElementById('exp-retards')?.addEventListener('click', ()=>{
      const csv = this._toCSV(this._buildRetardsRows(s)); this._download(`retards_${s.targetDay}.csv`, csv, "text/csv");
    });
    document.getElementById('exp-absences')?.addEventListener('click', ()=>{
      const csv = this._toCSV(this._buildAbsencesRows(s)); this._download(`absences_${s.targetDay}.csv`, csv, "text/csv");
    });
    document.getElementById('exp-nobadge')?.addEventListener('click', ()=>{
      const csv = this._toCSV(this._buildNoBadgeRows(s)); this._download(`nobadge_${s.targetDay}.csv`, csv, "text/csv");
    });
    document.getElementById('exp-journal')?.addEventListener('click', ()=>{
      const csv = this._toCSV(this._buildJournalRows(s)); this._download(`journal_${s.targetDay}.csv`, csv, "text/csv");
    });
    document.getElementById('exp-rate')?.addEventListener('click', ()=>{
      const csv = this._toCSV(this._buildRateSeries(s,5)); this._download(`pick_rate_${s.targetDay}.csv`, csv, "text/csv");
    });
  },

  _buildDailyReportText(s){
    const done = s.picksNight + s.picksDay;
    const total = TARGET_PICKS;
    const pct = ((done/(total||1))*100).toFixed(1);
    const eta = s.etaText || '-';

    const byZone = Object.keys(s.zones).map(z=>{
      const r = s.zones[z];
      return `${z}  workers:${r.workers}  picksN:${r.picksNight}  picksJ:${r.picksDay}  left:${r.left}`;
    }).join('\n');

    const abs = (s.absentsList||[]).map(a=>`- ${a.type} — ${a.name} (${a.zone||'-'})`).join('\n') || '-';
    const rtd = (s.retardsList||[]).map(n=>`- ${n}`).join('\n') || '-';
    const nbg = (s.noBadgeList||[]).map(n=>`- ${n}`).join('\n') || '-';

    const material = Object.entries(s.packaging.items||{}).map(([k,v])=>`- ${k}: ${v}`).join('\n') || '-';

    return [
      `Compte rendu — ${s.targetDay}`,
      `Heure simulée: ${this._fmtTime(s.clock)}    ETA fin: ${eta}`,
      ``,
      `Production`,
      `- Terminées: ${done} / ${total} (${pct}%)`,
      `- Picks/h (mesuré): ${s.ratePH.toFixed(0)}`,
      ``,
      `Ressources par zone`,
      byZone,
      ``,
      `RH`,
      `- Absents: ${s.absents}  (détail:)`,
      abs,
      `- Retards: ${s.retards}`,
      rtd,
      `- No badge: ${s.noBadge}`,
      nbg,
      ``,
      `Packaging`,
      `- Box/jour: ${s.packaging.boxPerDay}  Coût/box: ${s.packaging.boxCostUnit} CHF`,
      `- Coût matériaux: ${s.packaging.materialCost.toFixed(0)} CHF`,
      `- Total packaging: ${s.packaging.totalCost.toFixed(0)} CHF`,
      `- Évolution jour: ${s.packaging.dayGrowth.toFixed(1)} %`,
      `- Détail conso:`,
      material
    ].join('\n');
  },

  showDailyReport(){
    const s = this._state;
    const txt = this._buildDailyReportText(s);
    const html = `
      <div>
        <h3>Rapport du jour</h3>
        <textarea id="report-text" style="width:100%;height:300px">${txt.replace(/</g,'&lt;')}</textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="btn-copy-report">Copier</button>
          <button id="btn-dl-report">Télécharger .txt</button>
        </div>
      </div>`;
    ui.showModal(html);

    document.getElementById('btn-copy-report')?.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(txt); ui.showToastNotification("Rapport copié.", "success"); }
      catch { ui.showToastNotification("Impossible de copier.", "error"); }
    });
    document.getElementById('btn-dl-report')?.addEventListener('click', ()=>{
      this._download(`rapport_${s.targetDay}.txt`, txt, "text/plain");
    });
  }
};
