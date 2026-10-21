/* sft-noise — 标注噪声给奖励模型的准确率封顶：一致率、上限、以及“排对真实好坏”需要多少数据 */
A.defineDemo('sft-noise', function (mount) {
  const { bd } = A.demo(mount, '标注噪声：奖励模型的准确率被封顶在哪里', '玩具：16 维特征上的线性奖励模型，按 Bradley-Terry 最大似然拟合');
  const D = 16, NS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  let mode = 'flip', agree = 0.73, nPairs = 1000, seed = 3;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'flip', t: '随机看错' }, { v: 'bt', t: '难分的对更易分歧' }], mode, (v) => { mode = v; recompute(); }, '标注者怎样出错');
  A.slider(ctl, { label: '两位标注者的一致率', min: 0.55, max: 1, step: 0.01, value: agree, fmt: (v) => A.pct(v, 0), on: A.debounce((v) => { agree = v; recompute(); }, 120), width: 190 });
  const nice = (v) => { const e = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / e) * e; };
  A.slider(ctl, { label: '训练用的比较对数', min: 50, max: 10000, log: true, value: nPairs, fmt: (v) => nice(v).toLocaleString(), on: (v) => { nPairs = nice(v); draw(); }, width: 190 });
  ctl.append(A.el('button', { onclick: () => { seed = (seed * 48271) % 2147483647; base = null; recompute(); } }, '重新抽样'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const sig = (z) => 1 / (1 + Math.exp(-z));
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  // 对真实分差 Δ ~ N(0, 2) 做数值积分
  const QZ = [], QW = [];
  for (let k = 0; k < 240; k++) { const z = -6 + 12 * (k + 0.5) / 240; QZ.push(z * Math.SQRT2); QW.push(Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * 12 / 240); }
  const E = (f) => { let s = 0; for (let k = 0; k < QZ.length; k++) s += QW[k] * f(QZ[k]); return s; };
  const etaOf = (a) => (1 - Math.sqrt(Math.max(0, 2 * a - 1))) / 2;
  function sOf(a) { // BT：标签 ~ Bernoulli(σ(sΔ))，选 s 使一致率 E[p²+(1−p)²] = a
    if (a >= 0.995) return 400;
    let lo = 1e-3, hi = 400;
    for (let k = 0; k < 50; k++) { const m = Math.sqrt(lo * hi); const ag = E((d) => { const p = sig(m * d); return p * p + (1 - p) * (1 - p); }); if (ag < a) lo = m; else hi = m; }
    return Math.sqrt(lo * hi);
  }
  function obj(X, Y, N, w, lam) { let f = 0; for (let n = 0; n < N; n++) { const o = n * D; let z = 0; for (let i = 0; i < D; i++) z += w[i] * X[o + i]; f += Math.log1p(Math.exp(-Math.abs(z))) + Math.max(0, z) - Y[n] * z; } let r = 0; for (let i = 0; i < D; i++) r += w[i] * w[i]; return f + 0.5 * lam * r; }
  function solve(H, g) { // Cholesky
    const L = new Float64Array(D * D);
    for (let i = 0; i < D; i++) for (let j = 0; j <= i; j++) { let s = H[i * D + j]; for (let k = 0; k < j; k++) s -= L[i * D + k] * L[j * D + k]; L[i * D + j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j * D + j]; }
    const y = new Float64Array(D); for (let i = 0; i < D; i++) { let s = g[i]; for (let k = 0; k < i; k++) s -= L[i * D + k] * y[k]; y[i] = s / L[i * D + i]; }
    const x = new Float64Array(D); for (let i = D - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < D; k++) s -= L[k * D + i] * x[k]; x[i] = s / L[i * D + i]; }
    return x;
  }
  function fit(X, Y, N, w) { // 带少量 L2 的逻辑回归（Bradley-Terry 的最大似然），牛顿法 + 回溯
    const lam = 1, H = new Float64Array(D * D), g = new Float64Array(D), wt = new Float64Array(D);
    for (let it = 0; it < 8; it++) {
      H.fill(0); g.fill(0); for (let i = 0; i < D; i++) { H[i * D + i] = lam; g[i] = -lam * w[i]; }
      for (let n = 0; n < N; n++) { const o = n * D; let z = 0; for (let i = 0; i < D; i++) z += w[i] * X[o + i]; const p = sig(z), r = Y[n] - p, s = p * (1 - p); for (let i = 0; i < D; i++) { const xi = X[o + i]; g[i] += r * xi; const sx = s * xi, row = i * D; for (let j = 0; j <= i; j++) H[row + j] += sx * X[o + j]; } }
      const dw = solve(H, g), f0 = obj(X, Y, N, w, lam); let t = 1;
      for (let ls = 0; ls < 20; ls++) { for (let i = 0; i < D; i++) wt[i] = w[i] + t * dw[i]; if (obj(X, Y, N, wt, lam) <= f0 + 1e-12) break; t *= 0.5; }
      let mx = 0; for (let i = 0; i < D; i++) { mx = Math.max(mx, Math.abs(wt[i] - w[i])); w[i] = wt[i]; }
      if (mx < 2e-3) break;
    }
  }
  function curve(md, a, sd) {
    const r = A.rng(sd), w0 = new Float64Array(D); let nn = 0;
    for (let i = 0; i < D; i++) { w0[i] = A.gauss(r); nn += w0[i] * w0[i]; } nn = Math.sqrt(nn); for (let i = 0; i < D; i++) w0[i] /= nn;
    const eta = etaOf(a), s = md === 'bt' ? sOf(a) : 0, Nmax = NS[NS.length - 1];
    const X = new Float64Array(Nmax * D), Y = new Float64Array(Nmax);
    for (let n = 0; n < Nmax; n++) {
      let dl = 0; for (let i = 0; i < D; i++) { const v = A.gauss(r) * Math.SQRT2; X[n * D + i] = v; dl += w0[i] * v; }
      let y; if (md === 'flip') { y = dl > 0 ? 1 : 0; if (r() < eta) y = 1 - y; } else y = r() < sig(s * dl) ? 1 : 0;
      Y[n] = y;
    }
    const ceil = md === 'flip' ? 1 - eta : E((d) => sig(s * Math.abs(d)));
    const w = new Float64Array(D), pts = [];
    for (const N of NS) {
      fit(X, Y, N, w);
      let nw = 0, c = 0; for (let i = 0; i < D; i++) { nw += w[i] * w[i]; c += w[i] * w0[i]; }
      const cos = A.clamp(c / Math.sqrt(nw), -1, 1), sn = Math.sqrt(Math.max(0, 1 - cos * cos));
      const accT = 1 - Math.acos(cos) / Math.PI; // 特征各向同性时，排对真实好坏的概率 = 1 − 夹角/π
      const accM = md === 'flip' ? (1 - eta) * accT + eta * (1 - accT)
        : E((d) => { const p = sig(s * d), q = sn < 1e-9 ? (d > 0 ? 1 : 0) : 0.5 * (1 + erf(cos * d / (sn * Math.SQRT2) / Math.SQRT2)); return q * p + (1 - q) * (1 - p); });
      pts.push({ N, accT, accM });
    }
    return { pts, ceil, eta };
  }
  let res = null, base = null;
  function recompute() { res = curve(mode, agree, seed); draw(); if (!base) setTimeout(() => { base = curve('flip', 1, seed + 7); draw(); }, 40); }
  const at = (pts, key, N) => { // 在 log N 上线性插值
    const lx = Math.log(N);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (N <= b.N) { const t = (lx - Math.log(a.N)) / (Math.log(b.N) - Math.log(a.N)); return a[key] + t * (b[key] - a[key]); } }
    return pts[pts.length - 1][key];
  };
  const need = (pts, target) => { // 真实准确率第一次达到 target 时的 N（单调包络后插值）
    let best = 0; const env = pts.map((p) => ({ N: p.N, v: (best = Math.max(best, p.accT)) }));
    for (let i = 0; i < env.length; i++) if (env[i].v >= target) { if (i === 0) return env[0].N; const a = env[i - 1], b = env[i]; const t = (target - a.v) / (b.v - a.v); return Math.exp(Math.log(a.N) + t * (Math.log(b.N) - Math.log(a.N))); }
    return null;
  };
  const view = A.canvas(cv, { aspect: 0.5 }, (ctx, W, H) => {
    if (!res) return;
    const cols = A.series();
    const box = { x: 50, y: 26, w: W - 70, h: H - 70 };
    const ax = A.axes(ctx, box, { xmin: 50, xmax: 10000, xlog: true, ymin: 0.5, ymax: 1, xticks: [50, 100, 200, 500, 1000, 2000, 5000, 10000], yticks: [0.5, 0.6, 0.7, 0.8, 0.9, 1], xfmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v), yfmt: (v) => Math.round(v * 100) + '%', xlabel: '训练用的比较对数（对数刻度）', ylabel: '准确率', ylabelOffset: 44 });
    const line = (pts, key, c, w, dash) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); pts.forEach((p, i) => { const x = ax.X(p.N), y = ax.Y(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore(); };
    if (base) line(base.pts, 'accT', A.css('--axis'), 1.8, [5, 4]);
    ctx.save(); ctx.strokeStyle = cols[1]; ctx.setLineDash([2, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(box.x, ax.Y(res.ceil)); ctx.lineTo(box.x + box.w, ax.Y(res.ceil)); ctx.stroke(); ctx.restore();
    A.text(ctx, '上限 ' + A.pct(res.ceil, 1), box.x + 6, ax.Y(res.ceil) - 9, { size: 11.5, color: cols[1], weight: 600 });
    line(res.pts, 'accT', cols[0], 2.6); line(res.pts, 'accM', cols[1], 2.6);
    const x = ax.X(nPairs);
    ctx.save(); ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
    [['accT', cols[0]], ['accM', cols[1]]].forEach(([k, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, ax.Y(at(res.pts, k, nPairs)), 4.5, 0, 7); ctx.fill(); });
  });
  cv.addEventListener('mousemove', (e) => {
    if (!res) return;
    const p = A.pos(cv, e), W = view.W, box = { x: 50, w: W - 70 };
    if (p.x < box.x || p.x > box.x + box.w) { A.tip.hide(); return; }
    const N = Math.exp(Math.log(50) + (p.x - box.x) / box.w * (Math.log(10000) - Math.log(50)));
    A.tip.show(`<b>${Math.round(N).toLocaleString()} 对比较</b><br>排对真实好坏：${A.pct(at(res.pts, 'accT', N), 1)}<br>在新的人类标注上：${A.pct(at(res.pts, 'accM', N), 1)}` + (base ? `<br>无噪声时排对真实好坏：${A.pct(at(base.pts, 'accT', N), 1)}` : ''), e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    if (!res) return;
    const cols = A.series();
    const aT = at(res.pts, 'accT', nPairs), aM = at(res.pts, 'accM', nPairs);
    const n0 = base ? need(base.pts, 0.95) : null, n1 = need(res.pts, 0.95);
    stats.innerHTML = '';
    [['等效的“看错率” η', mode === 'flip' ? A.pct(res.eta, 1) : '（随难度变化）'],
     ['上限：完美奖励模型在新标注上的准确率', A.pct(res.ceil, 1)],
     ['当前：在新标注上测得的 / 排对真实好坏的', A.pct(aM, 1) + ' / ' + A.pct(aT, 1)],
     ['真实准确率到 95% 需要的比较对数：无噪声 / 现在', (base ? (n0 ? Math.round(n0).toLocaleString() : '>1万') : '…') + ' / ' + (n1 ? Math.round(n1).toLocaleString() : '>1万')]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${cols[0]}"></i>排对“真实好坏”的比例（实际工作中看不到）</span><span><i class="line" style="background:${cols[1]}"></i>在新的人类标注上测得的准确率</span><span><i class="line" style="background:${A.css('--axis')}"></i>无噪声标注时的真实准确率（对照）</span>`;
    const f = 1 / Math.max(1e-9, 2 * agree - 1);
    hint.innerHTML = agree > 0.995
      ? '标注完全一致时，测得的准确率就是真实准确率，两条线重合。把一致率往下拉，看橙线怎样被压在虚线下面。'
      : `两位标注者只有 ${A.pct(agree, 0)} 的时候意见一致。橙线（实际能测到的准确率）再怎么加数据也越不过 ${A.pct(res.ceil, 0)} 的上限：完美的奖励模型也猜不中标注者自己看错的那部分。蓝线（排对真实好坏的比例）却可以继续逼近 100%，只是需要更多数据：按推导，在难分的对上每一条带噪声的比较只顶 2·一致率 − 1 = ${(2 * agree - 1).toFixed(2)} 条干净比较，也就是至少要多 ${f.toFixed(1)} 倍数据。这个 ${f.toFixed(1)} 倍是难分的对上的下限；在这个真实好坏确定的玩具里，容易分的对损失更多，统计栏里到 95% 实际要多 ${(n0 && n1) ? (n1 / n0).toFixed(1) + ' 倍' : '更多'}（灰色虚线是无噪声时的对照）。` + (mode === 'bt' ? '“难分的对更易分歧”时，分歧集中在两个回答本来就差不多的比较上，上限比“随机看错”略低，但这些对排错了代价也小。' : '');
    view.redraw();
  }
  A.onTheme(draw);
  setTimeout(recompute, 0);
});
