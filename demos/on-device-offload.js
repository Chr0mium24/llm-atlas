/* on-device-offload — Qwen3-30B-A3B (Q4_K_M, 18.6 GB) on a consumer GPU + DDR5 + NVMe. Per-token decode time is the SUM over tiers
   (layers alternate GPU attention / CPU experts): t = (non-expert + KV + g·E_act)/(η·BW_gpu) + r·E_act/BW_ram + s·E_act/BW_ssd,
   with g, r, s = share of expert bytes on GPU / in RAM / on SSD (uniform routing ⇒ share of active experts = share of bytes). */
A.defineDemo('on-device-offload', function (mount) {
  const { bd } = A.demo(mount, 'MoE 专家卸载：每个 token 的时间花在哪', '带宽估算：Qwen3-30B-A3B（Q4_K_M），8K 上下文，假设路由均匀');
  const GB = 1e9, bpp = 4.89 / 8;
  const NE = 1.54e9 * bpp;        // non-expert weights resident on GPU (attention, router, embeddings, head)
  const NEr = 1.23e9 * bpp;       // non-expert bytes read per token (embedding table excluded)
  const EX = 28.99e9 * bpp;       // all routed experts
  const EXa = 1.812e9 * bpp;      // expert bytes read per token (8 of 128 per layer)
  const KVB = 8192 * 98304;       // 8K context, FP16 KV (48 layers × 4 KV heads × 128 × 2 × 2 bytes per token)
  const GPU = {
    g16: { n: '16 GB 显卡（448 GB/s）', cap: 16, bw: 448 },
    g12: { n: 'RTX 4070 Ti 12 GB（504 GB/s）', cap: 12, bw: 504 },
    g24: { n: 'RTX 4090 24 GB（1008 GB/s）', cap: 24, bw: 1008 },
  };
  const ETA = 0.4, BUF = 1.0, OS = 6, RAMBW = 96 * 0.6, PCIE = 25, SSD = 5;
  let gp = 'g16', ram = 32, mode = 'cpu';
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.seg(c1, Object.entries(GPU).map(([v, o]) => ({ v, t: o.n })), gp, (v) => { gp = v; draw(); }, '显卡');
  A.seg(c1, [16, 32, 64].map((v) => ({ v, t: v + ' GB' })), ram, (v) => { ram = v; draw(); }, 'CPU 内存（DDR5 双通道）');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  A.seg(c2, [{ v: 'cpu', t: 'CPU 就地计算' }, { v: 'pcie', t: '每个 token 经 PCIe 搬到显卡' }], mode, (v) => { mode = v; draw(); }, '内存里的专家怎么算');
  const sS = A.slider(c2, { label: '想放进显存的专家比例', min: 0, max: 100, step: 1, value: 0, fmt: (v) => v.toFixed(0) + '%', on: draw, width: 230 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const tcv = A.el('canvas', { class: 'cv' }); bd.append(tcv);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const CG = cols[0], CR = cols[1], CS = cols[7];

  function run(share, md) {
    const G = GPU[gp];
    const vram = G.cap * GB - BUF * GB - NE - KVB;
    const smax = A.clamp(vram / EX, 0, 1);
    const g = Math.min(share, smax);
    const rest = (1 - g) * EX, ramFor = Math.max(0, (ram - OS) * GB);
    const inRam = Math.min(rest, ramFor), inSsd = rest - inRam;
    const r = inRam / EX, s = inSsd / EX;
    const tg = (NEr + KVB + g * EXa) / (ETA * G.bw * GB);
    const tr = (r * EXa) / ((md === 'cpu' ? RAMBW : PCIE) * GB);
    const ts = (s * EXa) / (SSD * GB);
    const t = tg + tr + ts;
    return { smax, g, r, s, tg, tr, ts, t, tps: 1 / t, inRam, inSsd, vramExp: g * EX };
  }

  const tView = A.canvas(tcv, { height: 74 }, (ctx, Wd) => {
    const R = run(sS.value / 100, mode);
    const parts = [
      { v: R.tg, c: CG, t: `显卡 ${(R.tg * 1e3).toFixed(1)} ms` },
      { v: R.tr, c: CR, t: `内存${mode === 'cpu' ? '（CPU 算）' : '（经 PCIe）'} ${(R.tr * 1e3).toFixed(1)} ms` },
      { v: R.ts, c: CS, t: `硬盘 ${(R.ts * 1e3).toFixed(1)} ms` },
    ];
    const scale = Math.max(R.t, run(0, mode).t) * 1.02, w = Wd - 2, y = 24, h = 22;
    A.text(ctx, `生成一个 token：${(R.t * 1e3).toFixed(1)} ms，约 ${R.tps.toFixed(R.tps < 10 ? 1 : 0)} token/s`, 0, 9, { size: 12, weight: 600 });
    let x = 0;
    parts.forEach((p) => { const pw = (p.v / scale) * w; if (pw > 0.5) { ctx.fillStyle = p.c; ctx.fillRect(x, y, pw, h); } p.x = x; x += pw; });
    let lx = 0; ctx.save(); ctx.font = '11.5px ' + A.css('--sans');
    parts.forEach((p) => { if (p.v <= 0) return; const tw = ctx.measureText(p.t).width, px = Math.max(lx, p.x); if (px + tw > Wd) return; A.text(ctx, p.t, px, y + h + 12, { size: 11.5, color: A.css('--ink-2') }); lx = px + tw + 14; });
    ctx.restore();
  });

  let hx = null;
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 56, y: 24, w: W - 76, h: H - 58 };
    const top = run(1, 'cpu').tps;
    const ymax = Math.max(20, Math.ceil(top * 1.15 / 10) * 10);
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 100, xticks: [0, 20, 40, 60, 80, 100], xfmt: (v) => v + '%', ymin: 0, ymax, xlabel: '放进显存的专家比例', ylabel: '生成速度 token/s', ylabelOffset: 46, xgrid: true });
    const R0 = run(0, mode), xm = ax.X(R0.smax * 100);
    if (R0.smax < 1) {
      ctx.save(); ctx.fillStyle = A.alpha(A.css('--muted').startsWith('#') ? A.css('--muted') : '#898781', 0.12); ctx.fillRect(xm, box.y, box.x + box.w - xm, box.h); ctx.restore();
      ctx.save(); ctx.strokeStyle = A.css('--bad'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xm, box.y); ctx.lineTo(xm, box.y + box.h); ctx.stroke(); ctx.restore();
      const right = xm > box.x + box.w - 120;
      A.text(ctx, `显存装满：${(R0.smax * 100).toFixed(0)}%`, xm + (right ? -6 : 6), box.y + 10, { size: 12, weight: 600, color: A.css('--bad'), align: right ? 'right' : 'left' });
    }
    [['cpu', CR, []], ['pcie', CR, [5, 4]]].forEach(([md, c, dash]) => {
      ctx.save(); ctx.strokeStyle = md === mode ? c : A.alpha(c, 0.4); ctx.lineWidth = md === mode ? 3 : 1.6; ctx.setLineDash(dash); ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const sh = (i / 200) * R0.smax; const y = ax.Y(A.clamp(run(sh, md).tps, 0, ymax)); i ? ctx.lineTo(ax.X(sh * 100), y) : ctx.moveTo(ax.X(sh * 100), y); }
      ctx.stroke(); ctx.restore();
    });
    const R = run(sS.value / 100, mode), px = ax.X(R.g * 100), py = ax.Y(A.clamp(R.tps, 0, ymax));
    ctx.fillStyle = CR; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    if (hx !== null && hx >= box.x && hx <= box.x + box.w) {
      const sh = A.clamp(ax.invX(hx) / 100, 0, 1);
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(hx, box.y); ctx.lineTo(hx, box.y + box.h); ctx.stroke(); ctx.restore();
      if (sh > R0.smax + 1e-9) view._tip = `<b>${(sh * 100).toFixed(0)}%</b>：显存放不下（最多 ${(R0.smax * 100).toFixed(0)}%）`;
      else { const a = run(sh, 'cpu'), b = run(sh, 'pcie'); view._tip = `<b>${(sh * 100).toFixed(0)}% 的专家在显存</b><br>CPU 就地计算：${a.tps.toFixed(1)} token/s<br>经 PCIe 搬到显卡：${b.tps.toFixed(1)} token/s` + (a.s > 0 ? `<br>${A.pct(a.s, 0)} 的专家只能放在硬盘上` : ''); }
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { hx = A.pos(cv, e).x; view.redraw(); if (view._tip) A.tip.show(view._tip, e.clientX, e.clientY); else A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { hx = null; view.redraw(); A.tip.hide(); });

  const gb = (b) => (b < 5e7 ? '0 GB' : A.bytes(b, 1));
  function draw() {
    const R = run(sS.value / 100, mode);
    stats.innerHTML = '';
    [['专家在显存', gb(R.vramExp)], ['专家在内存', gb(R.inRam)], ['专家在硬盘', gb(R.inSsd)], ['每 token', (R.t * 1e3).toFixed(1) + ' ms'], ['生成速度', R.tps.toFixed(R.tps < 10 ? 1 : 0) + ' token/s']]
      .forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px', color: i === 2 && R.inSsd > 0 ? 'var(--bad)' : '' } }, v))));
    legend.innerHTML = `<span><i style="background:${CG}"></i>显卡（非专家部分 + KV + 显存里的专家）</span><span><i style="background:${CR}"></i>CPU 内存里的专家</span><span><i style="background:${CS}"></i>硬盘上的专家</span><span>实线：CPU 就地计算 · 虚线：经 PCIe 搬到显卡</span>`;
    let msg;
    const want = sS.value / 100;
    if (want > R.smax + 1e-9) msg = `显存最多放下 ${(R.smax * 100).toFixed(0)}% 的专家（还要放注意力、KV 和缓冲区），多出来的按 ${(R.smax * 100).toFixed(0)}% 算。`;
    else msg = '';
    if (R.s > 0) msg += ` 内存只剩 ${ram - OS} GB 给专家（系统和其他程序按 ${OS} GB 留出），${A.pct(R.s, 0)} 的专家只能留在硬盘上：每个 token 平均要从硬盘读 ${A.bytes(R.s * EXa, R.s * EXa < 1e9 ? 0 : 2)}，按约 5 GB/s 要 ${(R.ts * 1e3).toFixed(0)} ms，占每个 token 时间的 ${A.pct(R.ts / R.t, 0)}。` + (R.ts > 0.5 * R.t ? '速度由硬盘决定：加内存比加显存更管用。' : '把滑块再往右拉，让显存多装一些专家，硬盘这一段就会消失。');
    else if (mode === 'pcie') msg += ` 把专家经 PCIe（约 25 GB/s）搬到显卡，比让 CPU 直接从内存（约 58 GB/s）读着算更慢：生成时一批只有 1 个 token，搬过去的权重只用一次。`;
    else if (R.g < 0.05) msg += ` 全部专家放在内存里，由 CPU 计算：显卡只花 ${(R.tg * 1e3).toFixed(1)} ms，CPU 花 ${(R.tr * 1e3).toFixed(1)} ms。把滑块往右拉，用剩下的显存装专家，内存那一段会变短。`;
    else msg += ` 显存里每多放一些专家，就有更多的字节改走约 ${(ETA * GPU[gp].bw).toFixed(0)} GB/s 的显存（按 MoE 实测利用率 40% 计），而不是约 58 GB/s 的内存。两段时间相加，所以最慢的那一段决定速度。`;
    hint.innerHTML = msg.trim() + ' 这是带宽上限的估算：路由不均匀、常用专家被缓存时会更好，CPU 计算和内核开销会让它更差。';
    tView.redraw(); view.redraw();
  }
  draw();
});
