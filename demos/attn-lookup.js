/* attn-lookup — drag a query and five keys in 2-D; scores q·k/√2, softmax with a temperature, output as a colour mix */
A.defineDemo('attn-lookup', function (mount) {
  const { bd } = A.demo(mount, '拖动 Query 和 Key：注意力是软查询', '2 维向量，点积打分');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const tau = A.slider(ctl, { label: '温度 τ（分数除以 τ）', min: 0.1, max: 5, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), on: () => view.redraw(), width: 240 });
  const grid = A.el('div', { class: 'cols' });
  const cv = A.el('canvas', { class: 'cv' });
  const right = A.el('div');
  grid.append(cv, right); bd.append(grid);
  bd.append(A.el('p', { class: 'hint' }, '拖动蓝色的 q 或任何一个 k。q 和哪个 k 方向越接近、长度越长，点积越大，权重越大。τ 小的时候接近“硬”查询（只取最大的那个），τ 大的时候接近对所有 value 取平均。'));
  const names = ['猫', '狗', '汽车', '苹果', '香蕉'];
  const keys = [[1.6, 1.4], [2.0, 0.6], [-1.8, 1.2], [-0.4, -1.9], [0.6, -2.0]];
  const q = [1.5, 1.0];
  let drag = null;
  const view = A.canvas(cv, { aspect: 0.9 }, paint);
  const R = 3;
  let toX, toY, fromX, fromY;
  function weights() { return A.softmax(keys.map((k) => A.dot(q, k) / Math.SQRT2), tau.value); }
  function paint(ctx, W, H) {
    const s = Math.min(W, H) / (2 * R + 0.6);
    const cx = W / 2, cy = H / 2;
    toX = (v) => cx + v * s; toY = (v) => cy - v * s;
    fromX = (p) => (p - cx) / s; fromY = (p) => (cy - p) / s;
    const grid = A.css('--grid'), cols = A.series(), muted = A.css('--muted');
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let i = -R; i <= R; i++) {
      ctx.beginPath(); ctx.moveTo(toX(i), toY(-R)); ctx.lineTo(toX(i), toY(R)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toX(-R), toY(i)); ctx.lineTo(toX(R), toY(i)); ctx.stroke();
    }
    ctx.strokeStyle = A.css('--axis');
    ctx.beginPath(); ctx.moveTo(toX(-R), cy); ctx.lineTo(toX(R), cy); ctx.moveTo(cx, toY(-R)); ctx.lineTo(cx, toY(R)); ctx.stroke();
    const w = weights();
    keys.forEach((k, i) => {
      const c = cols[i + 1];
      A.arrow(ctx, cx, cy, toX(k[0]), toY(k[1]), A.alpha(c, 0.35 + 0.65 * w[i]), 1.5 + 4 * w[i]);
      ctx.fillStyle = c; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(toX(k[0]), toY(k[1]), 7 + 10 * w[i], 0, 7); ctx.fill(); ctx.stroke();
      A.text(ctx, 'k: ' + names[i], toX(k[0]) + 12 + 10 * w[i], toY(k[1]), { size: 12.5, weight: 600, color: A.css('--ink') });
    });
    A.arrow(ctx, cx, cy, toX(q[0]), toY(q[1]), cols[0], 3, 11);
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(toX(q[0]), toY(q[1]), 8, 0, 7); ctx.fill();
    A.text(ctx, 'q', toX(q[0]) - 3, toY(q[1]) - 16, { size: 14, weight: 700, color: cols[0] });
    side(w);
  }
  function side(w) {
    const cols = A.series();
    right.innerHTML = '<div class="small muted">分数 q·k/√2 → softmax 权重</div>';
    const scores = keys.map((k) => A.dot(q, k) / Math.SQRT2);
    keys.forEach((k, i) => {
      right.append(A.el('div', { style: { display: 'grid', gridTemplateColumns: '44px 52px 1fr 48px', gap: '8px', alignItems: 'center', margin: '6px 0', fontSize: '13.5px' } },
        A.el('b', null, names[i]), A.el('span', { class: 'mono muted' }, scores[i].toFixed(2)),
        A.el('div', { style: { height: '16px', background: 'var(--grid)', borderRadius: '0 4px 4px 0' } }, A.el('div', { style: { height: '100%', width: w[i] * 100 + '%', background: cols[i + 1], borderRadius: '0 4px 4px 0' } })),
        A.el('span', { class: 'mono', style: { textAlign: 'right' } }, (w[i] * 100).toFixed(1) + '%')));
    });
    // output = weighted mix of value colors
    const rgb = [0, 0, 0];
    w.forEach((wi, i) => { const c = A.hex2rgb(cols[i + 1]); rgb[0] += wi * c[0]; rgb[1] += wi * c[1]; rgb[2] += wi * c[2]; });
    right.append(A.el('div', { class: 'flex', style: { marginTop: '14px' } },
      A.el('div', { style: { width: '56px', height: '56px', borderRadius: '10px', background: `rgb(${rgb.map(Math.round)})`, border: '1px solid var(--border)' } }),
      A.el('div', { class: 'small' }, A.el('div', null, '输出 = Σ 权重 × value'), A.el('div', { class: 'muted' }, '这里把每个 value 画成一种颜色（只是示意，与正文玩具的“颜色”维无关），输出是按权重混合后的颜色'), A.el('div', { class: 'muted' }, '最大权重：' + (Math.max(...w) * 100).toFixed(1) + '%（τ 越小越接近 100%）'))));
  }
  function hit(p) {
    const pts = [q, ...keys];
    let best = null, bd2 = 400;
    pts.forEach((pt) => { const d = (toX(pt[0]) - p.x) ** 2 + (toY(pt[1]) - p.y) ** 2; if (d < bd2) { bd2 = d; best = pt; } });
    return best;
  }
  cv.addEventListener('pointerdown', (e) => { drag = hit(A.pos(cv, e)); if (drag) cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    const p = A.pos(cv, e);
    cv.style.cursor = hit(p) ? 'grab' : 'default';
    if (!drag) return;
    drag[0] = A.clamp(fromX(p.x), -R, R); drag[1] = A.clamp(fromY(p.y), -R, R);
    view.redraw();
  });
  cv.addEventListener('pointerup', () => (drag = null));
});
