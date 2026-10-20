/* audio-latency — latency budget of a voice assistant (cascade vs native vs full-duplex) and the end-of-turn decision as a Bayesian update */
A.defineDemo('audio-latency', function (mount) {
  const { bd } = A.demo(mount, '语音对话的延迟账：哪一环最贵，以及什么时候开口', '判停默认 500 ms（OpenAI 实时接口的默认静音时长）；原生首包 234 ms（Qwen3-Omni 报告的理论值）；全双工 80 + 80 ms（Moshi）；其余数值为示意');
  const P = { tau: 500, net: 100, asr: 150, ttft: 350, sent: 150, tts: 200, native: 234, frame: 80, adelay: 80, p0: 0.5 };
  const MED = 300, SIG = 0.7, Q = 0.95; // illustrative within-turn pause model: log-normal, median 300 ms
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const Sur = (s) => (s <= 0 ? 1 : 1 - Phi(Math.log(s / MED) / SIG)); // P(pause longer than s)
  const post = (s, p0) => p0 / (p0 + (1 - p0) * Sur(s));
  function sStar(p0) { if (p0 >= Q) return 0; let lo = 0, hi = 20000; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (post(m, p0) >= Q) hi = m; else lo = m; } return hi; }
  const cols = A.series().concat([A.css('--muted')]);
  const onColor = (hex) => { const [r, g, b] = A.hex2rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#0b0b0b' : '#ffffff'; };
  const SEG = {
    tau: { n: '判停等待 τ', c: 0, d: '静音持续 τ 才认定用户说完' },
    asr: { n: '识别收尾', c: 1, d: '流式识别把最后一小段转写完' },
    ttft: { n: '语言模型首 token', c: 2, d: '预填充整段对话，给出第一个 token' },
    sent: { n: '攒够第一个短句', c: 3, d: '合成通常要等几个到十几个 token 才开始读' },
    tts: { n: '合成首段', c: 4, d: '流式合成出第一段可播放的音频' },
    native: { n: '模型首包', c: 6, d: '一个模型从音频到音频：Qwen3-Omni 报告 72 + 88 + 57 + 14 + 3 = 234 ms' },
    frame: { n: '一帧', c: 5, d: '至少要听完一帧（Mimi 为 80 ms）才能处理' },
    adelay: { n: '声学延迟', c: 8, d: '后几级声学码比语义码晚 1 帧（延迟模式）' },
    net: { n: '网络与播放缓冲', c: 7, d: '网络往返、抖动缓冲' },
  };
  const ROWS = [
    { n: '级联（三段式）', segs: ['tau', 'asr', 'ttft', 'sent', 'tts', 'net'] },
    { n: '原生（半双工）', segs: ['tau', 'native', 'net'] },
    { n: '全双工', segs: ['frame', 'adelay', 'net'] },
  ];
  // ---- controls ----
  const g1 = A.el('div', { class: 'controls' }), g2 = A.el('div', { class: 'controls' }), g3 = A.el('div', { class: 'controls' });
  bd.append(A.el('p', { class: 'small', style: { margin: '0 0 4px', color: 'var(--muted)' } }, '共用：'), g1, A.el('p', { class: 'small', style: { margin: '0 0 4px', color: 'var(--muted)' } }, '级联的三段：'), g2, A.el('p', { class: 'small', style: { margin: '0 0 4px', color: 'var(--muted)' } }, '原生与全双工：'), g3);
  const sl = (par, key, label, min, max, step, w) => A.slider(par, { label, min, max, step, value: P[key], fmt: (v) => Math.round(v) + ' ms', on: (v) => { P[key] = v; draw(); }, width: w || 170 });
  sl(g1, 'tau', '判停等待 τ', 100, 2000, 10, 210); sl(g1, 'net', '网络与播放缓冲', 0, 400, 10);
  sl(g2, 'asr', '识别收尾', 0, 600, 10); sl(g2, 'ttft', '语言模型首 token', 50, 2000, 10); sl(g2, 'sent', '攒够第一个短句', 0, 1000, 10); sl(g2, 'tts', '合成首段', 50, 1000, 10);
  sl(g3, 'native', '原生模型首包', 50, 1500, 2); sl(g3, 'frame', '全双工：一帧', 20, 200, 10); sl(g3, 'adelay', '全双工：声学延迟', 0, 200, 10);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv1 = A.el('canvas', { class: 'cv' }); bd.append(cv1);
  const h2 = A.el('p', { class: 'small', style: { margin: '14px 0 4px', fontWeight: 600 } }, '什么时候开口：静音持续了 s 毫秒，用户说完了吗（示意模型：句中停顿的时长按对数正态分布，中位数 300 ms）');
  bd.append(h2);
  const g4 = A.el('div', { class: 'controls' }); bd.append(g4);
  const p0seg = A.seg(g4, [{ v: 0.2, t: '听起来是半句话（0.2）' }, { v: 0.5, t: '说不准（0.5）' }, { v: 0.9, t: '完整的问句（0.9）' }], P.p0, (v) => { P.p0 = v; p0s.value = v; draw(); }, '从内容判断“已说完”的先验 p₀');
  const p0s = A.slider(g4, { label: 'p₀ 微调', min: 0.05, max: 0.95, step: 0.01, value: P.p0, fmt: (v) => v.toFixed(2), on: (v) => { P.p0 = v; p0seg.set(null); draw(); }, width: 170 });
  const cv2 = A.el('canvas', { class: 'cv' }); bd.append(cv2);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const total = (r) => A.sum(r.segs.map((k) => P[k]));
  let hit1 = [];
  const narrow0 = (mount.clientWidth || 800) < 560;
  const v1 = A.canvas(cv1, { height: narrow0 ? 300 : 226 }, (ctx, W, H) => {
    const narrow = W < 560;
    const box = { x: narrow ? 58 : 112, y: 16, w: W - (narrow ? 58 : 112) - 64, h: H - (narrow ? 150 : 96) };
    const xmax = Math.max(1600, ...ROWS.map(total));
    const ax = A.axes(ctx, box, { xmin: 0, xmax, ymin: 0, ymax: 1, yticks: [], xgrid: true, xfmt: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + ' s' : v + ' ms'), nx: narrow ? 3 : 7 });
    const bh = box.h / ROWS.length * 0.58; hit1 = [];
    ROWS.forEach((r, i) => {
      const y = box.y + (i + 0.5) * box.h / ROWS.length - bh / 2; let x0 = 0;
      A.text(ctx, narrow ? r.n.replace(/（.*）/, '') : r.n, box.x - 8, y + bh / 2, { size: 12, align: 'right', weight: 600 });
      r.segs.forEach((k) => {
        const v = P[k], xa = ax.X(x0), xb = ax.X(x0 + v);
        ctx.fillStyle = A.alpha(cols[SEG[k].c], 0.85); ctx.fillRect(xa, y, Math.max(0, xb - xa - 1), bh);
        if (xb - xa > 28) A.text(ctx, Math.round(v) + '', (xa + xb) / 2, y + bh / 2, { size: 11.5, align: 'center', color: onColor(cols[SEG[k].c]), weight: 600 });
        hit1.push({ x0: xa, x1: xb, y0: y, y1: y + bh, k, v, row: r.n });
        x0 += v;
      });
      A.text(ctx, Math.round(x0) + ' ms', ax.X(x0) + 6, y + bh / 2, { size: 12, weight: 700 });
    });
    ctx.save(); ctx.strokeStyle = A.css('--ink-2'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ax.X(208), box.y - 4); ctx.lineTo(ax.X(208), box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, narrow ? '人类间隙 208 ms' : '人与人的平均间隙 208 ms', ax.X(208) + 4, box.y + 2, { size: 11, color: A.css('--ink-2') });
    // legend: one swatch per component
    let lx = narrow ? 10 : box.x, ly = box.y + box.h + 34;
    Object.keys(SEG).forEach((k) => {
      ctx.font = '11.5px ' + A.css('--sans'); const w = ctx.measureText(SEG[k].n).width + 26;
      if (lx + w > W - 8) { lx = narrow ? 10 : box.x; ly += 18; }
      ctx.fillStyle = A.alpha(cols[SEG[k].c], 0.85); ctx.fillRect(lx, ly - 5, 11, 11);
      A.text(ctx, SEG[k].n, lx + 15, ly + 1, { size: 11.5, color: A.css('--ink-2') }); lx += w;
    });
  });
  cv1.addEventListener('mousemove', (ev) => { const p = A.pos(cv1, ev), h = hit1.find((h) => p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1); if (!h) { A.tip.hide(); return; } A.tip.show(`<b>${h.row} · ${SEG[h.k].n}</b>：${Math.round(h.v)} ms<br>${SEG[h.k].d}`, ev.clientX, ev.clientY); });
  cv1.addEventListener('mouseleave', () => A.tip.hide());
  const v2 = A.canvas(cv2, { height: 230 }, (ctx, W, H) => {
    const narrow = W < 560;
    const box = { x: 52, y: 26, w: W - 74, h: H - 62 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 2000, ymin: 0, ymax: 1, yticks: [0, 0.25, 0.5, 0.75, 0.95], yfmt: (v) => Math.round(v * 100) + '%', xticks: narrow ? [0, 500, 1000, 1500, 2000] : [0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000], xfmt: (v) => v + ' ms', xlabel: '静音已持续 s', ylabel: '概率', ylabelOffset: 40 });
    const curve = (f, color, dash, w) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let i = 0; i <= 200; i++) { const s = 2000 * i / 200, y = ax.Y(f(s)); i ? ctx.lineTo(ax.X(s), y) : ctx.moveTo(ax.X(s), y); } ctx.stroke(); ctx.restore(); };
    curve(Sur, cols[7], [5, 4], 1.8);
    curve((s) => post(s, P.p0), cols[0], null, 2.6);
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(Q)); ctx.lineTo(box.x + box.w, ax.Y(Q)); ctx.stroke(); ctx.restore();
    const ss = sStar(P.p0);
    if (ss <= 2000) { ctx.fillStyle = cols[2]; ctx.beginPath(); ctx.arc(ax.X(ss), ax.Y(Q), 5, 0, 7); ctx.fill(); A.text(ctx, (narrow ? '95%：' : '要 95% 把握：等 ') + Math.round(ss) + ' ms', ax.X(ss) + 8, ax.Y(Q) + 14, { size: 11.5, color: cols[2], weight: 700 }); }
    const tau = Math.min(P.tau, 2000), pt = post(tau, P.p0);
    ctx.save(); ctx.strokeStyle = cols[0]; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(tau), box.y + box.h); ctx.lineTo(ax.X(tau), ax.Y(pt)); ctx.stroke(); ctx.restore();
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(ax.X(tau), ax.Y(pt), 4.5, 0, 7); ctx.fill();
    A.text(ctx, (narrow ? 'τ：' : 'τ = ' + Math.round(P.tau) + ' ms 时把握 ') + Math.round(pt * 100) + '%', ax.X(tau) + 8, ax.Y(pt) + 14, { size: 11.5, color: cols[0], weight: 700 });
    A.text(ctx, '实线：P(说完 | 静音 ≥ s)', box.x + box.w - 4, box.y + box.h - 34, { size: 11.5, color: cols[0], align: 'right' });
    A.text(ctx, '虚线：句中停顿长于 s 的概率 S(s)', box.x + box.w - 4, box.y + box.h - 16, { size: 11.5, color: cols[7], align: 'right' });
  });
  function draw() {
    const tot = ROWS.map(total), casc = ROWS[0];
    const big = casc.segs.reduce((a, k) => (P[k] > P[a] ? k : a), casc.segs[0]);
    const pt = post(P.tau, P.p0), ss = sStar(P.p0);
    stats.innerHTML = '';
    [['级联', Math.round(tot[0]) + ' ms'], ['原生（半双工）', Math.round(tot[1]) + ' ms'], ['全双工', Math.round(tot[2]) + ' ms'], ['等 τ 就开口，其实是抢话的概率', A.pct(1 - pt, 0)], ['95% 把握需要等', ss > 0 ? Math.round(ss) + ' ms' : '不用等']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.textContent = `级联里最大的一项是“${SEG[big].n}”（${Math.round(P[big])} ms，占 ${A.pct(P[big] / tot[0], 0)}）。原生模型去掉了识别收尾、攒句子和合成三项，但只要还按静音判停，τ 就还在；全双工没有 τ 这一项，代价是模型得自己学会什么时候接话，否则就会抢话（见下面的争议框）。下半部分：τ 取短了，用户句中一停顿就被抢话；取长了，每次都要多等。从内容判断出“这句话已经说完”（p₀ 高）时，95% 的把握只需等 ${Math.round(sStar(0.9))} ms；听起来是半句话时要等 ${Math.round(sStar(0.2))} ms。`;
    v1.redraw(); v2.redraw();
  }
  draw();
});
