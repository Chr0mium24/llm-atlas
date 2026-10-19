/* scaling-fit — fit a power law on small runs, extrapolate to a big run; with vs without irreducible loss E */
A.defineDemo('scaling-fit', function (mount) {
  const { bd } = A.demo(mount, '用小模型预测大模型：拟合幂律再外推', '“真实”规律为 L(C) = 1.8 + 3.0·(C/10¹⁸)^−0.12；小规模实验带 ±1.5% 噪声');
  const E0 = 1.8, K0 = 3.0, A0 = 0.12;
  const truth = (C) => E0 + K0 * Math.pow(C / 1e18, -A0);
  const TARGET = 1e25;
  let fitMax = 1e21, nRuns = 12, seed = 3, mode = 'withE';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'withE', t: '拟合 E + K·C^−α（含不可约损失）' }, { v: 'pure', t: '拟合纯幂律 K·C^−α' }], mode, (v) => { mode = v; draw(); }, '拟合形式');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.slider(ctl2, { label: '小规模实验的最大算力', min: 1e19, max: 1e23, log: true, value: fitMax, fmt: (v) => A.sci(v) + ' FLOPs', on: (v) => { fitMax = v; draw(); }, width: 240 });
  A.slider(ctl2, { label: '实验次数', min: 4, max: 24, step: 1, value: nRuns, fmt: (v) => v, on: (v) => { nRuns = v; draw(); }, width: 150 });
  ctl2.append(A.el('button', { onclick: () => { seed = (seed * 16807) % 2147483647; draw(); } }, '换一组噪声'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  let pts = [], fit = null;
  function runs() {
    const r = A.rng(seed); const out = [];
    for (let i = 0; i < nRuns; i++) {
      const lc = 18 + (Math.log10(fitMax) - 18) * (nRuns === 1 ? 1 : i / (nRuns - 1));
      const C = Math.pow(10, lc);
      out.push({ C, L: truth(C) * (1 + 0.015 * (r() * 2 - 1)) });
    }
    return out;
  }
  function linfit(xs, ys) {
    const n = xs.length, mx = A.sum(xs) / n, my = A.sum(ys) / n;
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
    const b = sxy / sxx, a = my - b * mx;
    const sse = A.sum(xs.map((x, i) => Math.pow(ys[i] - (a + b * x), 2)));
    return { a, b, sse };
  }
  function doFit(p, m) {
    const xs = p.map((q) => Math.log10(q.C));
    if (m === 'pure') { const f = linfit(xs, p.map((q) => Math.log10(q.L))); return { E: 0, K: Math.pow(10, f.a), al: -f.b, pred: (C) => Math.pow(10, f.a + f.b * Math.log10(C)) }; }
    const minL = Math.min(...p.map((q) => q.L));
    let best = null;
    for (let i = 0; i <= 400; i++) {
      const E = (minL - 0.02) * i / 400;
      const f = linfit(xs, p.map((q) => Math.log10(q.L - E)));
      const sse = A.sum(p.map((q, j) => Math.pow(q.L - (E + Math.pow(10, f.a + f.b * xs[j])), 2)));
      if (!best || sse < best.sse) best = { E, f, sse };
    }
    const { E, f } = best;
    return { E, K: Math.pow(10, f.a), al: -f.b, pred: (C) => E + Math.pow(10, f.a + f.b * Math.log10(C)) };
  }
  const cols = A.series();
  const view = A.canvas(cv, { aspect: 0.5 }, (ctx, W, H) => {
    const box = { x: 54, y: 18, w: W - 76, h: H - 58 };
    const ax = A.axes(ctx, box, { xmin: 1e18, xmax: 1e26, xlog: true, ymin: 1.5, ymax: 5.5, ylog: true, yticks: [1.5, 2, 2.5, 3, 4, 5], yfmt: (v) => v.toFixed(1), xfmt: (v) => '10' + String(Math.round(Math.log10(v))).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]), xlabel: '训练算力 C（FLOPs）', ylabel: '损失 L（对数坐标）', ylabelOffset: 46, xgrid: true });
    ctx.fillStyle = A.alpha(cols[0], 0.07); ctx.fillRect(box.x, box.y, ax.X(fitMax) - box.x, box.h);
    A.text(ctx, '可以负担的小规模实验', box.x + 6, box.y + 10, { size: 11.5, color: A.css('--muted') });
    const line = (fn, color, w, dash) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); for (let i = 0; i <= 200; i++) { const C = Math.pow(10, 18 + 8 * i / 200); const y = ax.Y(A.clamp(fn(C), 1.5, 5.5)); i ? ctx.lineTo(ax.X(C), y) : ctx.moveTo(ax.X(C), y); } ctx.stroke(); ctx.restore(); };
    line(truth, A.css('--axis'), 2, [5, 4]);
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(E0)); ctx.lineTo(box.x + box.w, ax.Y(E0)); ctx.stroke(); ctx.restore();
    A.text(ctx, '不可约损失 E = 1.8', box.x + box.w - 4, ax.Y(E0) - 9, { size: 11.5, align: 'right', color: A.css('--muted') });
    line(fit.pred, cols[mode === 'pure' ? 1 : 0], 2.5);
    pts.forEach((q) => { ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(ax.X(q.C), ax.Y(q.L), 3.5, 0, 7); ctx.fill(); });
    const xt = ax.X(TARGET);
    ctx.strokeStyle = A.css('--ink'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xt, box.y); ctx.lineTo(xt, box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = A.css('--muted'); ctx.beginPath(); ctx.arc(xt, ax.Y(truth(TARGET)), 6, 0, 7); ctx.fill();
    ctx.fillStyle = cols[mode === 'pure' ? 1 : 0]; ctx.beginPath(); ctx.arc(xt, ax.Y(A.clamp(fit.pred(TARGET), 1.5, 5.5)), 6, 0, 7); ctx.fill();
    A.text(ctx, '目标：10²⁵ 的大模型', xt + 6, box.y + 10, { size: 11.5, color: A.css('--ink-2') });
  });
  function draw() {
    pts = runs(); fit = doFit(pts, mode);
    const pT = fit.pred(TARGET), tT = truth(TARGET);
    const err = (pT - tT) / (tT - E0);
    stats.innerHTML = '';
    [['拟合出的 α', fit.al.toFixed(3) + '（真实 0.12）'], ['拟合出的 E', mode === 'pure' ? '（假设为 0）' : fit.E.toFixed(2) + '（真实 1.80）'], ['10²⁵ 处的预测 / 真实', pT.toFixed(3) + ' / ' + tT.toFixed(3)], ['预测误差（占可约部分）', (err >= 0 ? '+' : '') + A.pct(err, 0)], ['外推跨度', (Math.log10(TARGET / fitMax)).toFixed(1) + ' 个数量级']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = mode === 'pure'
      ? '纯幂律在双对数坐标里是直线，但真实损失有一个下限 E（数据本身的熵），曲线在大算力处会“弯平”。忽略 E 的拟合在小规模上看起来很好，外推时却会系统性地<b>低估</b>大模型的损失（预测得过于乐观）。'
      : '包含不可约损失 E 的拟合能正确地描述“越往后越平”。即便如此，外推几个数量级时，噪声和拟合范围的选择仍会带来明显误差：把小规模实验的最大算力往右拉，误差迅速变小。GPT-4 的技术报告称，它用不到其万分之一算力的小模型预测了最终损失。';
    view.redraw();
  }
  draw();
});
