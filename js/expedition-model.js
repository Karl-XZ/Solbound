/* Task completion is one-shot; closing an activity never completes it. */
(function (root) {
  const steps = ['console', 'depart', 'move', 'clean', 'repair', 'return', 'filter', 'drink', 'allocate', 'sleep'];
  function canAfford(g, cost = {}) {
    return g.o2 > (cost.o2 || 0) && g.dose + (cost.dose || 0) < 25 &&
      g.batt >= (cost.batt || 0) && (!cost.power || g.pool >= cost.power);
  }
  function departureCost(g, roll) {
    const leak = g.conjRisk > 0 && roll < .34;
    return { o2: 3 + (leak ? 6 : 0), dose: .25 + g.today.flareOut, leak };
  }
  function create() {
    return {
      tasks: [], samples: [], guide: { active: false, index: 0, seen: [] },
      add(task) {
        if (!this.tasks.some(t => t.id === task.id)) this.tasks.push({ phase: 'ready', cost: {}, ...task });
      },
      reconcile(g) {
        let changed = false;
        this.tasks.forEach(t => { if (t.phase !== 'done' && t.needed && !t.needed(g)) { t.phase = 'done';t.resolved = true;changed = true; } });
        return changed;
      },
      start(id) { const t = this.tasks.find(t => t.id === id); if (!t || t.phase === 'done') return false; t.phase = 'working'; return true; },
      cancel(id) { const t = this.tasks.find(t => t.id === id); if (t?.phase === 'working') t.phase = 'ready'; },
      finish(id) {
        const t = this.tasks.find(t => t.id === id); if (!t || t.phase !== 'working') return false;
        t.phase = 'done'; t.complete?.(); return true;
      },
      collect(id, reward) { if (!this.samples.some(s => s.id === id)) this.samples.push({ id, reward, status: 'carried' }); },
      returnSamples() { this.samples.forEach(s => { if (s.status === 'carried') s.status = 'stored'; }); },
      analyse(id) { const s = this.samples.find(s => s.id === id); if (s?.status !== 'stored') return 0; s.status = 'analysed'; return s.reward; },
      notify(action) {
        if (!this.guide.active) return;
        if (!this.guide.seen.includes(action)) this.guide.seen.push(action);
        while (this.guide.seen.includes(steps[this.guide.index])) this.guide.index++;
        if (this.guide.index === steps.length) this.guide.active = false;
      },
      skip() { this.guide.active = false; },
      get step() { return steps[this.guide.index]; }
    };
  }
  const api = { create, canAfford, departureCost, steps };
  if (typeof module !== 'undefined') module.exports = api; else root.ExpeditionModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
