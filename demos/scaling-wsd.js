/* scaling-wsd — learning-rate schedules on a toy "river valley": one steep, noisy direction (noise floor ∝ η) plus a flat river (progress ∝ η). Exact expected-loss recursion, no sampling. */
A.defineDemo('scaling-wsd', function (mount) {
  const { bd } = A.demo(mount, '学习率调度：余弦、WSD，以及“一降就掉一截”', '玩具模型：损失 = 河道高度（平缓方向，走得越远越低）+ 陡峭方向上的抖动（梯度带噪声）；曲线是期望损失的精确递推');
  const lam = 1, sig2 = 10, K = 2, ETA = 0.2, X0 = 2, T = 2000, WU = 0.02;
  const h = (x) => 10 / (1 + x), hp = (x) => -10 / ((1 + x) * (1 + x));
  const S = {
    cos: (t, n) => { const w = WU * n; return t < w ? (t + 1) / w : 0.5 * (1 + Math.cos(Math.PI * (t - w) / (n - w))); },
    cst: (t, n) => { const w = WU * n; return t < w ? (t + 1) / w : 1; },
    wsd: (f) => (t, n) => { const w = WU * n, d = n * (1 - f); return t < w ? (t + 1) / w : t < d ? 1 : 1 - (t - d) / (n - d); },
  };
  // run a list of relative learning rates from state (x, v); returns per-step river part, noise part
  function run(etas, x = X0, v = 0) {
    const R = new Float64Array(etas.length), Q = new Float64Array(etas.length);
    for (let i = 0; i < etas.length; i++) { const e = etas[i] * ETA; x -= e * K * hp(x); v = (1 - e * lam) * (1 - e * lam) * v + e * e * sig2; R[i] = h(x); Q[i] = lam * v / 2; }
    return { R, Q, x, v };
  }
  const mk = (s, n) => Array.from({ length: n }, (_, t) => s(t, n));
  let frac = 0.2, forks = false, split = false;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: 'WSD 衰减段占总步数', min: 0.05, max: 0.5, step: 0.01, value: frac, fmt: (v) => A.pct(v, 0), on: (v) => { frac = v; draw(); }, width: 200 });
  A.check(ctl, '从 WSD 的稳定段分叉出 3 次更短的训练', forks, (v) => { forks = v; draw(); });
  A.check(ctl, '把 WSD 的损失拆成两部分', split, (v) => { split = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cvL = A.el('canvas', { class: 'cv' }), cvE = A.el('canvas', { class: 'cv' });
  bd.append(cvE, cvL);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const C = { cos: cols[1], wsd: cols[0], cst: cols[2] };
  let RUN = {}, FK = [];
  function compute() {
    RUN = { cos: run(mk(S.cos, T)), cst: run(mk(S.cst, T)), wsd: run(mk(S.wsd(frac), T)) };
    FK = [];
    if (forks) {
      const main = mk(S.cst, T);
      [400, 800, 1200].forEach((s) => {
        const pre = run(main.slice(0, s)), cd = Math.round(frac * s / (1 - frac));
        const post = run(Array.from({ length: cd }, (_, k) => 1 - (k + 1) / cd), pre.x, pre.v);
        const n = s + cd, cosRun = run(mk(S.cos, n));
        FK.push({ s, cd, post, cosEnd: cosRun.R[n - 1] + cosRun.Q[n - 1] });
      });
    }
  }
  const XMAX = T * 1.0;
  const viewE = A.canvas(cvE, { get aspect() { return cvE.clientWidth < 560 ? 0.3 : 0.17; } }, (ctx, W, H) => {
    const box = { x: 54, y: 26, w: W - 74, h: H - 40 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: XMAX, ymin: 0, ymax: 1.05, yticks: [0, 1], yfmt: (v) => (v ? 'η' : '0'), xticks: [], ylabel: '学习率', ylabelOffset: 46 });
    [['cst', S.cst], ['cos', S.cos], ['wsd', S.wsd(frac)]].forEach(([k, s]) => {
      ctx.save(); ctx.strokeStyle = C[k]; ctx.lineWidth = k === 'wsd' ? 2.5 : 1.8; if (k === 'cst') ctx.setLineDash([2, 3]);
      ctx.beginPath(); for (let t = 0; t < T; t += 4) { const x = ax.X(t), y = ax.Y(s(t, T)); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
    });
  });
  const YMIN = 2, YMAX = 4.2;
  let AX = null;
  const viewL = A.canvas(cvL, { get aspect() { return cvL.clientWidth < 560 ? 0.8 : 0.42; } }, (ctx, W, H) => {
    const box = { x: 54, y: 22, w: W - 74, h: H - 58 };
    const ax = AX = A.axes(ctx, box, { xmin: 0, xmax: XMAX, ymin: YMIN, ymax: YMAX, yfmt: (v) => v.toFixed(1), xfmt: (v) => String(v), xlabel: '训练步数', ylabel: '损失（玩具单位，纵轴从 2 开始）', ylabelOffset: 46 });
    const cy = (v) => ax.Y(A.clamp(v, YMIN, YMAX));
    const path = (arr, color, w, dash, off = 0) => { ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); for (let t = 0; t < arr.length; t += 2) { const x = ax.X(t + off), y = cy(arr[t]); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); };
    const tot = (r) => Array.from(r.R, (v, i) => YMIN + v + r.Q[i]);
    path(tot(RUN.cst), C.cst, 1.8, [2, 3]);
    path(tot(RUN.cos), C.cos, 2.2);
    path(tot(RUN.wsd), C.wsd, 2.8);
    if (split) {
      path(Array.from(RUN.wsd.R, (v) => YMIN + v), C.wsd, 1.5, [6, 4]);
      A.text(ctx, '蓝色虚线：只算河道高度；它与蓝色实线的差 = 抖动造成的额外损失', box.x + box.w - 4, box.y + 12, { size: 11.5, color: C.wsd, align: 'right' });
    }
    FK.forEach((f) => {
      const arr = Array.from(f.post.R, (v, i) => YMIN + v + f.post.Q[i]);
      path(arr, C.wsd, 1.6, null, f.s);
      const xe = ax.X(f.s + f.cd);
      ctx.fillStyle = C.wsd; ctx.beginPath(); ctx.arc(xe, cy(arr[arr.length - 1]), 4, 0, 7); ctx.fill();
      ctx.strokeStyle = C.cos; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xe, cy(YMIN + f.cosEnd), 6, 0, 7); ctx.stroke();
    });
    const end = (k) => YMIN + RUN[k].R[T - 1] + RUN[k].Q[T - 1];
    A.text(ctx, '常数', box.x + box.w - 2, cy(end('cst')) - 9, { size: 11.5, align: 'right', color: C.cst, weight: 600 });
    const yc = cy(end('cos')), yw = cy(end('wsd'));
    A.text(ctx, '余弦', box.x + box.w - 2, Math.min(yc, yw) - 9, { size: 11.5, align: 'right', color: C.cos, weight: 600 });
    A.text(ctx, 'WSD', box.x + box.w - 2, Math.max(yc, yw) + 11, { size: 11.5, align: 'right', color: C.wsd, weight: 600 });
  });
  cvL.addEventListener('mousemove', (e) => {
    if (!AX) return; const p = A.pos(cvL, e); const t = Math.round(AX.invX(p.x)); if (t < 0 || t >= T) { A.tip.hide(); return; }
    const f = (k) => (YMIN + RUN[k].R[t] + RUN[k].Q[t]).toFixed(3), q = (k) => RUN[k].Q[t].toFixed(3);
    A.tip.show(`第 ${t} 步<br>WSD ${f('wsd')}（其中抖动 ${q('wsd')}）<br>余弦 ${f('cos')}（其中抖动 ${q('cos')}）<br>常数 ${f('cst')}（其中抖动 ${q('cst')}）`, e.clientX, e.clientY);
  });
  cvL.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    compute();
    const end = (k) => YMIN + RUN[k].R[T - 1] + RUN[k].Q[T - 1];
    const d0 = Math.round(T * (1 - frac)) - 1;
    const drop = (YMIN + RUN.wsd.R[d0] + RUN.wsd.Q[d0]) - end('wsd');
    stats.innerHTML = '';
    [['WSD 最终损失', end('wsd').toFixed(3)], ['余弦最终损失', end('cos').toFixed(3)], ['常数学习率最终损失', end('cst').toFixed(3)],
      ['WSD 衰减段里下降', drop.toFixed(3)], ['噪声地板 ησ²/(2(2−ηλ))', (ETA * sig2 / (2 * (2 - ETA * lam))).toFixed(3)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${C.wsd}"></i>WSD（预热—稳定—衰减）</span><span><i class="line" style="background:${C.cos}"></i>余弦</span><span><i class="line" style="background:${C.cst}"></i>常数学习率</span>` + (forks ? `<span><i style="background:${C.wsd};border-radius:50%"></i>分叉衰减的终点</span><span><i style="border:2px solid ${C.cos};background:none;border-radius:50%"></i>同样总步数、单独训练的余弦</span>` : '');
    hint.innerHTML = forks
      ? '每条细线都从稳定段的某个检查点出发，只花额外 ' + A.pct(frac / (1 - frac), 0) + ' 的步数把学习率降到 0，终点（实心点）和“同样总步数、从头单独训练的余弦”（空心圈）一样好甚至更好。一次长训练，顺路得到了 4 个不同训练长度的结果：这正是 WSD 让测规模定律变便宜的原因。'
      : '常数学习率的损失停在一个“地板”上：陡峭方向的抖动幅度与学习率成正比，永远消不掉。余弦一路慢慢降低学习率，抖动逐渐减小，但后半程走河道也变慢了。WSD 在稳定段保持大学习率，河道走得最远，抖动却一直很大；最后一降，抖动在几十步内消失，损失“掉一截”。打开“拆成两部分”可以看到：衰减段里河道几乎没再前进，下降几乎全部来自抖动的消失。把衰减段调到 5%，降得太急，抖动来不及消失，结果和余弦差不多；20%–40% 最好；再长也不会更好，因为大学习率走河道的时间少了。';
    viewE.redraw(); viewL.redraw();
  }
  draw();
});
