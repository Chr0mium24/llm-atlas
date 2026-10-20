/* image-sdedit — SDEdit strength trade-off on a toy "image prior": 64×64 Gaussian textures with a 1/f² power spectrum.
   Every DCT coefficient has an exact Gaussian posterior, so the ideal SDEdit output (reverse SDE from t = s) is sampled exactly.
   Noise level s acts as a frequency cutoff: coarser structure is kept from the sketch, finer structure is regenerated. */
A.defineDemo('image-sdedit', function (mount) {
  const { bd } = A.demo(mount, 'SDEdit 的强度权衡：加噪越多，越像真图、越不像草图',
    '玩具模型：“真实图像”是功率谱 ∝ 1/f² 的随机纹理（自然照片的典型统计），64×64 灰度；每个频率分量的后验都精确算出，相当于理想的去噪器');
  const N = 64, NN = N * N, STD = 0.5;
  // orthonormal DCT-II
  const C = []; for (let k = 0; k < N; k++) { const row = new Float64Array(N); for (let n = 0; n < N; n++) row[n] = (k ? Math.sqrt(2 / N) : Math.sqrt(1 / N)) * Math.cos(Math.PI * (n + 0.5) * k / N); C.push(row); }
  function dct2(x) {
    const t = new Float64Array(NN), o = new Float64Array(NN);
    for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) { let s = 0; const r = C[k]; for (let n = 0; n < N; n++) s += r[n] * x[i * N + n]; t[i * N + k] = s; }
    for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) { let s = 0; const r = C[k]; for (let n = 0; n < N; n++) s += r[n] * t[n * N + j]; o[k * N + j] = s; }
    return o;
  }
  function idct2(X) {
    const t = new Float64Array(NN), o = new Float64Array(NN);
    for (let k = 0; k < N; k++) for (let n = 0; n < N; n++) { let s = 0; for (let j = 0; j < N; j++) s += C[j][n] * X[k * N + j]; t[k * N + n] = s; }
    for (let m = 0; m < N; m++) for (let n = 0; n < N; n++) { let s = 0; for (let k = 0; k < N; k++) s += C[k][m] * t[k * N + n]; o[m * N + n] = s; }
    return o;
  }
  // prior power spectrum P(k) = c / (k² + 1), k in cycles per image
  const KF = new Float64Array(NN), P = new Float64Array(NN);
  let tot = 0;
  for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) { const k = Math.sqrt(u * u + v * v) / 2; KF[u * N + v] = k; tot += 1 / (k * k + 1); }
  const PC = (STD * STD * NN) / tot;
  for (let i = 0; i < NN; i++) P[i] = PC / (KF[i] * KF[i] + 1);
  const Pk = (k) => PC / (k * k + 1);
  // sketches drawn on an offscreen canvas
  const off = document.createElement('canvas'); off.width = off.height = N;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const SK = {
    shapes: { t: '圆和竖条', draw: (c) => { c.fillStyle = '#808080'; c.fillRect(0, 0, N, N); c.fillStyle = '#f0f0f0'; c.beginPath(); c.arc(22, 28, 12, 0, 7); c.fill(); c.fillStyle = '#1a1a1a'; c.fillRect(41, 15, 9, 37); } },
    letter: { t: '字母 A', draw: (c) => { c.fillStyle = '#808080'; c.fillRect(0, 0, N, N); c.fillStyle = '#f0f0f0'; c.font = 'bold 50px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', 32, 35); } },
    horizon: { t: '太阳与地平线', draw: (c) => { c.fillStyle = '#b0b0b0'; c.fillRect(0, 0, N, 38); c.fillStyle = '#303030'; c.fillRect(0, 38, N, 26); c.fillStyle = '#fafafa'; c.beginPath(); c.arc(44, 18, 8, 0, 7); c.fill(); } },
  };
  const sketchCache = {};
  function sketch(name) {
    if (sketchCache[name]) return sketchCache[name];
    SK[name].draw(octx);
    const px = octx.getImageData(0, 0, N, N).data, x = new Float64Array(NN);
    for (let i = 0; i < NN; i++) x[i] = ((px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3 / 255 - 0.5) * 1.8;
    const X = dct2(x);
    return (sketchCache[name] = { x, X });
  }
  // realism: per octave band, ratio of power to prior power; average |log2 ratio|
  const BANDS = [[2, 4], [4, 8], [8, 16], [16, 32], [32, 46]];
  const bandOf = new Int8Array(NN).map((_, i) => BANDS.findIndex(([lo, hi]) => KF[i] >= lo && KF[i] < hi));
  const bandCount = BANDS.map((_, b) => bandOf.filter((x) => x === b).length);
  function realism(X) {
    const s = BANDS.map(() => 0);
    for (let i = 0; i < NN; i++) if (bandOf[i] >= 0) s[bandOf[i]] += (X[i] * X[i]) / P[i];
    let d = 0; for (let b = 0; b < BANDS.length; b++) d += Math.abs(Math.log2(s[b] / bandCount[b] + 1e-9));
    return d / BANDS.length;
  }
  const rmse = (X, Y) => { let d = 0; for (let i = 0; i < NN; i++) d += (X[i] - Y[i]) ** 2; return Math.sqrt(d / NN); };
  const lam = (s, p) => { const a = 1 - s, b = s; return b === 0 ? 1 : (a * a * p) / (a * a * p + b * b); };
  // exact SDEdit sample in the DCT domain. returns {Xs, X0}
  function sdedit(Xin, s, r) {
    const a = 1 - s, b = s, Xs = new Float64Array(NN), X0 = new Float64Array(NN);
    for (let i = 0; i < NN; i++) {
      Xs[i] = a * Xin[i] + b * A.gauss(r);
      const l = lam(s, P[i]);
      X0[i] = (a > 0 ? (l * Xs[i]) / a : 0) + Math.sqrt((1 - l) * P[i]) * A.gauss(r);
    }
    return { Xs, X0 };
  }
  // ---- UI
  let sk = 'shapes', seed = 1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const S = A.slider(ctl, { label: '强度 s（加噪到 t = s，再去噪）', min: 0, max: 1, step: 0.01, value: 0.35, fmt: (v) => v.toFixed(2), on: () => render(), width: 240 });
  A.seg(ctl, Object.entries(SK).map(([v, o]) => ({ v, t: o.t })), sk, (v) => { sk = v; curve = null; render(); }, '草图');
  ctl.append(A.el('button', { class: 'primary', onclick: () => { seed++; render(); } }, '换随机种子'));
  const row = A.el('div', { class: 'imgrow', style: { margin: '6px 0 4px' } });
  const mk = (lab) => { const c = A.el('canvas', { class: 'pixel' }); c.width = c.height = N; row.append(A.el('figure', null, c, lab)); return c; };
  const cvIn = mk('草图（输入）'), cvXs = mk('加噪后的起点'), cvOut = [mk('结果 1'), mk('结果 2'), mk('结果 3')], cvReal = mk('一张“真实图像”');
  bd.append(row);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' }); bd.append(grid);
  const cvL = A.el('canvas', { class: 'cv' }), cvR = A.el('canvas', { class: 'cv' });
  grid.append(A.el('div', null, A.el('div', { class: 'small', style: { fontWeight: 600 } }, '每个尺度保留多少草图：λ(k)'), cvL),
    A.el('div', null, A.el('div', { class: 'small', style: { fontWeight: 600 } }, '权衡曲线：s 从 0 走到 1'), cvR));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  function paint(cv, x) {
    const ctx = cv.getContext('2d'), id = ctx.createImageData(N, N);
    for (let i = 0; i < NN; i++) { const g = A.clamp(((x[i] / 1.8) + 0.5) * 255, 0, 255); id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = g; id.data[i * 4 + 3] = 255; }
    ctx.putImageData(id, 0, 0);
  }
  // trade-off curve: exact expected values (Gaussian posterior per coefficient), cached per sketch
  // E(X0−Xin)² = (1−λ)²Xin² + (1−λ²)P ;  E X0² = λ²Xin² + (1−λ²)P
  function expected(X, s) {
    let mse = 0; const bs = BANDS.map(() => 0);
    for (let i = 0; i < NN; i++) {
      const l = lam(s, P[i]), x2 = X[i] * X[i];
      mse += (1 - l) * (1 - l) * x2 + (1 - l * l) * P[i];
      if (bandOf[i] >= 0) bs[bandOf[i]] += (l * l * x2 + (1 - l * l) * P[i]) / P[i];
    }
    let d = 0; for (let b = 0; b < BANDS.length; b++) d += Math.abs(Math.log2(bs[b] / bandCount[b]));
    return { s, f: Math.sqrt(mse / NN), d: d / BANDS.length };
  }
  const SV = Array.from({ length: 101 }, (_, i) => i / 100);
  let curve = null;
  function getCurve() {
    if (curve) return curve;
    const { X } = sketch(sk);
    return (curve = SV.map((s) => expected(X, s)));
  }
  const kc = (s) => { if (s <= 0) return Infinity; if (s >= 1) return 0; const q = PC * ((1 - s) / s) ** 2 - 1; return q > 0 ? Math.sqrt(q) : 0; };
  const kmin = 0.5, kmax = 45;
  let hoverL = null, hoverR = null;
  const viewL = A.canvas(cvL, { aspect: 0.62 }, (ctx, W, H) => {
    const box = { x: 44, y: 26, w: W - 58, h: H - 66 };
    const ax = A.axes(ctx, box, { xmin: kmin, xmax: kmax, xlog: true, xticks: [0.5, 1, 2, 4, 8, 16, 32], xfmt: (v) => String(v), ymin: 0, ymax: 1, yticks: [0, 0.5, 1], yfmt: (v) => v.toFixed(1), xlabel: '空间频率 k（每幅图多少个周期，对数）', ylabel: '保留比例 λ', ylabelOffset: 36 });
    const s = S.value;
    [0.2, 0.4, 0.6, 0.8].forEach((s2) => { ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); for (let i = 0; i <= 120; i++) { const k = kmin * Math.pow(kmax / kmin, i / 120), y = ax.Y(lam(s2, Pk(k))); i ? ctx.lineTo(ax.X(k), y) : ctx.moveTo(ax.X(k), y); } ctx.stroke(); ctx.setLineDash([]); });
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 160; i++) { const k = kmin * Math.pow(kmax / kmin, i / 160), y = ax.Y(lam(s, Pk(k))); i ? ctx.lineTo(ax.X(k), y) : ctx.moveTo(ax.X(k), y); }
    ctx.stroke();
    const c = kc(s);
    if (c > kmin && c < kmax) {
      const x = ax.X(c);
      ctx.save(); ctx.strokeStyle = cols[1]; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
      A.text(ctx, '截止 ≈ ' + c.toFixed(1), x + 4, box.y + 8, { size: 11.5, color: cols[1], weight: 600 });
      if (x - box.x > 70) A.text(ctx, '← 照抄草图', x - 6, ax.Y(0.62), { size: 11.5, align: 'right', color: A.css('--ink-2') });
      if (box.x + box.w - x > 80) A.text(ctx, '按先验重画 →', x + 6, ax.Y(0.62), { size: 11.5, color: A.css('--ink-2') });
    }
    A.text(ctx, '虚线：s = 0.2 / 0.4 / 0.6 / 0.8', box.x + box.w, box.y - 8, { size: 11, align: 'right', color: A.css('--muted'), base: 'bottom' });
    if (hoverL) { const k = A.clamp(ax.invX(hoverL.x), kmin, kmax); const y = ax.Y(lam(s, Pk(k))); ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(k), y, 4.5, 0, 7); ctx.fill(); }
    viewL.ax = ax;
  });
  const viewR = A.canvas(cvR, { aspect: 0.62 }, (ctx, W, H) => {
    const cu = getCurve();
    const fmax = Math.max(...cu.map((p) => p.f)) * 1.08, dmax = Math.max(...cu.map((p) => p.d)) * 1.1;
    const box = { x: 44, y: 26, w: W - 58, h: H - 66 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: fmax, ymin: 0, ymax: dmax, xfmt: (v) => v.toFixed(1), yfmt: (v) => v.toFixed(1), xlabel: '偏离草图（RMSE，越小越忠实）', ylabel: '不像真图（统计差距，越小越逼真）', ylabelOffset: 36 });
    ctx.strokeStyle = cols[2]; ctx.lineWidth = 2.5; ctx.beginPath();
    cu.forEach((p, i) => { const x = ax.X(p.f), y = ax.Y(p.d); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    [0, 20, 40, 60, 100].forEach((i) => { const p = cu[i], x = ax.X(p.f), y = ax.Y(p.d); ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); A.text(ctx, 's=' + p.s.toFixed(1), i === 100 ? x - 4 : x + 6, y - 10, { size: 11, align: i === 100 ? 'right' : 'left', color: A.css('--ink-2') }); });
    const s = S.value, p = expected(sketch(sk).X, s), px = ax.X(p.f), py = ax.Y(p.d);
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 7); ctx.fill();
    const up = py > box.y + box.h * 0.35;
    A.text(ctx, '当前 s = ' + s.toFixed(2), px + (px > box.x + box.w * 0.7 ? -10 : 10), up ? py - 24 : py + 16, { size: 12, weight: 700, color: cols[1], align: px > box.x + box.w * 0.7 ? 'right' : 'left' });
    A.text(ctx, '期望值，按高斯后验解析计算', box.x + box.w, box.y - 8, { size: 11, align: 'right', color: A.css('--muted'), base: 'bottom' });
    viewR.ax = ax; viewR.cu = cu;
  });
  cvL.addEventListener('pointermove', (e) => { const p = A.pos(cvL, e); hoverL = p; viewL.redraw(); if (!viewL.ax) return; const k = A.clamp(viewL.ax.invX(p.x), kmin, kmax); A.tip.show(`频率 k = ${k.toFixed(1)} 周期 / 图<br>保留比例 λ = ${lam(S.value, Pk(k)).toFixed(2)}<br><span class="muted">λ 接近 1：照抄草图；接近 0：重新生成</span>`, e.clientX, e.clientY); });
  cvL.addEventListener('pointerleave', () => { hoverL = null; A.tip.hide(); viewL.redraw(); });
  cvR.addEventListener('pointermove', (e) => { if (!viewR.ax) return; const p = A.pos(cvR, e); let best = null, bd2 = 1e9; viewR.cu.forEach((q) => { const d = (viewR.ax.X(q.f) - p.x) ** 2 + (viewR.ax.Y(q.d) - p.y) ** 2; if (d < bd2) { bd2 = d; best = q; } }); if (best && bd2 < 400) A.tip.show(`s = ${best.s.toFixed(2)}<br>偏离草图 ${best.f.toFixed(2)} · 不像真图 ${best.d.toFixed(2)}<br><span class="muted">点击跳到这个强度</span>`, e.clientX, e.clientY); else A.tip.hide(); });
  cvR.addEventListener('pointerleave', () => A.tip.hide());
  cvR.addEventListener('click', (e) => { if (!viewR.ax) return; const p = A.pos(cvR, e); let best = null, bd2 = 1e9; viewR.cu.forEach((q) => { const d = (viewR.ax.X(q.f) - p.x) ** 2 + (viewR.ax.Y(q.d) - p.y) ** 2; if (d < bd2) { bd2 = d; best = q; } }); if (best) { S.value = best.s; render(); } });
  function render() {
    const s = S.value, { x, X } = sketch(sk);
    paint(cvIn, x);
    const r = A.rng(seed * 7919);
    let f = 0, d = 0;
    cvOut.forEach((cv, i) => { const o = sdedit(X, s, r); if (i === 0) paint(cvXs, idct2(o.Xs)); paint(cv, idct2(o.X0)); f += rmse(o.X0, X); d += realism(o.X0); });
    const rr = A.rng(seed * 31 + 5), Z = new Float64Array(NN); for (let i = 0; i < NN; i++) Z[i] = Math.sqrt(P[i]) * A.gauss(rr);
    paint(cvReal, idct2(Z));
    const c = kc(s);
    stats.innerHTML = '';
    [['截止频率（λ = 0.5）', s <= 0 ? '无（不加噪）' : c < kmin ? '&lt; 0.5 周期：全部重画' : c.toFixed(1) + ' 周期 / 图'],
      ['2 个周期（大色块）的保留比例', lam(s, Pk(2)).toFixed(2)], ['16 个周期（笔画、纹理）的保留比例', lam(s, Pk(16)).toFixed(2)],
      ['偏离草图（3 个结果平均）', (f / 3).toFixed(2)], ['不像真图', (d / 3).toFixed(2) + `<small>　草图 ${realism(X).toFixed(2)} · 真图 ≈ ${realism(Z).toFixed(2)}</small>`]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' }, html: v }))));
    hint.innerHTML = s < 0.15
      ? '强度很小：只有最细的纹理被噪声淹没、重新生成，草图的平涂色块和硬边几乎原样保留。结果“忠实”，但一眼能看出是草图：真实图像在每个尺度上都有细节，草图没有。'
      : s < 0.5
        ? '中等强度：截止频率之上（笔画边缘、纹理）按“真实图像”的统计重画，截止之下（大色块的位置和明暗）从草图抄过来。草图的构图保住了，质感变得像真图。字母 A 这样的细笔画比圆盘更早被抹掉：它的信息集中在更高的频率上。'
        : s < 0.85
          ? '强度很大：连大色块的尺度也被噪声淹没，只剩最粗的明暗布局。三个结果彼此差别很大，和草图越来越不像，但统计上已经和真实图像一样。'
          : '强度接近 1：起点几乎是纯噪声，草图的信息只剩一个整体亮度，等于从头生成。右图里的点走到了权衡曲线的右下端。';
    viewL.redraw(); viewR.redraw();
  }
  render();
});
