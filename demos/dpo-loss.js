/* dpo-loss — loss and gradient shapes of DPO / IPO / SimPO / hinge as a function of the preference margin */
A.defineDemo('dpo-loss', function (mount) {
  const { bd } = A.demo(mount, '偏好优化家族：损失函数长什么样，梯度在哪里消失', '横轴 m = 好回答的对数概率比 − 差回答的对数概率比（相对参考模型）');
  let beta = 0.5, tau = 0.5, gamma = 1.0;
  const ON = { dpo: true, ipo: true, simpo: true, hinge: false };
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const F = {
    dpo: { n: 'DPO', c: 0, L: (m) => -Math.log(sig(beta * m)), G: (m) => -beta * sig(-beta * m) },
    ipo: { n: 'IPO（纵轴缩小 4 倍便于比较）', c: 1, L: (m) => Math.pow(m - 1 / (2 * tau), 2) * 0.25, G: (m) => 0.5 * (m - 1 / (2 * tau)) },
    simpo: { n: 'SimPO（含间隔 γ）', c: 2, L: (m) => -Math.log(sig(beta * m - gamma)), G: (m) => -beta * sig(-(beta * m - gamma)) },
    hinge: { n: 'Hinge（SLiC）', c: 6, L: (m) => Math.max(0, 1 - beta * m), G: (m) => (1 - beta * m > 0 ? -beta : 0) },
  };
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: 'β（偏离参考模型的“温度”）', min: 0.05, max: 2, step: 0.05, value: beta, fmt: (v) => v.toFixed(2), on: (v) => { beta = v; draw(); }, width: 200 });
  A.slider(ctl, { label: 'IPO 的 τ（目标间隔 = 1/2τ）', min: 0.1, max: 2, step: 0.05, value: tau, fmt: (v) => v.toFixed(2) + '（目标 ' + (1 / (2 * v)).toFixed(2) + '）', on: (v) => { tau = v; draw(); }, width: 210 });
  A.slider(ctl, { label: 'SimPO 的间隔 γ', min: 0, max: 3, step: 0.1, value: gamma, fmt: (v) => v.toFixed(1), on: (v) => { gamma = v; draw(); }, width: 160 });
  const chk = A.el('div', { class: 'flex' }); bd.append(chk);
  Object.keys(F).forEach((k) => A.check(chk, F[k].n, ON[k], (v) => { ON[k] = v; draw(); }));
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const plot = (cv, key, ylab, ymin, ymax) => A.canvas(cv, { aspect: 0.72 }, (ctx, W, H) => {
    const box = { x: 44, y: 20, w: W - 58, h: H - 60 };
    const ax = A.axes(ctx, box, { xmin: -6, xmax: 6, ymin, ymax, xfmt: (v) => v, yfmt: (v) => v.toFixed(1), xlabel: 'm（越往右，模型越偏向好回答）', ylabel: ylab, ylabelOffset: 36 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(0), box.y); ctx.lineTo(ax.X(0), box.y + box.h); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    Object.keys(F).forEach((k) => {
      if (!ON[k]) return;
      ctx.strokeStyle = cols[F[k].c]; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i <= 240; i++) { const m = -6 + 12 * i / 240, y = ax.Y(A.clamp(F[k][key](m), ymin - 1, ymax + 1)); i ? ctx.lineTo(ax.X(m), y) : ctx.moveTo(ax.X(m), y); }
      ctx.stroke();
    });
    ctx.restore();
  });
  const v1 = plot(cv1, 'L', '损失', 0, 5);
  const v2 = plot(cv2, 'G', '梯度 ∂L/∂m（负 = 往右推）', -1.2, 1.2);
  function draw() {
    legend.innerHTML = Object.keys(F).filter((k) => ON[k]).map((k) => `<span><i class="line" style="background:${cols[F[k].c]}"></i>${F[k].n}</span>`).join('');
    hint.innerHTML = `<b>DPO</b>：m 越大损失越小，但梯度 β·σ(−βm) 在 m 很大时趋于 0，在 m 为负（模型更偏向差回答）时最大：它主要“纠正错误”。β 越小，曲线越平，需要更大的 m 才算学好，即允许离参考模型更远。<b>IPO</b>：平方损失，有一个目标间隔 1/(2τ)；超过目标后梯度反向，把 m 拉回来，防止在“确定性偏好”上无限推大概率比、过拟合。<b>SimPO</b>：不用参考模型，用按长度平均的对数概率，再要求至少超出间隔 γ，相当于把 DPO 曲线右移。<b>Hinge</b>：超过间隔后梯度恰好为 0。RainbowPO（2025）的消融发现，这些名字背后真正起作用的主要是长度归一化和参考模型的处理方式。`;
    v1.redraw(); v2.redraw();
  }
  draw();
});
