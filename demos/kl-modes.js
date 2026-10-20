/* kl-modes — fit one Gaussian (student) to a bimodal teacher by forward KL vs reverse KL */
A.defineDemo('kl-modes', function (mount) {
  const { bd } = A.demo(mount, '正向 KL 与反向 KL：学生只能用一个“峰”去学两个峰的老师', '老师是两个高斯的混合；学生是一个高斯，分别按两种 KL 求最优');
  let mu = 2, w = 0.5;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '老师两个峰的间距', min: 0.3, max: 3.5, step: 0.05, value: mu, fmt: (v) => '±' + v.toFixed(2), on: (v) => { mu = v; draw(); }, width: 190 });
  A.slider(ctl, { label: '左峰的权重', min: 0.15, max: 0.85, step: 0.01, value: w, fmt: (v) => A.pct(v, 0), on: (v) => { w = v; draw(); }, width: 170 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const S0 = 0.5, X0 = -7, X1 = 7, NX = 700, dx = (X1 - X0) / NX;
  const xs = Array.from({ length: NX + 1 }, (_, i) => X0 + i * dx);
  const npdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const P = (x) => w * npdf(x, -mu, S0) + (1 - w) * npdf(x, mu, S0);
  let fw, rv;
  function fit() {
    const m = -w * mu + (1 - w) * mu;
    const v = S0 * S0 + w * (mu + m) ** 2 + (1 - w) * (mu - m) ** 2;
    fw = { m, s: Math.sqrt(v) };
    const lp = xs.map((x) => Math.log(Math.max(P(x), 1e-300)));
    const rkl = (m2, s2) => { let k = 0; xs.forEach((x, i) => { const q = npdf(x, m2, s2); if (q > 1e-12) k += q * (Math.log(q) - lp[i]) * dx; }); return k; };
    let best = { k: Infinity };
    for (let m2 = -4; m2 <= 4.0001; m2 += 0.1) for (let s2 = 0.15; s2 <= 3; s2 += 0.05) { const k = rkl(m2, s2); if (k < best.k) best = { m: m2, s: s2, k }; }
    for (let m2 = best.m - 0.1; m2 <= best.m + 0.1; m2 += 0.01) for (let s2 = Math.max(0.1, best.s - 0.05); s2 <= best.s + 0.05; s2 += 0.005) { const k = rkl(m2, s2); if (k < best.k) best = { m: m2, s: s2, k }; }
    rv = best;
    let fk = 0; xs.forEach((x, i) => { const p = P(x); if (p > 1e-12) fk += p * (lp[i] - Math.log(npdf(x, fw.m, fw.s))) * dx; });
    fw.k = fk;
    fw.gap = npdf(0, fw.m, fw.s) * 1; rv.gap = npdf(0, rv.m, rv.s);
  }
  const cols = A.series();
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 30, y: 16, w: W - 44, h: H - 50 };
    const ymax = Math.max(0.9, ...[0, mu, -mu].map(P)) * 1.1;
    const ax = A.axes(ctx, box, { xmin: -6, xmax: 6, ymin: 0, ymax, xfmt: (v) => v, yfmt: () => '', noYLabels: true, xlabel: 'x（可以想成“下一个 token 的候选”排成一行）' });
    ctx.fillStyle = A.alpha(A.css('--ink'), 0.12); ctx.beginPath(); ctx.moveTo(ax.X(-6), ax.Y(0));
    for (let i = 0; i <= 400; i++) { const x = -6 + 12 * i / 400; ctx.lineTo(ax.X(x), ax.Y(P(x))); }
    ctx.lineTo(ax.X(6), ax.Y(0)); ctx.closePath(); ctx.fill();
    const curve = (g, c) => { ctx.strokeStyle = c; ctx.lineWidth = 2.6; ctx.beginPath(); for (let i = 0; i <= 400; i++) { const x = -6 + 12 * i / 400, y = ax.Y(Math.min(npdf(x, g.m, g.s), ymax)); i ? ctx.lineTo(ax.X(x), y) : ctx.moveTo(ax.X(x), y); } ctx.stroke(); };
    curve(fw, cols[1]); curve(rv, cols[0]);
  });
  function draw() {
    fit();
    stats.innerHTML = '';
    [['正向 KL 的学生', `均值 ${fw.m.toFixed(2)}，宽度 ${fw.s.toFixed(2)}`], ['反向 KL 的学生', `均值 ${rv.m.toFixed(2)}，宽度 ${rv.s.toFixed(2)}`], ['两峰之间（x = 0）老师的概率密度', P(0).toExponential(1)], ['正向 / 反向学生在 x = 0 的密度', `${fw.gap.toFixed(2)} / ${rv.gap.toExponential(1)}`]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    legend.innerHTML = `<span><i style="background:${A.alpha(A.css('--ink'), 0.18)}"></i>老师</span><span><i class="line" style="background:${cols[1]}"></i>最小化正向 KL(老师‖学生)：覆盖所有峰</span><span><i class="line" style="background:${cols[0]}"></i>最小化反向 KL(学生‖老师)：只抓一个峰</span>`;
    hint.innerHTML = '<b>正向 KL</b> 按老师的分布取平均：老师有概率的地方，学生必须也给概率，否则惩罚无穷大。一个峰的学生只好铺开，把两个峰都盖住，结果在两峰之间老师几乎不会去的地方放了大量概率。对语言模型来说，这相当于学生会生成老师从不会说的“折中”内容。离线蒸馏（在老师的输出上做 SFT）最小化的正是正向 KL。<b>反向 KL</b> 按学生自己的分布取平均：学生只需保证自己说出的东西老师也认可，于是集中到一个峰上。在线策略蒸馏让学生自己采样、由老师打分，最小化的是反向 KL：输出更“像老师会说的”，代价是丢掉一部分多样性。把间距调小，两个峰合并，两种 KL 的结果就趋于一致。';
    view.redraw();
  }
  draw();
});
