/* serving-goodput — toy continuous-batching server (70B on 8×H100) under Poisson load: TTFT/TPOT tails and goodput = λ × SLO attainment vs arrival rate; prefill-first vs chunked prefill, batch cap */
A.defineDemo('serving-goodput', function (mount) {
  const { bd } = A.demo(mount, '负载与延迟：有效吞吐的拐点', '玩具模拟：8×H100 跑 70B（同上文），泊松到达；提示 1K–7K token，输出平均约 1000 token；每个到达率模拟 400 个请求，步长按 roofline 估算');
  const M = { N: 70.6e9, L: 80, AT: 4 * 80 * 64 * 128, BW: 26.8e12, P: 7.912e15, UP: 0.5, KV: 327680, CAP: 448.8e9 / 327680 };
  const LAMS = []; for (let l = 0.25; l <= 6.001; l += 0.25) LAMS.push(+l.toFixed(2));
  let lam = 3.5, maxB = 64, chunked = false, sloT = 2, sloP = 0.03;
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.slider(c1, { label: '到达率 λ', min: 0.25, max: 6, step: 0.25, value: lam, fmt: (v) => v.toFixed(2) + ' 请求/秒', on: (v) => { lam = v; show(); }, width: 200 });
  A.seg(c1, [32, 64, 128, 256].map((v) => ({ v, t: String(v) })), maxB, (v) => { maxB = v; start(); }, '批上限');
  A.seg(c1, [{ v: false, t: '预填充优先' }, { v: true, t: '分块预填充' }], chunked, (v) => { chunked = v; start(); }, '调度');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  A.slider(c2, { label: 'SLO：首 token 延迟 ≤', min: 0.5, max: 5, step: 0.25, value: sloT, fmt: (v) => v.toFixed(2) + ' s', on: (v) => { sloT = v; show(); }, width: 200 });
  A.slider(c2, { label: 'SLO：每 token 间隔 ≤', min: 10, max: 100, step: 5, value: sloP * 1e3, fmt: (v) => v + ' ms', on: (v) => { sloP = v / 1e3; show(); }, width: 200 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' }); bd.append(grid);
  const cvL = A.el('canvas', { class: 'cv' }), cvR = A.el('canvas', { class: 'cv' }); grid.append(cvL, cvR);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();

  function rng(seed) { return A.rng(seed); }
  // one run: per-request TTFT/TPOT, plus time-averaged number in system and mean stay over a steady window (Little's law holds for time averages)
  function runSim(lambda, cap, ch, nreq) {
    const { N, AT, BW, P, UP, KV, CAP } = M, W = N * 2;
    const r = rng(11), Q = []; let at = 0;
    for (let i = 0; i < nreq; i++) { at += -Math.log(1 - r()) / lambda; Q.push({ at, p: 1000 + Math.floor(r() * 6000), o: Math.min(4000, Math.round(30 - Math.log(1 - r()) * 970)), pre: 0, done: 0, first: -1, fin: -1, st: 0 }); }
    let t = 0, next = 0, used = 0; const wait = []; let run = [];
    while (next < nreq || wait.length || run.length) {
      while (next < nreq && Q[next].at <= t) wait.push(Q[next++]);
      if (!wait.length && !run.length) { t = Q[next].at; continue; }
      while (wait.length && run.length < cap && used + wait[0].p + wait[0].o <= CAP) { const q = wait.shift(); used += q.p + q.o; run.push(q); }
      let pend = 0; for (const q of run) if (q.st === 0) pend++;
      if (!ch && pend) { // whole prompts at once; running decodes stall
        let tok = 0, c = 0; for (const q of run) if (q.st === 0) { tok += q.p; c += (q.p * q.p) / 2; }
        t += Math.max(W / BW, (2 * N * tok + AT * c) / (P * UP));
        for (const q of run) if (q.st === 0) { q.st = 1; q.first = t; q.done = 1; }
        continue;
      }
      let ctx = 0, B = 0; for (const q of run) if (q.st === 1) { ctx += q.p + q.done; B++; }
      let room = Math.max(0, 2048 - B), ct = 0, ca = 0; const fin = [];
      if (ch) for (const q of run) { if (room <= 0) break; if (q.st !== 0) continue; const c = Math.min(room, q.p - q.pre); ca += c * (q.pre + c / 2); q.pre += c; room -= c; ct += c; if (q.pre >= q.p) fin.push(q); }
      const mem = (W + ctx * KV) / BW, comp = (2 * N * B + AT * ctx) / P + (2 * N * ct + AT * ca) / (P * UP);
      t += Math.max(mem, comp);
      for (const q of run) if (q.st === 1) { q.done++; if (q.done >= q.o) { q.fin = t; q.st = 2; used -= q.p + q.o; } }
      for (const q of fin) { q.st = 1; q.first = t; q.done = 1; }
      run = run.filter((q) => q.st !== 2);
      if (t > 4000) break;
    }
    const S = Q.slice(Math.floor(nreq / 6));
    const w0 = Q[Math.floor(nreq / 6)].at, w1 = Q[Math.floor((nreq * 5) / 6)].at;
    const nSys = Q.reduce((a, q) => a + Math.max(0, Math.min(q.fin >= 0 ? q.fin : t, w1) - Math.max(q.at, w0)), 0) / (w1 - w0);
    const F = S.filter((q) => q.fin >= 0), stay = F.length ? F.reduce((a, q) => a + q.fin - q.at, 0) / F.length : 1e9;
    return { nSys, stay: F.length === S.length ? stay : 1e9, S: S.map((q) => ({ tt: q.first >= 0 ? q.first - q.at : 1e9, tp: q.fin >= 0 ? (q.fin - q.first) / Math.max(1, q.o - 1) : 1e9 })) };
  }
  function evalRun(R) {
    const tt = R.S.map((s) => s.tt).sort((a, b) => a - b), tp = R.S.map((s) => s.tp).sort((a, b) => a - b);
    const q = (a, x) => a[Math.floor(x * (a.length - 1))];
    const ok = R.S.filter((s) => s.tt <= sloT && s.tp <= sloP).length / R.S.length;
    return { ttft90: q(tt, 0.9), tpot90: q(tp, 0.9), att: ok };
  }

  const cache = {}; let job = 0;
  const key = () => maxB + '|' + chunked;
  function start() {
    const k = key(); if (!cache[k]) cache[k] = {};
    const my = ++job;
    const step = () => {
      if (my !== job) return;
      const C = cache[k]; let n = 0;
      for (const l of LAMS) { if (C[l]) continue; C[l] = runSim(l, maxB, chunked, 400); if (++n >= 3) break; }
      show();
      if (LAMS.some((l) => !C[l])) setTimeout(step, 0);
    };
    step();
  }

  const pts = () => { const C = cache[key()] || {}; return LAMS.filter((l) => C[l]).map((l) => ({ l, ...evalRun(C[l]) })); };
  const vline = (ctx, ax, box) => { const x = ax.X(lam); ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore(); };
  const hline = (ctx, box, y, label, c) => { ctx.save(); ctx.strokeStyle = c; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.restore(); A.text(ctx, label, box.x + 4, y - 8, { size: 11, color: c }); };
  const poly = (ctx, ax, P, f, c, w) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); P.forEach((p, i) => { const y = f(p); i ? ctx.lineTo(ax.X(p.l), y) : ctx.moveTo(ax.X(p.l), y); }); ctx.stroke(); P.forEach((p) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ax.X(p.l), f(p), 2.4, 0, 7); ctx.fill(); }); ctx.restore(); };

  const left = A.canvas(cvL, { height: 440 }, (ctx, W, H) => {
    const P = pts(), hh = (H - 92) / 2;
    const b1 = { x: 52, y: 22, w: W - 66, h: hh }, b2 = { x: 52, y: 22 + hh + 38, w: W - 66, h: hh };
    const a1 = A.axes(ctx, b1, { xmin: 0, xmax: 6, ymin: 0.1, ymax: 100, ylog: true, yticks: [0.1, 1, 10, 100], yfmt: (v) => v + ' s', xfmt: () => '', ylabel: '首 token 延迟 p90（对数）', ylabelOffset: 46 });
    hline(ctx, b1, a1.Y(sloT), 'SLO ' + sloT + ' s', A.css('--bad'));
    poly(ctx, a1, P, (p) => a1.Y(A.clamp(p.ttft90, 0.1, 100)), cols[0], 2.5); vline(ctx, a1, b1);
    const a2 = A.axes(ctx, b2, { xmin: 0, xmax: 6, ymin: 0, ymax: 110, yticks: [0, 25, 50, 75, 100], yfmt: (v) => v + ' ms', xlabel: '到达率 λ（请求/秒）', ylabel: '每 token 间隔 p90', ylabelOffset: 46 });
    hline(ctx, b2, a2.Y(sloP * 1e3), 'SLO ' + Math.round(sloP * 1e3) + ' ms', A.css('--bad'));
    poly(ctx, a2, P, (p) => a2.Y(A.clamp(p.tpot90 * 1e3, 0, 110)), cols[1], 2.5); vline(ctx, a2, b2);
  });
  const right = A.canvas(cvR, { height: 440 }, (ctx, W, H) => {
    const P = pts();
    const box = { x: 46, y: 22, w: W - 60, h: H - 60 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 6, ymin: 0, ymax: 6, xlabel: '到达率 λ（请求/秒）', ylabel: '请求/秒', ylabelOffset: 40, yfmt: (v) => String(v) });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(0)); ctx.lineTo(ax.X(6), ax.Y(6)); ctx.stroke(); ctx.restore();
    A.text(ctx, '到达率（全部达标时的理想值）', ax.X(5.9), ax.Y(5.9) + 2, { size: 11, color: A.css('--muted'), align: 'right', base: 'top' });
    poly(ctx, ax, P, (p) => ax.Y(p.l * p.att), cols[2], 3); vline(ctx, ax, box);
    if (P.length) {
      const best = P.reduce((a, b) => (b.l * b.att > a.l * a.att ? b : a));
      const x = ax.X(best.l), y = ax.Y(best.l * best.att);
      ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
      A.text(ctx, '峰值 ' + (best.l * best.att).toFixed(2) + ' 请求/秒', x + (x > box.x + box.w * 0.6 ? -8 : 8), y - 14, { size: 12, weight: 600, color: cols[2], align: x > box.x + box.w * 0.6 ? 'right' : 'left' });
      const cap90 = P.filter((p) => p.att >= 0.9).reduce((a, p) => Math.max(a, p.l), 0);
      if (cap90 && P.length === LAMS.length) A.text(ctx, '90% 达标的最大到达率：' + cap90.toFixed(2), box.x + 6, box.y + 6, { size: 11.5, color: A.css('--ink-2') });
    }
    A.text(ctx, '有效吞吐 = λ × 达标率', box.x + 6, box.y + 24, { size: 11.5, weight: 600, color: cols[2] });
  });

  function show() {
    const C = cache[key()] || {}, R = C[lam];
    stats.innerHTML = '';
    if (!R) { stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, '模拟中'), A.el('div', { class: 'v', style: { fontSize: '17px' } }, '…'))); }
    else {
      const e = evalRun(R);
      const f = (s) => (s >= 1e8 ? '未完成' : s < 1 ? (s * 1e3).toFixed(0) + ' ms' : s.toFixed(1) + ' s');
      [['系统里的请求（时间平均）', R.nSys.toFixed(0) + ' 个'], ['平均停留时间', R.stay >= 1e8 ? '未完成' : R.stay.toFixed(1) + ' s'], ['首 token 延迟 p90', f(e.ttft90)], ['每 token 间隔 p90', e.tpot90 >= 1e8 ? '未完成' : (e.tpot90 * 1e3).toFixed(1) + ' ms'], ['SLO 达标率', A.pct(e.att, 0)], ['有效吞吐', (lam * e.att).toFixed(2) + ' 请求/秒']]
        .forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px', color: i === 4 ? (e.att >= 0.9 ? 'var(--good-ink)' : 'var(--bad)') : '' } }, v))));
    }
    const P = pts(), cap90 = P.length === LAMS.length ? P.filter((p) => p.att >= 0.9).reduce((a, p) => Math.max(a, p.l), 0) : 0;
    hint.innerHTML = `默认调度“预填充优先”：新请求的整段提示先算完，这期间正在解码的人全部停下。p90 = 90% 的请求不超过的值。左上：首 token 延迟在负载低时几乎不变，到某个到达率附近突然上翘（纵轴是对数），这是排队：批已经满了，新请求只能等。左下：每 token 间隔随负载缓慢上升，因为同时解码的请求越多，每一步要读的 KV 越多，插进来的预填充也越频繁。右：有效吞吐沿着对角线上升，过了拐点不是持平，而是崩塌，因为队列一旦越排越长，几乎每个请求都超时。` +
      (cap90 ? ` 当前设置下，能保证 90% 请求达标的最大到达率约 ${cap90.toFixed(2)} 请求/秒。` : '') +
      ' 试试：把调度换成分块预填充，拐点右移一点；把批上限调到 256、每 token 间隔的 SLO 收紧到 20 ms，限制你的就变成了间隔而不是排队。';
    left.redraw(); right.redraw();
  }
  start();
});
