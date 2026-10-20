/* scaling-fit — five toy runs (1M…256M params, data unlimited), fit a power law three ways, extrapolate; measurement noise → 80% error band over 300 redraws */
A.defineDemo('scaling-fit', function (mount) {
  const { bd } = A.demo(mount, '五次小训练：拟合、外推，误差有多大', '“真实”规律取 L(N) = 1.82 + 482·N^−0.348（2024 年复现的 Chinchilla 拟合在数据充足时的形式）；每次测量带一点随机噪声');
  const E0 = 1.82, A0 = 482.01, a0 = 0.3478;
  const truth = (N) => E0 + A0 * Math.pow(N, -a0);
  const NS = [1e6, 4e6, 16e6, 64e6, 256e6];
  const XS = NS.map(Math.log);
  let mode = 'withE', sig = 0.005, mult = 100, seed = 11;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'two', t: '最后两点连直线' }, { v: 'pure', t: '五点拟合直线（纯幂律）' }, { v: 'withE', t: '五点拟合 E + A·N^−α' }], mode, (v) => { mode = v; draw(); }, '拟合方法');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.slider(ctl2, { label: '每次测量的噪声（相对）', min: 0, max: 0.03, step: 0.001, value: sig, fmt: (v) => '±' + (v * 100).toFixed(1) + '%', on: (v) => { sig = v; draw(); }, width: 200 });
  A.slider(ctl2, { label: '外推到最大实验的多少倍', min: 4, max: 1000, log: true, value: mult, fmt: (v) => '×' + (v < 10 ? v.toFixed(1) : Math.round(v)) + '（' + A.human(256e6 * v, 1) + ' 参数）', on: (v) => { mult = v; draw(); }, width: 250 });
  ctl2.append(A.el('button', { onclick: () => { seed = (seed * 16807) % 2147483647; draw(); } }, '换一组噪声'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const cvH = A.el('canvas', { class: 'cv' }); bd.append(cvH);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const colOf = (m) => cols[m === 'withE' ? 0 : m === 'pure' ? 1 : 2];

  function linfit(xs, ys) {
    const n = xs.length, mx = A.sum(xs) / n, my = A.sum(ys) / n;
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
    const b = sxy / sxx; return { a: my - b * mx, b };
  }
  // returns {E, al, pred(N)}
  function fit(m, L) {
    if (m === 'two') { const al = Math.log(L[3] / L[4]) / Math.log(NS[4] / NS[3]); return { E: 0, al, pred: (N) => L[4] * Math.pow(N / NS[4], -al) }; }
    if (m === 'pure') { const f = linfit(XS, L.map(Math.log)); return { E: 0, al: -f.b, pred: (N) => Math.exp(f.a + f.b * Math.log(N)) }; }
    const minL = Math.min(...L); let best = null;
    for (let i = 0; i <= 240; i++) {
      const E = (minL - 0.004) * i / 240;
      const f = linfit(XS, L.map((l) => Math.log(l - E)));
      let sse = 0; for (let j = 0; j < 5; j++) { const d = L[j] - (E + Math.exp(f.a + f.b * XS[j])); sse += d * d; }
      if (!best || sse < best.sse) best = { E, f, sse };
    }
    const { E, f } = best;
    return { E, al: -f.b, pred: (N) => E + Math.exp(f.a + f.b * Math.log(N)) };
  }
  const draws = (r) => NS.map((N) => truth(N) * (1 + sig * A.gauss(r)));
  let pts = [], F = null, band = [], target = 0, q10 = 0, q90 = 0, finals = [];
  const BANDN = 40;
  function compute() {
    target = 256e6 * mult;
    pts = draws(A.rng(seed)); F = fit(mode, pts);
    const r = A.rng(seed * 7 + 3), grid = [];
    for (let k = 0; k <= BANDN; k++) grid.push(Math.exp(Math.log(256e6) + (Math.log(target) - Math.log(256e6)) * k / BANDN));
    const P = grid.map(() => []), PT = [];
    for (let s = 0; s < 300; s++) { const f = fit(mode, draws(r)); grid.forEach((N, k) => P[k].push(f.pred(N))); }
    const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
    band = grid.map((N, k) => [N, q(P[k], 0.1), q(P[k], 0.9)]);
    finals = P[BANDN].slice();
    q10 = band[BANDN][1]; q90 = band[BANDN][2];
  }
  const YMIN = 1.2, YMAX = 6.5;
  let AX = null, BOX = null;
  const view = A.canvas(cv, { get aspect() { return cv.clientWidth < 560 ? 0.85 : 0.52; } }, (ctx, W, H) => {
    const box = BOX = { x: 54, y: 24, w: W - 74, h: H - 62 };
    const ax = AX = A.axes(ctx, box, { xmin: 5e5, xmax: 1e12, xlog: true, ymin: YMIN, ymax: YMAX, ylog: true, yticks: [1.5, 2, 3, 4, 5, 6], yfmt: (v) => String(v), xticks: [1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12], xfmt: (v) => A.human(v, 0), xlabel: '参数量 N（对数坐标）', ylabel: '最终损失 L（对数坐标）', ylabelOffset: 46, xgrid: true });
    const cy = (v) => ax.Y(A.clamp(v, YMIN, YMAX));
    const c = colOf(mode);
    // band
    if (sig > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      ctx.fillStyle = A.alpha(c, 0.2); ctx.beginPath();
      band.forEach(([N, lo], i) => (i ? ctx.lineTo(ax.X(N), cy(lo)) : ctx.moveTo(ax.X(N), cy(lo))));
      for (let i = band.length - 1; i >= 0; i--) ctx.lineTo(ax.X(band[i][0]), cy(band[i][2]));
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const line = (fn, color, w, dash, n0, n1) => { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); for (let i = 0; i <= 160; i++) { const N = Math.exp(Math.log(n0) + (Math.log(n1) - Math.log(n0)) * i / 160); const y = cy(fn(N)); i ? ctx.lineTo(ax.X(N), y) : ctx.moveTo(ax.X(N), y); } ctx.stroke(); ctx.restore(); };
    line(truth, A.css('--axis'), 2, [5, 4], 5e5, 1e12);
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(E0)); ctx.lineTo(box.x + box.w, ax.Y(E0)); ctx.stroke(); ctx.restore();
    A.text(ctx, '不可约损失 E = 1.82', box.x + 6, ax.Y(E0) + 10, { size: 11.5, color: A.css('--muted') });
    line(F.pred, c, 2.5, null, 1e6, target);
    // experiment region
    ctx.fillStyle = A.alpha(cols[3], 0.08); ctx.fillRect(ax.X(7e5), box.y, ax.X(3.6e8) - ax.X(7e5), box.h);
    A.text(ctx, '五次小训练', ax.X(7e5) + 4, box.y + 22, { size: 11.5, color: A.css('--muted') });
    pts.forEach((L, i) => { ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(ax.X(NS[i]), cy(L), 4, 0, 7); ctx.fill(); });
    const xt = ax.X(target);
    ctx.save(); ctx.strokeStyle = A.css('--ink-2'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xt, box.y); ctx.lineTo(xt, box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, '目标 ' + A.human(target, 1), xt + (xt > box.x + box.w - 90 ? -6 : 6), box.y + 10, { size: 11.5, color: A.css('--ink-2'), align: xt > box.x + box.w - 90 ? 'right' : 'left' });
    ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xt, cy(truth(target)), 6, 0, 7); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(xt, cy(F.pred(target)), 5, 0, 7); ctx.fill();
  });
  // strip below: where the 300 extrapolations land at the target, vs truth and E
  const viewH = A.canvas(cvH, { get aspect() { return cvH.clientWidth < 560 ? 0.32 : 0.17; } }, (ctx, W, H) => {
    const box = { x: 54, y: 26, w: W - 74, h: H - 50 };
    const tT = truth(target), lo0 = Math.min(...finals), hi0 = Math.max(...finals);
    let lo = Math.min(lo0, E0 - 0.05, tT - 0.15), hi = Math.max(hi0, tT + 0.15);
    const pad = (hi - lo) * 0.05; lo -= pad; hi += pad;
    const ax = A.axes(ctx, box, { xmin: lo, xmax: hi, ymin: 0, ymax: 1.3, yticks: [], xfmt: (v) => v.toFixed(2), nx: 8, xlabel: '目标处的预测损失', ylabel: '目标 ' + A.human(target, 1) + ' 处，300 组噪声各外推一次', ylabelOffset: 46 });
    const nb = 48, cnt = new Array(nb).fill(0);
    finals.forEach((v) => { const i = Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * nb))); cnt[i]++; });
    const mx = Math.max(...cnt, 1), bw = box.w / nb, c = colOf(mode);
    cnt.forEach((n, i) => { if (n) A.bar(ctx, box.x + i * bw + 1, ax.Y(n / mx), Math.max(bw - 2, 1), ax.Y(0) - ax.Y(n / mx), A.alpha(c, 0.75), 2); });
    const vline = (x, color, dash, label, right) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(ax.X(x), box.y - 4); ctx.lineTo(ax.X(x), box.y + box.h); ctx.stroke(); ctx.restore(); A.text(ctx, label, ax.X(x) + (right ? -5 : 5), box.y + 4, { size: 11.5, color, align: right ? 'right' : 'left', weight: 600 }); };
    vline(E0, A.css('--axis'), [2, 3], 'E = 1.82', true);
    vline(tT, A.css('--ink'), [], '真实 ' + tT.toFixed(3), false);
  });
  cv.addEventListener('mousemove', (e) => {
    if (!AX) return; const p = A.pos(cv, e); let hit = null;
    pts.forEach((L, i) => { const dx = AX.X(NS[i]) - p.x, dy = AX.Y(A.clamp(L, YMIN, YMAX)) - p.y; if (dx * dx + dy * dy < 100) hit = `N = ${A.human(NS[i], 0)}：测得 ${L.toFixed(3)}（真实 ${truth(NS[i]).toFixed(3)}）`; });
    const xt = AX.X(target);
    if (!hit && Math.abs(p.x - xt) < 8) hit = `目标 ${A.human(target, 1)}：真实 ${truth(target).toFixed(3)}，这组噪声下预测 ${F.pred(target).toFixed(3)}；300 组噪声中 80% 的预测落在 ${q10.toFixed(3)} – ${q90.toFixed(3)}`;
    hit ? A.tip.show(hit, e.clientX, e.clientY) : A.tip.hide();
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    compute();
    const pT = F.pred(target), tT = truth(target), red = tT - E0;
    stats.innerHTML = '';
    [['拟合出的 α', F.al.toFixed(3) + '（真实 0.348）'], ['拟合出的 E', mode === 'withE' ? F.E.toFixed(2) + '（真实 1.82）' : '假设为 0'],
      ['目标处 预测 / 真实', pT.toFixed(3) + ' / ' + tT.toFixed(3)], ['误差占可约部分', (pT >= tT ? '+' : '') + A.pct((pT - tT) / red, 0)],
      ['80% 误差带宽度', sig > 0 ? (q90 - q10).toFixed(3) + '（可约部分的 ' + ((q90 - q10) / red).toFixed(1) + ' 倍）' : '0（无噪声）']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:var(--axis)"></i>真实规律（虚线）</span><span><i style="background:var(--ink);border-radius:50%"></i>五次测量</span><span><i class="line" style="background:${colOf(mode)}"></i>这组噪声下的拟合</span><span><i style="background:${A.alpha(colOf(mode), 0.35)}"></i>换 300 组噪声，80% 的外推落在带内</span><span><i style="border:2px solid var(--ink);background:none;border-radius:50%"></i>目标处的真实值</span>`;
    hint.innerHTML = {
      two: '只用最后两个点连一条直线：斜率 α 只有约 0.10，远小于真实的 0.35，因为曲线在弯，直线不会弯。外推时直线一路往下，在大规模处甚至穿过不可约损失 E 的虚线，这不可能发生。再把噪声调大：两个点的一点抖动，被外推距离放大成很宽的带子。',
      pure: '用全部五个点拟合一条直线（纯幂律），带子很窄，看起来很可靠，但整条带子都在真实值下方：形式错了，点再多也只是“稳定地错”。这就是不带 E 的幂律外推的隐患：它对大模型过于乐观。',
      withE: '加上不可约损失 E 之后，形式对了，预测的中心落在真实值附近；代价是带子比纯幂律宽得多，因为五个小模型很难同时分辨出 E 和 α。噪声调到 0，误差消失；噪声加大或目标拉远，带子迅速变宽。注意“误差占可约部分”：目标越大，剩下可降的部分越小，同样的绝对误差就是越大的相对误差。',
    }[mode];
    view.redraw(); viewH.redraw();
  }
  draw();
});
