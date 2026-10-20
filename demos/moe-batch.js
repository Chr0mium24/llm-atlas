/* moe-batch — how many experts a batch touches: 1 − (1 − k/E)^B; why MoE's memory saving shrinks at large batch */
A.defineDemo('moe-batch', function (mount) {
  const { bd } = A.demo(mount, '一批 token 会用到多少个专家', '假设路由大致均匀：每个 token 从 E 个专家中选 k 个');
  let E = 256, k = 8, B = 64;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '专家数 E', min: 8, max: 1024, log: true, value: E, fmt: (v) => Math.round(v), on: (v) => { E = Math.round(v); if (k > E) k = E; draw(); }, width: 170 });
  A.slider(ctl, { label: '每个 token 选几个 k', min: 1, max: 32, step: 1, value: k, fmt: (v) => v, on: (v) => { k = Math.min(v, E); draw(); }, width: 170 });
  A.slider(ctl, { label: '一批同时处理的 token 数 B', min: 1, max: 4096, log: true, value: B, fmt: (v) => Math.round(v), on: (v) => { B = Math.round(v); draw(); }, width: 210 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const frac = (b) => 1 - Math.pow(1 - k / E, b);
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 50, y: 18, w: W - 70, h: H - 56 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 4096, xlog: true, ymin: 0, ymax: 1, xticks: [1, 4, 16, 64, 256, 1024, 4096], xfmt: (v) => v, yfmt: (v) => A.pct(v, 0), xlabel: '批大小 B（同时处理的 token 数）', ylabel: '被用到的专家比例', ylabelOffset: 44 });
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2.6; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const b = Math.pow(4096, i / 200); i ? ctx.lineTo(ax.X(b), ax.Y(frac(b))) : ctx.moveTo(ax.X(b), ax.Y(frac(b))); }
    ctx.stroke();
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(B), ax.Y(frac(B)), 6, 0, 7); ctx.fill();
    A.text(ctx, `B = ${B}：${A.pct(frac(B), 0)}`, ax.X(B) + (B > 600 ? -10 : 10), ax.Y(frac(B)) + 16, { size: 12, color: cols[1], weight: 700, align: B > 600 ? 'right' : 'left' });
  });
  function draw() {
    const f = frac(B), touched = f * E, perTok = touched / B;
    stats.innerHTML = '';
    [['被用到的专家', `${touched.toFixed(1)} / ${E}`], ['每步要从显存读出的专家权重', A.pct(f, 0) + ' 的全部专家'], ['平摊到每个 token 的权重读取', perTok.toFixed(2) + ' 个专家（B = 1 时为 ' + k + ' 个）'], ['计算量', '始终只算 k = ' + k + ' 个专家 / token']]
      .forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    hint.innerHTML = `一个 token 不用某个专家的概率是 1 − k/E，B 个 token 都不用它的概率是 (1 − k/E)<sup>B</sup>，所以被用到的比例是 1 − (1 − k/E)<sup>B</sup>。DeepSeek-V3 的设置（E = 256，k = 8）下，批大小到 64 时约 87% 的专家都会被用到，到 256 时几乎全部。这说明：MoE <b>总是</b>省计算（每个 token 只算 k 个专家），但只有在批很小时（如本地单用户推理）才省显存带宽；服务端大批量推理时，所有专家都必须常驻显存、每步都要读，于是要用专家并行把专家分散到很多张卡上（${A.cref('serving')}）。`;
    view.redraw();
  }
  draw();
});
