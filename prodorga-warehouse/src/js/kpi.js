// src/js/kpi.js
window.kpi = {
  // ETA = now + remaining / rate
  etaFinish(nowSim, remainingPicks, ratePerHour) {
    if (!ratePerHour || ratePerHour <= 0) return null;
    const hours = remainingPicks / ratePerHour;
    return new Date(nowSim.getTime() + hours * 3600 * 1000);
  },

  // moyenne glissante de picks/h sur "windowMinutes"
  avgRate(pickEvents, windowMinutes = 60) {
    if (!pickEvents || pickEvents.length === 0) return 0;
    const now = pickEvents[pickEvents.length - 1].t;
    const from = new Date(now.getTime() - windowMinutes * 60000);
    const done = pickEvents.filter(e => e.t >= from && e.t <= now).length;
    return done * (60 / windowMinutes); // -> picks/h
  },

  groupByZone(picks) {
    const map = {};
    for (const p of picks) map[p.zone] = (map[p.zone] || 0) + 1;
    return map;
  }
};
