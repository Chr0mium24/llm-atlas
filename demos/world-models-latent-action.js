/* world-models-latent-action — Genie-style latent actions from unlabeled video: an inverse-dynamics encoder picks one of K codes, a tiny convolutional decoder predicts the next frame from (frame, code); a flickering lamp (distractor) can steal the codes */
A.defineDemo('world-models-latent-action', function (mount) {
  const { bd } = A.demo(mount, '从无标注视频里学出“动作”：潜动作的玩具', '一维小世界：16 格的环上有一个 2 格宽的小球（左移 / 右移 / 不动，等概率），旁边可以放一盏随机亮灭的灯；训练只看 1200 对相邻帧，不给动作标签；数字都是实际训练算出的');
  const NA = 16, NT = 1200, KT = 5, HK = 2, RS = 6, IT = 40;
  const ACT = ['←', '→', '·'], SHIFT = [NA - 1, 1, 0];
  // ---------- data
  function makeData(D, seed) {
    const r = A.rng(seed); const X = [], Y = [], Aa = [], Lm = []; let pos = Math.floor(r() * NA), lamp = r() < 0.5 ? 1 : 0;
    const frame = () => { const f = new Float64Array(NA + D); f[pos] = 1; f[(pos + 1) % NA] = 1; for (let i = 0; i < D; i++) f[NA + i] = lamp; return f; };
    let cur = frame();
    for (let i = 0; i < NT; i++) { const a = Math.floor(r() * 3); pos = (pos + SHIFT[a]) % NA; if (D) lamp = r() < 0.5 ? 1 : 0; const nx = frame(); X.push(cur); Y.push(nx); Aa.push(a); Lm.push(lamp); cur = nx; }
    return { X, Y, A: Aa, L: Lm, D };
  }
  // ---------- tiny decoder per code: circular conv (KT taps + bias) on the ball ring, one constant brightness for the lamp cells
  function solve(M, b) { const n = b.length; const a = M.map((row, i) => [...row, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let q = c + 1; q < n; q++) if (Math.abs(a[q][c]) > Math.abs(a[p][c])) p = q; [a[c], a[p]] = [a[p], a[c]]; const d = a[c][c]; if (Math.abs(d) < 1e-12) continue; for (let q = 0; q < n; q++) { if (q === c) continue; const f = a[q][c] / d; if (f) for (let k = c; k <= n; k++) a[q][k] -= f * a[c][k]; } } return a.map((row, i) => row[n] / (row[i] || 1)); }
  const feats = (x, i) => { const f = []; for (let o = -HK; o <= HK; o++) f.push(x[(i - o + NA) % NA]); f.push(1); return f; };
  function fit(data, idx) {
    const { X, Y, D } = data, d = KT + 1; const M = Array.from({ length: d }, () => new Float64Array(d)), B = new Float64Array(d);
    let sy = 0, cnt = 0;
    for (const n of idx) { const x = X[n], y = Y[n]; for (let i = 0; i < NA; i++) { const f = feats(x, i); for (let a = 0; a < d; a++) { if (!f[a]) continue; for (let b = 0; b < d; b++) M[a][b] += f[a] * f[b]; B[a] += f[a] * y[i]; } } if (D) { sy += y[NA]; cnt++; } }
    for (let a = 0; a < d; a++) M[a][a] += 1e-3;
    const k = solve(M.map((r) => Array.from(r)), Array.from(B));
    return { k, be: D && cnt ? sy / cnt : 0 };
  }
  function pred(W, x, D) { const y = new Float64Array(NA + D); for (let i = 0; i < NA; i++) { const f = feats(x, i); let s = 0; for (let a = 0; a <= KT; a++) s += W.k[a] * f[a]; y[i] = s; } for (let j = 0; j < D; j++) y[NA + j] = W.be; return y; }
  function err(W, x, y, D) { const p = pred(W, x, D); let e = 0; for (let i = 0; i < y.length; i++) e += (p[i] - y[i]) ** 2; return e; }
  // encoder = pick the code whose decoder explains (x_t -> x_{t+1}) best; alternate with refitting the decoders (hard EM)
  function train(data, K, seed) {
    const { X, Y, D } = data, n = X.length, r = A.rng(seed); const z = new Int32Array(n);
    // k-means++ on the frame differences as a starting assignment
    const dv = X.map((x, i) => Array.from(Y[i]).map((v, j) => v - x[j])), dist = (u, v) => { let s = 0; for (let j = 0; j < u.length; j++) s += (u[j] - v[j]) ** 2; return s; };
    const cents = [dv[Math.floor(r() * n)]];
    while (cents.length < K) { const d2 = dv.map((v) => Math.min(...cents.map((c) => dist(v, c)))); let u = r() * A.sum(d2), k = 0; while (u > d2[k] && k < n - 1) { u -= d2[k]; k++; } cents.push(dv[k]); }
    for (let i = 0; i < n; i++) { let b = 0, bv = Infinity; cents.forEach((c, k) => { const v = dist(dv[i], c); if (v < bv) { bv = v; b = k; } }); z[i] = b; }
    let Ws, tot = 0;
    for (let it = 0; it < IT; it++) {
      Ws = []; for (let k = 0; k < K; k++) { const idx = []; for (let i = 0; i < n; i++) if (z[i] === k) idx.push(i); if (!idx.length) idx.push(Math.floor(r() * n)); Ws.push(fit(data, idx)); }
      tot = 0; let ch = 0;
      for (let i = 0; i < n; i++) { let b = 0, bv = 1e18; for (let k = 0; k < K; k++) { const e = err(Ws[k], X[i], Y[i], D); if (e < bv - 1e-12) { bv = e; b = k; } } if (b !== z[i]) ch++; z[i] = b; tot += bv; }
      if (!ch) break;
    }
    return { z, Ws, tot: tot / n };
  }
  function mutual(z, lab, K, L) { const n = z.length; const c = Array.from({ length: K }, () => new Float64Array(L)); z.forEach((k, i) => c[k][lab[i]]++); let I = 0; const pz = c.map((r) => A.sum(Array.from(r)) / n), pl = Array.from({ length: L }, (_, j) => c.reduce((s, r) => s + r[j], 0) / n); for (let k = 0; k < K; k++) for (let j = 0; j < L; j++) { const p = c[k][j] / n; if (p > 0) I += p * Math.log2(p / (pz[k] * pl[j])); } let Hl = 0; pl.forEach((p) => { if (p > 0) Hl -= p * Math.log2(p); }); return { I, Hl, c }; }

  // ---------- UI
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const Dseg = A.seg(ctl, [{ t: '没有灯', v: 0 }, { t: '小灯（2 格）', v: 2 }, { t: '大灯（4 格）', v: 4 }], 0, () => run(), '干扰物');
  const KS = A.slider(ctl, { label: '码本大小 K（潜动作有几种）', min: 2, max: 8, step: 1, value: 3, fmt: (v) => v + ' 个码 = ' + Math.log2(v).toFixed(2) + ' 比特', on: A.debounce(run, 80), width: 220 });
  const showT = A.check(ctl, '显示真实动作（训练时看不到）', false, () => drawFilm());
  ctl.append(A.el('button', { onclick: () => { dseed++; run(); } }, '换一段视频重新训练'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' });
  const left = A.el('div'), right = A.el('div'); grid.append(left, right); bd.append(grid);
  left.append(A.el('div', { class: 'small muted', style: { marginBottom: '4px' } }, '无标注视频（每行一帧，时间向下）；右边的色块是编码器给这一步挑的码'));
  const cvF = A.el('canvas', { class: 'cv' }); left.append(cvF);
  right.append(A.el('div', { class: 'small muted', style: { marginBottom: '4px' } }, '每个码对应的真实情况（按行归一化）'));
  const cvT = A.el('canvas', { class: 'cv' }); right.append(cvT);
  const play = A.el('div', { style: { marginTop: '14px' } }); bd.append(play);
  play.append(A.el('div', { class: 'small muted', style: { marginBottom: '6px' } }, '试玩：像 Genie 的用户一样，按一个码，解码器从当前画面生成下一帧（生成的帧再作为下一步的输入）'));
  const cvP = A.el('canvas', { class: 'cv' }); play.append(cvP);
  const pad = A.el('div', { class: 'flex', style: { marginTop: '8px' } }); play.append(pad);
  bd.append(A.el('p', { class: 'hint' }, '没有灯、K = 3 时，三个码分别变成“左移”“右移”“不动”，和真实动作一一对应，尽管训练时从没告诉过它动作是什么。换成“大灯”：灯亮灭一次改变 4 个格子，比小球移动一格改变得多，只有 3 个码时，码先被用来记录“灯会不会亮”，小球的动作反而记不全。把 K 加到 6，所有情况都能预测准了，但每个码都是“动作 + 灯”的组合：按“右移”的码，灯也会跟着亮。潜动作学到的是“最能解释画面变化的东西”，不一定是你能控制的东西。'));
  const cols = A.series();
  const codeCol = (k) => cols[[0, 2, 1, 4, 5, 3, 6, 7][k % 8]];
  let dseed = 1, data, model, cur, info;
  function run() {
    const D = Dseg.value, K = KS.value;
    data = makeData(D, dseed * 17 + 1);
    let best = null; for (let s = 0; s < RS; s++) { const m = train(data, K, 10 + s + dseed * 101); if (!best || m.tot < best.tot) best = m; }
    model = best;
    const a = mutual(model.z, data.A, K, 3), l = D ? mutual(model.z, data.L, K, 2) : null;
    info = { a, l, K, D };
    stats.innerHTML = [
      ['码里含有的动作信息', A.pct(a.I / a.Hl, 0) + ' <small>' + a.I.toFixed(2) + ' / ' + a.Hl.toFixed(2) + ' 比特</small>'],
      ['码里含有的灯的信息', D ? A.pct(l.I / l.Hl, 0) + ' <small>' + l.I.toFixed(2) + ' / ' + l.Hl.toFixed(2) + ' 比特</small>' : '—'],
      ['下一帧的预测误差', model.tot.toFixed(3) + ' <small>每帧平方误差之和</small>'],
    ].map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    pad.innerHTML = '';
    for (let k = 0; k < K; k++) { const b = A.el('button', { onclick: () => step(k), style: { borderColor: codeCol(k) } }, '码 ' + (k + 1)); pad.append(b); }
    pad.append(A.el('button', { onclick: resetPlay }, '回到真实画面'));
    optT.height = 24 + K * 33 + 8;
    resetPlay(); drawFilm(); vT.redraw();
  }
  function resetPlay() { cur = { frames: [data.X[0]], codes: [], shifted: false }; optP.height = 30; vP.redraw(); }
  function step(k) { const f = pred(model.Ws[k], cur.frames[cur.frames.length - 1], data.D); cur.frames.push(f); cur.codes.push(k); if (cur.frames.length > 12) { cur.frames.shift(); cur.codes.shift(); cur.shifted = true; } optP.height = cur.frames.length * 16 + 14; vP.redraw(); }
  function cell(ctx, x, y, s, v, lampCell) {
    ctx.fillStyle = A.css('--page'); ctx.fillRect(x, y, s - 1, s - 1);
    const a = A.clamp(v, 0, 1); if (a > 0.02) { ctx.fillStyle = lampCell ? A.alpha('#e8b500', a) : A.alpha(A.isDark() ? '#e8e6e1' : '#2b2a27', a); ctx.fillRect(x, y, s - 1, s - 1); }
    ctx.strokeStyle = A.css('--grid'); ctx.strokeRect(x + 0.5, y + 0.5, s - 2, s - 2);
  }
  const ROWS = 18;
  const vF = A.canvas(cvF, { height: ROWS * 17 + 16 }, (ctx, W) => {
    if (!data) return; const D = data.D, n = NA + D + (D ? 1 : 0); const s = Math.min(16, Math.floor((W - 90) / n));
    for (let t = 0; t < ROWS; t++) {
      const f = data.X[t], y = 6 + t * (s + 1);
      for (let i = 0; i < NA; i++) cell(ctx, 4 + i * s, y, s, f[i], false);
      for (let j = 0; j < D; j++) cell(ctx, 4 + (NA + 1 + j) * s, y, s, f[NA + j], true);
      const zx = 4 + n * s + 8, k = model.z[t];
      ctx.fillStyle = codeCol(k); ctx.fillRect(zx, y + 1, 22, s - 3);
      A.text(ctx, String(k + 1), zx + 11, y + s / 2, { size: 11, align: 'center', color: '#fff', weight: 600 });
      if (showT.checked) A.text(ctx, ACT[data.A[t]] + (D ? (data.L[t] ? ' 灯亮' : ' 灯灭') : ''), zx + 28, y + s / 2, { size: 11.5, color: A.css('--muted') });
    }
  });
  function drawFilm() { vF.redraw(); }
  const optT = { height: 140 };
  const vT = A.canvas(cvT, optT, (ctx, W) => {
    if (!info) return; const { a, l, K, D } = info;
    const colsN = 3 + (D ? 2 : 0), lw = 46, cw = Math.min(64, (W - lw - 8) / colsN), ch = 30;
    const heads = ACT.map((x) => x === '·' ? '不动' : x === '←' ? '左移' : '右移').concat(D ? ['灯亮', '灯灭'] : []);
    heads.forEach((h, j) => A.text(ctx, h, lw + j * cw + cw / 2 + (j >= 3 ? 8 : 0), 12, { size: 12, align: 'center', color: A.css('--ink-2'), weight: 600 }));
    for (let k = 0; k < K; k++) {
      const y = 24 + k * (ch + 3), ra = Array.from(a.c[k]), na = A.sum(ra);
      ctx.fillStyle = codeCol(k); ctx.fillRect(4, y + 2, 34, ch - 4); A.text(ctx, '码 ' + (k + 1), 21, y + ch / 2, { size: 11, align: 'center', color: '#fff', weight: 600 });
      const vals = ra.map((v) => (na ? v / na : 0)).concat(D ? (() => { const rl = [l.c[k][1], l.c[k][0]]; const nl = rl[0] + rl[1]; return rl.map((v) => (nl ? v / nl : 0)); })() : []);
      vals.forEach((v, j) => {
        const x = lw + j * cw + (j >= 3 ? 8 : 0);
        ctx.fillStyle = na ? A.seq(v) : A.css('--page'); ctx.fillRect(x, y, cw - 3, ch);
        if (na) A.text(ctx, Math.round(v * 100) + '%', x + (cw - 3) / 2, y + ch / 2, { size: 11.5, align: 'center', color: v > 0.55 ? (A.isDark() ? '#0d0d0d' : '#fff') : A.css('--ink') });
      });
      if (!na) A.text(ctx, '（没被用到）', lw + 4, y + ch / 2, { size: 11.5, color: A.css('--muted') });
    }
  });
  const optP = { height: 30 };
  const vP = A.canvas(cvP, optP, (ctx, W) => {
    if (!cur) return; const D = data.D, s = Math.min(18, Math.floor((W - 20) / (NA + D + 1)));
    cur.frames.forEach((f, t) => {
      const ss = Math.min(15, s), y = 4 + t * (ss + 1);
      for (let i = 0; i < NA; i++) cell(ctx, 4 + i * ss, y, ss, f[i], false);
      for (let j = 0; j < D; j++) cell(ctx, 4 + (NA + 1 + j) * ss, y, ss, f[NA + j], true);
      const lab = t === 0 ? (cur.shifted ? '（更早的帧已省略）' : '真实画面（起点）') : '按了 码 ' + (cur.codes[t - 1] + 1) + ' 之后';
      A.text(ctx, lab, 4 + (NA + D + 2) * ss, y + ss / 2, { size: 11, color: t === 0 ? A.css('--muted') : codeCol(cur.codes[t - 1]) });
    });
  });
  run();
});
