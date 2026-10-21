/* hardware-roofline — Roofline for one decode step of Llama 3 8B: batch lifts the weight intensity toward the ridge, per-request KV pulls it back */
A.defineDemo('hardware-roofline', function (mount) {
  const { bd } = A.demo(mount, 'Roofline：解码一步落在屋顶的哪里', 'Llama 3 8B（32 层、32 个查询头、8 个 KV 头）解码一步；按峰值算力与带宽的理想化估算，KV 缓存一律按 BF16');
  const HW = { h100: { n: 'H100', bw: 3.35e12, p16: 989e12, p8: 1979e12, mem: 80e9 }, b200: { n: 'B200', bw: 8e12, p16: 2250e12, p8: 4500e12, mem: 192e9 } };
  const FM = { bf16: { n: 'BF16', b: 2, fp8: false }, fp8: { n: 'FP8（W8A8）', b: 1, fp8: true }, w4: { n: '4 位权重（W4A16）', b: 0.5, fp8: false } };
  const N = 8.03e9, KV = 2 * 32 * 8 * 128 * 2, AF = 4 * 32 * 32 * 128, PROMPT = 4096;
  let hw = 'h100', fm = 'bf16', ctxLen = 0;
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.seg(c1, Object.entries(HW).map(([v, o]) => ({ v, t: o.n })), hw, (v) => { hw = v; calc(); }, '硬件');
  A.seg(c1, Object.entries(FM).map(([v, o]) => ({ v, t: o.n })), fm, (v) => { fm = v; calc(); }, '权重与计算格式');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  const bS = A.slider(c2, { label: 'batch（同时解码的请求数）', min: 1, max: 1024, log: true, step: 0.001, value: 1, fmt: (v) => String(Math.round(v)), on: () => calc() });
  A.seg(c2, [{ v: 0, t: '只算权重' }, { v: 4096, t: '4K' }, { v: 32768, t: '32K' }, { v: 131072, t: '128K' }], ctxLen, (v) => { ctxLen = v; calc(); }, '每个请求已有的上下文（KV 缓存）');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  let pt = null;
  function step(B, ctx) {
    const H = HW[hw], F = FM[fm], P = F.fp8 ? H.p8 : H.p16;
    const wB = N * F.b, kvB = B * ctx * KV, fl = 2 * N * B + B * ctx * AF, by = wB + kvB;
    const t = Math.max(by / H.bw, fl / P);
    return { P, bw: H.bw, wB, kvB, fl, by, t, I: fl / by, mem: wB + kvB };
  }
  function calc() {
    const B = Math.round(bS.value), s = step(B, ctxLen), s0 = step(B, 0), H = HW[hw], F = FM[fm];
    const ridge = s.P / s.bw, mstar = (s.P * F.b) / (2 * s.bw), fits = s.mem <= H.mem;
    const Ipre = (2 * N * PROMPT) / (N * F.b);
    pt = { s, s0, ridge, Ipre, P: s.P, bw: s.bw };
    const tt = (x) => (x >= 1e-3 ? (x * 1e3).toFixed(1) + ' ms' : (x * 1e6).toFixed(0) + ' µs');
    stats.innerHTML = '';
    [['算术强度 / 拐点', s.I.toFixed(s.I < 10 ? 1 : 0) + ' / ' + ridge.toFixed(0)], ['瓶颈', s.I < ridge ? '访存受限' : '计算受限'], ['每步时间', tt(s.t)], ['每个用户', (1 / s.t).toFixed(0) + ' token/s'], ['总吞吐', A.human(B / s.t, 1) + ' token/s'], ['显存（权重 + KV）', A.bytes(s.mem) + (fits ? '' : ' > ' + A.bytes(H.mem))]]
      .forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px', color: i === 1 ? (s.I < ridge ? 'var(--bad)' : 'var(--good-ink)') : i === 5 && !fits ? 'var(--bad)' : '' } }, v))));
    note.innerHTML = `每步读权重 ${A.bytes(s.wB)}` + (ctxLen ? `、KV ${A.bytes(s.kvB)}` : '') + `，计算 ${A.sci(s.fl)} FLOPs。` +
      `只看权重时，强度约等于 batch 的 \\(2/b\\) 倍，batch 到 \\(m^\\ast = Pb/(2\\,\\text{BW})\\approx ${mstar.toFixed(0)}\\) 就碰到拐点。` +
      (ctxLen ? ` 加上 KV 缓存后，每个请求的 KV 只服务它自己，强度被拉向 GQA 注意力自己的强度（这个模型 BF16 下约 4），batch 再大也上不去。空心点是不算 KV 时的位置。` : ' 试试把 batch 拖到 300 左右，再把上下文切到 32K。') +
      ' 预填充点按一段 4096 token 的提示计算（只算权重）。';
    A.renderMath(note);
    view.redraw();
  }
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, Hh) => {
    if (!pt) return;
    const box = { x: 62, y: 26, w: W - 84, h: Hh - 64 };
    const ymax = Math.pow(10, Math.ceil(Math.log10(pt.P)) + 0.3), ymin = ymax / 1e5;
    const ax = A.axes(ctx, box, { xmin: 0.5, xmax: 1e4, xlog: true, ymin, ymax, ylog: true, xfmt: (v) => A.human(v, 1), yfmt: (v) => A.human(v, 0), xlabel: '算术强度（FLOPs / 字节）', ylabel: '可达 FLOP/s', ylabelOffset: 54, xgrid: true });
    const cols = A.series();
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const ai = 0.5 * Math.pow(2e4, i / 200); const y = ax.Y(A.clamp(Math.min(pt.P, pt.bw * ai), ymin, ymax)); i ? ctx.lineTo(ax.X(ai), y) : ctx.moveTo(ax.X(ai), y); }
    ctx.stroke();
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(ax.X(pt.ridge), box.y); ctx.lineTo(ax.X(pt.ridge), box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, '拐点 ' + pt.ridge.toFixed(0), ax.X(pt.ridge) + 6, box.y + box.h - 10, { size: 11.5, color: A.css('--muted') });
    const perf = (I) => Math.min(pt.P, pt.bw * I);
    const dot = (I, c, label, hollow, dy) => {
      const x = ax.X(A.clamp(I, 0.5, 1e4)), y = ax.Y(A.clamp(perf(I), ymin, ymax));
      ctx.lineWidth = 2; ctx.strokeStyle = hollow ? c : A.css('--surface'); ctx.fillStyle = hollow ? A.css('--surface') : c;
      ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 7); ctx.fill(); ctx.stroke();
      const rt = x > box.x + box.w - 170;
      A.text(ctx, label, x + (rt ? -10 : 10), y + (dy || -2), { size: 12, weight: 600, color: c, align: rt ? 'right' : 'left' });
    };
    dot(pt.Ipre, cols[2], '预填充（4096 token）', false, 14);
    if (ctxLen) dot(pt.s0.I, cols[1], '', true);
    dot(pt.s.I, cols[1], '解码一步', false, -10);
  });
  calc();
});
