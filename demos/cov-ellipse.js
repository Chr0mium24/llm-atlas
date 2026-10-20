/* cov-ellipse — a 2D Gaussian: covariance = rotation × scale² × rotationᵀ; eigenvectors are the ellipse axes, eigenvalues the variances along them */
A.defineDemo('cov-ellipse', function (mount) {
  const { bd } = A.demo(mount, '二维高斯分布：协方差矩阵长什么样', '400 个样本点；椭圆是 1 倍和 2 倍标准差的等高线，箭头是协方差矩阵的特征向量');
  let s1 = 1.4, s2 = 0.5, th = 30;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '主轴标准差 σ₁', min: 0.2, max: 2, step: 0.05, value: s1, fmt: (v) => v.toFixed(2), on: (v) => { s1 = v; draw(); }, width: 170 });
  A.slider(ctl, { label: '次轴标准差 σ₂', min: 0.1, max: 2, step: 0.05, value: s2, fmt: (v) => v.toFixed(2), on: (v) => { s2 = v; draw(); }, width: 170 });
  A.slider(ctl, { label: '旋转角 θ', min: 0, max: 180, step: 1, value: th, fmt: (v) => v + '°', on: (v) => { th = v; draw(); }, width: 170 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const r = A.rng(5), Z = Array.from({ length: 400 }, () => [A.gauss(r), A.gauss(r)]);
  const sigma = () => {
    const t = (th * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return { c, s, a: c * c * s1 * s1 + s * s * s2 * s2, b: c * s * (s1 * s1 - s2 * s2), d: s * s * s1 * s1 + c * c * s2 * s2 };
  };
  const view = A.canvas(cv, { aspect: 0.62 }, (ctx, W, H) => {
    const S = sigma(), R = 4.2;
    const side = Math.min(W - 40, H - 30), box = { x: (W - side) / 2, y: 10, w: side, h: side };
    const ax = A.axes(ctx, box, { xmin: -R, xmax: R, ymin: -R, ymax: R, xticks: [-4, -2, 0, 2, 4], yticks: [-4, -2, 0, 2, 4], xfmt: (v) => v, yfmt: (v) => v, xgrid: true });
    // samples: x = R·diag(σ)·z
    ctx.fillStyle = A.alpha(cols[0], 0.45);
    Z.forEach(([z1, z2]) => { const u = s1 * z1, v = s2 * z2, px = S.c * u - S.s * v, py = S.s * u + S.c * v; if (Math.abs(px) < R && Math.abs(py) < R) { ctx.beginPath(); ctx.arc(ax.X(px), ax.Y(py), 2.2, 0, 7); ctx.fill(); } });
    [1, 2].forEach((m) => {
      ctx.save(); ctx.strokeStyle = cols[1]; ctx.lineWidth = m === 1 ? 2.2 : 1.4; if (m === 2) ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const t = (i / 120) * 2 * Math.PI, u = m * s1 * Math.cos(t), v = m * s2 * Math.sin(t), px = S.c * u - S.s * v, py = S.s * u + S.c * v; i ? ctx.lineTo(ax.X(px), ax.Y(py)) : ctx.moveTo(ax.X(px), ax.Y(py)); }
      ctx.stroke(); ctx.restore();
    });
    const ink = A.css('--ink');
    A.arrow(ctx, ax.X(0), ax.Y(0), ax.X(S.c * s1), ax.Y(S.s * s1), ink, 2.2, 8);
    A.arrow(ctx, ax.X(0), ax.Y(0), ax.X(-S.s * s2), ax.Y(S.c * s2), ink, 2.2, 8);
    A.text(ctx, 'v₁（λ₁ = σ₁²）', ax.X(S.c * s1 * 1.08) + 4, ax.Y(S.s * s1 * 1.08) - 8, { size: 11.5, color: ink, weight: 600 });
    A.text(ctx, 'v₂', ax.X(-S.s * s2 * 1.15) - 4, ax.Y(S.c * s2 * 1.15) - 8, { size: 11.5, color: ink, weight: 600, align: 'right' });
  });
  function draw() {
    const S = sigma(), rho = S.b / Math.sqrt(S.a * S.d);
    stats.innerHTML = '';
    [['协方差矩阵 Σ', `[ ${S.a.toFixed(2)}  ${S.b.toFixed(2)} ; ${S.b.toFixed(2)}  ${S.d.toFixed(2)} ]`], ['相关系数 ρ', rho.toFixed(2)], ['特征值 λ₁, λ₂', (s1 * s1).toFixed(2) + ', ' + (s2 * s2).toFixed(2)], ['行列式（“体积”²）', (S.a * S.d - S.b * S.b).toFixed(3)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '15px', fontFamily: 'var(--mono)' } }, v))));
    hint.innerHTML = `对角线上是 x、y 各自的方差，非对角线是协方差：它为正，说明 x 大时 y 也倾向于大（点云向右上倾斜）。协方差矩阵可以写成“旋转 × 缩放² × 旋转的转置”：特征向量就是椭圆的主轴方向，特征值是沿主轴的方差。把 θ 调到 0° 或 90°，非对角线变成 0，两个变量不相关；把 σ₁ 和 σ₂ 调成一样，椭圆变成圆，任何方向都一样（扩散模型加的就是这种“各向同性”的噪声）。3D 高斯泼溅里的每个高斯，正是用一个旋转和三个缩放来参数化协方差的（第 ${A.cref('spatial').replace(/[^0-9]/g, '')} 章）。`;
    view.redraw();
  }
  draw();
});
