/* opt-path — SGD vs momentum vs Adam on an ill-conditioned quadratic valley; rotate the valley to break Adam's per-coordinate advantage */
A.defineDemo('opt-path', function (mount) {
  const { bd } = A.demo(mount, '优化器在狭长山谷里怎么走', '二维二次函数：一个方向陡、一个方向平；可以旋转山谷');
  let kappa = 100, rot = 0, lrRel = 0.6, adamLr = 0.12, steps = 300;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '条件数 κ（陡 / 平）', min: 1, max: 100, step: 1, value: kappa, fmt: (v) => v, on: (v) => { kappa = v; draw(); }, width: 170 });
  A.slider(ctl, { label: '山谷旋转角', min: 0, max: 45, step: 1, value: rot, fmt: (v) => v + '°', on: (v) => { rot = v; draw(); }, width: 160 });
  A.slider(ctl, { label: 'SGD / 动量的学习率（÷ 稳定上限）', min: 0.1, max: 1, step: 0.05, value: lrRel, fmt: (v) => v.toFixed(2), on: (v) => { lrRel = v; draw(); }, width: 230 });
  A.slider(ctl, { label: 'Adam 步长 η', min: 0.01, max: 0.3, step: 0.01, value: adamLr, fmt: (v) => v.toFixed(2), on: (v) => { adamLr = v; draw(); }, width: 160 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const OPT = [{ k: 'sgd', n: '梯度下降', c: 2 }, { k: 'mom', n: '动量（β = 0.9）', c: 1 }, { k: 'adam', n: 'Adam', c: 0 }];
  function setup() {
    const t = rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const l1 = kappa, l2 = 1;
    // H = R diag(l1,l2) R^T ; u-axis (steep) along (c, s)
    const H = [[l1 * c * c + l2 * s * s, (l1 - l2) * c * s], [(l1 - l2) * c * s, l1 * s * s + l2 * c * c]];
    const f = (x, y) => 0.5 * (x * (H[0][0] * x + H[0][1] * y) + y * (H[1][0] * x + H[1][1] * y));
    const g = (x, y) => [H[0][0] * x + H[0][1] * y, H[1][0] * x + H[1][1] * y];
    return { H, f, g, l1, l2 };
  }
  function run(k, P) {
    const start = [-2.6, 1.6];
    let [x, y] = start, vx = 0, vy = 0, m = [0, 0], v = [0, 0];
    const path = [[x, y]]; let hit = null;
    const lr = lrRel * 2 / P.l1;
    for (let t = 1; t <= steps; t++) {
      const [gx, gy] = P.g(x, y);
      if (k === 'sgd') { x -= lr * gx; y -= lr * gy; }
      else if (k === 'mom') { const lm = lrRel * 2 * (1 + 0.9) / P.l1 * 0.5; vx = 0.9 * vx + gx; vy = 0.9 * vy + gy; x -= lm * vx; y -= lm * vy; }
      else { const b1 = 0.9, b2 = 0.999; m = [b1 * m[0] + (1 - b1) * gx, b1 * m[1] + (1 - b1) * gy]; v = [b2 * v[0] + (1 - b2) * gx * gx, b2 * v[1] + (1 - b2) * gy * gy]; const mh = m.map((q) => q / (1 - Math.pow(b1, t))), vh = v.map((q) => q / (1 - Math.pow(b2, t))); x -= adamLr * mh[0] / (Math.sqrt(vh[0]) + 1e-8); y -= adamLr * mh[1] / (Math.sqrt(vh[1]) + 1e-8); }
      if (!isFinite(x) || Math.abs(x) > 50) { path.push([x, y]); break; }
      path.push([x, y]);
      if (hit === null && P.f(x, y) < 1e-3) hit = t;
    }
    return { path, hit, final: P.f(x, y) };
  }
  let P, R;
  const view = A.canvas(cv, { aspect: 0.62 }, (ctx, W, H) => {
    const sc = Math.min(W / 7, H / 4.4), cx = W / 2, cy = H / 2;
    const X = (x) => cx + x * sc, Y = (y) => cy - y * sc;
    // contours
    const lv = [0.02, 0.1, 0.3, 0.8, 1.6, 3, 5, 8, 12, 18, 26, 36, 50, 70, 95, 130];
    const t = rot * Math.PI / 180;
    lv.forEach((L, i) => {
      const a = Math.sqrt(2 * L / P.l1), b = Math.sqrt(2 * L / P.l2);
      ctx.strokeStyle = A.alpha(A.css('--axis'), 0.55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, a * sc, b * sc, -t, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
    OPT.forEach((o) => {
      const p = R[o.k].path;
      ctx.strokeStyle = cols[o.c]; ctx.lineWidth = 2; ctx.beginPath();
      p.forEach(([x, y], i) => { const px = A.clamp(X(x), -50, W + 50), py = A.clamp(Y(y), -50, H + 50); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      ctx.fillStyle = cols[o.c]; p.forEach(([x, y], i) => { if (i % 4 === 0 && i < 40) { ctx.beginPath(); ctx.arc(X(x), Y(y), 2.2, 0, 7); ctx.fill(); } });
    });
    ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(X(-2.6), Y(1.6), 4, 0, 7); ctx.fill();
    A.text(ctx, '起点', X(-2.6) - 8, Y(1.6) - 10, { size: 12, align: 'right' });
    A.text(ctx, '最低点', cx + 8, cy + 12, { size: 12 });
  });
  function draw() {
    P = setup(); R = {}; OPT.forEach((o) => (R[o.k] = run(o.k, P)));
    stats.innerHTML = '';
    OPT.forEach((o) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, o.n + '：损失 < 10⁻³ 用了'), A.el('div', { class: 'v', style: { fontSize: '17px', color: cols[o.c] } }, R[o.k].hit ? R[o.k].hit + ' 步' : (isFinite(R[o.k].final) && R[o.k].final < 1e3 ? `${steps} 步内未达到` : '发散')))));
    legend.innerHTML = OPT.map((o) => `<span><i class="line" style="background:${cols[o.c]}"></i>${o.n}</span>`).join('');
    hint.innerHTML = `梯度下降的学习率受陡方向限制（超过 2/λ<sub>max</sub> 就发散），在平坦方向上只能走很小的步子，κ 越大越慢。动量把历史梯度累加起来：陡方向上来回振荡的分量相互抵消，平坦方向上一致的分量越积越大。Adam 对每个坐标单独除以梯度的均方根，相当于给每个坐标配一个自己的学习率：山谷与坐标轴对齐（旋转 0°）时，它几乎消除了条件数的影响。把山谷转到 45°，陡和平的方向都混在两个坐标里，按坐标缩放失去了意义，Adam 的优势明显变小。Shampoo、Muon 这类按矩阵整体处理的优化器，正是为了摆脱对坐标轴的依赖。`;
    view.redraw();
  }
  draw();
});
