/* hardware-systolic — a 3×3 weight-stationary systolic array computing Y = X·W cycle by cycle: inputs flow right, partial sums flow down; utilization M/(M+2N−2) */
A.defineDemo('hardware-systolic', function (mount) {
  const { bd } = A.demo(mount, '脉动阵列：一拍一拍算 Y = X·W', '3×3 的权重驻留阵列（玩具）；蓝色数字是流过的输入，橙色是向下流的部分和；所有数字都是实际算出的');
  const N = 3;
  const W = [[1, 2, 1], [0, 1, 2], [2, 1, 0]];
  const XALL = [[1, 2, 0], [3, 1, 2], [0, 1, 1], [2, 0, 3], [1, 1, 1], [0, 3, 1], [2, 2, 0], [1, 0, 2], [3, 0, 1], [0, 2, 2], [1, 3, 0], [2, 1, 1]];
  let M = 6, k = 0, timer = null, S = null;

  // simulate: S.cyc[t][i][j] = {r, x, pin, pout} or null; S.out[t] = list of {r, j, v}
  function simulate() {
    const X = XALL.slice(0, M), T = M + 2 * N - 2;
    const cyc = [], out = [];
    let prev = null;
    for (let t = 0; t < T; t++) {
      const g = [], o = [];
      for (let i = 0; i < N; i++) {
        g.push([]);
        for (let j = 0; j < N; j++) {
          const r = t - i - j;
          if (r < 0 || r >= M) { g[i].push(null); continue; }
          const pin = i === 0 ? 0 : prev[i - 1][j].pout;
          const c = { r, x: X[r][i], w: W[i][j], pin, pout: pin + X[r][i] * W[i][j] };
          g[i].push(c);
          if (i === N - 1) o.push({ r, j, v: c.pout });
        }
      }
      cyc.push(g); out.push(o); prev = g;
    }
    const Y = X.map((row) => W[0].map((_, j) => A.sum(row.map((x, i) => x * W[i][j]))));
    S = { X, T, cyc, out, Y };
  }

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 1, t: 'M = 1（单用户解码）' }, { v: 3, t: 'M = 3' }, { v: 6, t: 'M = 6' }, { v: 12, t: 'M = 12' }], M, (v) => { M = v; stop(); simulate(); go(0); }, '一次流过阵列的 token 数 M');
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一拍');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一拍 →');
  const play = A.el('button', { onclick: () => { if (timer) { stop(); return; } if (k >= S.T) go(0); timer = setInterval(() => (k < S.T ? go(k + 1) : stop()), 1300); play.textContent = '暂停'; } }, '自动播放');
  const stop = () => { if (timer) clearInterval(timer); timer = null; play.textContent = '自动播放'; };
  bar.append(prev, next, play);
  const slider = A.el('input', { type: 'range', min: 0, max: 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => { stop(); go(+slider.value); };
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const stats = A.el('div', { class: 'stats' });
  const cv = A.el('canvas', { class: 'cv' });
  bd.append(bar, slider, fx, say, stats, cv);
  const cols = A.series();

  // state after cycle t = k − 1 (k = 0: nothing has entered yet)
  const tNow = () => k - 1;
  function macsDone() { let s = 0; for (let t = 0; t <= tNow(); t++) S.cyc[t].forEach((row) => row.forEach((c) => { if (c) s++; })); return s; }
  function outputsSoFar() { const m = {}; for (let t = 0; t <= tNow(); t++) S.out[t].forEach((o) => { m[o.r + ',' + o.j] = { v: o.v, t }; }); return m; }

  const view = A.canvas(cv, { aspect: 0.34 }, (ctx, Wd, Hd) => {
    if (!S) return;
    const t = tNow(), g = t >= 0 ? S.cyc[t] : null;
    const c = Math.min(64, (Wd - 24) / 10.2), slot = c * 0.6, QMAX = 5;
    const gx = 12 + (QMAX + 1) * slot + c * 0.5, gy = 34;
    const muted = A.css('--muted'), ink = A.css('--ink'), grid = A.css('--grid');
    A.text(ctx, '等待进入的输入（每行晚一拍，斜着排）', 12, 14, { size: 11.5, color: muted });
    A.text(ctx, '阵列：每格存一个权重 w', gx, 14, { size: 11.5, color: muted });
    // queue: element X[r][i] enters at cycle r + i; shown (r + i − t) slots left of the array
    for (let i = 0; i < N; i++) {
      const cy = gy + i * c + c / 2;
      let hidden = 0, pending = 0;
      for (let r = 0; r < M; r++) if (r + i - t >= 1) pending++;
      const shown = pending > QMAX ? QMAX - 1 : QMAX; // leave the leftmost slot for the "…还有" label
      for (let r = 0; r < M; r++) {
        const d = r + i - t;
        if (d < 1) continue;
        if (d > shown) { hidden++; continue; }
        const x = gx - c * 0.25 - d * slot;
        ctx.fillStyle = A.alpha(cols[0], 0.12); ctx.strokeStyle = A.alpha(cols[0], 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x - slot * 0.42, cy - slot * 0.42, slot * 0.84, slot * 0.84, 4); ctx.fill(); ctx.stroke();
        A.text(ctx, String(S.X[r][i]), x, cy, { size: Math.max(10, slot * 0.42), align: 'center', mono: true, color: cols[0], weight: 600 });
      }
      if (hidden) A.text(ctx, '…还有 ' + hidden, gx - c * 0.25 - QMAX * slot, cy, { size: 10.5, color: muted, align: 'center' });
    }
    // cells
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = gx + j * c, y = gy + i * c, cell = g && g[i][j];
      ctx.fillStyle = cell ? A.alpha(cols[3], 0.16) : A.alpha(ink, 0.04);
      ctx.strokeStyle = cell ? cols[3] : grid; ctx.lineWidth = cell ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(x + 3, y + 3, c - 6, c - 6, 6); ctx.fill(); ctx.stroke();
      A.text(ctx, 'w=' + W[i][j], x + 7, y + 12, { size: Math.max(9, c * 0.17), color: muted, mono: true });
      if (cell) {
        A.text(ctx, String(cell.x), x + c * 0.3, y + c * 0.6, { size: Math.max(11, c * 0.26), align: 'center', color: cols[0], weight: 700, mono: true });
        A.text(ctx, String(cell.pout), x + c * 0.72, y + c * 0.6, { size: Math.max(11, c * 0.26), align: 'center', color: cols[1], weight: 700, mono: true });
      }
      if (j < N - 1) A.arrow(ctx, x + c - 4, y + c * 0.82, x + c + 6, y + c * 0.82, A.alpha(cols[0], 0.6), 1.3, 5);
      if (i < N - 1) A.arrow(ctx, x + c * 0.88, y + c - 4, x + c * 0.88, y + c + 6, A.alpha(cols[1], 0.6), 1.3, 5);
    }
    // column outputs leaving the bottom this cycle
    const outY = gy + N * c + 14;
    A.text(ctx, '本拍从底部送出：', gx, outY, { size: 11.5, color: muted });
    if (t >= 0) S.out[t].forEach((o) => {
      const ox = gx + o.j * c + c / 2, fs = Math.max(10, c * 0.19);
      A.text(ctx, 'y' + (o.r + 1) + ',' + (o.j + 1), ox, outY + 17, { size: fs, align: 'center', color: cols[1], weight: 600, mono: true });
      A.text(ctx, '= ' + o.v, ox, outY + 17 + fs + 3, { size: fs, align: 'center', color: cols[1], weight: 600, mono: true });
    });
    // Y matrix
    const yx = gx + N * c + c * 0.9, ych = Math.min(c * 0.62, (Hd - gy - 10) / M), ycw = c * 0.7;
    A.text(ctx, '输出 Y（' + M + '×3）', yx, 14, { size: 11.5, color: muted });
    const done = outputsSoFar();
    for (let r = 0; r < M; r++) for (let j = 0; j < N; j++) {
      const x = yx + j * ycw, y = gy + r * ych, d = done[r + ',' + j];
      ctx.fillStyle = d ? A.alpha(cols[1], d.t === t ? 0.45 : 0.16) : A.alpha(ink, 0.04);
      ctx.fillRect(x + 1, y + 1, ycw - 2, ych - 2);
      if (d && ych >= 11) A.text(ctx, String(d.v), x + ycw / 2, y + ych / 2, { size: Math.min(13, ych * 0.7), align: 'center', mono: true });
    }
  });

  function render() {
    const t = tNow(), T = S.T;
    prev.disabled = k === 0; next.disabled = k === T;
    slider.max = T; slider.value = k;
    const g = t >= 0 ? S.cyc[t] : null;
    let active = 0; if (g) g.forEach((row) => row.forEach((c) => { if (c) active++; }));
    const macs = macsDone(), util = t >= 0 ? macs / (N * N * (t + 1)) : 0;
    let tex, msg;
    if (k === 0) {
      tex = String.raw`\begin{gathered} y_{rj} = \sum_{i=1}^{3} x_{ri}\,w_{ij} \\ \text{单元 }(i,j)\text{ 在第 } t = r + i + j \text{ 拍处理第 } r \text{ 个 token} \end{gathered}`;
      msg = `<b>第 0 拍 · 准备。</b>权重已经装进阵列（每格左上角的 w）。左边排队的是 ${M} 个 token 的输入，第 \\(i\\) 行比上一行晚一拍进入，这样同一个 token 的各个分量，才能和它的部分和在正确的格子相遇。`;
    } else {
      // focus: an output-producing cell if any, else the deepest active cell
      let f = null;
      if (S.out[t].length) { const o = S.out[t][0]; f = { i: N - 1, j: o.j, c: g[N - 1][o.j] }; }
      else { for (let i = N - 1; i >= 0 && !f; i--) for (let j = 0; j < N && !f; j++) if (g[i][j]) f = { i, j, c: g[i][j] }; }
      const c = f.c;
      tex = String.raw`\text{单元 }(${f.i + 1},${f.j + 1})\text{，token }${c.r + 1}:\quad ${c.pin} + ${c.x}\times${c.w} = ${c.pout}` + (f.i === N - 1 ? String.raw`\ \Rightarrow\ y_{${c.r + 1},${f.j + 1}} = ${c.pout}` : '');
      let pa = 0; if (t > 0) S.cyc[t - 1].forEach((row) => row.forEach((x) => { if (x) pa++; }));
      const phase = active === N * N ? '稳态：9 个单元全在工作。每拍只从左边读入 3 个数、从底部送出 3 个结果，却做了 9 次乘加。'
        : active > pa ? '填充：数据还没流满阵列，右下角的单元在空等。'
        : active < pa ? '排空：输入已经全部进入，只剩最后几个 token 的部分和在往下走，左上角先空了出来。'
        : 'token 太少，阵列始终填不满：最多只有 ' + active + ' 个单元同时在忙。';
      const outs = S.out[t].map((o) => `\\(y_{${o.r + 1},${o.j + 1}} = ${o.v}\\)`).join('、');
      msg = `<b>第 ${t + 1} 拍。</b>${active} 个单元在工作。${phase}` + (outs ? `本拍送出 ${outs}。` : '');
      if (k === T) msg += `<br><b>全部完成：</b>共 ${T} 拍，做了 ${M}×9 = ${M * 9} 次乘加，利用率 \\(= M/(M + 2N - 2) = ${M}/${M + 4}\\) ≈ ${A.pct(M / (M + 4), 0)}。与直接计算的 \\(XW\\) 逐项一致。M 越大，开头填充、结尾排空的那 4 拍占比越小。这是只算一块权重的账；真实的矩阵乘法要连续流过很多块权重，填充和排空只付一次，瓶颈变成每装一块权重要约 N 拍，利用率约为 min(1, M/N)：128×128 的阵列在 M = 1 时约 0.8%，M ≥ 128 才接近满载。`;
    }
    if (window.katex) katex.render(tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = tex;
    say.innerHTML = msg; A.renderMath(say);
    stats.innerHTML = '';
    [['拍', `${Math.max(0, t + 1)} / ${T}`], ['本拍工作的单元', `${active} / 9`], ['累计乘加', `${macs} / ${M * 9}`], ['到目前的利用率', t >= 0 ? A.pct(util, 0) : '—'], ['这一块算完时的利用率', A.pct(M / (M + 2 * N - 2), 0)]]
      .forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    view.redraw();
  }
  function go(i) { k = A.clamp(i, 0, S.T); render(); }
  simulate();
  go(0);
});
