/* serving-kv-budget — memory → max concurrency → decode throughput for a 70B-class dense model on 8×H100; ideal roofline step time t(B) = max((W + B·n·κ)/BW, FLOPs/P) */
A.defineDemo('serving-kv-budget', function (mount) {
  const { bd } = A.demo(mount, '显存账：KV 缓存决定能同时服务多少人', '玩具估算：70B 级稠密模型（80 层、64 个 Q 头、头维 128），8×H100（640 GB、26.8 TB/s），理想 roofline，忽略通信；每个请求按用满 n 个 token 计算');
  const N = 70.6e9, L = 80, BW = 26.8e12, HBM = 640e9, RT = 50e9, GPU_HR = 16;
  const VAR = {
    mha: { n: 'MHA（64 组 KV）', k: (b) => 2 * L * 64 * 128 * b, a: 4 * 64 * 128, c: 6 },
    gqa: { n: 'GQA-8', k: (b) => 2 * L * 8 * 128 * b, a: 4 * 64 * 128, c: 0 },
    mla: { n: 'MLA（每层 576 维）', k: (b) => L * 576 * b, a: 2 * 64 * (576 + 512), c: 2 },
  };
  let va = 'gqa', kb = 2, wb = 2, paged = true;
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.seg(c1, Object.entries(VAR).map(([v, o]) => ({ v, t: o.n })), va, (v) => { va = v; draw(); }, '注意力');
  A.seg(c1, [{ v: 2, t: 'BF16' }, { v: 1, t: 'FP8' }], kb, (v) => { kb = v; draw(); }, 'KV 精度');
  A.seg(c1, [{ v: 2, t: 'BF16（141 GB）' }, { v: 1, t: 'FP8 W8A8（71 GB）' }], wb, (v) => { wb = v; draw(); }, '权重');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  const nS = A.slider(c2, { label: '每个请求的上下文 n（提示 + 输出）', min: 1000, max: 131072, log: true, step: 0.001, value: 5000, fmt: (v) => A.human(Math.round(v), 1) + ' token', on: draw, width: 240 });
  A.seg(c2, [{ v: true, t: '分页（16 token 一块）' }, { v: false, t: '按最大长度 128K 预留' }], paged, (v) => { paged = v; draw(); }, '显存分配');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const mcv = A.el('canvas', { class: 'cv' }); bd.append(mcv);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();

  function model(v, n) {
    const W = N * wb, P = (wb === 1 ? 2 : 1) * 7.912e15, k = VAR[v].k(kb);
    const budget = HBM - W - RT;
    const per = paged ? Math.ceil(n / 16) * 16 * k : 131072 * k;
    const Bmax = n > 131072 && !paged ? 0 : Math.floor(budget / per);
    const tm = (B) => (W + B * n * k) / BW, tc = (B) => (2 * N * B + VAR[v].a * L * n * B) / P;
    const t = (B) => Math.max(tm(B), tc(B));
    return { W, P, k, budget, per, Bmax, t, tm, tc, ceil: Math.min(BW / (n * k), P / (2 * N + VAR[v].a * L * n)) };
  }

  const memView = A.canvas(mcv, { height: 64 }, (ctx, Wd) => {
    const n = Math.round(nS.value), m = model(va, n);
    const B = m.Bmax, used = B * n * m.k, resv = B * m.per - used;
    const parts = [
      { v: m.W, c: A.css('--muted'), t: '权重 ' + A.bytes(m.W, 0) },
      { v: RT, c: A.alpha(cols[5], 0.6), t: '运行时 50 GB' },
      { v: used, c: cols[VAR[va].c], t: 'KV 实际占用 ' + A.bytes(used, 0) },
      { v: resv, c: A.alpha(cols[VAR[va].c], 0.28), t: '预留未用 ' + A.bytes(resv, 0) },
    ];
    const x0 = 0, w = Wd - 2, y = 22, h = 22;
    A.text(ctx, '640 GB 显存怎么分（并发 = ' + B + '）', 0, 9, { size: 12, weight: 600 });
    ctx.fillStyle = A.css('--grid'); ctx.fillRect(x0, y, w, h);
    let x = x0;
    parts.forEach((p) => { const pw = (p.v / HBM) * w; if (pw > 0.5) { ctx.fillStyle = p.c; ctx.fillRect(x, y, pw, h); } p.x = x; p.w = pw; x += pw; });
    let lx = 0; ctx.save(); ctx.font = '11.5px ' + A.css('--sans');
    parts.forEach((p) => { if (p.v <= 0) return; const s = p.t, tw = ctx.measureText(s).width; const px = Math.max(lx, p.x); if (px + tw > Wd) return; A.text(ctx, s, px, y + h + 10, { size: 11.5, color: A.css('--ink-2') }); lx = px + tw + 12; });
    ctx.restore();
  });

  let hx = null;
  const view = A.canvas(cv, { aspect: 0.46 }, (ctx, W, H) => {
    const n = Math.round(nS.value);
    const box = { x: 62, y: 26, w: W - 84, h: H - 62 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 4096, xlog: true, xticks: [1, 4, 16, 64, 256, 1024, 4096], xfmt: (v) => String(v), ymin: 10, ymax: 2e5, ylog: true, yticks: [10, 100, 1000, 1e4, 1e5], yfmt: (v) => A.human(v, 0), xlabel: '同时服务的请求数 B（对数）', ylabel: '整台服务器每秒生成的 token（对数）', ylabelOffset: 56, xgrid: true });
    const curve = (v, strong) => {
      const m = model(v, n), c = cols[VAR[v].c];
      ctx.save(); ctx.lineWidth = strong ? 3 : 1.6; ctx.strokeStyle = strong ? c : A.alpha(c, 0.4);
      const seg = (from, to, dash) => { ctx.setLineDash(dash || []); ctx.beginPath(); for (let i = 0; i <= 160; i++) { const B = Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * (i / 160)); const y = ax.Y(A.clamp(B / m.t(B), 10, 2e5)); i ? ctx.lineTo(ax.X(B), y) : ctx.moveTo(ax.X(B), y); } ctx.stroke(); };
      const wall = A.clamp(m.Bmax, 1, 4096);
      if (m.Bmax >= 1) seg(1, wall);
      if (m.Bmax < 4096) seg(Math.max(1, wall), 4096, [4, 4]);
      ctx.restore();
      return m;
    };
    Object.keys(VAR).filter((v) => v !== va).forEach((v) => curve(v, false));
    const m = curve(va, true), c = cols[VAR[va].c];
    // ceiling
    const yc = ax.Y(A.clamp(m.ceil, 10, 2e5));
    ctx.save(); ctx.strokeStyle = A.alpha(c, 0.7); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(box.x, yc); ctx.lineTo(box.x + box.w, yc); ctx.stroke(); ctx.restore();
    A.text(ctx, 'B → ∞ 的上限 ' + A.human(m.ceil, 1) + ' token/s', box.x + 6, yc - 9, { size: 11.5, color: c });
    if (m.Bmax >= 1) {
      const xw = ax.X(Math.min(m.Bmax, 4096));
      ctx.save(); ctx.strokeStyle = A.css('--bad'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xw, box.y); ctx.lineTo(xw, box.y + box.h); ctx.stroke(); ctx.restore();
      A.text(ctx, '显存墙 B = ' + m.Bmax, xw + (xw > box.x + box.w - 110 ? -6 : 6), box.y + box.h - 12, { size: 12, weight: 600, color: A.css('--bad'), align: xw > box.x + box.w - 110 ? 'right' : 'left' });
      const tp = m.Bmax / m.t(m.Bmax);
      ctx.fillStyle = c; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xw, ax.Y(A.clamp(tp, 10, 2e5)), 6.5, 0, 7); ctx.fill(); ctx.stroke();
    } else A.text(ctx, '一个请求都装不下', box.x + box.w / 2, box.y + box.h / 2, { size: 14, weight: 700, color: A.css('--bad'), align: 'center' });
    if (hx !== null && hx >= box.x && hx <= box.x + box.w) {
      const B = Math.max(1, Math.round(ax.invX(hx)));
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(hx, box.y); ctx.lineTo(hx, box.y + box.h); ctx.stroke(); ctx.restore();
      view._tip = `<b>B = ${B}</b>（n = ${A.human(n, 1)}）<br>` + Object.keys(VAR).map((v) => { const mm = model(v, n), t = mm.t(B); return `<span style="color:${cols[VAR[v].c]}">●</span> ${VAR[v].n}：${A.human(B / t, 1)} token/s，每人 ${(1 / t).toFixed(0)} token/s，${mm.tm(B) >= mm.tc(B) ? '带宽受限' : '算力受限'}${B > mm.Bmax ? '（<b>显存装不下</b>）' : ''}`; }).join('<br>');
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { hx = A.pos(cv, e).x; view.redraw(); if (view._tip) A.tip.show(view._tip, e.clientX, e.clientY); else A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { hx = null; view.redraw(); A.tip.hide(); });

  function draw() {
    const n = Math.round(nS.value), m = model(va, n), B = m.Bmax;
    const t = B >= 1 ? m.t(B) : 0, tp = B >= 1 ? B / t : 0;
    stats.innerHTML = '';
    [['每 token 的 KV', A.bytes(m.k, 0)], ['每个请求的 KV', A.bytes(n * m.k, 1)], ['最多同时服务', B >= 1 ? B + ' 个' : '0'], ['满载吞吐', B >= 1 ? A.human(tp, 1) + ' token/s' : '—'], ['每人速度', B >= 1 ? (1 / t).toFixed(0) + ' token/s' : '—'], ['每百万输出 token', B >= 1 ? '$' + (GPU_HR / (tp * 3600) * 1e6).toFixed(2) : '—']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = Object.keys(VAR).map((v) => `<span><i class="line" style="background:${cols[VAR[v].c]}"></i>${VAR[v].n}</span>`).join('') + '<span>实线：显存装得下 · 虚线：装不下 · 点线：批无限大时的上限</span>';
    let msg;
    if (B < 1) msg = '连一个请求的 KV 都放不下。把分配方式换成分页，或者换更小的 KV（GQA、MLA、FP8）。';
    else if (!paged) msg = `按 128K 预留时，每个请求不管实际用多少，都先占 ${A.bytes(m.per, 1)}，只能同时服务 ${B} 个请求，大部分预留的显存是空的。换成分页，曲线不变，墙往右移，吞吐随之上升。`;
    else if (m.tc(B) > m.tm(B)) msg = `KV 小到这个程度，显存墙之前就已经算力受限：再多的并发也不会让总吞吐更高，只会让每个人更慢（每人 ${(1 / t).toFixed(0)} token/s）。这是理想的状态：瓶颈回到了“算”上。`;
    else msg = `显存装满时，每一步都要把权重和全部 KV 读一遍，约 ${(t * 1e3).toFixed(0)} ms，几乎与注意力类型无关；能同时服务多少人，就决定了吞吐。上下文越长，每个请求的 KV 越大，墙越往左移；点线是“批无限大”也越不过的上限 BW/(nκ)：批处理能摊薄权重，摊不薄 KV。`;
    hint.innerHTML = msg;
    memView.redraw(); view.redraw();
  }
  draw();
});
