/* coding-sample-filter — sample k patches, keep those that pass the tests, submit one: accuracy saturates at the verifier's precision, false submissions keep growing, net value peaks at a finite k */
A.defineDemo('coding-sample-filter', function (mount) {
  const { bd } = A.demo(mount, '采样 k 个补丁、用测试挑一个：采得越多越好吗', '玩具模型：一批题目，每题的单次正确率 p 参差不齐（p = u^γ，u 在 0–1 均匀），错误补丁以概率 φ 骗过测试；在通过测试的补丁里随机提交一个，都不通过就放弃');
  let lgk = 1, mu = 0.3, phi = 0.05, cost = 1;
  const M = 1500;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '每题采样的补丁数 k', min: 0, max: 3, step: 0.02, value: lgk, fmt: (v) => Math.round(Math.pow(10, v)) + ' 个', on: (v) => { lgk = v; draw(); }, width: 200 });
  A.slider(ctl, { label: '模型的平均单次正确率', min: 0.05, max: 0.8, step: 0.05, value: mu, fmt: (v) => A.pct(v, 0), on: (v) => { mu = v; draw(); }, width: 190 });
  A.slider(ctl, { label: '误放率 φ（错误补丁通过测试的概率）', min: 0, max: 0.3, step: 0.01, value: phi, fmt: (v) => A.pct(v, 0), on: (v) => { phi = v; draw(); }, width: 240 });
  A.slider(ctl, { label: '提交一个错误补丁的代价 c（以“修好一题”为 1）', min: 0, max: 3, step: 0.1, value: cost, fmt: (v) => v.toFixed(1), on: (v) => { cost = v; draw(); }, width: 280 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);

  let ps = [];
  const setPs = () => { const g = 1 / mu - 1; ps = Array.from({ length: M }, (_, i) => Math.pow((i + 0.5) / M, g)); };
  // per-problem: P_correct = π(1 − (1 − p − w)^k), π = p/(p + w), w = (1 − p)φ
  function at(k) {
    let acc = 0, wrong = 0, oracle = 0, ceil = 0;
    for (const p of ps) {
      const w = (1 - p) * phi, pass = p + w, any = 1 - Math.pow(1 - pass, k), pr = pass > 0 ? p / pass : 0;
      acc += pr * any; wrong += (1 - pr) * any; oracle += 1 - Math.pow(1 - p, k); ceil += pass > 0 ? pr : 0;
    }
    return { acc: acc / M, wrong: wrong / M, oracle: oracle / M, ceil: ceil / M, util: (acc - cost * wrong) / M };
  }
  const KS = Array.from({ length: 121 }, (_, i) => Math.pow(10, i / 40));
  let curve = [], best = null;
  function compute() {
    setPs();
    curve = KS.map((k) => Object.assign({ k }, at(k)));
    best = curve.reduce((b, o) => (o.util > b.util ? o : b), curve[0]);
  }
  // degenerate ends: every k loses (better to give up) / utility flat up to k = 1000 (more is never worse)
  const bestKind = () => (best.util <= 0 ? 'none' : curve[curve.length - 1].util >= best.util - 1e-3 ? 'flat' : 'peak');
  const bestText = () => ({ none: '不如放弃（k = 0）', flat: 'k 越大越好（已饱和）', peak: '约 ' + Math.round(best.k) })[bestKind()];
  const C = () => { const c = A.series(); return { oracle: c[0], acc: c[2], wrong: c[7], util: c[6] }; };
  const v1 = A.canvas(cv1, { aspect: 0.78 }, (ctx, W, H) => {
    const c = C();
    const box = { x: 46, y: 26, w: W - 60, h: H - 70 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 1000, xlog: true, ymin: 0, ymax: 1, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => A.pct(v, 0), xfmt: (v) => String(v), xlabel: '采样数 k（对数）', ylabel: '占全部题目的比例', ylabelOffset: 40 });
    const line = (f, color, w, dash) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); curve.forEach((o, i) => { const x = ax.X(o.k), y = ax.Y(f(o)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore(); };
    const ceil = curve[0].ceil;
    ctx.save(); ctx.strokeStyle = A.alpha(c.acc, 0.7); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(ceil)); ctx.lineTo(box.x + box.w, ax.Y(ceil)); ctx.stroke(); ctx.restore();
    A.text(ctx, '天花板 ' + A.pct(ceil, 0), box.x + 4, ax.Y(ceil) - 8, { size: 11, color: c.acc });
    line((o) => o.oracle, c.oracle, 2, [6, 4]);
    line((o) => o.acc, c.acc, 3);
    line((o) => o.wrong, c.wrong, 2);
    const k = Math.pow(10, lgk), o = at(k);
    [[o.oracle, c.oracle], [o.acc, c.acc], [o.wrong, c.wrong]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax.X(k), ax.Y(v), 4.5, 0, 7); ctx.fill(); });
  });
  const v2 = A.canvas(cv2, { aspect: 0.78 }, (ctx, W, H) => {
    const c = C();
    const lo = Math.min(-0.1, ...curve.map((o) => o.util)), hi = Math.max(0.2, ...curve.map((o) => o.util));
    const ymin = Math.floor(lo * 10) / 10, ymax = Math.ceil(hi * 10) / 10;
    const box = { x: 46, y: 26, w: W - 60, h: H - 70 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 1000, xlog: true, ymin, ymax, yfmt: (v) => v.toFixed(1), xfmt: (v) => String(v), xlabel: '采样数 k（对数）', ylabel: '净收益 = 修好 − c × 错误提交', ylabelOffset: 40 });
    if (ymin < 0) { ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore(); }
    ctx.save(); ctx.strokeStyle = c.util; ctx.lineWidth = 3; ctx.beginPath(); curve.forEach((o, i) => { const x = ax.X(o.k), y = ax.Y(o.util); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
    if (bestKind() === 'peak') {
      ctx.save(); ctx.strokeStyle = c.util; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(best.k), box.y); ctx.lineTo(ax.X(best.k), box.y + box.h); ctx.stroke(); ctx.restore();
      A.text(ctx, '最佳 k ≈ ' + Math.round(best.k), ax.X(best.k) + 5, box.y + 8, { size: 11.5, color: c.util, weight: 600 });
    } else A.text(ctx, bestKind() === 'none' ? '每个 k 都亏：不如不交' : '净收益已饱和：k 越大越好', box.x + 6, box.y + 8, { size: 11.5, color: c.util, weight: 600 });
    const k = Math.pow(10, lgk), o = at(k);
    ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(ax.X(k), ax.Y(o.util), 4.5, 0, 7); ctx.fill();
  });
  [cv1, cv2].forEach((cv) => {
    cv.addEventListener('mousemove', (e) => {
      const { x } = A.pos(cv, e), W = cv.clientWidth, bx = 46, bw = W - 60;
      const k = Math.pow(10, A.clamp((x - bx) / bw, 0, 1) * 3), o = at(k);
      A.tip.show(`k = ${Math.round(k)}<br>完美验证器（pass@k）：${A.pct(o.oracle, 1)}<br>用测试挑选后真正修好：${A.pct(o.acc, 1)}<br>提交了错误补丁：${A.pct(o.wrong, 1)}<br>净收益：${o.util.toFixed(3)}`, e.clientX, e.clientY);
    });
    cv.addEventListener('mouseleave', () => A.tip.hide());
  });
  function draw() {
    compute();
    const c = C(), k = Math.pow(10, lgk), o = at(k);
    legend.innerHTML = '';
    [[c.oracle, '有完美验证器时（pass@k）', true], [c.acc, '用测试挑选后真正修好'], [c.wrong, '提交了骗过测试的错误补丁'], [c.util, '净收益（右图）']].forEach(([col, t, dash]) => legend.append(A.el('span', null, A.el('i', { class: 'line', style: { background: dash ? 'repeating-linear-gradient(90deg,' + col + ' 0 5px,transparent 5px 8px)' : col } }), t)));
    stats.innerHTML = '';
    const fp = o.acc + o.wrong > 0 ? o.wrong / (o.acc + o.wrong) : 0;
    [['k = ' + Math.round(k) + '：真正修好', A.pct(o.acc, 1)], ['完美验证器下（pass@k）', A.pct(o.oracle, 1)], ['提交的补丁里错的比例', A.pct(fp, 1)], ['净收益最高的 k', bestText()]]
      .forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    let msg;
    if (phi === 0) msg = '误放率为 0 时，测试就是完美验证器：用测试挑选的结果和 pass@k 完全重合，采样越多越好，没有天花板。这正是 Codex、AlphaCode 这类“多采样加筛选”的理想情形。把 φ 调到 5% 看看会发生什么。';
    else msg = '虚线是“有完美验证器”时的上限，它随 k 一直涨向 100%；实线是用不完美的测试挑出来的结果，到几十个样本就停在天花板 ' + A.pct(curve[0].ceil, 0) + '。差别来自难题：单次正确率很低的题，通过测试的补丁大多是骗过测试的错误补丁，采得越多，越容易“找到”一个。所以红线一直在涨，提交的补丁里错的比例从 k = 1 时的 ' + A.pct(curve[0].wrong / (curve[0].acc + curve[0].wrong), 0) + ' 涨到 ' + A.pct(curve[120].wrong / (curve[120].acc + curve[120].wrong), 0) + '。' + (cost > 0 ? ({ peak: '错误提交有代价时，净收益在 k ≈ ' + Math.round(best.k) + ' 处最高，再多采样反而吃亏。', none: '这组设定下错误提交的代价压过了修好的收益：每个 k 的净收益都为负，一个都不交（k = 0）反而最好。', flat: '这组设定下净收益一直不降：错误补丁太少，多采样不亏。' })[bestKind()] : '如果错误提交没有代价，多采样永远不亏；但真实工作中合并一个错误补丁的代价往往比“没修”更大。');
    hint.innerHTML = msg;
    v1.redraw(); v2.redraw();
  }
  draw();
});
