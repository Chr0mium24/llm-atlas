/* backprop-step — one neuron, step by step: forward values flow right, gradients flow left via the chain rule; finite-difference check */
A.defineDemo('backprop-step', function (mount) {
  const { bd } = A.demo(mount, '反向传播，一步一步', '一个神经元：z = w·x + b，a = σ(z)，损失 L = (a − y)²。前向从左往右算数值，反向从右往左用链式法则算梯度');
  let w = 0.8, b = -0.5;
  const x = 1.5, y = 1, lr = 1;
  const sig = (t) => 1 / (1 + Math.exp(-t));
  const calc = (w, b) => { const z = w * x + b, a = sig(z), L = (a - y) ** 2, dLa = 2 * (a - y), dLz = dLa * a * (1 - a); return { z, a, L, dLa, dLz, dLw: dLz * x, dLb: dLz }; };
  const STEPS = [
    { t: '计算图', tex: String.raw`L = \big(\sigma(wx+b) - y\big)^2`, say: '把一个复杂函数拆成几步简单运算，画成从左到右的图。每个方框是一个中间结果。目标：求 L 对参数 w、b 的导数，知道往哪个方向调参数能让损失变小。' },
    { t: '前向：线性', tex: String.raw`z = w\cdot x + b`, say: '从输入开始往右算。' },
    { t: '前向：激活', tex: String.raw`a = \sigma(z) = \frac{1}{1+e^{-z}}`, say: 'sigmoid 把任意实数压到 0 和 1 之间。' },
    { t: '前向：损失', tex: String.raw`L = (a-y)^2`, say: '预测 a 离目标 y 越远，损失越大。前向到此结束，所有中间值都已记下，反向要用到它们。' },
    { t: '反向：起点', tex: String.raw`\frac{\partial L}{\partial a} = 2(a-y)`, say: '反向从损失开始。这是最后一步运算的局部导数：a 增加一点，L 变化多少。' },
    { t: '反向：穿过激活', tex: String.raw`\frac{\partial L}{\partial z} = \frac{\partial L}{\partial a}\cdot\underbrace{\sigma(z)\big(1-\sigma(z)\big)}_{\partial a/\partial z}`, say: '链式法则：从右边传来的梯度，乘以这一步的局部导数。sigmoid 的导数恰好能用前向时记下的 a 算出来，不用重新计算。' },
    { t: '反向：到参数', tex: String.raw`\frac{\partial L}{\partial w} = \frac{\partial L}{\partial z}\cdot x,\qquad \frac{\partial L}{\partial b} = \frac{\partial L}{\partial z}\cdot 1`, say: 'z = wx + b 对 w 的局部导数是 x，对 b 是 1。每个参数的梯度，就是从损失一路乘回来的局部导数之积。' },
    { t: '验证与更新', tex: String.raw`w \leftarrow w - \eta\,\frac{\partial L}{\partial w},\qquad b \leftarrow b - \eta\,\frac{\partial L}{\partial b}`, say: '用数值差分验证：把 w 加减一个很小的数，看损失变化多少，结果应与反向传播一致。然后沿负梯度方向走一步（学习率 η = 1），损失下降。' },
  ];
  let k = 0;
  const ctl = A.el('div', { class: 'controls' });
  A.slider(ctl, { label: '权重 w', min: -2, max: 2, step: 0.1, value: w, fmt: (v) => v.toFixed(1), on: (v) => { w = v; render(); }, width: 160 });
  A.slider(ctl, { label: '偏置 b', min: -2, max: 2, step: 0.1, value: b, fmt: (v) => v.toFixed(1), on: (v) => { b = v; render(); }, width: 160 });
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  bar.append(prev, next);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const cv = A.el('canvas', { class: 'cv' });
  bd.append(ctl, bar, dots, fx, say, cv);
  const cols = A.series();
  const f4 = (v) => (Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(1) : v.toFixed(3));
  const view = A.canvas(cv, { aspect: 0.52 }, (ctx, W, H) => {
    const r = calc(w, b), ink = A.css('--ink'), muted = A.css('--muted'), line = A.css('--axis');
    const bw = Math.min(96, W * 0.13), bh = 40;
    const X = (f) => 16 + f * (W - 32 - bw);
    const N = {
      w: { x: X(0), y: H * 0.1, lab: 'w', val: w, fwd: 0, grad: r.dLw, bwd: 6 },
      x: { x: X(0), y: H * 0.5 - bh / 2, lab: 'x', val: x, fwd: 0, grad: null },
      b: { x: X(0), y: H * 0.86 - bh, lab: 'b', val: b, fwd: 0, grad: r.dLb, bwd: 6 },
      z: { x: X(0.36), y: H * 0.5 - bh / 2, lab: 'z = wx + b', val: r.z, fwd: 1, grad: r.dLz, bwd: 5 },
      a: { x: X(0.68), y: H * 0.5 - bh / 2, lab: 'a = σ(z)', val: r.a, fwd: 2, grad: r.dLa, bwd: 4 },
      L: { x: X(1), y: H * 0.5 - bh / 2, lab: 'L = (a−y)²', val: r.L, fwd: 3, grad: 1, bwd: 3 },
    };
    const edge = (p, q) => { const x0 = p.x + bw, y0 = p.y + bh / 2, x1 = q.x, y1 = q.y + bh / 2; A.arrow(ctx, x0, y0, x1 - 2, y1, line, 1.5, 7); };
    edge(N.w, N.z); edge(N.x, N.z); edge(N.b, N.z); edge(N.z, N.a); edge(N.a, N.L);
    const curNode = { 1: 'z', 2: 'a', 3: 'L', 4: 'a', 5: 'z', 6: 'w' }[k];
    Object.entries(N).forEach(([id, n]) => {
      const hot = id === curNode || (k === 6 && id === 'b');
      ctx.fillStyle = hot ? A.alpha(cols[0], 0.14) : A.css('--surface'); ctx.strokeStyle = hot ? cols[0] : line; ctx.lineWidth = hot ? 2 : 1.2;
      ctx.beginPath(); ctx.roundRect(n.x, n.y, bw, bh, 8); ctx.fill(); ctx.stroke();
      A.text(ctx, n.lab, n.x + bw / 2, n.y + bh / 2, { size: 12, align: 'center', color: ink, weight: 600 });
      if (k >= n.fwd) A.text(ctx, '= ' + f4(n.val), n.x + bw / 2, n.y - 10, { size: 12, align: 'center', color: cols[0], mono: true, weight: 600 });
      if (n.grad !== null && n.bwd !== undefined && k >= n.bwd) A.text(ctx, '∂L/∂' + id + ' = ' + f4(n.grad), n.x + bw / 2, n.y + bh + 12, { size: 11.5, align: 'center', color: cols[1], mono: true, weight: 600 });
    });
    A.text(ctx, '目标 y = ' + y, N.L.x + bw / 2, N.L.y - 28, { size: 11, align: 'center', color: muted });
    A.text(ctx, '蓝：前向的数值　橙：反向的梯度', 16, H - 8, { size: 11, color: muted });
  });
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); render(); }
  function render() {
    const s = STEPS[k], r = calc(w, b);
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    let extra = '';
    if (k === 7) {
      const eps = 1e-4, num = (calc(w + eps, b).L - calc(w - eps, b).L) / (2 * eps);
      const r2 = calc(w - lr * r.dLw, b - lr * r.dLb);
      extra = `　数值差分 ∂L/∂w ≈ ${num.toFixed(5)}，反向传播 ${r.dLw.toFixed(5)}，一致。走一步后：w = ${(w - lr * r.dLw).toFixed(3)}，b = ${(b - lr * r.dLb).toFixed(3)}，损失 ${r.L.toFixed(4)} → ${r2.L.toFixed(4)}。`;
    }
    if (k === 5) extra = `　这里 σ′(z) = a(1 − a) = ${(r.a * (1 - r.a)).toFixed(3)}。把 w 调到很大或很小，让 z 远离 0，这个数会接近 0：梯度在这一步几乎被“掐断”，这就是饱和激活函数导致梯度消失的原因。`;
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}${extra}`;
    view.redraw();
  }
  render();
});
