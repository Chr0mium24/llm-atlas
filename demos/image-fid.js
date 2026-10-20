/* image-fid — FID as the Fréchet (Wasserstein-2) distance between two Gaussians fitted to features.
   Toy 2-D "feature space": real features = 3 clusters. Shows what FID sees (mean, covariance), what it misses
   (shape beyond 2nd moments), and its finite-sample bias (≈ 1/N). All numbers are computed exactly or by sampling. */
A.defineDemo('image-fid', function (mount) {
  const { bd } = A.demo(mount, 'FID：只看均值和协方差的距离',
    '玩具：二维“特征空间”。真实图像的特征分成三团（三类图）；生成模型按你选的方式出错。FID 先给两边各拟合一个高斯，再算两个高斯之间的距离');
  const RS = 0.35;
  const REAL = [{ w: 1 / 3, m: [-1.2, -0.6], s: RS }, { w: 1 / 3, m: [1.2, -0.6], s: RS }, { w: 1 / 3, m: [0, 1.1], s: RS }];
  function moments(G) {
    if (G.gauss) return [G.mu, G.S];
    const mu = [0, 0]; G.forEach((c) => { mu[0] += c.w * c.m[0]; mu[1] += c.w * c.m[1]; });
    const S = [[0, 0], [0, 0]];
    G.forEach((c) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S[i][j] += c.w * ((i === j ? c.s * c.s : 0) + c.m[i] * c.m[j]); });
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S[i][j] -= mu[i] * mu[j];
    return [mu, S];
  }
  const MR = moments(REAL);
  const OPTS = {
    same: { t: '完美复刻', g: REAL, say: '生成分布和真实分布完全相同，总体 FID = 0。但用有限的样本算，FID 永远大于 0：两边的样本均值和协方差各有抽样误差。样本越少，这个“底噪”越大，大约按 1/N 下降（右图）。' },
    drop: { t: '丢掉一类', g: [{ w: 0.5, m: [-1.2, -0.6], s: RS }, { w: 0.5, m: [1.2, -0.6], s: RS }], say: '模式丢失：上面那一类图完全生成不出来。均值被拉低、协方差在纵向变小，均值项和协方差项都明显变大。这是 FID 最擅长发现的错误。' },
    narrow: { t: '每类都收缩', g: REAL.map((c) => ({ w: c.w, m: c.m, s: 0.12 })), say: '每一类内部的多样性都丢了（像 CFG 开得太大：每类只会画最典型的那张），但三类都在。FID 只上升了一点：在这个二维特征里，总协方差主要由“三类之间的距离”决定，类内的收缩只占小头。FID 把“多样性”和“像不像”压成了一个数，分不清是哪种错。' },
    shift: { t: '整体平移', g: REAL.map((c) => ({ w: c.w, m: [c.m[0] + 0.35, c.m[1]], s: c.s })), say: '每张图都带同样的系统偏差（比如整体偏色）。形状完全对，只有均值项不为 0：它等于两个均值之差的平方 0.35² ≈ 0.12。' },
    gauss: { t: '同均值、同协方差的一团', g: { gauss: true, mu: MR[0], S: MR[1] }, say: '生成的特征是一整团高斯，和真实的三团毫无相似之处，但均值和协方差与真实分布完全相等，总体 FID 恰好为 0。FID 只用前两阶矩，任何二阶矩以外的差别它都看不见。' },
  };
  function chol(S) { const a = Math.sqrt(S[0][0]), b = S[1][0] / a, c = Math.sqrt(Math.max(1e-12, S[1][1] - b * b)); return [[a, 0], [b, c]]; }
  function sample(G, n, r) {
    const X = new Array(n);
    if (G.gauss) { const L = chol(G.S); for (let i = 0; i < n; i++) { const z0 = A.gauss(r), z1 = A.gauss(r); X[i] = [G.mu[0] + L[0][0] * z0, G.mu[1] + L[1][0] * z0 + L[1][1] * z1]; } return X; }
    for (let i = 0; i < n; i++) { let u = r(), k = 0; for (; k < G.length - 1; k++) { u -= G[k].w; if (u <= 0) break; } const c = G[k]; X[i] = [c.m[0] + c.s * A.gauss(r), c.m[1] + c.s * A.gauss(r)]; }
    return X;
  }
  function emp(X) {
    const n = X.length, mu = [0, 0]; X.forEach((x) => { mu[0] += x[0] / n; mu[1] += x[1] / n; });
    const S = [[0, 0], [0, 0]]; X.forEach((x) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S[i][j] += ((x[i] - mu[i]) * (x[j] - mu[j])) / (n - 1); });
    return [mu, S];
  }
  // FID between two Gaussians; in 2-D: Tr sqrt(S1 S2) = sqrt(Tr(S1 S2) + 2 sqrt(det S1 det S2))
  function fid([m1, S1], [m2, S2]) {
    const dm = (m1[0] - m2[0]) ** 2 + (m1[1] - m2[1]) ** 2;
    const trP = S1[0][0] * S2[0][0] + S1[0][1] * S2[1][0] + S1[1][0] * S2[0][1] + S1[1][1] * S2[1][1];
    const det = (S) => S[0][0] * S[1][1] - S[0][1] * S[1][0];
    const trs = Math.sqrt(Math.max(0, trP + 2 * Math.sqrt(Math.max(0, det(S1) * det(S2)))));
    const cov = S1[0][0] + S1[1][1] + S2[0][0] + S2[1][1] - 2 * trs;
    return { all: dm + Math.max(0, cov), mean: dm, cov: Math.max(0, cov) };
  }
  // ---- UI
  let opt = 'gauss', lgN = Math.log10(2000), seed = 1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, Object.entries(OPTS).map(([v, o]) => ({ v, t: o.t })), opt, (v) => { opt = v; curve = null; draw(); }, '生成模型怎样出错');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.slider(ctl2, { label: '每边的样本数 N', min: 1, max: 4, step: 0.05, value: lgN, fmt: (v) => A.human(Math.round(Math.pow(10, v))) + ' 张', on: (v) => { lgN = v; draw(); }, width: 240 });
  ctl2.append(A.el('button', { class: 'primary', onclick: () => { seed++; draw(); } }, '重新抽样'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' }); bd.append(grid);
  const cvL = A.el('canvas', { class: 'cv' }), cvR = A.el('canvas', { class: 'cv' });
  grid.append(A.el('div', null, A.el('div', { class: 'small', style: { fontWeight: 600 } }, '特征空间：样本与拟合出的高斯（2σ 椭圆）'), cvL),
    A.el('div', null, A.el('div', { class: 'small', style: { fontWeight: 600 } }, 'FID 随样本数的变化（30 次重复的均值 ± 1 标准差）'), cvR));
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--s1);border-radius:50%"></i>真实图像的特征</span><span><i style="background:var(--s2);border-radius:50%"></i>生成图像的特征</span><span><i class="line" style="background:var(--muted)"></i>拟合的高斯（2σ 椭圆，十字为均值）</span>' }));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  let cur = null, curve = null, hoverR = null;
  const NS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  function getCurve() {
    if (curve) return curve;
    const G = OPTS[opt].g, r = A.rng(4242);
    curve = NS.map((n) => { const R = 30, v = []; for (let t = 0; t < R; t++) v.push(fid(emp(sample(REAL, n, r)), emp(sample(G, n, r))).all); const m = A.mean(v); return { n, m, sd: Math.sqrt(A.mean(v.map((x) => (x - m) ** 2))) }; });
    return curve;
  }
  function ellipse(ctx, ax, [mu, S], color) {
    const a = S[0][0], b = S[0][1], d = S[1][1], tr = a + d, det = a * d - b * b;
    const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const th = Math.abs(b) < 1e-12 ? (a >= d ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
    for (let i = 0; i <= 80; i++) { const u = (i / 80) * 2 * Math.PI, ex = 2 * Math.sqrt(l1) * Math.cos(u), ey = 2 * Math.sqrt(Math.max(0, l2)) * Math.sin(u); const x = mu[0] + ex * Math.cos(th) - ey * Math.sin(th), y = mu[1] + ex * Math.sin(th) + ey * Math.cos(th); i ? ctx.lineTo(ax.X(x), ax.Y(y)) : ctx.moveTo(ax.X(x), ax.Y(y)); }
    ctx.stroke(); ctx.setLineDash([]);
    const cx = ax.X(mu[0]), cy = ax.Y(mu[1]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 7, cy); ctx.lineTo(cx + 7, cy); ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7); ctx.stroke();
    ctx.restore();
  }
  const viewL = A.canvas(cvL, { aspect: 0.8 }, (ctx, W, H) => {
    if (!cur) return;
    const box = { x: 30, y: 12, w: W - 42, h: H - 40 };
    const span = 3.2, asp = box.h / box.w;
    const ax = A.axes(ctx, box, { xmin: -span, xmax: span, ymin: -span * asp + 0.2, ymax: span * asp + 0.2, nx: 6, ny: 5, xfmt: (v) => v.toFixed(0), yfmt: (v) => v.toFixed(0) });
    const dot = (X, c) => { ctx.fillStyle = A.alpha(c, 0.45); const m = Math.min(X.length, 1500); for (let i = 0; i < m; i++) { ctx.beginPath(); ctx.arc(ax.X(X[i][0]), ax.Y(X[i][1]), 2.2, 0, 7); ctx.fill(); } };
    dot(cur.XG, cols[1]); dot(cur.XR, cols[0]);
    ellipse(ctx, ax, cur.eR, cols[0]); ellipse(ctx, ax, cur.eG, cols[1]);
    if (cur.XR.length > 1500) A.text(ctx, '只画出前 1500 个点', box.x + box.w - 4, box.y + 6, { size: 11, align: 'right', color: A.css('--muted') });
  });
  const viewR = A.canvas(cvR, { aspect: 0.8 }, (ctx, W, H) => {
    const cu = getCurve(), pop = fid(MR, moments(OPTS[opt].g)).all;
    const ymax = Math.max(0.3, ...cu.map((p) => p.m + p.sd)) * 1.05;
    const box = { x: 46, y: 26, w: W - 60, h: H - 64 };
    const ax = A.axes(ctx, box, { xmin: 10, xmax: 10000, xlog: true, xfmt: (v) => A.human(v), ymin: 0, ymax, yfmt: (v) => v.toFixed(2), xlabel: '每边样本数 N（对数）', ylabel: 'FID', ylabelOffset: 38 });
    ctx.fillStyle = A.alpha(cols[1], 0.18); ctx.beginPath();
    cu.forEach((p, i) => { const x = ax.X(p.n), y = ax.Y(Math.min(ymax, p.m + p.sd)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = cu.length - 1; i >= 0; i--) { const p = cu[i]; ctx.lineTo(ax.X(p.n), ax.Y(Math.max(0, p.m - p.sd))); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.5; ctx.beginPath(); cu.forEach((p, i) => { const x = ax.X(p.n), y = ax.Y(p.m); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.save(); ctx.strokeStyle = A.css('--ink-2'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(box.x, ax.Y(pop)); ctx.lineTo(box.x + box.w, ax.Y(pop)); ctx.stroke(); ctx.restore();
    { const lab = '虚线：总体 FID（N → ∞）= ' + pop.toFixed(3); if (pop > ymax * 0.12) A.text(ctx, lab, box.x + box.w - 4, ax.Y(pop) + 12, { size: 11.5, align: 'right', color: A.css('--ink-2') }); else A.text(ctx, lab, box.x + 6, ax.Y(pop) - 9, { size: 11.5, color: A.css('--ink-2') }); }
    if (cur) { ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(cur.n), ax.Y(Math.min(ymax, cur.f.all)), 6, 0, 7); ctx.fill(); { const px = ax.X(cur.n), py = ax.Y(Math.min(ymax, cur.f.all)), right = px > box.x + box.w * 0.75; A.text(ctx, '这次抽样', px + (right ? -8 : 8), py - 22, { size: 11.5, weight: 700, color: cols[0], align: right ? 'right' : 'left' }); } }
    if (hoverR) { const p = hoverR; ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(ax.X(p.n), box.y); ctx.lineTo(ax.X(p.n), box.y + box.h); ctx.stroke(); }
    viewR.ax = ax; viewR.cu = cu;
  });
  cvR.addEventListener('pointermove', (e) => {
    if (!viewR.ax) return; const p = A.pos(cvR, e); const n = viewR.ax.invX(p.x);
    let best = viewR.cu[0]; viewR.cu.forEach((q) => { if (Math.abs(Math.log(q.n / n)) < Math.abs(Math.log(best.n / n))) best = q; });
    hoverR = best; viewR.redraw();
    A.tip.show(`N = ${A.human(best.n)}<br>FID 均值 ${best.m.toFixed(3)} ± ${best.sd.toFixed(3)}`, e.clientX, e.clientY);
  });
  cvR.addEventListener('pointerleave', () => { hoverR = null; A.tip.hide(); viewR.redraw(); });
  function draw() {
    const n = Math.round(Math.pow(10, lgN)), r = A.rng(seed * 104729 + n);
    const XR = sample(REAL, n, r), XG = sample(OPTS[opt].g, n, r), eR = emp(XR), eG = emp(XG);
    cur = { n, XR, XG, eR, eG, f: fid(eR, eG) };
    const pop = fid(MR, moments(OPTS[opt].g));
    stats.innerHTML = '';
    [['这次抽样的 FID', cur.f.all.toFixed(3)], ['其中 均值项 ‖μᵣ − μ_g‖²', cur.f.mean.toFixed(3)], ['协方差项', cur.f.cov.toFixed(3)], ['总体 FID（无穷多样本）', pop.all.toFixed(3)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = OPTS[opt].say + (n < 200 && opt !== 'same' ? '　<b>注意样本数：</b>N 这么小时，抽样误差本身就和“错误”造成的 FID 差不多大，切到“完美复刻”对比一下。' : '');
    viewL.redraw(); viewR.redraw();
  }
  draw();
});
