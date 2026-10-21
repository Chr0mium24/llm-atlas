/* world-models-horizon — how far to trust an imperfect world model: score = imagined H steps (error grows like L^t) + critic tail (error shrinks like γ^H); pick the best of K plans; winner's curse */
A.defineDemo('world-models-horizon', function (mount) {
  const { bd } = A.demo(mount, '想象几步最合适：模型误差 × 视野 → 实际回报', '玩具模型：M 个候选计划，真实回报的标准差为 10；打分 = 想象 H 步（第 t 步误差 ε(Lᵗ−1)/(L−1)，L 是每步对已有误差的放大）+ 价值函数补尾巴（误差 σ）；γ = 0.95');
  const G = 0.95, SQ = 10, HMAX = 40;
  // E[max of K standard normals], by numerical integration
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const mK = (K) => { let s = 0; const N = 3000; for (let i = 0; i < N; i++) { const x = -8 + 16 * (i + 0.5) / N; const phi = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); const Phi = 0.5 * (1 + erf(x / Math.SQRT2)); s += x * K * phi * Math.pow(Phi, K - 1) * 16 / N; } return s; };
  const MK = { 4: mK(4), 16: mK(16), 64: mK(64) };
  const cH = (H, L) => { let s = 0, g = 1; for (let t = 0; t < H; t++) { s += g * (Math.abs(L - 1) < 1e-9 ? t : (Math.pow(L, t) - 1) / (L - 1)); g *= G; } return s; };

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const epsS = A.slider(ctl, { label: '模型单步误差 ε', min: 0, max: 0.15, step: 0.005, value: 0.05, fmt: (v) => v.toFixed(3), on: draw, width: 170 });
  const LS = A.slider(ctl, { label: '误差放大系数 L', min: 0.9, max: 1.25, step: 0.01, value: 1.1, fmt: (v) => v.toFixed(2) + (v < 1 ? '（误差会衰减）' : v === 1 ? '（只累加）' : ''), on: draw, width: 190 });
  const sgS = A.slider(ctl, { label: '价值函数误差 σ', min: 0, max: 16, step: 0.5, value: 8, fmt: (v) => v.toFixed(1), on: draw, width: 160 });
  const HS = A.slider(ctl, { label: '想象视野 H（左图）', min: 0, max: HMAX, step: 1, value: 30, fmt: (v) => v + ' 步', on: draw, width: 170 });
  const Kseg = A.seg(ctl, [{ t: '4', v: 4 }, { t: '16', v: 16 }, { t: '64', v: 64 }], 16, () => { resample(); draw(); }, '候选计划数 M');
  ctl.append(A.el('button', { onclick: () => { seed++; resample(); draw(); } }, '换一组候选'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' }); const cvS = A.el('canvas', { class: 'cv' }), cvR = A.el('canvas', { class: 'cv' }); grid.append(cvS, cvR); bd.append(grid);
  const cvN = A.el('canvas', { class: 'cv', style: { marginTop: '14px' } }); bd.append(cvN);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  bd.append(A.el('p', { class: 'hint' }, '左图是一次具体的挑选：每个点是一个候选计划，横轴是它的真实回报，纵轴是规划器给它的打分。点离对角线越远，打分越不准。规划器选纵轴最高的那个（实心），真正最好的是横轴最右的那个（圆圈）。默认这组候选、H = 30 时，被选中的不是真正最好的那个。把 H 从 0 拖到 40：一开始点的上下散布来自价值函数，越往后越整齐；再往后，模型误差按 Lᵗ 放大，点又散开，而且被选中的总是“被高估最多”的那个。右图对所有可能的候选取平均（按推导里的公式精确计算），竖虚线是最优视野。把 L 调到 1.00 或更小，最优视野明显变长；把 σ 调小（价值函数更准），最优视野变短。'));

  let seed = 7, pts = [];
  function resample() {
    const r = A.rng(seed * 31 + 3), K = Kseg.value; pts = [];
    for (let k = 0; k < K; k++) pts.push({ q: SQ * A.gauss(r), b: A.gauss(r), xi: A.gauss(r) });
  }
  function noise(H) { const e = epsS.value, L = LS.value, s = sgS.value; const m = e * cH(H, L), c = Math.pow(G, H) * s; return { m, c, s: Math.sqrt(m * m + c * c) }; }
  function curves() {
    const K = Kseg.value, m = MK[K], out = [];
    for (let H = 0; H <= HMAX; H++) { const n = noise(H); out.push({ H, act: m * SQ * SQ / Math.sqrt(SQ * SQ + n.s * n.s), ima: m * Math.sqrt(SQ * SQ + n.s * n.s), ...n }); }
    let best = out[0]; out.forEach((o) => { if (o.act > best.act) best = o; });
    return { out, best, top: m * SQ };
  }
  const cols = A.series();
  let C;
  const vS = A.canvas(cvS, { aspect: 0.82 }, (ctx, W, H) => {
    const box = { x: 46, y: 26, w: W - 60, h: H - 64 };
    const Hh = HS.value, n = noise(Hh);
    const sc = pts.map((p) => p.q + epsS.value * cH(Hh, LS.value) * p.b + Math.pow(G, Hh) * sgS.value * p.xi);
    const lo = -30, hi = 30, ylo = Math.min(-30, ...sc), yhi = Math.max(30, ...sc);
    const ymin = Math.max(ylo, -90), ymax = Math.min(yhi, 90);
    const ax = A.axes(ctx, box, { xmin: lo, xmax: hi, ymin, ymax, xticks: [-30, -20, -10, 0, 10, 20, 30], yfmt: (v) => v.toFixed(0), xfmt: (v) => v.toFixed(0), xlabel: '真实回报', ylabel: '规划器的打分（想象 ' + Hh + ' 步 + 价值函数）', ylabelOffset: 40, xgrid: true });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ax.X(Math.max(lo, ymin)), ax.Y(Math.max(lo, ymin))); ctx.lineTo(ax.X(Math.min(hi, ymax)), ax.Y(Math.min(hi, ymax))); ctx.stroke(); ctx.restore();
    A.text(ctx, '虚线：打分 = 真实回报', box.x + box.w - 4, box.y + box.h - 10, { size: 11, align: 'right', color: A.css('--muted') });
    let ci = 0, bi = 0; sc.forEach((v, i) => { if (v > sc[ci]) ci = i; if (pts[i].q > pts[bi].q) bi = i; });
    pts.forEach((p, i) => {
      const x = ax.X(A.clamp(p.q, lo, hi)), y = ax.Y(A.clamp(sc[i], ymin, ymax));
      ctx.fillStyle = A.alpha(cols[0], i === ci ? 1 : 0.45); ctx.beginPath(); ctx.arc(x, y, i === ci ? 6.5 : 4.5, 0, 7); ctx.fill();
      if (i === bi) { ctx.strokeStyle = cols[2]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, 7); ctx.stroke(); }
    });
    const reg = pts[bi].q - pts[ci].q;
    A.text(ctx, '选中（打分最高）：真实 ' + pts[ci].q.toFixed(1) + '，打分 ' + sc[ci].toFixed(1), box.x + 6, box.y + 8, { size: 12, color: cols[0], weight: 600 });
    A.text(ctx, '真正最好：' + pts[bi].q.toFixed(1) + (ci === bi ? '（选对了）' : '（少拿了 ' + reg.toFixed(1) + '）'), box.x + 6, box.y + 26, { size: 12, color: cols[2], weight: 600 });
    A.text(ctx, '打分误差的标准差 ≈ ' + n.s.toFixed(1), box.x + 6, box.y + 44, { size: 11.5, color: A.css('--ink-2') });
  });
  const vR = A.canvas(cvR, { aspect: 0.82 }, (ctx, W, H) => {
    const box = { x: 46, y: 26, w: W - 60, h: H - 64 };
    const ymax = C.top * 2.2;
    const ax = A.axes(ctx, box, { xmin: 0, xmax: HMAX, ymin: 0, ymax, xticks: [0, 5, 10, 15, 20, 25, 30, 35, 40], yfmt: (v) => v.toFixed(0), xfmt: (v) => v.toFixed(0), xlabel: '想象视野 H（步）', ylabel: '被选中计划的回报（平均）', ylabelOffset: 40 });
    ctx.save(); ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(C.top)); ctx.lineTo(ax.X(HMAX), ax.Y(C.top)); ctx.stroke(); ctx.restore();
    A.text(ctx, '最好的计划：' + C.top.toFixed(1), ax.X(HMAX) - 4, ax.Y(C.top) - 9, { size: 11, align: 'right', color: A.css('--muted') });
    const line = (key, color, dash, w) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); C.out.forEach((o, i) => { const y = ax.Y(Math.min(o[key], ymax)); i ? ctx.lineTo(ax.X(o.H), y) : ctx.moveTo(ax.X(o.H), y); }); ctx.stroke(); ctx.restore(); };
    line('ima', cols[6], [6, 4], 2); line('act', cols[0], null, 2.8);
    const hs = C.best.H;
    ctx.save(); ctx.strokeStyle = cols[2]; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax.X(hs), box.y); ctx.lineTo(ax.X(hs), box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, '最优 H* = ' + hs, ax.X(hs) + 5, box.y + 8, { size: 12, color: cols[2], weight: 600 });
    const hc = HS.value, o = C.out[hc];
    ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax.X(hc), box.y + 18); ctx.lineTo(ax.X(hc), box.y + box.h); ctx.stroke();
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(hc), ax.Y(o.act), 4.5, 0, 7); ctx.fill();
    if (o.ima <= ymax) { ctx.fillStyle = cols[6]; ctx.beginPath(); ctx.arc(ax.X(hc), ax.Y(o.ima), 4, 0, 7); ctx.fill(); }
    A.text(ctx, '实际回报', ax.X(2), ax.Y(C.out[2].act) + 14, { size: 11.5, color: cols[0], weight: 600 });
    const lab = C.out.find((q) => q.ima > ymax * 0.8 || q.H === HMAX);
    A.text(ctx, '规划器以为的回报', ax.X(Math.min(lab.H, HMAX - 12)), ax.Y(Math.min(lab.ima, ymax * 0.86)) - 10, { size: 11.5, color: cols[6], weight: 600 });

  });
  const vN = A.canvas(cvN, { height: 190 }, (ctx, W, H) => {
    const box = { x: 46, y: 26, w: W - 60, h: H - 60 };
    const ymax = Math.max(4, sgS.value * 1.15, 6);
    const ax = A.axes(ctx, box, { xmin: 0, xmax: HMAX, ymin: 0, ymax, xticks: [0, 5, 10, 15, 20, 25, 30, 35, 40], yfmt: (v) => v.toFixed(0), xfmt: (v) => v.toFixed(0), xlabel: '想象视野 H（步）', ylabel: '打分误差的两部分（标准差）', ylabelOffset: 40 });
    const line = (key, color, dash, w) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); C.out.forEach((o, i) => { const y = ax.Y(Math.min(o[key], ymax)); i ? ctx.lineTo(ax.X(o.H), y) : ctx.moveTo(ax.X(o.H), y); }); ctx.stroke(); ctx.restore(); };
    line('c', cols[1], null, 2); line('m', cols[3], null, 2); line('s', A.css('--ink-2'), [5, 4], 1.6);
    if (C.out[HMAX].m > ymax) { const q = C.out.find((o) => o.m > ymax); A.text(ctx, '↑ 超出图外（40 步时 ' + C.out[HMAX].m.toFixed(1) + '）', box.x + box.w - 4, box.y + 22, { size: 11, align: 'right', color: cols[3] }); void q; }
    const hs = C.best.H;
    ctx.save(); ctx.strokeStyle = cols[2]; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(ax.X(hs), box.y); ctx.lineTo(ax.X(hs), box.y + box.h); ctx.stroke(); ctx.restore();
  });
  legend.innerHTML = `<span><i class="line" style="background:${cols[0]}"></i>实际回报（被选中计划的真实回报）</span><span><i class="line" style="background:${cols[6]}"></i>规划器以为的回报（选中计划的打分，超出图外的部分贴着顶边）</span><span><i class="line" style="background:${cols[1]}"></i>价值函数那部分误差（σ 乘 γ 的 H 次方）</span><span><i class="line" style="background:${cols[3]}"></i>模型那部分误差（随 H 按 Lᵗ 累积）</span><span><i class="line" style="background:${A.css('--ink-2')}"></i>虚线：两部分合计</span>`;
  function tipAt(cv, e) {
    const p = A.pos(cv, e), W = cv.clientWidth, box = { x: 46, w: W - 60 };
    const Hh = Math.round(A.clamp((p.x - box.x) / box.w, 0, 1) * HMAX), o = C.out[Hh];
    A.tip.show(`H = ${Hh}：实际回报 <b>${o.act.toFixed(1)}</b>（最好的 ${A.pct(o.act / C.top, 0)}），以为 ${o.ima.toFixed(1)}<br>误差：模型 ${o.m.toFixed(2)}，价值函数 ${o.c.toFixed(2)}，合计 ${o.s.toFixed(2)}`, e.clientX, e.clientY);
  }
  [cvR, cvN].forEach((cv) => { cv.addEventListener('mousemove', (e) => tipAt(cv, e)); cv.addEventListener('mouseleave', () => A.tip.hide()); });
  function draw() {
    C = curves();
    const o0 = C.out[0], oe = C.out[HMAX], ob = C.best;
    stats.innerHTML = [
      ['最优视野 H*', ob.H + ' 步'],
      ['H* 时的实际回报（占最好的）', A.pct(ob.act / C.top, 0)],
      ['只靠价值函数（H = 0）', A.pct(o0.act / C.top, 0)],
      ['想象 40 步', A.pct(oe.act / C.top, 0) + ' <small>以为 ' + A.pct(oe.ima / C.top, 0) + '</small>'],
    ].map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    vS.redraw(); vR.redraw(); vN.redraw();
  }
  resample(); draw();
});
