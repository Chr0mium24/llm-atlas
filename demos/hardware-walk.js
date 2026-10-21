/* hardware-walk — one matmul Y = X·W (W 8192×8192 BF16) on an H100, step by step: tiles → waves → TMA → pipeline → tensor cores → accumulator → feed rate → epilogue → total */
A.defineDemo('hardware-walk', function (mount) {
  const { bd } = A.demo(mount, '跟着一次矩阵乘法走进 H100', 'Y = X·W，W 为 8192×8192 的 BF16 权重；按公开规格估算（132 个 SM、1.83 GHz、3.35 TB/s），块大小 128×128、每步 64');
  const NSM = 132, F = 1.83e9, OPS = 4096, BW = 3.35e12, P = NSM * OPS * F, D = 8192, TB = 128, KS = 64;
  let m = 4096, k = 0, timer = null;
  const fmtB = (b) => (b < 1048576 ? (b < 1024 ? b + ' B' : +(b / 1024).toFixed(b % 1024 ? 1 : 0) + ' KB') : A.bytes(b, b >= 1e9 ? 2 : 1));
  const fmtT = (s) => (s >= 1e-3 ? (s * 1e3).toFixed(2) + ' ms' : s >= 1e-6 ? (s * 1e6).toFixed(s >= 1e-5 ? 0 : 2) + ' µs' : (s * 1e9).toFixed(0) + ' ns');
  const tx = (s) => (s.endsWith(' µs') ? '\\text{' + s.slice(0, -3) + '}\\,\\mu\\text{s}' : '\\text{' + s + '}');
  const sciTex = (x) => { const e = Math.floor(Math.log10(x)); return (x / Math.pow(10, e)).toFixed(1) + '\\times 10^{' + e + '}'; };
  function numbers() {
    const rows = Math.min(m, TB), tM = Math.ceil(m / TB), tN = D / TB, tiles = tM * tN;
    const waves = Math.ceil(tiles / NSM), last = tiles - (waves - 1) * NSM, eff = tiles / (waves * NSM);
    const stepX = rows * KS * 2, stepW = KS * TB * 2, stepB = stepX + stepW, mac = rows * TB * KS, clk = (2 * mac) / OPS, Iblk = (2 * mac) / stepB;
    const steps = D / KS, acc = rows * TB * 4, out = rows * TB * 2;
    const flops = 2 * m * D * D, hbm = D * D * 2 + 2 * m * D * 2, l2 = tiles * steps * stepB;
    const need = (OPS / Iblk) * NSM * F;
    const perSMclk = BW / Math.min(tiles, NSM) / F, stepClkMem = stepB / perSMclk;
    const tc = flops / P, tm = hbm / BW;
    return { rows, tM, tN, tiles, waves, last, eff, stepX, stepW, stepB, mac, clk, Iblk, steps, acc, out, flops, hbm, l2, need, perSMclk, stepClkMem, tc, tm };
  }
  // hl: which parts of the diagram light up in each frame
  const FR = [
    { t: '任务', hl: ['hbm'], f: (c) => ({ tex: String.raw`Y = XW,\quad X\in\mathbb R^{${m}\times 8192},\ W\in\mathbb R^{8192\times 8192}`,
      say: `W 有 134 MB（BF16），X 和 Y 各 ${fmtB(m * D * 2)}。计算量 \\(2\\times ${m}\\times 8192^2 \\approx ${A.sci(c.flops)}\\) 次运算，至少读写 ${fmtB(c.hbm)}。整块 H100 的片上存储约 120 MB，连 W 都放不下：数据只能一块一块搬进来。` }) },
    { t: '切块', hl: ['grid'], f: (c) => ({ tex: String.raw`\text{块数} = \Big\lceil \tfrac{${m}}{128}\Big\rceil \times \tfrac{8192}{128} = ${c.tM}\times ${c.tN} = ${c.tiles}`,
      say: m > 1 ? '把输出 Y 切成 128×128 的块，每个线程块负责一块。右边的网格就是 Y 的全部块。' : '解码时 Y 只有 1 行：切出来只有 64 块，而且每块只有 1 行是有用的（128 行里填了 1 行）。' }) },
    { t: '分波', hl: ['grid', 'waves'], f: (c) => ({ tex: String.raw`\Big\lceil \tfrac{${c.tiles}}{132}\Big\rceil = ${c.waves}\ \text{波},\qquad \text{效率} = \frac{${c.tiles}}{${c.waves}\times 132} = ${A.pct(c.eff, 1).replace('%', '\\%')}`,
      say: m > 1 ? `132 个 SM 每次各算一块，要 ${c.waves} 波；最后一波只有 ${c.last} 块，其余 SM 空着。这就是<b>波次量化</b>，这里损失 ${A.pct(1 - c.eff, 0)}。颜色越强（浅色主题下越深、深色主题下越亮）的块越晚算。` : `只有 ${c.tiles} 块，一波就算完，但 132 个 SM 里有 ${NSM - c.tiles} 个没活干。实际的解码内核会沿内积方向再切（split-K），让所有 SM 都参与读 W。` }) },
    { t: 'TMA 搬运', hl: ['hbm', 'l2', 'smem', 'a-tma'], f: (c) => ({ tex: String.raw`\underbrace{${c.rows}\times 64\times 2}_{X\ \text{的小块}} + \underbrace{64\times 128\times 2}_{W\ \text{的小块}} = ${tx(fmtB(c.stepB))}`,
      say: `沿内积方向（长 8192）分成 128 步、每步 64。每一步，TMA 把 X 的 ${c.rows}×64 和 W 的 64×128 两个小块从显存经 L2 搬进共享内存。一个线程发一条指令就能搬一整块。` }) },
    { t: '流水线', hl: ['smem', 'a-tma'], f: (c) => ({ tex: String.raw`4 \times ${tx(fmtB(c.stepB))} = ${tx(fmtB(4 * c.stepB))}\ \le\ 228\ \text{KB}`,
      say: '共享内存同时放 4 份小块：张量核心在算第 s 步，TMA 已经在搬第 s+1、s+2、s+3 步。搬和算重叠起来，只要搬得够快，张量核心就不用等。' }) },
    { t: '张量核心', hl: ['smem', 'tc', 'a-tc'], f: (c) => ({ tex: String.raw`${c.rows}\times 128\times 64 = ${c.mac.toLocaleString('en-US').replace(/,/g, '{,}')}\ \text{次乘加},\qquad \frac{2\times ${c.mac}}{4096} = ${c.clk}\ \text{周期}`,
      say: m > 1 ? '4 个张量核心直接从共享内存读这两个小块，做约 105 万次乘加。BF16 下每个 SM 每周期 4096 次运算，一步要 512 个周期。' : '有用的乘加只有 8192 次，4 个周期就够了。可是这一步要搬的 16 KB 一点没少。' }) },
    { t: '累加器', hl: ['tc', 'reg', 'a-acc'], f: (c) => ({ tex: String.raw`${c.rows}\times 128 \times 4\ \text{B} = ${tx(fmtB(c.acc))}\ \ (\text{FP32，留在寄存器里})`,
      say: '每一步的乘积都加到同一个 FP32 累加器上。它一直留在寄存器里（256 KB 的寄存器堆里占 ' + A.pct(c.acc / 262144, 0) + '），128 步都不离开芯片：这正是分块复用的来源。' }) },
    { t: '喂得够吗', hl: ['hbm', 'l2', 'a-tma', 'a-hbm'], f: (c) => m > 1
      ? ({ tex: String.raw`\frac{4096}{I_{\text{块}} = ${c.Iblk.toFixed(0)}}\times 132\times 1.83\,\text{GHz} = ${(c.need / 1e12).toFixed(1)}\ \text{TB/s}\ \gg\ 3.35\ \text{TB/s}`,
          say: `块级强度 64 FLOPs/字节：要让张量核心满负荷，全芯片每秒得送进 ${(c.need / 1e12).toFixed(1)} TB，是 HBM 的 ${(c.need / BW).toFixed(1)} 倍。若每一步都从显存取，一步要约 ${c.stepClkMem.toFixed(0)} 个周期，张量核心只有 ${A.pct(c.clk / c.stepClkMem, 0)} 的时间在算。同时在算同一行块的 SM 读的是同一段 X，大部分读取可以命中 L2（合计要从 L2 读 ${fmtB(c.l2)}）；可 L2 的带宽也只有 HBM 的 2–3 倍，喂不起 ${(c.need / 1e12).toFixed(1)} TB/s。所以实际的 Hopper 内核用 128×256 的块（强度约 85，需要约 11.6 TB/s），再让簇里两个 SM 共享一次读入（强度 128，约 7.7 TB/s），才落到 L2 能供应的量级。` })
      : ({ tex: String.raw`\frac{3.35\ \text{TB/s}}{64\ \text{个 SM}} \approx ${c.perSMclk.toFixed(1)}\ \text{B/周期}\ \Rightarrow\ \frac{${c.stepB}\ \text{B}}{${c.perSMclk.toFixed(1)}} \approx ${c.stepClkMem.toFixed(0)}\ \text{周期/步}`,
          say: `W 的每个字节只用一次，L2 帮不上忙，只能从 HBM 读。HBM 带宽分给 64 个 SM，每步要等约 ${c.stepClkMem.toFixed(0)} 个周期，而有用的计算只要 ${c.clk} 个周期：张量核心 ${A.pct(c.clk / c.stepClkMem, 1)} 的时间在算，其余都在等数据。` }) },
    { t: '收尾', hl: ['reg', 'a-out', 'hbm'], f: (c) => ({ tex: String.raw`${c.rows}\times 128\times 2\ \text{B} = ${tx(fmtB(c.out))}\ \to\ \text{HBM}`,
      say: '128 步之后，累加器转成 BF16 写回显存。加偏置、激活函数这类逐元素操作可以在这里顺手做掉（算子融合），不必再读写一遍 Y。' }) },
    { t: '算完', hl: ['all'], f: (c) => ({ tex: String.raw`t \approx \max\Big(\frac{${sciTex(c.flops)}\ \text{FLOPs}}{989\ \text{TFLOPS}},\ \frac{${tx(fmtB(c.hbm))}}{3.35\ \text{TB/s}}\Big) = \max(${tx(fmtT(c.tc))},\ ${tx(fmtT(c.tm))})`,
      say: c.tc > c.tm ? `<b>计算受限。</b>峰值下要 ${fmtT(c.tc)}，搬最少的数据只要 ${fmtT(c.tm)}；实际的内核能到峰值的 70–80%，约 ${fmtT(c.tc / 0.75)}。` : `<b>访存受限。</b>读一遍 W 要 ${fmtT(c.tm)}，计算只要 ${fmtT(c.tc)}，算力用了 ${A.pct(c.tc / c.tm, 1)}。要让这次读取更值，只能一次服务更多 token：拼批（推理系统一章）。` }) },
  ];

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 4096, t: 'm = 4096（预填充）' }, { v: 1, t: 'm = 1（解码）' }], m, (v) => { m = v; render(); }, '一次喂进来的 token 数 m');
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  const play = A.el('button', { onclick: () => { if (timer) { stop(); return; } if (k >= FR.length - 1) go(0); timer = setInterval(() => (k < FR.length - 1 ? go(k + 1) : stop()), 2200); play.textContent = '暂停'; } }, '自动播放');
  const stop = () => { if (timer) clearInterval(timer); timer = null; play.textContent = '自动播放'; };
  bar.append(prev, next, play);
  const slider = A.el('input', { type: 'range', min: 0, max: FR.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => { stop(); go(+slider.value); };
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = FR.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => { stop(); go(i); } }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const stats = A.el('div', { class: 'stats' });
  const cv = A.el('canvas', { class: 'cv' });
  bd.append(bar, slider, dots, fx, say, cv, stats);
  const cols = A.series();

  const view = A.canvas(cv, { aspect: 0.36 }, (ctx, Wd, Hd) => {
    const c = numbers(), hl = FR[k].hl, on = (x) => hl.includes(x) || hl.includes('all');
    const ink = A.css('--ink'), muted = A.css('--muted'), acc = cols[3];
    const box = (x, y, w, h, key, title, sub) => {
      ctx.fillStyle = on(key) ? A.alpha(acc, 0.13) : A.alpha(ink, 0.035);
      ctx.strokeStyle = on(key) ? acc : A.css('--grid'); ctx.lineWidth = on(key) ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.stroke();
      A.text(ctx, title, x + 8, y + 13, { size: 12, weight: 650 });
      if (sub) A.text(ctx, sub, x + 8, y + 28, { size: 10.5, color: muted });
    };
    const arrow = (x0, y0, x1, y1, key) => A.arrow(ctx, x0, y0, x1, y1, on(key) ? acc : A.alpha(ink, 0.25), on(key) ? 2.4 : 1.4, 7);
    const label = (s, x, y, key, align) => A.text(ctx, s, x, y, { size: 10.5, align: align || 'center', color: on(key) ? acc : muted, weight: on(key) ? 600 : 400 });
    const L = Wd * 0.64, top = 6, H = Hd - 12;
    // HBM with X and W
    const hx = 4, hw = L * 0.26;
    box(hx, top, hw, H, 'hbm', 'HBM 80 GB', '3.35 TB/s');
    const s = Math.min(hw - 30, (H - 52) * 0.62), wx = hx + 10, wy = top + 40;
    const xh = m > 1 ? s / 2 : 3;
    ctx.fillStyle = A.alpha(cols[0], 0.18); ctx.fillRect(wx, wy, s, xh);
    A.text(ctx, 'X', wx + s + 4, wy + Math.max(xh / 2, 4), { size: 10.5, color: cols[0], weight: 600 });
    const wy2 = wy + xh + 6;
    ctx.fillStyle = A.alpha(cols[1], 0.18); ctx.fillRect(wx, wy2, s, s);
    A.text(ctx, 'W', wx + s + 4, wy2 + s / 2, { size: 10.5, color: cols[1], weight: 600 });
    if (k >= 3) { // the current tile's strips (tile 0): 128 rows of X, 128 columns of W
      ctx.fillStyle = A.alpha(cols[0], 0.6); ctx.fillRect(wx, wy, s, Math.max(2, xh * Math.min(1, TB / m)));
      ctx.fillStyle = A.alpha(cols[1], 0.6); ctx.fillRect(wx, wy2, Math.max(2, s * TB / D), s);
    }
    // L2
    const lx = hx + hw + L * 0.06, lw = L * 0.13, ly = top + H * 0.3, lh = H * 0.42;
    box(lx, ly, lw, lh, 'l2', 'L2', '50 MB');
    // SM
    const sx = lx + lw + L * 0.07, sw = L - sx;
    box(sx, top, sw, H, 'sm', 'SM（132 个之一）', '');
    const smy = top + 30, slotW = (sw - 16) / 4;
    A.text(ctx, '共享内存：4 份小块轮流用', sx + 8, smy + 2, { size: 10.5, color: on('smem') ? acc : muted });
    for (let q = 0; q < 4; q++) {
      const qx = sx + 8 + q * slotW, qy = smy + 10;
      ctx.fillStyle = on('smem') ? A.alpha(q === 0 ? acc : cols[0], q === 0 ? 0.45 : 0.18) : A.alpha(ink, 0.06);
      ctx.fillRect(qx + 1, qy, slotW - 4, 20);
      A.text(ctx, q === 0 ? '算 s' : '搬 s+' + q, qx + slotW / 2 - 1, qy + 10, { size: 10, align: 'center', color: ink });
    }
    const tcy = smy + 50, tcs = Math.min(24, (sw - 40) / 4 - 6);
    A.text(ctx, '4 个张量核心', sx + 8, tcy, { size: 10.5, color: on('tc') ? acc : muted });
    for (let q = 0; q < 4; q++) {
      ctx.fillStyle = on('tc') ? A.alpha(cols[2], 0.6) : A.alpha(ink, 0.1);
      ctx.beginPath(); ctx.roundRect(sx + 8 + q * (tcs + 8), tcy + 8, tcs, tcs, 4); ctx.fill();
    }
    const ry = tcy + tcs + 30, rhMax = Math.max(12, top + H - 34 - (ry + 8));
    A.text(ctx, '寄存器里的累加器：' + (m > 1 ? '128×128 FP32' : '1×128 FP32'), sx + 8, ry, { size: 10.5, color: on('reg') ? acc : muted });
    const rw = Math.min(sw - 16, rhMax * 1.6), rh = m > 1 ? Math.min(rhMax, rw) : 4;
    ctx.fillStyle = on('reg') ? A.alpha(cols[1], 0.4) : A.alpha(ink, 0.08);
    ctx.fillRect(sx + 8, ry + 8, rw, rh);
    // arrows and labels
    const midL2 = ly + lh / 2;
    arrow(hx + hw + 2, midL2, lx - 2, midL2, 'a-hbm');
    arrow(lx + lw + 2, ly + 14, sx + 6, smy + 20, 'a-tma');
    label('TMA ' + fmtB(c.stepB) + '/步', lx + lw / 2, ly - 10, 'a-tma');
    arrow(sx + sw * 0.55, smy + 32, sx + sw * 0.55, tcy + 6, 'a-tc');
    arrow(sx + 8 + 2 * (tcs + 8) - 4, tcy + tcs + 10, sx + 8 + 2 * (tcs + 8) - 4, ry - 8, 'a-acc');
    const oy = top + H - 16;
    arrow(sx + 4, oy, hx + hw + 2, oy, 'a-out');
    label('收尾：写回 ' + fmtB(c.out), (hx + hw + sx) / 2, oy - 9, 'a-out');
    // Y tile map
    const gx = L + Wd * 0.03, gw = Wd - gx - 4;
    A.text(ctx, '输出 Y 的 ' + c.tiles + ' 块' + (k >= 2 ? '（颜色越强越晚算）' : ''), gx, top + 6, { size: 11, color: on('grid') ? acc : muted, weight: on('grid') ? 600 : 400 });
    const cw = gw / c.tN, ch = Math.min(cw * 1.6, (H - 30) / Math.max(c.tM, 1));
    for (let i = 0; i < c.tM; i++) for (let j = 0; j < c.tN; j++) {
      const idx = i * c.tN + j, wv = Math.floor(idx / NSM);
      ctx.fillStyle = k >= 2 ? A.seq(0.15 + 0.85 * (c.waves > 1 ? wv / (c.waves - 1) : 0.5)) : on('grid') ? A.alpha(acc, 0.35) : A.alpha(ink, 0.08);
      ctx.fillRect(gx + j * cw, top + 18 + i * ch, Math.max(cw - (cw > 3 ? 0.6 : 0), 0.6), Math.max(ch - (ch > 3 ? 0.6 : 0), 0.6));
    }
    if (k >= 3) { ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.strokeRect(gx - 1, top + 17, Math.max(cw, 3) + 2, Math.max(ch, 3) + 2); A.text(ctx, '← 正在跟踪的这一块', gx + Math.max(cw, 3) + 6, top + 18 + Math.max(ch, 3) / 2 + (m > 1 ? 0 : 12), { size: 10.5, color: acc }); }
    if (m === 1 && k >= 2) A.text(ctx, '只有 64 块：' + (NSM - 64) + ' 个 SM 空闲', gx, top + 18 + ch + 28, { size: 10.5, color: A.css('--bad') });
  });

  function render() {
    const c = numbers(), fr = FR[k].f(c);
    prev.disabled = k === 0; next.disabled = k === FR.length - 1; slider.value = k;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(fr.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = fr.tex;
    say.innerHTML = `<b>第 ${k + 1} 步 · ${FR[k].t}。</b>${fr.say}`; A.renderMath(say);
    stats.innerHTML = '';
    [['计算量', A.sci(c.flops) + ' FLOPs'], ['最少读写', fmtB(c.hbm)], ['峰值下的计算时间', fmtT(c.tc)], ['搬最少数据的时间', fmtT(c.tm)], ['瓶颈', c.tc > c.tm ? '计算受限' : '访存受限']]
      .forEach(([kk, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '16px', color: i === 4 ? (c.tc > c.tm ? 'var(--good-ink)' : 'var(--bad)') : '' } }, v))));
    view.redraw();
  }
  function go(i) { k = A.clamp(i, 0, FR.length - 1); render(); }
  go(0);
});
