/* residual-depth — gradient flow through a deep linearized stack: plain vs residual vs residual with branch scaling; and the Pre-Norm "deeper layers matter less" effect */
A.defineDemo('residual-depth', function (mount) {
  const { bd } = A.demo(mount, '残差连接：梯度怎样穿过很多层', '线性化的玩具网络：d = 24，每层一个随机矩阵；所有曲线都是实际相乘算出来的');
  const D = 24, LMAX = 96;
  const r = A.rng(7);
  const MATS = Array.from({ length: LMAX }, () => Array.from({ length: D * D }, () => A.gauss(r) / Math.sqrt(D)));
  const G0 = (() => { const g = Array.from({ length: D }, () => A.gauss(r)); const n = Math.hypot(...g); return g.map((x) => x / n); })();
  const BR = Array.from({ length: LMAX }, () => { const v = Array.from({ length: 64 }, () => A.gauss(r)); const n = Math.hypot(...v); return v.map((x) => x / n); });
  let view = 'grad', mode = 'res-scaled';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'grad', t: '梯度能传多远' }, { v: 'prenorm', t: 'Pre-Norm 的副作用' }], view, (v) => { view = v; sync(); }, '看什么');
  const modeWrap = A.el('div'); ctl.append(modeWrap);
  A.seg(modeWrap, [{ v: 'plain', t: '直接堆叠' }, { v: 'res', t: '加残差' }, { v: 'res-scaled', t: '残差 + 分支缩小' }], mode, (v) => { mode = v; draw(); }, '结构');
  const LS = A.slider(ctl, { label: '层数 L', min: 4, max: LMAX, step: 1, value: 48, fmt: (v) => v, on: () => draw(), width: 170 });
  const SS = A.slider(ctl, { label: '每层矩阵的放大倍数 σ', min: 0.5, max: 1.5, step: 0.01, value: 0.9, fmt: (v) => v.toFixed(2), on: () => draw(), width: 200 });
  const CS = A.slider(ctl, { label: '每层分支输出的大小 c', min: 0.2, max: 2, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), on: () => draw(), width: 200 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const MODES = { plain: { n: '直接堆叠', c: 3 }, res: { n: '加残差', c: 1 }, 'res-scaled': { n: '残差 + 分支缩小', c: 0 } };

  // backward pass: g_{l} = (a·I + b·J_l)^T g_{l+1}; returns |g| at every layer (index 0 = first layer)
  function grads(m, L, sig) {
    const a = m === 'plain' ? 0 : 1, b = m === 'res-scaled' ? 1 / Math.sqrt(2 * L) : 1;
    let g = G0.slice();
    const out = new Array(L + 1); out[L] = 1;
    for (let l = L - 1; l >= 0; l--) {
      const M = MATS[l], ng = new Array(D);
      for (let j = 0; j < D; j++) { let s = 0; for (let i = 0; i < D; i++) s += M[i * D + j] * g[i]; ng[j] = a * g[j] + b * sig * s; }
      g = ng; out[l] = Math.hypot(...g);
    }
    return out;
  }
  // Pre-Norm forward: x_{l+1} = x_l + c·u_l (u_l: unit-ish random direction, since the branch sees a normalized input)
  function prenorm(L, c) {
    const x = Array.from({ length: 64 }, (_, i) => BR[LMAX - 1][i]);
    const rel = [], nrm = [];
    for (let l = 0; l < L; l++) {
      const n0 = Math.hypot(...x);
      rel.push(c / n0); nrm.push(n0);
      for (let i = 0; i < 64; i++) x[i] += c * BR[l][i];
    }
    return { rel, nrm };
  }
  const view_ = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    const L = Math.round(LS.value), sig = SS.value;
    const box = { x: 58, y: 24, w: W - 76, h: H - 66 };
    if (view === 'grad') {
      const ax = A.axes(ctx, box, { xmin: 0, xmax: L, ymin: 1e-8, ymax: 1e8, ylog: true, yfmt: (v) => (v === 1 ? '1' : '10' + String(Math.round(Math.log10(v))).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])), xlabel: '层号（左 = 第 1 层，右 = 最后一层）', ylabel: '梯度大小 |g|', ylabelOffset: 50 });
      const yc = (v) => ax.Y(A.clamp(v, 1e-8, 1e8));
      ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(1)); ctx.lineTo(box.x + box.w, ax.Y(1)); ctx.stroke(); ctx.setLineDash([]);
      Object.keys(MODES).forEach((m) => {
        const g = grads(m, L, sig), on = m === mode;
        ctx.strokeStyle = on ? cols[MODES[m].c] : A.alpha(cols[MODES[m].c], 0.3); ctx.lineWidth = on ? 3 : 1.5;
        ctx.beginPath(); g.forEach((v, l) => (l ? ctx.lineTo(ax.X(l), yc(v)) : ctx.moveTo(ax.X(l), yc(v)))); ctx.stroke();
        A.text(ctx, MODES[m].n, ax.X(0) + 6, yc(g[0]) + (m === 'plain' ? 12 : -10), { size: 12, color: on ? cols[MODES[m].c] : A.css('--muted'), weight: on ? 700 : 400 });
      });
      A.text(ctx, '← 梯度从最后一层往回传', box.x + box.w - 4, box.y + 6, { size: 12, align: 'right', color: A.css('--muted') });
    } else {
      const { rel } = prenorm(L, CS.value);
      const post = CS.value / Math.sqrt(1 + CS.value * CS.value);
      const ymax = Math.max(1.2, Math.ceil(Math.max(...rel) * 5) / 5);
      const ax = A.axes(ctx, box, { xmin: 0, xmax: L, ymin: 0, ymax, yfmt: (v) => v.toFixed(1), xlabel: '层号 l', ylabel: '这一层加进去的量 ÷ 残差流的大小', ylabelOffset: 50 });
      const bw = Math.max(1, box.w / L - 1.5);
      rel.forEach((v, l) => A.bar(ctx, ax.X(l + 0.5) - bw / 2, ax.Y(v), bw, ax.Y(0) - ax.Y(v), A.alpha(cols[0], 0.75), 2));
      ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(box.x, ax.Y(post)); ctx.lineTo(box.x + box.w, ax.Y(post)); ctx.stroke();
      A.text(ctx, 'Post-Norm：每层之后重新归一化，占比不变', box.x + box.w - 4, ax.Y(post) - 10, { size: 12, align: 'right', color: cols[1], weight: 600 });
      A.text(ctx, 'Pre-Norm：残差流越来越长，占比 ≈ c / √(1 + l c²)', box.x + 8, box.y + 6, { size: 12, color: cols[0], weight: 600 });
    }
  });
  function draw() {
    const L = Math.round(LS.value), sig = SS.value;
    stats.innerHTML = '';
    if (view === 'grad') {
      Object.keys(MODES).forEach((m) => {
        const g = grads(m, L, sig);
        stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, MODES[m].n + '：第 1 层的梯度'), A.el('div', { class: 'v', style: { color: m === mode ? cols[MODES[m].c] : '' } }, A.sci(g[0]))));
      });
      hint.innerHTML = `每一层把梯度乘上一个随机矩阵（典型放大倍数 σ）。<b>直接堆叠</b>：${L} 层连乘的量级约为 σ<sup>${L}</sup> = ${A.sci(Math.pow(sig, L))}，σ 稍小于 1 梯度就消失，稍大于 1 就爆炸。<b>加残差</b>：每层的雅可比变成 I + J，恒等项保证梯度至少有一条直通的路；但分支本身没有缩小时，每层都在“1”的基础上再加一份，梯度仍会慢慢变大。<b>残差 + 分支缩小</b>：把每个分支的输出乘 1/√(2L)（GPT-2 初始化的做法），所有层加起来的扰动有界，梯度稳定在 1 附近，与层数几乎无关。`;
    } else {
      const { rel, nrm } = prenorm(L, CS.value);
      [['第 1 层的占比', A.pct(rel[0], 0)], [`第 ${L} 层的占比`, A.pct(rel[L - 1], 0)], ['残差流长度增长', '×' + (nrm[L - 1] / nrm[0]).toFixed(1)]].forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v' }, v))));
      hint.innerHTML = 'Pre-Norm 中，每层的分支看到的是归一化后的输入，输出大小大致固定（c）；而残差流本身从不归一化，每层加一个方向随机的向量，长度按 √l 增长。于是越深的层，加进去的内容在残差流里占比越小，对最终输出的影响越弱。这与“删掉大模型后部相当多的层，性能下降很小”的实验观察一致（Gromov 等, 2024）。Post-Norm 每层都重新归一化，没有这个问题，但梯度没有直通路径，深了难训。';
    }
    view_.redraw();
  }
  function sync() {
    modeWrap.style.display = view === 'grad' ? '' : 'none';
    SS.el.style.display = view === 'grad' ? '' : 'none';
    CS.el.style.display = view === 'grad' ? 'none' : '';
    draw();
  }
  sync();
});
