/* ray-render — volume rendering along one ray: density σ(t), transmittance T(t), weights T·α, composited color (NeRF / 3DGS) */
A.defineDemo('ray-render', function (mount) {
  const { bd } = A.demo(mount, '体渲染：一条光线怎样得到一个像素的颜色', '光线依次穿过红、绿、蓝三团“雾”；背景是白色；所有数字按公式实际计算');
  let scale = 8, mu1 = 0.3, N = 24;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '雾的浓度（密度倍数）', min: 0.2, max: 40, log: true, value: scale, fmt: (v) => v.toFixed(1), on: (v) => { scale = v; draw(); }, width: 200 });
  A.slider(ctl, { label: '红色雾团的位置', min: 0.1, max: 0.9, step: 0.01, value: mu1, fmt: (v) => 't = ' + v.toFixed(2), on: (v) => { mu1 = v; draw(); }, width: 180 });
  A.slider(ctl, { label: '沿光线的采样点数', min: 4, max: 128, step: 1, value: N, fmt: (v) => v, on: (v) => { N = v; draw(); }, width: 170 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const BLOBS = () => [{ m: mu1, c: [0.9, 0.2, 0.2], n: '红' }, { m: 0.55, c: [0.2, 0.75, 0.3], n: '绿' }, { m: 0.8, c: [0.2, 0.35, 0.9], n: '蓝' }];
  const S = 0.05;
  const dens = (t, b) => scale * Math.exp(-((t - b.m) ** 2) / (2 * S * S));
  function render(n) {
    const B = BLOBS(), dt = 1 / n; let T = 1; const col = [0, 0, 0]; const contrib = [0, 0, 0]; const samples = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * dt; const sig = B.map((b) => dens(t, b)); const st = A.sum(sig);
      const alpha = 1 - Math.exp(-st * dt); const w = T * alpha;
      const c = [0, 1, 2].map((k) => (st > 0 ? A.sum(sig.map((s, j) => s * B[j].c[k])) / st : 0));
      col[0] += w * c[0]; col[1] += w * c[1]; col[2] += w * c[2];
      sig.forEach((s, j) => { contrib[j] += st > 0 ? w * s / st : 0; });
      samples.push({ t, st, T, w, c }); T *= 1 - alpha;
    }
    return { col: col.map((x) => x + T), contrib, bg: T, samples };
  }
  const rgb = (c) => `rgb(${c.map((x) => Math.round(255 * A.clamp(x, 0, 1))).join(',')})`;
  let fine, coarse;
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 46, y: 16, w: W - 140, h: H - 52 };
    const ymax = Math.max(1.05, scale * 1.05);
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1, ymin: 0, ymax: 1.05, xfmt: (v) => v.toFixed(1), yfmt: (v) => v.toFixed(1), xlabel: '沿光线的位置 t（相机在左）' });
    // density (scaled to fit)
    const B = BLOBS();
    ctx.save();
    B.forEach((b) => { ctx.fillStyle = `rgba(${b.c.map((x) => Math.round(255 * x)).join(',')},0.22)`; ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(0)); for (let i = 0; i <= 300; i++) { const t = i / 300; ctx.lineTo(ax.X(t), ax.Y(dens(t, b) / ymax)); } ctx.lineTo(ax.X(1), ax.Y(0)); ctx.closePath(); ctx.fill(); });
    ctx.restore();
    // transmittance
    ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 2; ctx.beginPath();
    fine.samples.forEach((s, i) => (i ? ctx.lineTo(ax.X(s.t), ax.Y(s.T)) : ctx.moveTo(ax.X(s.t), ax.Y(s.T)))); ctx.stroke();
    A.text(ctx, '透射率 T(t)', ax.X(0.02), ax.Y(1) + 12, { size: 11.5, weight: 600 });
    // weights at coarse samples
    const maxw = Math.max(...coarse.samples.map((s) => s.w), 1e-6);
    coarse.samples.forEach((s) => { const h = s.w / maxw * 0.9; ctx.fillStyle = rgb(s.c); ctx.fillRect(ax.X(s.t) - 2.5, ax.Y(h), 5, ax.Y(0) - ax.Y(h)); });
    A.text(ctx, '彩色竖条：各采样点的权重 T·α（归一化显示）', box.x + box.w - 4, box.y + 6, { size: 11, align: 'right', color: A.css('--muted') });
    // swatches
    const sx = box.x + box.w + 20;
    ctx.fillStyle = rgb(fine.col); ctx.fillRect(sx, box.y + 6, 60, 50); A.text(ctx, '精确', sx + 30, box.y + 66, { size: 11.5, align: 'center' });
    ctx.fillStyle = rgb(coarse.col); ctx.fillRect(sx, box.y + 84, 60, 50); A.text(ctx, N + ' 个采样', sx + 30, box.y + 144, { size: 11.5, align: 'center' });
    ctx.strokeStyle = A.css('--axis'); ctx.strokeRect(sx, box.y + 6, 60, 50); ctx.strokeRect(sx, box.y + 84, 60, 50);
  });
  function draw() {
    fine = render(2000); coarse = render(N);
    stats.innerHTML = '';
    const B = BLOBS();
    [['红 / 绿 / 蓝雾团的贡献', fine.contrib.map((x) => A.pct(x, 0)).join(' / ')], ['透过全部雾看到的背景', A.pct(fine.bg, 0)], ['采样不足的颜色误差', Math.hypot(...fine.col.map((x, i) => x - coarse.col[i])).toFixed(3)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    hint.innerHTML = '光线从相机出发，每走一小段，就有一部分光被这里的雾“挡住”并贡献这里的颜色：被挡住的比例 α = 1 − e<sup>−σΔt</sup>，剩下继续往前走的比例就是透射率 T。越靠前的雾越“先下手”：浓度调高时，最前面的那团雾几乎挡住全部光线，后面的颜色和白色背景都看不见；浓度调低时，三种颜色和背景混在一起。把红色雾团拖到后面，像素的颜色随之改变：顺序很重要。NeRF 沿每条光线采样几十到上百个点这样累加；3D 高斯泼溅把场景表示成几百万个半透明的高斯椭球，按深度排序后用同一个公式混合，但不用沿光线逐点采样，所以能实时渲染。采样点太少时，细薄的雾会被漏掉或算错。';
    view.redraw();
  }
  draw();
});
