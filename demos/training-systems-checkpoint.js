/* training-systems-checkpoint — how often to save a checkpoint: wasted fraction vs interval under Poisson failures (exact expectation) and the Young first-order optimum sqrt(2CM) */
A.defineDemo('training-systems-checkpoint', function (mount) {
  const { bd } = A.demo(mount, '多久存一次检查点', '故障随机发生（泊松过程）；实线是浪费的精确期望，虚线是三项各自的一阶近似；默认值按 Llama 3 的故障率标定');
  // Llama 3: 419 unexpected interruptions in 54 days on 16,384 GPUs -> cluster MTBF 3.09 h -> per-GPU equivalent ≈ 5.8 years
  let lgG = Math.log10(16384), yrs = 5.8, lgC = Math.log10(30), lgR = Math.log10(5);
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: 'GPU 数', min: 3, max: 6, step: 0.01, value: lgG, fmt: (v) => A.human(Math.round(Math.pow(10, v)), 1), on: (v) => { lgG = v; draw(); }, width: 170 });
  A.slider(ctl, { label: '平均每张卡多少年摊到一次中断', min: 1, max: 20, step: 0.1, value: yrs, fmt: (v) => v.toFixed(1) + ' 年', on: (v) => { yrs = v; draw(); }, width: 210 });
  A.slider(ctl, { label: '保存一次检查点让训练停多久 C', min: 0, max: Math.log10(900), step: 0.01, value: lgC, fmt: (v) => fmtS(Math.pow(10, v)), on: (v) => { lgC = v; draw(); }, width: 210 });
  A.slider(ctl, { label: '每次中断后重启要多久 R', min: Math.log10(0.5), max: Math.log10(60), step: 0.01, value: lgR, fmt: (v) => fmtM(Math.pow(10, v)), on: (v) => { lgR = v; draw(); }, width: 190 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  function fmtS(s) { return s < 60 ? (s < 10 ? s.toFixed(1) : s.toFixed(0)) + ' 秒' : (s / 60).toFixed(1) + ' 分钟'; }
  function fmtM(m) { return m < 1 ? (m * 60).toFixed(0) + ' 秒' : m < 120 ? (m < 100 ? m.toFixed(1) : m.toFixed(0)) + ' 分钟' : (m / 60).toFixed(1) + ' 小时'; }
  // all times in minutes
  const waste = (T, C, R, M) => 1 - T / (M * Math.exp(R / M) * (Math.exp((T + C) / M) - 1));
  const TMIN = 0.2, TMAX = 2880;
  function par() {
    const G = Math.round(Math.pow(10, lgG)), M = yrs * 365 * 24 * 60 / G, C = Math.pow(10, lgC) / 60, R = Math.pow(10, lgR);
    let bt = TMIN, bw = 1;
    for (let i = 0; i <= 3000; i++) { const T = TMIN * Math.pow(TMAX / TMIN, i / 3000), w = waste(T, C, R, M); if (w < bw) { bw = w; bt = T; } }
    return { G, M, C, R, Ty: Math.sqrt(2 * C * M), bt, bw };
  }
  let P;
  const BOX = (W, H) => ({ x: 58, y: 28, w: W - 80, h: H - 66 });
  const copt = { aspect: 0.46 };
  const view = A.canvas(cv, copt, (ctx, W, H) => {
    const want = W < 560 ? 0.8 : 0.46;
    if (copt.aspect !== want) { copt.aspect = want; requestAnimationFrame(() => view.redraw()); return; }
    const box = BOX(W, H);
    const ymax = P.bw > 0.45 ? 1 : P.bw > 0.2 ? 0.6 : 0.3;
    const ax = A.axes(ctx, box, { xmin: TMIN, xmax: TMAX, xlog: true, ymin: 0, ymax, xticks: [0.5, 1, 5, 15, 60, 240, 1440], xfmt: (v) => (v < 60 ? v + ' 分' : v / 60 + ' 时'), yfmt: (v) => A.pct(v, 0), xlabel: '两次保存之间的训练时间 T（对数）', ylabel: '浪费掉的时间比例', ylabelOffset: 48 });
    const line = (fn, c, w, dash) => {
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath();
      let on = false;
      for (let i = 0; i <= 240; i++) { const T = TMIN * Math.pow(TMAX / TMIN, i / 240), y = fn(T); if (!isFinite(y) || y > ymax * 1.02) { on = false; continue; } const px = ax.X(T), py = ax.Y(Math.max(0, y)); on ? ctx.lineTo(px, py) : ctx.moveTo(px, py); on = true; }
      ctx.stroke(); ctx.restore();
    };
    line((T) => P.C / T, cols[1], 1.6, [5, 4]);
    line((T) => T / (2 * P.M), cols[2], 1.6, [5, 4]);
    line(() => P.R / P.M, cols[3], 1.6, [2, 3]);
    line((T) => waste(T, P.C, P.R, P.M), cols[0], 3);
    // Young optimum
    if (P.Ty > TMIN && P.Ty < TMAX) {
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(P.Ty), box.y); ctx.lineTo(ax.X(P.Ty), box.y + box.h); ctx.stroke(); ctx.restore();
      A.text(ctx, 'T* = √(2CM)', ax.X(P.Ty) + 5, box.y + 8, { size: 11.5, color: A.css('--ink-2'), weight: 600 });
    }
    if (P.bw < ymax) { ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(P.bt), ax.Y(P.bw), 5, 0, 7); ctx.fill(); A.text(ctx, '最低 ' + A.pct(P.bw, 1), ax.X(P.bt) + 8, ax.Y(P.bw) + 14, { size: 12, weight: 700, color: cols[0] }); }
  });
  cv.addEventListener('mousemove', (e) => {
    if (!P) return;
    const { x } = A.pos(cv, e), box = BOX(cv.clientWidth, 0);
    const t = (x - box.x) / box.w; if (t < 0 || t > 1) { A.tip.hide(); return; }
    const T = TMIN * Math.pow(TMAX / TMIN, t);
    A.tip.show(`每 <b>${fmtM(T)}</b> 存一次<br>浪费 ${A.pct(waste(T, P.C, P.R, P.M), 1)}<br>其中近似：存档 ${A.pct(P.C / T, 1)}，丢失工作 ${A.pct(T / (2 * P.M), 1)}，重启 ${A.pct(P.R / P.M, 1)}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    P = par();
    stats.innerHTML = '';
    const dead = P.bw >= 0.99;
    [['整个集群平均多久中断一次 M', fmtM(P.M)], ['每天中断', (1440 / P.M).toFixed(1) + ' 次'], ['Young 的最优间隔 √(2CM)', fmtM(P.Ty)], ['精确最优间隔', dead ? '—' : fmtM(P.bt)], ['最低浪费 → 有效训练时间', dead ? '≈ 100% → 0%' : A.pct(P.bw, 1) + ' → ' + A.pct(1 - P.bw, 0)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = [[cols[0], '浪费比例（精确期望）', ''], [cols[1], '存档开销 ≈ C/T', ''], [cols[2], '故障丢掉的工作 ≈ T/(2M)', ''], [cols[3], '重启 ≈ R/M', '']].map(([c, n]) => `<span><i class="line" style="background:${c}"></i>${n}</span>`).join('');
    const sq = Math.sqrt(2 * P.C / P.M), cap = (x) => A.pct(Math.min(1, x), 1);
    if (dead) { hint.innerHTML = '故障间隔 M = ' + fmtM(P.M) + '，已经和重启时间、存档时间同一量级甚至更短：无论多久存一次，几乎都在存档、重启和重做中度过，训练无法推进。只能减少同步的卡数，或者把 C 和 R 压到远小于 M。'; view.redraw(); return; }
    let msg = `存得太勤，时间都花在存档上（左边上翘）；存得太少，每次故障要从很久以前的检查点重来（右边上翘）。最优点附近两条虚线相交：存档开销和丢失的工作正好相等，合计约 √(2C/M) = ${cap(sq)}，再加上重启的 R/M = ${cap(P.R / P.M)}。`;
    if (P.bw > 0.2) msg += ' 现在浪费已经超过 20%：故障太频繁，单靠调间隔救不回来，只能把 C 和 R 本身压下去（异步保存、从内存里的副本恢复、热备机器），或者减少同步的卡数。';
    else if (P.G >= 1e5) msg += ' 把 GPU 数从 1.6 万拉到 10 万以上，M 缩短到半小时以内，浪费按 √(1/M) 放大；保持 90% 有效时间，需要 C 和 R 随之缩短。';
    else msg += ' 试着把 GPU 数往右拉十倍，看最低浪费怎么变。';
    hint.innerHTML = msg;
    view.redraw();
  }
  draw();
});
