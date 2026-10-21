/* bon-goodhart — best-of-n against a proxy reward model: Gaussian vs heavy-tailed proxy error (Goodhart) */
A.defineDemo('bon-goodhart', function (mount) {
  const { bd } = A.demo(mount, '对奖励模型优化得越狠越好吗：best-of-n 与古德哈特定律', '每个候选回答的真实质量 q ~ N(0, 1)；奖励模型打分 = q + 误差；从 n 个候选里挑奖励模型分数最高的');
  let kind = 'heavy', sigma = 0.6, seed = 9;
  const NS = Array.from({ length: 13 }, (_, i) => Math.pow(2, i));
  const TRIALS = 300;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'gauss', t: '正态（误差有界）' }, { v: 'heavy', t: '重尾（偶尔错得离谱）' }], kind, (v) => { kind = v; run(); draw(); }, '奖励模型误差的分布');
  A.slider(ctl, { label: '误差尺度 σ（重尾时是 t 分布的尺度）', min: 0.1, max: 2, step: 0.05, value: sigma, fmt: (v) => v.toFixed(2), on: (v) => { sigma = v; run(); draw(); }, width: 170 });
  ctl.append(A.el('button', { onclick: () => { seed = (seed * 48271) % 2147483647; run(); draw(); } }, '重新抽样'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  let res = null;
  function run() {
    const r = A.rng(seed);
    const err = () => { const z = A.gauss(r); if (kind === 'gauss') return sigma * z; const u = Math.max(1e-12, r()); return sigma * 0.5 * z / Math.sqrt(-Math.log(u)); };
    res = NS.map((n) => {
      let sp = 0, sg = 0;
      for (let t = 0; t < TRIALS; t++) {
        let best = -Infinity, bq = 0;
        for (let i = 0; i < n; i++) { const q = A.gauss(r), s = q + err(); if (s > best) { best = s; bq = q; } }
        sp += best; sg += bq;
      }
      return { n, proxy: sp / TRIALS, gold: sg / TRIALS, kl: Math.log(n) - (n - 1) / n };
    });
  }
  const view = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    const box = { x: 50, y: 20, w: W - 70, h: H - 62 };
    const ymax = Math.min(8, Math.max(2.5, Math.ceil(Math.max(...res.map((x) => x.proxy)))));
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 4096, xlog: true, ymin: -0.5, ymax, xticks: [1, 8, 64, 512, 4096], xfmt: (v) => 'n=' + v, yfmt: (v) => v.toFixed(1), xlabel: '候选数 n（越往右，对奖励模型优化得越狠）', ylabel: '被选中回答的平均分', ylabelOffset: 44 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore();
    const line = (key, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); res.forEach((p, i) => { const y = ax.Y(A.clamp(p[key], -0.5, ymax)); i ? ctx.lineTo(ax.X(p.n), y) : ctx.moveTo(ax.X(p.n), y); }); ctx.stroke(); res.forEach((p) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ax.X(p.n), ax.Y(A.clamp(p[key], -0.5, ymax)), 3, 0, 7); ctx.fill(); }); };
    line('proxy', cols[1], 2.2); line('gold', cols[0], 3);
    const lastP = res[res.length - 1].proxy;
    if (lastP > ymax) A.text(ctx, '奖励分继续涨到 ' + lastP.toFixed(1) + ' ↑', box.x + box.w - 4, ax.Y(ymax) + 14, { size: 12, align: 'right', color: cols[1], weight: 700 });
    const bi = res.reduce((b, p, i) => (p.gold > res[b].gold ? i : b), 0);
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax.X(res[bi].n), ax.Y(res[bi].gold), 8, 0, 7); ctx.stroke();
    A.text(ctx, '真实质量最高点', ax.X(res[bi].n), ax.Y(res[bi].gold) - 16, { size: 12, align: 'center', color: cols[0], weight: 700 });
  });
  function draw() {
    const bi = res.reduce((b, p, i) => (p.gold > res[b].gold ? i : b), 0), last = res[res.length - 1];
    stats.innerHTML = '';
    [['真实质量最高时的 n', 'n = ' + res[bi].n + '（KL ≈ ' + res[bi].kl.toFixed(1) + '）'], ['那时的真实质量', res[bi].gold.toFixed(2)], ['n = 4096 时：奖励分 / 真实质量', last.proxy.toFixed(2) + ' / ' + last.gold.toFixed(2)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${cols[1]}"></i>奖励模型给的分（代理指标）</span><span><i class="line" style="background:${cols[0]}"></i>真实质量</span>`;
    hint.innerHTML = kind === 'heavy'
      ? '奖励模型偶尔会错得离谱（重尾误差）：给某个其实一般的回答打出极高的分。候选少时，挑出的主要是真正好的回答；候选越多，越容易挑中那些“骗过奖励模型”的离群者，真实质量先升后降，而奖励分一路上涨。这就是古德哈特定律：“一个指标一旦成为目标，就不再是好指标。”Gao 等（2022）在真实的奖励模型上测得了同样形状的曲线。KL 是 best-of-n 分布离原模型有多远：log n − (n−1)/n。'
      : '误差是正态的、有界的：候选越多，挑出的回答真实质量仍在上升，只是比奖励分涨得慢（挑最高分时总会顺带挑中一些“运气好”的误差）。这种温和的偏差叫回归型古德哈特。真实的奖励模型更接近重尾的情形：它有系统性的盲点（偏爱长回答、讨好用户），优化压力会专门找到这些盲点。切到“重尾”看区别。';
    view.redraw();
  }
  run(); draw();
});
