/* roofline — interactive demo (moved from ch10-infra.html) */
A.defineDemo('roofline', function (mount) {
  const { bd } = A.demo(mount, '推理速度估算器 + Roofline', '理想化估算：忽略内核效率、通信与调度开销');
  const HW = {
    m3: { n: 'M3（16 GB，GPU 可用约 11 GB）', bw: 100, tf: 3.6, mem: 12, fp8: 1, fp4: 1 },
    ultra: { n: 'M3 Ultra（512 GB）', bw: 819, tf: 28, mem: 512, fp8: 1, fp4: 1 },
    t4070: { n: 'RTX 4070 Ti（12 GB）', bw: 504, tf: 80, mem: 12, fp8: 2, fp4: 1 },
    t4090: { n: 'RTX 4090（24 GB）', bw: 1008, tf: 165, mem: 24, fp8: 2, fp4: 1 },
    h100: { n: 'H100 SXM（80 GB）', bw: 3350, tf: 989, mem: 80, fp8: 2, fp4: 1 },
    b200: { n: 'B200（192 GB）', bw: 8000, tf: 2250, mem: 192, fp8: 2, fp4: 4 },
  };
  const MD = {
    l8: { n: 'Llama 3 8B', T: 8, Aa: 8, kv: 128e3 },
    q27: { n: '27B 稠密', T: 27, Aa: 27, kv: 64e3 },
    l70: { n: 'Llama 3 70B', T: 70.6, Aa: 70.6, kv: 320e3 },
    oss: { n: 'gpt-oss-120b', T: 117, Aa: 5.1, kv: 72e3, r: 4 / 128 },
    v4f: { n: 'DeepSeek V4-Flash', T: 284, Aa: 13, kv: 10e3, r: 8 / 256 },
    k3: { n: 'Kimi K3', T: 2800, Aa: 104, kv: 27.6e3, r: 16 / 896 },
  };
  const FMTS = { bf16: { n: 'BF16', b: 16, c: 'bf16' }, fp8: { n: 'FP8', b: 8, c: 'fp8' }, q4: { n: '4-bit（W4A16）', b: 4.5, c: 'bf16' }, fp4: { n: 'FP4（W4A4）', b: 4.5, c: 'fp4' }, tern: { n: '三值 1.75 bpw', b: 1.75, c: 'bf16' } };
  let hw = 't4090', md = 'l8', fm = 'q4';
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  A.seg(c1, Object.entries(HW).map(([v, o]) => ({ v, t: o.n })), hw, (v) => { hw = v; calc(); }, '硬件');
  const c2 = A.el('div', { class: 'controls' }); bd.append(c2);
  A.seg(c2, Object.entries(MD).map(([v, o]) => ({ v, t: o.n })), md, (v) => { md = v; calc(); }, '模型');
  A.seg(c2, Object.entries(FMTS).map(([v, o]) => ({ v, t: o.n })), fm, (v) => { fm = v; calc(); }, '权重格式');
  const c3 = A.el('div', { class: 'controls' }); bd.append(c3);
  const nG = A.slider(c3, { label: '设备数（理想张量并行）', min: 1, max: 72, step: 1, value: 1, fmt: (v) => v + ' 台', on: calc });
  const bS = A.slider(c3, { label: 'batch（并发用户）', min: 1, max: 1024, log: true, value: 1, fmt: (v) => Math.round(v), on: calc });
  const cS = A.slider(c3, { label: '每个请求的上下文', min: 512, max: 131072, log: true, value: 4096, fmt: (v) => A.human(Math.round(v), 0), on: calc });
  const pS = A.slider(c3, { label: 'prompt 长度（算 prefill）', min: 128, max: 131072, log: true, value: 8192, fmt: (v) => A.human(Math.round(v), 0), on: calc });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  let pt = null;
  function calc() {
    const H = HW[hw], M = MD[md], F = FMTS[fm], G = nG.value, B = Math.round(bS.value), ctx = Math.round(cS.value);
    const bw = H.bw * 1e9 * G, mult = F.c === 'fp8' ? H.fp8 : F.c === 'fp4' ? H.fp4 : 1, peak = H.tf * 1e12 * mult * G;
    const bpp = F.b / 8;
    let wBytes;
    if (M.r) { const X = (M.T - M.Aa) / (1 - M.r), N = M.T - X; wBytes = (N + X * (1 - Math.pow(1 - M.r, B))) * 1e9 * bpp; }
    else wBytes = M.T * 1e9 * bpp;
    const kvBytes = B * ctx * M.kv * (fm === 'bf16' ? 1 : 0.5);
    const flops = 2 * M.Aa * 1e9 * B;
    const bytes = wBytes + kvBytes;
    const t = Math.max(bytes / bw, flops / peak);
    const bound = bytes / bw > flops / peak ? '带宽受限' : '算力受限';
    const memNeed = M.T * 1e9 * bpp + kvBytes;
    const fits = memNeed <= H.mem * 1e9 * G * 0.92;
    const prefill = (2 * M.Aa * 1e9 * pS.value) / (peak * 0.6);
    pt = { ai: flops / bytes, perf: flops / t, peak, bw, aiPre: (2 * M.Aa * 1e9 * pS.value) / (M.T * 1e9 * bpp) };
    stats.innerHTML = '';
    [['单用户速度', (1 / t).toFixed(1) + ' tok/s'], ['总吞吐', A.human(B / t, 1) + ' tok/s'], ['瓶颈', bound], ['显存需求', A.bytes(memNeed) + (fits ? ' ✓ 装得下' : ' ✗ 装不下')], ['首 token 延迟（prefill）', prefill < 1 ? (prefill * 1000).toFixed(0) + ' ms' : prefill.toFixed(1) + ' s']]
      .forEach(([k, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px', color: i === 3 ? (fits ? 'var(--good-ink)' : 'var(--bad)') : '' } }, v))));
    note.innerHTML = `每步读取 ${A.bytes(bytes)}（权重 ${A.bytes(wBytes)}${M.r ? '，MoE 在这个 batch 下大约访问 ' + A.pct((1 - Math.pow(1 - M.r, B)), 0) + ' 的专家' : ''}，KV ${A.bytes(kvBytes)}），计算 ${A.sci(flops)} FLOPs。` +
      (bound === '带宽受限' ? ' 加大 batch 几乎不增加单步时间，总吞吐近似线性上升。这就是云服务比本地单用户便宜得多的原因。' : ' 已经到了算力上限，再加 batch 只会让每个用户变慢。') +
      ' prefill 按 60% 算力利用率估算。';
    view.redraw();
  }
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, Hh) => {
    if (!pt) return;
    const box = { x: 60, y: 14, w: W - 80, h: Hh - 50 };
    const ymax = Math.pow(10, Math.ceil(Math.log10(pt.peak)) + 0.2), ymin = ymax / 1e6;
    const ax = A.axes(ctx, box, { xmin: 0.1, xmax: 1e5, xlog: true, ymin, ymax, ylog: true, xfmt: (v) => A.human(v, 1), yfmt: (v) => A.human(v, 0), xlabel: '算术强度（FLOPs / 字节）', ylabel: '可达 FLOP/s', ylabelOffset: 54, xgrid: true });
    const cols = A.series();
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const ai = Math.pow(10, -1 + (i / 200) * 6); const y = ax.Y(A.clamp(Math.min(pt.peak, pt.bw * ai), ymin, ymax)); i ? ctx.lineTo(ax.X(ai), y) : ctx.moveTo(ax.X(ai), y); }
    ctx.stroke();
    const ridge = pt.peak / pt.bw;
    A.text(ctx, `拐点：${ridge.toFixed(0)} FLOPs/字节`, ax.X(ridge) + 6, ax.Y(pt.peak) + 14, { size: 11.5, color: A.css('--muted') });
    const dot = (ai, perf, c, label) => { const x = ax.X(A.clamp(ai, 0.1, 1e5)), y = ax.Y(A.clamp(perf, ymin, ymax)); ctx.fillStyle = c; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.stroke(); A.text(ctx, label, x + 10, y - 2, { size: 12, weight: 600, color: c }); };
    dot(pt.ai, pt.perf, cols[1], 'decode');
    dot(pt.aiPre, Math.min(pt.peak, pt.bw * pt.aiPre), cols[2], 'prefill');
  });
  calc();
});
