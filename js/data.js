/* =====================================================================
   真实数据层
   - 每一个出现在游戏里的数字，都在这里写明出处
   - real: 来自 NASA 任务/论文的真实测量或公开数据
   - game: 为了让游戏好玩而做的简化（在“数据来源”页里同样会标明）
   ===================================================================== */
window.DATA = (function () {

  /* ---------- 火星与任务的真实常数 ---------- */
  const facts = {
    solLength: '24 小时 39 分 35 秒',
    gravity: 0.38,                 // 地球的 38%
    sunlight: 0.43,                // 火星轨道上的阳光强度约为地球的 43%
    pressure: '不到地球的 1%',
    nightTemp: -80,                // 杰泽罗陨石坑夜间约 -80°C（毅力号 MEDA 气象站）
    radSurface: 0.67,              // mSv/火星日，好奇号 RAD 在盖尔陨石坑测得（Hassler 等，2014）
    radCruise: 1.84,               // mSv/天，好奇号飞往火星途中测得（Zeitlin 等，2013）
    earthBackground: 2.4,          // mSv/年，地球上的平均天然本底辐射
    careerLimit: 600,              // mSv，NASA 宇航员职业生涯剂量上限（NASA-STD-3001，2022）
    o2PerPerson: 0.84,             // kg/人/天，NASA 生命保障设计基准
    moxieTotal: 122,               // 克，毅力号 MOXIE 在 16 次运行中累计制造的氧气
    moxiePeak: 12,                 // 克/小时，MOXIE 的最高产氧速率
    moxiePurity: 98,               // %
    issWater: 98,                  // %，国际空间站 2023 年实现的水回收率
    opportunityPlanned: 90,        // 机遇号原计划工作的火星日
    opportunityActual: 5111,       // 机遇号最后一次联系时已工作的火星日
    boneLoss: '每月 1%–1.5%',       // 失重环境下宇航员骨密度流失速度
    jezero: { lat: 18.4, lon: 77.5, size: '约 45 公里宽' }
  };

  /* ---------- NASA DONKI 存档：真实的太阳风暴事件 ----------
     dose: 游戏里“如果这次事件正对火星，而你站在舱外”的剂量（mSv）
     doseKind: 'measured' 真实测量换算；'estimate' 游戏估算 */
  const flares = [
    { date: '2024-05-20', cls: 'X12', kind: '耀斑 + 日冕物质抛射',
      note: '这次爆发发生在太阳背面，正对着火星。好奇号 RAD 测到了着陆以来最强的辐射激增：8,100 微戈瑞，NASA 说这相当于 30 次胸部 X 光。',
      dose: 8.1, doseKind: 'measured', src: 'NASA DONKI；NASA/JPL 新闻稿（2024 年 6 月）' },
    { date: '2017-09-10', cls: 'X8.2', kind: '耀斑 + 太阳高能粒子事件',
      note: '火星表面的辐射水平升到平时的两倍以上；MAVEN 探测器看到火星上空出现了覆盖全球的极光。',
      dose: 4.0, doseKind: 'estimate', src: 'NASA DONKI；NASA MAVEN / Curiosity RAD 新闻稿（2017 年 9 月）' },
    { date: '2017-09-06', cls: 'X9.3', kind: '耀斑',
      note: '第 24 太阳活动周里最强的一次耀斑。四天后，同一片太阳黑子群又爆发了一次 X8.2 级耀斑。',
      dose: 3.0, doseKind: 'estimate', src: 'NASA DONKI' },
    { date: '2024-10-03', cls: 'X9.0', kind: '耀斑',
      note: '第 25 太阳活动周里最强的耀斑之一。太阳正处在约 11 年一次的活动高峰附近。',
      dose: 3.0, doseKind: 'estimate', src: 'NASA DONKI' },
    { date: '2021-10-28', cls: 'X1.0', kind: '耀斑 + 地面级增强事件（GLE73）',
      note: '级别不算最高，但喷出的高能粒子非常猛烈，连地球地面上的中子探测器都测到了。',
      dose: 2.5, doseKind: 'estimate', src: 'NASA DONKI' },
    { date: '2012-07-23', cls: '超快 CME', kind: '日冕物质抛射',
      note: '速度约 3,000 公里/秒，被 STEREO-A 探测器正面测到。科学家估算：如果它早一周爆发，就会正面撞上地球。',
      dose: 6.0, doseKind: 'estimate', src: 'NASA DONKI；Baker 等（2013），Space Weather' }
  ];

  /* ---------- 实时：NASA DONKI 最近 30 天的耀斑 ---------- */
  let live = { status: 'idle', flares: [], fetchedAt: null };
  const ymd = d => d.toISOString().slice(0, 10);
  function clsRank(c) { const m = { X: 4, M: 3, C: 2, B: 1, A: 0 }; return (m[c[0]] || 0) * 100 + parseFloat(c.slice(1) || 0); }
  async function fetchDonki() {
    if (live.status === 'ok' || live.status === 'loading') return live;
    live.status = 'loading';
    try {
      const cached = JSON.parse(localStorage.getItem('donki-cache') || 'null');
      if (cached && Date.now() - cached.t < 3600e3) { live = { status: 'ok', flares: cached.f, fetchedAt: new Date(cached.t) }; return live; }
    } catch (e) {}
    const end = new Date(), start = new Date(Date.now() - 30 * 864e5);
    const url = `https://api.nasa.gov/DONKI/FLR?startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=DEMO_KEY`;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const f = (Array.isArray(j) ? j : []).filter(x => x.classType).map(x => ({ cls: x.classType, peak: x.peakTime || x.beginTime, region: x.activeRegionNum }))
        .sort((a, b) => clsRank(b.cls) - clsRank(a.cls));
      live = { status: 'ok', flares: f, fetchedAt: new Date() };
      try { localStorage.setItem('donki-cache', JSON.stringify({ t: Date.now(), f })); } catch (e) {}
    } catch (e) { live = { status: 'fail', flares: [], fetchedAt: null }; }
    return live;
  }
  // 把实时数据里最强的一次耀斑变成一张游戏事件（只有 M5 以上才算数）
  function liveFlareEvent() {
    if (live.status !== 'ok' || !live.flares.length) return null;
    const f = live.flares[0]; const r = clsRank(f.cls);
    if (r < 305) return null;
    return { date: f.peak.slice(0, 10), cls: f.cls, kind: '耀斑（实时数据）', live: true,
      note: `这是 NASA DONKI 数据库里最近 30 天最强的一次耀斑，发生在 ${f.peak.slice(0, 10)}${f.region ? '，来自太阳黑子群 ' + f.region : ''}。游戏假设它正对着火星。`,
      dose: r >= 400 ? Math.min(6, 2 + (r - 400) / 3) : 1.5, doseKind: 'estimate', src: 'NASA DONKI 实时接口（api.nasa.gov）' };
  }

  /* ---------- 地球—火星距离：按 JPL 行星轨道根数计算 ----------
     Standish, “Keplerian Elements for Approximate Positions of the Major Planets”（JPL） */
  const EL = {
    earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    mars:  [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]
  };
  function helio(e, T) {
    const r = Math.PI / 180;
    const a = e[0] + e[6] * T, ec = e[1] + e[7] * T, I = (e[2] + e[8] * T) * r, L = e[3] + e[9] * T, wb = e[4] + e[10] * T, O = (e[5] + e[11] * T) * r;
    const w = wb * r - O; let M = ((L - wb) % 360) * r;
    let E = M + ec * Math.sin(M); for (let i = 0; i < 8; i++) E = E - (E - ec * Math.sin(E) - M) / (1 - ec * Math.cos(E));
    const xp = a * (Math.cos(E) - ec), yp = a * Math.sqrt(1 - ec * ec) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
    return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
            (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
            (sw * sI) * xp + (cw * sI) * yp];
  }
  function earthMars(date = new Date()) {
    const JD = date.getTime() / 864e5 + 2440587.5, T = (JD - 2451545) / 36525;
    const a = helio(EL.earth, T), b = helio(EL.mars, T);
    const au = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return { au, km: au * 149597870.7, minutes: au * 499.004784 / 60 };
  }

  /* ---------- 数据来源清单（显示在“数据来源”页） ---------- */
  const sources = [
    { tag: '实时 + 存档', title: 'NASA DONKI 太空天气数据库',
      body: '太阳耀斑、日冕物质抛射和高能粒子事件的记录。游戏里的太阳风暴全部取自真实日期的真实事件；打开网页时还会尝试读取最近 30 天的实时耀斑数据。',
      link: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' },
    { tag: '真实测量', title: '好奇号 RAD 辐射探测器',
      body: '火星表面每个火星日约 0.67 毫希（mSv）；飞往火星途中每天约 1.84 毫希。2024 年 5 月 20 日的太阳风暴中测到 8,100 微戈瑞。',
      link: 'https://science.nasa.gov/mission/msl-curiosity/science-instruments/' },
    { tag: '真实测量', title: '毅力号 MOXIE 制氧实验',
      body: '2021–2023 年间运行 16 次，共制造 122 克氧气，最高每小时 12 克、纯度 98%。一个人一天大约需要 0.84 千克氧气。',
      link: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
    { tag: '真实记录', title: '机遇号与 2018 年全球沙尘暴',
      body: '沙尘把阳光几乎完全挡住（光学厚度 τ 超过 10），靠太阳能的机遇号在 2018 年 6 月 10 日失去联系。它原计划工作 90 个火星日，最后工作了 5,111 个。',
      link: 'https://science.nasa.gov/mission/mer-opportunity/' },
    { tag: '真实记录', title: '尘卷风“清洁事件”',
      body: '勇气号和机遇号都多次被路过的尘卷风吹干净太阳能板，发电量明显回升。InSight 着陆器则在 2022 年因为板子积尘太厚而结束任务。',
      link: 'https://mars.nasa.gov/mer/' },
    { tag: '真实研究', title: 'NASA 开放科学数据库 OSDR / GeneLab · 双胞胎研究',
      body: '宇航员 Scott Kelly 在空间站住了近一年，与地球上的双胞胎兄弟对比（Garrett-Bakelman 等，2019，《Science》）。回到地球半年后，仍有约 7% 的基因表达变化没有恢复。失重环境下骨密度每月流失 1%–1.5%。',
      link: 'https://osdr.nasa.gov/' },
    { tag: '真实记录', title: 'Veggie 太空菜园 · 空间站生命保障',
      body: '2015 年 8 月，宇航员第一次吃到在空间站种出来的红叶生菜。2023 年，空间站的水回收率达到 98%。',
      link: 'https://www.nasa.gov/mission/station/' },
    { tag: '真实发现', title: '杰泽罗陨石坑与“夏耶瓦瀑布”岩石',
      body: '杰泽罗曾经是一片古老湖泊，毅力号在三角洲边缘发现了带有“豹纹斑点”的岩石。2025 年 9 月，NASA 宣布其样本含有潜在生物特征，仍需进一步确认。',
      link: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
    { tag: '实时计算', title: 'JPL 行星轨道根数',
      body: '“今天地球离火星多远、信号要走几分钟”是按今天的真实日期，用 JPL 公布的行星轨道根数算出来的。',
      link: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' },
    { tag: '真实测量', title: 'InSight 火星地震记录',
      body: 'InSight 着陆器在火星上记录到 1,300 多次火星地震，最大的一次发生在 2022 年 5 月 4 日，震级约 4.7。',
      link: 'https://science.nasa.gov/mission/insight/' },
    { tag: '真实研究', title: '就地资源利用与 3D 打印栖息地',
      body: 'NASA 研究用月球和火星的土壤直接打印建筑，并举办过“3D 打印栖息地挑战赛”。游戏里的“建设机会”就来自这个思路。',
      link: 'https://www.nasa.gov/directorates/stmd/prizes-challenges-crowdsourcing-program/centennial-challenges/3d-printed-habitat-challenge/' },
    { tag: '真实数据', title: 'Natural Earth 1:110m 海岸线',
      body: '开场里地球的大陆轮廓来自公开的 Natural Earth 地图数据。',
      link: 'https://www.naturalearthdata.com/' },
    { tag: '标准', title: 'NASA-STD-3001 宇航员健康标准',
      body: 'NASA 规定宇航员整个职业生涯的辐射剂量不超过 600 毫希。',
      link: 'https://www.nasa.gov/ochmo/' }
  ];

  const simplifications = [
    '生活舱中的饮水点数、药品数量、士气和照护效果是为资源取舍设计的游戏规则，不代表真实的饮水量、药物剂量或医疗建议。',
    '游戏把 30 个火星日的任务剂量上限设为 25 毫希，比 NASA 的职业上限 600 毫希严格得多，这样每一次辐射决定都会被你感受到。',
    '电力用“格”来计算：晴天约 12 格。火星阳光只有地球的 43%，所以太阳能板必须很大，而且怕灰尘。',
    '真实的辐射屏蔽主要靠“质量”（火星土、水墙），不是靠电。所以游戏里的“屏蔽施工”用电来驱动挖土机，把舱段一点点埋起来。',
    '银河宇宙射线能量极高，很难完全挡住；太阳风暴的粒子能量较低，容易挡住。所以屏蔽等级对太阳风暴的效果远好于对日常辐射。',
    '温室里的作物要 3 天才能“收获”，这是为了让你体会“今天的决定，明天才见效”。真实作物的生长周期要长得多。',
    '标记为“游戏估算”的太阳风暴剂量是根据事件强度估计的；只有 2024 年 5 月 20 日那一次是好奇号的真实测量值。'
  ];

  return { facts, flares, sources, simplifications, fetchDonki, liveFlareEvent, earthMars, get live() { return live; } };
})();
