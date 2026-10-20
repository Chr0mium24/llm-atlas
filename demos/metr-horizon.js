/* metr-horizon — METR 50% time horizon on a log scale: fit a doubling time, extrapolate, and see how fragile extrapolation is */
A.defineDemo('metr-horizon', function (mount) {
  const { bd } = A.demo(mount, 'METR 时间跨度：智能体能完成多长的任务', '50% 时间跨度 = 人类专家需要多长时间的任务，模型有一半把握做成；数值为 METR 公开数据的近似读数');
  const D = [
    ['GPT-2', 2019.13, 2 / 60], ['GPT-3', 2020.4, 9 / 60], ['GPT-3.5', 2022.2, 36 / 60], ['GPT-4', 2023.2, 5],
    ['GPT-4o', 2024.37, 9], ['Claude 3.5 Sonnet（新）', 2024.8, 28], ['o1', 2024.95, 39], ['Claude 3.7 Sonnet', 2025.15, 59],
    ['o3', 2025.3, 90], ['GPT-5', 2025.6, 137], ['Claude Opus 4.5', 2025.9, 289], ['Claude Mythos Preview', 2026.35, 1044],
  ];
  let from = 2019, target = 2027.5;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 2019, t: '用全部数据拟合' }, { v: 2024, t: '只用 2024 年以后的数据' }], from, (v) => { from = v; draw(); }, '拟合范围');
  A.slider(ctl, { label: '外推到', min: 2026.5, max: 2029, step: 0.25, value: target, fmt: (v) => Math.floor(v) + ' 年 ' + (Math.round((v % 1) * 12) + 1) + ' 月', on: (v) => { target = v; draw(); }, width: 200 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  let fit;
  function doFit() {
    const P = D.filter((d) => d[1] >= from);
    const xs = P.map((d) => d[1]), ys = P.map((d) => Math.log2(d[2]));
    const n = xs.length, mx = A.sum(xs) / n, my = A.sum(ys) / n;
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    const b = sxy / sxx, a = my - b * mx;
    return { a, b, pred: (t) => Math.pow(2, a + b * t), dbl: 12 / b };
  }
  const fmtT = (m) => (m < 1 ? Math.round(m * 60) + ' 秒' : m < 60 ? Math.round(m) + ' 分钟' : m < 60 * 40 ? (m / 60).toFixed(1) + ' 小时' : m < 60 * 8 * 22 ? '约 ' + (m / 60 / 8).toFixed(1) + ' 个工作日' : '约 ' + (m / 60 / 8 / 22).toFixed(1) + ' 个工作月');
  const view = A.canvas(cv, { aspect: 0.5 }, (ctx, W, H) => {
    const box = { x: 70, y: 16, w: W - 90, h: H - 54 };
    const ax = A.axes(ctx, box, { xmin: 2019, xmax: 2029, ymin: 1 / 60, ymax: 60 * 24 * 60, ylog: true, yticks: [1 / 60, 1, 60, 60 * 8, 60 * 24 * 7, 60 * 24 * 60], yfmt: (v) => ({ [1 / 60]: '1 秒', 1: '1 分钟', 60: '1 小时', 480: '8 小时', 10080: '1 周', 86400: '2 个月' }[v] || ''), xfmt: (v) => v, xlabel: '模型发布时间' });
    const x0 = from, x1 = 2029;
    ctx.save(); ctx.strokeStyle = cols[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax.X(x0), ax.Y(fit.pred(x0))); ctx.lineTo(ax.X(2026.4), ax.Y(fit.pred(2026.4))); ctx.stroke();
    ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ax.X(2026.4), ax.Y(fit.pred(2026.4))); ctx.lineTo(ax.X(x1), ax.Y(Math.min(fit.pred(x1), 60 * 24 * 60))); ctx.stroke(); ctx.restore();
    D.forEach((d) => { const used = d[1] >= from; ctx.fillStyle = used ? cols[1] : A.alpha(cols[1], 0.3); ctx.beginPath(); ctx.arc(ax.X(d[1]), ax.Y(d[2]), 4.5, 0, 7); ctx.fill(); });
    const last = D[D.length - 1];
    ctx.strokeStyle = A.alpha(cols[1], 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax.X(last[1]), ax.Y(8.5 * 60)); ctx.lineTo(ax.X(last[1]), ax.Y(55 * 60)); ctx.stroke();
    [['GPT-4', 0], ['GPT-5', 0], ['Claude Mythos Preview', 1]].forEach(([n, up]) => { const d = D.find((q) => q[0] === n); A.text(ctx, n, ax.X(d[1]) - 6, ax.Y(d[2]) + (up ? -12 : 14), { size: 11, align: 'right', color: A.css('--ink-2') }); });
    const yt = Math.min(fit.pred(target), 60 * 24 * 60);
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(target), ax.Y(yt), 6, 0, 7); ctx.fill();
    A.text(ctx, '外推', ax.X(target) + 8, ax.Y(yt), { size: 12, color: cols[0], weight: 700 });
  });
  function draw() {
    fit = doFit();
    const p = fit.pred(target);
    stats.innerHTML = '';
    [['拟合出的翻倍时间', fit.dbl.toFixed(1) + ' 个月'], ['外推的 50% 时间跨度', fmtT(p)], ['对应的 80% 时间跨度（约 1/5）', fmtT(p / 5)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = '纵轴是对数坐标，每格是一个数量级，直线意味着指数增长。用全部历史拟合，翻倍时间约 6 个月；只看 2024 年以后，约 3.5 个月：同一组数据，选择不同的时间窗口，外推到两年后会差一个数量级以上。还要注意：时间跨度是在一组软件和研究任务上测的（任务明确、可自动判分），不代表所有工作；最新的点误差棒很大（Mythos Preview 的 95% 区间约 8.5 到 55 小时，竖线），METR 也提醒 16 小时以上的测量不可靠；80% 成功率的时间跨度只有 50% 的大约五分之一，可靠地完成长任务仍难得多。';
    view.redraw();
  }
  draw();
});
