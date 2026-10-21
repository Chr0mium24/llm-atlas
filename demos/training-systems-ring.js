/* training-systems-ring — ring all-reduce step by step on 4 GPUs (reduce-scatter then all-gather), plus per-GPU traffic vs number of GPUs */
A.defineDemo('training-systems-ring', function (mount) {
  const { bd } = A.demo(mount, '环形全规约：一步一步看', '4 张卡排成一个环，每张卡的梯度切成 4 块，每块用一个数代表 S/4 字节；每一步，每张卡同时把一块发给下一张卡');
  const K = 4;
  const G0 = [[3, 1, 4, 1], [5, 9, 2, 6], [5, 3, 5, 8], [2, 7, 1, 8]];
  // simulate all frames: each cell {v, src:Set}
  const frames = [];
  let cur = G0.map((row, i) => row.map((v) => ({ v, src: [i] })));
  const clone = (s) => s.map((r) => r.map((c) => ({ v: c.v, src: c.src.slice() })));
  frames.push({ st: clone(cur), sends: [] });
  for (let s = 0; s < K - 1; s++) {
    const nx = clone(cur), sends = [];
    for (let i = 0; i < K; i++) { const c = ((i - s) % K + K) % K, j = (i + 1) % K; nx[j][c] = { v: nx[j][c].v + cur[i][c].v, src: nx[j][c].src.concat(cur[i][c].src) }; sends.push({ i, j, c }); }
    cur = nx; frames.push({ st: clone(cur), sends });
  }
  for (let s = 0; s < K - 1; s++) {
    const nx = clone(cur), sends = [];
    for (let i = 0; i < K; i++) { const c = ((i + 1 - s) % K + K) % K, j = (i + 1) % K; nx[j][c] = { v: cur[i][c].v, src: cur[i][c].src.slice() }; sends.push({ i, j, c }); }
    cur = nx; frames.push({ st: clone(cur), sends });
  }
  const SUM = [0, 1, 2, 3].map((c) => A.sum(G0.map((r) => r[c])));
  const STEPS = [
    { t: '初始', tex: String.raw`\text{目标：每张卡都得到}\ \ g_0 + g_1 + g_2 + g_3`, say: '4 张卡各自算出一份梯度。朴素的做法是每张卡把整份梯度发给其它每一张卡，卡越多发得越多。环形算法让每张卡只跟下一张卡通信：GPU 0 → 1 → 2 → 3 → 0。' },
    { t: '规约散发 1', tex: String.raw`\text{GPU } i \;\xrightarrow{\ \text{第 } (i-j)\bmod k \text{ 块}\ }\; \text{GPU } i+1\ \ (\text{相加})`, say: '每张卡同时把一块发给下一张卡，对方把它加到自己的那一块上（\\(j\\) 是步数，从 0 开始）。4 条链路同时在用，每张卡这一步只发了 \\(S/4\\)。' },
    { t: '规约散发 2', tex: String.raw`\text{转发刚加好的那一块}`, say: '每张卡转发的是上一步刚加好的那一块，所以部分和一路累积。有的块里已经加了 3 张卡的梯度。' },
    { t: '规约散发 3', tex: String.raw`(k-1)\cdot\frac{S}{k} = \frac{3}{4}\,S`, say: '\\(k-1 = 3\\) 步之后，每张卡各有一块是 4 份梯度的完整总和（深色）。这一半叫<b>规约散发</b>（reduce-scatter）：总和算出来了，但被切成 4 份、分散在 4 张卡上。ZeRO 到这里就可以停下，各卡只更新自己那一份。' },
    { t: '全收集 1', tex: String.raw`\text{GPU } i \;\xrightarrow{\ \text{完整的第 } (i+1-j)\bmod k \text{ 块}\ }\; \text{GPU } i+1\ \ (\text{覆盖})`, say: '后一半叫<b>全收集</b>（all-gather）：把完整的块沿环往下传，收到的卡直接覆盖旧值，不用再加。' },
    { t: '全收集 2', tex: String.raw`\text{每张卡已有 3 块完整总和}`, say: '每一步每张卡仍然只发一块（\\(S/4\\)），4 条链路同时在用，没有哪张卡比别人更忙。' },
    { t: '完成', tex: String.raw`2(k-1)\cdot\frac{S}{k} = \frac{2(k-1)}{k}\,S = 1.5\,S`, say: '又 3 步之后，每张卡都拿到了完整的总和（再除以 4 就是平均梯度）。每张卡一共发出 \\(2(k-1)\\) 块、每块 \\(S/k\\)，合计 \\(1.5S\\)。卡数再多，这个数也不会超过 \\(2S\\)。' },
  ];
  let f = 0;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(f - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(f + 1) }, '下一步 →');
  bar.append(prev, next);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const cv = A.el('canvas', { class: 'cv' });
  bd.append(bar, slider, dots, fx, say, cv);
  const cols = A.series();
  const copt = { aspect: 0.36 };
  const view = A.canvas(cv, copt, (ctx, W, H) => {
    const narrow = W < 560, want = narrow ? 1.0 : 0.36;
    if (copt.aspect !== want) { copt.aspect = want; requestAnimationFrame(() => view.redraw()); return; }
    const F = frames[f];
    // left: ring diagram
    const rw = narrow ? W : Math.min(230, W * 0.34), ringH = narrow ? H * 0.44 : H;
    const cx = rw / 2 + (narrow ? 0 : 6), cy = ringH / 2, R = Math.min(rw / 2 - 30, ringH / 2 - 26);
    const pos = [0, 1, 2, 3].map((i) => { const a = -Math.PI / 2 + i * Math.PI / 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    ctx.save(); ctx.strokeStyle = A.css('--grid'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.restore();
    F.sends.forEach(({ i, j, c }) => {
      const a0 = -Math.PI / 2 + i * Math.PI / 2 + 0.38, a1 = -Math.PI / 2 + (j === 0 ? K : j) * Math.PI / 2 - 0.38;
      const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      A.arrow(ctx, x0, y0, x1, y1, cols[1], 2.2, 9);
      const am = (a0 + a1) / 2, lx = cx + (R + 18) * Math.cos(am), ly = cy + (R + 18) * Math.sin(am);
      A.text(ctx, '块 ' + c, lx, ly, { size: 11.5, align: 'center', color: cols[1], weight: 700 });
    });
    pos.forEach(([x, y], i) => {
      ctx.fillStyle = A.css('--page'); ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill(); ctx.stroke();
      A.text(ctx, 'GPU ' + i, x, y, { size: 11, align: 'center', weight: 700 });
    });
    // right: table of chunks
    const gx = narrow ? 48 : rw + 40, gw = W - gx - 4, cw = gw / K, top = narrow ? ringH + 22 : 26, rh = Math.min(46, (H - top - 6) / K);
    for (let c = 0; c < K; c++) A.text(ctx, '第 ' + c + ' 块', gx + c * cw + cw / 2, top - 12, { size: 11.5, align: 'center', color: A.css('--muted') });
    const recv = new Set(F.sends.map((s) => s.j + ',' + s.c)), sent = new Set(F.sends.map((s) => s.i + ',' + s.c));
    for (let i = 0; i < K; i++) {
      A.text(ctx, 'GPU ' + i, gx - 8, top + i * rh + rh / 2, { size: 11.5, align: 'right', color: A.css('--muted') });
      for (let c = 0; c < K; c++) {
        const cell = F.st[i][c], n = cell.src.length, x = gx + c * cw + 3, y = top + i * rh + 3, w = cw - 6, h = rh - 6;
        ctx.fillStyle = n === K ? cols[0] : A.alpha(cols[0], 0.08 + 0.17 * (n - 1));
        ctx.fillRect(x, y, w, h);
        if (recv.has(i + ',' + c)) { ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }
        else if (sent.has(i + ',' + c)) { ctx.save(); ctx.strokeStyle = cols[1]; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.restore(); }
        const ink = n === K ? '#fff' : A.css('--ink');
        A.text(ctx, String(cell.v), x + w / 2, y + h / 2 - (h > 34 ? 6 : 0), { size: 15, align: 'center', weight: 700, color: ink, mono: true });
        if (h > 34) A.text(ctx, n === K ? '完整总和' : cell.src.slice().sort().map((s) => 'g' + s).join('+'), x + w / 2, y + h / 2 + 11, { size: 10.5, align: 'center', color: n === K ? '#fff' : A.css('--muted') });
      }
    }
  });
  // calculator: per-GPU traffic vs k
  const sep = A.el('p', { class: 'hint', style: { marginTop: '16px' } }, '换成真实规模：环形算法每张卡发出的数据量几乎不随卡数变化，变的是步数（延迟）。下图三条线都按“每张卡单向发出多少”计。');
  bd.append(sep);
  let lgk = Math.log10(1024), S = 13.5, link = 'net';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '参与的卡数 k', min: Math.log10(2), max: Math.log10(16384), step: 0.01, value: lgk, fmt: (v) => A.human(Math.round(Math.pow(10, v)), 1), on: (v) => { lgk = v; calc(); }, width: 190 });
  A.slider(ctl, { label: '要同步的梯度 S', min: 1, max: 800, step: 0.5, value: S, fmt: (v) => v + ' GB', on: (v) => { S = v; calc(); }, width: 170 });
  A.seg(ctl, [{ v: 'nvl', t: '机内 NVLink 450 GB/s' }, { v: 'net', t: '跨机网卡 50 GB/s' }], link, (v) => { link = v; calc(); }, '每卡单向带宽');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv2 = A.el('canvas', { class: 'cv' }); bd.append(cv2);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const SCH = [
    { n: '环形全规约：每卡发出 2(k−1)/k · S', c: 0, f: (k) => 2 * (k - 1) / k },
    { n: '朴素：每卡把整份梯度发给其它每张卡，(k−1) · S', c: 2, f: (k) => k - 1 },
    { n: '参数服务器：中心节点给 k 张卡各发一份新参数，k · S（它还要收进 k 份梯度）', c: 3, f: (k) => k },
  ];
  const kk = () => Math.max(2, Math.round(Math.pow(10, lgk)));
  const view2 = A.canvas(cv2, { aspect: 0.34 }, (ctx, W, H) => {
    const box = { x: 58, y: 26, w: W - 80, h: H - 62 };
    const ax = A.axes(ctx, box, { xmin: 2, xmax: 16384, xlog: true, ymin: 0.5, ymax: 4e4, ylog: true, xticks: [2, 10, 100, 1000, 10000], yticks: [1, 10, 100, 1000, 10000], yfmt: (v) => A.human(v, 0) + ' S', xfmt: (v) => A.human(v, 0), xlabel: '卡数 k（对数）', ylabel: '最忙的那张卡要发出多少（对数）', ylabelOffset: 48 });
    SCH.forEach((s) => {
      ctx.strokeStyle = cols[s.c]; ctx.lineWidth = s.c === 0 ? 3 : 2; ctx.beginPath();
      for (let i = 0; i <= 120; i++) { const k = Math.pow(10, Math.log10(2) + (i / 120) * (Math.log10(16384) - Math.log10(2))); const y = ax.Y(A.clamp(s.f(k), 0.5, 4e4)); i ? ctx.lineTo(ax.X(k), y) : ctx.moveTo(ax.X(k), y); }
      ctx.stroke();
      const k = kk(); ctx.fillStyle = cols[s.c]; ctx.beginPath(); ctx.arc(ax.X(k), ax.Y(A.clamp(s.f(k), 0.5, 4e4)), 4.5, 0, 7); ctx.fill();
    });
  });
  function calc() {
    const k = kk(), bw = link === 'nvl' ? 450 : 50, alpha = 10e-6;
    const vol = 2 * (k - 1) / k * S, tb = vol / bw, tl = 2 * (k - 1) * alpha;
    stats.innerHTML = '';
    [['环形：每卡发出', vol.toFixed(1) + ' GB'], ['带宽项 2(k−1)/k · S/BW', (tb * 1000).toFixed(0) + ' ms'], ['延迟项 2(k−1) 步 × 10 μs（示意）', (tl * 1000).toFixed(tl < 0.01 ? 2 : 0) + ' ms'], ['朴素做法：每卡要发', A.bytes((k - 1) * S * 1e9)]]
      .forEach(([a, b]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, a), A.el('div', { class: 'v', style: { fontSize: '17px' } }, b))));
    legend.innerHTML = SCH.map((s) => `<span><i class="line" style="background:${cols[s.c]}"></i>${s.n}</span>`).join('');
    view2.redraw();
  }
  function go(i) { f = A.clamp(i, 0, STEPS.length - 1); slider.value = f; render(); }
  function render() {
    const s = STEPS[f];
    prev.disabled = f === 0; next.disabled = f === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === f); d.classList.toggle('done', i < f); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    const sentSoFar = f; // each step every GPU sends one chunk
    let extra = f ? `　每张卡累计已发送 ${sentSoFar} 块 = ${sentSoFar}/4 S。` : '';
    if (f === STEPS.length - 1) extra += `　结果：(${SUM.join(', ')})。`;
    say.innerHTML = `<b>第 ${f + 1} 步 · ${s.t}。</b>${s.say}${extra}`;
    A.renderMath(say);
    view.redraw();
  }
  render(); calc();
});
