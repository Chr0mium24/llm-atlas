/* attention-saturation — why divide by √d_h, and why that only fixes initialization: per-query attention rows, the softmax Jacobian, and the share of "dead" queries vs head dimension */
A.defineDemo('attention-saturation', function (mount) {
  const { bd } = A.demo(mount, '缩放只管初始化：分数一大，softmax 饱和，梯度消失', '每个点 240 个随机 query，各对 16 个随机 key 打分；数字为实际模拟');
  const N = 16, TRIALS = 240, ROWS = 20, EXPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let mode = 'none';
  const dS = A.slider(ctl, { label: '头维度 d_h', min: 1, max: 10, step: 1, value: 7, fmt: (v) => String(Math.pow(2, Math.round(v))), on: () => draw(), width: 200 });
  A.seg(ctl, [{ v: 'none', t: '不缩放 q·k' }, { v: 'sqrt', t: '除以 √d_h' }, { v: 'qkn', t: 'QK-Norm 后除以 √d_h' }], mode, (v) => { mode = v; draw(); }, '打分方式');
  const cS = A.slider(ctl, { label: '训练中 q、k 变长到 c 倍', min: 1, max: 4, step: 0.25, value: 1, fmt: (v) => v.toFixed(2), on: () => draw(), width: 200 });
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const say = A.el('p', { class: 'hint' }); bd.append(say);
  // raw draws at c = 1. For q, k with i.i.d. N(0,1) entries, q·k given q is |q|·z with z ~ N(0,1), so we only need |q|, the
  // 16 projections z_j and, for QK-Norm, |k_j|² = z_j² + χ²(d−1). χ² is summed exactly for small d, Wilson–Hilferty beyond.
  function chi2(d, r) {
    if (d <= 0) return 0;
    if (d <= 8) { let s = 0; for (let i = 0; i < d; i++) { const x = A.gauss(r); s += x * x; } return s; }
    const a = 2 / (9 * d), w = 1 - a + A.gauss(r) * Math.sqrt(a);
    return Math.max(0.01, d * w * w * w);
  }
  const DATA = {};
  EXPS.forEach((e) => {
    const d = Math.pow(2, e), r = A.rng(1000 + e), out = [];
    for (let t = 0; t < TRIALS; t++) {
      const q2 = chi2(d, r), qn = Math.sqrt(q2 / d), dots = [], kn = [];
      for (let j = 0; j < N; j++) { const z = A.gauss(r); dots.push(Math.sqrt(q2) * z); kn.push(Math.sqrt((z * z + chi2(d - 1, r)) / d)); }
      out.push({ dots, qn, kn });
    }
    DATA[e] = out;
  });
  const JU = Math.sqrt(N * Math.pow(1 / N, 2) * Math.pow(1 - 1 / N, 2) + N * (N - 1) * Math.pow(1 / N, 4)); // ‖J‖ for the uniform distribution
  function scores(tr, d, m, c) {
    if (m === 'none') return tr.dots.map((s) => s * c * c);
    if (m === 'sqrt') return tr.dots.map((s) => (s * c * c) / Math.sqrt(d));
    return tr.dots.map((s, j) => s / (tr.qn * tr.kn[j]) / Math.sqrt(d)); // RMS-normalized q and k: the length c cancels out
  }
  function rowStats(s) {
    const p = A.softmax(s);
    let jf = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = (i === j ? p[i] : 0) - p[i] * p[j]; jf += v * v; }
    const H = -A.sum(p.map((x) => (x > 1e-300 ? x * Math.log2(x) : 0)));
    return { p, g: Math.sqrt(jf) / JU, H, mx: Math.max(...p) };
  }
  const cache = {};
  function stats(e, m, c) {
    const key = e + m + c;
    if (cache[key]) return cache[key];
    const d = Math.pow(2, e), rows = DATA[e].map((tr) => rowStats(scores(tr, d, m, c)));
    const mx = rows.map((r) => r.mx).sort((a, b) => a - b);
    return (cache[key] = { rows, dead: rows.filter((r) => r.g < 0.1).length / rows.length, H: A.mean(rows.map((r) => r.H)), medMax: mx[mx.length >> 1] });
  }
  const cols = A.series();
  const MCOL = { none: cols[1], sqrt: cols[0], qkn: cols[2] }, MNAME = { none: '不缩放', sqrt: '÷√d_h', qkn: 'QK-Norm + ÷√d_h' };
  const v1 = A.canvas(cv1, { aspect: 0.86 }, (ctx, W, H) => {
    const e = Math.round(dS.value), st = stats(e, mode, cS.value);
    const top = 30, left = 8, gw = 74, rh = (H - top - 26) / ROWS, cw = (W - left - gw - 18) / N;
    A.text(ctx, '20 个 query 的权重（每行从大到小排）', left, 12, { size: 12.5, weight: 600 });
    A.text(ctx, '梯度', W - gw + 4, 12, { size: 12.5, weight: 600 });
    st.rows.slice(0, ROWS).forEach((r, i) => {
      const y = top + i * rh, ps = r.p.slice().sort((a, b) => b - a);
      ps.forEach((w, j) => { ctx.fillStyle = A.seq(Math.pow(w, 0.6)); ctx.fillRect(left + j * cw, y, cw - 1, rh - 1); });
      const bw = Math.min(1, r.g / 1.6) * (gw - 30);
      const dead = r.g < 0.1;
      ctx.fillStyle = A.css('--grid'); ctx.fillRect(W - gw, y + 1, gw - 30, rh - 3);
      if (bw > 0.5) A.hbar(ctx, W - gw, y + 1, bw, rh - 3, dead ? A.css('--bad') : cols[0], 2);
      A.text(ctx, dead ? '≈0' : r.g.toFixed(1), W - 26, y + rh / 2, { size: 10.5, mono: true, color: dead ? A.css('--bad') : A.css('--ink-2') });
    });
    A.text(ctx, '一行里一格独大 = 饱和；梯度以均匀分布时为 1', left, H - 10, { size: 11, color: A.css('--muted') });
  });
  const v2 = A.canvas(cv2, { aspect: 0.86 }, (ctx, W, H) => {
    const box = { x: 46, y: 30, w: W - 60, h: H - 76 }, c = cS.value;
    const ax = A.axes(ctx, box, { xmin: 2, xmax: 1024, xlog: true, xticks: [2, 8, 32, 128, 512], xfmt: (v) => String(v), ymin: 0, ymax: 1, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => Math.round(v * 100) + '%', xlabel: '头维度 d_h', ylabel: '梯度≈0 的 query 占比', ylabelOffset: 40 });
    ['none', 'sqrt', 'qkn'].forEach((m) => {
      ctx.strokeStyle = MCOL[m]; ctx.lineWidth = m === mode ? 3 : 1.6; ctx.setLineDash(m === 'qkn' ? [5, 4] : []);
      ctx.beginPath();
      EXPS.forEach((e, i) => { const x = ax.X(Math.pow(2, e)), y = ax.Y(stats(e, m, c).dead); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke(); ctx.setLineDash([]);
    });
    const e = Math.round(dS.value), st = stats(e, mode, c);
    ctx.fillStyle = MCOL[mode]; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ax.X(Math.pow(2, e)), ax.Y(st.dead), 6, 0, 7); ctx.fill(); ctx.stroke();
  });
  function draw() {
    const e = Math.round(dS.value), d = Math.pow(2, e), c = cS.value, st = stats(e, mode, c);
    legend.innerHTML = '<span>“梯度≈0”：小于均匀分布时的 10%</span>' + ['none', 'sqrt', 'qkn'].map((m) => `<span><i class="line" style="background:${MCOL[m]}"></i>${MNAME[m]}</span>`).join('') +
      `<span>当前（${MNAME[mode]}，d_h = ${d}）：梯度≈0 的 query <b>${A.pct(st.dead, 0)}</b>，最大权重中位数 <b>${A.pct(st.medMax, 0)}</b>，平均熵 <b>${st.H.toFixed(2)}</b> bit（均匀 = 4）</span>`;
    let t;
    if (mode === 'none') t = `不缩放时分数的标准差约为 √d_h${c > 1 ? ' × c²' : ''} = ${(Math.sqrt(d) * c * c).toFixed(1)}。16 个分数拉得这么开，softmax 几乎只剩最大的那一个，梯度传不回去。切到“除以 √d_h”。`;
    else if (mode === 'sqrt') t = c > 1 ? `初始化时除以 √d_h 正好够用；但训练中 q、k 变长到 ${c.toFixed(2)} 倍，分数就放大 ${(c * c).toFixed(1)} 倍，饱和又回来了。这就是 2023 年以后的模型另加 QK-Norm 等保护的原因。` : '除以 √d_h 之后，分数的标准差回到 1，和维度无关：曲线是平的。再把右边的 c 拖大，模拟训练中 q、k 越变越长。';
    else t = 'QK-Norm 先把 q、k 归一化到固定长度，c 再大也被抵消，分数有了上限（真实模型还会乘一个可学习的系数，让上限可调）。';
    say.textContent = t;
    v1.redraw(); v2.redraw();
  }
  draw();
});
