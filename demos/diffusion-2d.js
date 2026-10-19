/* diffusion-2d — interactive demo (moved from ch11-diffusion.html) */
A.defineDemo('diffusion-2d', function (mount) {
  const { bd } = A.demo(mount, '2D 扩散 / 流匹配实验室（精确的最优去噪器）', '数据点 = 高斯混合的中心，σ = 0.03');
  // ---- datasets: [{x,y,c}]
  function makeData(kind) {
    const r = A.rng(5), P = [];
    if (kind === 'moons') for (let i = 0; i < 300; i++) { const c = i % 2, u = r() * Math.PI; P.push(c ? [1 - Math.cos(u) - 0.5, 0.5 - Math.sin(u) - 0.25, 1] : [Math.cos(u) - 0.5, Math.sin(u) - 0.25, 0]); }
    if (kind === 'spiral') for (let i = 0; i < 300; i++) { const c = i % 2, u = Math.sqrt(r()) * 3 * Math.PI, rad = 0.12 + u * 0.13; P.push([Math.cos(u + c * Math.PI) * rad, Math.sin(u + c * Math.PI) * rad, c]); }
    if (kind === 'grid') for (let i = 0; i < 300; i++) { const k = i % 9, gx = (k % 3) - 1, gy = Math.floor(k / 3) - 1; P.push([gx * 0.9 + A.gauss(r) * 0.07, gy * 0.9 + A.gauss(r) * 0.07, (gx + gy + 2) % 2]); }
    if (kind === 'face') {
      for (let i = 0; i < 160; i++) { const u = (i / 160) * 2 * Math.PI; P.push([Math.cos(u) * 1.1, Math.sin(u) * 1.1, 0]); }
      for (let i = 0; i < 40; i++) { const u = r() * 2 * Math.PI, rr = Math.sqrt(r()) * 0.13; P.push([-0.4 + Math.cos(u) * rr, 0.35 + Math.sin(u) * rr, 1]); P.push([0.4 + Math.cos(u) * rr, 0.35 + Math.sin(u) * rr, 1]); }
      for (let i = 0; i < 60; i++) { const u = Math.PI * (1.15 + (0.7 * i) / 59); P.push([Math.cos(u) * 0.6, Math.sin(u) * 0.6 + 0.05, 1]); }
    }
    return P;
  }
  let kind = 'moons', data = makeData(kind);
  const SIG = 0.03;
  // schedules
  const SCH = {
    vp: (t) => { const ab = Math.pow(Math.cos(((t + 0.008) / 1.008) * Math.PI / 2), 2); return [Math.sqrt(ab), Math.sqrt(1 - ab)]; },
    rf: (t) => [1 - t, t],
  };
  function denoise(x, y, a, b, cls) { // posterior mean E[x0|xt], restricted to class (or all if cls<0)
    const v = a * a * SIG * SIG + b * b;
    let mx = -Infinity; const lw = [];
    for (let i = 0; i < data.length; i++) { const p = data[i]; if (cls >= 0 && p[2] !== cls) { lw.push(-Infinity); continue; } const dx = x - a * p[0], dy = y - a * p[1]; const l = -(dx * dx + dy * dy) / (2 * v); lw.push(l); if (l > mx) mx = l; }
    let s = 0, ex = 0, ey = 0; const k = (a * SIG * SIG) / v;
    for (let i = 0; i < data.length; i++) { if (lw[i] === -Infinity) continue; const w = Math.exp(lw[i] - mx); const p = data[i]; s += w; ex += w * (p[0] + k * (x - a * p[0])); ey += w * (p[1] + k * (y - a * p[1])); }
    return [ex / s, ey / s];
  }
  // ---- controls
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'moons', t: '双月牙' }, { v: 'spiral', t: '双螺旋' }, { v: 'grid', t: '九宫格' }, { v: 'face', t: '笑脸' }], kind, (v) => { kind = v; data = makeData(v); gen(); fwdView.redraw(); }, '数据分布');
  let sampler = 'ddim';
  A.seg(ctl, [{ v: 'ddpm', t: 'DDPM（随机）' }, { v: 'ddim', t: 'DDIM（ODE）' }, { v: 'rf', t: '流匹配（Euler）' }], sampler, (v) => { sampler = v; gen(); }, '采样器');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const K = A.slider(ctl2, { label: '采样步数', min: 1, max: 100, step: 1, value: 30, fmt: (v) => v, on: A.debounce(gen, 80) });
  let cond = -1;
  A.seg(ctl2, [{ v: -1, t: '无条件' }, { v: 0, t: '类别 A' }, { v: 1, t: '类别 B' }], cond, (v) => { cond = v; gen(); }, '条件');
  const Wg = A.slider(ctl2, { label: 'CFG 引导强度 w', min: 0, max: 6, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), on: A.debounce(gen, 80) });
  const chk = A.el('div', { class: 'flex', style: { marginBottom: '8px' } }); bd.append(chk);
  let showTraj = true, showField = false;
  A.check(chk, '显示轨迹', true, (v) => { showTraj = v; revView.redraw(); });
  A.check(chk, '显示去噪方向场', false, (v) => { showField = v; revView.redraw(); });
  chk.append(A.el('button', { class: 'primary', onclick: () => { seed++; gen(); } }, '重新采样'));
  const grid = A.el('div', { class: 'cols' });
  const left = A.el('div'), right = A.el('div');
  grid.append(left, right); bd.append(grid);
  const fwdCv = A.el('canvas', { class: 'cv' }), revCv = A.el('canvas', { class: 'cv' });
  left.append(A.el('div', { class: 'small', style: { fontWeight: 600 } }, '前向加噪（拖动 t）'), fwdCv);
  const tF = A.slider(left, { label: '噪声时间 t', min: 0, max: 1, step: 0.01, value: 0.3, fmt: (v) => v.toFixed(2), on: () => fwdView.redraw(), width: 200 });
  right.append(A.el('div', { class: 'small', style: { fontWeight: 600 } }, '反向生成（拖动查看第几步）'), revCv);
  const stepS = A.slider(right, { label: '显示到第几步', min: 0, max: 30, step: 1, value: 30, fmt: (v) => v, on: () => revView.redraw(), width: 200 });
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--axis);border-radius:50%"></i>数据（类别 A / B 用浅色区分）</span><span><i style="background:var(--s2);border-radius:50%"></i>生成的样本</span><span><i class="line" style="background:var(--s1)"></i>采样轨迹</span>' }));
  let seed = 1, traj = null;
  const NS = 400, NT = 50;
  function gen() {
    const r = A.rng(seed * 31), steps = Math.round(K.value);
    const sch = sampler === 'rf' ? SCH.rf : SCH.vp;
    let X = Array.from({ length: NS }, () => [A.gauss(r), A.gauss(r)]);
    traj = [X.map((p) => p.slice())];
    const w = Wg.value;
    for (let k = 0; k < steps; k++) {
      const t = 1 - k / steps, s = 1 - (k + 1) / steps;
      const [at, bt] = sch(t), [as, bs] = sch(s);
      X = X.map(([x, y]) => {
        let x0 = denoise(x, y, at, bt, -1);
        if (cond >= 0) { const xc = denoise(x, y, at, bt, cond); x0 = [x0[0] + w * (xc[0] - x0[0]), x0[1] + w * (xc[1] - x0[1])]; }
        const ex = (x - at * x0[0]) / bt, ey = (y - at * x0[1]) / bt;
        if (sampler === 'ddpm' && s > 0) {
          const abt = at * at, abs = as * as;
          const sig = Math.sqrt(((1 - abs) / (1 - abt)) * (1 - abt / abs));
          const c = Math.sqrt(Math.max(0, 1 - abs - sig * sig));
          return [as * x0[0] + c * ex + sig * A.gauss(r), as * x0[1] + c * ey + sig * A.gauss(r)];
        }
        return [as * x0[0] + bs * ex, as * x0[1] + bs * ey];
      });
      traj.push(X.map((p) => p.slice()));
    }
    stepS.input.max = steps; stepS.value = steps;
    // quality: avg distance of samples to nearest data point
    const dist = A.mean(X.map(([x, y]) => Math.sqrt(Math.min(...data.map((p) => (p[0] - x) ** 2 + (p[1] - y) ** 2)))));
    note.innerHTML = `${steps} 步，每步对 ${NS} 个样本计算一次最优去噪器（流匹配是 Euler 步，DDIM 是 VP 余弦调度下的同一类 ODE 步）。样本到最近数据点的平均距离：<b>${dist.toFixed(3)}</b>（数据本身的“厚度”σ = ${SIG}）。` + (steps <= 4 ? ' 步数太少，样本被拉向数据的平均位置，这就是少步生成需要蒸馏的原因。' : '') + (cond >= 0 && w > 2.5 ? ' w 很大：样本被推出数据分布之外，对应图像中的过饱和、失真。' : '');
    revView.redraw();
  }
  const VIEW = 2.4;
  const toPx = (W, H) => { const s = Math.min(W, H) / (2 * VIEW); return [(x) => W / 2 + x * s, (y) => H / 2 - y * s]; };
  function drawData(ctx, X, Y, alpha) {
    const cA = A.alpha(A.css('--muted'), alpha), cB = A.alpha(A.css('--s7'), alpha);
    data.forEach((p) => { ctx.fillStyle = p[2] ? cB : cA; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2.2, 0, 7); ctx.fill(); });
  }
  const fwdView = A.canvas(fwdCv, { aspect: 1 }, (ctx, W, H) => {
    const [X, Y] = toPx(W, H), t = tF.value, [a, b] = SCH.vp(t), r = A.rng(77);
    drawData(ctx, X, Y, 0.18);
    ctx.fillStyle = A.css('--s1');
    data.forEach((p) => { ctx.beginPath(); ctx.arc(X(a * p[0] + b * A.gauss(r)), Y(a * p[1] + b * A.gauss(r)), 2.4, 0, 7); ctx.fill(); });
    A.text(ctx, `a = ${a.toFixed(2)}, b = ${b.toFixed(2)}（VP 余弦调度）`, 8, 12, { size: 11.5, color: A.css('--muted') });
  });
  const revView = A.canvas(revCv, { aspect: 1 }, (ctx, W, H) => {
    if (!traj) return;
    const [X, Y] = toPx(W, H), k = Math.min(stepS.value, traj.length - 1);
    drawData(ctx, X, Y, 0.35);
    const steps = traj.length - 1;
    if (showField) {
      const t = 1 - k / Math.max(1, steps), sch = sampler === 'rf' ? SCH.rf : SCH.vp, [a, b] = sch(Math.max(t, 0.02));
      for (let gx = -2.2; gx <= 2.2; gx += 0.3) for (let gy = -2.2; gy <= 2.2; gy += 0.3) {
        const x0 = denoise(gx, gy, a, b, cond);
        const dx = a * x0[0] - gx, dy = a * x0[1] - gy, len = Math.hypot(dx, dy) || 1, L = Math.min(0.22, len * 0.4);
        A.arrow(ctx, X(gx), Y(gy), X(gx + (dx / len) * L), Y(gy + (dy / len) * L), A.alpha(A.css('--s3'), 0.6), 1.2, 5);
      }
    }
    if (showTraj) {
      ctx.lineWidth = 1; ctx.strokeStyle = A.alpha(A.css('--s1'), 0.45);
      for (let i = 0; i < NT; i++) { ctx.beginPath(); for (let s = 0; s <= k; s++) { const p = traj[s][i]; s ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])); } ctx.stroke(); }
    }
    ctx.fillStyle = A.css('--s2');
    traj[k].forEach((p) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2.3, 0, 7); ctx.fill(); });
    A.text(ctx, `第 ${k} / ${steps} 步`, 8, 12, { size: 11.5, color: A.css('--muted') });
  });
  gen();
});
