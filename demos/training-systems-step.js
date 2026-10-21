/* training-systems-step — memory over time during one training step (forward → backward → optimizer) on one GPU: static 16 bytes/param vs activations, recomputation and ZeRO-3 sharding */
A.defineDemo('training-systems-step', function (mount) {
  const { bd } = A.demo(mount, '一个训练步里，显存怎么涨落', '形状参照 Llama；激活按 Korthikanti 等（2022）估算，不含临时与通信缓冲');
  const MODELS = {
    '1B': { N: 1.24e9, L: 16, d: 2048, a: 32, t: '1B（16 层，d = 2048）' },
    '7B': { N: 6.74e9, L: 32, d: 4096, a: 32, t: '7B（32 层，d = 4096）' },
    '70B': { N: 70e9, L: 80, d: 8192, a: 64, t: '70B（80 层，d = 8192）' },
  };
  let mk = '7B', lgN = 12, B = 1, mode = 'flash', k = 1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, Object.keys(MODELS).map((m) => ({ v: m, t: m })), mk, (v) => { mk = v; draw(); }, '模型');
  A.slider(ctl, { label: '序列长度 n', min: 10, max: 15, step: 1, value: lgN, fmt: (v) => Math.pow(2, v - 10) + 'K token', on: (v) => { lgN = v; draw(); }, width: 170 });
  A.slider(ctl, { label: '微批次 B（每次同时算几条序列）', min: 1, max: 8, step: 1, value: B, fmt: (v) => v + ' 条', on: (v) => { B = v; draw(); }, width: 200 });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.seg(ctl2, [{ v: 'none', t: '朴素注意力，不重算' }, { v: 'flash', t: 'FlashAttention（只重算注意力矩阵）' }, { v: 'full', t: '完整重算' }], mode, (v) => { mode = v; draw(); }, '激活怎么存');
  A.seg(ctl2, [{ v: 1, t: '1 张卡' }, { v: 8, t: '8 张卡' }, { v: 64, t: '64 张卡' }], k, (v) => { k = v; draw(); }, '用 ZeRO-3 把权重、梯度、优化器状态切到');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const LAYERS = [
    { key: 'opt', n: '优化器状态：FP32 主权重 + Adam m、v（12 字节/参数）', c: 2 },
    { key: 'w', n: '权重 BF16（2 字节/参数）', c: 0 },
    { key: 'g', n: '梯度 BF16（2 字节/参数）', c: 1 },
    { key: 'act', n: '激活（前向时存下、反向时用掉）', c: 3 },
  ];
  const CAP = 80e9;
  let P = null;
  function model() {
    const M = MODELS[mk], n = Math.pow(2, lgN);
    const per = n * B * M.d * (mode === 'none' ? 34 + 5 * M.a * n / M.d : 34); // bytes of saved activations per layer
    const inp = 2 * n * B * M.d; // a layer's input only (full recompute)
    const w = 2 * M.N / k, g = 2 * M.N / k, opt = 12 * M.N / k;
    const pts = []; // {t, act, g, phase}
    const L = M.L, bwdT = mode === 'full' ? 3 : 2; // backward = 2× forward; full recompute adds one more forward
    for (let l = 0; l <= L; l++) pts.push({ t: l, act: (mode === 'full' ? inp : per) * l, g: 0, ph: 'f', l });
    let t = L;
    for (let l = L; l >= 1; l--) {
      const a0 = mode === 'full' ? l * inp + per : l * per, a1 = mode === 'full' ? (l - 1) * inp : (l - 1) * per;
      pts.push({ t, act: a0, g: g * (L - l) / L, ph: 'b', l });
      t += bwdT;
      pts.push({ t, act: a1, g: g * (L - l + 1) / L, ph: 'b', l });
    }
    const tu = t + Math.max(2, L * 0.25);
    pts.push({ t, act: 0, g, ph: 'u' }); pts.push({ t: tu, act: 0, g, ph: 'u' });
    let peak = 0, pk = null;
    pts.forEach((p) => { const tot = w + opt + p.g + p.act; p.tot = tot; if (tot > peak + 1) { peak = tot; pk = p; } });
    const extra = mode === 'full' ? 1 / 3 : mode === 'flash' ? n / (6 * (6 * M.d + n)) : 0;
    return { M, n, per, inp, w, g, opt, pts, peak, pk, extra, Tend: tu, Lend: L, bwdEnd: t };
  }
  const copt = { aspect: 0.42 };
  const view = A.canvas(cv, copt, (ctx, W, H) => {
    const narrow = W < 560, want = narrow ? 0.8 : 0.42;
    if (copt.aspect !== want) { copt.aspect = want; requestAnimationFrame(() => view.redraw()); return; }
    const box = { x: 58, y: 30, w: W - 76, h: H - 70 };
    const ymax = Math.max(P.peak * 1.12, CAP * 1.15);
    const ax = A.axes(ctx, box, { xmin: 0, xmax: P.Tend, ymin: 0, ymax, xticks: [], yfmt: (v) => (v / 1e9).toFixed(0), ylabel: '显存（GB）', ylabelOffset: 44 });
    const st = (p) => [P.opt, P.opt + P.w, P.opt + P.w + p.g, P.opt + P.w + p.g + p.act];
    for (let j = 3; j >= 0; j--) {
      ctx.fillStyle = A.alpha(cols[LAYERS[j].c], j === 3 ? 0.75 : 0.85);
      ctx.beginPath(); ctx.moveTo(ax.X(P.pts[0].t), ax.Y(j ? st(P.pts[0])[j - 1] : 0));
      P.pts.forEach((p) => ctx.lineTo(ax.X(p.t), ax.Y(Math.min(st(p)[j], ymax))));
      for (let i = P.pts.length - 1; i >= 0; i--) { const p = P.pts[i]; ctx.lineTo(ax.X(p.t), ax.Y(j ? Math.min(st(p)[j - 1], ymax) : 0)); }
      ctx.closePath(); ctx.fill();
    }
    // phase separators and labels
    const mid = (a, b) => (ax.X(a) + ax.X(b)) / 2;
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]);
    [P.Lend, P.bwdEnd].forEach((x) => { ctx.beginPath(); ctx.moveTo(ax.X(x), box.y); ctx.lineTo(ax.X(x), box.y + box.h); ctx.stroke(); });
    ctx.restore();
    const lab = { size: 12, align: 'center', color: A.css('--ink-2'), weight: 600 };
    A.text(ctx, narrow ? '前向' : '前向：第 1 → ' + P.M.L + ' 层', mid(0, P.Lend), box.y + box.h + 14, lab);
    A.text(ctx, narrow ? '反向' : '反向：第 ' + P.M.L + ' → 1 层' + (mode === 'full' ? '（每层先重算一遍前向）' : ''), mid(P.Lend, P.bwdEnd), box.y + box.h + 14, lab);
    A.text(ctx, '更新', mid(P.bwdEnd, P.Tend), box.y + box.h + 14, lab);
    // capacity line
    ctx.save(); ctx.strokeStyle = A.css('--s8'); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(box.x, ax.Y(CAP)); ctx.lineTo(box.x + box.w, ax.Y(CAP)); ctx.stroke(); ctx.restore();
    ctx.font = '600 11.5px ' + A.css('--sans');
    const lw = ctx.measureText('H100 显存 80 GB').width;
    ctx.fillStyle = A.alpha(A.css('--page'), 0.9); ctx.fillRect(box.x + 2, ax.Y(CAP) - 18, lw + 10, 16);
    A.text(ctx, 'H100 显存 80 GB', box.x + 7, ax.Y(CAP) - 10, { size: 11.5, color: A.css('--s8'), weight: 600 });
    // peak marker
    if (P.pk) {
      const x = ax.X(P.pk.t), y = ax.Y(Math.min(P.peak, ymax));
      ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
      A.text(ctx, '峰值 ' + A.bytes(P.peak), x + (x > box.x + box.w * 0.7 ? -8 : 8), y - 12, { size: 12, weight: 700, align: x > box.x + box.w * 0.7 ? 'right' : 'left' });
    }
  });
  cv.addEventListener('mousemove', (e) => {
    if (!P) return;
    const { x } = A.pos(cv, e), W = cv.clientWidth, box = { x: 58, w: W - 76 };
    const t = ((x - box.x) / box.w) * P.Tend;
    if (t < 0 || t > P.Tend) { A.tip.hide(); return; }
    let p = P.pts[0];
    for (const q of P.pts) { if (q.t <= t) p = q; }
    const ph = p.ph === 'f' ? `前向，已算完 ${p.l} 层` : p.ph === 'b' ? `反向，正在第 ${p.l} 层` : '优化器更新';
    A.tip.show(`<b>${ph}</b><br>优化器状态 ${A.bytes(P.opt)}<br>权重 ${A.bytes(P.w)}<br>梯度 ${A.bytes(p.g)}<br>激活 ${A.bytes(p.act)}<br><b>合计 ${A.bytes(p.tot)}</b>`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    P = model();
    const fits = P.peak <= CAP;
    stats.innerHTML = '';
    const actAll = (mode === 'full' ? P.inp * P.M.L + P.per : P.per * P.M.L);
    [['每张卡的峰值显存', A.bytes(P.peak), fits ? 'var(--good-ink)' : 'var(--bad)'], ['权重 + 梯度 + 优化器状态（16 字节/参数 ÷ ' + k + '）', A.bytes(P.w + P.g + P.opt)], ['激活的最大值', A.bytes(actAll)], ['每 token 的计算量', mode === 'full' ? '8N（多 33%）' : mode === 'flash' ? '6N + ' + A.pct(P.extra, 1) : '6N']]
      .forEach(([kk, v, c]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px', color: c || '' } }, v))));
    legend.innerHTML = LAYERS.map((o) => `<span><i style="background:${cols[o.c]}"></i>${o.n}</span>`).join('');
    let msg = '';
    if (!fits && P.w + P.g + P.opt > CAP) msg = `光是与参数量成正比的部分（16 字节 × ${A.human(P.M.N, 1)}${k > 1 ? ' ÷ ' + k : ''}）就有 ${A.bytes(P.w + P.g + P.opt)}，超过一张卡的显存，激活还没算进去。重算救不了它，普通数据并行也救不了它（每张卡都要放一整份）。试试用 ZeRO-3 把它切到更多卡上。`;
    else if (!fits && mode === 'none') msg = '朴素注意力要把每个头的 n × n 注意力矩阵存下来给反向用，这一项随 n² 增长，在长序列上远大于其它激活。切到 FlashAttention：它不存这个矩阵，反向时分块重算。';
    else if (!fits && mode !== 'full') msg = `激活随序列长度 n 和微批次 B 线性增长，峰值出现在前向刚结束、反向刚开始的时刻：所有层的激活都还留着。打开“完整重算”：只存每层的输入，反向时把每层的前向重算一遍，用多 33% 的计算换回显存。`;
    else if (!fits) msg = '完整重算之后还放不下：参数部分要切到更多卡上，或者把一条序列切到几张卡上（上下文并行），见后面几节。';
    else msg = `放得下。注意形状：权重和优化器状态（14 字节/参数）是一条平台；梯度（2 字节/参数）在反向时逐层出现；激活在前向时一层层堆高、反向时一层层释放，所以峰值约等于“14 字节/参数 + 全部激活”，出现在前向刚结束的时刻。${mode === 'flash' ? 'FlashAttention 在反向时本来就要重算注意力矩阵，相当于自带了选择性重算：显存省下一大块，计算只多 ' + A.pct(P.extra, 1) + '。' : mode === 'full' ? '完整重算把激活压到很低，代价是每步多算一遍前向。' : ''}`;
    hint.innerHTML = msg;
    view.redraw();
  }
  draw();
});
