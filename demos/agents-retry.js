/* agents-retry — 检查并重试：同一组随机数下 40 次运行逐步对比；几何级数 P = p(1−q^{m+1})/(1−q)，半衰期 ln2/λ；可选“难度不均”看混合后衰减变慢（玩具模型） */
A.defineDemo('agents-retry', function (mount) {
  const { bd } = A.demo(mount, '检查并重试：40 次运行，一步一格', '玩具模型 · 左右两边用同一组随机数：左边从不检查，右边每一步都检查、发现错误就重做');
  const RUNS = 40, NMAX = 200, AMAX = 8;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const pS = A.slider(ctl, { label: '单步正确率 p', min: 0.9, max: 0.999, step: 0.001, value: 0.98, fmt: (v) => (v * 100).toFixed(1) + '%', on: () => draw(), width: 170 });
  const rS = A.slider(ctl, { label: '检查发现错误的概率 r', min: 0, max: 0.99, step: 0.01, value: 0.8, fmt: (v) => Math.round(v * 100) + '%', on: () => draw(), width: 170 });
  const nS = A.slider(ctl, { label: '任务步数 n', min: 10, max: NMAX, step: 5, value: 60, fmt: (v) => v + ' 步', on: () => draw(), width: 150 });
  const mSeg = A.seg(ctl, [{ v: 1, t: '1 次' }, { v: 2, t: '2 次' }, { v: AMAX - 1, t: '不限' }], 1, () => draw(), '每步最多重试');
  const box2 = A.el('div', { class: 'ctl', style: { minWidth: 'auto' } }); ctl.append(box2);
  const het = A.check(box2, '每次运行难度不同', false, () => draw());
  box2.append(A.el('button', { type: 'button', style: { marginTop: '6px' }, onclick: () => { seed = (seed * 7919 + 13) >>> 0; gen(); draw(); } }, '换一组随机数'));
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  legend.innerHTML = '<span><i style="background:var(--grid)"></i>第一次就做对</span><span><i style="background:var(--s2)"></i>做错了，被检查发现，重做后过关</span><span><i style="background:var(--bad)"></i>做错了没被发现（或重试用完），任务失败（格上有 ×）</span><span>每一行是一次运行，每一列是一步</span>';

  let seed = 7, U = null, Z = null;
  function gen() {
    const g = A.rng(seed);
    U = new Float32Array(RUNS * NMAX * AMAX * 2);
    for (let i = 0; i < U.length; i++) U[i] = g();
    Z = []; for (let k = 0; k < RUNS; k++) Z.push(A.gauss(g));
  }
  const u = (k, i, j, w) => U[((k * NMAX + i) * AMAX + j) * 2 + w];
  const SIG = 1.15;
  const epsOf = (k, p) => (het.checked ? Math.min(0.5, (1 - p) * Math.exp(SIG * Z[k])) : 1 - p);
  function runAll() {
    const p = pS.value, r = rS.value, n = nS.value, m = mSeg.value;
    const L = [], Rr = []; let okL = 0, okR = 0, att = 0, steps = 0;
    for (let k = 0; k < RUNS; k++) {
      const pk = 1 - epsOf(k, p);
      const a = new Int8Array(n).fill(-1); // -1 未到达, 0 一次对, 2 失败
      for (let i = 0; i < n; i++) { if (u(k, i, 0, 0) < pk) a[i] = 0; else { a[i] = 2; break; } }
      if (a[n - 1] === 0) okL++;
      const b = new Int8Array(n).fill(-1); // 0 一次对, 1 重做后对, 2 失败
      for (let i = 0; i < n; i++) {
        let j = 0, st = -1;
        for (;;) {
          att++;
          if (u(k, i, j, 0) < pk) { st = j ? 1 : 0; break; }
          if (u(k, i, j, 1) < r && j < m) { j++; continue; }
          st = 2; break;
        }
        steps++; b[i] = st;
        if (st === 2) break;
      }
      if (b[n - 1] === 0 || b[n - 1] === 1) okR++;
      L.push(a); Rr.push(b);
    }
    return { L, R: Rr, okL, okR, att: att / steps };
  }
  // 理论值
  function theory() {
    const p = pS.value, r = rS.value, n = nS.value, m = mSeg.value;
    const Pstep = (pp) => { const q = (1 - pp) * r; return pp * (1 - Math.pow(q, m + 1)) / (1 - q); };
    const q = (1 - p) * r;
    const out = { q, Pm: Pstep(p), E: (1 - Math.pow(q, m + 1)) / (1 - q) };
    out.L = Math.pow(p, n); out.R = Math.pow(out.Pm, n);
    out.halfL = Math.log(2) / -Math.log(p); out.halfR = Math.log(2) / -Math.log(out.Pm);
    if (het.checked) { // 对难度分布做数值积分（高斯求积的简单版：等概率分位点）
      let sL = 0, sR = 0, meanEps = 0; const M = 400;
      for (let i = 0; i < M; i++) {
        const z = invPhi((i + 0.5) / M), e = Math.min(0.5, (1 - p) * Math.exp(SIG * z)), pp = 1 - e;
        sL += Math.pow(pp, n); sR += Math.pow(Pstep(pp), n); meanEps += e;
      }
      out.mixL = sL / M; out.mixR = sR / M; out.meanEps = meanEps / M; out.expMeanL = Math.pow(1 - out.meanEps, n);
    }
    return out;
  }
  function invPhi(pr) { // Acklam 近似
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
    const pl = 0.02425;
    if (pr < pl) { const q = Math.sqrt(-2 * Math.log(pr)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (pr > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - pr)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = pr - 0.5, rr = q * q; return (((((a[0] * rr + a[1]) * rr + a[2]) * rr + a[3]) * rr + a[4]) * rr + a[5]) * q / (((((b[0] * rr + b[1]) * rr + b[2]) * rr + b[3]) * rr + b[4]) * rr + 1);
  }
  let S = null, hov = null;
  const ROWH = 6, TOP = 30;
  const view = A.canvas(cv, { height: TOP + RUNS * ROWH + 10 }, (ctx, W, H) => {
    if (!S) return;
    const n = nS.value, gap = 26, pw = (W - gap) / 2, cw = pw / n;
    const ok = A.css('--grid'), fix = A.css('--s2'), bad = A.css('--bad');
    const nar = pw < 230;
    [[S.L, 0, nar ? `不检查：${S.okL}/${RUNS} 成功` : `从不检查：${S.okL} / ${RUNS} 次成功`], [S.R, pw + gap, nar ? `检查+重试：${S.okR}/${RUNS} 成功` : `检查并重试：${S.okR} / ${RUNS} 次成功`]].forEach(([G, x0, title]) => {
      A.text(ctx, title, x0, 12, { size: nar ? 11.5 : 12.5, weight: 650 });
      G.forEach((row, k) => {
        const y = TOP + k * ROWH;
        for (let i = 0; i < n; i++) {
          const s = row[i]; if (s < 0) break;
          ctx.fillStyle = s === 0 ? ok : s === 1 ? fix : bad;
          ctx.fillRect(x0 + i * cw, y, Math.max(1, cw - (cw > 4 ? 1 : 0)), ROWH - 1);
          if (s === 2) { // 失败格加一个 ×，深色主题下和橙色格也分得开
            const cx = x0 + i * cw + Math.max(1, cw - 1) / 2, cy = y + (ROWH - 1) / 2, h = Math.max(2.5, Math.min(ROWH, Math.max(cw, 6)) / 2 - 1);
            ctx.save(); ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - h, cy - h); ctx.lineTo(cx + h, cy + h); ctx.moveTo(cx + h, cy - h); ctx.lineTo(cx - h, cy + h); ctx.stroke(); ctx.restore();
          }
        }
      });
    });
    if (hov) { ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1; ctx.strokeRect(hov.x0 - 0.5, TOP + hov.k * ROWH - 0.5, pw + 1, ROWH); }
    view._g = { pw, gap, cw, n };
  });
  cv.addEventListener('mousemove', (e) => {
    const g = view._g; if (!g || !S) return;
    const p = A.pos(cv, e), k = Math.floor((p.y - TOP) / ROWH);
    const side = p.x > g.pw + g.gap / 2 ? 1 : 0, x0 = side ? g.pw + g.gap : 0, i = Math.floor((p.x - x0) / g.cw);
    if (k < 0 || k >= RUNS || i < 0 || i >= g.n) { hov = null; A.tip.hide(); view.redraw(); return; }
    hov = { k, x0 }; view.redraw();
    const row = (side ? S.R : S.L)[k];
    let last = -1; for (let j = 0; j < g.n; j++) if (row[j] >= 0) last = j;
    const fixes = Array.from(row).filter((s) => s === 1).length;
    const st = row[i] < 0 ? '（这次运行在这之前已经失败）' : row[i] === 0 ? '第一次就做对' : row[i] === 1 ? '出错被发现，重做后过关' : '出错没被发现，任务失败';
    A.tip.show(`<b>第 ${k + 1} 次运行 · 第 ${i + 1} 步</b><br>${st}<br>这次运行：${row[g.n - 1] === 0 || row[g.n - 1] === 1 ? '成功' : '失败于第 ' + (last + 1) + ' 步'}${side ? `，重做 ${fixes} 次` : ''}${het.checked ? `<br>这次运行的单步错误率：${A.pct(epsOf(k, pS.value), 1)}` : ''}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => { hov = null; A.tip.hide(); view.redraw(); });

  function draw() {
    S = runAll();
    const T = theory(), n = nS.value, r = rS.value, p = pS.value;
    view.redraw();
    stats.innerHTML = '';
    const half = (h) => (h > 1e5 ? '10 万步以上' : Math.round(h) + ' 步');
    const items = [
      ['理论成功率：不检查 \\(p^n\\)', het.checked ? A.pct(T.mixL, 0) : A.pct(T.L, 0)],
      ['理论成功率：检查并重试 \\(P_{\\text{步}}^{\\,n}\\)', het.checked ? A.pct(T.mixR, 0) : A.pct(T.R, 0)],
      ['平均每步尝试次数', (S.att).toFixed(3) + ` <small>理论 ${T.E.toFixed(3)}</small>`],
      [het.checked ? '半衰期（按基准错误率算）' : '半衰期（成功率降到 50%）', `${half(T.halfL)} → ${half(T.halfR)}`],
    ];
    items.forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    A.renderMath(stats);
    let msg = `每一步以 ${A.pct(p, 1)} 的概率做对。左边没有检查，一步错就全盘失败，${n} 步全对的概率是 \\(p^n\\) = ${A.pct(T.L, 0)}${het.checked ? `（按基准错误率；难度不同时混合后的理论值是 ${A.pct(T.mixL, 0)}）` : ''}。右边每一步都检查：做错时以 ${Math.round(r * 100)}% 的概率被发现（橙色格），重做一次通常就过了；只有“错了且没被发现”（红色带 × 的格）才致命。每步的致命错误率从 ${A.pct(1 - p, 1)} 降到 ${A.pct(1 - T.Pm, 2)}，半衰期从 ${half(T.halfL)} 变成 ${half(T.halfR)}。橙色格很少：平均每步只多花 ${((T.E - 1) * 100).toFixed(1)}% 的尝试，真正的成本是每一步都要跑一次检查。`;
    if (mSeg.value === 1 && r > 0.3) msg += ' 把重试上限改成“不限”，成功率几乎不变：错误连续出现两次的概率是 \\(q^2\\)，已经很小。';
    if (het.checked) msg += ` 打开“难度不同”后，每次运行的错误率按对数正态分布随机，约三分之二的运行落在基准的 1/3 到 3 倍之间。左边看得最清楚：有的运行一路走到底，有的很快就断。这一组的平均错误率是 ${A.pct(T.meanEps, 1)}，如果所有运行都按这个平均值算，${n} 步只剩 ${A.pct(T.expMeanL, 0)}；按混合实际算是 ${A.pct(T.mixL, 0)}。难度不均时，整体衰减比任何单一的指数都慢。`;
    hint.innerHTML = msg;
    A.renderMath(hint);
  }
  gen(); draw();
});
