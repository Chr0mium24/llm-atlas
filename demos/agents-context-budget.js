/* agents-context-budget — 几百步任务的上下文账：不管理 / 清理旧结果 / 摘要压缩，前缀缓存开关，压缩触发点与每步成本（玩具模型） */
A.defineDemo('agents-context-budget', function (mount) {
  const { bd } = A.demo(mount, '上下文的账：几百步的任务，三种策略各花多少', '玩具模型 · 初始上下文 1 万 token · 窗口 200K · 价格按相对单位：未命中输入 1、命中缓存 0.1、输出 5');
  const C0 = 10000, OUT = 300, WIN = 200000, SUM = 10000, KEEP = 3, STUB = 40, RHO = 0.1, PO = 5;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const view = A.seg(ctl, [{ v: 'cost', t: '累计成本' }, { v: 'ctx', t: '每次调用的上下文' }], 'cost', () => redraw(), '纵轴');
  const dS = A.slider(ctl, { label: '每步新增 Δ（输出 + 工具结果）', min: 500, max: 5000, step: 100, value: 2000, fmt: (v) => A.human(v) + ' token', on: () => recompute(true), width: 200 });
  const tS = A.slider(ctl, { label: '触发清理 / 压缩的阈值', min: 30000, max: 190000, step: 5000, value: 150000, fmt: (v) => Math.round(v / 1000) + 'K', on: () => recompute(false), width: 190 });
  const nS = A.slider(ctl, { label: '任务步数 n', min: 50, max: 500, step: 10, value: 300, fmt: (v) => v + ' 步', on: () => recompute(false), width: 160 });
  const cbox = A.el('div', { class: 'ctl', style: { minWidth: 'auto' } }); ctl.append(cbox);
  const cache = A.check(cbox, '前缀缓存', true, () => recompute(true));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const row = A.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px' } }); bd.append(row);
  const w1 = A.el('div', { style: { flex: '3 1 380px', minWidth: '0' } }), w2 = A.el('div', { style: { flex: '2 1 260px', minWidth: '0' } });
  row.append(w1, w2);
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  w1.append(cv1); w2.append(cv2);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = () => A.series();
  const STR = [
    { k: 'none', n: '不管理', c: 1, dash: [6, 4] },
    { k: 'clear', n: '清理旧结果', c: 2, dash: [2, 3] },
    { k: 'compact', n: '摘要压缩', c: 0, dash: [] },
  ];
  legend.innerHTML = STR.map((s) => `<span><i class="line" style="background:var(--s${s.c + 1})"></i>${s.n}${s.k === 'none' ? '（虚线）' : s.k === 'clear' ? '（点线）' : '（实线）'}</span>`).join('') + '<span><i class="line" style="background:var(--muted)"></i>不管理，假如窗口无限大（灰色点线）</span><span>右图：只看“摘要压缩”，把触发阈值从 30K 扫到 190K，各跑 600 步的平均每步成本</span>';

  // 逐块模拟：每次请求与上一次请求比较最长公共前缀，命中部分按 ρ 计价
  function sim(strat, n, D, T, useCache, noWin) {
    const rr = useCache ? RHO : 1, res = D - OUT;
    let ctx = [{ id: 'c0', tok: C0 }], prev = [], uid = 0, cost = 0, calls = 0, ops = 0, fail = null;
    const cum = [], size = [];
    const tot = (c) => { let s = 0; for (const b of c) s += b.tok; return s; };
    const req = (c, outTok) => {
      let lcp = 0;
      for (let i = 0; i < Math.min(prev.length, c.length) && prev[i] === c[i].id; i++) lcp += c[i].tok;
      cost += rr * lcp + (tot(c) - lcp) + PO * outTok; calls++;
      prev = c.map((b) => b.id);
    };
    for (let i = 1; i <= n; i++) {
      if (strat === 'compact' && tot(ctx) > T) {
        req([...ctx, { id: 'ins' + uid++, tok: 200 }], SUM); ops++;
        ctx = [ctx[0], { id: 'sum' + uid++, tok: SUM }];
      }
      if (strat === 'clear' && tot(ctx) > T) {
        const idx = []; ctx.forEach((b, j) => { if (b.res) idx.push(j); });
        const old = idx.slice(0, Math.max(0, idx.length - KEEP));
        old.forEach((j) => { ctx[j] = { id: 'stub' + uid++, tok: STUB }; });
        if (old.length) ops++;
      }
      const t = tot(ctx);
      if (t > WIN && !noWin) { fail = i; break; }
      req(ctx, OUT);
      size.push(t);
      ctx.push({ id: 'a' + uid++, tok: OUT }, { id: 'r' + uid++, tok: res, res: true });
      cum.push(cost);
    }
    return { cost, calls, ops, fail, cum, size };
  }
  let R = {}, sweep = null, hover = null;
  function computeSweep() {
    const D = dS.value, uc = cache.checked, pts = [];
    for (let T = 30000; T <= 190000; T += 5000) { const r = sim('compact', 600, D, T, uc); pts.push([T, r.cost / 600]); }
    let best = pts[0]; pts.forEach((p) => { if (p[1] < best[1]) best = p; });
    // 公式：X* = sqrt(2 c Δ / ρ)，c ≈ ρW + (o + 1 − ρ)s（不缓存时 c ≈ W + o·s），W = S + X，迭代求解
    const rho = uc ? RHO : 1, S = C0 + SUM;
    let W = 70000; for (let it = 0; it < 30; it++) { const c = rho * W + (PO + (uc ? 1 - rho : 0)) * SUM; W = S + Math.sqrt((2 * c * D) / rho); }
    sweep = { pts, best, wf: W };
  }
  function recompute(resweep) {
    const n = nS.value, D = dS.value, T = tS.value, uc = cache.checked;
    STR.forEach((s) => { R[s.k] = sim(s.k, n, D, T, uc); });
    R.inf = sim('none', n, D, T, uc, true);
    if (resweep || !sweep) computeSweep();
    redraw();
  }
  const dollars = (u) => '$' + (u * 3e-6).toFixed(u * 3e-6 < 10 ? 2 : 1);
  const v1 = A.canvas(cv1, { aspect: 0.62 }, (ctx, W, H) => {
    const isCost = view.value === 'cost', n = nS.value;
    const box = { x: 54, y: 28, w: W - 70, h: H - 62 };
    const ymax = isCost ? Math.max(R.inf.cost, ...STR.map((s) => R[s.k].cost)) * 1.08 : Math.max(WIN * 1.12, R.inf.size[R.inf.size.length - 1] * 1.04);
    const ax = A.axes(ctx, box, { xmin: 0, xmax: n, ymin: 0, ymax, yfmt: (v) => A.human(v, 0), xlabel: '第几步', ylabel: isCost ? '累计成本（相对单位）' : '这一步送进模型的上下文（token）', ylabelOffset: 48 });
    const cs = cols();
    if (!isCost) {
      const line = (v, color, dash, label) => { const y = Math.round(ax.Y(v)) + 0.5; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.restore(); A.text(ctx, label, box.x + box.w - 4, y - 8, { size: 11, align: 'right', color }); };
      line(WIN, A.css('--bad'), [], '窗口 200K');
      line(tS.value, A.css('--muted'), [4, 4], '触发阈值 ' + Math.round(tS.value / 1000) + 'K');
    }
    if (R.none.fail) { // 假如窗口无限大：把“不管理”的曲线接着画下去
      const arr = isCost ? R.inf.cum : R.inf.size, i0 = R.none.size.length - 1;
      ctx.save(); ctx.strokeStyle = A.css('--muted'); ctx.lineWidth = 1.4; ctx.setLineDash([2, 4]); ctx.beginPath();
      for (let i = i0; i < arr.length; i++) { const x = ax.X(i + 1), y = ax.Y(arr[i]); i > i0 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
      const xe = ax.X(arr.length), ye = ax.Y(arr[arr.length - 1]);
      A.text(ctx, '假如窗口无限大', xe - 4, ye + 12, { size: 11, align: 'right', color: A.css('--muted') });
    }
    STR.forEach((s) => {
      const arr = isCost ? R[s.k].cum : R[s.k].size;
      ctx.save(); ctx.strokeStyle = cs[s.c]; ctx.lineWidth = s.k === 'compact' ? 2.6 : 2.2; ctx.setLineDash(s.dash); ctx.beginPath();
      arr.forEach((v, i) => { const x = ax.X(i + 1), y = ax.Y(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke(); ctx.restore();
      if (R[s.k].fail && arr.length) {
        const x = ax.X(arr.length), y = ax.Y(arr[arr.length - 1]);
        ctx.save(); ctx.strokeStyle = A.css('--bad'); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); ctx.restore();
        const lft = x - box.x > 130;
        A.text(ctx, `第 ${R[s.k].fail} 步超出窗口`, lft ? x - 8 : x + 8, lft ? y - 12 : y + 14, { size: 11.5, weight: 650, color: A.css('--bad'), align: lft ? 'right' : 'left' });
      }
    });
    if (hover != null && hover >= 1 && hover <= n) {
      const x = Math.round(ax.X(hover)) + 0.5;
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
    }
    v1._ax = ax; v1._box = box;
  });
  const v2 = A.canvas(cv2, { aspect: 0.95 }, (ctx, W, H) => {
    if (!sweep) return;
    const box = { x: 52, y: 40, w: W - 64, h: H - 78 };
    const ys = sweep.pts.map((p) => p[1]);
    const ax = A.axes(ctx, box, { xmin: 30000, xmax: 190000, ymin: 0, ymax: Math.max(...ys) * 1.1, xticks: [30000, 70000, 110000, 150000, 190000], xfmt: (v) => Math.round(v / 1000) + 'K', yfmt: (v) => A.human(v, 0), xlabel: '压缩触发阈值', ylabel: '每步平均成本', ylabelOffset: 46 });
    const cs = cols();
    A.text(ctx, '什么时候压缩最省', box.x - 46, 12, { size: 12.5, weight: 650 });
    const xf = ax.X(A.clamp(sweep.wf, 30000, 190000));
    ctx.save(); ctx.strokeStyle = cs[3]; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xf, box.y); ctx.lineTo(xf, box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, '公式预测 ' + Math.round(sweep.wf / 1000) + 'K', xf + 5, box.y + 8, { size: 11, color: cs[3] });
    ctx.save(); ctx.strokeStyle = cs[0]; ctx.lineWidth = 2.4; ctx.beginPath();
    sweep.pts.forEach((p, i) => { const x = ax.X(p[0]), y = ax.Y(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.restore();
    const b = sweep.best;
    ctx.fillStyle = cs[0]; ctx.beginPath(); ctx.arc(ax.X(b[0]), ax.Y(b[1]), 5, 0, 7); ctx.fill();
    A.text(ctx, '模拟最优 ' + Math.round(b[0] / 1000) + 'K', ax.X(b[0]), ax.Y(b[1]) + 16, { size: 11.5, weight: 650, color: cs[0], align: 'center' });
    const cur = sweep.pts.find((p) => p[0] === tS.value) || sweep.pts[0];
    ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax.X(cur[0]), ax.Y(cur[1]), 6.5, 0, 7); ctx.stroke();
  });
  cv1.addEventListener('mousemove', (e) => {
    if (!v1._ax) return;
    const p = A.pos(cv1, e), n = nS.value, i = Math.round(v1._ax.invX(p.x));
    if (i < 1 || i > n) { hover = null; A.tip.hide(); v1.redraw(); return; }
    hover = i; v1.redraw();
    const cs = cols();
    A.tip.show(`<b>第 ${i} 步</b><br>` + STR.map((s) => { const r = R[s.k]; if (i > r.size.length) return `<span style="color:${cs[s.c]}">●</span> ${s.n}：已在第 ${r.fail} 步溢出`; return `<span style="color:${cs[s.c]}">●</span> ${s.n}：上下文 ${A.human(r.size[i - 1])}，累计 ${A.human(r.cum[i - 1])}`; }).join('<br>'), e.clientX, e.clientY);
  });
  cv1.addEventListener('mouseleave', () => { hover = null; A.tip.hide(); v1.redraw(); });

  function redraw() {
    v1.redraw(); v2.redraw();
    const n = nS.value;
    stats.innerHTML = '';
    STR.forEach((s) => {
      const r = R[s.k];
      const v = r.fail ? `<span style="color:var(--bad)">第 ${r.fail} 步失败</span> <small>窗口无限时要 ${A.human(R.inf.cost)}</small>` : `${A.human(r.cost)} <small>≈ ${dollars(r.cost)}</small>`;
      const sub = s.k === 'none' ? `${r.calls} 次调用` : `${r.calls} 次调用 · ${s.k === 'clear' ? '清理' : '压缩'} ${r.ops} 次`;
      stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, s.n + '：' + sub), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v })));
    });
    const b = sweep.best, cur = sweep.pts.find((p) => p[0] === tS.value) || sweep.pts[0];
    stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, '压缩：当前阈值比最优贵'), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: `${A.pct(cur[1] / b[1] - 1, 0)} <small>最优约 ${Math.round(b[0] / 1000)}K</small>` })));
    const nf = R.none.fail;
    const msgs = [];
    msgs.push(nf ? `不管理时，上下文每步涨 ${A.human(dS.value)}，第 ${nf} 步超过 200K 窗口，任务直接失败。假如窗口无限大（灰色点线），累计成本是一条向上弯的抛物线，${n} 步要 ${A.human(R.inf.cost)}，是摘要压缩的 ${(R.inf.cost / R.compact.cost).toFixed(1)} 倍。` : `${n} 步之内不管理也装得下，但累计成本是一条向上弯的抛物线：步数翻倍，成本约变成四倍。`);
    msgs.push('清理和压缩都把上下文限制在阈值以下（切到“每次调用的上下文”看锯齿），累计成本变成直线。');
    msgs.push(cache.checked ? `右图：开着缓存时，最省的触发点约在 ${Math.round(b[0] / 1000)}K。太早压缩，摘要要反复写、新前缀要反复全价处理；太晚，每步都在读一大段（虽然打了折的）旧内容。最优点附近很平，阈值差一倍，成本只差百分之几。` : `关掉缓存后，最省的触发点提前到约 ${Math.round(b[0] / 1000)}K：每个旧 token 都按全价重读，攒着不压缩的代价变大了。这就是推导里的 \\(X^* = \\sqrt{2c\\Delta/\\rho}\\)：\\(\\rho\\) 从 0.1 变成 1，压缩间隔缩到约三分之一。`);
    msgs.push('成本不是唯一的考虑：每压缩一次就丢一些细节，实际系统通常比成本最优点压缩得更晚。');
    hint.innerHTML = msgs.join('');
    A.renderMath(hint);
  }
  recompute(true);
});
