/* moe-ep — expert parallelism time budget per MoE layer: reading expert weights vs computing vs all-to-all, as a function of tokens per GPU, granularity and network */
A.defineDemo('moe-ep', function (mount) {
  const { bd } = A.demo(mount, '专家并行的时间账：一个 MoE 层，每个 token 花多少时间', '按 DeepSeek-V3 的层配置估算；32 张卡组成一个专家并行组，单卡 989 TFLOPS、HBM 3.35 TB/s；理想化的上限估计');
  const D = 7168, DE = 2048, E0 = 256, K0 = 8, G = 32, FLOPS = 989e12, HBM = 3.35e12, BW_W = 1, BD = 1, BC = 2;
  let ng = 64, gran = 1, net = 50e9, overlap = false;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const sn = A.slider(ctl, { label: '每张卡一步处理的 token 数', min: 1, max: 8192, log: true, value: ng, fmt: (v) => Math.round(v), on: (v) => { ng = Math.round(v); draw(); }, width: 230 });
  ng = Math.round(sn.value);
  A.seg(ctl, [{ v: 1, t: '256 选 8' }, { v: 2, t: '512 选 16' }, { v: 4, t: '1024 选 32' }], gran, (v) => { gran = v; draw(); }, '细粒度（总参数、激活参数不变）');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.seg(ctl2, [{ v: 50e9, t: '跨节点 IB 50 GB/s' }, { v: 160e9, t: 'H800 NVLink 160 GB/s' }, { v: 450e9, t: 'H100 NVLink 450 GB/s' }], net, (v) => { net = v; draw(); }, '每卡网络带宽');
  A.check(ctl2, '通信与计算重叠（DualPipe 一类调度）', false, (v) => { overlap = v; draw(); });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i class="line" style="background:var(--s2)"></i>读专家权重（FP8）</span><span><i class="line" style="background:var(--s3)"></i>专家计算</span><span><i class="line" style="background:var(--s7)"></i>全对全通信（发出 FP8、收回 BF16）</span><span><i class="line" style="background:var(--ink)"></i>合计</span>' }));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  function model(n) {
    const k = K0 * gran, de = DE / gran, E = E0 * gran, T = G * n, lam = (k * T) / E;
    const touched = 1 - Math.pow(1 - k / E, T);
    const tW = ((E / G) * touched * 3 * D * de * BW_W) / HBM;
    const tC = (k * n * 6 * D * de) / FLOPS;
    const tN = (n * k * D * (BD + BC) * (1 - 1 / G)) / net;
    const tE = Math.max(tW, tC);
    const tot = overlap ? Math.max(tE, tN) : tE + tN;
    return { k, de, E, T, lam, tW, tC, tN, tot };
  }
  const us = (s) => (s * 1e6 < 10 ? (s * 1e6).toFixed(2) : (s * 1e6).toFixed(0)) + ' μs';
  let ax = null;
  const view = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    const box = { x: 58, y: 24, w: W - 76, h: H - 62 };
    ax = A.axes(ctx, box, { xmin: 1, xmax: 8192, xlog: true, ymin: 0.01, ymax: 200, ylog: true, xticks: [1, 4, 16, 64, 256, 1024, 4096], yticks: [0.01, 0.1, 1, 10, 100], xfmt: (v) => v, yfmt: (v) => (v >= 1 ? v : v), xlabel: '每张卡一步处理的 token 数（对数轴）', ylabel: '每个 token 的时间（μs，对数轴）', ylabelOffset: 52 });
    const cols = A.series();
    const curves = [['tW', cols[1], 2], ['tC', cols[2], 2], ['tN', cols[6], 2], ['tot', A.css('--ink'), 2.6]];
    curves.forEach(([key, col, lw]) => {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i <= 160; i++) { const n = Math.pow(8192, i / 160), m = model(n), y = (m[key] / n) * 1e6; const py = ax.Y(A.clamp(y, 0.01, 200)); i ? ctx.lineTo(ax.X(n), py) : ctx.moveTo(ax.X(n), py); }
      ctx.stroke();
    });
    // compute-bound threshold: lam = ridge/2 (FP8 weights: 2 FLOP per weight byte per token)
    const ridge = FLOPS / HBM, lamStar = ridge / 2;
    const nStar = (lamStar * E0 * gran) / (K0 * gran * G);
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = A.css('--axis');
    ctx.beginPath(); ctx.moveTo(ax.X(nStar), box.y); ctx.lineTo(ax.X(nStar), box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, `每个专家分到约 ${Math.round(lamStar)} 个 token：读权重 = 计算 →`, ax.X(nStar) - 6, box.y + 8, { size: 11, align: 'right', color: A.css('--muted') });
    const m = model(ng);
    ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(ax.X(ng), ax.Y(A.clamp((m.tot / ng) * 1e6, 0.01, 200)), 5, 0, 7); ctx.fill();
  });
  cv.addEventListener('mousemove', (e) => {
    if (!ax) return; const p = A.pos(cv, e); const n = Math.round(A.clamp(ax.invX(p.x), 1, 8192)); const m = model(n);
    A.tip.show(`每卡 ${n} 个 token（全组 ${m.T}），每个专家约 ${m.lam.toFixed(1)} 个<br>每 token：读权重 ${us(m.tW / n)}，计算 ${us(m.tC / n)}，通信 ${us(m.tN / n)}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    const m = model(ng);
    const parts = [['读权重', m.tW], ['计算', m.tC], ['通信', m.tN]];
    const worst = parts.slice().sort((a, b) => b[1] - a[1])[0][0];
    stats.innerHTML = '';
    [['配置', `${m.E} 个专家选 ${m.k} 个，专家中间维度 ${m.de}`], ['每个专家分到的 token', m.lam.toFixed(1) + ' 个'], ['这一层用时（每卡）', `读权重 ${us(m.tW)} · 计算 ${us(m.tC)} · 通信 ${us(m.tN)}`], ['合计', us(m.tot) + (overlap ? '（重叠：取最大）' : '（不重叠：专家部分 + 通信）')], ['瓶颈', worst]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '14.5px' } }, v))));
    const ratio = (6 * (DE / gran)) / (BD + BC), need = FLOPS / net;
    hint.innerHTML = `每个 token 在一层里要把 d = 7168 维的向量发给 k 个专家、再收回来，共 k·d·3 字节；专家对它做 k·6·d·d<sub>e</sub> 次运算。两者之比 = 6d<sub>e</sub>/3 = <b>${ratio.toFixed(0)} FLOP/字节</b>，与批大小、k、d 都无关。要让通信藏在计算后面，这个比值得超过“峰值算力 ÷ 网络带宽” = <b>${need.toFixed(0)} FLOP/字节</b>。${ratio < need ? '现在达不到，所以通信是硬瓶颈：' : '现在达得到：'}把细粒度调高，d<sub>e</sub> 变小，比值同比下降。读权重的那条线随 token 数增加按 1/n 下降，直到每个专家分到约 148 个 token：整个专家并行组一步要凑够约 ${Math.round(148 * 32)} 个 token，是同样条件下稠密模型所需批大小的 E/k = 32 倍。`;
    view.redraw();
  }
  draw();
});
