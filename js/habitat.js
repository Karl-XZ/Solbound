/* The living quarters are vector artwork: every hotspot is the actual drawn object. */
window.Habitat = (() => {
  const $ = s => document.querySelector(s);
  let anchor, toastTimer, handlers;
  /* The living quarters are a real-time 3D scene (js/cabin3d.js). Each interactive object has an
     accessible DOM hotspot that follows it on screen; clicking the 3D model clicks the same hotspot. */
  const OBJECTS = [
    ['calendar', 'Wall calendar: see how many sols you have survived and open Today’s Log', 'Wall calendar · Check today’s date', 'Mission Calendar'],
    ['bench', 'Lab bench: analyze rock samples you brought back', 'Lab bench · Analyze rock samples', 'Lab Bench · No samples yet'],
    ['door', 'Airlock: check your gear and go outside', 'Airlock · Check if it is safe to go out', 'Airlock · Explore'],
    ['radio', 'Radio: listen to messages and read the log', 'Radio · Hear from Earth', 'Earth Radio'],
    ['medicine', 'First aid kit: check and use medicine', 'First aid kit · Check medicine', 'First Aid'],
    ['purifier', 'Water recycler: use battery power to clean drinking water', 'Water recycler · Clean used water', 'Water Recycler'],
    ['water', 'Water tank: check your water and take a drink', 'Water tank · Give the astronaut a drink', 'Drinking Water'],
    ['food', 'Food locker: check food and have a snack', 'Food locker · Check food', 'Food Locker'],
    ['console', 'Console: check power and share it out', 'Console · Share power between machines', 'Console · Plan the Day'],
    ['bed', 'Bed: check tonight’s gains and losses and end the day', 'Rest · See tonight’s gains and losses', 'End the Day'],
    ['crew', 'Astronaut: check mood and chat', 'Astronaut · Check on Ari', 'Astronaut · Ari']
  ];
  const artwork = `<div class="room-scroll" aria-label="Mars habitat. Swipe left or right to find objects."><div id="cabinDrawing" class="cabin3d" role="group" aria-label="Retro sci-fi 3D Mars base: food locker, water tank, water recycler, first aid kit, radio, wall calendar and astronaut"><div class="cabin-tags">${
    OBJECTS.map(([key, aria, title, caption]) => `<div class="habitat-object" data-object="${key}"${key === 'crew' ? ' id="cabinCrew" data-mood="happy"' : ''} role="button" tabindex="0" aria-label="${aria}" title="${title}"><span class="object-caption"${key === 'bench' ? ' id="sampleCount"' : ''}>${caption}</span></div>`).join('')
  }</div><div id="crewSpeech" aria-hidden="true"><span id="crewSpeechText">I’m ready to work.</span></div></div></div><div class="room-night" aria-hidden="true"></div>`;
  function closeCard(restoreFocus = false) {
    $('#itemPopover').hidden = true;
    if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
    anchor = null;
  }
  return {
    init(callbacks) {
      handlers = callbacks; $('#habitatScene').innerHTML = artwork;
      const tags = {}; document.querySelectorAll('#cabinDrawing [data-object]').forEach(el => tags[el.dataset.object] = el);
      Cabin3D.mount($('#cabinDrawing'), tags);
      document.querySelectorAll('[data-object], #survivalHUD [data-item]').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); handlers.inspect(el.dataset.object || el.dataset.item, el); });
        if (el.matches('[data-object]')) el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
      });
      $('#viewInterior').onclick = () => handlers.view('interior'); $('#viewExterior').onclick = () => handlers.view('exterior');
      $('#viewOverview').onclick = () => handlers.view('overview');
      document.addEventListener('pointerdown', e => { if (!$('#itemPopover').hidden && !e.target.closest('#itemPopover, [data-object], #survivalHUD')) closeCard(); });
      addEventListener('resize', () => closeCard());
    },
    view(mode) {
      const interior = mode === 'interior', overview = mode === 'overview'; $('#habitatScene').hidden = !interior;
      $('#frame').classList.toggle('interior-view', interior);
      $('#frame').classList.toggle('overview-view', overview);
      $('#frame').classList.toggle('console-open', overview); $('#baseConsole').hidden = !overview;
      $('#viewInterior').setAttribute('aria-pressed', String(interior)); $('#viewExterior').setAttribute('aria-pressed', String(!interior && !overview));
      $('#viewOverview').setAttribute('aria-pressed', String(overview)); $('#viewOverview').hidden = !interior && !overview;
      $('#viewInterior').textContent = interior || overview ? 'Habitat' : 'Back to Airlock'; $('#viewExterior').textContent = interior || overview ? 'Go Outside' : 'Task Location';
      $('#roomHint').textContent = interior ? (innerWidth < 700 ? 'Swipe to find objects · Tap the airlock to go out · Tap the bed to end the day' : 'Click objects to use them · Click the airlock to go out · Click the bed to end the day') : 'WASD to move · Drag to look around · Press E near a target';
      World.setRendering(!interior); Cabin3D.setActive(interior); closeCard();
    },
    render(g) {
      Cabin3D.update(g);
      $('#cabinFood').textContent = Math.round(g.food); $('#cabinWater').textContent = Math.round(g.water); $('#cabinMeds').textContent = g.meds; $('#cabinMorale').textContent = Math.round(g.morale);
      $('#cabinDay').innerHTML = `${String(g.sol).padStart(2, '0')}<small> / 30</small>`;
      const mood = g.morale < 30 || g.food < 10 || g.water < 10 ? 'weak' : g.morale < 60 || g.food < 20 || g.water < 20 ? 'sad' : 'happy';
      $('#cabinCrew').dataset.mood = mood; Cabin3D.setMood(mood);
      $('#crewSpeechText').textContent = { happy: 'I’m ready to work.', sad: 'I miss home a little.', weak: 'I need to rest.' }[mood];
      $('#cabinGreeting').textContent = g.storm > 0 ? 'A dust storm is cutting your power. Check the power.' : mood === 'weak' ? 'The astronaut is not doing well. Check food and water.' : 'Check your supplies and power.';
      for (const [id, value, limit] of [['food',g.food,20],['water',g.water,20],['medicine',g.meds,1],['crew',g.morale,30]]) {
        document.querySelector(`#survivalHUD [data-item="${id}"]`).classList.toggle('low', value < limit);
        Cabin3D.setLow(id, value < limit);
      }
    },
    samples(samples) {
      const pending=samples.filter(s=>s.status==='stored').length, analysed=samples.filter(s=>s.status==='analysed').length;
      Cabin3D.setSamples(pending + analysed);
      $('#sampleCount').textContent = pending ? `Lab Bench · ${pending} to analyze` : analysed ? `Analyzed ${analysed} rock samples` : 'Lab Bench · No samples yet';
    },
    card({ title, value, description, actions = [], anchor: target }) {
      anchor = target;
      const panel = $('#itemPopover'); panel.innerHTML = `<button class="item-close" aria-label="Close item card">×</button><span class="item-eyebrow">Item Actions</span><div class="item-heading"><h2 id="itemTitle">${title}</h2><b>${value}</b></div><p>${description}</p><div class="item-actions">${actions.map((a,i)=>`<button data-action="${i}" ${a.disabled ? 'disabled' : ''}><span>${a.label}</span>${a.hint ? `<small>${a.hint}</small>` : ''}</button>`).join('')}</div>`;
      panel.hidden = false; panel.querySelector('.item-close').onclick = () => closeCard(true);
      panel.querySelectorAll('[data-action]').forEach(b => b.onclick = () => actions[Number(b.dataset.action)].run());
      const r = target.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
      let left = r.right + 14; if (left + bounds.width > innerWidth - 16) left = r.left - bounds.width - 14;
      panel.style.left = Math.max(12, Math.min(innerWidth - bounds.width - 12, left)) + 'px';
      panel.style.top = Math.max(12, Math.min(innerHeight - bounds.height - 12, r.top - 20)) + 'px';
      panel.querySelector('.item-close').focus({ preventScroll: true });
    },
    closeCard,
    toast(message) {
      const t = $('#cabinToast'); clearTimeout(toastTimer); t.textContent = message; t.classList.add('visible'); toastTimer = setTimeout(() => t.classList.remove('visible'), 3200);
    }
  };
})();
