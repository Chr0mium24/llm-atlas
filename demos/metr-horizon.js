/* metr-horizon — METR 50% time horizon (TH1.1 task set) on a log scale: fit a doubling time over a chosen window, extrapolate, and see how fragile extrapolation is. Time units are work time (8 h day, 40 h week, 167 h month), the same as the human baselines. */
A.defineDemo('metr-horizon', function (mount) {
  const { bd } = A.demo(mount, 'METR 时间跨度：智能体能完成多长的任务', '数据：METR TH1.1 的公开估计；直线是本演示自己的拟合。纵轴按工作时间：1 工作日 8 小时，1 工作周 40 小时，1 工作月 167 小时');
  // [name, release (decimal year), p50 in minutes, 95% CI low, high] — METR benchmark_results_1_1.yaml
  const D = [
    ['GPT-2', 2019.121, 0.054], ['GPT-3（davinci-002）', 2020.404, 0.144], ['GPT-3.5', 2022.2, 0.6], ['GPT-4', 2023.197, 3.99],
    ['GPT-4o', 2024.363, 6.99], ['o1-preview', 2024.697, 20.3], ['Claude 3.5 Sonnet（新）', 2024.806, 20.5], ['o1', 2024.926, 38.8],
    ['Claude 3.7 Sonnet', 2025.148, 60.4], ['o3', 2025.288, 119.7], ['GPT-5', 2025.597, 203], ['Claude Opus 4.5', 2025.896, 293],
    ['GPT-5.2', 2025.942, 352], ['Claude Opus 4.6', 2026.096, 719], ['Claude Mythos Preview', 2026.263, 1045, 509, 3304],
  ];
  const CAP = 16 * 60; // METR: estimates above 16 h are unreliable and are left out of the doubling-time fit
  const DAY = 8 * 60, WEEK = 40 * 60, MONTH = 167 * 60, YEAR = 2000 * 60;
  let from = 2019, target = 2027.5;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 2019, t: '全部（2019 年起）' }, { v: 2023, t: '2023 年以后' }, { v: 2024, t: '2024 年以后' }], from, (v) => { from = +v; draw(); }, '拟合用哪些点');
  A.slider(ctl, { label: '外推到', min: 2026.5, max: 2029, step: 0.25, value: target, fmt: (v) => Math.floor(v) + ' 年 ' + (Math.round((v % 1) * 12) + 1) + ' 月', on: (v) => { target = v; draw(); }, width: 200 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  let fit;
  function doFit() {
    const P = D.filter((d) => d[1] >= from && d[2] <= CAP);
    const xs = P.map((d) => d[1]), ys = P.map((d) => Math.log2(d[2]));
    const n = xs.length, mx = A.sum(xs) / n, my = A.sum(ys) / n;
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    const b = sxy / sxx, a = my - b * mx;
    return { a, b, n, pred: (t) => Math.pow(2, a + b * t), dbl: 12 / b, days: 365.25 / b };
  }
  const fmtT = (m) => (m < 1 ? Math.round(m * 60) + ' 秒' : m < 60 ? Math.round(m) + ' 分钟' : m < DAY ? (m / 60).toFixed(1) + ' 小时'
    : m < WEEK ? Math.round(m / 60) + ' 小时（约 ' + (m / DAY).toFixed(1) + ' 个工作日）' : m < MONTH ? '约 ' + (m / WEEK).toFixed(1) + ' 个工作周'
    : m < YEAR ? '约 ' + (m / MONTH).toFixed(1) + ' 个工作月' : '约 ' + (m / YEAR).toFixed(1) + ' 个工作年');
  const TICK = { [1 / 60]: '1 秒', 1: '1 分钟', 60: '1 小时', [DAY]: '1 工作日', [WEEK]: '1 工作周', [MONTH]: '1 工作月', [YEAR]: '1 工作年' };
  const view = A.canvas(cv, { aspect: 0.5 }, (ctx, W, H) => {
    const box = { x: 74, y: 16, w: W - 94, h: H - 54 };
    const ax = A.axes(ctx, box, { xmin: 2019, xmax: 2029, ymin: 1 / 60, ymax: YEAR, ylog: true, yticks: [1 / 60, 1, 60, DAY, WEEK, MONTH, YEAR], yfmt: (v) => TICK[v] || '', xfmt: (v) => v, xlabel: '模型发布时间' });
    const x0 = from, x1 = 2029, xe = 2026.3, clip = (y) => Math.min(y, YEAR);
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax.X(x0), ax.Y(fit.pred(x0))); ctx.lineTo(ax.X(xe), ax.Y(fit.pred(xe))); ctx.stroke();
    ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ax.X(xe), ax.Y(fit.pred(xe))); ctx.lineTo(ax.X(x1), ax.Y(clip(fit.pred(x1)))); ctx.stroke(); ctx.restore();
    // 16-hour reliability line
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(CAP)); ctx.lineTo(box.x + box.w, ax.Y(CAP)); ctx.stroke(); ctx.restore();
    A.text(ctx, '16 小时：METR 认为再往上测不准', box.x + 6, ax.Y(CAP) - 7, { size: 11, color: A.css('--muted') });
    D.forEach((d) => {
      const used = d[1] >= from && d[2] <= CAP, x = ax.X(d[1]), y = ax.Y(d[2]);
      if (d[3]) { ctx.strokeStyle = A.alpha(cols[1], 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, ax.Y(d[3])); ctx.lineTo(x, ax.Y(d[4])); ctx.stroke(); }
      if (d[2] > CAP) { ctx.strokeStyle = cols[1]; ctx.lineWidth = 2; ctx.fillStyle = A.css('--surface'); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); ctx.stroke(); return; }
      ctx.fillStyle = used ? cols[1] : A.alpha(cols[1], 0.3); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
    });
    [['GPT-4', 0], ['GPT-5', 0], ['Claude Mythos Preview', 1]].forEach(([n, up]) => { const d = D.find((q) => q[0] === n); A.text(ctx, n, ax.X(d[1]) - 6, ax.Y(d[2]) + (up ? -12 : 14), { size: 11, align: 'right', color: A.css('--ink-2') }); });
    const yt = clip(fit.pred(target));
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(target), ax.Y(yt), 6, 0, 7); ctx.fill();
    A.text(ctx, '外推', ax.X(target) + 8, ax.Y(yt), { size: 12, color: cols[0], weight: 700 });
  });
  cv.addEventListener('mousemove', (e) => {
    const p = A.pos(cv, e); if (!p) return;
    const W = cv.clientWidth, H = cv.clientHeight, box = { x: 74, y: 16, w: W - 94, h: H - 54 };
    const X = (t) => box.x + (t - 2019) / 10 * box.w, ly = (m) => box.y + box.h * (1 - (Math.log10(m) - Math.log10(1 / 60)) / (Math.log10(YEAR) - Math.log10(1 / 60)));
    const d = D.find((q) => Math.hypot(X(q[1]) - p.x, ly(q[2]) - p.y) < 9);
    if (!d) { A.tip.hide(); return; }
    A.tip.show(`<b>${d[0]}</b><br>50% 时间跨度 ${fmtT(d[2])}` + (d[3] ? `<br>95% 区间 ${fmtT(d[3])} 到 ${fmtT(d[4])}<br>超过 16 小时，不计入拟合` : ''), e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    fit = doFit();
    const p = fit.pred(target);
    stats.innerHTML = '';
    [['拟合出的翻倍时间', Math.round(fit.days) + ' 天（' + fit.dbl.toFixed(1) + ' 个月）'], ['外推的 50% 时间跨度', fmtT(p)], ['对应的 80% 时间跨度（按约 1/5 估）', fmtT(p / 5)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = '50% 时间跨度：人类专家要做多久的任务，模型有一半把握做成。纵轴是对数坐标，直线意味着指数增长。用全部点拟合，翻倍时间约 189 天；只用 2023 年以后的点约 132 天，与 METR 公布的 131 天接近；只用 2024 年以后的点约 101 天（METR 用自己的方法算出 89 天）。同一组数据换一个时间窗口，外推到 2027 年年中就从约 3 个工作日变成约 2 个工作月，差十几倍。还要注意：任务是明确、可自动判分的软件和研究任务，不代表所有工作；Mythos Preview 的估计超过 16 小时（空心点，竖线是 95% 区间，约 8.5 到 55 小时），METR 认为这个范围测不准，没有计入拟合；80% 时间跨度一般只有 50% 的四分之一到六分之一，可靠地完成长任务难得多。';
    view.redraw();
  }
  draw();
});
