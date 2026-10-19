/* rl-mismatch — schematic simulation of training-inference probability mismatch in RL rollouts */
A.defineDemo('rl-mismatch', function (mount) {
  const { bd } = A.demo(mount, '训练与推理不一致：同一组权重，两个引擎算出的概率不一样', '示意模拟：误差的量级按数值精度的舍入单位设定，用来说明机制，不是实测数据');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let prec = 'bf16', moe = true, r3 = false, tis = 0;
  A.seg(ctl, [{ v: 'bf16', t: 'BF16' }, { v: 'fp16', t: 'FP16' }, { v: 'same', t: '逐比特一致的内核' }], prec, (v) => { prec = v; run(); }, '推理引擎的精度');
  A.seg(ctl, [{ v: 0, t: '不截断' }, { v: 2, t: 'TIS：C = 2' }, { v: 5, t: 'TIS：C = 5' }], tis, (v) => { tis = v; run(); }, '截断重要性权重');
  const ctl2 = A.el('div', { class: 'flex', style: { marginBottom: '8px' } }); bd.append(ctl2);
  A.check(ctl2, 'MoE 模型（路由可能选到不同的专家）', true, (v) => { moe = v; run(); });
  A.check(ctl2, 'R3 路由回放（训练时复用推理时选的专家）', false, (v) => { r3 = v; run(); });
  const Ls = A.slider(ctl2, { label: '回答长度', min: 64, max: 16384, log: true, value: 4096, fmt: (v) => A.human(Math.round(v), 1) + ' token', on: A.debounce(() => run(), 150), width: 240 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--s1)"></i>每个 token 的比率 π训练 / π推理</span><span><i class="line" style="background:var(--s2)"></i>整条回答的比率（逐 token 相乘）</span><span><i class="line" style="background:var(--s3)"></i>按长度取几何平均（GSPO 的做法）</span><span>阴影 = 中间 80% 的回答</span>' }));
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  const NSEQ = 160, LMAX = 16384;
  const GRID = []; for (let e = 6; e <= 14.0001; e += 0.25) GRID.push(Math.round(Math.pow(2, e)));
  let hist = null, seqStats = null;
  function params() {
    const sigma = { bf16: 0.015, fp16: 0.002, same: 0 }[prec];
    const pflip = moe && !r3 ? { bf16: 0.01, fp16: 0.0015, same: 0 }[prec] : 0;
    return { sigma, pflip };
  }
  function run() {
    const { sigma, pflip } = params();
    const r = A.rng(42);
    const bins = new Array(61).fill(0); let outside = 0, tokCount = 0;
    const atGrid = GRID.map(() => ({ prod: [], geo: [] }));
    const L = Math.round(Ls.value);
    const wSeq = [];
    for (let s = 0; s < NSEQ; s++) {
      let cum = 0, gi = 0, cumT = 0;
      for (let t = 1; t <= LMAX; t++) {
        let d = sigma ? A.gauss(r) * sigma * (r() < 0.02 ? 6 : 1) : 0;
        if (pflip && r() < pflip) d += A.gauss(r) * 0.3;
        if (tis) d = Math.min(d, Math.log(tis));
        cum += d;
        if (t <= L) cumT = cum;
        if (s < 40 && t <= 2000) {
          tokCount++;
          const b = Math.round((A.clamp(d, -0.6, 0.6) + 0.6) / 0.02);
          bins[b]++;
          if (Math.abs(d) > Math.log(1.25)) outside++;
        }
        while (gi < GRID.length && GRID[gi] === t) { atGrid[gi].prod.push(Math.abs(cum)); atGrid[gi].geo.push(Math.abs(cum / t)); gi++; }
      }
      wSeq.push(Math.exp(cumT));
    }
    const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
    seqStats = atGrid.map((g, i) => ({ L: GRID[i], p10: q(g.prod, 0.1), p50: q(g.prod, 0.5), p90: q(g.prod, 0.9), g10: q(g.geo, 0.1), g50: q(g.geo, 0.5), g90: q(g.geo, 0.9) }));
    hist = { bins, outside: outside / tokCount };
    const sw = A.sum(wSeq), sw2 = A.sum(wSeq.map((w) => w * w));
    const ess = (sw * sw) / (NSEQ * sw2);
    const near = seqStats.reduce((a, b) => (Math.abs(Math.log(b.L / L)) < Math.abs(Math.log(a.L / L)) ? b : a));
    stats.innerHTML = '';
    [['比率偏离 [0.8, 1.25] 的 token', A.pct(hist.outside, 1)], [`${A.human(L, 1)} token 回答的整条比率（90% 分位）`, '×' + fmtRatio(Math.exp(near.p90))], ['几何平均比率（90% 分位）', '×' + Math.exp(near.g90).toFixed(4)], ['重要性权重的有效样本比例 ESS/n', A.pct(ess, 1)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    note.innerHTML = (sigma === 0 && !pflip ? '两个引擎逐比特一致，比率处处为 1，RL 是严格的同策略。' :
      `每个 token 的误差很小，但整条回答的比率是 ${A.human(L, 1)} 个 token 比率的乘积，对数误差像随机游走一样按 √L 增长，长回答的重要性权重会极端失真（ESS 很低意味着少数几条回答主导了梯度）。`) +
      (moe && !r3 && pflip ? ' MoE 的路由一旦在两边选到不同专家，那个 token 的概率会差一大截，这是 MoE 模型 RL 不稳定的主要来源；打开 R3 可以去掉它。' : '') +
      ' GSPO 按长度取几何平均，误差反而随长度缩小（σ/√L），所以序列级比率在长回答上依然稳定。';
    v1.redraw(); v2.redraw();
  }
  const fmtRatio = (x) => (x > 1e4 ? x.toExponential(1) : x.toFixed(x > 10 ? 0 : 2));
  const v1 = A.canvas(cv1, { aspect: 0.75 }, (ctx, W, H) => {
    if (!hist) return;
    const box = { x: 40, y: 16, w: W - 52, h: H - 50 };
    const mx = Math.max(...hist.bins);
    const ax = A.axes(ctx, box, { xmin: -0.6, xmax: 0.6, ymin: 0, ymax: 1, yticks: [], xticks: [-0.6, -0.3, 0, 0.3, 0.6], xfmt: (v) => '×' + Math.exp(v).toFixed(2), xlabel: 'π训练 / π推理' });
    const bw = box.w / hist.bins.length;
    hist.bins.forEach((c, i) => { const h = Math.sqrt(c / mx) * box.h; A.bar(ctx, box.x + i * bw + 0.5, box.y + box.h - h, bw - 1, h, A.css('--s1'), 2); });
    A.text(ctx, '每个 token 的比率分布（纵轴取平方根，便于看清尾部）', box.x, 6, { size: 11.5, color: A.css('--muted') });
    ctx.strokeStyle = A.css('--s8'); ctx.setLineDash([4, 3]);
    [Math.log(0.8), Math.log(1.25)].forEach((v) => { ctx.beginPath(); ctx.moveTo(ax.X(v), box.y); ctx.lineTo(ax.X(v), box.y + box.h); ctx.stroke(); });
    ctx.setLineDash([]);
  });
  const v2 = A.canvas(cv2, { aspect: 0.75 }, (ctx, W, H) => {
    if (!seqStats) return;
    const box = { x: 52, y: 16, w: W - 64, h: H - 50 };
    const ymax = Math.max(6, ...seqStats.map((s) => s.p90)) * 1.05;
    const ax = A.axes(ctx, box, { xmin: 64, xmax: LMAX, xlog: true, xticks: [64, 256, 1024, 4096, 16384], xfmt: (v) => A.human(v, 0), ymin: 0, ymax, yfmt: (v) => 'e^' + v.toFixed(0), xlabel: '回答长度（token）', xgrid: true });
    const band = (lo, hi, col) => { ctx.fillStyle = A.alpha(col, 0.18); ctx.beginPath(); seqStats.forEach((s, i) => { const x = ax.X(s.L), y = ax.Y(Math.min(ymax, s[hi])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); for (let i = seqStats.length - 1; i >= 0; i--) ctx.lineTo(ax.X(seqStats[i].L), ax.Y(Math.min(ymax, seqStats[i][lo]))); ctx.closePath(); ctx.fill(); };
    const line = (k, col) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); seqStats.forEach((s, i) => { const x = ax.X(s.L), y = ax.Y(Math.min(ymax, s[k])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    band('p10', 'p90', A.css('--s2')); line('p50', A.css('--s2'));
    band('g10', 'g90', A.css('--s3')); line('g50', A.css('--s3'));
    const x = ax.X(Ls.value); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke();
    A.text(ctx, '|log 比率| 随长度的变化', box.x, 6, { size: 11.5, color: A.css('--muted') });
  });
  run();
});
