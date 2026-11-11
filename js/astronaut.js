/* Engine-independent movement, with short collision steps to prevent tunnelling. */
(function (root) {
  function create() {
    const held = new Set();
    return {
      active: false, yaw: 0, pitch: .38, stick: { x: 0, y: 0 }, moving: false, facing: 0,
      key(code, down) { if (this.active && down) held.add(code); else held.delete(code); },
      clear() { held.clear(); this.stick.x = this.stick.y = 0; this.moving = false; },
      setActive(active) { if (this.active !== active || !active) this.clear(); this.active = active; },
      update(dt, p, blockers) {
        if (!this.active) { this.moving = false; return; }
        let x = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')) + this.stick.x;
        let y = Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown')) - this.stick.y;
        const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
        const dx = x * Math.cos(this.yaw) - y * Math.sin(this.yaw), dz = -x * Math.sin(this.yaw) - y * Math.cos(this.yaw);
        const n = Math.max(1, Math.ceil(Math.max(0, dt) * 7 / .25)), distance = Math.max(0, dt) * 7 / n;
        const valid = (px, pz) => Math.hypot(px, pz) < 65 && !blockers.some(b => b.r ? Math.hypot(px - b.x, pz - b.z) < b.r + .65 : px > b.minX - .65 && px < b.maxX + .65 && pz > b.minZ - .65 && pz < b.maxZ + .65);
        const beforeX = p.x, beforeZ = p.z;
        for (let i = 0; i < n; i++) {
          if (valid(p.x + dx * distance, p.z)) p.x += dx * distance;
          if (valid(p.x, p.z + dz * distance)) p.z += dz * distance;
        }
        this.moving = Math.hypot(p.x - beforeX, p.z - beforeZ) > .001;
        if (len > .05) this.facing = Math.atan2(dx, dz);
      }
    };
  }
  const api = { create };
  if (typeof module !== 'undefined') module.exports = api; else root.AstronautController = api;
})(typeof window !== 'undefined' ? window : globalThis);
