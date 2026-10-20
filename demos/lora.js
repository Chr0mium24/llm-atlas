/* lora — LoRA：冻结 W（d_out × d_in），只训练 B（d_out × r）和 A（r × d_in）；参数量 r(d_in + d_out)，以及显存估算 */
A.defineDemo('lora', function (mount) {
  const { bd } = A.demo(mount, 'LoRA：只训练一个低秩增量', '左：一个权重矩阵的形状和参数量；右：整个模型微调时的显存估算');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const inS = A.slider(ctl, { label: '输入维度 d_in', min: 512, max: 16384, step: 512, value: 4096, fmt: (v) => v, on: draw });
  const outS = A.slider(ctl, { label: '输出维度 d_out', min: 512, max: 16384, step: 512, value: 14336, fmt: (v) => v, on: draw });
  const rS = A.slider(ctl, { label: '秩 r', min: 1, max: 256, step: 1, value: 16, fmt: (v) => v, on: draw });
  const mS = A.slider(ctl, { label: '模型参数量', min: 1e9, max: 1e12, log: true, value: 8e9, fmt: (v) => A.human(v, 0), on: draw });
  const grid = A.el('div', { class: 'cols' });
  const cv = A.el('canvas', { class: 'cv' }); const cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv, cv2); bd.append(grid);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const v1 = A.canvas(cv, { aspect: 0.66 }, (ctx, W, H) => {
    const din = inS.value, dout = outS.value, r = rS.value, cols = A.series();
    const S = Math.min(W * 0.42, H - 104), sc = S / Math.max(din, dout);
    const ww = Math.max(4, din * sc), wh = Math.max(4, dout * sc);
    const x0 = 14, y0 = 26, colW = Math.max(ww, 92);
    ctx.fillStyle = A.alpha(A.css('--muted'), 0.25); ctx.fillRect(x0, y0, ww, wh);
    ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, ww - 1, wh - 1);
    A.text(ctx, 'W（冻结）', x0, y0 - 10, { size: 12, weight: 700 });
    A.text(ctx, dout + ' × ' + din, x0, y0 + wh + 12, { size: 11.5, color: A.css('--muted') });
    A.text(ctx, '+', x0 + colW + 12, y0 + wh / 2, { align: 'center', size: 22 });
    const thick = Math.max(3, Math.min(r * sc * 6, 40));
    const bx = x0 + colW + 28;
    ctx.fillStyle = cols[0]; ctx.fillRect(bx, y0, thick, wh);
    A.text(ctx, 'B', bx + thick / 2, y0 - 10, { align: 'center', size: 12, weight: 700, color: cols[0] });
    const ax0 = bx + thick + 10;
    ctx.fillStyle = cols[1]; ctx.fillRect(ax0, y0, ww, thick);
    A.text(ctx, 'A', ax0 + ww / 2, y0 - 10, { align: 'center', size: 12, weight: 700, color: cols[1] });
    A.text(ctx, `B: ${dout}×${r}`, ax0, y0 + thick + 14, { size: 11.5, color: cols[0] });
    A.text(ctx, `A: ${r}×${din}`, ax0, y0 + thick + 30, { size: 11.5, color: cols[1] });
    A.text(ctx, '（B、A 的厚度放大 6 倍示意）', ax0, y0 + thick + 46, { size: 11, color: A.css('--muted') });
    const full = din * dout, lora = r * (din + dout);
    A.text(ctx, `全量更新 ${A.human(full, 1)} 个参数`, x0, H - 28, { size: 12.5, weight: 600 });
    A.text(ctx, `LoRA：r(d_in + d_out) = ${A.human(lora, 1)}，是全量的 ${A.pct(lora / full, 2)}`, x0, H - 10, { size: 12.5, weight: 600, color: cols[0] });
  });
  const v2 = A.canvas(cv2, { aspect: 0.66 }, (ctx, W, H) => {
    const P = mS.value, r = rS.value, din = inS.value, dout = outS.value;
    const frac = (r * (din + dout)) / (din * dout); // 假设所有大矩阵都加 LoRA、形状与左图相同
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
  function draw() {
    const r = rS.value, din = inS.value, dout = outS.value, P = mS.value;
    const frac = (r * (din + dout)) / (din * dout);
    hint.innerHTML = `把这个比例套到整个模型（假设所有大矩阵都加 LoRA），可训练参数约 ${A.human(P * frac, 1)}。全参数微调每个参数要存权重、梯度和两份 Adam 状态，混合精度下约 16 字节；LoRA 只为可训练的那一小部分存梯度和 Adam 状态，冻结的权重只占 2 字节（QLoRA 量化到 4 比特后约 0.53 字节）。默认的 4096 × 14336 是 8B 级模型 MLP 一个投影矩阵的形状。`;
    v1.redraw(); v2.redraw();
  }
  draw();
});
