/* transformer-prepost — Pre-Norm vs Post-Norm at initialization: how the gradient travels through depth (total vs identity-path-only) and how large each layer's parameter gradient is; real LayerNorm forward/backward on a toy residual MLP stack */
A.defineDemo('transformer-prepost', function (mount) {
  const { bd } = A.demo(mount, 'Pre-Norm 与 Post-Norm：梯度怎样穿过很多层', '玩具：d = 32，每个子层是随机初始化的两层 ReLU 网络（不含注意力），归一化用真实的 LayerNorm；曲线都是逐层反向传播算出来的，16 个随机输入取平均');
  const D = 32, LMAX = 96, NB = 16;
  const r = A.rng(11);
  const W1 = [], W2 = [];
  for (let l = 0; l < LMAX; l++) {
    W1.push(Float64Array.from({ length: D * D }, () => A.gauss(r) * Math.sqrt(2 / D)));
    W2.push(Float64Array.from({ length: D * D }, () => A.gauss(r) * Math.sqrt(1 / D)));
  }
  const X0 = [], CC = [];
  for (let b = 0; b < NB; b++) { X0.push(Array.from({ length: D }, () => A.gauss(r))); CC.push(Array.from({ length: D }, () => A.gauss(r))); }
  const norm2 = (v) => Math.sqrt(A.sum(v.map((x) => x * x)));
  function ln(x) { const m = A.sum(x) / D; const c = x.map((v) => v - m); const s = Math.sqrt(A.sum(c.map((v) => v * v)) / D + 1e-6); return { y: c.map((v) => v / s), s }; }
  function lnBack(y, s, dy) { const md = A.sum(dy) / D; let mdy = 0; for (let i = 0; i < D; i++) mdy += dy[i] * y[i]; mdy /= D; return dy.map((v, i) => (v - md - y[i] * mdy) / s); }
  function mv(x, W) { const o = new Array(D).fill(0); for (let i = 0; i < D; i++) { const xi = x[i]; if (!xi) continue; for (let j = 0; j < D; j++) o[j] += xi * W[i * D + j]; } return o; }
  function mvT(g, W) { const o = new Array(D); for (let i = 0; i < D; i++) { let s = 0; for (let j = 0; j < D; j++) s += W[i * D + j] * g[j]; o[i] = s; } return o; }
  function fwdBranch(u, l) { const z = mv(u, W1[l]); const h = z.map((v) => (v > 0 ? v : 0)); return { z, h, o: mv(h, W2[l]) }; }
  // backward through branch: returns grad wrt its input u, and adds |dW|^2 for this sample into acc (we accumulate the full matrices to average over the batch)
  function backBranch(u, c, go, l, G1, G2) {
    const gh = mvT(go, W2[l]);
    for (let i = 0; i < D; i++) { const hi = c.h[i]; if (!hi) continue; for (let j = 0; j < D; j++) G2[i * D + j] += hi * go[j]; }
    const gz = gh.map((v, i) => (c.z[i] > 0 ? v : 0));
    for (let i = 0; i < D; i++) { const ui = u[i]; for (let j = 0; j < D; j++) G1[i * D + j] += ui * gz[j]; }
    return mvT(gz, W1[l]);
  }
  const memo = {};
  function run(mode, L) {
    const key = mode + L; if (memo[key]) return memo[key];
    const G1 = Array.from({ length: L }, () => new Float64Array(D * D)), G2 = Array.from({ length: L }, () => new Float64Array(D * D));
    const ag = new Array(L + 1).fill(0), dir = new Array(L + 1).fill(0);
    for (let b = 0; b < NB; b++) {
      let x = ln(X0[b]).y; const cache = [];
      for (let l = 0; l < L; l++) {
        if (mode === 'post') { const c = fwdBranch(x, l); const n = ln(x.map((v, i) => v + c.o[i])); cache.push({ x, c, n }); x = n.y; }
        else { const n = ln(x); const c = fwdBranch(n.y, l); cache.push({ x, c, n }); x = x.map((v, i) => v + c.o[i]); }
      }
      let g;
      if (mode === 'pre') { const fin = ln(x); g = lnBack(fin.y, fin.s, CC[b]); } else g = CC[b].slice();
      let gd = g.slice();
      ag[L] += norm2(g) / NB; dir[L] += norm2(gd) / NB;
      for (let l = L - 1; l >= 0; l--) {
        const kk = cache[l];
        if (mode === 'post') {
          const gs = lnBack(kk.n.y, kk.n.s, g); const gu = backBranch(kk.x, kk.c, gs, l, G1[l], G2[l]); g = gs.map((v, i) => v + gu[i]);
          gd = lnBack(kk.n.y, kk.n.s, gd);
        } else {
          const gu = backBranch(kk.n.y, kk.c, g, l, G1[l], G2[l]); const gx = lnBack(kk.n.y, kk.n.s, gu); g = g.map((v, i) => v + gx[i]);
        }
        ag[l] += norm2(g) / NB; dir[l] += norm2(gd) / NB;
      }
    }
    const pg = G1.map((M1, l) => { let s = 0; for (const v of M1) s += v * v; for (const v of G2[l]) s += v * v; return Math.sqrt(s) / NB; });
    return (memo[key] = { ag, dir, pg });
  }
  let view = 'act';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'act', t: '传到每层的梯度' }, { v: 'param', t: '每层参数的梯度' }], view, (v) => { view = v; draw(); }, '看什么');
  const LS = A.slider(ctl, { label: '层数 L', min: 4, max: LMAX, step: 1, value: 24, fmt: (v) => v, on: A.debounce(() => draw(), 40), width: 200 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const sup = (e) => '10' + String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  const fmt = (v) => (v >= 0.01 && v < 1000 ? (v >= 10 ? v.toFixed(1) : v.toFixed(2)) : A.sci(v));
  let hover = null;
  const view_ = A.canvas(cv, { aspect: 0.46 }, (ctx, W, H) => {
    const L = Math.round(LS.value), cols = A.series();
    const po = run('post', L), pr = run('pre', L);
    const box = { x: 58, y: 26, w: W - 76, h: H - 66 };
    if (view === 'act') {
      const lo = Math.min(...po.dir, ...pr.ag), ymin = A.clamp(Math.pow(10, Math.floor(Math.log10(lo))), 1e-8, 1e-1);
      const ax = A.axes(ctx, box, { xmin: 0, xmax: L, ymin, ymax: 1e2, ylog: true, yfmt: (v) => (v === 1 ? '1' : sup(Math.round(Math.log10(v)))), xlabel: '层号（0 = 输入端，' + L + ' = 输出端）', ylabel: '梯度大小 |∂ℒ/∂xₗ|', ylabelOffset: 50 });
      const yc = (v) => ax.Y(A.clamp(v, ymin, 1e2));
      const line = (arr, c, dash, w) => { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); arr.forEach((v, l) => (l ? ctx.lineTo(ax.X(l), yc(v)) : ctx.moveTo(ax.X(l), yc(v)))); ctx.stroke(); ctx.restore(); };
      line(po.dir, cols[1], [6, 5], 2);
      line(po.ag, cols[1], [], 3);
      line(pr.ag.map((_, l) => pr.ag[L]), cols[0], [6, 5], 2);
      line(pr.ag, cols[0], [], 3);
      A.text(ctx, '← 梯度从输出端往回传', box.x + box.w - 4, box.y + 8, { size: 12, align: 'right', color: A.css('--muted') });
      if (po.dir[0] < ymin) A.text(ctx, 'Post-Norm 直通路径低于 10⁻⁸，已出图', box.x + 6, box.y + box.h - 10, { size: 11.5, color: cols[1] });
      if (hover != null) {
        const l = A.clamp(Math.round(ax.invX(hover)), 0, L);
        ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(ax.X(l), box.y); ctx.lineTo(ax.X(l), box.y + box.h); ctx.stroke(); ctx.restore();
        A.text(ctx, `第 ${l} 层：Post 总 ${fmt(po.ag[l])} · Post 直通 ${fmt(po.dir[l])} · Pre 总 ${fmt(pr.ag[l])}`, box.x + 6, box.y + 8, { size: 11.5, color: A.css('--ink-2') });
      }
    } else {
      const ymax = Math.max(4, Math.ceil(Math.max(...po.pg, ...pr.pg) / 2) * 2);
      const ax = A.axes(ctx, box, { xmin: 0.5, xmax: L + 0.5, ymin: 0, ymax, xticks: A.niceTicks(1, L, 6).filter((v) => v >= 1), xfmt: (v) => v, yfmt: (v) => v.toFixed(0), xlabel: '第 l 个子层（右 = 靠近输出）', ylabel: '这一层参数梯度的大小', ylabelOffset: 50 });
      [[po.pg, cols[1]], [pr.pg, cols[0]]].forEach(([arr, c]) => {
        ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); arr.forEach((v, l) => (l ? ctx.lineTo(ax.X(l + 1), ax.Y(v)) : ctx.moveTo(ax.X(l + 1), ax.Y(v)))); ctx.stroke();
        if (L <= 48) { ctx.fillStyle = c; arr.forEach((v, l) => { ctx.beginPath(); ctx.arc(ax.X(l + 1), ax.Y(v), 2.6, 0, 7); ctx.fill(); }); }
        ctx.restore();
      });
      if (hover != null) {
        const l = A.clamp(Math.round(ax.invX(hover)), 1, L);
        ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(ax.X(l), box.y); ctx.lineTo(ax.X(l), box.y + box.h); ctx.stroke(); ctx.restore();
        A.text(ctx, `第 ${l} 层：Post ${po.pg[l - 1].toFixed(2)} · Pre ${pr.pg[l - 1].toFixed(2)}`, box.x + 6, box.y + 8, { size: 11.5, color: A.css('--ink-2') });
      }
    }
  });
  cv.addEventListener('mousemove', (e) => { hover = A.pos(cv, e).x; view_.redraw(); });
  cv.addEventListener('mouseleave', () => { hover = null; view_.redraw(); });
  function draw() {
    const L = Math.round(LS.value), cols = A.series();
    const po = run('post', L), pr = run('pre', L);
    stats.innerHTML = '';
    const st = (k, v, c) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: c ? { color: c } : null }, v)));
    if (view === 'act') {
      st('Post-Norm：输入端的总梯度', fmt(po.ag[0]), cols[1]);
      st('Post-Norm：只走直通路径', fmt(po.dir[0]), cols[1]);
      st('Pre-Norm：输入端的总梯度', fmt(pr.ag[0]), cols[0]);
      legend.innerHTML = `<span><i class="line" style="background:${cols[1]}"></i>Post-Norm 总梯度</span><span><i class="line" style="background:repeating-linear-gradient(90deg,${cols[1]} 0 6px,transparent 6px 10px)"></i>Post-Norm 只走直通路径</span><span><i class="line" style="background:${cols[0]}"></i>Pre-Norm 总梯度</span><span><i class="line" style="background:repeating-linear-gradient(90deg,${cols[0]} 0 6px,transparent 6px 10px)"></i>Pre-Norm 只走直通路径（恒等，不衰减）</span>`;
      hint.innerHTML = `虚线只保留“直通”那一条路：Post-Norm 每层都要穿过一次归一化，${L} 层后只剩 ${fmt(po.dir[0])}，与“输出端梯度 × (1/√2)<sup>${L}</sup>”= ${fmt(po.ag[L] * Math.pow(0.5, L / 2))} 同一量级；Pre-Norm 的直通路径是恒等映射，原样到达输入端。可是 Post-Norm 的<b>总</b>梯度（实线）并没有消失：分支也在传梯度，随机初始化时每层分支的放大正好抵消归一化的缩小。区别在于 Post-Norm 的梯度全靠分支传递，没有兜底；Pre-Norm 至少有输出端那一份。`;
    } else {
      st('最后一层：Post-Norm', po.pg[L - 1].toFixed(2), cols[1]);
      st('最后一层：Pre-Norm', pr.pg[L - 1].toFixed(2), cols[0]);
      st('Post ÷ Pre（最后一层）', '×' + (po.pg[L - 1] / pr.pg[L - 1]).toFixed(1));
      legend.innerHTML = `<span><i class="line" style="background:${cols[1]}"></i>Post-Norm</span><span><i class="line" style="background:${cols[0]}"></i>Pre-Norm</span>`;
      hint.innerHTML = '把层数从 12 拖到 96 看最后一层：Post-Norm 的参数梯度大小基本不随 L 变化，Pre-Norm 的随 L 变大而变小（约按 1/√L），因为最后的归一化要除以残差流的长度，而它随层数按 √L 增长。这正是 Xiong 等（2020）证明的结论：同样的学习率下，Post-Norm 输出附近的参数一步走得大好几倍，训练初期容易发散，所以需要学习率预热。Pre-Norm 越靠近输入的层梯度越大，也是残差流变长的结果（每层的写入占比按 1/√l 缩小）。';
    }
    view_.redraw();
  }
  draw();
});
