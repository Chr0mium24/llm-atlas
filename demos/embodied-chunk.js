/* embodied-chunk — 动作块长度 k 的权衡（玩具模型）：决策次数 T/k 变少，误差累积减轻；块越长、推理越慢，对推扰的反应越晚。成功率 = (1−ε k^α)^{T/k} · exp(−λ·P(来不及)) */
A.defineDemo('embodied-chunk', function (mount) {
  const { bd } = A.demo(mount, '动作块该切多长：少做决定，但反应更晚', '玩具模型 · 50 Hz 控制、10 秒任务（500 步）；每次决策有小概率出一个无法挽回的错；随机的推扰必须在 300 毫秒内被纠正');
  const F = 50, TS = 10, T = F * TS, D = 0.3, KMAX = 100;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const kS = A.slider(ctl, { label: '动作块长度 k', min: 1, max: KMAX, log: true, step: 0.01, value: 10, fmt: (v) => Math.round(v) + ' 步 = ' + Math.round((Math.round(v) / F) * 1000) + ' ms', on: () => draw(), width: 190 });
  const eS = A.slider(ctl, { label: '每次决策出错的概率 ε', min: 0.0005, max: 0.01, step: 0.0005, value: 0.002, fmt: (v) => A.pct(v, 2), on: () => draw(), width: 170 });
  const aS = A.slider(ctl, { label: '块内误差随 k 增长的指数 α', min: 0, max: 1, step: 0.05, value: 0.3, fmt: (v) => v.toFixed(2), on: () => draw(), width: 170 });
  const lS = A.slider(ctl, { label: '每 10 秒的推扰次数 λ', min: 0, max: 6, step: 0.5, value: 2, fmt: (v) => v.toFixed(1), on: () => draw(), width: 150 });
  const LS = A.slider(ctl, { label: '一次推理的延迟 L', min: 20, max: 300, step: 10, value: 100, fmt: (v) => v + ' ms', on: () => draw(), width: 150 });
  const mode = A.seg(ctl, [{ v: 'sync', t: '同步：推理时停下' }, { v: 'async', t: '异步：边执行边推理' }], 'sync', () => draw(), '执行方式');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const cv2 = A.el('canvas', { class: 'cv', style: { marginTop: '8px' } }); bd.append(cv2);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();

  const par = () => ({ eps: eS.value, alpha: aS.value, lam: lS.value, L: LS.value / 1000, async: mode.value === 'async' });
  function model(p, k) {
    const N = Math.ceil(T / k), ec = Math.min(1, p.eps * Math.pow(k, p.alpha));
    const P1 = Math.pow(1 - ec, N);
    const cycle = p.async ? Math.max(k / F, p.L) : p.L + k / F;
    const miss = D <= p.L ? 1 : Math.max(0, 1 - (D - p.L) / cycle);
    const P2 = Math.exp(-p.lam * miss);
    const idle = p.async ? Math.max(0, 1 - (k / F) / cycle) : p.L / cycle;
    return { k, N, ec, P1, P2, P: P1 * P2, miss, idle, cycle, worst: cycle + p.L };
  }
  const kNow = () => Math.round(kS.value);
  let hovK = null;

  const view = A.canvas(cv, { get aspect() { return cv.clientWidth < 520 ? 0.75 : 0.44; } }, (ctx, W, H) => {
    const p = par(), box = { x: 52, y: 26, w: W - 70, h: H - 62 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: KMAX, xlog: true, xticks: [1, 2, 5, 10, 20, 50, 100], ymin: 0, ymax: 1, yfmt: (v) => A.pct(v, 0), xfmt: (v) => String(v), xlabel: '动作块长度 k（步，对数）', ylabel: '任务成功率', ylabelOffset: 44 });
    const curve = (key, c, w, dash) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let k = 1; k <= KMAX; k++) { const r = model(p, k), x = ax.X(k), y = ax.Y(r[key]); k > 1 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); };
    curve('P1', cols[0], 2, [6, 4]); curve('P2', cols[1], 2, [2, 3]); curve('P', cols[2], 3.2);
    let best = model(p, 1); for (let k = 2; k <= KMAX; k++) { const r = model(p, k); if (r.P > best.P + 1e-12) best = r; }
    const bx = ax.X(best.k), by = ax.Y(best.P);
    ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.moveTo(bx, by - 9); ctx.lineTo(bx - 6, by - 18); ctx.lineTo(bx + 6, by - 18); ctx.closePath(); ctx.fill();
    A.text(ctx, '最优 k = ' + best.k, A.clamp(bx, box.x + 40, box.x + box.w - 40), by - 26, { size: 12, weight: 650, align: 'center', color: cols[2] });
    const kk = hovK || kNow(), r = model(p, kk), x = ax.X(kk);
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
    [['P1', cols[0]], ['P2', cols[1]], ['P', cols[2]]].forEach(([key, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, ax.Y(r[key]), key === 'P' ? 5.5 : 4, 0, 7); ctx.fill(); });
    view._ax = ax; view._box = box;
  });
  cv.addEventListener('mousemove', (e) => {
    const ax = view._ax, box = view._box; if (!ax) return;
    const q = A.pos(cv, e);
    if (q.x < box.x || q.x > box.x + box.w) { hovK = null; A.tip.hide(); view.redraw(); return; }
    hovK = A.clamp(Math.round(ax.invX(q.x)), 1, KMAX);
    const r = model(par(), hovK);
    A.tip.show(`<b>k = ${hovK} 步（${Math.round((hovK / F) * 1000)} ms）</b><br>决策次数 ${r.N}，每块出错 ${A.pct(r.ec, 2)}<br>只看误差累积：${A.pct(r.P1, 1)}<br>推扰来不及纠正的概率：${A.pct(r.miss, 0)}，只看反应：${A.pct(r.P2, 1)}<br><b>两者相乘：${A.pct(r.P, 1)}</b>`, e.clientX, e.clientY);
    view.redraw();
  });
  cv.addEventListener('mouseleave', () => { hovK = null; A.tip.hide(); view.redraw(); });

  // timeline of the first 1.5 s for the current k: when the robot observes, thinks, moves, and when it reacts to one push
  const TP = 0.53, TW = 1.5;
  const tl = A.canvas(cv2, { height: 134 }, (ctx, W, H) => {
    const p = par(), k = kNow(), r = model(p, k);
    const x0 = 70, w = W - 86, X = (t) => x0 + (t / TW) * w;
    const rowI = 24, rowE = 52, rh = 16;
    A.text(ctx, '推理', x0 - 8, rowI + rh / 2, { size: 12, align: 'right', color: A.css('--muted') });
    A.text(ctx, '执行动作', x0 - 8, rowE + rh / 2, { size: 12, align: 'right', color: A.css('--muted') });
    ctx.fillStyle = A.css('--grid'); ctx.fillRect(x0, rowE, w, rh);
    for (let j = 0; ; j++) {
      const t0 = j * r.cycle; if (t0 > TW) break;
      const a = X(t0), b = X(Math.min(TW, t0 + p.L));
      ctx.fillStyle = A.alpha(cols[3], 0.75); ctx.fillRect(a, rowI, Math.max(1, b - a - 1), rh);
      ctx.fillStyle = A.css('--ink'); ctx.fillRect(a - 1, rowI - 5, 2, rh + 10);
      const e0 = t0 + p.L, e1 = Math.min(TW, e0 + k / F);
      if (e0 < TW) { ctx.fillStyle = A.alpha(j % 2 ? cols[0] : cols[4], 0.8); ctx.fillRect(X(e0), rowE, Math.max(1, X(e1) - X(e0) - 1), rh); }
    }
    const tObs = Math.ceil(TP / r.cycle - 1e-9) * r.cycle;
    // push and reaction
    const tR = tObs + p.L, ok = tR - TP <= D + 1e-9;
    const px = X(TP), py = rowE + rh + 10;
    ctx.fillStyle = A.css('--bad'); ctx.beginPath(); ctx.moveTo(px, rowE - 2); ctx.lineTo(px - 6, rowE - 12); ctx.lineTo(px + 6, rowE - 12); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.strokeStyle = A.css('--bad'); ctx.setLineDash([4, 3]); const dx = X(Math.min(TW, TP + D)); ctx.beginPath(); ctx.moveTo(dx, rowI - 6); ctx.lineTo(dx, py + 6); ctx.stroke(); ctx.restore();
    A.arrow(ctx, px, py, X(Math.min(TW, tR)), py, ok ? A.css('--good') : A.css('--bad'), 2, 7);
    const ms = Math.round((tR - TP) * 1000), msg = W < 560 ? `推扰后 ${ms} ms 才反应（截止 300 ms）· ${ok ? '来得及' : '来不及'}` : `推扰（红三角）后 ${ms} ms 才有新动作 · 截止 300 ms（红虚线）· ${ok ? '这一次来得及' : '这一次来不及'}`;
    A.text(ctx, msg, x0, py + 26, { size: 12, color: ok ? A.css('--ink-2') : A.css('--bad') });
    A.text(ctx, '0', x0, 10, { size: 11, color: A.css('--muted'), align: 'center' });
    [0.5, 1, 1.5].forEach((t) => A.text(ctx, t + ' s', X(t), 10, { size: 11, color: A.css('--muted'), align: 'center' }));
  });

  function draw() {
    const p = par(), k = kNow(), r = model(p, k);
    stats.innerHTML = '';
    const slow = (TS / Math.max(0.01, 1 - r.idle)).toFixed(1);
    [['决策次数 T/k', r.N + ' 次'], ['只看误差累积', A.pct(r.P1, 1)], ['推扰来不及纠正', A.pct(r.miss, 0)], ['总成功率', A.pct(r.P, 1)], ['停下来等推理的时间', A.pct(r.idle, 0) + ' <small>（10 秒的动作要 ' + slow + ' 秒）</small>']]
      .forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    legend.innerHTML = `<span><i class="line" style="background:${cols[0]}"></i>只看误差累积：(1 − ε·k<sup>α</sup>)<sup>T/k</sup></span><span><i class="line" style="background:${cols[1]}"></i>只看反应：推扰都在 300 ms 内被纠正的概率</span><span><i class="line" style="background:${cols[2]}"></i>两者相乘：总成功率</span><span>下图（前 1.5 秒）：<i style="background:${A.css('--ink')};width:3px"></i>拍照观测 <i style="background:${cols[3]}"></i>推理 <i style="background:${cols[4]}"></i><i style="background:${cols[0]}"></i>执行动作块（两色交替） <i style="background:${A.css('--grid')}"></i>停着等</span>`;
    const L = LS.value, blind = Math.round((r.cycle + p.L) * 1000);
    let msg;
    if (p.alpha >= 0.95) msg = '把 α 调到 1：一块 k 步的出错概率正好是单步的 k 倍，决策次数少了 k 倍，两者抵消，虚线变平，分块对误差累积毫无帮助。分块之所以有用，前提是“一次预测一段”的出错概率比“一步一步分别预测”增长得慢（α &lt; 1），这一点下面的推导会讲。';
    else if (p.lam === 0) msg = '没有推扰时，块越长越好：决策次数越少，误差累积越轻，反应慢一点也无所谓。叠衣服、装盒子这类没人打扰的任务接近这种情况，所以 π0 一次生成 50 步。';
    else if (!p.async && k < 5) msg = `块很短时，同步执行的机器人大部分时间在等推理：每走 ${Math.round((k / F) * 1000)} ms 就要停 ${L} ms。即使成功率还过得去，动作也是一顿一顿的，慢几倍。这正是要么加长动作块、要么改成异步执行的原因。`;
    else if (p.async) msg = `异步执行时，下一块在当前块执行的同时计算，机器人不再停顿；只要块长不短于推理延迟（k ≥ L·f = ${Math.ceil((L / 1000) * F)} 步），反应时间最多是“一块的时长 + 一次推理”= ${blind} ms。Physical Intelligence 的实时分块（RTC）、Figure Helix 的快慢双系统都属于这类做法。`;
    else if (2 * L + 1000 / F > D * 1000) msg = `推理延迟 ${L} ms 已超过截止时间的一半：同步执行时最坏要等“块长 + 两次推理延迟”，哪怕 k = 1 也要 ${2 * L + 1000 / F} ms，超过 300 ms，任何块长都有来不及的时候。点线（反应）整体压低，短块也救不回来，最优点反而移回长块：反正来不及，不如少犯错。切换到“异步”可以省掉一次停顿。`;
    else msg = `虚线（误差累积）随 k 上升：决策次数从 500 降到 ${r.N}。点线（反应）在“块长 + 两次推理延迟”（最坏反应时间）超过 300 ms 之后下降，也就是 k > ${Math.floor((D * 1000 - 2 * L) * F / 1000)} 步；现在推扰发生后最坏要等 ${blind} ms 才有新动作。两条曲线相乘，中间有一个最优的 k。延迟在 140 ms 以内时，调大延迟会让最优点左移、峰值下降；切换到“异步”，峰值明显升高。`;
    hint.innerHTML = msg;
    view.redraw(); tl.redraw();
  }
  draw();
});
