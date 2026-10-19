/* muon-ns — Muon's orthogonalization: Newton–Schulz iterations push every singular value toward 1, step by step */
A.defineDemo('muon-ns', function (mount) {
  const { bd } = A.demo(mount, 'Muon 的正交化：牛顿-舒尔茨迭代一步步把奇异值推向 1', '系数 (a, b, c) = (3.4445, −4.7750, 2.0315)，与 Muon 的实现一致；数字都是实际迭代算出的');
  const a = 3.4445, b = -4.775, c = 2.0315;
  const SIG = [9, 4, 2, 1, 0.5, 0.25, 0.1, 0.03];
  const fro = Math.sqrt(A.sum(SIG.map((s) => s * s)));
  const p = (s) => a * s + b * s * s * s + c * Math.pow(s, 5);
  const frames = [SIG.map((s) => s / fro)];
  for (let i = 0; i < 5; i++) frames.push(frames[i].map(p));
  const STEPS = [
    { t: '原始动量矩阵', tex: String.raw`M = U\Sigma V^\top,\quad \Sigma = \operatorname{diag}(9, 4, 2, \dots, 0.03)`, say: '这是某一层权重的动量（历史梯度的平均）。它的奇异值相差 300 倍：少数几个方向占了绝大部分“能量”，其余方向几乎得不到更新。' },
    { t: '除以 Frobenius 范数', tex: String.raw`X_0 = M / \|M\|_F`, say: '先整体缩放，让所有奇异值都不超过 1，这是迭代收敛的前提。缩放不改变方向，只改变大小。' },
    { t: '第 1 次迭代', tex: String.raw`X \leftarrow aX + b\,(XX^\top)X + c\,(XX^\top)^2X`, say: '这个矩阵多项式不需要做 SVD，只有矩阵乘法，GPU 上很快。它对每个奇异值 σ 分别作用：σ → aσ + bσ³ + cσ⁵。小的奇异值被放大约 3.4 倍。' },
    { t: '第 2 次迭代', tex: String.raw`\sigma \leftarrow p(\sigma) = a\sigma + b\sigma^3 + c\sigma^5`, say: '再作用一次。原本很小的奇异值继续被放大，已经接近 1 的不再增长。' },
    { t: '第 3 次迭代', tex: String.raw`\sigma \leftarrow p(\sigma)`, say: '大部分奇异值已经进入 0.7–1.2 的区间。' },
    { t: '第 4 次迭代', tex: String.raw`\sigma \leftarrow p(\sigma)`, say: '这组系数是为“尽快把小奇异值拉上来”调出来的，代价是不会精确收敛到 1，而是在 1 附近小幅摆动。' },
    { t: '第 5 次迭代：完成', tex: String.raw`X_5 \approx UV^\top`, say: '5 次之后，所有方向的更新幅度都差不多：原来被忽略的方向现在和主方向得到同样大小的更新。Muon 就用这个近似正交的矩阵作为更新方向。' },
  ];
  let k = 0;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  bar.append(prev, next);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2);
  bd.append(bar, slider, dots, fx, say, grid);
  const cols = A.series();
  const cur = () => (k === 0 ? SIG.map((s) => s / 9) : frames[k - 1]);
  const v1 = A.canvas(cv1, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 40, y: 22, w: W - 54, h: H - 62 };
    const s = cur(), ymax = 1.3;
    const ax = A.axes(ctx, box, { xmin: 0, xmax: SIG.length, ymin: 0, ymax, yticks: [0, 0.25, 0.5, 0.75, 1, 1.25], yfmt: (v) => v.toFixed(2), xticks: [], ylabel: k === 0 ? '奇异值（÷ 最大值 9，仅为显示）' : '奇异值', ylabelOffset: 34 });
    ctx.save(); ctx.strokeStyle = cols[1]; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(1)); ctx.lineTo(box.x + box.w, ax.Y(1)); ctx.stroke(); ctx.restore();
    const bw = box.w / SIG.length * 0.62;
    s.forEach((v, i) => {
      const x = ax.X(i + 0.5) - bw / 2;
      A.bar(ctx, x, ax.Y(Math.min(v, ymax)), bw, ax.Y(0) - ax.Y(Math.min(v, ymax)), cols[0], 3);
      A.text(ctx, k === 0 ? String(SIG[i]) : v.toFixed(2), x + bw / 2, ax.Y(Math.min(v, ymax)) - 9, { size: 11, align: 'center', mono: true });
      A.text(ctx, 'σ' + (i + 1), x + bw / 2, box.y + box.h + 12, { size: 11, align: 'center', color: A.css('--muted') });
    });
    const sp = Math.max(...s) / Math.min(...s);
    A.text(ctx, '最大 / 最小 = ' + (sp > 100 ? sp.toFixed(0) : sp.toFixed(1)) + ' 倍', box.x + box.w - 4, box.y + 4, { size: 12, align: 'right', color: A.css('--ink-2'), weight: 600 });
  });
  const v2 = A.canvas(cv2, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 40, y: 22, w: W - 54, h: H - 62 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1.25, ymin: 0, ymax: 1.3, yticks: [0, 0.5, 1], xticks: [0, 0.25, 0.5, 0.75, 1, 1.25], yfmt: (v) => v.toFixed(1), xfmt: (v) => v.toFixed(2), xlabel: '输入 σ', ylabel: '输出 p(σ)', ylabelOffset: 34 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(0)); ctx.lineTo(ax.X(1.25), ax.Y(1.25)); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const s = 1.25 * i / 200, y = A.clamp(p(s), -0.2, 1.3); i ? ctx.lineTo(ax.X(s), ax.Y(y)) : ctx.moveTo(ax.X(s), ax.Y(y)); }
    ctx.stroke();
    A.text(ctx, 'p(σ) = aσ + bσ³ + cσ⁵', ax.X(0.62), ax.Y(0.2), { size: 12, color: cols[0], weight: 600 });
    A.text(ctx, '虚线：y = σ', ax.X(1.24), ax.Y(1.28), { size: 11, align: 'right', color: A.css('--muted') });
    if (k >= 2) {
      const from = frames[k - 2], to = frames[k - 1];
      from.forEach((s0, i) => {
        if (s0 > 1.25) return;
        ctx.strokeStyle = A.alpha(cols[1], 0.8); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(ax.X(s0), ax.Y(0)); ctx.lineTo(ax.X(s0), ax.Y(to[i])); ctx.lineTo(ax.X(0), ax.Y(to[i])); ctx.stroke();
        ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(s0), ax.Y(to[i]), 3, 0, 7); ctx.fill();
      });
      A.text(ctx, '本次迭代：每个 σ 竖直映射到 p(σ)', box.x + 4, box.y + 4, { size: 11.5, color: cols[1] });
    }
  });
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); slider.value = k; render(); }
  function render() {
    const s = STEPS[k];
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    let extra = '';
    if (k >= 1) { const f = cur(); extra = `　当前最小的奇异值 ${Math.min(...f).toFixed(3)}，最大 ${Math.max(...f).toFixed(3)}。`; }
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}${extra}`;
    v1.redraw(); v2.redraw();
  }
  render();
});
