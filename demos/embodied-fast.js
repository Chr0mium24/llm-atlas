/* embodied-fast — FAST 式频域压缩（单维示意）：1 秒的动作轨迹做正交 DCT，只保留前 m 个低频系数再逆变换；看误差、token 数，以及控制频率变高时 token 数怎么变 */
A.defineDemo('embodied-fast', function (mount) {
  const { bd } = A.demo(mount, '把一段动作压成几个数：只保留低频系数', '示意 · 机械臂末端 x 方向 1 秒的轨迹（毫米）；每个维度单独做离散余弦变换（DCT），只留前 m 个系数');
  const mj = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : 10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5);
  const TYPES = {
    smooth: { t: '平滑伸手', f: (t) => 40 * mj(t), lo: -5, hi: 50 },
    stop: { t: '中途碰到障碍停下', f: (t) => 40 * mj(Math.min(t, 0.55)), lo: -5, hi: 50 },
    grip: { t: '夹爪 60 毫秒内合上', f: (t) => 80 - 80 * mj((t - 0.5) / 0.06), lo: -10, hi: 95 },
  };
  let type = 'smooth', freq = 50, noise = false;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, Object.keys(TYPES).map((k) => ({ v: k, t: TYPES[k].t })), type, (v) => { type = v; draw(); }, '轨迹');
  A.seg(ctl, [{ v: 10, t: '10 Hz' }, { v: 50, t: '50 Hz' }, { v: 200, t: '200 Hz' }], freq, (v) => { freq = v; draw(); }, '控制频率（每秒采样点数）');
  const mS = A.slider(ctl, { label: '保留的低频系数 m', min: 1, max: 40, step: 1, value: 4, fmt: (v) => Math.min(v, freq) + ' 个', on: () => draw(), width: 180 });
  A.check(ctl, '加入遥操作的手抖（σ = 0.6 毫米）', noise, (v) => { noise = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const cv2 = A.el('canvas', { class: 'cv', style: { marginTop: '8px' } }); bd.append(cv2);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();

  // orthonormal DCT-II and its inverse
  const dct = (x) => { const N = x.length; return x.map((_, k) => { let s = 0; for (let n = 0; n < N; n++) s += x[n] * Math.cos((Math.PI / N) * (n + 0.5) * k); return s * Math.sqrt((k ? 2 : 1) / N); }); };
  const idct = (C, N) => { const out = new Array(N).fill(0); for (let n = 0; n < N; n++) { let s = 0; for (let k = 0; k < C.length; k++) s += C[k] * Math.sqrt((k ? 2 : 1) / N) * Math.cos((Math.PI / N) * (n + 0.5) * k); out[n] = s; } return out; };
  let S = null;
  function compute() {
    const N = freq, tp = TYPES[type], r = A.rng(7);
    const x = [], clean = [];
    for (let n = 0; n < N; n++) { const t = (n + 0.5) / N, v = tp.f(t); clean.push(v); x.push(v + (noise ? 0.6 * A.gauss(r) : 0)); }
    const C = dct(x), m = Math.min(mS.value, N);
    const rec = (mm) => idct(C.slice(0, mm), N);
    const err = (y) => { let s = 0, mx = 0; for (let n = 0; n < N; n++) { const d = Math.abs(x[n] - y[n]); s += d * d; mx = Math.max(mx, d); } return { rms: Math.sqrt(s / N), max: mx }; };
    const y = rec(m), e = err(y);
    let need = null; for (let mm = 1; mm <= N; mm++) if (err(rec(mm)).rms < 0.5) { need = mm; break; }
    const ec = err(clean); // error of the clean intent vs recording = noise level
    const yc = (() => { let s = 0; for (let n = 0; n < N; n++) s += (y[n] - clean[n]) ** 2; return Math.sqrt(s / N); })();
    S = { N, x, clean, C, m, y, e, need, noiseRms: ec.rms, vsClean: yc };
  }
  let hov = null;
  const view = A.canvas(cv, { get aspect() { return cv.clientWidth < 520 ? 0.62 : 0.36; } }, (ctx, W, H) => {
    if (!S) return;
    const tp = TYPES[type], box = { x: 52, y: 24, w: W - 70, h: H - 56 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1, ymin: tp.lo, ymax: tp.hi, xfmt: (v) => v.toFixed(1) + ' s', yfmt: (v) => v.toFixed(0), xlabel: '时间', ylabel: '位置（毫米）', ylabelOffset: 44 });
    const N = S.N, tx = (n) => ax.X((n + 0.5) / N);
    // reconstruction as a smooth curve (evaluate the kept cosines on a fine grid)
    ctx.save(); ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.6; ctx.beginPath();
    for (let i = 0; i <= 300; i++) { const u = (i / 300) * N - 0.5; let s = 0; for (let k = 0; k < S.m; k++) s += S.C[k] * Math.sqrt((k ? 2 : 1) / N) * Math.cos((Math.PI / N) * (u + 0.5) * k); const X = ax.X((u + 0.5) / N), Y = ax.Y(A.clamp(s, tp.lo, tp.hi)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke(); ctx.restore();
    const rad = N > 100 ? 1.8 : N > 20 ? 2.8 : 4;
    ctx.fillStyle = A.css('--ink');
    S.x.forEach((v, n) => { ctx.beginPath(); ctx.arc(tx(n), ax.Y(v), rad, 0, 7); ctx.fill(); });
    if (hov != null) { const n = hov; ctx.strokeStyle = A.css('--accent'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(tx(n), ax.Y(S.x[n]), rad + 4, 0, 7); ctx.stroke(); }
    view._ax = ax; view._box = box;
  });
  cv.addEventListener('mousemove', (e) => {
    if (!S || !view._ax) return;
    const q = A.pos(cv, e), t = view._ax.invX(q.x), n = A.clamp(Math.floor(t * S.N), 0, S.N - 1);
    if (q.x < view._box.x || q.x > view._box.x + view._box.w) { hov = null; A.tip.hide(); view.redraw(); return; }
    hov = n; view.redraw();
    A.tip.show(`<b>第 ${n + 1} 个采样点（t = ${((n + 0.5) / S.N).toFixed(3)} s）</b><br>录下的位置：${S.x[n].toFixed(2)} mm<br>用 ${S.m} 个系数还原：${S.y[n].toFixed(2)} mm<br>误差：${Math.abs(S.x[n] - S.y[n]).toFixed(2)} mm`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => { hov = null; A.tip.hide(); view.redraw(); });

  let hovK = null;
  const spec = A.canvas(cv2, { get aspect() { return cv2.clientWidth < 520 ? 0.5 : 0.3; } }, (ctx, W, H) => {
    if (!S) return;
    const N = S.N, box = { x: 52, y: 24, w: W - 70, h: H - 62 };
    const mags = S.C.map((c) => Math.abs(c)), top = Math.pow(10, Math.ceil(Math.log10(Math.max(...mags))));
    const lo = top / 1e5;
    const ax = A.axes(ctx, box, { xmin: -0.5, xmax: N - 0.5, ymin: lo, ymax: top, ylog: true, yticks: [top, top / 100, top / 1e4], xticks: A.niceTicks(0, N - 1, 6).filter((v) => Number.isInteger(v)), yfmt: (v) => (v >= 1 ? String(Math.round(v)) : String(+v.toPrecision(1))), xfmt: (v) => String(v), xlabel: '系数序号 j（第 j 个余弦每秒振动 j/2 次）', ylabel: '|系数|（对数）', ylabelOffset: 44 });
    const bw = Math.max(1, box.w / N - (N > 60 ? 0.5 : 2));
    mags.forEach((v, k) => {
      const y = ax.Y(Math.max(v, lo)), x = ax.X(k) - bw / 2;
      ctx.fillStyle = k < S.m ? cols[1] : (hovK === k ? A.css('--muted') : A.css('--axis'));
      ctx.fillRect(x, y, bw, box.y + box.h - y);
    });
    spec._ax = ax; spec._box = box;
  });
  cv2.addEventListener('mousemove', (e) => {
    if (!S || !spec._ax) return;
    const q = A.pos(cv2, e), k = Math.round(spec._ax.invX(q.x));
    if (k < 0 || k >= S.N) { hovK = null; A.tip.hide(); spec.redraw(); return; }
    hovK = k; spec.redraw();
    A.tip.show(`<b>第 j = ${k} 个系数</b>（每秒振动 ${k / 2} 次的余弦）<br>大小：${S.C[k].toFixed(3)}<br>${k < S.m ? '保留：会变成 token' : '丢弃：当作 0'}`, e.clientX, e.clientY);
  });
  cv2.addEventListener('mouseleave', () => { hovK = null; A.tip.hide(); spec.redraw(); });

  function draw() {
    mS.value = mS.value;
    compute();
    const N = S.N, m = S.m;
    stats.innerHTML = '';
    [['逐维分箱：每维 token 数', N + ' <small>（7 维共 ' + 7 * N + '）</small>'], ['只留 m 个系数：每维', m + ' <small>（7 维共 ' + 7 * m + '）</small>'], ['压缩倍数', (N / m).toFixed(1) + '×'], ['还原误差（均方根 / 最大）', S.e.rms.toFixed(2) + ' / ' + S.e.max.toFixed(2) + ' <small>mm</small>'], ['误差 &lt; 0.5 mm 至少要留', S.need + ' 个']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k', html: k }), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    legend.innerHTML = `<span><i style="background:${A.css('--ink')};border-radius:50%"></i>录下的轨迹：每个点是一个控制步</span><span><i class="line" style="background:${cols[1]}"></i>只用前 ${m} 个余弦叠加还原的轨迹</span><span><i style="background:${cols[1]}"></i>保留的系数 / <i style="background:${A.css('--axis')}"></i>丢弃的系数（下图，对数纵轴）</span>`;
    let msg;
    if (noise) msg = `手抖是白噪声：它的能量平均分在所有频率上，下图的高频系数不再迅速变小，所以“误差 &lt; 0.5 mm”需要的系数个数随采样点一起变多（现在要 ${S.need} 个）。反过来看，只留前几个系数相当于把手抖滤掉了：用 ${m} 个系数还原的曲线和“没有手抖的本意”只差 ${S.vsClean.toFixed(2)} mm。FAST 先把系数乘一个尺度再取整，小于半个刻度的系数直接变成 0，起的正是这个作用。`;
    else if (type === 'smooth') msg = `平滑的伸手动作，能量几乎全在前 4 个系数里（下图从 j = 4 起小了两三个数量级）。切换控制频率：采样点从 10 变到 200，逐维分箱的 token 数跟着涨 20 倍，“误差 &lt; 0.5 mm 要留几个系数”却始终是 ${S.need}。一段动作的信息量由它有多平滑决定，不由每秒采多少个点决定；控制频率越高，相邻两步越像，逐步预测的 token 越接近“抄上一个”。`;
    else if (type === 'stop') msg = `碰到障碍时速度突然变成 0，轨迹出现一个“拐角”。拐角让系数衰减变慢（约按 1/j² 下降），需要多留一两个系数，但仍然比采样点少得多。`;
    else msg = `夹爪在 60 毫秒内从 80 毫米合到 0，接近一个台阶。台阶的系数只按约 1/j 衰减，要几十个系数才能还原，少留时会在台阶两侧出现振荡（吉布斯现象）。这类“开 / 关”式的维度是频域压缩最吃力的地方；FAST 对所有维度用同一套办法，靠后面的 BPE 把大量的 0 合并掉。`;
    hint.innerHTML = msg;
    view.redraw(); spec.redraw();
  }
  draw();
});
