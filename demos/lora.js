/* lora — interactive demo (moved from ch05-training.html) */
A.defineDemo('lora', function (mount) {
  const { bd } = A.demo(mount, 'LoRA：只训练一个低秩增量', '');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const dS = A.slider(ctl, { label: '矩阵维度 d × d', min: 512, max: 16384, step: 512, value: 4096, fmt: (v) => v + ' × ' + v, on: draw });
  const rS = A.slider(ctl, { label: '秩 r', min: 1, max: 256, step: 1, value: 16, fmt: (v) => v, on: draw });
  const mS = A.slider(ctl, { label: '模型参数量', min: 1e9, max: 1e12, log: true, value: 8e9, fmt: (v) => A.human(v, 0), on: draw });
  const grid = A.el('div', { class: 'cols' });
  const cv = A.el('canvas', { class: 'cv' }); const cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv, cv2); bd.append(grid);
  const v1 = A.canvas(cv, { aspect: 0.62 }, (ctx, W, H) => {
    const d = dS.value, r = rS.value, cols = A.series();
    const S = Math.min(W * 0.36, H - 40);
    const x0 = 16, y0 = 24;
    ctx.fillStyle = A.alpha(A.css('--muted'), 0.25); ctx.fillRect(x0, y0, S, S);
    A.text(ctx, 'W（冻结）', x0 + S / 2, y0 + S / 2, { align: 'center', size: 13, weight: 600 });
    A.text(ctx, d + ' × ' + d, x0 + S / 2, y0 + S / 2 + 18, { align: 'center', size: 11.5, color: A.css('--muted') });
    A.text(ctx, '+', x0 + S + 16, y0 + S / 2, { align: 'center', size: 22 });
    const rw = Math.max(3, (r / d) * S * 6);
    const bx = x0 + S + 34;
    ctx.fillStyle = cols[0]; ctx.fillRect(bx, y0, Math.min(rw, S * 0.5), S);
    A.text(ctx, 'B', bx + Math.min(rw, S * 0.5) / 2, y0 - 10, { align: 'center', size: 12, weight: 700, color: cols[0] });
    const ax0 = bx + Math.min(rw, S * 0.5) + 12;
    ctx.fillStyle = cols[1]; ctx.fillRect(ax0, y0, S, Math.min(rw, S * 0.5));
    A.text(ctx, 'A', ax0 + S / 2, y0 - 10, { align: 'center', size: 12, weight: 700, color: cols[1] });
    A.text(ctx, `B: ${d}×${r}　A: ${r}×${d}（宽度放大 6 倍示意）`, ax0, y0 + Math.min(rw, S * 0.5) + 16, { size: 11.5, color: A.css('--muted') });
    const full = d * d, lora = 2 * d * r;
    A.text(ctx, `全量更新 ${A.human(full, 1)} 参数；LoRA ${A.human(lora, 1)} 参数（${A.pct(lora / full, 2)}）`, x0, H - 10, { size: 12.5, weight: 600 });
  });
  const v2 = A.canvas(cv2, { aspect: 0.62 }, (ctx, W, H) => {
    const P = mS.value, r = rS.value;
    const frac = (2 * r) / dS.value * 0.6; // LoRA on attn+mlp approx share
    const rows = [
      ['全参数微调（BF16 + Adam）', P * 16],
      ['LoRA（BF16 冻结权重）', P * 2 + P * frac * 16],
      ['QLoRA（4-bit NF4 冻结权重）', P * 0.53 + P * frac * 16],
      ['仅推理（BF16）', P * 2],
      ['仅推理（4-bit）', P * 0.53],
    ];
    const mx = Math.max(...rows.map((x) => x[1]));
    const cols = A.series();
    const lw = 168, bh = 20, gap = (H - 40) / rows.length;
    A.text(ctx, '显存估算（不含激活和 KV cache）', 0, 10, { size: 12, color: A.css('--muted') });
    rows.forEach(([n, b], i) => {
      const y = 30 + i * gap;
      A.text(ctx, n, lw - 8, y + bh / 2, { size: 12, align: 'right' });
      A.hbar(ctx, lw, y, ((W - lw - 70) * b) / mx, bh, i < 3 ? cols[[1, 0, 2][i]] : A.css('--axis'));
      A.text(ctx, A.bytes(b), lw + ((W - lw - 70) * b) / mx + 6, y + bh / 2, { size: 12, mono: true, color: A.css('--ink-2') });
    });
  });
  function draw() { v1.redraw(); v2.redraw(); }
});
