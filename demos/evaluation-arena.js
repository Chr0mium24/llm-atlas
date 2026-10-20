/* evaluation-arena — 6 models with fixed true strengths and random pairwise battles: online Elo (K = 32 / 4) jitters forever and depends on battle order; the Bradley–Terry MLE converges with 1/√N intervals */
A.defineDemo('evaluation-arena', function (mount) {
  const { bd } = A.demo(mount, '竞技场：在线 Elo 与 Bradley-Terry，谁先分清前两名', '玩具模型：6 个模型的真实分数固定（A 1300、B 1285，前两名只差 15 分），每场随机挑两个模型，胜负按真实分差抽签；所有模型从同一个分数出发');
  const TRUE = [1300, 1285, 1260, 1230, 1200, 1150], NM = ['A', 'B', 'C', 'D', 'E', 'F'], M = 6, NMAX = 100000;
  const MEAN = A.sum(TRUE) / M, L = Math.log(10) / 400;
  const PAIRS = []; for (let i = 0; i < M; i++) for (let j = i + 1; j < M; j++) PAIRS.push([i, j]);
  const pwin = (ri, rj) => 1 / (1 + Math.pow(10, (rj - ri) / 400));
  let N = 3000, method = 'e32', seed = 77, shuffle = 0, prevFinal = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '对战总场数 N', min: 100, max: NMAX, log: true, value: N, fmt: (v) => A.human(Math.round(v)) + ' 场', on: (v) => { N = Math.round(v); shuffle = 0; prevFinal = null; draw(); }, width: 210 });
  A.seg(ctl, [{ v: 'e32', t: '在线 Elo（K = 32）' }, { v: 'e4', t: '在线 Elo（K = 4）' }, { v: 'bt', t: 'Bradley-Terry 最大似然' }], method, (v) => { method = v; prevFinal = null; draw(); }, '估计方法');
  const bShuf = A.el('button', { type: 'button', onclick: () => { prevFinal = final(); shuffle++; draw(); } }, '打乱对战顺序（同一批投票）');
  const bNew = A.el('button', { type: 'button', onclick: () => { seed++; shuffle = 0; prevFinal = null; gen(); draw(); } }, '换一批对战');
  ctl.append(A.el('div', { class: 'flex' }, bShuf, bNew));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const cols = A.series();
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  let BAT = null;
  function gen() {
    const r = A.rng(seed); BAT = new Int32Array(NMAX * 3);
    for (let t = 0; t < NMAX; t++) { const [i, j] = PAIRS[Math.floor(r() * PAIRS.length)]; BAT[3 * t] = i; BAT[3 * t + 1] = j; BAT[3 * t + 2] = r() < pwin(TRUE[i], TRUE[j]) ? 1 : 0; }
  }
  function perm() { // order of the first N battles
    const o = new Int32Array(N); for (let i = 0; i < N; i++) o[i] = i;
    if (shuffle) { const r = A.rng(9000 + shuffle); for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = o[i]; o[i] = o[j]; o[j] = t; } }
    return o;
  }
  const checkpoints = (lo, hi, m) => { const out = []; for (let i = 0; i <= m; i++) { const v = Math.round(Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * i / m)); if (!out.length || v > out[out.length - 1]) out.push(v); } return out; };
  // Bradley–Terry MLE by the MM algorithm (Hunter 2004); ratings in Elo units, mean fixed at the true mean
  function btFit(W, init) {
    let g = init ? init.map((x) => Math.exp((x - MEAN) * L)) : new Array(M).fill(1);
    for (let it = 0; it < 120; it++) {
      const ng = g.map((gi, i) => { let w = 0, den = 0; for (let j = 0; j < M; j++) { if (j === i) continue; const nn = W[i][j] + W[j][i]; w += W[i][j]; if (nn) den += nn / (gi + g[j]); } return (w + 0.5) / (den + 1e-9); });
      const lg = ng.map(Math.log), m = A.mean(lg); g = lg.map((x) => Math.exp(x - m));
    }
    return g.map((x) => Math.log(x) / L + MEAN);
  }
  function inv(Mx) {
    const n = Mx.length, T = Mx.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(T[r][c]) > Math.abs(T[p][c])) p = r;
      [T[c], T[p]] = [T[p], T[c]]; const v = T[c][c]; for (let k = 0; k < 2 * n; k++) T[c][k] /= v;
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = T[r][c]; for (let k = 0; k < 2 * n; k++) T[r][k] -= f * T[c][k]; }
    }
    return T.map((r) => r.slice(n));
  }
  // Wald intervals from the Fisher information (close to the bootstrap at these sample sizes)
  function wald(W, R) {
    const H = [...Array(M)].map(() => new Array(M).fill(0));
    for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) { if (i === j) continue; const nn = W[i][j] + W[j][i], p = pwin(R[i], R[j]), f = nn * p * (1 - p) * L * L; H[i][i] += f; H[i][j] -= f; }
    const C5 = inv(H.slice(0, M - 1).map((r) => r.slice(0, M - 1)));
    const C = [...Array(M)].map((_, i) => [...Array(M)].map((_, j) => (i < M - 1 && j < M - 1 ? C5[i][j] : 0)));
    const rm = C.map((r) => A.mean(r)), tm = A.mean(rm);
    const se = C.map((r, i) => Math.sqrt(Math.max(r[i] - 2 * rm[i] + tm, 0)));
    return { se, seAB: Math.sqrt(Math.max(C[0][0] + C[1][1] - 2 * C[0][1], 0)) };
  }
  let traj = null;
  function simulate() {
    const o = perm();
    if (method === 'bt') {
      const cps = checkpoints(Math.min(200, N), N, 40), W = [...Array(M)].map(() => new Array(M).fill(0)), out = [];
      let t = 0, R = null;
      for (const cp of cps) {
        for (; t < cp; t++) { const s = o[t], i = BAT[3 * s], j = BAT[3 * s + 1]; if (BAT[3 * s + 2]) W[i][j]++; else W[j][i]++; }
        R = btFit(W, R); const w = wald(W, R); out.push({ n: cp, R: R.slice(), se: w.se, seAB: w.seAB });
      }
      return out;
    }
    const K = method === 'e32' ? 32 : 4, cps = checkpoints(10, N, 220), R = new Array(M).fill(MEAN), out = [];
    let t = 0;
    for (const cp of cps) {
      for (; t < cp; t++) { const s = o[t], i = BAT[3 * s], j = BAT[3 * s + 1], e = pwin(R[i], R[j]), u = K * (BAT[3 * s + 2] - e); R[i] += u; R[j] -= u; }
      out.push({ n: cp, R: R.slice() });
    }
    return out;
  }
  const final = () => (traj ? traj[traj.length - 1].R.slice() : null);
  const view = A.canvas(cv, { aspect: 0.52 }, (ctx, W, H) => {
    if (!traj) return;
    const box = { x: 50, y: 22, w: W - 112, h: H - 58 };
    const ylo = 1060, yhi = 1400;
    const ax = A.axes(ctx, box, { xmin: 10, xmax: Math.max(N, 100), xlog: true, ymin: ylo, ymax: yhi, yfmt: (v) => v, xfmt: (v) => A.human(v), xlabel: '已进行的对战场数（对数）', ylabel: '估计的分数', ylabelOffset: 44 });
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    if (method === 'bt') [0, 1].forEach((m) => {
      ctx.fillStyle = A.alpha(cols[m], 0.14); ctx.beginPath();
      traj.forEach((p, i) => { const x = ax.X(p.n), y = ax.Y(p.R[m] + 1.96 * p.se[m]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      for (let i = traj.length - 1; i >= 0; i--) { const p = traj[i]; ctx.lineTo(ax.X(p.n), ax.Y(p.R[m] - 1.96 * p.se[m])); }
      ctx.closePath(); ctx.fill();
    });
    for (let m = M - 1; m >= 0; m--) {
      ctx.strokeStyle = m < 2 ? cols[m] : A.alpha(cols[m], 0.55); ctx.lineWidth = m < 2 ? 2.4 : 1.3; ctx.beginPath();
      traj.forEach((p, i) => { const x = ax.X(p.n), y = ax.Y(p.R[m]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
    ctx.restore();
    // true values on the right margin
    TRUE.forEach((v, m) => {
      const y = ax.Y(v), x = box.x + box.w;
      ctx.save(); ctx.strokeStyle = cols[m]; ctx.lineWidth = 2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 16, y); ctx.stroke(); ctx.restore();
      A.text(ctx, NM[m] + ' ' + v, x + 19, y + (m === 1 ? 5 : m === 0 ? -5 : 0), { size: 11, color: cols[m], weight: m < 2 ? 700 : 400 });
    });
    A.text(ctx, (method === 'bt' ? '阴影：A、B 的 95% 区间' : '起点：所有模型 ' + MEAN.toFixed(0) + ' 分') + '　右侧虚线：真实分数', box.x + 6, box.y + 10, { size: 11.5, color: A.css('--muted') });
  });
  function draw() {
    traj = simulate();
    const last = traj[traj.length - 1], R = last.R, dAB = R[0] - R[1];
    const order = R.map((v, i) => i).sort((a, b) => R[b] - R[a]), wrong = order.filter((m, i) => m !== i).length;
    const tail = traj.filter((p) => p.n >= N * 0.8).map((p) => p.R[0] - p.R[1]);
    stats.innerHTML = '';
    const items = [['A − B 的估计（真实 +15）', (dAB >= 0 ? '+' : '') + dAB.toFixed(0) + (method === 'bt' ? ' ± ' + (1.96 * last.seAB).toFixed(0) : '')]];
    if (method === 'bt') items.push(['前两名分清了吗', dAB - 1.96 * last.seAB > 0 ? '分清了：区间不含 0' : '还没有：区间含 0']);
    else items.push(['最后 20% 的场次里 A − B 的范围', Math.min(...tail).toFixed(0) + ' 到 ' + Math.max(...tail).toFixed(0)]);
    items.push(['排名与真实一致吗', wrong ? '有 ' + wrong + ' 个名次不对' : '6 个名次全对']);
    if (prevFinal) { const ch = Math.max(...R.map((v, i) => Math.abs(v - prevFinal[i]))); items.push(['打乱顺序后，分数最多变了', ch.toFixed(0) + ' 分']); }
    items.forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    const msg = {
      e32: 'K = 32 时，每场最多改动 32 分。分数很快离开起点，但之后一直在真实值附近上下跳，幅度约 ±50 分（推导里算出的约 9.3×√K），而且不会随对战增多而变小：前两名的顺序一直在换。点“打乱对战顺序”：同一批投票换个顺序，最终分数能差几十分。',
      e4: 'K = 4：抖动小了（约 ±19 分），代价是起步慢得多，前几百场里分数几乎没离开起点。抖动同样不随对战数缩小，15 分的差距依然分不清。在线 Elo 是为“水平会变的棋手”设计的，模型权重固定时，这种一直在追的更新反而是噪声。',
      bt: '把到目前为止的全部对战一起拟合，结果与对战顺序无关（打乱顺序不会改变它）。阴影是 A 和 B 的 95% 区间，宽度按 1/√N 缩小。现在前两名之差的 95% 区间是 ±' + (1.96 * last.seAB).toFixed(0) + ' 分。6 个模型两两随机配对时，平均要约 1.1 万场，A 与 B 的区间才会分开，要有 80% 的把握约需 2.2 万场。榜首的模型常常只差十几分，这就是竞技场需要海量投票的原因。',
    }[method];
    hint.innerHTML = msg;
    view.redraw();
  }
  gen(); draw();
});
