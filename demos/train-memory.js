/* train-memory — 4D parallel configurator (toy model): per-GPU parameter memory, pipeline bubble, exposed TP / DP communication and the resulting MFU for a fixed 16M-token global batch */
A.defineDemo('train-memory', function (mount) {
  const { bd } = A.demo(mount, '把一个模型切到几千张卡上：每个旋钮各付什么代价', '玩具模型：全局批固定为 16M token（序列 8K），H100 BF16；单卡算子效率按 55%，其余损失按本章公式计算');
  const MODELS = {
    '70B': { N: 70e9, L: 80, d: 8192, t: '70B（d = 8192）' },
    '405B': { N: 405e9, L: 126, d: 16384, t: '405B（d = 16384）' },
  };
  const F = 989e12, U0 = 0.55, NVL = 450e9, NET = 50e9, CAP = 80e9, SEQ = 8192, GB = 16 * 1024 * 1024, NSEQ = GB / SEQ, D = 15.6e12;
  let mk = '405B', G = 16384, tp = 8, pp = 16, v = 4, zero = 2;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, Object.keys(MODELS).map((m) => ({ v: m, t: m })), mk, (x) => { mk = x; draw(); }, '模型');
  A.seg(ctl, [2048, 4096, 8192, 16384, 32768].map((g) => ({ v: g, t: String(g) })), G, (x) => { G = x; draw(); }, 'GPU 数');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.seg(ctl2, [1, 2, 4, 8, 16].map((x) => ({ v: x, t: String(x) })), tp, (x) => { tp = x; draw(); }, '张量并行 t（8 以内走 NVLink）');
  A.seg(ctl2, [1, 2, 4, 8, 16, 32].map((x) => ({ v: x, t: String(x) })), pp, (x) => { pp = x; draw(); }, '流水线 p');
  A.seg(ctl2, [1, 2, 4, 8].map((x) => ({ v: x, t: String(x) })), v, (x) => { v = x; draw(); }, '交错段数 v');
  A.seg(ctl2, [{ v: 1, t: 'ZeRO-1' }, { v: 2, t: 'ZeRO-2' }, { v: 3, t: 'ZeRO-3' }], zero, (x) => { zero = x; draw(); }, '数据并行那一维');
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  let R;
  function model() {
    const M = MODELS[mk], N = M.N, dp = G / (tp * pp);
    const bad = dp < 1 ? '卡数不够：张量 × 流水线 = ' + tp * pp + '，比 GPU 数还多' : NSEQ / dp < 1 ? '全局批只有 ' + NSEQ + ' 条序列，分不到 ' + dp + ' 个数据并行组，每组至少要一条' : '';
    const sh = N / (tp * pp);
    const w = 2 * sh / (zero >= 3 ? dp : 1), g = 2 * sh / (zero >= 2 ? dp : 1), op = 12 * sh / dp;
    const m = NSEQ / dp; // micro-batches per pipeline, one sequence each
    const ideal = 6 * N * GB / (G * F); // seconds per step at 100% of peak
    const comp = ideal / U0;
    const bub = pp > 1 ? (pp - 1) / (v * m) : 0; // bubble / useful (Llama 3 report's form)
    const tBub = comp * bub;
    const bwT = tp <= 8 ? NVL : NET;
    const rTP = tp > 1 ? (2 / 9) * (tp - 1) / M.d * F / bwT : 0; // comm / compute-at-peak
    const tTP = ideal * rTP;
    const dpBytes = (zero >= 3 ? 3 : 2) * 2 * sh * (dp - 1) / dp;
    const tDPraw = dpBytes / NET, tDP = Math.max(0, tDPraw - comp); // overlapped with compute
    const tot = comp + tBub + tTP + tDP;
    const mfu = ideal / tot;
    return { M, N, dp, bad, w, g, op, m, ideal, comp, tBub, tTP, tDP, tDPraw, tot, mfu, rTP, bwT, days: 6 * N * D / (G * F * mfu) / 86400 };
  }
  const copt = { aspect: 0.17 };
  const view = A.canvas(cv, copt, (ctx, W, H) => {
    const want = W < 560 ? 0.4 : 0.17;
    if (copt.aspect !== want) { copt.aspect = want; requestAnimationFrame(() => view.redraw()); return; }
    if (R.bad) { A.text(ctx, R.bad, 10, H / 2, { size: 13, weight: 600, color: A.css('--bad') }); return; }
    const x0 = 84, bw = W - x0 - 14, rowH = Math.min(34, (H - 70) / 2);
    // row 1: memory per GPU
    const mem = R.w + R.g + R.op, mx = Math.max(CAP * 1.25, mem);
    const y1 = 22;
    A.text(ctx, '每卡显存', x0 - 8, y1 + rowH / 2, { size: 12, align: 'right', weight: 600 });
    let x = x0;
    [[R.w, '权重', 0], [R.g, '梯度', 1], [R.op, '优化器', 2]].forEach(([b, n, c]) => {
      const wd = (b / mx) * bw; ctx.fillStyle = cols[c]; ctx.fillRect(x, y1, Math.max(0, wd - 1), rowH);
      const lb = n + ' ' + A.bytes(b); ctx.font = '600 11px ' + A.css('--sans'); if (ctx.measureText(lb).width + 10 < wd) A.text(ctx, lb, x + 5, y1 + rowH / 2, { size: 11, color: '#fff', weight: 600 });
      x += wd;
    });
    const xc = x0 + (CAP / mx) * bw;
    ctx.save(); ctx.strokeStyle = A.css('--s8'); ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(xc, y1 - 8); ctx.lineTo(xc, y1 + rowH + 4); ctx.stroke(); ctx.restore();
    A.text(ctx, '80 GB', xc + 4, y1 - 10, { size: 11, color: A.css('--s8') });
    A.text(ctx, A.bytes(mem) + '（激活另计）', Math.min(x + 6, W - 120), y1 + rowH + 12, { size: 11.5, weight: 600, color: mem > CAP ? A.css('--bad') : A.css('--ink-2') });
    // row 2: step time ledger
    const y2 = y1 + rowH + 30, tx = R.tot;
    A.text(ctx, '一步的时间', x0 - 8, y2 + rowH / 2, { size: 12, align: 'right', weight: 600 });
    x = x0;
    [[R.ideal, '6N 本身', 0], [R.comp - R.ideal, '算子跑不满', 5], [R.tBub, '气泡', 1], [R.tTP, '张量并行通信', 3], [R.tDP, '没藏住的数据并行通信', 2]].forEach(([t, n, c]) => {
      const wd = (t / tx) * bw; if (wd <= 0) return; ctx.fillStyle = cols[c % cols.length]; ctx.fillRect(x, y2, Math.max(0, wd - 1), rowH);
      const lb = n + ' ' + A.pct(t / tx, 0); ctx.font = '600 11px ' + A.css('--sans'); if (ctx.measureText(lb).width + 10 < wd) A.text(ctx, lb, x + 5, y2 + rowH / 2, { size: 11, color: '#fff', weight: 600 }); else if (ctx.measureText(A.pct(t / tx, 0)).width + 8 < wd) A.text(ctx, A.pct(t / tx, 0), x + 4, y2 + rowH / 2, { size: 11, color: '#fff', weight: 600 });
      x += wd;
    });
  });
  cv.addEventListener('mousemove', (e) => {
    if (!R || R.bad) return;
    A.tip.show(`一步约 <b>${R.tot.toFixed(2)} 秒</b><br>6N 本身（按峰值）${R.ideal.toFixed(2)} s<br>算子跑不满（55% 效率）${(R.comp - R.ideal).toFixed(2)} s<br>流水线气泡 ${R.tBub.toFixed(2)} s<br>张量并行通信 ${R.tTP.toFixed(2)} s<br>数据并行通信 ${R.tDPraw.toFixed(2)} s，其中没藏住 ${R.tDP.toFixed(2)} s`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    R = model();
    stats.innerHTML = '';
    const rows = R.bad ? [['数据并行组数 DP', R.dp < 1 ? '—' : String(R.dp)]] : [
      ['数据并行组数 DP', String(R.dp)],
      ['每组的微批次数 m', String(R.m)],
      ['气泡 ÷ 有用时间 (p−1)/(vm)', A.pct(R.tBub / R.comp, 1)],
      ['张量并行 通信 ÷ 计算', R.rTP.toFixed(2) + (R.bwT === NET && tp > 1 ? '（跨机）' : '')],
      ['MFU（玩具估计）', A.pct(R.mfu, 0)],
      ['训练 15.6T token 要', R.days.toFixed(0) + ' 天'],
    ];
    rows.forEach(([k, val]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, val))));
    let msg = '';
    const mem = R.w + R.g + R.op;
    if (R.bad) msg = R.bad + '。';
    else if (mem > CAP) msg = `与参数成正比的部分每卡就有 ${A.bytes(mem)}，放不下。张量并行和流水线并行把模型分到 t × p 张卡上；ZeRO-3 再在数据并行组之间切权重。`;
    else if (tp > 8) msg = '张量并行切到 16 份就出了一台服务器，全规约改走 50 GB/s 的网卡，通信比计算还长。这就是它被限制在 NVLink 域里的原因。';
    else if (R.tDP > 0.05 * R.tot) msg = `数据并行这一维每步要发 ${A.bytes((zero >= 3 ? 3 : 2) * 2 * R.N / (tp * pp))} 量级的数据，比计算还久，藏不住。每个数据并行组分到的 token（${A.human(R.m * SEQ, 0)}）太少：把张量 × 流水线调大，让更多卡合算一份模型。`;
    else if (R.tBub > 0.3 * R.comp) msg = `气泡偏大：卡数一多，每个数据并行组分到的序列（m = ${R.m}）就少，(p − 1)/(vm) 变大。可以减小 p、加大交错段数 v，或者加大全局批（这里固定）。`;
    else msg = '这一组配置下，最大的一块损失是算子本身跑不满峰值；其次是气泡和张量并行通信。试着把 GPU 数在 8192 和 16384 之间切换：全局批不变，卡数翻倍时每组的 m 减半，气泡变大，MFU 下降。';
    legend.innerHTML = [[0, '6N 本身（按峰值算力）'], [5, '算子跑不满峰值'], [1, '流水线气泡'], [3, '张量并行通信'], [2, '没藏住的数据并行通信']].map(([c, n]) => `<span><i style="background:${cols[c]}"></i>${n}</span>`).join('') + '<span>上一行：每卡与参数成正比的显存（蓝 权重、橙 梯度、绿 优化器）</span>';
    hint.innerHTML = msg;
    view.redraw();
  }
  draw();
});
