/* chinchilla — interactive demo (moved from ch05-training.html) */
A.defineDemo('chinchilla', function (mount) {
  const { bd } = A.demo(mount, 'Chinchilla 计算器：给定算力，模型该多大？', 'L(N, D) = E + A/N^α + B/D^β；常数来自 Hoffmann 等 2022 及 Besiroglu 等 2024 的修正');
  const FITS = { fix: [1.82, 482.01, 2085.43, 0.3478, 0.3658], orig: [1.6934, 406.4, 410.7, 0.3392, 0.2849] };
  let E, Aa, B, al, be;
  const setFit = (k) => { [E, Aa, B, al, be] = FITS[k]; };
  setFit('fix');
  const L = (N, D) => E + Aa / Math.pow(N, al) + B / Math.pow(D, be);
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'fix', t: '2024 复现修正的拟合' }, { v: 'orig', t: '2022 原论文方法 3' }], 'fix', (v) => { setFit(v); draw(); }, '拟合常数');
  const Cs = A.slider(ctl, { label: '训练算力 C（FLOPs）', min: 1e18, max: 1e27, log: true, value: 5.76e23, fmt: (v) => A.sci(v), on: draw, width: 280 });
  const Is = A.slider(ctl, { label: '预期推理 token 数（上线后总量）', min: 1e9, max: 1e16, log: true, value: 1e13, fmt: (v) => A.human(v, 0), on: draw, width: 280 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  bd.append(A.el('p', { class: 'hint' }, '每条曲线是一个固定算力预算（等 FLOPs 线）：模型太小，数据虽多但容量不够；模型太大，每个参数分到的数据太少。曲线最低点就是 Chinchilla 最优。灰点是几个真实模型的大致位置。橙点是把上线后的推理成本算进去之后、达到同样损失的最优点（默认推理 10 万亿 token）。默认的 5.76×10²³ 就是 Chinchilla 本身的训练算力。切换到“原论文方法 3”的常数，最优点会跑到约 40B 参数、每参数约 60 个 token，与论文另外两种方法得到的“约 70B、每参数 20 token”矛盾；修正后的拟合与之一致。'));
  const MODELS = [
    ['GPT-3', 175e9, 300e9], ['Chinchilla', 70e9, 1.4e12], ['Llama 3 8B', 8e9, 15e12], ['Llama 3.1 405B', 405e9, 15.6e12],
  ];
  const Ns = []; for (let e = 7; e <= 13.0001; e += 0.02) Ns.push(Math.pow(10, e));
  function optimum(C) { let best = null; Ns.forEach((N) => { const D = C / (6 * N); const l = L(N, D); if (!best || l < best.l) best = { N, D, l }; }); return best; }
  let hover = null;
  const view = A.canvas(cv, { aspect: 0.55 }, (ctx, W, H) => {
    const box = { x: 50, y: 20, w: W - 70, h: H - 56 };
    const ax = A.axes(ctx, box, { xmin: 1e7, xmax: 1e13, xlog: true, ymin: 1.8, ymax: 2.8, xfmt: (v) => A.human(v, 0), yfmt: (v) => v.toFixed(1), xlabel: '参数量 N', ylabel: '损失 L', ylabelOffset: 42, xgrid: true });
    const cols = A.series();
    const budgets = [1e19, 1e21, 1e25, 1e27];
    budgets.forEach((C) => curve(ctx, ax, C, A.css('--axis'), 1.2, box));
    curve(ctx, ax, Cs.value, cols[0], 2.5, box);
    budgets.forEach((C) => { const o = optimum(C); if (o.l < 2.75) A.text(ctx, A.sci(C), ax.X(o.N), ax.Y(o.l) + 12, { size: 10.5, color: A.css('--muted'), align: 'center' }); });
    // models
    MODELS.forEach(([n, N, D]) => {
      const x = ax.X(N), y = ax.Y(L(N, D));
      ctx.fillStyle = A.css('--muted'); ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      A.text(ctx, n, x + 6, y - 7, { size: 11, color: A.css('--ink-2') });
    });
    const o = optimum(Cs.value);
    ctx.fillStyle = cols[0]; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ax.X(o.N), ax.Y(o.l), 7, 0, 7); ctx.fill(); ctx.stroke();
    const io = inferenceOpt(o);
    if (io && Is.value > 1e10) {
      ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(io.N), ax.Y(o.l), 7, 0, 7); ctx.fill(); ctx.stroke();
      A.arrow(ctx, ax.X(o.N) - 8, ax.Y(o.l), ax.X(io.N) + 10, ax.Y(o.l), cols[1], 2);
    }
  });
  function curve(ctx, ax, C, color, w, box) {
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
    let started = false;
    Ns.forEach((N) => { const D = C / (6 * N); if (D < 1e6) return; const l = L(N, D); const x = ax.X(N), y = ax.Y(Math.min(l, 6)); started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true; });
    ctx.stroke(); ctx.restore();
  }
  // minimize 6ND + 2N*I subject to L(N,D)=target
  function inferenceOpt(o) {
    const I = Is.value; let best = null;
    Ns.forEach((N) => {
      const rem = o.l - E - Aa / Math.pow(N, al);
      if (rem <= 0) return;
      const D = Math.pow(B / rem, 1 / be);
      const cost = 6 * N * D + 2 * N * I;
      if (!best || cost < best.cost) best = { N, D, cost };
    });
    return best;
  }
  function draw() {
    const o = optimum(Cs.value), io = inferenceOpt(o);
    stats.innerHTML = '';
    const items = [['训练最优参数 N*', A.human(o.N, 1)], ['训练最优数据 D*', A.human(o.D, 1) + ' token'], ['token / 参数', (o.D / o.N).toFixed(0)], ['预测损失', o.l.toFixed(3)]];
    if (Is.value > 1e10 && io) items.push(['算上推理后的最优', A.human(io.N, 1) + ' 参数 · ' + (io.D / io.N).toFixed(0) + ' token/参数']);
    items.forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    view.redraw();
  }
  legend.innerHTML = '<span><i class="line" style="background:var(--s1)"></i>当前算力的等 FLOPs 曲线 / 训练最优点</span><span><i class="line" style="background:var(--axis)"></i>10¹⁹、10²¹、10²⁵、10²⁷ FLOPs</span><span><i style="background:var(--s2);border-radius:50%"></i>考虑推理成本后、达到同样损失的最优点</span>';
  draw();
});
