/* dev-amdahl — why AI can speed up coding yet slow down the task: Amdahl's law with overheads */
A.defineDemo('dev-amdahl', function (mount) {
  const { bd } = A.demo(mount, 'AI 让写代码变快了，整件事为什么不一定变快', '阿姆达尔定律加上审查开销（与 AI 写的代码量成正比）；所有比例以“不用 AI 时完成任务的总时间”为 1。参数是示意值，不是测量值');
  let f = 0.4, s = 4, rho = 0.9;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '写代码占总时间的比例 f', min: 0.1, max: 0.9, step: 0.01, value: f, fmt: (v) => A.pct(v, 0), on: (v) => { f = v; draw(); }, width: 200 });
  A.slider(ctl, { label: 'AI 让这部分快几倍 s', min: 1, max: 20, step: 0.5, value: s, fmt: (v) => v + ' 倍', on: (v) => { s = v; draw(); }, width: 180 });
  A.slider(ctl, { label: '审查比 ρ（审查并修正 AI 的代码 ÷ 自己写同样代码的时间）', min: 0, max: 1.5, step: 0.05, value: rho, fmt: (v) => v.toFixed(2), on: (v) => { rho = v; draw(); }, width: 330 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const view = A.canvas(cv, { height: 150 }, (ctx, W, H) => {
    const x0 = 120, w = W - x0 - 60, bh = 34, o = rho * f;
    const rows = [['不用 AI', [[1 - f, cols[7] || cols[6], '其它工作'], [f, cols[0], '写代码']]], ['用 AI', [[1 - f, cols[7] || cols[6], '其它工作'], [f / s, cols[0], '写代码'], [o, cols[1], '审查与修正']]]];
    const total = Math.max(1, 1 - f + f / s + o);
    rows.forEach(([lab, segs], r) => {
      const y = 22 + r * (bh + 30);
      A.text(ctx, lab, x0 - 10, y + bh / 2, { size: 13, align: 'right', weight: 600 });
      let x = x0;
      segs.forEach(([v, c, n]) => { const ww = v / total * w; ctx.fillStyle = c; ctx.fillRect(x, y, Math.max(0, ww - 1), bh); if (ww > 46) A.text(ctx, n, x + 6, y + bh / 2, { size: 11.5, color: '#fff', weight: 600 }); x += ww; });
      A.text(ctx, (segs.reduce((a, b) => a + b[0], 0)).toFixed(2), x + 6, y + bh / 2, { size: 12, mono: true });
    });
  });
  function draw() {
    const o = rho * f, t = 1 - f + f / s + o, part = 1 / (1 / s + rho);
    stats.innerHTML = '';
    [['用 AI 后的总时间', t.toFixed(2) + '（' + (Math.abs(t - 1) < 0.005 ? '持平' : t < 1 ? '快了 ' + A.pct(1 - t, 0) : '慢了 ' + A.pct(t - 1, 0)) + '）'], ['写代码这部分的实际加速', part.toFixed(2) + ' 倍'], ['即使 s 无穷大，整体最多', (1 / (1 - f + o)).toFixed(2) + ' 倍'], ['不吃亏要求 ρ 小于 1 − 1/s', (1 - 1 / s).toFixed(2)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = 'AI 只加速了“写代码”这一部分，理解需求、读代码、调试、沟通都不变，所以即使没有审查开销，整体加速也不超过 1/(1 − f)（阿姆达尔定律）。审查 AI 写的代码，时间和它写了多少成正比：写代码这部分的实际加速是 1/(1/s + ρ)，s 再大也超不过 1/ρ。现在 AI 生成代码快 ' + s + ' 倍，ρ = ' + rho.toFixed(2) + ' 时这部分实际' + (part < 1 ? '反而慢了（' + part.toFixed(2) + ' 倍）' : '快 ' + part.toFixed(2) + ' 倍') + '。' + (rho > 0.3 ? '把 ρ 拖到 0.3 以下再看。' : '') + '这只说明“写代码变快”与“整件事变慢”可以同时成立，参数没有测量值，不能拿来算 METR 的结果。';
    view.redraw();
  }
  draw();
});
