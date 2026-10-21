/* hardware-domain — communication ÷ computation for tensor parallel ((t−1)bP/(6d·BW)) and expert parallel ((b1+b2)P/(6d_e·BW)) over different links */
A.defineDemo('hardware-domain', function (mount) {
  const { bd } = A.demo(mount, '互连：张量并行的通信会不会比计算还慢', '按本章公式卡的比值计算：只算前向（推理），激活与算力都按 BF16；峰值算力 × 利用率，假设通信全部走所选链路、不与计算重叠');
  const LINKS = [
    { id: 'ib4', n: 'InfiniBand 400G', bw: 50e9 },
    { id: 'ib8', n: 'InfiniBand 800G', bw: 100e9 },
    { id: 'nv4', n: 'NVLink 4（H100）', bw: 450e9 },
    { id: 'nv5', n: 'NVLink 5（B200）', bw: 900e9 },
    { id: 'nv6', n: 'NVLink 6（Rubin）', bw: 1800e9 },
  ];
  const HW = { h100: { n: 'H100', bf16: 989e12, fp8: 1979e12 }, b200: { n: 'B200', bf16: 2250e12, fp8: 4500e12 } };
  const MODELS = [{ n: 'Qwen3-235B', de: 1536 }, { n: 'DeepSeek-V3', de: 2048 }, { n: 'Mixtral 8×7B', de: 14336 }];
  let mode = 'tp', hw = 'h100', link = 'nv4';
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.seg(c1, Object.entries(HW).map(([v, o]) => ({ v, t: o.n })), hw, (v) => { hw = v; draw(); }, '每张卡的算力');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  A.seg(c2, LINKS.map((l) => ({ v: l.id, t: l.n })), link, (v) => { link = v; draw(); }, '链路（每卡每方向带宽）');
  const c3 = A.el('div', { class: 'controls' }); bd.append(c3);
  const effS = A.slider(c3, { label: '实际算力利用率', min: 0.3, max: 1, step: 0.05, value: 1, fmt: (v) => A.pct(v, 0), on: () => draw() });
  const tS = A.slider(c3, { label: '张量并行卡数 t', min: 2, max: 72, step: 1, value: 8, fmt: (v) => v + ' 卡', on: () => draw() });
  const dS = A.slider(c3, { label: '隐藏维度 d', min: 2048, max: 16384, step: 1024, value: 8192, fmt: (v) => String(v), on: () => draw() });
  const deS = A.slider(c3, { label: '专家中间维度 d_e', min: 256, max: 16384, step: 256, value: 2048, fmt: (v) => String(v), on: () => draw() });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  const cols = A.series();
  const P = () => HW[hw][mode === 'tp' ? 'bf16' : 'fp8'] * effS.value;
  const ratio = (x, bw) => (mode === 'tp' ? ((x - 1) * 2 * P()) / (6 * dS.value * bw) : (3 * P()) / (6 * x * bw));
  function sync() {
    tS.el.style.display = mode === 'tp' ? '' : 'none'; dS.el.style.display = mode === 'tp' ? '' : 'none';
    deS.el.style.display = mode === 'ep' ? '' : 'none';
    draw();
  }
  let hoverX = null;
  const view = A.canvas(cv, { aspect: 0.46 }, (ctx, W, H) => {
    const box = { x: 54, y: 26, w: W - 70, h: H - 70 };
    const tp = mode === 'tp';
    const xmin = tp ? 2 : 256, xmax = tp ? 72 : 16384;
    const ax = A.axes(ctx, box, { xmin, xmax, xlog: true, ymin: 0.01, ymax: 100, ylog: true, xticks: tp ? [2, 4, 8, 16, 32, 72] : [256, 512, 1024, 2048, 4096, 8192, 16384], xfmt: (v) => String(v), yfmt: (v) => (v >= 1 ? String(v) : String(v)), xlabel: tp ? '张量并行卡数 t' : '每个专家的中间维度 d_e', ylabel: '通信时间 ÷ 计算时间', ylabelOffset: 46, xgrid: true });
    // reference lines
    ctx.save(); ctx.strokeStyle = A.css('--bad'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(box.x, ax.Y(1)); ctx.lineTo(box.x + box.w, ax.Y(1)); ctx.stroke(); ctx.restore();
    A.text(ctx, '通信 = 计算', box.x + 4, ax.Y(1) - 8, { size: 11, color: A.css('--bad') });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 4]);
    const marks = tp ? [[8, '8 卡服务器'], [72, 'NVL72']] : MODELS.map((m) => [m.de, m.n]);
    marks.forEach(([x, lab], i) => { const px = ax.X(x), right = px > box.x + box.w - 90; ctx.beginPath(); ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); ctx.stroke(); A.text(ctx, lab, px + (right ? -4 : 4), tp ? box.y + box.h - 10 : box.y + 8 + i * 13, { size: 10.5, color: A.css('--muted'), align: right ? 'right' : 'left' }); });
    ctx.restore();
    // curves
    LINKS.forEach((l, i) => {
      const sel = l.id === link;
      ctx.strokeStyle = cols[i]; ctx.lineWidth = sel ? 3.2 : 1.4; ctx.globalAlpha = sel ? 1 : 0.65; ctx.beginPath();
      for (let s = 0; s <= 160; s++) {
        const x = Math.exp(Math.log(xmin) + (Math.log(xmax) - Math.log(xmin)) * s / 160);
        const y = ax.Y(A.clamp(ratio(x, l.bw), 0.01, 100));
        s ? ctx.lineTo(ax.X(x), y) : ctx.moveTo(ax.X(x), y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      const yEnd = A.clamp(ratio(xmax, l.bw), 0.012, 90);
      A.text(ctx, l.n, box.x + box.w - 4, ax.Y(yEnd) + (yEnd > 80 ? 10 : -8), { size: 10.5, align: 'right', color: cols[i], weight: sel ? 700 : 500 });
    });
    // current point
    const cur = tp ? tS.value : deS.value, L = LINKS.find((l) => l.id === link), r = ratio(cur, L.bw);
    const px = ax.X(cur), py = ax.Y(A.clamp(r, 0.01, 100)), ci = LINKS.indexOf(L);
    ctx.fillStyle = cols[ci]; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    A.text(ctx, r.toFixed(2), px + 9, py - 9, { size: 12, weight: 700, color: cols[ci] });
    if (hoverX != null && hoverX >= box.x && hoverX <= box.x + box.w) {
      ctx.save(); ctx.strokeStyle = A.alpha(A.css('--ink'), 0.3); ctx.beginPath(); ctx.moveTo(hoverX, box.y); ctx.lineTo(hoverX, box.y + box.h); ctx.stroke(); ctx.restore();
    }
    view.ax = ax; view.box = box;
  });
  cv.addEventListener('mousemove', (e) => {
    if (!view.ax) return;
    const p = A.pos(cv, e), b = view.box;
    if (p.x < b.x || p.x > b.x + b.w) { hoverX = null; A.tip.hide(); view.redraw(); return; }
    hoverX = p.x; const x = view.ax.invX(p.x);
    const xs = mode === 'tp' ? 't = ' + Math.round(x) + ' 卡' : 'd_e = ' + Math.round(x);
    A.tip.show(`<b>${xs}</b><br>` + LINKS.map((l, i) => `<span style="color:${cols[i]}">●</span> ${l.n}：${ratio(mode === 'tp' ? Math.round(x) : x, l.bw).toFixed(2)}`).join('<br>'), e.clientX, e.clientY);
    view.redraw();
  });
  cv.addEventListener('mouseleave', () => { hoverX = null; A.tip.hide(); view.redraw(); });
  function draw() {
    const L = LINKS.find((l) => l.id === link), tp = mode === 'tp';
    const p = P();
    let tc, tm, r;
    if (tp) {
      const m = 4096, d = dS.value, t = tS.value;
      tc = (24 * m * d * d) / (t * p); tm = (4 * (t - 1) * m * d * 2) / (t * L.bw); r = tm / tc;
    } else {
      const tok = 4096, kk = 8, d = 7168, de = deS.value;
      tc = (tok * 6 * kk * d * de) / p; tm = (tok * kk * d * 3) / L.bw; r = tm / tc;
    }
    const ms = (s) => (s * 1e3).toFixed(s < 0.01 ? 3 : 2) + ' ms';
    stats.innerHTML = '';
    [['通信 ÷ 计算', r.toFixed(2)], [tp ? '每层计算（4096 token）' : '每层专家计算（每卡 4096 token）', ms(tc)], ['每层通信', ms(tm)], ['判断', r < 0.5 ? '通信可以藏在计算后面' : r < 1 ? '勉强能藏住，要靠重叠' : '通信成为瓶颈']]
      .forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px', color: i === 3 ? (r < 1 ? 'var(--good-ink)' : 'var(--bad)') : '' } }, v))));
    note.innerHTML = tp
      ? `张量并行：比值 \\(= (t-1)\\,b\\,P/(6\\,d\\,\\text{BW})\\)，BF16（\\(b = 2\\)）。改变 token 数不会改变它，所以这里只按 4096 个 token 给出绝对时间。利用率 100% 时就是正文的 0.63 和 5.6；实际内核跑不到峰值，计算变慢，比值相应变小。卡数翻倍，比值约翻倍：域再大，张量并行也只切到 8 卡左右。训练还有反向传播，比值约为这里的 2/3（第 18 章）。专家并行的通信账见第 13 章的演示。`
      : `专家并行：比值 \\(= (b_1 + b_2)\\,P/(6\\,d_e\\,\\text{BW})\\)，分发 FP8、合并 BF16（\\(b_1 + b_2 = 3\\)），算力按 FP8。它与专家个数、每个 token 激活几个专家、隐藏维度都无关（绝对时间按每卡 4096 个 token、激活 8 个专家、\\(d = 7168\\) 给出）。专家越细（\\(d_e\\) 越小），越依赖高带宽的域：把 \\(d_e\\) 拖到 2048、链路切到 InfiniBand 400G，就是 DeepSeek-V3 在 H800 上面对的处境。`;
    A.renderMath(note);
    view.redraw();
  }
  sync();
});
