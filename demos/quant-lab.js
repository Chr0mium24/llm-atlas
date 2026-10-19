/* quant-lab — interactive demo (moved from ch09-quantization.html) */
A.defineDemo('quant-lab', function (mount) {
  const { FMT, encFloat, nearestE2M1, E2M1, NF4 } = A.num;
  const { bd } = A.demo(mount, '量化实验室：同一个矩阵，12 种量化方法', '64×256 权重 · 32 个激活样本');
  const R = 64, C = 256, NS = 32;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const oS = A.slider(ctl, { label: '权重离群强度', min: 0, max: 1, step: 0.01, value: 0.5, fmt: (v) => v.toFixed(2), on: A.debounce(() => { gen(); run(); }, 40) });
  const aS = A.slider(ctl, { label: '激活离群强度', min: 0, max: 1, step: 0.01, value: 0.5, fmt: (v) => v.toFixed(2), on: A.debounce(() => { gen(); run(); }, 40) });
  const opt = A.el('div', { class: 'flex', style: { marginBottom: '8px' } }); bd.append(opt);
  let useH = false, useAWQ = false, seed = 1;
  A.check(opt, 'Hadamard 旋转（QuIP# / Bonsai 2 式）', false, (v) => { useH = v; run(); });
  A.check(opt, 'AWQ 式按激活缩放', false, (v) => { useAWQ = v; run(); });
  opt.append(A.el('button', { onclick: () => { seed++; gen(); run(); } }, '换一个随机矩阵'));
  const tbl = A.el('div', { class: 'tablewrap' }); bd.append(tbl);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  legend.innerHTML = '<span><i style="background:var(--muted);border-radius:50%"></i>原始权重</span><span><i style="background:var(--s1);border-radius:50%"></i>量化后（反量化回浮点）</span><span><i class="line" style="background:var(--s8)"></i>误差</span><span>虚线 = 分组边界</span>';

  let W, X, Y, sel = 'q4k';
  function gen() {
    const r = A.rng(seed * 101);
    const os = oS.value, as = aS.value;
    const wCol = new Float64Array(C).fill(1), aCol = new Float64Array(C).fill(1);
    [5, 40, 77, 130, 200, 233].forEach((j) => (wCol[j] = 1 + 12 * os));
    [5, 21, 77, 99, 160, 201, 240, 250].forEach((j) => (aCol[j] = 1 + 30 * as));
    W = Array.from({ length: R }, () => Float64Array.from({ length: C }, (_, j) => A.gauss(r) * 0.02 * wCol[j] * (r() < 0.004 * (1 + 4 * os) ? 1 + 10 * os : 1)));
    X = Array.from({ length: NS }, () => Float64Array.from({ length: C }, (_, j) => A.gauss(r) * aCol[j]));
    Y = X.map((x) => W.map((w) => A.dot(w, x)));
  }
  // --- transforms
  const signs = (() => { const r = A.rng(777); return Float64Array.from({ length: C }, () => (r() < 0.5 ? -1 : 1)); })();
  function fwht(a) { const n = a.length; for (let h = 1; h < n; h *= 2) for (let i = 0; i < n; i += h * 2) for (let j = i; j < i + h; j++) { const x = a[j], y = a[j + h]; a[j] = x + y; a[j + h] = x - y; } const s = 1 / Math.sqrt(n); for (let i = 0; i < n; i++) a[i] *= s; return a; }
  const rot = (v) => fwht(Float64Array.from(v, (x, i) => x * signs[i]));
  // --- quantizers: take row (Float64Array), return dequantized row
  function groups(row, g, fn) { const o = new Float64Array(row.length); for (let s = 0; s < row.length; s += g) { const blk = row.subarray(s, s + g); const q = fn(blk); for (let i = 0; i < q.length; i++) o[s + i] = q[i]; } return o; }
  const amax = (b) => { let m = 0; for (const x of b) m = Math.max(m, Math.abs(x)); return m; };
  const symInt = (b, qmax, sc) => Float64Array.from(b, (x) => sc ? A.clamp(Math.round(x / sc), -qmax, qmax) * sc : 0);
  const fp16 = (v) => encFloat(v, FMT.fp16).v;
  function q4_0(b) { let m = 0; for (const x of b) if (Math.abs(x) > Math.abs(m)) m = x; const d = fp16(m / -8); return Float64Array.from(b, (x) => (d ? A.clamp(Math.round(x / d), -8, 7) * d : 0)); }
  function kquantAsym(row, sub, bitsQ, bitsS) { // Q4_K / Q2_K style: x ≈ d*sc*q - dmin*m
    const qmax = (1 << bitsQ) - 1, smax = (1 << bitsS) - 1, n = row.length / sub;
    const scales = [], mins = [];
    for (let k = 0; k < n; k++) { const b = row.subarray(k * sub, (k + 1) * sub); let lo = Infinity, hi = -Infinity; for (const x of b) { lo = Math.min(lo, x); hi = Math.max(hi, x); } lo = Math.min(lo, 0); scales.push((hi - lo) / qmax); mins.push(-lo); }
    const d = fp16(Math.max(...scales) / smax), dmin = fp16(Math.max(...mins) / smax);
    const o = new Float64Array(row.length);
    for (let k = 0; k < n; k++) {
      const sc = d ? Math.round(scales[k] / d) : 0, m = dmin ? Math.round(mins[k] / dmin) : 0;
      const step = d * Math.max(sc, 1), off = dmin * m;
      for (let i = k * sub; i < (k + 1) * sub; i++) o[i] = A.clamp(Math.round((row[i] + off) / step), 0, qmax) * step - off;
    }
    return o;
  }
  function kquantSym(row, sub, qlo, qhi, bitsS) { // Q3_K / Q6_K style signed scales
    const n = row.length / sub, smax = (1 << (bitsS - 1)) - 1;
    const ds = [];
    for (let k = 0; k < n; k++) { let m = 0; for (let i = k * sub; i < (k + 1) * sub; i++) if (Math.abs(row[i]) > Math.abs(m)) m = row[i]; ds.push(m / qlo); }
    const D = fp16(amax(ds) / smax);
    const o = new Float64Array(row.length);
    for (let k = 0; k < n; k++) { const dk = D ? Math.round(ds[k] / D) * D : 0; for (let i = k * sub; i < (k + 1) * sub; i++) o[i] = dk ? A.clamp(Math.round(row[i] / dk), qlo, qhi) * dk : 0; }
    return o;
  }
  function mxfp4(b) { const m = amax(b); if (!m) return new Float64Array(b.length); const X = Math.pow(2, Math.floor(Math.log2(m)) - 2); return Float64Array.from(b, (x) => nearestE2M1(x / X) * X); }
  let gScale = 1;
  function nvfp4(b) { const m = amax(b); if (!m) return new Float64Array(b.length); const s = encFloat(m / 6 / gScale, FMT.e4m3).v * gScale; return Float64Array.from(b, (x) => (s ? nearestE2M1(x / s) * s : 0)); }
  function ternTWN(b) {
    const ma = A.mean(Array.from(b, Math.abs)); let best = null;
    for (let t = 0.3; t <= 1.3; t += 0.1) {
      const th = t * ma; let sa = 0, n = 0; for (const x of b) if (Math.abs(x) > th) { sa += Math.abs(x); n++; }
      const al = n ? fp16(sa / n) : 0; let err = 0; const q = Float64Array.from(b, (x) => (Math.abs(x) > th ? Math.sign(x) * al : 0));
      for (let i = 0; i < b.length; i++) err += (q[i] - b[i]) ** 2;
      if (!best || err < best.err) best = { err, q };
    }
    return best.q;
  }
  function binary(b) { const al = fp16(A.mean(Array.from(b, Math.abs))); return Float64Array.from(b, (x) => (x >= 0 ? al : -al)); }
  const METHODS = [
    { k: 'int8t', n: 'INT8 逐张量', bpw: 8, g: C, tensor: (M) => { const s = Math.max(...M.map(amax)) / 127; return M.map((w) => symInt(w, 127, s)); } },
    { k: 'int4t', n: 'INT4 逐张量', bpw: 4, g: C, tensor: (M) => { const s = Math.max(...M.map(amax)) / 7; return M.map((w) => symInt(w, 7, s)); } },
    { k: 'int4c', n: 'INT4 逐通道', bpw: 4.06, g: C, row: (w) => symInt(w, 7, amax(w) / 7) },
    { k: 'q4_0', n: 'Q4_0（组 32）', bpw: 4.5, g: 32, row: (w) => groups(w, 32, q4_0) },
    { k: 'q4k', n: 'Q4_K（超块 256 = 8×32）', bpw: 4.5, g: 32, row: (w) => kquantAsym(w, 32, 4, 6) },
    { k: 'q3k', n: 'Q3_K（超块 256 = 16×16）', bpw: 3.44, g: 16, row: (w) => kquantSym(w, 16, -4, 3, 6) },
    { k: 'q2k', n: 'Q2_K（超块 256 = 16×16）', bpw: 2.63, g: 16, row: (w) => kquantAsym(w, 16, 2, 4) },
    { k: 'mxfp4', n: 'MXFP4（组 32，E8M0 缩放）', bpw: 4.25, g: 32, row: (w) => groups(w, 32, mxfp4) },
    { k: 'nvfp4', n: 'NVFP4（组 16，E4M3 缩放）', bpw: 4.5, g: 16, row: (w) => groups(w, 16, nvfp4) },
    { k: 'tern', n: '三值 逐张量 absmean（BitNet b1.58）', bpw: 1.58, g: C, tensor: (M) => { let s = 0; M.forEach((w) => w.forEach((x) => (s += Math.abs(x)))); const g = s / (R * C); return M.map((w) => Float64Array.from(w, (x) => A.clamp(Math.round(x / g), -1, 1) * g)); } },
    { k: 'tern128', n: '三值 组 128（Ternary Bonsai 式）', bpw: 1.71, g: 128, row: (w) => groups(w, 128, ternTWN) },
    { k: 'bin128', n: '二值 组 128（1-bit Bonsai Q1_0 式）', bpw: 1.125, g: 128, row: (w) => groups(w, 128, binary) },
  ];
  let results = [], cache = {};
  function run() {
    // pre-transforms
    let s = null;
    if (useAWQ) { s = new Float64Array(C); for (let j = 0; j < C; j++) { let m = 0; X.forEach((x) => (m += Math.abs(x[j]))); s[j] = Math.sqrt(m / NS); } const gm = Math.exp(A.mean(Array.from(s, Math.log))); for (let j = 0; j < C; j++) s[j] /= gm; }
    let Wt = W.map((w) => Float64Array.from(w, (x, j) => (s ? x * s[j] : x)));
    let Xt = X.map((x) => Float64Array.from(x, (v, j) => (s ? v / s[j] : v)));
    if (useH) { Wt = Wt.map(rot); Xt = Xt.map(rot); }
    gScale = Math.max(...Wt.map(amax)) / (6 * 448);
    const yn = Math.sqrt(A.sum(Y.map((y) => A.sum(y.map((v) => v * v)))));
    const wn = Math.sqrt(A.sum(W.map((w) => A.dot(w, w))));
    results = METHODS.map((m) => {
      const Q = m.tensor ? m.tensor(Wt) : Wt.map(m.row);
      let e = 0; Xt.forEach((x, i) => Q.forEach((q, r) => { e += (A.dot(q, x) - Y[i][r]) ** 2; }));
      let we = 0; Q.forEach((q, r) => q.forEach((v, j) => (we += (v - Wt[r][j]) ** 2)));
      cache[m.k] = { Q, Wt };
      return { m, out: Math.sqrt(e) / yn, w: Math.sqrt(we) / wn };
    });
    drawTable(); view.redraw();
  }
  function drawTable() {
    const mx = Math.max(...results.map((r) => r.out), 0.05);
    tbl.innerHTML = '';
    const t = A.el('table', { id: 'qtable' });
    t.append(A.el('tr', null, A.el('th', null, '方法'), A.el('th', { class: 'num' }, 'bpw'), A.el('th', { class: 'num' }, '权重相对误差'), A.el('th', null, '输出相对误差 ‖Wx−Ŵx‖/‖Wx‖'), A.el('th', { class: 'num' }, '70B 模型大小')));
    results.forEach((r) => {
      const c = r.out < 0.05 ? 'var(--s3)' : r.out < 0.15 ? 'var(--s1)' : r.out < 0.4 ? 'var(--s4)' : 'var(--s8)';
      const tr = A.el('tr', { class: r.m.k === sel ? 'on' : '', onclick: () => { sel = r.m.k; drawTable(); view.redraw(); } },
        A.el('td', null, r.m.n), A.el('td', { class: 'num' }, r.m.bpw.toFixed(2)), A.el('td', { class: 'num' }, A.pct(r.w, 1)),
        A.el('td', null, A.el('div', { class: 'flex', style: { gap: '8px', flexWrap: 'nowrap' } }, A.el('div', { class: 'meter grow' }, A.el('div', { style: { width: Math.min(100, (r.out / mx) * 100) + '%', background: c } })), A.el('span', { class: 'mono small', style: { minWidth: '52px', textAlign: 'right' } }, A.pct(r.out, 1)))),
        A.el('td', { class: 'num' }, A.bytes((70e9 * r.m.bpw) / 8)));
      t.append(tr);
    });
    tbl.append(t);
  }
  const view = A.canvas(cv, { aspect: 0.3 }, (ctx, Wd, H) => {
    const c = cache[sel]; if (!c) return;
    // pick row with largest single weight
    let rr = 0, best = 0; c.Wt.forEach((w, i) => { const m = amax(w); if (m > best) { best = m; rr = i; } });
    const n = 96, row = c.Wt[rr], q = c.Q[rr];
    let m = 0; for (let j = 0; j < n; j++) m = Math.max(m, Math.abs(row[j]), Math.abs(q[j]));
    const box = { x: 10, y: 22, w: Wd - 20, h: H - 34 };
    const X0 = (j) => box.x + (j + 0.5) * (box.w / n), Yv = (v) => box.y + box.h / 2 - (v / m) * (box.h / 2);
    ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(box.x, Yv(0)); ctx.lineTo(box.x + box.w, Yv(0)); ctx.stroke();
    const meth = METHODS.find((x) => x.k === sel);
    if (meth.g < n) { ctx.setLineDash([3, 4]); ctx.strokeStyle = A.css('--muted'); for (let g = meth.g; g < n; g += meth.g) { const x = box.x + g * (box.w / n); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); } ctx.setLineDash([]); }
    for (let j = 0; j < n; j++) {
      ctx.strokeStyle = A.alpha(A.css('--s8'), 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X0(j), Yv(row[j])); ctx.lineTo(X0(j), Yv(q[j])); ctx.stroke();
      ctx.fillStyle = A.css('--muted'); ctx.beginPath(); ctx.arc(X0(j), Yv(row[j]), 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = A.css('--s1'); ctx.beginPath(); ctx.arc(X0(j), Yv(q[j]), 2.6, 0, 7); ctx.fill();
    }
    A.text(ctx, `${meth.n}：第 ${rr + 1} 行的前 ${n} 个权重${useH ? '（旋转后）' : ''}${useAWQ ? '（AWQ 缩放后）' : ''}`, box.x, 10, { size: 12, color: A.css('--ink-2') });
  });
  gen(); run();
});
