/* mini-clip — interactive demo (moved from ch16-vlm.html) */
A.defineDemo('mini-clip', function (mount) {
  const lumaText = (c) => { const m = c.match(/\d+/g).map(Number); const L = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; return L < 140 ? '#ffffff' : '#0b0b0b'; };
  const { bd } = A.demo(mount, '迷你 CLIP：对比学习把图标和文字对齐', '6 色 × 6 形 = 36 种组合，6 种留作零样本测试');
  const COL = [['红', [222, 52, 48]], ['橙', [246, 142, 28]], ['黄', [226, 196, 18]], ['绿', [38, 168, 82]], ['蓝', [40, 108, 222]], ['紫', [152, 62, 192]]];
  const SHP = ['圆形', '正方形', '三角形', '十字', '圆环', '菱形'];
  const S = 12, NV = 8, IN = S * S * 3, HID = 48, D = 16, NT = 12;
  const MASK = [
    (x, y) => x * x + y * y < 0.62,
    (x, y) => Math.abs(x) < 0.62 && Math.abs(y) < 0.62,
    (x, y) => y > -0.72 && y < 0.68 && Math.abs(x) < (0.82 * (y + 0.72)) / 1.4,
    (x, y) => (Math.abs(x) < 0.24 && Math.abs(y) < 0.82) || (Math.abs(y) < 0.24 && Math.abs(x) < 0.82),
    (x, y) => { const r = x * x + y * y; return r < 0.7 && r > 0.2; },
    (x, y) => Math.abs(x) + Math.abs(y) < 0.86,
  ];
  const HELD = [[0, 3], [1, 5], [2, 0], [3, 2], [4, 1], [5, 4]];
  const combos = [];
  for (let c = 0; c < 6; c++) for (let s = 0; s < 6; s++) combos.push({ c, s, held: HELD.some(([a, b]) => a === c && b === s) });
  const train = [], held = [];
  combos.forEach((o, i) => (o.held ? held : train).push(i));
  const cap = (ci) => COL[combos[ci].c][0] + '色' + SHP[combos[ci].s];
  function render(ci, v) {
    const r = A.rng(1000 + ci * 37 + v * 7919);
    const dx = v ? Math.floor(r() * 3) - 1 : 0, dy = v ? Math.floor(r() * 3) - 1 : 0, sc = v ? 0.86 + r() * 0.26 : 1;
    const m = new Float64Array(S * S), x = new Float64Array(IN), { c, s } = combos[ci], rgb = COL[c][1];
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      let acc = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const X = (((px - dx + (b + 0.5) / 3) / S) * 2 - 1) / sc, Y = (((py - dy + (a + 0.5) / 3) / S) * 2 - 1) / sc;
        if (MASK[s](X, Y)) acc++;
      }
      const mv = acc / 9; m[py * S + px] = mv;
      for (let ch = 0; ch < 3; ch++) x[(py * S + px) * 3 + ch] = (mv * rgb[ch]) / 255 + (v ? A.gauss(r) * 0.05 : 0);
    }
    return { m, x };
  }
  const bank = combos.map((_, ci) => Array.from({ length: NV }, (_, v) => render(ci, v)));
  const txt = combos.map(({ c, s }) => { const t = new Float64Array(NT); t[c] = 1; t[6 + s] = 1; return t; });
  function drawIcon(ctx, ci, x0, y0, size, v = 0) {
    const m = bank[ci][v].m, px = size / S, [r, g, b] = COL[combos[ci].c][1];
    ctx.fillStyle = A.css('--page'); ctx.fillRect(x0, y0, size, size);
    for (let i = 0; i < S * S; i++) if (m[i] > 0.02) { ctx.fillStyle = `rgba(${r},${g},${b},${m[i]})`; ctx.fillRect(x0 + (i % S) * px, y0 + Math.floor(i / S) * px, px + 0.3, px + 0.3); }
  }

  /* model: image = MLP(432 → 32 → 16), text = linear(12 → 16); both L2-normalised */
  const SHAPES = { W1: HID * IN, b1: HID, W2: D * HID, Wt: D * NT };
  let P, M, V, G, tstep, lossHist, seed = 3, rng, ev = { seen: 0, zero: 0, zc: 0, zs: 0 };
  function init() {
    const r = A.rng(seed++);
    rng = A.rng(seed * 101);
    const sd = { W1: Math.sqrt(2 / IN), b1: 0, W2: Math.sqrt(1 / HID), Wt: Math.sqrt(0.5) };
    P = {}; M = {}; V = {}; G = {};
    for (const k in SHAPES) { P[k] = Float64Array.from({ length: SHAPES[k] }, () => A.gauss(r) * sd[k]); M[k] = new Float64Array(SHAPES[k]); V[k] = new Float64Array(SHAPES[k]); G[k] = new Float64Array(SHAPES[k]); }
    tstep = 0; lossHist = []; ev = evalAcc();
  }
  function encI(x) {
    const pre = new Float64Array(HID), h = new Float64Array(HID), u = new Float64Array(D);
    for (let k = 0; k < HID; k++) { let s = P.b1[k]; const o = k * IN; for (let i = 0; i < IN; i++) s += P.W1[o + i] * x[i]; pre[k] = s; h[k] = s > 0 ? s : 0; }
    for (let d = 0; d < D; d++) { let s = 0; const o = d * HID; for (let k = 0; k < HID; k++) s += P.W2[o + k] * h[k]; u[d] = s; }
    const n = Math.hypot(...u) || 1e-9;
    return { x, pre, h, n, e: u.map((z) => z / n) };
  }
  function encT(t) {
    const v = new Float64Array(D);
    for (let d = 0; d < D; d++) { let s = 0; for (let j = 0; j < NT; j++) s += P.Wt[d * NT + j] * t[j]; v[d] = s; }
    const n = Math.hypot(...v) || 1e-9;
    return { t, n, e: v.map((z) => z / n) };
  }
  function trainStep(bs, tau) {
    const pool = train.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const idx = pool.slice(0, bs), N = idx.length;
    const I = idx.map((ci) => encI(bank[ci][1 + Math.floor(rng() * (NV - 1))].x));
    const T = idx.map((ci) => encT(txt[ci]));
    const Sm = I.map((a) => T.map((b) => A.dot(a.e, b.e) / tau));
    const Pr = Sm.map((row) => A.softmax(row));
    const Pc = Sm.map(() => new Array(N));
    for (let j = 0; j < N; j++) A.softmax(Sm.map((row) => row[j])).forEach((p, i) => (Pc[i][j] = p));
    let loss = 0;
    for (let i = 0; i < N; i++) loss -= (Math.log(Pr[i][i] + 1e-12) + Math.log(Pc[i][i] + 1e-12)) / (2 * N);
    const Gs = Pr.map((row, i) => row.map((p, j) => (p + Pc[i][j] - 2 * (i === j)) / (2 * N)));
    for (const k in G) G[k].fill(0);
    I.forEach((a, i) => {
      const dE = new Float64Array(D);
      T.forEach((b, j) => { for (let d = 0; d < D; d++) dE[d] += (Gs[i][j] * b.e[d]) / tau; });
      const pr = A.dot(a.e, dE), du = dE.map((g, d) => (g - a.e[d] * pr) / a.n);
      const dh = new Float64Array(HID);
      for (let d = 0; d < D; d++) { const o = d * HID; for (let k = 0; k < HID; k++) { G.W2[o + k] += du[d] * a.h[k]; dh[k] += P.W2[o + k] * du[d]; } }
      for (let k = 0; k < HID; k++) { if (a.pre[k] <= 0) continue; const g = dh[k], o = k * IN; G.b1[k] += g; for (let q = 0; q < IN; q++) G.W1[o + q] += g * a.x[q]; }
    });
    T.forEach((b, j) => {
      const dE = new Float64Array(D);
      I.forEach((a, i) => { for (let d = 0; d < D; d++) dE[d] += (Gs[i][j] * a.e[d]) / tau; });
      const pr = A.dot(b.e, dE);
      for (let d = 0; d < D; d++) { const g = (dE[d] - b.e[d] * pr) / b.n; for (let q = 0; q < NT; q++) G.Wt[d * NT + q] += g * b.t[q]; }
    });
    tstep++;
    const lr = 0.003, WD = 0.01, c1 = 1 - Math.pow(0.9, tstep), c2 = 1 - Math.pow(0.999, tstep);
    for (const k in P) { const p = P[k], m = M[k], v = V[k], g = G[k]; for (let i = 0; i < p.length; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; p[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + 1e-8) + lr * WD * p[i]; } }
    return loss;
  }
  function evalAcc() {
    const T36 = combos.map((_, ci) => encT(txt[ci]).e);
    const acc = (list) => { let ok = 0, oc = 0, os = 0, n = 0; list.forEach((ci) => bank[ci].forEach((smp) => { const e = encI(smp.x).e; let best = -9, bi = -1; T36.forEach((t, j) => { const s = A.dot(e, t); if (s > best) { best = s; bi = j; } }); ok += bi === ci; oc += combos[bi].c === combos[ci].c; os += combos[bi].s === combos[ci].s; n++; })); return [ok / n, oc / n, os / n]; };
    const a = acc(train), z = acc(held);
    return { seen: a[0], zero: z[0], zc: z[1], zs: z[2] };
  }

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const bRun = A.el('button', { class: 'primary', onclick: toggle }, '开始训练');
  ctl.append(A.el('div', { class: 'flex' }, bRun, A.el('button', { onclick: () => { stop(); init(); draw(); } }, '重置')));
  const tauS = A.slider(ctl, { label: '温度 τ', min: 0.01, max: 1, log: true, value: 0.07, fmt: (v) => v.toFixed(v < 0.1 ? 3 : 2), on: () => draw() });
  const bsS = A.slider(ctl, { label: '批大小 N（每对有 N−1 个负例）', min: 4, max: 30, step: 2, value: 16, fmt: (v) => v, on: () => draw(), width: 220 });
  const showSeg = A.seg(ctl, [{ v: 'cos', t: '余弦相似度' }, { v: 'prob', t: '按行 softmax(S/τ)' }], 'cos', () => draw(), '矩阵显示');
  const grid = A.el('div', { class: 'cols' }); bd.append(grid);
  const left = A.el('div'), right = A.el('div'); grid.append(left, right);
  const cvM = A.el('canvas', { class: 'cv' }); left.append(cvM);
  left.append(A.el('p', { class: 'hint' }, '8 对训练样本：行是图，列是文字，框出的是真正的配对。训练前一片混乱，训练后对角线变亮；同色或同形的组合之间也会有中等的相似度。'));
  const cvL = A.el('canvas', { class: 'cv' }); right.append(cvL);
  const stats = A.el('div', { class: 'stats' }); right.append(stats);
  right.append(A.el('div', { class: 'small', style: { color: 'var(--ink-2)', marginTop: '6px' } }, '零样本：点一个训练中从未见过的组合，看它在 36 句描述里的概率'));
  const zs = A.el('div', { class: 'zs' }); right.append(zs);
  const zlist = A.el('div'); right.append(zlist);
  bd.append(A.el('p', { class: 'hint' }, '建议先用默认值训练到 1000 步以上，看零样本准确率：颜色几乎全对，形状难一些。之后点“重置”试几组设置。τ = 1：损失停在 1.8 左右下不去，因为余弦相似度只在 ±1 之间，除以 τ 后 softmax 变不尖（切到“按行 softmax”能看到概率都很平）；不过按最大值分类时，准确率不一定差，在这个小玩具里它反而少了一些死记。τ = 0.01：损失很快接近 0，零样本准确率却下降，说明模型在死记训练过的组合。批大小调到 4：负例太少，连见过的组合都分不清。真实的 CLIP 让 τ 自己学，最后停在下限 0.01 附近；它有 4 亿对数据，不用担心死记。零样本之所以能成功，是因为模型把颜色和形状学成了可以自由组合的两部分。'));
  let zSel = held[0];
  const zCanvases = held.map((ci) => {
    const c = A.el('canvas', { width: 80, height: 80, title: cap(ci) });
    c.onclick = () => { zSel = ci; draw(); };
    zs.append(c); return [ci, c];
  });
  const DISP = [[0, 0], [0, 1], [1, 2], [2, 4], [3, 1], [4, 3], [4, 4], [5, 5]].map(([c, s]) => c * 6 + s);

  const viewM = A.canvas(cvM, { aspect: 1.02 }, (ctx, W, H) => {
    const n = DISP.length, cell = Math.floor((W - 12) / (n + 1)), L = cell + 6, Tp = H - cell * n - 4;
    const tau = tauS.value;
    const Ie = DISP.map((ci) => encI(bank[ci][0].x).e), Te = DISP.map((ci) => encT(txt[ci]).e);
    const cos = Ie.map((a) => Te.map((b) => A.dot(a, b)));
    const val = showSeg.value === 'cos' ? cos : cos.map((row) => A.softmax(row.map((x) => x / tau)));
    DISP.forEach((ci, j) => {
      const x = L + j * cell + cell / 2;
      A.text(ctx, COL[combos[ci].c][0] + '色', x, Tp - 26, { size: 11.5, align: 'center', color: A.css('--ink-2') });
      A.text(ctx, SHP[combos[ci].s], x, Tp - 11, { size: 11.5, align: 'center', color: A.css('--ink-2') });
    });
    DISP.forEach((ci, i) => {
      drawIcon(ctx, ci, 2, Tp + i * cell + 3, cell - 6);
      for (let j = 0; j < n; j++) {
        const v = val[i][j], col = showSeg.value === 'cos' ? A.div(v) : A.seq(v);
        const x = L + j * cell, y = Tp + i * cell;
        ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        A.text(ctx, showSeg.value === 'cos' ? v.toFixed(2) : Math.round(v * 100) + '%', x + cell / 2, y + cell / 2, { size: Math.min(12, cell / 4), align: 'center', mono: true, color: lumaText(col) });
        if (i === j) { ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 2; ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3); }
      }
    });
  });
  const viewL = A.canvas(cvL, { aspect: 0.5 }, (ctx, W, H) => {
    const box = { x: 40, y: 24, w: W - 54, h: H - 58 };
    const xmax = Math.max(200, lossHist.length), ymax = Math.max(3.6, ...lossHist.slice(0, 5));
    const ax = A.axes(ctx, box, { xmin: 0, xmax, ymin: 0, ymax, xlabel: '训练步数', yfmt: (v) => v.toFixed(1), ny: 4 });
    A.text(ctx, '对比损失', box.x - 30, 10, { size: 11.5, color: A.css('--muted') });
    const chance = Math.log(bsS.value), y = ax.Y(chance);
    ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.setLineDash([]);
    A.text(ctx, '随机猜 = ln N', box.x + box.w - 4, y - 8, { size: 11, align: 'right', color: A.css('--muted') });
    if (lossHist.length > 1) {
      ctx.strokeStyle = A.series()[0]; ctx.lineWidth = 2; ctx.beginPath();
      let sm = lossHist[0];
      lossHist.forEach((l, i) => { sm = 0.92 * sm + 0.08 * l; const px = ax.X(i), py = ax.Y(Math.min(sm, ymax)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
    }
  });
  function drawZ() {
    zCanvases.forEach(([ci, c]) => { const x = c.getContext('2d'); x.clearRect(0, 0, 80, 80); drawIcon(x, ci, 0, 0, 80); c.classList.toggle('on', ci === zSel); });
    const e = encI(bank[zSel][0].x).e, tau = tauS.value;
    const sims = combos.map((_, ci) => A.dot(e, encT(txt[ci]).e) / tau), p = A.softmax(sims);
    const top = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5);
    zlist.innerHTML = '';
    top.forEach(([v, i]) => zlist.append(A.el('div', { class: 'zrow' + (i === zSel ? ' ok' : '') }, A.el('span', { class: 'lb' }, (i === zSel ? '✓ ' : '') + cap(i)), A.el('span', { class: 'bar' }, A.el('i', { style: { width: v * 100 + '%' } })), A.el('span', { class: 'pv' }, A.pct(v, v < 0.1 ? 1 : 0)))));
  }
  function draw() {
    viewM.redraw(); viewL.redraw(); drawZ();
    const last = lossHist.length ? A.mean(lossHist.slice(-20)) : null;
    stats.innerHTML = '';
    [['训练步数', tstep], ['当前损失', last === null ? '—' : last.toFixed(3)], ['已见组合准确率', A.pct(ev.seen, 0) + ' <small>36 选 1</small>'], ['零样本准确率', A.pct(ev.zero, 0) + ` <small>颜色对 ${A.pct(ev.zc, 0)} · 形状对 ${A.pct(ev.zs, 0)}</small>`]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: String(v) }))));
  }
  let raf = null;
  function loop() {
    for (let k = 0; k < 3; k++) lossHist.push(trainStep(bsS.value, tauS.value));
    if (tstep % 24 === 0) ev = evalAcc();
    draw();
    if (tstep >= 3000) { ev = evalAcc(); stop(); draw(); return; }
    raf = requestAnimationFrame(loop);
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; bRun.textContent = tstep ? '继续训练' : '开始训练'; }
  function toggle() { if (raf) { stop(); ev = evalAcc(); draw(); return; } if (tstep >= 3000) { init(); } bRun.textContent = '暂停'; raf = requestAnimationFrame(loop); }
  A.onTheme(drawZ);
  init(); draw();
});
