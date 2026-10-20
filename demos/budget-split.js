/* budget-split — fixed thinking budget: one long chain vs many short chains (majority vote or verifier) */
A.defineDemo('budget-split', function (mount) {
  const { bd } = A.demo(mount, '同样的思考预算：想一条长的，还是想很多条短的', '玩具模型：一条思路的答对率随长度增长并趋于饱和 p(ℓ) = p_max·(1 − e^(−ℓ/τ))');
  let B = 32000, tau = 2000, pmax = 0.6, agg = 'vote';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '总预算（token）', min: 1000, max: 128000, log: true, value: B, fmt: (v) => A.human(v, 0), on: (v) => { B = v; draw(); }, width: 190 });
  A.slider(ctl, { label: '题目难度 τ（需要多长才能想透）', min: 300, max: 30000, log: true, value: tau, fmt: (v) => A.human(v, 0) + ' token', on: (v) => { tau = v; draw(); }, width: 220 });
  A.slider(ctl, { label: '一条思路想透后的答对率上限', min: 0.15, max: 0.95, step: 0.01, value: pmax, fmt: (v) => A.pct(v, 0), on: (v) => { pmax = v; draw(); }, width: 210 });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.seg(ctl2, [{ v: 'vote', t: '多数投票' }, { v: 'verify', t: '完美验证器（有一条对就算对）' }], agg, (v) => { agg = v; draw(); }, '多条思路怎么汇总');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const KS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
  const cols = A.series();
  const pchain = (l) => pmax * (1 - Math.exp(-l / tau));
  function vote(p, k, r) {
    const W = 0.35, others = 6, T = 1200;
    let ok = 0;
    for (let t = 0; t < T; t++) {
      const cnt = new Array(others + 2).fill(0);
      for (let i = 0; i < k; i++) { const u = r(); if (u < p) cnt[0]++; else if (u < p + (1 - p) * W) cnt[1]++; else cnt[2 + Math.floor(r() * others)]++; }
      const mx = Math.max(...cnt); const ties = cnt.filter((c) => c === mx).length;
      if (cnt[0] === mx) ok += 1 / ties;
    }
    return ok / T;
  }
  let res = [];
  function compute() {
    const r = A.rng(17);
    res = KS.map((k) => { const p = pchain(B / k); return { k, p, acc: agg === 'vote' ? vote(p, k, r) : 1 - Math.pow(1 - p, k) }; });
  }
  const view = A.canvas(cv, { aspect: 0.46 }, (ctx, W, H) => {
    const box = { x: 50, y: 20, w: W - 70, h: H - 60 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 64, xlog: true, ymin: 0, ymax: 1, xticks: [1, 2, 4, 8, 16, 32, 64], xfmt: (v) => v + ' 条', yfmt: (v) => A.pct(v, 0), xlabel: '把预算分成几条并行的思路', ylabel: '答对率', ylabelOffset: 42 });
    const line = (key, c, w, dash) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); res.forEach((p, i) => (i ? ctx.lineTo(ax.X(p.k), ax.Y(p[key])) : ctx.moveTo(ax.X(p.k), ax.Y(p[key])))); ctx.stroke(); ctx.restore(); };
    line('p', A.css('--axis'), 2, [5, 4]); line('acc', cols[0], 3);
    res.forEach((p) => { ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(p.k), ax.Y(p.acc), 3, 0, 7); ctx.fill(); });
    const b = res.reduce((a, p) => (p.acc > a.acc ? p : a), res[0]);
    ctx.strokeStyle = cols[1]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax.X(b.k), ax.Y(b.acc), 8, 0, 7); ctx.stroke();
    A.text(ctx, '最优', ax.X(b.k), ax.Y(b.acc) - 16, { size: 12, align: 'center', color: cols[1], weight: 700 });
  });
  function draw() {
    compute();
    const b = res.reduce((a, p) => (p.acc > a.acc ? p : a), res[0]);
    stats.innerHTML = '';
    [['最优分法', b.k + ' 条 × ' + A.human(B / b.k, 1) + ' token'], ['最优答对率', A.pct(b.acc, 1)], ['只想一条长的', A.pct(res[0].acc, 1)], ['每条只有 ' + A.human(B / 64, 1) + ' token 时（64 条）', A.pct(res[res.length - 1].acc, 1)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${cols[0]}"></i>汇总后的答对率</span><span><i class="line" style="background:var(--axis)"></i>单条思路的答对率（越分越短）</span>`;
    hint.innerHTML = '分得越多，每条思路越短、单条答对率越低（虚线），但汇总能弥补一部分。预算远大于题目需要的长度时（简单题），一条思路早已饱和，多想几条再投票更划算；预算紧张、题目很难时，每条都想不透，分开反而更差，应该集中预算想一条长的。这与 Snell 等（2024）在真实模型上的结论一致：最优的推理时策略取决于题目难度。多数投票还有一个陷阱：如果某个错误答案比正确答案更常见（把上限调到 30% 以下试试），票越多越稳定地选错；有可靠的验证器时则没有这个问题。';
    view.redraw();
  }
  draw();
});
