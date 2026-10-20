/* evaluation-passk — plug-in estimators 1−(1−c/n)^k and (c/n)^k vs the unbiased combinatorial ones, for pass@k and pass^k, over 300 simulated evaluations of a 200-question toy benchmark */
A.defineDemo('evaluation-passk', function (mount) {
  const { bd } = A.demo(mount, 'pass@k 与 pass^k：把 c/n 直接代进去，为什么会偏', '玩具基准：200 道题，每题有自己的真实答对率 p（35% 难题、35% 中等、30% 简单）；每题采样 n 次，同样的评测重复 300 次，看估计值平均落在哪里');
  let n = 10, k = 10, mode = 'at';
  const Q = 200, S = 300;
  const r0 = A.rng(11), P = [];
  for (let i = 0; i < Q; i++) { const u = r0(); P.push(u < 0.35 ? 0.15 * r0() : u < 0.7 ? 0.15 + 0.55 * r0() : 0.7 + 0.3 * r0()); }
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const sN = A.slider(ctl, { label: '每题采样次数 n', min: 2, max: 50, step: 1, value: n, fmt: (v) => v + ' 次', on: (v) => { const wasMax = k === n; n = v; sK.input.max = n; if (wasMax || k > n) k = n; sK.value = k; draw(); } });
  const sK = A.slider(ctl, { label: '看哪个 k', min: 1, max: n, step: 1, value: k, fmt: (v) => 'k = ' + v, on: (v) => { k = v; draw(); } });
  A.seg(ctl, [{ v: 'at', t: 'pass@k：至少一次对' }, { v: 'hat', t: 'pass^k：k 次全对' }], mode, (v) => { mode = v; draw(); }, '指标');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' }); bd.append(grid);
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' }); grid.append(cv1, cv2);
  const cols = A.series();
  bd.append(A.el('div', { class: 'legend', html: `<span><i class="line" style="background:${A.css('--ink-2')}"></i>真实值（虚线）</span><span><i class="line" style="background:${cols[1]}"></i>直接代入 c/n</span><span><i class="line" style="background:${cols[0]}"></i>组合数公式（无偏）</span><span>阴影：300 次评测之间 ±1 个标准差</span>` }));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  // log-binomial for C(a,k)/C(b,k)
  const LF = [0]; for (let i = 1; i <= 200; i++) LF.push(LF[i - 1] + Math.log(i));
  const lC = (a, b) => (b < 0 || b > a ? -Infinity : LF[a] - LF[b] - LF[a - b]);
  const cache = {};
  function hists(nn) { // for each simulated evaluation: histogram of c (number correct out of nn) over the 200 questions
    if (cache[nn]) return cache[nn];
    const r = A.rng(5 + nn), H = [];
    for (let s = 0; s < S; s++) { const h = new Int16Array(nn + 1); for (const p of P) { let c = 0; for (let t = 0; t < nn; t++) if (r() < p) c++; h[c]++; } H.push(h); }
    return (cache[nn] = H);
  }
  let res = null;
  function compute() {
    const H = hists(n), out = [];
    for (let kk = 1; kk <= n; kk++) {
      const plug = new Float64Array(n + 1), unb = new Float64Array(n + 1);
      for (let c = 0; c <= n; c++) {
        if (mode === 'at') { plug[c] = 1 - Math.pow(1 - c / n, kk); unb[c] = 1 - Math.exp(lC(n - c, kk) - lC(n, kk)); }
        else { plug[c] = Math.pow(c / n, kk); unb[c] = Math.exp(lC(c, kk) - lC(n, kk)); }
      }
      const ep = [], eu = [];
      H.forEach((h) => { let a = 0, b = 0; for (let c = 0; c <= n; c++) { a += h[c] * plug[c]; b += h[c] * unb[c]; } ep.push(a / Q); eu.push(b / Q); });
      const m = (a) => A.mean(a), sd = (a) => { const mu = m(a); return Math.sqrt(A.mean(a.map((x) => (x - mu) * (x - mu)))); };
      const truth = A.mean(P.map((p) => (mode === 'at' ? 1 - Math.pow(1 - p, kk) : Math.pow(p, kk))));
      out.push({ k: kk, truth, pm: m(ep), ps: sd(ep), um: m(eu), us: sd(eu) });
    }
    return out;
  }
  const band = (ctx, ax, key, sKey, col, f) => {
    ctx.fillStyle = A.alpha(col, 0.18); ctx.beginPath();
    res.forEach((d, i) => { const x = ax.X(d.k), y = ax.Y(f(d, d[key] + d[sKey])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = res.length - 1; i >= 0; i--) { const d = res[i]; ctx.lineTo(ax.X(d.k), ax.Y(f(d, d[key] - d[sKey]))); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath();
    res.forEach((d, i) => { const x = ax.X(d.k), y = ax.Y(f(d, d[key])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  };
  const xopt = () => ({ xmin: 1, xmax: Math.max(n, 2), xticks: A.niceTicks(1, Math.max(n, 2), 5).filter((v) => v >= 1 && Number.isInteger(v)), xfmt: (v) => 'k=' + v });
  const marker = (ctx, ax, box) => { const x = ax.X(k); ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore(); };
  const v1 = A.canvas(cv1, { aspect: 0.78 }, (ctx, W, H) => {
    if (!res) return;
    const box = { x: 46, y: 24, w: W - 58, h: H - 62 };
    const ymax = mode === 'at' ? 1 : Math.min(1, Math.max(...res.map((d) => d.pm + d.ps)) * 1.1);
    const ax = A.axes(ctx, box, Object.assign(xopt(), { ymin: 0, ymax, yfmt: (v) => A.pct(v, 0), ylabel: mode === 'at' ? '基准上的 pass@k' : '基准上的 pass^k', ylabelOffset: 40 }));
    marker(ctx, ax, box);
    band(ctx, ax, 'pm', 'ps', cols[1], (d, v) => v);
    band(ctx, ax, 'um', 'us', cols[0], (d, v) => v);
    ctx.save(); ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.beginPath();
    res.forEach((d, i) => { const x = ax.X(d.k), y = ax.Y(d.truth); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
  });
  const v2 = A.canvas(cv2, { aspect: 0.78 }, (ctx, W, H) => {
    if (!res) return;
    const box = { x: 46, y: 24, w: W - 58, h: H - 62 };
    const rel = (d, v) => (v - d.truth) / d.truth;
    const ext = Math.max(0.05, ...res.map((d) => Math.abs(rel(d, d.pm)) + d.ps / d.truth));
    const lim = Math.min(ext * 1.15, 3);
    const ax = A.axes(ctx, box, Object.assign(xopt(), { ymin: -lim, ymax: lim, yfmt: (v) => (v > 0 ? '+' : '') + A.pct(v, 0), ylabel: '相对偏差 =（估计 − 真值）÷ 真值', ylabelOffset: 40 }));
    marker(ctx, ax, box);
    ctx.save(); ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    band(ctx, ax, 'pm', 'ps', cols[1], (d, v) => rel(d, v));
    band(ctx, ax, 'um', 'us', cols[0], (d, v) => rel(d, v));
    ctx.restore();
  });
  function draw() {
    res = compute();
    const d = res[k - 1], f = (x) => A.pct(x, 1), b = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' 点';
    stats.innerHTML = '';
    [['真实的 ' + (mode === 'at' ? 'pass@' : 'pass^') + k, f(d.truth)],
      ['直接代入：平均 / 偏差', f(d.pm) + ' / ' + b(d.pm - d.truth)],
      ['组合数公式：平均 / 偏差', f(d.um) + ' / ' + b(d.um - d.truth)],
      ['单次评测的波动（代入 / 组合数）', '±' + (d.ps * 100).toFixed(1) + ' / ±' + (d.us * 100).toFixed(1) + ' 点']]
      .forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    const rb = (d.pm - d.truth) / d.truth;
    let msg;
    if (k === 1) msg = 'k = 1 时两种估计完全相同，都是答对比例 c/n 的平均，都无偏。偏差只在 k > 1 时出现：k 越接近 n，偏差越大。';
    else if (mode === 'at') msg = `pass@k 是 p 的凹函数，代入法系统性地<b>低估</b>：一道题 n 次里一次也没做对（c = 0），代入法就认为它永远做不对，可它的真实 p 并不是 0。现在 n = ${n}、k = ${k}，代入法平均低估 ${(-rb * 100).toFixed(1)}%；组合数公式的平均正好落在真值上，代价是单次的波动略大。把 n 拉大，代入法的偏差会缩小：每题多采样、再用组合数公式，是 HumanEval 以来的标准做法。`;
    else msg = `pass^k 是 p 的凸函数，代入法系统性地<b>高估</b>可靠性：一道题 n 次全对（c = n），代入法就认为它永远不会错。现在 n = ${n}、k = ${k}，代入法高估了 ${(rb * 100).toFixed(0)}%（右图），对“智能体能不能每次都把事办对”这个问题，这是往乐观方向的错。组合数公式 C(c, k)/C(n, k) 是无偏的。`;
    hint.innerHTML = msg;
    v1.redraw(); v2.redraw();
  }
  draw();
});
