/* superposition — Anthropic's toy model: n sparse features squeezed into 2 dimensions; trained live in the browser */
A.defineDemo('superposition', function (mount) {
  const { bd } = A.demo(mount, '叠加：5 个特征挤进 2 维', '玩具模型 x̂ = ReLU(WᵀW x + b)，W 是 2×5；特征越靠前越重要；在浏览器里实时训练');
  const n = 5;
  let S = 0.9, seed = 1, tmr = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '稀疏度（每个特征为 0 的概率）', min: 0, max: 0.98, step: 0.01, value: S, fmt: (v) => A.pct(v, 0), on: (v) => { S = v; clearTimeout(tmr); tmr = setTimeout(train, 150); }, width: 240 });
  ctl.append(A.el('button', { onclick: () => { seed++; train(); } }, '重新训练'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const I = Array.from({ length: n }, (_, i) => Math.pow(0.8, i));
  let W, b, loss = 0;
  function train() {
    const r = A.rng(seed * 101 + Math.round(S * 1000));
    W = [Array.from({ length: n }, () => A.gauss(r) * 0.3), Array.from({ length: n }, () => A.gauss(r) * 0.3)];
    b = new Array(n).fill(0);
    const P = W.flat().concat(b), m = new Array(P.length).fill(0), v = new Array(P.length).fill(0);
    const lr = 0.02, B = 32, steps = 2500;
    for (let s = 1; s <= steps; s++) {
      const gW = [new Array(n).fill(0), new Array(n).fill(0)], gb = new Array(n).fill(0); let L = 0;
      for (let k = 0; k < B; k++) {
        const x = Array.from({ length: n }, () => (r() < S ? 0 : r()));
        const h = [0, 1].map((a) => A.sum(W[a].map((w, j) => w * x[j])));
        const z = Array.from({ length: n }, (_, i) => W[0][i] * h[0] + W[1][i] * h[1] + b[i]);
        const xh = z.map((q) => Math.max(0, q));
        const d = xh.map((q, i) => (z[i] > 0 ? 2 * I[i] * (q - x[i]) : 0));
        L += A.sum(xh.map((q, i) => I[i] * (q - x[i]) ** 2));
        const Wd = [0, 1].map((a) => A.sum(W[a].map((w, i) => w * d[i])));
        for (let a = 0; a < 2; a++) for (let i = 0; i < n; i++) gW[a][i] += h[a] * d[i] + Wd[a] * x[i];
        for (let i = 0; i < n; i++) gb[i] += d[i];
      }
      const g = gW.flat().concat(gb).map((q) => q / B);
      const cur = W.flat().concat(b);
      for (let p = 0; p < cur.length; p++) { m[p] = 0.9 * m[p] + 0.1 * g[p]; v[p] = 0.999 * v[p] + 0.001 * g[p] * g[p]; cur[p] -= lr * (m[p] / (1 - Math.pow(0.9, s))) / (Math.sqrt(v[p] / (1 - Math.pow(0.999, s))) + 1e-8); }
      W = [cur.slice(0, n), cur.slice(n, 2 * n)]; b = cur.slice(2 * n);
      if (s > steps - 100) loss += L / B / 100;
    }
    draw();
    loss = 0;
  }
  const view = A.canvas(cv, { aspect: 0.6 }, (ctx, W_, H) => {
    const cx = W_ / 2, cy = H / 2, sc = Math.min(W_, H) * 0.32;
    ctx.strokeStyle = A.css('--grid'); ctx.beginPath(); ctx.arc(cx, cy, sc, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - sc - 10, cy); ctx.lineTo(cx + sc + 10, cy); ctx.moveTo(cx, cy - sc - 10); ctx.lineTo(cx, cy + sc + 10); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = W[0][i], y = W[1][i], len = Math.hypot(x, y);
      if (len < 0.05) continue;
      A.arrow(ctx, cx, cy, cx + x * sc, cy - y * sc, cols[i], 2.5 + 2 * I[i], 10);
      A.text(ctx, '特征 ' + (i + 1), cx + x * sc * 1.12, cy - y * sc * 1.12, { size: 12, color: cols[i], weight: 700, align: 'center' });
    }
    A.text(ctx, '每个箭头 = 一个特征在 2 维隐藏空间里的方向（W 的一列）', 10, H - 10, { size: 11.5, color: A.css('--muted') });
  });
  function draw() {
    const norms = Array.from({ length: n }, (_, i) => Math.hypot(W[0][i], W[1][i]));
    const rep = norms.filter((q) => q > 0.5).length;
    let minAng = 180;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (norms[i] > 0.5 && norms[j] > 0.5) minAng = Math.min(minAng, Math.acos(A.clamp((W[0][i] * W[0][j] + W[1][i] * W[1][j]) / (norms[i] * norms[j]), -1, 1)) * 180 / Math.PI);
    stats.innerHTML = '';
    [['被表示的特征数', rep + ' / 5（只有 2 个维度）'], ['任意两个特征方向的最小夹角', rep > 1 ? minAng.toFixed(0) + '°' : '—'], ['训练末期的损失', loss.toFixed(4)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = '稀疏度低（特征经常同时出现）时，模型只用 2 个维度表示最重要的 2 个特征，并让它们互相正交，其余特征干脆放弃：这是“一个维度一个特征”的经典情形。把稀疏度调到 90% 以上：特征很少同时出现，模型开始把更多特征“挤”进 2 维，方向彼此成钝角（常见的是五边形），偶尔同时出现时会相互干扰，但 ReLU 和偏置能过滤掉大部分干扰。这就是<b>叠加</b>：真实模型中，特征的数量远多于维度，大多数神经元同时参与表示好几个不相关的概念。';
    view.redraw();
  }
  train();
});
