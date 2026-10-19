/* model-collapse — recursive training on own samples: replace vs accumulate; long tail disappears */
A.defineDemo('model-collapse', function (mount) {
  const { bd } = A.demo(mount, '模型崩溃：一代代用自己生成的数据训练', '词表 300 个词，真实分布是长尾的 Zipf 分布；每一代的“模型”= 上一代数据里的词频');
  const V = 300, GMAX = 30;
  const TRUE = (() => { const w = Array.from({ length: V }, (_, i) => 1 / Math.pow(i + 1, 1.1)); const z = A.sum(w); return w.map((x) => x / z); })();
  let N = 3000, seed = 5, gen = 10, mode = 'replace', sim = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'replace', t: '替换：只用上一代的生成数据' }, { v: 'acc', t: '累积：保留真实数据，新数据追加' }], mode, (v) => { mode = v; draw(); }, '训练方式');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.slider(ctl2, { label: '每代生成的样本数 N', min: 500, max: 20000, step: 500, value: N, fmt: (v) => v.toLocaleString(), on: (v) => { N = v; run(); draw(); }, width: 200 });
  A.slider(ctl2, { label: '查看第几代', min: 0, max: GMAX, step: 1, value: gen, fmt: (v) => '第 ' + v + ' 代', on: (v) => { gen = v; draw(); }, width: 180 });
  ctl2.append(A.el('button', { onclick: () => { seed = (seed * 48271) % 2147483647; run(); draw(); } }, '重新抽样'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  function sample(p, n, r) {
    const cdf = []; let c = 0; p.forEach((x) => cdf.push((c += x))); const cnt = new Array(V).fill(0);
    for (let s = 0; s < n; s++) { const u = r() * c; let lo = 0, hi = V - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; } cnt[lo]++; }
    return cnt;
  }
  const norm = (c) => { const z = A.sum(c); return c.map((x) => x / z); };
  function run() {
    sim = {};
    ['replace', 'acc'].forEach((m) => {
      const r = A.rng(seed);
      const real = sample(TRUE, N, r);
      let model = norm(real), pool = real.slice();
      const models = [model];
      for (let g = 1; g <= GMAX; g++) {
        const syn = sample(model, N, r);
        if (m === 'replace') model = norm(syn);
        else { pool = pool.map((x, i) => x + syn[i]); model = norm(pool); }
        models.push(model);
      }
      sim[m] = models;
    });
  }
  const alive = (p) => p.filter((x) => x > 0).length;
  const tail = (p) => A.sum(p.slice(50));
  const cols = A.series();
  const v1 = A.canvas(cv1, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 46, y: 20, w: W - 60, h: H - 60 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: V, ymin: 1e-5, ymax: 0.2, xlog: true, ylog: true, xfmt: (v) => A.human(v, 0), yfmt: (v) => v.toExponential(0).replace('e-', 'e−'), xlabel: '词的排名（常见 → 罕见）', ylabel: '概率', ylabelOffset: 38 });
    ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1.5; ctx.beginPath(); TRUE.forEach((p, i) => (i ? ctx.lineTo(ax.X(i + 1), ax.Y(p)) : ctx.moveTo(ax.X(i + 1), ax.Y(p)))); ctx.stroke();
    const p = sim[mode][gen];
    ctx.fillStyle = cols[mode === 'replace' ? 1 : 0];
    p.forEach((x, i) => { if (x > 0) { ctx.beginPath(); ctx.arc(ax.X(i + 1), ax.Y(Math.max(x, 1e-5)), 2.2, 0, 7); ctx.fill(); } });
    let lastAlive = 0; p.forEach((x, i) => { if (x > 0) lastAlive = i; });
    A.text(ctx, `第 ${gen} 代（点）vs 真实分布（灰线）`, box.x + box.w - 4, box.y + 6, { size: 12, align: 'right', color: A.css('--muted') });
  });
  const v2 = A.canvas(cv2, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 46, y: 20, w: W - 60, h: H - 60 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: GMAX, ymin: 0, ymax: V, yfmt: (v) => v, xlabel: '代数', ylabel: '还活着的词（概率 > 0）', ylabelOffset: 38 });
    [['replace', 1, '替换'], ['acc', 0, '累积']].forEach(([m, c, n]) => {
      const on = m === mode;
      ctx.strokeStyle = on ? cols[c] : A.alpha(cols[c], 0.35); ctx.lineWidth = on ? 2.8 : 1.5; ctx.beginPath();
      sim[m].forEach((p, g) => (g ? ctx.lineTo(ax.X(g), ax.Y(alive(p))) : ctx.moveTo(ax.X(g), ax.Y(alive(p))))); ctx.stroke();
      const last = alive(sim[m][GMAX]);
      A.text(ctx, n, ax.X(GMAX) - 4, ax.Y(last) + (m === 'replace' ? 14 : -12), { size: 12, align: 'right', color: cols[c], weight: 700 });
    });
    ctx.strokeStyle = A.css('--ink'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(gen), box.y); ctx.lineTo(ax.X(gen), box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
  });
  function draw() {
    const p = sim[mode][gen], p0 = sim[mode][0];
    stats.innerHTML = '';
    [['还活着的词', `${alive(p)} / ${V}`], ['第 0 代（真实样本）', `${alive(p0)} / ${V}`], ['排名 50 以后的总概率', A.pct(tail(p), 1) + '（真实 ' + A.pct(tail(TRUE), 1) + '）']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = mode === 'replace'
      ? '<b>替换</b>：每一代只用上一代模型生成的 N 个样本重新估计词频。一个罕见词只要某一代没被抽到，概率就变成 0，此后永远不会再出现：尾部一代代被吃掉，只剩常见词。这就是 Shumailov 等（Nature, 2024）描述的模型崩溃：先丢长尾，最后分布塌成少数几个模式。N 越小，崩得越快。'
      : '<b>累积</b>：真实数据一直留在训练集里，每代的生成数据只是追加进去。罕见词至少还有真实样本支撑，概率不会归零，分布稳定在真实分布附近。Gerstgrasser 等（2024）证明，只要累积而不是替换，测试误差有一个与代数无关的上界。现实中网上的文本越来越多由模型生成，但人类数据并没有消失，更接近“累积”。';
    v1.redraw(); v2.redraw();
  }
  run(); draw();
});
