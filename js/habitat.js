/* Living quarters use a 3D scene with accessible DOM hotspots. */
window.Habitat = (() => {
  const $ = s => document.querySelector(s);
  let anchor, toastTimer, handlers;
  /* The living quarters are a real-time 3D scene (js/cabin3d.js). Each interactive object has an
     accessible DOM hotspot that follows it on screen; clicking the 3D model clicks the same hotspot. */
  const OBJECTS = [
    ['calendar', '墙历：查看存活天数和今日手册', '墙历 · 查看当前日期', '任务日历'],
    ['bench', '实验台：分析带回的岩样', '实验台 · 分析岩样', '实验台 · 暂无岩样'],
    ['door', '舱门：检查装备并出舱', '舱门 · 检查出舱条件', '舱门 · 去探索'],
    ['radio', '通讯器：收听随机讯息和查看日志', '通讯器 · 收听地球消息', '地球通讯器'],
    ['medicine', '急救箱：查看和使用药品', '急救箱 · 查看药品', '急救药品'],
    ['purifier', '净水机：消耗电池净化饮用水', '净水机 · 净化回收水', '循环净水机'],
    ['water', '饮水桶：查看水资源与饮水休息', '饮水桶 · 给宇航员喝水', '饮用水'],
    ['food', '食物箱：查看食物与加餐', '食物箱 · 查看食物', '食物补给箱'],
    ['console', '控制台：查看发电和分配电力', '控制台 · 分配设备电量', '控制台 · 安排工作'],
    ['bed', '床：确认收支并结束一天', '休息 · 看看今晚的收支', '结束今天'],
    ['crew', '宇航员：查看心情与聊天', '宇航员 · 查看阿星的状态', '宇航员 · 阿星']
  ];
  const artwork = `<div class="room-scroll" aria-label="火星生活舱。左右滑动可查找物品。"><div id="cabinDrawing" class="cabin3d" role="group" aria-label="美式复古科幻 3D 火星基地：食物箱、水桶、净水机、急救箱、通讯器、墙历与宇航员"><div class="cabin-tags">${
    OBJECTS.map(([key, aria, title, caption]) => `<div class="habitat-object" data-object="${key}"${key === 'crew' ? ' id="cabinCrew" data-mood="happy"' : ''} role="button" tabindex="0" aria-label="${aria}" title="${title}"><span class="object-caption"${key === 'bench' ? ' id="sampleCount"' : ''}>${caption}</span></div>`).join('')
  }</div><div id="crewSpeech" aria-hidden="true"><span id="crewSpeechText">我可以开始工作。</span></div></div></div><div class="room-night" aria-hidden="true"></div>`;
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
      $('#viewInterior').textContent = interior || overview ? '基地生活' : '回舱指引'; $('#viewExterior').textContent = interior || overview ? '出舱探索' : '任务位置';
      $('#roomHint').textContent = interior ? (innerWidth < 700 ? '左右滑动查找物品 · 点击舱门出舱 · 点击床结束当天' : '点击物品操作 · 点击舱门出舱 · 点击床结束当天') : 'WASD 移动 · 拖动画面转头 · 靠近目标按 E';
      World.setRendering(!interior); Cabin3D.setActive(interior); closeCard();
    },
    render(g) {
      Cabin3D.update(g);
      $('#cabinFood').textContent = Math.round(g.food); $('#cabinWater').textContent = Math.round(g.water); $('#cabinMeds').textContent = g.meds; $('#cabinMorale').textContent = Math.round(g.morale);
      $('#cabinDay').innerHTML = `${String(g.sol).padStart(2, '0')}<small> / 30</small>`;
      const mood = g.morale < 30 || g.food < 10 || g.water < 10 ? 'weak' : g.morale < 60 || g.food < 20 || g.water < 20 ? 'sad' : 'happy';
      $('#cabinCrew').dataset.mood = mood; Cabin3D.setMood(mood);
      $('#crewSpeechText').textContent = { happy: '我可以开始工作。', sad: '我有点想家。', weak: '我需要休息。' }[mood];
      $('#cabinGreeting').textContent = g.storm > 0 ? '沙尘暴正在影响发电。请检查电力。' : mood === 'weak' ? '宇航员状态较差。请检查食物和饮水。' : '请检查物资和电力。';
      for (const [id, value, limit] of [['food',g.food,20],['water',g.water,20],['medicine',g.meds,1],['crew',g.morale,30]]) {
        document.querySelector(`#survivalHUD [data-item="${id}"]`).classList.toggle('low', value < limit);
        Cabin3D.setLow(id, value < limit);
      }
    },
    samples(samples) {
      const pending=samples.filter(s=>s.status==='stored').length, analysed=samples.filter(s=>s.status==='analysed').length;
      Cabin3D.setSamples(pending + analysed);
      $('#sampleCount').textContent = pending ? `实验台 · ${pending} 份待分析` : analysed ? `已分析 ${analysed} 份岩样` : '实验台 · 暂无岩样';
    },
    card({ title, value, description, actions = [], anchor: target }) {
      anchor = target;
      const panel = $('#itemPopover'); panel.innerHTML = `<button class="item-close" aria-label="关闭物品卡片">×</button><span class="item-eyebrow">物品操作</span><div class="item-heading"><h2 id="itemTitle">${title}</h2><b>${value}</b></div><p>${description}</p><div class="item-actions">${actions.map((a,i)=>`<button data-action="${i}" ${a.disabled ? 'disabled' : ''}><span>${a.label}</span>${a.hint ? `<small>${a.hint}</small>` : ''}</button>`).join('')}</div>`;
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
