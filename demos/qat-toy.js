/* qat-toy — interactive demo (moved from ch09-quantization.html) */
A.defineDemo('qat-toy', function (mount) {
  const { FMT, encFloat, nearestE2M1, E2M1, NF4 } = A.num;
  const { bd } = A.demo(mount, 'PTQ vs QAT：同一个小网络，同样的位数', '32 个隐藏单元，拟合一条曲线');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let bits = 2;
  A.seg(ctl, [{ v: 1, t: '1 位（二值）' }, { v: 2, t: '1.58 位（三值）' }, { v: 3, t: '3 位' }, { v: 4, t: '4 位' }, { v: 8, t: '8 位' }], bits, (v) => { bits = v; train(); }, '权重位数');
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  legend.innerHTML = '<span><i class="line" style="background:var(--axis)"></i>目标函数</span><span><i class="line" style="background:var(--s3)"></i>全精度模型</span><span><i class="line" style="background:var(--s8)"></i>PTQ：训练完再量化</span><span><i class="line" style="background:var(--s1)"></i>QAT：带着量化训练（STE）</span>';
  const H = 32, r = A.rng(4);
  const a = Array.from({ length: H }, () => A.gauss(r) * 1.6), b = Array.from({ length: H }, () => (r() - 0.5) * 6);
  const xs = Array.from({ length: 120 }, (_, i) => -3 + (6 * i) / 119);
  const f = (x) => Math.sin(1.7 * x) + 0.35 * x + 0.3 * Math.cos(4 * x);
  const ys = xs.map(f);
  const Phi = xs.map((x) => a.map((ai, h) => Math.tanh(ai * x + b[h])));
  function quant(w) {
    if (bits === 1) { const al = A.mean(w.map(Math.abs)); return w.map((x) => (x >= 0 ? al : -al)); }
    if (bits === 2) { const g = A.mean(w.map(Math.abs)); return w.map((x) => A.clamp(Math.round(x / g), -1, 1) * g); }
    const qm = (1 << (bits - 1)) - 1, s = Math.max(...w.map(Math.abs)) / qm; return w.map((x) => A.clamp(Math.round(x / s), -qm, qm) * s);
  }
  const pred = (w, phi) => A.dot(w, phi);
  const mse = (w) => A.mean(Phi.map((p, i) => (pred(w, p) - ys[i]) ** 2));
  function adam(w, gradFn, steps, lr) {
    const m = new Array(H).fill(0), v = new Array(H).fill(0);
    for (let t = 1; t <= steps; t++) {
      const g = gradFn(w);
      for (let i = 0; i < H; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; w[i] -= (lr * (m[i] / (1 - Math.pow(0.9, t)))) / (Math.sqrt(v[i] / (1 - Math.pow(0.999, t))) + 1e-8); }
    }
    return w;
  }
  const gradAt = (wEval) => { const g = new Array(H).fill(0); Phi.forEach((p, i) => { const e = pred(wEval, p) - ys[i]; for (let h = 0; h < H; h++) g[h] += (2 * e * p[h]) / Phi.length; }); return g; };
  let wFP, wPTQ, wQAT;
  function train() {
    wFP = adam(new Array(H).fill(0).map(() => A.gauss(A.rng(1)) * 0.1), (w) => gradAt(w), 3000, 0.02);
    wPTQ = quant(wFP);
    // QAT: forward with quantized weights, STE passes the gradient straight to the latent FP weights
    const latent = wFP.slice(), m = new Array(H).fill(0), v = new Array(H).fill(0), steps = 6000;
    let best = wPTQ, bestL = mse(wPTQ);
    for (let t = 1; t <= steps; t++) {
      const lrt = 1e-4 + 0.02 * 0.5 * (1 + Math.cos((Math.PI * t) / steps));
      const g = gradAt(quant(latent));
      for (let i = 0; i < H; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; latent[i] -= (lrt * (m[i] / (1 - Math.pow(0.9, t)))) / (Math.sqrt(v[i] / (1 - Math.pow(0.999, t))) + 1e-8); }
      if (t % 5 === 0) { const q = quant(latent), l = mse(q); if (l < bestL) { best = q; bestL = l; } }
    }
    wQAT = best;
    view.redraw();
    stats.innerHTML = '';
    [['全精度 MSE', mse(wFP)], ['PTQ MSE', mse(wPTQ)], ['QAT MSE', mse(wQAT)]].forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { color: ['var(--good-ink)', 'var(--s8)', 'var(--s1)'][i] } }, v.toFixed(4)))));
  }
  const view = A.canvas(cv, { aspect: 0.38 }, (ctx, W, Hh) => {
    const box = { x: 36, y: 10, w: W - 50, h: Hh - 36 };
    const ax = A.axes(ctx, box, { xmin: -3, xmax: 3, ymin: -2.5, ymax: 2.5, xfmt: (v) => v, yfmt: (v) => v });
    const cols = A.series();
    const line = (fy, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); xs.forEach((x, i) => { const y = ax.Y(A.clamp(fy(i), -2.5, 2.5)); i ? ctx.lineTo(ax.X(x), y) : ctx.moveTo(ax.X(x), y); }); ctx.stroke(); };
    line((i) => ys[i], A.css('--axis'), 5);
    line((i) => pred(wFP, Phi[i]), cols[2], 2);
    line((i) => pred(wPTQ, Phi[i]), cols[7], 2);
    line((i) => pred(wQAT, Phi[i]), cols[0], 2.5);
  });
  train();
});
