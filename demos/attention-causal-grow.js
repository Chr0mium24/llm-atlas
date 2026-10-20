/* attention-causal-grow — generation under a causal mask: prefill computes the prompt's rows at once, then every decode step adds one row and one K/V pair; earlier rows never change */
A.defineDemo('attention-causal-grow', function (mount) {
  const { bd } = A.demo(mount, '逐 token 生成：注意力矩阵一行一行长出来', 'q、k 是固定种子的随机向量（d_h = 8），只为展示形状；权重按公式实际计算');
  const TOK = ['小猫', '追', '红', '球', '，', '球', '滚', '远', '了'];
  const P = 4, n = TOK.length, dh = 8;
  const r = A.rng(20261020);
  const u = Array.from({ length: dh }, () => A.gauss(r)); // a direction shared by every query; the first key points along it (a mild sink, as in real models)
  const Qv = TOK.map(() => Array.from({ length: dh }, (_, i) => A.gauss(r) + 0.5 * u[i]));
  const Kv = TOK.map((_, j) => Array.from({ length: dh }, (_, i) => (j === 0 ? 0.6 * u[i] + 0.3 * A.gauss(r) : A.gauss(r))));
  const W = TOK.map((_, i) => A.softmax(TOK.slice(0, i + 1).map((_, j) => A.dot(Qv[i], Kv[j]) / Math.sqrt(dh))));
  const FR = [{ t: P, pre: true }].concat(TOK.slice(P).map((_, i) => ({ t: P + i + 1 })));
  const KVB = 2 * 32 * 8 * 128 * 2; // Llama 3 8B: 2 (K and V) × 32 layers × 8 KV heads × 128 dims × 2 bytes
  let k = 0, timer = null;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { type: 'button', onclick: () => { stop(); go(k - 1); } }, '← 上一步');
  const next = A.el('button', { type: 'button', class: 'primary', onclick: () => { stop(); go(k + 1); } }, '下一步 →');
  const play = A.el('button', { type: 'button', onclick: () => (timer ? stop() : start()) }, '▶ 自动播放');
  bar.append(prev, next, play);
  const slider = A.el('input', { type: 'range', min: 0, max: FR.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => { stop(); go(+slider.value); };
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = FR.map((f, i) => { const d = A.el('button', { type: 'button', class: 'gs-dot', onclick: () => { stop(); go(i); } }, f.pre ? '1 预填充' : (i + 1) + ' 生成「' + TOK[f.t - 1] + '」'); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const cv = A.el('canvas', { class: 'cv' });
  const meter = A.el('div', { class: 'legend' });
  bd.append(bar, slider, dots, fx, say, cv, meter);
  const view = A.canvas(cv, { get aspect() { return (cv.clientWidth || 600) < 520 ? 1 : 0.62; } }, paint);
  function go(i) { k = A.clamp(i, 0, FR.length - 1); slider.value = k; render(); }
  function start() {
    if (k === FR.length - 1) go(0);
    play.textContent = '❚❚ 暂停';
    timer = setInterval(() => { if (k >= FR.length - 1) { stop(); return; } go(k + 1); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 2600 : 1600);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; play.textContent = '▶ 自动播放'; }
  function paint(ctx, Wd, H) {
    const f = FR[k], t = f.t, cols = A.series();
    const narrow = Wd < 520, lab = 40, top = 54, cell = Math.min((Wd - lab - (narrow ? 8 : 150)) / n, (H - top - 8) / n);
    const gx = lab, gy = top;
    // K/V cache strip
    A.text(ctx, 'KV 缓存（每个已处理的 token 存一对 k、v）', gx, 12, { size: 12, weight: 600 });
    for (let j = 0; j < n; j++) {
      const x = gx + j * cell, y = 24;
      const isNew = f.pre ? j < P : j === t - 1;
      if (j < t) { ctx.fillStyle = isNew ? A.alpha(cols[1], 0.85) : A.alpha(cols[0], 0.55); ctx.fillRect(x + 1, y, cell - 2, 18); if (cell >= 28) A.text(ctx, 'k,v', x + cell / 2, y + 9, { size: 10, align: 'center', color: '#fff', mono: true }); }
      else { ctx.strokeStyle = A.css('--grid'); ctx.setLineDash([3, 3]); ctx.strokeRect(x + 1.5, y + 0.5, cell - 3, 17); ctx.setLineDash([]); }
    }
    const masked = A.isDark() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.045)';
    for (let i = 0; i < n; i++) {
      A.text(ctx, TOK[i], gx - 6, gy + i * cell + cell / 2, { size: Math.min(12.5, cell * 0.42), align: 'right', color: i < t ? A.css('--ink') : A.css('--muted') });
      for (let j = 0; j < n; j++) {
        const x = gx + j * cell, y = gy + i * cell;
        if (j > i) { ctx.fillStyle = masked; ctx.fillRect(x, y, cell - 1, cell - 1); continue; }
        if (i >= t) { ctx.strokeStyle = A.css('--grid'); ctx.strokeRect(x + 0.5, y + 0.5, cell - 2, cell - 2); continue; }
        const w = W[i][j];
        ctx.fillStyle = A.seq(Math.pow(w, 0.6)); ctx.fillRect(x, y, cell - 1, cell - 1);
        if (cell > 30) A.text(ctx, Math.round(w * 100) + '', x + cell / 2, y + cell / 2, { size: 10.5, align: 'center', mono: true, color: w > 0.4 ? (A.isDark() ? '#0d1b2a' : '#fff') : A.css('--ink-2') });
      }
    }
    const hi = f.pre ? [0, P] : [t - 1, t];
    ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.5;
    ctx.strokeRect(gx - 1, gy + hi[0] * cell - 1, (f.pre ? P : t) * cell + 1, (hi[1] - hi[0]) * cell + 1);
    ctx.lineWidth = 1;
    if (narrow) return;
    const tx = gx + n * cell + 14;
    A.text(ctx, f.pre ? '本步新算的行：' : '本步新算的一行：', tx, gy + 8, { size: 12, color: cols[1], weight: 600 });
    A.text(ctx, f.pre ? '1–' + P + ' 行一起算' : '第 ' + t + ' 行', tx, gy + 26, { size: 12, color: A.css('--ink-2') });
    A.text(ctx, '灰色：被掩码遮住', tx, gy + 52, { size: 11.5, color: A.css('--muted') });
    A.text(ctx, '虚线：还没生成', tx, gy + 70, { size: 11.5, color: A.css('--muted') });
    A.text(ctx, '格中数字：权重 %', tx, gy + 88, { size: 11.5, color: A.css('--muted') });
  }
  function render() {
    const f = FR[k], t = f.t;
    prev.disabled = k === 0; next.disabled = k === FR.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    const tex = f.pre ? String.raw`O_{1:${P}} = \operatorname{softmax}\!\Big(\frac{Q K^\top}{\sqrt{d_h}} + M\Big)V\qquad (${P}\times ${P})` : String.raw`\mathbf o_{${t}} = \sum_{j\le ${t}} a_{${t}j}\,\mathbf v_j,\qquad a_{${t}j} = \operatorname{softmax}_j\Big(\frac{\mathbf q_{${t}}\cdot\mathbf k_j}{\sqrt{d_h}}\Big)`;
    if (window.katex) katex.render(tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = tex;
    const cum = (t * (t + 1)) / 2;
    let s;
    if (f.pre) s = `<b>预填充。</b>提示词的 ${P} 个 token 一次性输入：算出 ${P} 个 q、k、v，把 k、v 存进缓存，再用一次矩阵乘法算出 ${P}×${P} 的下三角（${(P * (P + 1)) / 2} 个分数）。这一步像训练时一样并行，GPU 很忙。`;
    else {
      const j = W[t - 1].indexOf(Math.max(...W[t - 1]));
      s = `<b>生成第 ${t} 个 token「${TOK[t - 1]}」。</b>只为这个新 token 算 q、k、v；k、v 追加进缓存（现在 ${t} 对）；q 和缓存里的 ${t} 个 key 打分，得到第 ${t} 行，最大权重给了「${TOK[j]}」（${A.pct(W[t - 1][j], 0)}）。上面各行一个数都没变：掩码让它们本来就看不到新 token，所以旧的 k、v 可以原样复用。`;
    }
    if (k === FR.length - 1) s += `　全程一共算了 ${cum} 个分数，正好是 n(n+1)/2；每一步的工作量随 t 线性增长，总量仍是平方。`;
    say.innerHTML = s;
    const noCache = f.pre ? P : t;
    meter.innerHTML = `<span>本步打分：<b>${f.pre ? (P * (P + 1)) / 2 : t}</b> 个</span><span>累计打分：<b>${cum}</b> 个</span><span>本步要读的缓存：<b>${f.pre ? 0 : t - 1}</b> 对旧的 k、v</span><span>不用缓存的话，本步要重算 <b>${noCache}</b> 个 k、v</span><span>放大到 Llama 3 8B：缓存 ${t} × ${A.bytes(KVB, 0)} = <b>${A.bytes(t * KVB, 1)}</b>；到 8192 个 token 时 <b>${A.bytes(8192 * KVB, 1)}</b></span>`;
    view.redraw();
  }
  render();
});
