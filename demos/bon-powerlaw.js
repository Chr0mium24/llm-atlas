/* bon-powerlaw — Best-of-N style repeated attempts: ASR(N) = 1 − E[(1−p)^N] over a heavy-tailed mix of per-request success rates; per-attempt defenses only shift the curve, cross-attempt monitoring caps it */
A.defineDemo('bon-powerlaw', function (mount) {
  const { bd } = A.demo(mount, '反复尝试：为什么“多试几次”总能成功', '一组有害请求，各自单次被突破的概率 p 不同（大多很小）；每个请求随机改写、反复尝试 N 次，一次成功即攻破。示意模型，量级参照 2024 年的论文');
  let lgN = 2, alpha = 0.3, def = 'none', tail = false;
  const pmax = 0.12, CAP = 100;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '每个请求尝试的次数 N', min: 0, max: 4, step: 0.05, value: lgN, fmt: (v) => A.human(Math.round(Math.pow(10, v))) + ' 次', on: (v) => { lgN = v; draw(); }, width: 220 });
  A.slider(ctl, { label: '难度分布的指数 α（越小，最难的请求越难攻破）', min: 0.15, max: 0.6, step: 0.05, value: alpha, fmt: (v) => v.toFixed(2), on: (v) => { alpha = v; draw(); }, width: 220 });
  A.seg(ctl, [{ v: 'none', t: '只有拒绝训练' }, { v: 'per', t: '+ 输出分类器（每次拦下 90%）' }, { v: 'cap', t: '+ 监测反复尝试（100 次后封禁）' }], def, (v) => { def = v; draw(); }, '防御');
  A.check(ctl, '看尾巴：对数纵轴画“仍未攻破的比例”', tail, (v) => { tail = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  // ASR(N) = 1 − E_u[(1 − s·pmax·u^{1/α})^n], n = min(N, cap); exact quadrature over u
  const asr = (N, d) => {
    const s = d === 'none' ? 1 : 0.1, n = d === 'cap' ? Math.min(N, CAP) : N;
    let f = 0; const M = 600;
    for (let i = 0; i < M; i++) { const p = s * pmax * Math.pow((i + 0.5) / M, 1 / alpha); f += Math.pow(1 - p, n); }
    return 1 - f / M;
  };
  const need = (target, d) => { if (asr(1e6, d) < target) return null; let lo = 0, hi = 6; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; asr(Math.pow(10, m), d) < target ? (lo = m) : (hi = m); } return Math.pow(10, hi); };
  const view = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    const box = { x: 58, y: 28, w: W - 80, h: H - 66 };
    const ax = tail
      ? A.axes(ctx, box, { xmin: 1, xmax: 1e4, xlog: true, ymin: 0.03, ymax: 1, ylog: true, yticks: [0.03, 0.1, 0.3, 1], yfmt: (v) => A.pct(v, 0), xfmt: (v) => A.human(v), xlabel: '尝试次数 N（对数）', ylabel: '仍未攻破的比例 1 − ASR（对数）', ylabelOffset: 48 })
      : A.axes(ctx, box, { xmin: 1, xmax: 1e4, xlog: true, ymin: 0, ymax: 1, yfmt: (v) => A.pct(v, 0), xfmt: (v) => A.human(v), xlabel: '尝试次数 N（对数）', ylabel: '攻击成功率 ASR', ylabelOffset: 48 });
    const val = (N, d) => (tail ? Math.max(1 - asr(N, d), 0.03) : asr(N, d));
    const line = (d, c, w, dash) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let i = 0; i <= 120; i++) { const N = Math.pow(10, (i / 120) * 4), x = ax.X(N), y = ax.Y(val(N, d)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); };
    if (def !== 'none') line('none', A.alpha(cols[1], 0.45), 1.5, [5, 4]);
    if (def === 'cap') line('per', A.alpha(cols[2], 0.6), 1.5, [2, 3]);
    line(def, cols[0], 3);
    if (def === 'cap') { const x = ax.X(CAP); ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore(); A.text(ctx, '封禁', x + 4, box.y + 10, { size: 11, color: A.css('--muted') }); }
    const N = Math.pow(10, lgN);
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(N), ax.Y(val(N, def)), 6, 0, 7); ctx.fill();
    if (tail && def === 'none') {
      const N1 = 300, N2 = 1e4, y1 = val(N1, 'none'), y2 = val(N2, 'none');
      A.text(ctx, '斜率 ≈ −α', ax.X(Math.sqrt(N1 * N2)), ax.Y(Math.sqrt(y1 * y2)) - 16, { size: 12, weight: 700, color: cols[0], align: 'center' });
    }
    if (def !== 'none') A.text(ctx, def === 'cap' ? '虚线：只有拒绝训练 · 点线：加分类器、不封禁' : '虚线：只有拒绝训练', box.x + box.w - 4, box.y + 8, { size: 11.5, align: 'right', color: A.css('--muted') });
  });
  function draw() {
    const N = Math.pow(10, lgN), a = asr(N, def), a0 = asr(N, 'none'), n50 = need(0.5, def);
    stats.innerHTML = '';
    [['尝试 ' + A.human(Math.round(N)) + ' 次后的成功率', A.pct(a, 1)], ['只有拒绝训练时', A.pct(a0, 1)], ['攻破一半请求需要的尝试次数', n50 ? '约 ' + A.human(Math.round(n50)) + ' 次' : '永远达不到']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    const msg = {
      none: '单次尝试几乎总被拒绝（成功率只有几个百分点），但每多试 10 倍，成功率就稳步上升，没有饱和的迹象。原因是请求的难度参差不齐：大部分请求的 p 并不是 0，只是很小，N 足够大时总会碰上一次。打开“看尾巴”：仍未攻破的比例在对数坐标下近似一条直线，斜率就是 α，这就是幂律。',
      per: '输出分类器把每次成功的概率压到十分之一，整条曲线只是向右平移了 10 倍：攻击者多试 10 倍就回到原来的成功率。凡是“让每一次更难”的防御都是这样：它提高了攻击成本，但没有改变“多试总会成功”的结构。',
      cap: '监测利用的是跨尝试的信息：同一个账号反复发出可疑请求本身就是信号。封禁之后曲线变平，再多的尝试也无济于事；攻击者只能换账号，成本按账号数计。这就是为什么部署端的防御是分类器、限速、账号监测与人工审核的组合，而不是单靠模型本身。',
    }[def];
    hint.innerHTML = msg;
    view.redraw();
  }
  draw();
});
