/* spatial-splat — project a 3D Gaussian to the image: Σ' = J Σ Jᵀ (local linearization) vs. exact perspective projection of samples */
A.defineDemo('spatial-splat', function (mount) {
  const { bd } = A.demo(mount, '三维高斯怎样变成屏幕上的椭圆', '相机在原点、朝 +z 看（W = I），f = 500 像素，画面 640×480；点 = 从这个三维高斯里抽 1500 个点、逐个做真正的透视投影（只用来画图）；椭圆 = 用 Σ′ = JΣJᵀ 算出的 1σ、2σ 等高线；“真实投影”的轴长用数值积分精确计算');
  const f = 500, W0 = 640, H0 = 480, NS = 1500;
  let th = 30, z0 = 3, x0 = 0.8, k = 1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '椭球的朝向 θ（0° 平行于画面，90° 指向相机）', min: 0, max: 180, step: 1, value: th, fmt: (v) => v + '°', on: (v) => { th = v; draw(); }, width: 230 });
  A.slider(ctl, { label: '离相机的深度 z', min: 0.8, max: 6, step: 0.05, value: z0, fmt: (v) => v.toFixed(2) + ' m', on: (v) => { z0 = v; draw(); }, width: 150 });
  A.slider(ctl, { label: '偏离视线的水平位置 x', min: -2, max: 2, step: 0.05, value: x0, fmt: (v) => v.toFixed(2) + ' m', on: (v) => { x0 = v; draw(); }, width: 160 });
  A.slider(ctl, { label: '大小倍数', min: 0.3, max: 2, step: 0.05, value: k, fmt: (v) => '×' + v.toFixed(2) + '（长轴 σ = ' + (0.5 * v).toFixed(2) + ' m）', on: (v) => { k = v; draw(); }, width: 200 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const say = A.el('p', { class: 'gs-say' }); bd.append(say);
  const grid = A.el('div', { class: 'cols' }); const cvT = A.el('canvas', { class: 'cv' }), cvI = A.el('canvas', { class: 'cv' }); grid.append(cvT, cvI); bd.append(grid);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  bd.append(A.el('p', { class: 'hint' }, '三维高斯的形状由协方差 Σ = R S Sᵀ Rᵀ 决定（这里三个轴的标准差是 0.5、0.12、0.12 米乘以大小倍数，R 绕竖直轴转 θ）。透视投影不是线性的，3D 高斯泼溅在椭球中心处用雅可比矩阵 J 代替它，得到 Σ′ = JΣJᵀ。默认设置下长轴误差约 +3%；把深度拖到 1.5 m 约 +16%，1.2 m 约 +34%；把朝向转到 90° 附近（椭球前后两端离相机远近差得多）误差也会变大：近的一端被放大得多，点云变成“梨形”。椭球伸到相机附近时，真实投影的方差没有有限值，误差栏显示“无定义”。'));
  const r0 = A.rng(17), Z = Array.from({ length: NS }, () => [A.gauss(r0), A.gauss(r0), A.gauss(r0)]);
  // Gauss–Hermite nodes/weights for a standard normal (Golub–Welsch via Jacobi rotations): the "true" projected covariance is
  // computed by quadrature (48 nodes on the long axis × 12 × 12), so the error readout has no sampling noise.
  const ghq = (n) => {
    const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (Math.abs(i - j) === 1 ? Math.sqrt(Math.max(i, j) / 2) : 0)));
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sw = 0; sw < 100; sw++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        off += M[p][q] * M[p][q]; if (Math.abs(M[p][q]) < 1e-15) continue;
        const th = (M[q][q] - M[p][p]) / (2 * M[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const a = M[k][p], b = M[k][q]; M[k][p] = c * a - s * b; M[k][q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = M[p][k], b = M[q][k]; M[p][k] = c * a - s * b; M[q][k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
      if (off < 1e-24) break;
    }
    return { x: M.map((r, i) => r[i] * Math.SQRT2), w: V[0].map((v) => v * v) };
  };
  const QA = ghq(48), QB = ghq(12);
  let G = null;
  function compute() {
    const t = th * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), S = [0.5 * k, 0.12 * k, 0.12 * k];
    const R = [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    const Sig = [0, 1, 2].map((i) => [0, 1, 2].map((j) => R[i][0] * S[0] * S[0] * R[j][0] + R[i][1] * S[1] * S[1] * R[j][1] + R[i][2] * S[2] * S[2] * R[j][2]));
    const mu = [x0, 0, z0];
    const J = [[f / z0, 0, -f * x0 / (z0 * z0)], [0, f / z0, 0]];
    const Sp = [0, 1].map((a) => [0, 1].map((b) => { let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += J[a][i] * Sig[i][j] * J[b][j]; return v; }));
    const pts = []; let behind = 0;
    Z.forEach((z) => { const p = [0, 1, 2].map((i) => mu[i] + R[i][0] * S[0] * z[0] + R[i][1] * S[1] * z[1] + R[i][2] * S[2] * z[2]); if (p[2] < 0.05) { behind++; return; } pts.push({ p, u: f * p[0] / p[2] + W0 / 2, v: f * p[1] / p[2] + H0 / 2 }); });
    const mu2 = [f * x0 / z0 + W0 / 2, H0 / 2];
    // exact moments of the true perspective projection, by quadrature; undefined when the ellipsoid reaches the camera plane
    // (1/z blows up there, so the projected variance has no finite value)
    const sz = Math.sqrt(Sig[2][2]), ok = z0 - 4 * sz > 0.1;
    let mu_ = NaN, mv = NaN, a = NaN, b = NaN, d = NaN;
    if (ok) {
      const Q = []; let Wt = 0; mu_ = 0; mv = 0;
      for (let i = 0; i < QA.x.length; i++) for (let j = 0; j < QB.x.length; j++) for (let l = 0; l < QB.x.length; l++) {
        const zz = [QA.x[i], QB.x[j], QB.x[l]], w = QA.w[i] * QB.w[j] * QB.w[l];
        const p = [0, 1, 2].map((m) => mu[m] + R[m][0] * S[0] * zz[0] + R[m][1] * S[1] * zz[1] + R[m][2] * S[2] * zz[2]); if (p[2] < 0.05) continue;
        const u = f * p[0] / p[2] + W0 / 2, v = f * p[1] / p[2] + H0 / 2; Q.push([u, v, w]); Wt += w; mu_ += w * u; mv += w * v;
      }
      mu_ /= Wt; mv /= Wt; a = 0; b = 0; d = 0;
      Q.forEach(([u, v, w]) => { a += w * (u - mu_) ** 2; b += w * (u - mu_) * (v - mv); d += w * (v - mv) ** 2; }); a /= Wt; b /= Wt; d /= Wt;
    }
    const eig = (a, b, d) => { const tr = a + d, det = a * d - b * b, q = Math.sqrt(Math.max(0, tr * tr / 4 - det)); const l1 = tr / 2 + q, l2 = Math.max(0, tr / 2 - q); const ang = Math.abs(b) < 1e-12 ? (a >= d ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b); return { s1: Math.sqrt(l1), s2: Math.sqrt(l2), ang }; };
    G = { Sig, J, Sp, pts, behind, mu2, ok, lin: eig(Sp[0][0], Sp[0][1], Sp[1][1]), mc: ok ? eig(a, b, d) : null, mcMean: [mu_, mv] };
  }
  const cols = A.series();
  const ell = (ctx, cx, cy, s1, s2, ang, sc, X, Y) => { ctx.beginPath(); for (let i = 0; i <= 90; i++) { const t = i / 90 * 2 * Math.PI, u = sc * s1 * Math.cos(t), v = sc * s2 * Math.sin(t); const px = cx + u * Math.cos(ang) - v * Math.sin(ang), py = cy + u * Math.sin(ang) + v * Math.cos(ang); i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py)); } ctx.stroke(); };
  const vT = A.canvas(cvT, { aspect: 0.86 }, (ctx, W, H) => {
    const box = { x: 30, y: 16, w: W - 40, h: H - 44 };
    const span = { x0: -2.6, x1: 2.6, z0: -0.4, z1: 6.4 }, sc = Math.min(box.w / (span.x1 - span.x0), box.h / (span.z1 - span.z0));
    const ox = box.x + box.w / 2, oz = box.y + box.h / 2 + sc * (span.z0 + span.z1) / 2;
    const X = (x) => ox + sc * x, Y = (z) => oz - sc * z;
    ctx.strokeStyle = A.css('--grid'); ctx.lineWidth = 1;
    for (let z = 0; z <= 6; z++) { ctx.beginPath(); ctx.moveTo(X(span.x0), Y(z)); ctx.lineTo(X(span.x1), Y(z)); ctx.stroke(); A.text(ctx, z + ' m', X(span.x0) + 2, Y(z) - 7, { size: 10, color: A.css('--muted') }); }
    const half = Math.atan(W0 / 2 / f);
    ctx.fillStyle = A.alpha(A.css('--accent'), 0.07); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(7 * Math.sin(-half)), Y(7 * Math.cos(half))); ctx.lineTo(X(7 * Math.sin(half)), Y(7 * Math.cos(half))); ctx.closePath(); ctx.fill();
    // sample points (xz)
    ctx.fillStyle = A.alpha(cols[1], 0.28); G.pts.forEach((q) => { ctx.fillRect(X(q.p[0]) - 1, Y(q.p[2]) - 1, 2, 2); });
    // ellipse in the xz plane from the covariance block [[Sxx, Sxz], [Sxz, Szz]]; ell() maps world → canvas, so the flipped z axis is handled there
    const e = (() => { const a = G.Sig[0][0], b = G.Sig[0][2], d = G.Sig[2][2], tr = a + d, det = a * d - b * b, q = Math.sqrt(Math.max(0, tr * tr / 4 - det)); const l1 = tr / 2 + q, l2 = Math.max(1e-9, tr / 2 - q); return { s1: Math.sqrt(l1), s2: Math.sqrt(l2), ang: Math.abs(b) < 1e-12 ? (a >= d ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b) }; })();
    ctx.strokeStyle = cols[1]; ctx.lineWidth = 2;
    [1, 2].forEach((m) => { ctx.setLineDash(m === 2 ? [5, 4] : []); ell(ctx, x0, z0, e.s1, e.s2, e.ang, m, X, Y); }); ctx.setLineDash([]);
    // line of sight to the centre
    ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(x0), Y(z0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.moveTo(X(0), Y(0) - 11); ctx.lineTo(X(0) - 7, Y(0) + 5); ctx.lineTo(X(0) + 7, Y(0) + 5); ctx.closePath(); ctx.fill();
    A.text(ctx, '相机', X(0) + 10, Y(0) + 2, { size: 11.5, weight: 600 });
    A.text(ctx, '俯视图（x 向右，z 向前）', box.x + box.w, box.y + 4, { size: 11, align: 'right', color: A.css('--muted') });
  });
  const vI = A.canvas(cvI, { aspect: 0.86 }, (ctx, W, H) => {
    const s = Math.min((W - 20) / W0, (H - 50) / H0), iw = W0 * s, ih = H0 * s, ix = (W - iw) / 2, iy = 20;
    const X = (u) => ix + u * s, Y = (v) => iy + v * s;
    ctx.fillStyle = A.css('--surface-2'); ctx.fillRect(ix, iy, iw, ih);
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    ctx.fillStyle = A.alpha(cols[1], 0.3); G.pts.forEach((q) => { if (Math.abs(q.u) < 1e4 && Math.abs(q.v) < 1e4) ctx.fillRect(X(q.u) - 1, Y(q.v) - 1, 2, 2); });
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2.2;
    [1, 2].forEach((m) => { ctx.setLineDash(m === 2 ? [6, 4] : []); ell(ctx, G.mu2[0], G.mu2[1], G.lin.s1, G.lin.s2, G.lin.ang, m, X, Y); }); ctx.setLineDash([]);
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(X(G.mu2[0]), Y(G.mu2[1]), 3.5, 0, 7); ctx.fill();
    if (G.ok) { ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1.5; const mm = G.mcMean; ctx.beginPath(); ctx.moveTo(X(mm[0]) - 5, Y(mm[1]) - 5); ctx.lineTo(X(mm[0]) + 5, Y(mm[1]) + 5); ctx.moveTo(X(mm[0]) + 5, Y(mm[1]) - 5); ctx.lineTo(X(mm[0]) - 5, Y(mm[1]) + 5); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = A.css('--axis'); ctx.strokeRect(ix, iy, iw, ih);
    A.text(ctx, '相机拍到的画面', ix + iw, iy - 8, { size: 11, align: 'right', color: A.css('--muted') });
  });
  function draw() {
    compute();
    const err = G.ok ? G.mc.s1 / G.lin.s1 - 1 : NaN, shift = G.ok ? Math.hypot(G.mcMean[0] - G.mu2[0], G.mcMean[1] - G.mu2[1]) : NaN;
    stats.innerHTML = '';
    const mono = { fontSize: '15px', fontFamily: 'var(--mono)' };
    [["Σ′（像素²）", `[ ${G.Sp[0][0].toFixed(0)}  ${G.Sp[0][1].toFixed(0)} ; ${G.Sp[1][0].toFixed(0)}  ${G.Sp[1][1].toFixed(0)} ]`],
      ['椭圆的两个轴 σ（线性近似）', G.lin.s1.toFixed(1) + ' / ' + G.lin.s2.toFixed(1) + ' 像素'],
      ['真实投影的两个轴 σ（数值积分）', G.ok ? G.mc.s1.toFixed(1) + ' / ' + G.mc.s2.toFixed(1) + ' 像素' : '无定义'],
      ['近似误差（长轴）', G.ok ? (err >= 0 ? '+' : '') + A.pct(err, 1) : '椭球伸到了相机附近，真实投影没有有限的方差' + (G.behind ? '（' + G.behind + ' 个点跑到相机背后）' : '')]]
      .forEach(([kx, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kx), A.el('div', { class: 'v', style: Object.assign({}, mono, i === 3 && !(Math.abs(err) <= 0.1) ? { color: 'var(--bad)' } : {}) }, v))));
    say.innerHTML = `J = [[f/z, 0, −f·x/z²], [0, f/z, 0]] = [[${(f / z0).toFixed(1)}, 0, ${(-f * x0 / z0 / z0).toFixed(1)}], [0, ${(f / z0).toFixed(1)}, 0]]。第三列不为 0：偏离视线的高斯，沿深度方向的伸展也会被投影成画面上的横向伸展。${G.ok ? '中心偏差：真实投影的平均位置（×）离线性近似的中心（圆点）' + shift.toFixed(1) + ' 像素。' : ''}`;
    legend.innerHTML = `<span><i style="background:${A.alpha(cols[1], 0.6)}"></i>从高斯里抽的点（左：俯视；右：真实透视投影）</span><span><i class="line" style="background:${cols[1]}"></i>三维椭球在 xz 平面的 1σ / 2σ 截面</span><span><i class="line" style="background:${cols[0]}"></i>Σ′ = JΣJᵀ 的 1σ / 2σ 椭圆</span>`;
    vT.redraw(); vI.redraw();
  }
  draw();
});
