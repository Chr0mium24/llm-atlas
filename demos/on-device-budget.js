/* on-device-budget — one device, one model: memory ledger (weights + n·κ + buffers vs usable memory) and decode / prefill estimates.
   decode ≈ η·BW / (W_read + n·κ); prefill ≈ (2·N_act·n + 2·L·d_q·n²) / P_eff. η and P_eff are back-computed from public llama.cpp
   benchmarks (llama 7B Q4_0: tg128 × bytes, pp512 × 2N); the CPU-only laptop is an order-of-magnitude guess (60% of DDR5 bandwidth, ~1 TFLOPS); MoE gets an extra 0.55 on η (RTX 3090 measured ≈ 37% of its bound). */
A.defineDemo('on-device-budget', function (mount) {
  const { bd } = A.demo(mount, '本地部署计算器：装得下吗、跑多快', '估算：η 与有效算力由 llama.cpp 公开跑分折算');
  const DEV = {
    c16: { n: '16 GB 显卡（5060 Ti 一档）', cap: 16, buf: 1.0, bw: 448, eta: 0.80, P: 55e12 },
    c12: { n: 'RTX 4070 Ti 12 GB', cap: 12, buf: 1.0, bw: 504, eta: 0.75, P: 90e12 },
    c24: { n: 'RTX 4090 24 GB', cap: 24, buf: 1.0, bw: 1008, eta: 0.72, P: 195e12 },
    m3: { n: 'M3 Mac 16 GB', cap: 11, buf: 0.6, bw: 100, eta: 0.82, P: 2.47e12, mac: 1 },
    m4p: { n: 'M4 Pro Mac 48 GB', cap: 36, buf: 0.8, bw: 273, eta: 0.69, P: 4.8e12, mac: 1 },
    cpu: { n: '只有 CPU 的笔记本 32 GB', cap: 26, buf: 0.5, bw: 96, eta: 0.6, P: 1e12, cpu: 1 },
  };
  // T: total params (B), R: params read per token (B, = active, embedding table excluded), L layers, kvh KV heads (d_h = 128), dq = h_q·d_h
  const MD = {
    l8: { n: 'Llama 3.1 8B', T: 8.03, R: 7.50, L: 32, kvh: 8, dq: 4096 },
    q14: { n: 'Qwen3 14B', T: 14.77, R: 13.99, L: 40, kvh: 8, dq: 5120 },
    q32: { n: 'Qwen3 32B', T: 32.76, R: 31.98, L: 64, kvh: 8, dq: 8192 },
    moe: { n: 'Qwen3 30B-A3B（MoE）', T: 30.53, R: 3.04, L: 48, kvh: 4, dq: 4096, moe: 1 },
    l70: { n: 'Llama 3.1 70B', T: 70.55, R: 69.5, L: 80, kvh: 8, dq: 8192 },
  };
  const FM = { bf16: ['BF16', 16], q8: ['Q8_0', 8.5], q6: ['Q6_K', 6.56], q4: ['Q4_K_M', 4.89], q3: ['Q3_K_M', 4.0], iq2: ['IQ2_XXS', 2.38] };
  const KV = { f16: ['FP16', 2], q8: ['Q8_0', 8.5 / 8], q4: ['Q4_0', 4.5 / 8] };
  const kfmt = (v) => { const k = v / 1024; return (k >= 10 || Math.abs(k - Math.round(k)) < 0.05 ? Math.round(k) : k.toFixed(1)) + 'K'; };
  const wan = (v) => (v >= 10000 ? (v / 1e4).toFixed(1) + ' 万' : String(v));
  let dv = 'c16', md = 'l8', fm = 'q4', kv = 'f16';
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.seg(c1, Object.entries(DEV).map(([v, o]) => ({ v, t: o.n })), dv, (v) => { dv = v; draw(); }, '设备');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  A.seg(c2, Object.entries(MD).map(([v, o]) => ({ v, t: o.n })), md, (v) => { md = v; draw(); }, '模型');
  const c3 = A.el('div', { class: 'controls' }); bd.append(c3);
  A.seg(c3, Object.entries(FM).map(([v, o]) => ({ v, t: o[0] })), fm, (v) => { fm = v; draw(); }, '权重格式');
  A.seg(c3, Object.entries(KV).map(([v, o]) => ({ v, t: o[0] })), kv, (v) => { kv = v; draw(); }, 'KV 精度');
  const c4 = A.el('div', { class: 'controls' }); bd.append(c4);
  const nS = A.slider(c4, { label: '上下文长度 n（也当作要读的提示长度）', min: 1024, max: 131072, log: true, step: 0.001, value: 8192, fmt: (v) => kfmt(Math.round(v)) + ' token', on: draw, width: 280 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const mcv = A.el('canvas', { class: 'cv' }); bd.append(mcv);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const KVC = { f16: 0, q8: 2, q4: 6 };

  function model(kvKey, n) {
    const D = DEV[dv], M = MD[md], b = FM[fm][1];
    const W = M.T * 1e9 * b / 8, Wr = M.R * 1e9 * b / 8;
    const kappa = 2 * M.L * M.kvh * 128 * KV[kvKey][1];
    const kvB = n * kappa, buf = D.buf * 1e9, cap = D.cap * 1e9;
    const need = W + kvB + buf;
    const nmax = Math.max(0, Math.floor((cap - buf - W) / kappa));
    const eta = D.eta * (M.moe ? 0.55 : 1);
    const tps = (m) => (eta * D.bw * 1e9) / (Wr + m * kappa);
    const pre = (2 * M.R * 1e9 * n + 2 * M.L * M.dq * n * n) / D.P;
    return { D, M, W, Wr, kappa, kvB, buf, cap, need, nmax, eta, tps, pre, fits: need <= cap, wfits: W + buf <= cap };
  }
  const fmtT = (s) => (s < 1 ? (s * 1000).toFixed(0) + ' ms' : s < 100 ? s.toFixed(1) + ' 秒' : s < 3600 ? (s / 60).toFixed(1) + ' 分钟' : (s / 3600).toFixed(1) + ' 小时');

  const memView = A.canvas(mcv, { height: 70 }, (ctx, Wd) => {
    const n = Math.round(nS.value), m = model(kv, n);
    const scale = Math.max(m.cap, m.need) * 1.04, w = Wd - 2, y = 24, h = 22;
    const X = (b) => (b / scale) * w;
    A.text(ctx, `内存怎么分（可用 ${A.bytes(m.cap, 0)}）`, 0, 9, { size: 12, weight: 600 });
    ctx.fillStyle = A.css('--grid'); ctx.fillRect(0, y, X(m.cap), h);
    const parts = [
      { v: m.W, c: A.css('--muted'), t: '权重 ' + A.bytes(m.W, 1) },
      { v: m.kvB, c: cols[KVC[kv]], t: 'KV ' + A.bytes(m.kvB, 1) },
      { v: m.buf, c: A.alpha(cols[4], 0.55), t: '缓冲区 ' + A.bytes(m.buf, 1) },
    ];
    let x = 0;
    parts.forEach((p) => { const pw = X(p.v); ctx.fillStyle = p.c; ctx.fillRect(x, y, Math.max(0, pw), h); p.x = x; x += pw; });
    const xc = X(m.cap);
    ctx.save(); ctx.strokeStyle = m.fits ? A.css('--ink-2') : A.css('--bad'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xc, y - 5); ctx.lineTo(xc, y + h + 5); ctx.stroke(); ctx.restore();
    if (!m.fits) A.text(ctx, `超出 ${A.bytes(m.need - m.cap, 1)}`, Math.min(xc + 6, Wd - 90), 9, { size: 12, weight: 600, color: A.css('--bad') });
    let lx = 0; ctx.save(); ctx.font = '11.5px ' + A.css('--sans');
    parts.forEach((p) => { const tw = ctx.measureText(p.t).width, px = Math.max(lx, p.x); if (px + tw > Wd) return; A.text(ctx, p.t, px, y + h + 12, { size: 11.5, color: A.css('--ink-2') }); lx = px + tw + 14; });
    ctx.restore();
  });

  let hx = null;
  const view = A.canvas(cv, { aspect: 0.44 }, (ctx, W, H) => {
    const n = Math.round(nS.value);
    const box = { x: 56, y: 26, w: W - 76, h: H - 62 };
    const ms = Object.keys(KV).map((k) => model(k, n));
    let hi = 0, lo = Infinity;
    ms.forEach((m) => { hi = Math.max(hi, m.tps(1024)); lo = Math.min(lo, m.tps(131072)); });
    const LAD = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const ymax = LAD.find((v) => v >= hi * 1.15) || 1000, ymin = [...LAD].reverse().find((v) => v <= lo * 0.85) || 0.1;
    const yt = LAD.filter((v) => v >= ymin && v <= ymax);
    const ax = A.axes(ctx, box, { xmin: 1024, xmax: 131072, xlog: true, xticks: [1024, 4096, 16384, 65536, 131072], xfmt: kfmt, ymin, ymax, ylog: true, yticks: yt, yfmt: (v) => String(v), xlabel: '上下文长度 n（对数）', ylabel: '生成速度 token/s（对数）', ylabelOffset: 48, xgrid: true });
    Object.keys(KV).forEach((k, i) => {
      const m = ms[i], strong = k === kv, c = cols[KVC[k]];
      const lim = A.clamp(m.wfits ? m.nmax : 0, 0, 131072);
      ctx.save(); ctx.lineWidth = strong ? 3 : 1.5; ctx.strokeStyle = strong ? c : A.alpha(c, 0.45);
      const seg = (from, to, dash) => { if (to <= from) return; ctx.setLineDash(dash); ctx.beginPath(); for (let j = 0; j <= 120; j++) { const v = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * (j / 120)); const yy = ax.Y(A.clamp(m.tps(v), ymin, ymax)); j ? ctx.lineTo(ax.X(v), yy) : ctx.moveTo(ax.X(v), yy); } ctx.stroke(); };
      if (lim > 1024) seg(1024, lim, []);
      seg(Math.max(1024, lim), 131072, [3, 5]);
      ctx.restore();
      if (strong && lim > 1024 && lim < 131072) {
        const xw = ax.X(lim);
        ctx.save(); ctx.strokeStyle = A.css('--bad'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xw, box.y); ctx.lineTo(xw, box.y + box.h); ctx.stroke(); ctx.restore();
        const right = xw > box.x + box.w - 120;
        A.text(ctx, '内存墙 ' + wan(lim), xw + (right ? -6 : 6), box.y + 10, { size: 12, weight: 600, color: A.css('--bad'), align: right ? 'right' : 'left' });
      }
    });
    const m = model(kv, n), c = cols[KVC[kv]];
    const px = ax.X(n), py = ax.Y(A.clamp(m.tps(n), ymin, ymax));
    ctx.fillStyle = m.fits ? c : A.css('--surface'); ctx.strokeStyle = m.fits ? A.css('--surface') : A.css('--bad'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    if (!m.wfits) A.text(ctx, '权重本身就放不下', box.x + box.w / 2, box.y + box.h / 2, { size: 14, weight: 700, color: A.css('--bad'), align: 'center' });
    if (hx !== null && hx >= box.x && hx <= box.x + box.w) {
      const v = Math.round(ax.invX(hx));
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(hx, box.y); ctx.lineTo(hx, box.y + box.h); ctx.stroke(); ctx.restore();
      view._tip = `<b>n = ${kfmt(v)}</b><br>` + Object.keys(KV).map((k, i) => { const mm = model(k, v); const ok = mm.wfits && v <= mm.nmax; return `<span style="color:${cols[KVC[k]]}">●</span> KV ${KV[k][0]}：${mm.tps(v).toFixed(1)} token/s，KV ${A.bytes(v * mm.kappa, 1)}${ok ? '' : '（<b>放不下</b>）'}`; }).join('<br>') + `<br>读完 ${kfmt(v)} 的提示：约 ${fmtT(model(kv, v).pre)}`;
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { hx = A.pos(cv, e).x; view.redraw(); if (view._tip) A.tip.show(view._tip, e.clientX, e.clientY); else A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { hx = null; view.redraw(); A.tip.hide(); });

  function draw() {
    const n = Math.round(nS.value), m = model(kv, n);
    stats.innerHTML = '';
    [['权重', A.bytes(m.W, 1)], ['KV（' + kfmt(n) + '）', A.bytes(m.kvB, 1)], ['合计 / 可用', A.bytes(m.need, 1) + ' / ' + A.bytes(m.cap, 0)], ['生成速度', m.wfits ? m.tps(n).toFixed(m.tps(n) < 10 ? 1 : 0) + ' token/s' : '—'], ['读完提示', m.wfits ? fmtT(m.pre) : '—'], ['最长上下文', m.wfits ? (m.nmax >= 131072 ? '128K（模型上限）' : wan(m.nmax)) : '—']]
      .forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px', color: i === 2 ? (m.fits ? 'var(--good-ink)' : 'var(--bad)') : '' } }, v))));
    legend.innerHTML = Object.keys(KV).map((k) => `<span><i class="line" style="background:${cols[KVC[k]]}"></i>KV ${KV[k][0]}</span>`).join('') + '<span>实线：内存装得下 · 虚线：装不下 · 圆点：当前设置</span>';
    const kvShare = (n * m.kappa) / (m.Wr + n * m.kappa);
    let msg;
    if (!m.wfits) msg = `${MD[md].n} 的 ${FM[fm][0]} 权重就要 ${A.bytes(m.W, 1)}，加上缓冲区超过了可用的 ${A.bytes(m.cap, 0)}。换更低的位数或更小的模型；MoE 可以把专家放到 CPU 内存里（「MoE 在端侧」一节的演示）；稠密模型也可以把部分层放到 CPU 上，放过去的那部分按内存带宽算，速度随之下降。`;
    else if (!m.fits) msg = `权重放得下，但 ${kfmt(n)} 的 KV（${A.bytes(m.kvB, 1)}）放不下：这个设置最长约 ${wan(m.nmax)} token。把 KV 换成 Q8_0 或 Q4_0，曲线的实线部分会向右延长。`;
    else {
      msg = `装得下。每生成一个 token 要读 ${A.bytes(m.Wr + n * m.kappa, 1)}，其中 KV 占 ${A.pct(kvShare, 0)}：上下文越长，KV 在分母里占得越多，生成越慢（曲线向右下降）。`;
      if (m.pre > 20) msg += ` 读完 ${kfmt(n)} 的提示要约 ${fmtT(m.pre)}${m.D.mac || m.D.cpu ? '：生成速度尚可，等首 token 才是主要的等待' : '：长提示时注意力的计算按 n² 增长'}。`;
      if (MD[md].moe) msg += ' MoE 每个 token 只读约 30 亿个激活参数，所以比同样大小的稠密模型快得多；带宽利用率按实测打了 0.55 折。';
    }
    if (m.D.cpu) msg += ' 只有 CPU 的机器按量级估算（内存带宽用到六成、有效算力约 1 TFLOPS），用 llama-bench 测一次自己的机器更准。';
    hint.innerHTML = msg;
    memView.redraw(); view.redraw();
  }
  draw();
});
