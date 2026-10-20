/* spatial-fourier — spectral bias: a small ReLU MLP fits a 1D "scanline" with raw coordinates vs Fourier features γ(x); real training in the browser, scrub through steps */
A.defineDemo('spatial-fourier', function (mount) {
  const { bd } = A.demo(mount, '频谱偏置：同一个小网络，加不加位置编码', '一条一维“扫描线”，128 个训练点；两层、每层 32 个神经元的 ReLU 网络，Adam 学习率 0.003；在浏览器里实际训练，固定随机种子');
  const N = 128, H = 32, STEPS = 1500, EVERY = 10, NP = 240, NE = 400, LR = 3e-3;
  const target = (x) => {
    let y = 0.55 / (1 + Math.exp(-(x - 0.25) * 120)) - 0.3;
    if (x > 0.5 && x < 0.85) y += 0.28 * Math.sin(2 * Math.PI * 12 * (x - 0.5));
    return y + 0.12 * Math.sin(2 * Math.PI * x);
  };
  const feats = (x, L) => { const f = [x * 2 - 1]; for (let k = 0; k < L; k++) { f.push(Math.sin(Math.pow(2, k) * Math.PI * x)); f.push(Math.cos(Math.pow(2, k) * Math.PI * x)); } return Float64Array.from(f); };
  const xs = Array.from({ length: N }, (_, i) => (i + 0.5) / N), ys = xs.map(target);
  const xp = Array.from({ length: NP }, (_, i) => i / (NP - 1)), xe = Array.from({ length: NE }, (_, i) => (i + 0.5) / NE), ye = xe.map(target);
  const BANDS = [[0, 3, '0–3 周（缓变）'], [4, 9, '4–9 周'], [10, 16, '10–16 周（条纹）'], [17, 64, '17–64 周（采样点之间）']];
  const COS = [], SIN = []; for (let k = 0; k <= 64; k++) { COS.push(xe.map((x) => Math.cos(2 * Math.PI * k * x))); SIN.push(xe.map((x) => Math.sin(2 * Math.PI * k * x))); }

  function Model(L) {
    const r = A.rng(3), din = 1 + 2 * L;
    const init = (n, s) => Float64Array.from({ length: n }, () => A.gauss(r) * s);
    const P = { W1: init(H * din, Math.sqrt(2 / din)), b1: new Float64Array(H), W2: init(H * H, Math.sqrt(2 / H)), b2: new Float64Array(H), W3: init(H, Math.sqrt(1 / H)), b3: new Float64Array(1) };
    const M = {}, V = {}, G = {}; for (const k in P) { M[k] = new Float64Array(P[k].length); V[k] = new Float64Array(P[k].length); G[k] = new Float64Array(P[k].length); }
    const F = xs.map((x) => feats(x, L)), FP = xp.map((x) => feats(x, L)), FE = xe.map((x) => feats(x, L));
    const h1 = new Float64Array(H), h2 = new Float64Array(H), g1 = new Float64Array(H), g2 = new Float64Array(H);
    const fwd = (f) => {
      for (let i = 0; i < H; i++) { let s = P.b1[i]; for (let j = 0; j < din; j++) s += P.W1[i * din + j] * f[j]; h1[i] = s > 0 ? s : 0; }
      for (let i = 0; i < H; i++) { let s = P.b2[i]; for (let j = 0; j < H; j++) s += P.W2[i * H + j] * h1[j]; h2[i] = s > 0 ? s : 0; }
      let o = P.b3[0]; for (let j = 0; j < H; j++) o += P.W3[j] * h2[j]; return o;
    };
    let t = 0;
    const step = () => {
      t++; for (const k in G) G[k].fill(0);
      for (let n = 0; n < N; n++) {
        const f = F[n], g = 2 * (fwd(f) - ys[n]) / N;
        G.b3[0] += g;
        for (let j = 0; j < H; j++) { G.W3[j] += g * h2[j]; g2[j] = h2[j] > 0 ? g * P.W3[j] : 0; }
        g1.fill(0);
        for (let i = 0; i < H; i++) { const gi = g2[i]; if (!gi) continue; G.b2[i] += gi; for (let j = 0; j < H; j++) { G.W2[i * H + j] += gi * h1[j]; g1[j] += gi * P.W2[i * H + j]; } }
        for (let i = 0; i < H; i++) { if (h1[i] <= 0) continue; const gi = g1[i]; G.b1[i] += gi; for (let j = 0; j < din; j++) G.W1[i * din + j] += gi * f[j]; }
      }
      const c1 = 1 - Math.pow(0.9, t), c2 = 1 - Math.pow(0.999, t);
      for (const k in P) { const p = P[k], g = G[k], m = M[k], v = V[k]; for (let i = 0; i < p.length; i++) { m[i] = 0.9 * m[i] + 0.1 * g[i]; v[i] = 0.999 * v[i] + 0.001 * g[i] * g[i]; p[i] -= LR * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); } }
    };
    const snap = () => {
      const pred = FP.map(fwd);
      let tr = 0; for (let n = 0; n < N; n++) { const d = fwd(F[n]) - ys[n]; tr += d * d; }
      const res = FE.map((f, i) => fwd(f) - ye[i]);
      const te = A.sum(res.map((d) => d * d)) / NE;
      const band = BANDS.map(([lo, hi]) => { let s = 0; for (let k = lo; k <= hi; k++) { let re = 0, im = 0; for (let i = 0; i < NE; i++) { re += res[i] * COS[k][i]; im += res[i] * SIN[k][i]; } s += (re * re + im * im) / (NE * NE) * (k === 0 ? 1 : 2); } return s; });
      return { t, pred, tr: tr / N, te, band };
    };
    const snaps = [snap()];
    return { L, snaps, get done() { return t >= STEPS; }, tick() { for (let i = 0; i < EVERY; i++) step(); snaps.push(snap()); } };
  }

  const cache = {};
  const get = (L) => (cache[L] = cache[L] || Model(L));
  let L = 6, k = 0, playing = false, timer = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [2, 4, 6, 8, 10].map((v) => ({ t: 'L = ' + v, v })), L, (v) => { L = v; k = Math.min(k, avail()); kick(); render(); }, '右边模型的编码频率数 L');
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '6px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { onclick: () => go(k + 1) }, '下一步 →');
  const play = A.el('button', { class: 'primary', onclick: () => toggle() }, '▶ 播放训练');
  const prog = A.el('span', { class: 'small muted' });
  bar.append(prev, next, play, prog); bd.append(bar);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS / EVERY, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value); bd.append(slider);
  const dots = A.el('div', { class: 'gs-dots' });
  const KEYS = [0, 50, 200, 500, 1500];
  const dotEls = KEYS.map((s) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(s / EVERY) }, s === 0 ? '初始化' : '第 ' + s + ' 步'); dots.append(d); return d; });
  bd.append(dots);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const cvB = A.el('canvas', { class: 'cv', style: { marginTop: '8px' } }); bd.append(cvB);
  bd.append(A.el('p', { class: 'hint' }, '左边的模型（蓝）直接吃坐标 x；右边的模型（橙）吃 γ(x) = (x, sin 2⁰πx, cos 2⁰πx, …, sin 2^(L−1)πx, cos 2^(L−1)πx)。网络结构、初始化、优化器完全相同。拖动时间轴或点“播放”：蓝线先学会整体的高低和那个台阶，中间的条纹（每单位 12 个周期）要很久才开始出现；橙线几十步内就把条纹也学了出来。下面的柱状图把误差按频率拆开：蓝色模型的误差几乎全堆在“条纹”那一档，这就是频谱偏置。把 L 调到 8 或 10，训练误差照样降到接近 0，但“测试误差”（训练点之间的 400 个位置）变大：最高频率超过了 128 个采样点能约束的范围（每单位 64 个周期），网络在点与点之间乱晃。位置编码的频率要和数据能支撑的细节匹配。'));

  const avail = () => Math.min(get(0).snaps.length, get(L).snaps.length) - 1;
  function kick() {
    if (timer) return;
    const run = () => {
      const t0 = performance.now(), a = get(0), b = get(L);
      while (performance.now() - t0 < 24 && !(a.done && b.done)) {
        if (!a.done) a.tick();
        if (!b.done) b.tick();
      }
      const busy = !(a.done && b.done);
      if (playing) { k = Math.min(k + 2, avail()); if (k >= STEPS / EVERY) { playing = false; play.textContent = '▶ 重新播放'; } }
      render();
      timer = busy || playing ? setTimeout(run, 0) : null;
    };
    timer = setTimeout(run, 0);
  }
  function toggle() {
    if (!playing && k >= STEPS / EVERY) k = 0;
    playing = !playing; play.textContent = playing ? '❚❚ 暂停' : '▶ 继续播放'; kick();
  }
  function go(i) { playing = false; play.textContent = '▶ 播放训练'; k = A.clamp(Math.round(i), 0, STEPS / EVERY); kick(); render(); }

  const cols = A.series();
  const view = A.canvas(cv, { aspect: 0.4 }, (ctx, W, Hh) => {
    const box = { x: 44, y: 14, w: W - 58, h: Hh - 46 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1, ymin: -0.7, ymax: 0.85, yticks: [-0.5, 0, 0.5], xfmt: (v) => v.toFixed(1), yfmt: (v) => v.toFixed(1), xlabel: '位置 x' });
    ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i <= 600; i++) { const x = i / 600; i ? ctx.lineTo(ax.X(x), ax.Y(target(x))) : ctx.moveTo(ax.X(x), ax.Y(target(x))); } ctx.stroke();
    ctx.fillStyle = A.css('--muted'); xs.forEach((x, i) => { ctx.beginPath(); ctx.arc(ax.X(x), ax.Y(ys[i]), 1.6, 0, 7); ctx.fill(); });
    const kk = Math.min(k, avail());
    [[get(0), cols[0]], [get(L), cols[1]]].forEach(([m, c]) => {
      const s = m.snaps[kk]; if (!s) return;
      ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.beginPath();
      s.pred.forEach((y, i) => { const yy = A.clamp(y, -0.7, 0.85); i ? ctx.lineTo(ax.X(xp[i]), ax.Y(yy)) : ctx.moveTo(ax.X(xp[i]), ax.Y(yy)); }); ctx.stroke();
    });
    const lab = '第 ' + kk * EVERY + ' 步'; ctx.fillStyle = A.alpha(A.css('--surface').startsWith('#') ? A.css('--surface') : '#fcfcfb', 0.85); ctx.fillRect(box.x + 2, box.y + 2, 74, 20);
    A.text(ctx, lab, box.x + 8, box.y + 12, { size: 12.5, weight: 650 });
  });
  const viewB = A.canvas(cvB, { aspect: 0.26 }, (ctx, W, Hh) => {
    const box = { x: 60, y: 22, w: W - 74, h: Hh - 50 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: BANDS.length, ymin: 1e-7, ymax: 1e-1, ylog: true, xticks: [], yfmt: (v) => '10' + String(Math.round(Math.log10(v))).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]), ylabel: '误差能量（对数）', ylabelOffset: 54 });
    const kk = Math.min(k, avail()), a = get(0).snaps[kk], b = get(L).snaps[kk];
    const bw = box.w / BANDS.length;
    BANDS.forEach((bd0, i) => {
      [[a, cols[0], -1], [b, cols[1], 1]].forEach(([s, c, side]) => {
        if (!s) return; const v = A.clamp(s.band[i], 1.01e-7, 1e-1), x = box.x + bw * (i + 0.5) + side * bw * 0.13 - bw * 0.11;
        A.bar(ctx, x, ax.Y(v), bw * 0.22, ax.Y(1e-7) - ax.Y(v), c, 3);
      });
      A.text(ctx, bd0[2], box.x + bw * (i + 0.5), box.y + box.h + 12, { size: 11, align: 'center', color: A.css('--ink-2') });
    });
  });
  function render() {
    const kk = Math.min(k, avail()); slider.value = kk;
    prev.disabled = kk === 0; next.disabled = kk >= STEPS / EVERY;
    dotEls.forEach((d, i) => { d.classList.toggle('on', KEYS[i] === kk * EVERY); d.classList.toggle('done', KEYS[i] < kk * EVERY); });
    const done = get(0).done && get(L).done;
    prog.textContent = done ? '' : '训练中：已算到第 ' + avail() * EVERY + ' 步';
    const a = get(0).snaps[kk], b = get(L).snaps[kk];
    stats.innerHTML = '';
    const e = (v) => (v < 1e-4 ? v.toExponential(1) : v.toFixed(4));
    [['原始坐标：训练误差 / 测试误差', a ? e(a.tr) + ' / ' + e(a.te) : '…', cols[0]], ['位置编码 L = ' + L + '：训练误差 / 测试误差', b ? e(b.tr) + ' / ' + e(b.te) : '…', cols[1]]]
      .forEach(([kx, v, c]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kx), A.el('div', { class: 'v', style: { fontSize: '16px', color: c, fontFamily: 'var(--mono)' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${A.css('--ink-2')}"></i>要拟合的信号（灰点：128 个训练点）</span><span><i class="line" style="background:${cols[0]}"></i>输入原始坐标 x</span><span><i class="line" style="background:${cols[1]}"></i>输入位置编码 γ(x)，L = ${L}</span><span>下图：两者的误差按频率（每单位多少个周期）拆开</span>`;
    view.redraw(); viewB.redraw();
  }
  render();
  kick();
});
