/* video-attn — which keys a video token can see under full 3D / spatial / temporal / factorized / windowed attention, and how each scales with clip length */
A.defineDemo('video-attn', function (mount) {
  const { bd } = A.demo(mount, '一个 token 能看见谁：全 3D、分解与窗口注意力', '上：5 个潜帧 × 每帧 10×10 个 token 的玩具；点任意格子换查询。下：720p 视频每层的计算量随时长的变化');
  const F = 5, G = 10;
  let mode = 'fact', speed = 1.5, q = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'full', t: '全 3D' }, { v: 'sp', t: '只做空间' }, { v: 'tm', t: '只做时间' }, { v: 'fact', t: '分解：空间→时间（两层）' }, { v: 'win', t: '3D 窗口（±1）' }], mode, (v) => { mode = v; draw(); }, '注意力方式');
  A.slider(ctl, { label: '红球每个潜帧移动', min: 0, max: 2, step: 0.25, value: speed, fmt: (v) => v + ' 个 token', on: (v) => { speed = v; q = null; draw(); }, width: 170 });
  const cvG = A.el('canvas', { class: 'cv', style: { cursor: 'pointer' } }); bd.append(cvG);
  const say = A.el('p', { class: 'gs-say', style: { margin: '6px 0 10px' } }); bd.append(say);
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const durS = A.slider(ctl2, { label: '视频时长（720p、24 fps、4×8×8 压缩、2×2 patch）', min: 1, max: 60, step: 1, value: 5, fmt: (v) => v + ' 秒', on: () => draw(), width: 330 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cvC = A.el('canvas', { class: 'cv' }); bd.append(cvC);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  bd.append(A.el('p', { class: 'hint' }, '计算量按 Wan 14B 的宽度 d = 5120 估算：线性层（QKV、输出投影、MLP）每个 token 约 24d² 次运算，注意力每个 token 约 4nd 次（n 是能看到的 key 数）。全 3D 注意力在 n 超过 6d ≈ 3 万个 token 时就比所有线性层加起来还贵；分解与窗口注意力让每个 token 看的 key 数不再随视频变长而增长（或增长得慢得多）。'));
  const cols = A.series();
  const ball = (f) => [Math.round(0.5 + speed * f), Math.round(3 + 0.45 * speed * f)];
  let geo = null;
  const view = A.canvas(cvG, { aspect: 0.26 }, (ctx, W, H) => {
    const gap = 12, top = 18, cs = Math.min((W - gap * (F - 1)) / F / G, (H - top - 4) / G), fw = cs * G;
    const x0 = (W - (fw * F + gap * (F - 1))) / 2;
    geo = { gap, top, cs, fw, x0 };
    if (!q) { const [bx, by] = ball(F - 1); q = { f: F - 1, x: bx, y: by }; }
    const st = state();
    for (let f = 0; f < F; f++) {
      const fx = x0 + f * (fw + gap);
      A.text(ctx, '潜帧 ' + (f + 1), fx + fw / 2, 8, { size: 11.5, align: 'center', color: A.css('--muted') });
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const k = st.get(f, x, y);
        ctx.fillStyle = k === 2 ? A.alpha(cols[0], 0.75) : k === 1 ? A.alpha(cols[0], 0.22) : A.css('--page');
        ctx.fillRect(fx + x * cs + 0.5, top + y * cs + 0.5, cs - 1, cs - 1);
        ctx.strokeStyle = A.css('--grid'); ctx.lineWidth = 1; ctx.strokeRect(fx + x * cs + 0.5, top + y * cs + 0.5, cs - 1, cs - 1);
      }
      const [bx, by] = ball(f);
      ctx.fillStyle = cols[7]; ctx.beginPath(); ctx.arc(fx + (bx + 0.5) * cs, top + (by + 0.5) * cs, cs * 0.32, 0, 7); ctx.fill();
    }
    const qx = x0 + q.f * (fw + gap) + q.x * cs, qy = top + q.y * cs;
    ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 2.5; ctx.strokeRect(qx + 1, qy + 1, cs - 2, cs - 2);
  });
  function state() {
    // 2 = attended directly in this layer; 1 = reachable only through an intermediate token (two hops)
    const get = (f, x, y) => {
      const same = f === q.f, col = x === q.x && y === q.y;
      if (mode === 'full') return 2;
      if (mode === 'sp') return same ? 2 : 0;
      if (mode === 'tm') return col ? 2 : 0;
      if (mode === 'fact') return col ? 2 : 1;
      if (mode === 'win') return Math.abs(f - q.f) <= 1 && Math.abs(x - q.x) <= 1 && Math.abs(y - q.y) <= 1 ? 2 : 0;
      return 0;
    };
    return { get };
  }
  cvG.addEventListener('click', (e) => {
    if (!geo) return; const p = A.pos(cvG, e);
    for (let f = 0; f < F; f++) { const fx = geo.x0 + f * (geo.fw + geo.gap); const x = Math.floor((p.x - fx) / geo.cs), y = Math.floor((p.y - geo.top) / geo.cs); if (x >= 0 && x < G && y >= 0 && y < G) { q = { f, x, y }; draw(); return; } }
  });
  // cost model
  const D = 5120;
  function costs(sec) {
    const T = Math.round(sec * 24) + 1, Nt = 1 + Math.ceil((T - 1) / 4), Ns = 45 * 80, n = Nt * Ns;
    const w = Math.min(n, Math.min(Nt, 9) * 24 * 24);
    return { Nt, Ns, n, lin: 24 * D * D * n, full: 4 * n * n * D, fact: 4 * n * (Ns + Nt) * D, win: 4 * n * w * D };
  }
  const LINES = [{ k: 'lin', n: '线性层（参照）', c: 'muted' }, { k: 'full', n: '全 3D 注意力', c: 7 }, { k: 'fact', n: '空间 + 时间分解', c: 0 }, { k: 'win', n: '3D 窗口（时间 9 潜帧 × 空间 24×24）', c: 2 }];
  const colOf = (l) => (l.c === 'muted' ? A.css('--muted') : cols[l.c]);
  let axC = null;
  const chart = A.canvas(cvC, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 54, y: 24, w: W - 70, h: H - 58 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 60, ymin: 1e11, ymax: 1e17, xlog: true, ylog: true, xticks: [1, 2, 5, 10, 20, 60], xfmt: (v) => v + ' 秒', yfmt: (v) => A.sci(v), xlabel: '视频时长', ylabel: '每层一次前向的运算数', ylabelOffset: 48 });
    axC = ax;
    LINES.forEach((l) => {
      ctx.strokeStyle = colOf(l); ctx.lineWidth = l.k === 'lin' ? 1.6 : 2.4; if (l.k === 'lin') ctx.setLineDash([5, 4]);
      ctx.beginPath(); for (let i = 0; i <= 80; i++) { const s = Math.pow(60, i / 80); const v = costs(s)[l.k]; const y = ax.Y(A.clamp(v, 1e11, 1e17)); i ? ctx.lineTo(ax.X(s), y) : ctx.moveTo(ax.X(s), y); } ctx.stroke(); ctx.setLineDash([]);
    });
    const s = durS.value, c = costs(s);
    ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax.X(s), box.y); ctx.lineTo(ax.X(s), box.y + box.h); ctx.stroke();
    LINES.forEach((l) => { ctx.fillStyle = colOf(l); ctx.beginPath(); ctx.arc(ax.X(s), ax.Y(A.clamp(c[l.k], 1e11, 1e17)), 3.5, 0, 7); ctx.fill(); });
  });
  cvC.addEventListener('mousemove', (e) => { if (!axC) return; const p = A.pos(cvC, e), s = A.clamp(axC.invX(p.x), 1, 60), c = costs(s); A.tip.show(`<b>${s.toFixed(1)} 秒</b>，${c.n.toLocaleString()} 个 token<br>` + LINES.map((l) => `<span style="color:${colOf(l)}">■</span> ${l.n}：${A.sci(c[l.k])}`).join('<br>'), e.clientX, e.clientY); });
  cvC.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    view.redraw();
    if (q) {
      const st = state(); let nk = 0; for (let f = 0; f < F; f++) for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (st.get(f, x, y) === 2) nk++;
      let msg = '';
      if (q.f === 0) msg = '查询在第 1 个潜帧，没有“上一帧”。';
      else {
        const [bx, by] = ball(q.f - 1), k = st.get(q.f - 1, bx, by);
        msg = k === 2 ? '上一帧的红球：<b>这一层就能直接看到</b>。' : k === 1 ? `上一帧的红球：<b>只能两跳间接看到</b>：第一层在潜帧 ${q.f} 内部把红球的信息汇到 (${q.x}, ${q.y}) 这个位置，第二层再沿时间传过来；那个中转 token 要用一个向量概括整帧的内容。` : '上一帧的红球：<b>这一层看不到</b>。';
        if (mode === 'win' && k !== 2) msg += ' 物体一个潜帧跑出窗口，就要靠多层逐步接力。';
        if (mode === 'tm' && k !== 2) msg += ' 时间注意力只连同一位置，物体一动就离开了这一“列”。';
      }
      say.innerHTML = `查询 = 潜帧 ${q.f + 1} 的 (${q.x}, ${q.y})，这一层直接看 <b>${nk}</b> 个 key（共 ${F * G * G} 个 token）。` + msg + (mode === 'fact' ? ' 深色 = 第二层（时间）直接看的；浅色 = 第一层（空间）先汇总过、再间接传来的。' : '');
    }
    const c = costs(durS.value);
    stats.innerHTML = '';
    [['潜帧 × 每帧 token', `${c.Nt} × ${c.Ns.toLocaleString()}`], ['token 数 n', c.n.toLocaleString()], ['全 3D ÷ 分解', (c.full / c.fact).toFixed(1) + ' 倍'], ['全 3D 时注意力占比', A.pct(c.full / (c.full + c.lin), 0)], ['分解时注意力占比', A.pct(c.fact / (c.fact + c.lin), 0)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    legend.innerHTML = LINES.map((l) => `<span><i class="line" style="background:${colOf(l)}"></i>${l.n}</span>`).join('');
    chart.redraw();
  }
  draw();
  requestAnimationFrame(draw);
});
