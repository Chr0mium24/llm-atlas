/* online-softmax — interactive demo (moved from ch08-long-context.html) */
A.defineDemo('online-softmax', function (mount) {
  const { bd } = A.demo(mount, '在线 softmax：分块扫描，结果和一次性算完全一致', '一个 query，16 个 key，块大小 4');
  const r = A.rng(9);
  const n = 16, Bk = 4;
  let s = [], v = [], step = 0, st;
  const ctl = A.el('div', { class: 'flex', style: { marginBottom: '10px' } }); bd.append(ctl);
  ctl.append(A.el('button', { class: 'primary', onclick: () => { if (step < n / Bk) { step++; render(); } } }, '处理下一块'), A.el('button', { onclick: () => { step = 0; render(); } }, '从头开始'), A.el('button', { onclick: () => { gen(); step = 0; render(); } }, '换一组随机数'));
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const out = A.el('div', { class: 'stats' }); bd.append(out);
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const nS = A.slider(ctl2, { label: '序列长度 n（算显存）', min: 1024, max: 1048576, log: true, value: 131072, fmt: (x) => A.human(Math.round(x), 0), on: () => render(), width: 260 });
  const mem = A.el('p', { class: 'small' }); bd.append(mem);
  function gen() { s = Array.from({ length: n }, () => A.gauss(r) * 2); v = Array.from({ length: n }, () => A.gauss(r)); }
  function compute() {
    st = { m: -Infinity, l: 0, o: 0, hist: [] };
    for (let b = 0; b < step; b++) {
      const blk = s.slice(b * Bk, b * Bk + Bk);
      const mNew = Math.max(st.m, ...blk);
      const corr = Math.exp(st.m - mNew);
      let lb = 0, ob = 0;
      blk.forEach((x, j) => { const e = Math.exp(x - mNew); lb += e; ob += e * v[b * Bk + j]; });
      st.l = st.l * corr + lb; st.o = st.o * corr + ob; st.hist.push({ m: mNew, corr }); st.m = mNew;
    }
  }
  const view = A.canvas(cv, { aspect: 0.3 }, (ctx, W, H) => {
    const cols = A.series(), cw = (W - 20) / n;
    const mxs = Math.max(...s.map(Math.abs));
    A.text(ctx, '分数 sⱼ = q·kⱼ（柱）　value vⱼ（下方数字）', 10, 10, { size: 12, color: A.css('--muted') });
    const base = H * 0.62;
    for (let j = 0; j < n; j++) {
      const blk = Math.floor(j / Bk), done = blk < step, cur = blk === step - 1;
      const x = 10 + j * cw, h = (s[j] / mxs) * (H * 0.3);
      ctx.fillStyle = done ? (cur ? cols[1] : cols[0]) : A.css('--grid');
      if (h >= 0) ctx.fillRect(x + 2, base - h, cw - 4, h); else ctx.fillRect(x + 2, base, cw - 4, -h);
      A.text(ctx, v[j].toFixed(1), x + cw / 2, H - 12, { size: 11, align: 'center', mono: true, color: done ? A.css('--ink') : A.css('--muted') });
    }
    ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(10, base + 0.5); ctx.lineTo(W - 10, base + 0.5); ctx.stroke();
    for (let b = 1; b < n / Bk; b++) { const x = 10 + b * Bk * cw; ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, H - 4); ctx.stroke(); ctx.setLineDash([]); }
  });
  function render() {
    compute(); view.redraw();
    const p = A.softmax(s); const exact = A.sum(p.map((x, i) => x * v[i]));
    out.innerHTML = '';
    const cur = step ? st.o / st.l : NaN;
    [['已处理块', step + ' / ' + n / Bk], ['当前最大值 m', step ? st.m.toFixed(3) : '−∞'], ['本步修正系数 e^(m旧−m新)', step ? st.hist[step - 1].corr.toFixed(4) : '—'], ['在线结果 o / l', step ? cur.toFixed(6) : '—'], ['一次性 softmax·v', exact.toFixed(6)]]
      .forEach(([k, val], i) => out.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px', color: i === 3 && step === n / Bk ? 'var(--good-ink)' : '' } }, val))));
    const N = Math.round(nS.value);
    mem.innerHTML = `n = ${A.human(N, 0)} 时，朴素实现每个头要在显存里存 n×n 的分数矩阵：<b>${A.bytes(N * N * 2)}</b>（BF16）；64 个头就是 ${A.bytes(N * N * 2 * 64)}。FlashAttention 只需要 O(n) 的统计量（每行的 m 和 l）：<b>${A.bytes(N * 8)}</b>。`;
  }
  gen(); render();
});
