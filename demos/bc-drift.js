/* bc-drift — behavior cloning vs DAgger on a 1D lane-keeping task: covariate shift makes errors compound */
A.defineDemo('bc-drift', function (mount) {
  const { bd } = A.demo(mount, '模仿学习为什么会“越走越偏”', '一维“沿车道行驶”：状态是偏离中线的距离 y；专家总把车拉回中线；20 次独立试跑');
  let eps = 0.05, w = 0.1, seed = 4;
  const T = 120, RUNS = 20, FAIL = 1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '每一步的噪声幅度 σ', min: 0.005, max: 0.12, step: 0.005, value: eps, fmt: (v) => v.toFixed(3), on: (v) => { eps = v; draw(); }, width: 180 });
  A.slider(ctl, { label: '专家示范覆盖的范围 |y| <', min: 0.05, max: 0.8, step: 0.01, value: w, fmt: (v) => v.toFixed(2), on: (v) => { w = v; draw(); }, width: 200 });
  ctl.append(A.el('button', { onclick: () => { seed = (seed * 7919 + 1) % 100003; draw(); } }, '重新试跑'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  // learned policy: correct near data (|y|<cover), correction fades outside it
  const policy = (y, cover) => { const a = Math.abs(y); const m = a < cover ? 1 : Math.max(0, 1 - (a - cover) / 0.25); return -0.3 * y * m; };
  function rollouts(cover) {
    const r = A.rng(seed); const out = [];
    for (let k = 0; k < RUNS; k++) { let y = 0; const bias = (r() * 2 - 1) * eps * 1.5; const path = [0]; for (let t = 0; t < T; t++) { y = y + policy(y, cover) + bias + eps * A.gauss(r); path.push(y); } out.push(path); }
    return out;
  }
  let bc, dg;
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 44, y: 26, w: W - 60, h: H - 62 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: T, ymin: -2, ymax: 2, yfmt: (v) => v.toFixed(0), xlabel: '时间步', ylabel: '偏离 y', ylabelOffset: 38 });
    ctx.fillStyle = A.alpha(cols[2], 0.12); ctx.fillRect(box.x, ax.Y(w), box.w, ax.Y(-w) - ax.Y(w));
    ctx.save(); ctx.strokeStyle = cols[7] || cols[6]; ctx.setLineDash([4, 4]); [FAIL, -FAIL].forEach((v) => { ctx.beginPath(); ctx.moveTo(box.x, ax.Y(v)); ctx.lineTo(box.x + box.w, ax.Y(v)); ctx.stroke(); }); ctx.restore();
    A.text(ctx, '冲出车道', box.x + box.w - 4, ax.Y(FAIL) - 8, { size: 11.5, align: 'right', color: A.css('--muted') });
    A.text(ctx, '示范数据覆盖的区域', box.x + 6, ax.Y(w) - 8, { size: 11, color: A.css('--muted') });
    const line = (paths, c) => paths.forEach((p) => { ctx.strokeStyle = A.alpha(c, 0.55); ctx.lineWidth = 1.4; ctx.beginPath(); p.forEach((y, t) => { const yy = ax.Y(A.clamp(y, -2, 2)); t ? ctx.lineTo(ax.X(t), yy) : ctx.moveTo(ax.X(t), yy); }); ctx.stroke(); });
    line(bc, cols[1]); line(dg, cols[0]);
  });
  function draw() {
    bc = rollouts(w); dg = rollouts(Math.max(w, 1.5));
    const fail = (ps) => ps.filter((p) => p.some((y) => Math.abs(y) > FAIL)).length / ps.length;
    const meanEnd = (ps) => A.sum(ps.map((p) => Math.abs(p[p.length - 1]))) / ps.length;
    stats.innerHTML = '';
    [['行为克隆：冲出车道的比例', A.pct(fail(bc), 0)], ['DAgger：冲出车道的比例', A.pct(fail(dg), 0)], ['终点平均偏离（克隆 / DAgger）', meanEnd(bc).toFixed(2) + ' / ' + meanEnd(dg).toFixed(2)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${cols[1]}"></i>行为克隆（只在专家走过的状态上学）</span><span><i class="line" style="background:${cols[0]}"></i>DAgger（在自己会走到的状态上也请专家标注）</span>`;
    hint.innerHTML = '专家开得很稳，示范数据几乎都在中线附近（绿色带）。学到的策略每一步都有一点随机误差，外加一点系统性的小偏差（例如总是略微偏右）。行为克隆只学会了“在中线附近怎么开”；一旦小误差把车带出这个区域，它就没见过这种状态，不知道该怎么拉回来，于是越偏越远：这叫协变量偏移。DAgger 让学生自己开，把它实际到达的偏离状态交给专家标注“这时该怎么做”，再加入训练，学生因此学会了从偏离中恢复。这与语言模型的暴露偏差、在线蒸馏是同一个问题（第 9 章）。';
    hint.innerHTML = hint.innerHTML.replace('第 9 章', A.cref('distillation'));
    view.redraw();
  }
  draw();
});
