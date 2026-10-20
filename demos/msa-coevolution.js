/* msa-coevolution — toy multiple sequence alignment: contacting positions co-vary; pairwise mutual information vs a global (mean-field DCA) model that removes indirect couplings */
A.defineDemo('msa-coevolution', function (mount) {
  const { bd } = A.demo(mount, '从进化记录里读出结构', '玩具蛋白：30 个位置，4 类残基。互相接触的位置必须“配对”（正负电荷或两个疏水）；一条进化中的突变若破坏配对，常被另一侧的突变补偿');
  const L = 30, Q = 4, K = 10;
  const NAMES = ['+', '−', '疏', '极'];
  const HAIR = [[3, 26], [4, 25], [5, 24], [6, 23], [7, 22], [8, 21], [9, 20]], CHAIN = [11, 13, 15, 17];
  const CONTACTS = [...HAIR, [11, 13], [13, 15], [15, 17]];
  const INDIRECT = [[11, 15], [13, 17], [11, 17]];
  const isC = (i, j) => CONTACTS.some(([a, b]) => a === i && b === j);
  const isInd = (i, j) => INDIRECT.some(([a, b]) => a === i && b === j);
  let lgN = 2.5, method = 'mi', seed = 7, S = [], M = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '比对中的序列数', min: 1, max: 3, step: 0.05, value: lgN, fmt: (v) => Math.round(Math.pow(10, v)) + ' 条', on: (v) => { lgN = v; recompute(); }, width: 200 });
  A.seg(ctl, [{ v: 'mi', t: '逐对统计（互信息）' }, { v: 'dca', t: '全局模型（去除间接耦合）' }], method, (v) => { method = v; recompute(); }, '打分方法');
  ctl.append(A.el('button', { onclick: () => { seed++; recompute(); } }, '换一批序列'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const RES = () => [A.css('--s8'), A.css('--s1'), A.css('--s4'), A.css('--grid')];

  function gen(N) {
    const r = A.rng(seed), R = () => Math.floor(r() * Q), out = [];
    const opp = (c) => (c === 0 ? 1 : c === 1 ? 0 : c);
    for (let n = 0; n < N; n++) {
      const s = Array.from({ length: L }, R);
      HAIR.forEach(([i, j]) => { s[i] = r() < 0.5 ? (r() < 0.5 ? 0 : 1) : 2; s[j] = r() < 0.35 ? R() : opp(s[i]); });
      s[CHAIN[0]] = r() < 0.5 ? 0 : 1;
      for (let t = 1; t < CHAIN.length; t++) { const p = s[CHAIN[t - 1]]; s[CHAIN[t]] = r() < 0.05 ? R() : p < 2 ? 1 - p : (r() < 0.5 ? 0 : 1); }
      out.push(s);
    }
    return out;
  }
  function mi(S) {
    const pc = 0.1, f1 = Array.from({ length: L }, () => new Array(Q).fill(pc));
    S.forEach((s) => s.forEach((a, i) => f1[i][a]++));
    f1.forEach((r) => { const t = A.sum(r); r.forEach((v, k) => (r[k] = v / t)); });
    const out = Array.from({ length: L }, () => new Array(L).fill(0));
    for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) {
      const f = Array.from({ length: Q }, () => new Array(Q).fill(pc / Q)); S.forEach((s) => f[s[i]][s[j]]++);
      let t = 0; f.forEach((r) => r.forEach((v) => (t += v)));
      let m = 0; for (let a = 0; a < Q; a++) for (let b = 0; b < Q; b++) { const p = f[a][b] / t; m += p * Math.log(p / (f1[i][a] * f1[j][b])); }
      out[i][j] = out[j][i] = m;
    }
    return out;
  }
  function inv(Ain) {
    const n = Ain.length, Mx = Ain.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(Mx[r][c]) > Math.abs(Mx[p][c])) p = r;
      [Mx[c], Mx[p]] = [Mx[p], Mx[c]]; const d = Mx[c][c];
      for (let k = 0; k < 2 * n; k++) Mx[c][k] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = Mx[r][c]; if (f) for (let k = 0; k < 2 * n; k++) Mx[r][k] -= f * Mx[c][k]; }
    }
    return Mx.map((r) => r.slice(n));
  }
  // mean-field DCA: couplings J = −C⁻¹ (pseudocount 0.5), Frobenius norm in zero-sum gauge, APC
  function dca(S) {
    const N = S.length, q1 = Q - 1, lam = 0.5, D = L * q1;
    const f1 = Array.from({ length: L }, () => new Array(Q).fill(0)); S.forEach((s) => s.forEach((a, i) => (f1[i][a] += 1 / N)));
    const fi = (i, a) => (1 - lam) * f1[i][a] + lam / Q;
    const C = Array.from({ length: D }, () => new Array(D).fill(0));
    for (let i = 0; i < L; i++) for (let j = i; j < L; j++) {
      let f = null; if (i !== j) { f = Array.from({ length: Q }, () => new Array(Q).fill(0)); S.forEach((s) => (f[s[i]][s[j]] += 1 / N)); }
      for (let a = 0; a < q1; a++) for (let b = 0; b < q1; b++) {
        const fij = i === j ? (a === b ? fi(i, a) : 0) : (1 - lam) * f[a][b] + lam / (Q * Q);
        const v = fij - fi(i, a) * fi(j, b); C[i * q1 + a][j * q1 + b] = v; C[j * q1 + b][i * q1 + a] = v;
      }
    }
    const E = inv(C), F = Array.from({ length: L }, () => new Array(L).fill(0));
    for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) {
      const J = Array.from({ length: Q }, () => new Array(Q).fill(0));
      for (let a = 0; a < q1; a++) for (let b = 0; b < q1; b++) J[a][b] = -E[i * q1 + a][j * q1 + b];
      const rm = J.map((r) => A.sum(r) / Q), cm = J[0].map((_, b) => J.reduce((x, r) => x + r[b], 0) / Q), m = A.sum(rm) / Q;
      let s = 0; for (let a = 0; a < Q; a++) for (let b = 0; b < Q; b++) { const v = J[a][b] - rm[a] - cm[b] + m; s += v * v; }
      F[i][j] = F[j][i] = Math.sqrt(s);
    }
    const row = F.map((r) => A.sum(r) / (L - 1)), all = A.sum(row) / L;
    return F.map((r, i) => r.map((v, j) => (i === j ? 0 : v - (row[i] * row[j]) / all)));
  }
  let top = [];
  function recompute() {
    S = gen(Math.round(Math.pow(10, lgN)));
    M = method === 'mi' ? mi(S) : dca(S);
    const P = []; for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) P.push([M[i][j], i, j]);
    P.sort((a, b) => b[0] - a[0]); top = P.slice(0, K);
    draw();
  }
  const view = A.canvas(cv, { aspect: 0.52 }, (ctx, W, H) => {
    const rc = RES(), ink = A.css('--ink-2'), muted = A.css('--muted');
    // left: MSA excerpt
    const show = Math.min(S.length, 14), lw = Math.min(W * 0.46, 330), cw = lw / L, rh = Math.min(16, (H - 60) / show);
    const x0 = 6, y0 = 30;
    A.text(ctx, '比对片段（前 ' + show + ' 条，每列一个位置）', x0, 12, { size: 11.5, color: muted });
    for (let n = 0; n < show; n++) for (let i = 0; i < L; i++) { ctx.fillStyle = rc[S[n][i]]; ctx.fillRect(x0 + i * cw + 0.5, y0 + n * rh + 0.5, cw - 1, rh - 1); }
    [[4, 25], [11, 13]].forEach(([a, b], k) => {
      ctx.strokeStyle = ink; ctx.lineWidth = k ? 1 : 2;
      [a, b].forEach((c) => ctx.strokeRect(x0 + c * cw, y0 - 2, cw, show * rh + 4));
    });
    const ly = y0 + show * rh + 14;
    NAMES.forEach((nm, k) => { ctx.fillStyle = rc[k]; ctx.fillRect(x0 + k * 58, ly, 10, 10); A.text(ctx, k < 2 ? nm + ' 电荷' : nm + (k === 2 ? '水' : '性'), x0 + k * 58 + 14, ly + 5, { size: 11, color: ink, baseline: 'middle' }); });
    A.text(ctx, '框出的两对列：位置 5 与 26（发夹配对）、12 与 14（链上相邻）', x0, ly + 24, { size: 11, color: muted });
    // right: contact map
    const side = Math.min(W - lw - 40, H - 34), mx = W - side - 6, my = 22, c = side / L;
    A.text(ctx, '右上：预测分数（蓝）　左下：真实接触（灰）', mx, 10, { size: 11.5, color: muted });
    let mxv = 0; for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) mxv = Math.max(mxv, M[i][j]);
    ctx.strokeStyle = A.css('--grid'); ctx.lineWidth = 1; ctx.strokeRect(mx, my, side, side);
    for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) {
      if (i === j) continue;
      if (j > i) { const v = Math.max(0, M[i][j]) / (mxv || 1); if (v > 0.04) { ctx.fillStyle = A.alpha(cols[0], Math.min(1, v)); ctx.fillRect(mx + j * c, my + i * c, c, c); } }
      else if (isC(j, i)) { ctx.fillStyle = A.css('--muted'); ctx.fillRect(mx + j * c, my + i * c, c, c); }
    }
    top.forEach(([, i, j]) => {
      const cx = mx + (j + 0.5) * c, cy = my + (i + 0.5) * c, ok = isC(i, j);
      ctx.strokeStyle = ok ? A.css('--ink') : A.css('--bad'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, c * 0.85, 0, 7); ctx.stroke();
    });
    ctx.save(); ctx.strokeStyle = A.css('--grid'); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + side, my + side); ctx.stroke(); ctx.restore();
  });
  function draw() {
    const hit = top.filter(([, i, j]) => isC(i, j)).length, ind = top.filter(([, i, j]) => isInd(i, j)).length;
    stats.innerHTML = '';
    [['分数最高的 10 对里，真的接触', hit + ' / 10'], ['其中间接耦合（假阳性）', ind + ' 对'], ['序列数', Math.round(Math.pow(10, lgN)) + ' 条']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    const n = Math.round(Math.pow(10, lgN));
    hint.innerHTML = (n < 60
      ? '序列太少时，随机巧合产生的相关和真实的共进化差不多强，右上角一片噪声。真实的 AlphaFold 也是这样：比对里的同源序列太少时，预测精度明显下降。'
      : method === 'mi'
        ? '序列足够多时，真实接触（圆圈落在与左下角对称的位置）都被找到了，但总有几个错误的圆圈（红色）不随数据增多而消失：位置 12–14–16–18 是一条链，12 与 16 并不接触，却因为都和 14 配对而“间接地”一起变化。逐对统计分不清直接和间接。'
        : '全局模型同时拟合所有位置之间的耦合，问的是“在其他位置都已知的条件下，这两个位置还相关吗”。链上的间接相关被解释掉了，前 10 个预测全部落在真实接触上。这就是 2011 年前后“直接耦合分析”让结构预测精度大幅提升的原因；AlphaFold 2 用注意力在比对的行和列上反复交换信息，隐式地学到了类似的、更强的推断。') +
      ' 圆圈：分数最高的 10 对；黑圈为真实接触，红圈为错误预测。';
    view.redraw();
  }
  recompute();
});
