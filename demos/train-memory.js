/* train-memory — interactive demo (moved from ch10-infra.html) */
A.defineDemo('train-memory', function (mount) {
  const { bd } = A.demo(mount, '训练显存与时间估算', '混合精度 Adam：每参数 16 字节（不含激活）');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const N = A.slider(ctl, { label: '参数量', min: 1e9, max: 3e12, log: true, value: 70e9, fmt: (v) => A.human(v, 0), on: draw });
  const G = A.slider(ctl, { label: 'GPU 数', min: 8, max: 32768, log: true, value: 2048, fmt: (v) => A.human(Math.round(v / 8) * 8, 1), on: draw });
  const T = A.slider(ctl, { label: '张量并行 TP', min: 1, max: 8, step: 1, value: 8, fmt: (v) => v, on: draw });
  const P = A.slider(ctl, { label: '流水线并行 PP', min: 1, max: 32, step: 1, value: 4, fmt: (v) => v, on: draw });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  let zero = 1;
  A.seg(ctl2, [{ v: 0, t: '无 ZeRO' }, { v: 1, t: 'ZeRO-1' }, { v: 2, t: 'ZeRO-2' }, { v: 3, t: 'ZeRO-3 / FSDP' }], zero, (v) => { zero = v; draw(); }, '切分');
  const D = A.slider(ctl2, { label: '训练 token 数', min: 1e11, max: 4e13, log: true, value: 15e12, fmt: (v) => A.human(v, 1), on: draw });
  const MB = A.slider(ctl2, { label: '微批次数（摊薄气泡）', min: 1, max: 64, step: 1, value: 16, fmt: (v) => v, on: draw });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const view = A.canvas(cv, { height: 120 }, (ctx, W, H) => {
    const n = N.value, g = Math.round(G.value / 8) * 8, tp = T.value, pp = P.value, dp = Math.max(1, Math.floor(g / (tp * pp)));
    const sh = n / (tp * pp);
    const w = (2 * sh) / (zero >= 3 ? dp : 1), gr = (2 * sh) / (zero >= 2 ? dp : 1), op = (12 * sh) / (zero >= 1 ? dp : 1);
    const cap = 80e9, mx = Math.max(cap * 1.25, w + gr + op);
    const cols = A.series();
    const X = (b) => 10 + (b / mx) * (W - 20);
    let x = 10;
    [[w, '权重 BF16', 0], [gr, '梯度 BF16', 1], [op, '优化器：FP32 主权重 + Adam m、v', 2]].forEach(([b, n2, c]) => {
      const wd = X(b) - 10;
      ctx.fillStyle = cols[c]; ctx.fillRect(x, 30, Math.max(0, wd - 2), 34);
      if (wd > 90) A.text(ctx, n2 + ' ' + A.bytes(b), x + 6, 47, { size: 11.5, color: '#fff', weight: 600 });
      x += wd;
    });
    ctx.strokeStyle = A.css('--s8'); ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(cap), 20); ctx.lineTo(X(cap), 76); ctx.stroke(); ctx.setLineDash([]);
    A.text(ctx, '80 GB（H100）', X(cap) + 4, 14, { size: 11.5, color: A.css('--s8') });
    A.text(ctx, `每张卡：DP=${dp} × TP=${tp} × PP=${pp}　合计 ${A.bytes(w + gr + op)}（激活另计）`, 10, 96, { size: 12.5, weight: 600, color: w + gr + op > cap ? A.css('--bad') : A.css('--ink') });
  });
  function draw() {
    view.redraw();
    const n = N.value, g = Math.round(G.value / 8) * 8, pp = P.value, m = MB.value;
    const flops = 6 * n * D.value;
    const bubble = (pp - 1) / (m + pp - 1);
    const mfu = 0.45 * (1 - bubble);
    const days = flops / (g * 989e12 * mfu) / 86400;
    stats.innerHTML = '';
    [['总训练算力 6ND', A.sci(flops) + ' FLOPs'], ['流水线气泡', A.pct(bubble, 1)], ['有效 MFU（假设 45% × 去掉气泡）', A.pct(mfu, 0)], ['H100 BF16 下训练时间', days > 365 ? (days / 365).toFixed(1) + ' 年' : days.toFixed(0) + ' 天'], ['GPU 小时', A.human(days * 24 * g, 1)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
  }
  draw();
});
