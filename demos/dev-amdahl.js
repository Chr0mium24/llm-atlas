/* dev-amdahl — why AI can speed up coding yet slow down the task: Amdahl's law with overheads */
A.defineDemo('dev-amdahl', function (mount) {
  const { bd } = A.demo(mount, 'AI 让写代码变快了，整件事为什么不一定变快', '阿姆达尔定律加上额外开销；所有比例以“不用 AI 时完成任务的总时间”为 1');
  let f = 0.4, s = 4, o = 0.25;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '写代码占总时间的比例 f', min: 0.1, max: 0.9, step: 0.01, value: f, fmt: (v) => A.pct(v, 0), on: (v) => { f = v; draw(); }, width: 200 });
  A.slider(ctl, { label: 'AI 让这部分快几倍 s', min: 1, max: 20, step: 0.5, value: s, fmt: (v) => v + ' 倍', on: (v) => { s = v; draw(); }, width: 180 });
  A.slider(ctl, { label: '新增开销 o（写提示、等待、审查和修正 AI 的输出）', min: 0, max: 0.8, step: 0.01, value: o, fmt: (v) => A.pct(v, 0), on: (v) => { o = v; draw(); }, width: 300 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const view = A.canvas(cv, { height: 150 }, (ctx, W, H) => {
    const x0 = 120, w = W - x0 - 20, bh = 34;
    const rows = [['不用 AI', [[1 - f, cols[7] || cols[6], '其它工作'], [f, cols[0], '写代码']]], ['用 AI', [[1 - f, cols[7] || cols[6], '其它工作'], [f / s, cols[0], '写代码'], [o, cols[1], '新增开销']]]];
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
    const t = 1 - f + f / s + o, ideal = 1 / (1 - f + f / s);
    stats.innerHTML = '';
    [['用 AI 后的总时间', t.toFixed(2) + '（' + (t < 1 ? '快了 ' + A.pct(1 - t, 0) : '慢了 ' + A.pct(t - 1, 0)) + '）'], ['没有开销时的理论加速', ideal.toFixed(2) + ' 倍'], ['即使 s 无穷大，最多', (1 / (1 - f + o)).toFixed(2) + ' 倍'], ['不吃亏的开销上限 f(1 − 1/s)', A.pct(f * (1 - 1 / s), 0)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = 'AI 只加速了“写代码”这一部分，理解需求、读代码、调试、沟通都不变，所以整体加速有上限 1/(1 − f)（阿姆达尔定律）。更重要的是新增的开销：写提示、等模型、读懂并审查它生成的代码、修正它的错误。在熟悉的大型代码库里，资深开发者本来写得就快、要求又高，o 很容易超过 f(1 − 1/s)，结果反而变慢，这是 METR 2025 年随机对照试验的一种解释。而“感觉变快了”可能来自写代码这部分确实轻松了很多。';
    view.redraw();
  }
  draw();
});
