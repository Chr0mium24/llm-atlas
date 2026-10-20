/* video-drift — autoregressive video toy: teacher forcing vs context-noise augmentation (Diffusion Forcing idea) vs self-rollout training (Self Forcing idea); errors accumulate or get corrected */
A.defineDemo('video-drift', function (mount) {
  const { bd } = A.demo(mount, '自回归生成的漂移：同一个模型，三种训练方式', '玩具模型：32 像素宽的“视频”（两列移动的波纹），训练片段 16 帧，生成时一直往后滚；数字都是实际训练、实际滚动算出的');
  // ---------- toy world (frequency domain; a frame = 32 real pixels = complex coeffs k = 0..16)
  const N = 32, K = 17, HTR = 16, RHO = 0.05, NTEST = 24;
  const SIGK = [1, 2], ARTK = [9, 11, 13], OM = { 1: 0.25, 2: -0.4 };
  const S = Math.sqrt(N / 2);
  const clip = (r) => ({ A: { 1: 0.5 + 0.5 * r(), 2: 0.5 + 0.5 * r() }, P: { 1: 2 * Math.PI * r(), 2: 2 * Math.PI * r() } });
  const Z = () => ({ re: new Float64Array(K), im: new Float64Array(K) });
  const truth = (c, t) => { const z = Z(); SIGK.forEach((k) => { const a = c.P[k] - OM[k] * t; z.re[k] = c.A[k] * S * Math.cos(a); z.im[k] = c.A[k] * S * Math.sin(a); }); return z; };
  const genErr = (r, sg) => { const z = Z(); ARTK.forEach((k) => { z.re[k] = A.gauss(r) * sg; z.im[k] = A.gauss(r) * sg; }); return z; };
  // teacher (self-forcing toy): snap a generated frame to the nearest real frame, then advance it one step with the true motion
  const teacher = (x) => { const z = Z(); SIGK.forEach((k) => { const c = Math.cos(OM[k]), s = Math.sin(OM[k]); z.re[k] = x.re[k] * c + x.im[k] * s; z.im[k] = x.im[k] * c - x.re[k] * s; }); return z; };
  // model: next = g ⊙ current (one complex gain per frequency, i.e. a convolution), ridge pulls g toward 1 (= "copy the last frame")
  function fit(pairs, sc) {
    const g = { re: new Float64Array(K), im: new Float64Array(K) };
    for (let k = 0; k < K; k++) {
      let nr = 0, ni = 0, d = 0;
      for (const [x, y] of pairs) { nr += y.re[k] * x.re[k] + y.im[k] * x.im[k]; ni += y.im[k] * x.re[k] - y.re[k] * x.im[k]; d += x.re[k] * x.re[k] + x.im[k] * x.im[k]; }
      const n = pairs.length; nr = nr / n + RHO; ni /= n; d = d / n + 2 * sc * sc + RHO;
      g.re[k] = nr / d; g.im[k] = ni / d;
    }
    return g;
  }
  const step = (g, x) => { const z = Z(); for (let k = 0; k < K; k++) { z.re[k] = g.re[k] * x.re[k] - g.im[k] * x.im[k]; z.im[k] = g.re[k] * x.im[k] + g.im[k] * x.re[k]; } return z; };
  const add = (a, b) => { const z = Z(); for (let k = 0; k < K; k++) { z.re[k] = a.re[k] + b.re[k]; z.im[k] = a.im[k] + b.im[k]; } return z; };
  const rollout = (g, c, T, r, sg) => { const xs = [truth(c, 0)]; for (let t = 1; t < T; t++) xs.push(add(step(g, xs[t - 1]), genErr(r, sg))); return xs; };
  const pw = (x, ks) => ks.reduce((a, k) => a + x.re[k] * x.re[k] + x.im[k] * x.im[k], 0);
  const gain = (g, k) => Math.hypot(g.re[k], g.im[k]);
  const pixels = (x) => { const p = new Float64Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let k = 1; k < K; k++) { const a = (2 * Math.PI * k * i) / N; s += (x.re[k] * Math.cos(a) + x.im[k] * Math.sin(a)) / S; } p[i] = s; } return p; };
  function train(sc, sg) {
    const r = A.rng(11), tr = []; for (let i = 0; i < 60; i++) tr.push(clip(r));
    const clean = []; tr.forEach((c) => { for (let t = 0; t < HTR - 1; t++) clean.push([truth(c, t), truth(c, t + 1)]); });
    const tf = fit(clean, 0), na = fit(clean, sc);
    let sf = tf; const rr = A.rng(18);
    for (let k = 0; k < 3; k++) { const pairs = clean.slice(); tr.forEach((c) => { const xs = rollout(sf, c, HTR, rr, sg); for (let t = 0; t < HTR - 1; t++) pairs.push([xs[t], teacher(xs[t])]); }); sf = fit(pairs, 0); }
    return { tf, na, sf };
  }
  function evaluate(g, sg, T) {
    const rt = A.rng(110), r2 = A.rng(134), art = new Float64Array(T), keep = new Float64Array(T);
    for (let i = 0; i < NTEST; i++) { const c = clip(rt); rollout(g, c, T, r2, sg).forEach((x, t) => { const s0 = Math.sqrt(pw(truth(c, t), SIGK)); art[t] += Math.sqrt(pw(x, ARTK)) / s0 / NTEST; keep[t] += Math.sqrt(pw(x, SIGK)) / s0 / NTEST; }); }
    return { art, keep };
  }
  // ---------- UI
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const scS = A.slider(ctl, { label: '训练时给上下文加的噪声 σ', min: 0, max: 0.6, step: 0.01, value: 0.25, fmt: (v) => v.toFixed(2) + (v === 0 ? '（= 教师强制）' : ''), on: A.debounce(run, 40), width: 210 });
  const sgS = A.slider(ctl, { label: '每帧新产生的生成误差', min: 0.05, max: 0.3, step: 0.01, value: 0.15, fmt: (v) => v.toFixed(2), on: A.debounce(run, 40), width: 190 });
  const lenS = A.slider(ctl, { label: '生成长度', min: 16, max: 128, step: 8, value: 64, fmt: (v) => v + ' 帧', on: A.debounce(run, 40), width: 150 });
  let seed = 3;
  ctl.append(A.el('button', { class: 'primary', onclick: () => { seed++; run(); } }, '换一段视频'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cvK = A.el('canvas', { class: 'cv' }); bd.append(cvK);
  const grid = A.el('div', { class: 'cols' }); const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' }); grid.append(cv1, cv2); bd.append(grid);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const M = [{ k: 'tf', n: '教师强制', c: 7 }, { k: 'na', n: '上下文加噪', c: 3 }, { k: 'sf', n: '自我强制', c: 2 }];
  let W, E, show, T;
  const kymo = A.canvas(cvK, { height: 250 }, (ctx, Wd, H) => {
    const panels = [{ n: '真实视频', xs: show.truth }].concat(M.map((m) => ({ n: m.n, xs: show[m.k], c: cols[m.c] })));
    const gap = 10, top = 20, ph = H - top - 4, pw0 = (Wd - gap * 3) / 4, rh = ph / T, cw = pw0 / N;
    panels.forEach((p, j) => {
      const x0 = j * (pw0 + gap);
      A.text(ctx, p.n, x0, 9, { size: 12, weight: 600, color: p.c || A.css('--ink-2') });
      p.xs.forEach((x, t) => { const px = pixels(x); for (let i = 0; i < N; i++) { ctx.fillStyle = A.div(A.clamp(px[i] / 1.7, -1, 1)); ctx.fillRect(x0 + i * cw, top + t * rh, cw + 0.6, rh + 0.6); } });
      const yh = top + HTR * rh;
      ctx.save(); ctx.strokeStyle = A.css('--ink'); ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, yh); ctx.lineTo(x0 + pw0, yh); ctx.stroke(); ctx.restore();
      if (j === 0) A.text(ctx, '↑ 训练只见过前 16 帧', x0 + 3, yh + 9, { size: 10.5, color: A.css('--ink') });
    });
  });
  function chart(ctx, Wd, H, key, ymax, ylabel, fmt) {
    const box = { x: 44, y: 24, w: Wd - 56, h: H - 60 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: T - 1, ymin: 0, ymax, ny: 4, yfmt: fmt, xfmt: (v) => v.toFixed(0), xlabel: '第几帧', ylabel, ylabelOffset: 38 });
    ctx.save(); ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(ax.X(HTR), box.y); ctx.lineTo(ax.X(HTR), box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, '训练长度', ax.X(HTR) + 4, box.y + 8, { size: 11, color: A.css('--muted') });
    M.forEach((m) => { const v = E[m.k][key]; ctx.strokeStyle = cols[m.c]; ctx.lineWidth = 2.2; ctx.beginPath(); for (let t = 0; t < T; t++) { const y = ax.Y(Math.min(v[t], ymax)); t ? ctx.lineTo(ax.X(t), y) : ctx.moveTo(ax.X(t), y); } ctx.stroke(); });
    return ax;
  }
  let ax1, ax2;
  const v1 = A.canvas(cv1, { aspect: 0.62 }, (ctx, Wd, H) => { const ym = Math.max(0.3, Math.ceil(Math.max(...E.tf.art) * 10) / 10); ax1 = chart(ctx, Wd, H, 'art', ym, '伪影 ÷ 信号（越低越干净）', (v) => v.toFixed(1)); });
  const v2 = A.canvas(cv2, { aspect: 0.62 }, (ctx, Wd, H) => { ax2 = chart(ctx, Wd, H, 'keep', 1.2, '信号保留（1 = 不褪色）', (v) => v.toFixed(1)); });
  [[cv1, () => ax1, 'art'], [cv2, () => ax2, 'keep']].forEach(([cv, ax, key]) => {
    cv.addEventListener('mousemove', (e) => { const a = ax(); if (!a) return; const p = A.pos(cv, e), t = Math.round(A.clamp(a.invX(p.x), 0, T - 1)); A.tip.show(`<b>第 ${t} 帧</b><br>` + M.map((m) => `<span style="color:${cols[m.c]}">■</span> ${m.n}：${E[m.k][key][t].toFixed(3)}`).join('<br>'), e.clientX, e.clientY); });
    cv.addEventListener('mouseleave', () => A.tip.hide());
  });
  function run() {
    const sc = scS.value, sg = sgS.value; T = Math.round(lenS.value);
    W = train(sc, sg); E = {}; M.forEach((m) => (E[m.k] = evaluate(W[m.k], sg, T)));
    const c = clip(A.rng(seed * 31 + 5)); show = { truth: Array.from({ length: T }, (_, t) => truth(c, t)) };
    M.forEach((m) => (show[m.k] = rollout(W[m.k], c, T, A.rng(seed * 17 + 2), sg)));
    stats.innerHTML = '';
    M.forEach((m) => {
      const L = (ARTK.reduce((a, k) => a + gain(W[m.k], k), 0) / ARTK.length).toFixed(2), gs = gain(W[m.k], 1);
      stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, m.n), A.el('div', { class: 'v', style: { fontSize: '15px', color: cols[m.c] } }, `L = ${L}`),
        A.el('div', { class: 'k' }, `第 ${T} 帧：伪影 ${A.pct(E[m.k].art[T - 1], 0)}，信号剩 ${A.pct(E[m.k].keep[T - 1], 0)}；每帧信号 × ${gs.toFixed(3)}`)));
    });
    legend.innerHTML = M.map((m) => `<span><i class="line" style="background:${cols[m.c]}"></i>${m.n}</span>`).join('') + '<span>竖向是时间（往下 = 往后），横向是 32 个像素；颜色是像素值</span>';
    hint.innerHTML = '模型是“残差式”的：下一帧 = 上一帧经过一个卷积（每个频率一个系数），没学过的方向默认原样照抄。每生成一帧，都会在几个高频方向上留下一点新的伪影（模拟生成不完美）。'
      + '<b>教师强制</b>只在干净的真实帧上训练，从没见过伪影，伪影方向的放大系数 L = 1：伪影只进不出，越滚越脏。'
      + '<b>上下文加噪</b>训练时给输入加各向同性的噪声 σ，学会了把伪影压下去（L &lt; 1），但噪声也加在了真实内容所在的方向上，模型学会的“保守”会让画面每帧褪一点色；σ 越大越干净，也越褪色。'
      + '<b>自我强制</b>在自己滚动生成的上下文上训练（3 轮），目标由“老师”给出：把生成的帧修成最接近的真实帧再往前推一步。它见到的正是自己会犯的那种错，所以只在伪影方向上纠正，不褪色。'
      + '把 σ 拉到 0，加噪就退化成教师强制；把每帧误差调大，三者的差距更明显。玩具里的“老师”直接知道真实的运动，真实的 Self Forcing 用一个预训练的双向视频模型做分布匹配，不需要逐帧的标准答案。';
    kymo.redraw(); v1.redraw(); v2.redraw();
  }
  run();
});
