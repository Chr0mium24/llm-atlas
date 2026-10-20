/* evaluation-paired — the same 40 simulated benchmark runs analysed two ways: unpaired vs paired 95% intervals for "A − B"; power and the number of questions needed to tell a small gap */
A.defineDemo('evaluation-paired', function (mount) {
  const { bd } = A.demo(mount, '两个模型真实差 2 个点：要多少道题才分得清', '玩具模型：A、B 的真实准确率在 75% 上下，逐题对错的相关为 ρ；模拟 40 次评测，每次从题目总体里抽一份新题。数字都是实际抽样算出的');
  let n = 500, delta = 2, rho = 0.6, paired = true, seed = 2;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const nice = (x) => { const q = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 1)); return Math.round(x / q) * q; }; // 498 → 500, 2941 → 2900
  A.slider(ctl, { label: '每次评测的题目数 n', min: 30, max: 10000, log: true, value: n, fmt: (v) => nice(v) + ' 道', on: (v) => { n = nice(v); draw(); }, width: 210 });
  A.slider(ctl, { label: '真实差距 δ', min: 0, max: 8, step: 0.5, value: delta, fmt: (v) => v.toFixed(1) + ' 个点', on: (v) => { delta = v; draw(); } });
  A.slider(ctl, { label: '两个模型逐题对错的相关 ρ', min: 0, max: 0.9, step: 0.05, value: rho, fmt: (v) => v.toFixed(2), on: (v) => { rho = v; draw(); }, width: 190 });
  A.seg(ctl, [{ v: true, t: '配对分析' }, { v: false, t: '不配对分析' }], paired, (v) => { paired = v; draw(); }, '同一份数据，怎么算区间');
  ctl.append(A.el('button', { type: 'button', onclick: () => { seed++; draw(); } }, '重新模拟 40 次'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const cols = A.series();
  bd.append(A.el('div', { class: 'legend', html: `<span><i style="background:${cols[0]}"></i>区间整个在 0 右边：这次评测能断言 A 更好</span><span><i style="background:${A.css('--axis')}"></i>区间包含 0：分不清</span><span><i style="background:${cols[3]}"></i>区间在 0 左边：结论判反了</span><span><i class="line" style="background:${cols[1]}"></i>真实差距</span>` }));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const R = 40;
  // standard normal CDF (Abramowitz–Stegun 26.2.17)
  const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
  function joint() {
    const pA = 0.75 + delta / 200, pB = 0.75 - delta / 200;
    const sA = Math.sqrt(pA * (1 - pA)), sB = Math.sqrt(pB * (1 - pB));
    const p11 = A.clamp(pA * pB + rho * sA * sB, Math.max(0, pA + pB - 1), Math.min(pA, pB));
    return { pA, pB, p11, p10: pA - p11, p01: pB - p11, vA: sA * sA, vB: sB * sB, cov: p11 - pA * pB };
  }
  // one benchmark run: n questions, each lands in one cell of the 2x2 table (both right / A only / B only / both wrong)
  function run(k, J) {
    const r = A.rng(seed * 1000 + k);
    let a = 0, b = 0, c = 0;
    const t1 = J.p11, t2 = J.p11 + J.p10, t3 = J.p11 + J.p10 + J.p01;
    for (let i = 0; i < n; i++) { const u = r(); if (u < t1) a++; else if (u < t2) b++; else if (u < t3) c++; }
    const pa = (a + b) / n, pb = (a + c) / n, diff = (b - c) / n;
    const seu = Math.sqrt((pa * (1 - pa) + pb * (1 - pb)) / n);
    const sep = Math.sqrt(Math.max((b + c) / n - diff * diff, 1e-9) / n);
    return { a, b, c, pa, pb, diff, seu, sep };
  }
  let runs = [], J = null, ax = null, box = null, xr = [0, 1];
  const view = A.canvas(cv, { aspect: 0.56 }, (ctx, W, H) => {
    box = { x: 20, y: 30, w: W - 40, h: H - 66 };
    ax = A.axes(ctx, box, { xmin: xr[0], xmax: xr[1], ymin: 0, ymax: R, yticks: [], xfmt: (v) => (v > 0 ? '+' : '') + (+v.toFixed(1)) + ' 点', xlabel: '观测到的 A − B（百分点）' });
    const x0 = ax.X(0), xd = ax.X(delta);
    ctx.save(); ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, box.y - 6); ctx.lineTo(x0, box.y + box.h); ctx.stroke(); ctx.restore();
    A.text(ctx, '0：没有差别', x0 - 4, box.y - 14, { size: 11.5, align: 'right', color: A.css('--ink-2') });
    if (delta > 0) {
      ctx.save(); ctx.strokeStyle = cols[1]; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(xd, box.y - 6); ctx.lineTo(xd, box.y + box.h); ctx.stroke(); ctx.restore();
      A.text(ctx, '真实差距 +' + delta.toFixed(1), xd + 4, box.y - 14, { size: 11.5, color: cols[1], weight: 600 });
    }
    const rowH = box.h / R;
    runs.forEach((o, k) => {
      const se = paired ? o.sep : o.seu, lo = (o.diff - 1.96 * se) * 100, hi = (o.diff + 1.96 * se) * 100;
      const col = lo > 0 ? cols[0] : hi < 0 ? cols[3] : A.css('--axis');
      const y = box.y + rowH * (k + 0.5);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, Math.min(3, rowH * 0.45)); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax.X(Math.max(lo, xr[0])), y); ctx.lineTo(ax.X(Math.min(hi, xr[1])), y); ctx.stroke();
      ctx.fillStyle = lo > 0 || hi < 0 ? col : A.css('--ink-2'); ctx.beginPath(); ctx.arc(ax.X(o.diff * 100), y, Math.max(2, Math.min(3.5, rowH * 0.4)), 0, 7); ctx.fill();
    });
  });
  cv.addEventListener('mousemove', (e) => {
    if (!box || !runs.length) return;
    const p = A.pos(cv, e), k = Math.floor((p.y - box.y) / (box.h / R));
    if (k < 0 || k >= R || p.x < box.x || p.x > box.x + box.w) { A.tip.hide(); return; }
    const o = runs[k], f = (x) => (x > 0 ? '+' : '') + (x * 100).toFixed(1);
    A.tip.show(`<b>第 ${k + 1} 次评测</b>（${n} 道题）<br>A ${A.pct(o.pa, 1)}，B ${A.pct(o.pb, 1)}<br>两个都对 ${o.a}，A 对 B 错 ${o.b}，B 对 A 错 ${o.c}，两个都错 ${n - o.a - o.b - o.c}<br>差 = (${o.b} − ${o.c}) / ${n} = ${f(o.diff)} 点<br>配对区间 [${f(o.diff - 1.96 * o.sep)}, ${f(o.diff + 1.96 * o.sep)}]<br>不配对区间 [${f(o.diff - 1.96 * o.seu)}, ${f(o.diff + 1.96 * o.seu)}]`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    J = joint();
    runs = []; for (let k = 0; k < R; k++) runs.push(run(k, J));
    const sp = Math.sqrt(J.vA + J.vB - 2 * J.cov), su = Math.sqrt(J.vA + J.vB), d = delta / 100, rn = Math.sqrt(n);
    const SEp = sp / rn * 100, SEu = su / rn * 100;
    const half = 1.96 * (paired ? SEu * 0.9 : SEu) + 2.6 * SEp;
    xr = [Math.min(-0.6, delta - half), Math.max(delta + half, 0.6)];
    const powP = Phi(d * rn / sp - 1.96), powU = Phi((d * rn - 1.96 * su) / sp);
    const n80P = d > 0 ? Math.pow(2.8 * sp / d, 2) : Infinity, n80U = d > 0 ? Math.pow((1.96 * su + 0.84 * sp) / d, 2) : Infinity;
    const det = runs.filter((o) => o.diff - 1.96 * (paired ? o.sep : o.seu) > 0).length;
    const wrong = runs.filter((o) => o.diff + 1.96 * (paired ? o.sep : o.seu) < 0).length;
    const fmtN = (x) => (!isFinite(x) ? '—' : x >= 1e5 ? '约 ' + (x / 1e4).toFixed(0) + ' 万道' : x >= 1e4 ? '约 ' + (x / 1e4).toFixed(1) + ' 万道' : '约 ' + Math.round(x / 10) * 10 + ' 道');
    stats.innerHTML = '';
    [['单次评测“A − B”的标准误', `配对 ${SEp.toFixed(1)} 点 · 不配对 ${SEu.toFixed(1)} 点`],
      ['这 40 次里分辨出 A 更好', det + ' 次' + (wrong ? `（另有 ${wrong} 次判反）` : '')],
      ['理论功效：配对 / 不配对', A.pct(powP, 0) + ' / ' + A.pct(powU, 0)],
      ['80% 功效需要的题数：配对 / 不配对', fmtN(n80P) + ' / ' + fmtN(n80U)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    let msg;
    if (delta === 0) msg = '真实差距为 0 时，仍会有少数几次评测“显著”：5% 的显著性水平意味着每 40 次里平均有 1 次误报（区间一半落在左边、一半落在右边）。只挑显著的那次去报告，就是在把运气当成进步。';
    else if (rho === 0) msg = '相关 ρ = 0 时，两个模型的对错互不相干，配对与不配对算出的区间几乎一样宽：配对分析的好处全部来自两个模型“一起对、一起错”。真实评测里 ρ 通常在 0.5 左右，同一家族的两个版本更高。';
    else if (paired) msg = `每条横线是一次评测得到的“A − B”的 95% 区间，点是观测到的差。${n} 道题、真实差 ${delta.toFixed(1)} 个点时，配对分析的标准误约 ${SEp.toFixed(1)} 个点，40 次里有 ${det} 次能断言 A 更好。切到“不配对分析”：点的位置一点不变（同一份数据），区间却变宽了：它把两个模型当作在两份独立的题上考试，没有扣掉两者一起涨落的那部分。${powP < 0.8 && isFinite(n80P) ? '要有 80% 的把握，配对分析需要' + fmtN(n80P) + '。' : '题目足够多，配对分析大多数时候都能分辨出来。'}`;
    else msg = `不配对的区间（宽 ±${(1.96 * SEu).toFixed(1)} 点）明显比这些点实际散开的范围更宽：点的波动由配对标准误 ${SEp.toFixed(1)} 决定，区间却按 ${SEu.toFixed(1)} 来画。结果是过于保守，40 次里只有 ${det} 次能分辨出来。用在同一份题上时，不配对分析既浪费数据，又没有任何好处。`;
    hint.innerHTML = msg;
    view.redraw();
  }
  draw();
});
