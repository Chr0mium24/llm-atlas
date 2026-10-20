/* moe-balance — toy training run: rich-get-richer routing collapse vs auxiliary loss vs bias controller (DeepSeek-V3 style). Same tokens and random numbers for all three. */
A.defineDemo('moe-balance', function (mount) {
  const { bd } = A.demo(mount, '三种均衡方式的训练过程：不管、辅助损失、偏置控制器', '玩具模型（示意）：8 个专家，每个 token 选 2 个，每步 512 个 token，容量因子 1.25');
  const E = 8, K = 2, T = 512, STEPS = 240, CF = 1.25, KAPPA = 1, RHO = 0.05, ETA = 0.5;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const sa = A.slider(ctl, { label: '辅助损失系数 α', min: 0.1, max: 30, log: true, value: 3, fmt: (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1)), on: A.debounce(runAll, 180), width: 190 });
  const sg = A.slider(ctl, { label: '偏置步长 γ', min: 0.002, max: 0.2, log: true, value: 0.02, fmt: (v) => v.toFixed(3), on: A.debounce(runAll, 180), width: 170 });
  const sp = A.slider(ctl, { label: '前几个专家“天生”受欢迎的程度', min: 0, max: 1, step: 0.05, value: 0.6, fmt: (v) => v.toFixed(2), on: A.debounce(runAll, 180), width: 230 });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const sv = A.slider(ctl2, { label: '查看第几步', min: 0, max: STEPS - 1, step: 1, value: STEPS - 1, fmt: (v) => v, on: () => draw(), width: 260 });
  let seed = 1;
  ctl2.append(A.el('button', { onclick: () => { seed++; runAll(); } }, '换一批随机数'));
  const cv1 = A.el('canvas', { class: 'cv' }); bd.append(cv1);
  bd.append(A.el('div', { class: 'legend', html: Array.from({ length: E }, (_, i) => `<span><i style="background:var(--s${i + 1})"></i>专家 ${i + 1}</span>`).join('') + '<span>色带高度 = 这一步该专家收到的 token 占比（均匀时每条 12.5%）</span>' }));
  const grid = A.el('div', { class: 'cols' });
  const cv2 = A.el('canvas', { class: 'cv' }), cv3 = A.el('canvas', { class: 'cv' });
  grid.append(cv2, cv3); bd.append(grid);
  bd.append(A.el('div', { class: 'legend', html: '<span><i class="line" style="background:var(--s8)"></i>不加约束</span><span><i class="line" style="background:var(--s4)"></i>辅助损失</span><span><i class="line" style="background:var(--s1)"></i>偏置控制器</span>' }));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  bd.append(A.el('p', { class: 'hint', html: '模型：每个 token 对每个专家有一个固定的“亲和度”（随机数，前几个专家整体高一些）。专家的熟练度随它最近收到的 token 数增长，路由器眼里的分数 = 亲和度 + log(熟练度)。这就是正反馈：收到越多 → 越熟练 → 分数越高 → 收到更多。<b>辅助损失</b>：路由器按梯度学习，主任务把它拉向这个分数，辅助损失 α·EΣf<sub>i</sub>P<sub>i</sub> 把它推向均匀。<b>偏置控制器</b>：路由器的分数不动，只在选 top-2 时加偏置 b<sub>i</sub>，每步按 b<sub>i</sub> ← b<sub>i</sub> + γ·sign(平均负载 − 负载<sub>i</sub>) 调整。“路由质量”= 被处理的分配的平均亲和度（门控加权，被丢弃的记 0），越高越好；“门控偏差”= 实际门控权重与按真实分数算的门控权重之间的 KL 散度。' }));
  const MODES = [{ m: 'none', n: '不加约束', c: '--s8' }, { m: 'aux', n: '辅助损失', c: '--s4' }, { m: 'bias', n: '偏置控制器', c: '--s1' }];
  let R = null;
  function run(mode, alpha, gamma, skew, sd) {
    const r = A.rng(sd * 977 + 13);
    const H = new Float64Array(T * E);
    for (let t = 0; t < T; t++) for (let i = 0; i < E; i++) H[t * E + i] = A.gauss(r) + skew * (1 - (2 * i) / (E - 1));
    const s = new Float64Array(E).map(() => 1 + 0.02 * A.gauss(r));
    const Z = new Float64Array(T * E), PA = new Float64Array(T * E), b = new Float64Array(E);
    const u = new Float64Array(E), q = new Float64Array(E);
    const out = [];
    const cap = Math.ceil((CF * K * T) / E), mean = (K * T) / E;
    for (let st = 0; st < STEPS; st++) {
      const load = new Int32Array(E), used = new Int32Array(E);
      let qual = 0, drops = 0, gkl = 0;
      for (let t = 0; t < T; t++) {
        for (let i = 0; i < E; i++) u[i] = H[t * E + i] + KAPPA * Math.log(s[i]);
        if (mode === 'aux' && st === 0) for (let i = 0; i < E; i++) Z[t * E + i] = u[i];
        const z = mode === 'aux' ? Z.subarray(t * E, t * E + E) : u;
        let i1 = -1, v1 = -1e18, i2 = -1, v2 = -1e18;
        for (let i = 0; i < E; i++) { const v = z[i] + (mode === 'bias' ? b[i] : 0); if (v > v1) { i2 = i1; v2 = v1; i1 = i; v1 = v; } else if (v > v2) { i2 = i; v2 = v; } }
        const sel = [i1, i2];
        const g1 = 1 / (1 + Math.exp(z[i2] - z[i1])), g = [g1, 1 - g1];
        const h1 = 1 / (1 + Math.exp(u[i2] - u[i1])), h = [h1, 1 - h1];
        gkl += (h[0] * Math.log(h[0] / g[0]) + h[1] * Math.log(h[1] / g[1])) / T;
        for (let j = 0; j < K; j++) { const i = sel[j]; load[i]++; if (used[i]++ < cap) qual += (g[j] * H[t * E + i]) / T; else drops++; }
        if (mode === 'aux') { let m = -1e18; for (let i = 0; i < E; i++) if (z[i] > m) m = z[i]; let ss = 0; for (let i = 0; i < E; i++) { PA[t * E + i] = Math.exp(z[i] - m); ss += PA[t * E + i]; } for (let i = 0; i < E; i++) PA[t * E + i] /= ss; }
      }
      const f = Array.from(load, (v) => v / (K * T));
      if (mode === 'aux') {
        for (let t = 0; t < T; t++) {
          let m = -1e18; for (let i = 0; i < E; i++) { u[i] = H[t * E + i] + KAPPA * Math.log(s[i]); if (u[i] > m) m = u[i]; }
          let ss = 0; for (let i = 0; i < E; i++) { q[i] = Math.exp(u[i] - m); ss += q[i]; }
          let fb = 0; for (let i = 0; i < E; i++) { q[i] /= ss; fb += PA[t * E + i] * f[i]; }
          for (let j = 0; j < E; j++) { const p = PA[t * E + j]; Z[t * E + j] -= ETA * ((p - q[j]) + alpha * E * p * (f[j] - fb)); }
        }
      }
      if (mode === 'bias') for (let i = 0; i < E; i++) b[i] += gamma * Math.sign(mean - load[i]);
      for (let i = 0; i < E; i++) s[i] = (1 - RHO) * s[i] + RHO * Math.max(1e-3, Math.min(load[i], cap) / mean);
      out.push({ f, qual, drop: drops / (K * T), maxr: Math.max(...load) / mean, dead: Array.from(load).filter((x) => x < 0.1 * mean).length, gkl });
    }
    return out;
  }
  function runAll() {
    R = MODES.map((M) => run(M.m, sa.value, sg.value, sp.value, seed));
    draw();
  }
  let hoverStep = null;
  const v1 = A.canvas(cv1, { aspect: 0.5 }, (ctx, W, Hh) => {
    if (!R) return;
    const cols = A.series(), lw = 76, gap = 12, rowH = (Hh - 26 - gap * 2) / 3;
    const X = (s) => lw + (s / (STEPS - 1)) * (W - lw - 12);
    MODES.forEach((M, mi) => {
      const y0 = 4 + mi * (rowH + gap);
      A.text(ctx, M.n, lw - 8, y0 + rowH / 2, { size: 12.5, align: 'right', weight: 650, color: A.css(M.c) });
      const run = R[mi];
      for (let i = E - 1; i >= 0; i--) {
        ctx.fillStyle = cols[i]; ctx.beginPath();
        for (let s = 0; s < STEPS; s++) { let acc = 0; for (let j = 0; j <= i; j++) acc += run[s].f[j]; const y = y0 + rowH * (1 - acc); s ? ctx.lineTo(X(s), y) : ctx.moveTo(X(s), y); }
        ctx.lineTo(X(STEPS - 1), y0 + rowH); ctx.lineTo(X(0), y0 + rowH); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = A.css('--axis'); ctx.strokeRect(lw + 0.5, y0 + 0.5, W - lw - 12, rowH);
    });
    const x = X(sv.value); ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, Hh - 24); ctx.stroke();
    A.text(ctx, '0', lw, Hh - 10, { size: 11.5, align: 'center', color: A.css('--muted') });
    A.text(ctx, '训练步 →', (lw + W - 12) / 2, Hh - 10, { size: 11.5, align: 'center', color: A.css('--muted') });
    A.text(ctx, String(STEPS), W - 12, Hh - 10, { size: 11.5, align: 'right', color: A.css('--muted') });
  });
  function lineChart(ctx, W, Hh, key, ymin, ymax, yfmt, title, ref) {
    const box = { x: 46, y: 26, w: W - 58, h: Hh - 66 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: STEPS - 1, ymin, ymax, yfmt, xfmt: (v) => v, xlabel: '训练步', ylabel: title, ylabelOffset: 40 });
    if (ref !== undefined) { ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(ref)); ctx.lineTo(box.x + box.w, ax.Y(ref)); ctx.stroke(); ctx.restore(); }
    MODES.forEach((M, mi) => {
      ctx.strokeStyle = A.css(M.c); ctx.lineWidth = 2; ctx.beginPath();
      R[mi].forEach((p, s) => { const y = ax.Y(A.clamp(p[key], ymin, ymax)); s ? ctx.lineTo(ax.X(s), y) : ctx.moveTo(ax.X(s), y); });
      ctx.stroke();
    });
    const xs = ax.X(sv.value); ctx.strokeStyle = A.css('--muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xs, box.y); ctx.lineTo(xs, box.y + box.h); ctx.stroke();
    return ax;
  }
  let ax2 = null, ax3 = null;
  const v2 = A.canvas(cv2, { aspect: 0.7 }, (ctx, W, Hh) => { if (R) ax2 = lineChart(ctx, W, Hh, 'qual', 0.4, 1.6, (v) => v.toFixed(1), '路由质量（越高越好）'); });
  const v3 = A.canvas(cv3, { aspect: 0.7 }, (ctx, W, Hh) => { if (R) ax3 = lineChart(ctx, W, Hh, 'maxr', 0.8, 4.2, (v) => v.toFixed(1) + '×', '最大负载 ÷ 平均负载', 1); });
  function tipAt(e, cv, ax) {
    if (!R || !ax) return;
    const p = A.pos(cv, e); const s = Math.round(A.clamp(ax.invX(p.x), 0, STEPS - 1));
    A.tip.show(`第 ${s} 步<br>` + MODES.map((M, mi) => `<span style="color:var(${M.c})">■</span> ${M.n}：质量 ${R[mi][s].qual.toFixed(2)}，最大/平均 ${R[mi][s].maxr.toFixed(2)}×，空闲专家 ${R[mi][s].dead}`).join('<br>'), e.clientX, e.clientY);
  }
  cv2.addEventListener('mousemove', (e) => tipAt(e, cv2, ax2)); cv2.addEventListener('mouseleave', () => A.tip.hide());
  cv3.addEventListener('mousemove', (e) => tipAt(e, cv3, ax3)); cv3.addEventListener('mouseleave', () => A.tip.hide());
  cv1.addEventListener('mousemove', (e) => {
    if (!R) return; const p = A.pos(cv1, e); const W = cv1.clientWidth, lw = 76;
    if (p.x < lw) { A.tip.hide(); return; }
    const s = Math.round(A.clamp(((p.x - lw) / (W - lw - 12)) * (STEPS - 1), 0, STEPS - 1));
    A.tip.show(`第 ${s} 步，各专家收到的 token 占比<br>` + MODES.map((M, mi) => `${M.n}：` + R[mi][s].f.map((x) => Math.round(x * 100)).join(' / ') + '%').join('<br>'), e.clientX, e.clientY);
  });
  cv1.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    if (!R) return;
    v1.redraw(); v2.redraw(); v3.redraw();
    const s = Math.round(sv.value);
    stats.innerHTML = '';
    MODES.forEach((M, mi) => {
      const p = R[mi][s];
      stats.append(A.el('div', { class: 'stat', style: { borderTop: `3px solid var(${M.c})`, flex: '1 1 180px' } },
        A.el('div', { class: 'k' }, M.n + `（第 ${s} 步）`),
        A.el('div', { class: 'v', style: { fontSize: '13px', fontWeight: 500, lineHeight: 1.6 }, html: `最大/平均 <b>${p.maxr.toFixed(2)}×</b>，空闲专家 <b>${p.dead}</b> 个<br>丢弃 <b>${A.pct(p.drop, 1)}</b>，路由质量 <b>${p.qual.toFixed(2)}</b><br>门控偏差 <b>${p.gkl.toFixed(3)}</b>` })));
    });
  }
  runAll();
});
