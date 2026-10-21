/* scaling-repeat — data-constrained scaling (Muennighoff et al. 2023, eq. 17): with only U unique tokens, extra compute buys less and less; optimal allocation shifts to more epochs */
A.defineDemo('scaling-repeat', function (mount) {
  const { bd } = A.demo(mount, '数据不够时：加算力还能换来多少', 'Muennighoff 等（2023）在 C4 上拟合的数据受限规模定律：重复的数据、超出数据所需的参数，价值都按指数衰减');
  const E = 1.87, A_ = 521, B = 1488, al = 0.35, be = 0.35, RN = 5.3, RD = 15.4, UNR = 0.051;
  function loss(N, D, U) {
    const UD = Math.min(U, D), rD = D / UD - 1, Dp = UD + UD * RD * (1 - Math.exp(-rD / RD));
    const UN = Math.min(UD * UNR, N), rN = Math.max(N / UN - 1, 0), Np = UN + UN * RN * (1 - Math.exp(-rN / RN));
    return { l: E + A_ / Math.pow(Np, al) + B / Math.pow(Dp, be), Dp, Np, ep: D / UD };
  }
  // minimise over log10 N: coarse grid, then refine
  function best(C, U) {
    let b = null;
    const tryN = (e) => { const N = Math.pow(10, e), D = C / (6 * N); if (D < 1e6) return; const r = loss(N, D, U); if (!b || r.l < b.l - 1e-9) b = { N, D, e, ...r }; };
    for (let e = 5; e <= 13.5; e += 0.05) tryN(e);
    const e0 = b.e; for (let e = e0 - 0.06; e <= e0 + 0.06; e += 0.004) tryN(e);
    return b;
  }
  let U = 1e11, C = 1e24;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '手里不重复的数据 U', min: 1e9, max: 1e14, log: true, value: U, fmt: (v) => A.human(v, 1) + ' token', on: (v) => { U = v; draw(); }, width: 230 });
  A.slider(ctl, { label: '训练算力 C', min: 1e19, max: 1e26, log: true, value: C, fmt: (v) => A.sci(v) + ' FLOPs', on: (v) => { C = v; draw(); }, width: 230 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const CS = []; for (let i = 0; i <= 84; i++) CS.push(Math.pow(10, 19 + 7 * i / 84));
  let curveC = [], curveInf = [], marks = [], cur = null, curInf = null;
  function compute() {
    curveC = CS.map((c) => best(c, U)); curveInf = CS.map((c) => best(c, 1e30));
    marks = [];
    [4, 16, 40].forEach((ep) => { for (let i = 1; i < CS.length; i++) if (curveC[i - 1].ep < ep && curveC[i].ep >= ep) { marks.push({ ep, C: CS[i], l: curveC[i].l }); break; } });
    cur = best(C, U); curInf = best(C, 1e30);
  }
  const YMIN = 1.9, YMAX = 3.2;
  let AX = null;
  const view = A.canvas(cv, { get aspect() { return cv.clientWidth < 560 ? 0.85 : 0.5; } }, (ctx, W, H) => {
    const box = { x: 54, y: 24, w: W - 74, h: H - 62 };
    const ax = AX = A.axes(ctx, box, { xmin: 1e19, xmax: 1e26, xlog: true, ymin: YMIN, ymax: YMAX, yfmt: (v) => v.toFixed(1), xfmt: (v) => '10' + String(Math.round(Math.log10(v))).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]), xlabel: '训练算力 C（FLOPs，对数坐标）', ylabel: '最优分配下的损失', ylabelOffset: 46, xgrid: true });
    const cy = (v) => ax.Y(A.clamp(v, YMIN, YMAX));
    const path = (arr, color, w, dash) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); arr.forEach((b, i) => { const x = ax.X(CS[i]), y = cy(b.l); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore(); };
    path(curveInf, cols[1], 2, [6, 4]);
    path(curveC, cols[0], 3);
    marks.forEach((m) => {
      const x = ax.X(m.C), y = cy(m.l);
      ctx.fillStyle = A.css('--surface'); ctx.strokeStyle = cols[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke();
      A.text(ctx, m.ep + ' 遍', x + 7, y - 10, { size: 11.5, color: A.css('--ink-2'), weight: 600 });
    });
    const xu = ax.X(C);
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xu, box.y); ctx.lineTo(xu, box.y + box.h); ctx.stroke(); ctx.restore();
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(xu, cy(curInf.l), 5, 0, 7); ctx.fill();
    ctx.fillStyle = cols[0]; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xu, cy(cur.l), 7, 0, 7); ctx.fill(); ctx.stroke();
    // the C at which the unique data is used exactly once at the unlimited optimum
    for (let i = 1; i < CS.length; i++) if (curveInf[i].D >= U) {
      const x = ax.X(CS[i]);
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore();
      A.text(ctx, '数据只够用一遍 ｜ 此后要重复 →', x, box.y + box.h - 10, { size: 11, color: A.css('--muted'), align: 'center' });
      break;
    }
  });
  cv.addEventListener('mousemove', (e) => {
    if (!AX) return; const p = A.pos(cv, e); const c = AX.invX(p.x); if (c < 1e19 || c > 1e26) { A.tip.hide(); return; }
    const b = best(c, U), bi = best(c, 1e30);
    A.tip.show(`C = ${A.sci(c)}：最优 ${A.human(b.N, 1)} 参数、${b.ep < 1.05 ? '1 遍' : b.ep.toFixed(1) + ' 遍'}，损失 ${b.l.toFixed(3)}<br>数据不限时：${A.human(bi.N, 1)} 参数，损失 ${bi.l.toFixed(3)}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    compute();
    const more = best(C * 10, U), gain = cur.l - more.l, gainInf = curInf.l - best(C * 10, 1e30).l;
    const sat = gain < 0.002;
    stats.innerHTML = '';
    [['最优参数量', (sat ? '—（已饱和，任意）' : A.human(cur.N, 1)) + '（数据不限：' + A.human(curInf.N, 1) + '）'], ['训练遍数', cur.ep < 1.05 ? '1 遍' : (sat ? '—（已饱和）' : cur.ep.toFixed(1) + ' 遍')],
      ['每个训练 token 平均相当于', sat ? '—' : (cur.Dp / cur.D).toFixed(2) + ' 个新 token'], ['比“数据不限”高出的损失', '+' + (cur.l - curInf.l).toFixed(3)],
      ['再加 10 倍算力，损失还能降', gain.toFixed(3) + '（数据不限：' + gainInf.toFixed(3) + '）']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${cols[1]}"></i>不重复的数据要多少有多少</span><span><i class="line" style="background:${cols[0]}"></i>只有 ${A.human(U, 1)} token，不够就重复</span><span><i style="border:2px solid ${cols[0]};background:none;border-radius:50%"></i>最优分配达到 4 / 16 / 40 遍的位置</span>`;
    hint.innerHTML = '两条曲线在竖虚线（数据只够用一遍）之前重合；之后实线开始离开虚线，但重复到约 4 遍时几乎看不出差别。到 16 遍附近，每多一遍的价值已降到新数据的约三分之一，曲线明显变平；40 遍以后，再加多少算力，损失都几乎不动。悬停可以看任意算力下的最优分配：它比 Chinchilla 的建议用更小的模型、更多的遍数，因为“多出来的参数”比“重复的数据”贬值更快（R<sub>N</sub>* ≈ 5.3 &lt; R<sub>D</sub>* ≈ 15.4）。';
    view.redraw();
  }
  draw();
});
