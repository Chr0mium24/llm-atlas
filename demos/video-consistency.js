/* video-consistency — interactive demo (moved from ch13-video.html) */
A.defineDemo('video-consistency', function (mount) {
  const { bd } = A.demo(mount, '三种生成方式：逐帧独立 / 时空联合 / 自回归', '72 段训练视频 · 8 帧 · 24×24');
  const S = 24, F = 8, FD = S * S * 3, CD = FD * F, SIG = 0.08;
  const SH = ['圆', '方块', '三角', '星星'], CO = [['红', '#e34948'], ['蓝', '#2a78d6'], ['绿', '#1baf7a']];
  const MO = [['→ 向右', [1.6, 0]], ['← 向左', [-1.6, 0]], ['↓ 下落', [0, 1.6]], ['↑ 上升', [0, -1.6]], ['↘ 斜飞', [1.2, 1.2]], ['⤻ 弹跳', 'bounce']];
  const off = document.createElement('canvas'); off.width = off.height = S;
  const octx = off.getContext('2d', { willReadFrequently: true });
  function shape(sh, cx, cy, r) {
    octx.beginPath();
    if (sh === 0) octx.arc(cx, cy, r, 0, 7);
    if (sh === 1) octx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
    if (sh === 2) { octx.moveTo(cx, cy - r); octx.lineTo(cx + r, cy + r * 0.8); octx.lineTo(cx - r, cy + r * 0.8); octx.closePath(); }
    if (sh === 3) for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? octx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : octx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    octx.fill();
  }
  function frame(sh, co, x, y) {
    const g = octx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#cfe3f8'); g.addColorStop(1, '#f7f4ec');
    octx.fillStyle = g; octx.fillRect(0, 0, S, S);
    octx.fillStyle = '#b9b3a3'; octx.fillRect(0, S - 3, S, 3);
    octx.fillStyle = CO[co][1]; shape(sh, x, y, 4.2);
    const px = octx.getImageData(0, 0, S, S).data, v = new Float32Array(FD);
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) v[i * 3 + c] = px[i * 4 + c] / 127.5 - 1;
    return v;
  }
  const clips = [];
  for (let sh = 0; sh < 4; sh++) for (let co = 0; co < 3; co++) for (let mo = 0; mo < 6; mo++) {
    const v = new Float32Array(CD), m = MO[mo][1];
    for (let f = 0; f < F; f++) {
      let x, y;
      if (m === 'bounce') { x = 5 + f * 2; y = 17 - 12 * Math.abs(Math.sin((f / (F - 1)) * Math.PI * 1.5)); }
      else { x = 12 + m[0] * (f - 3.5) * 1.15; y = 12 + m[1] * (f - 3.5) * 1.15; }
      v.set(frame(sh, co, x, y), f * FD);
    }
    let n2 = 0; for (let i = 0; i < CD; i++) n2 += v[i] * v[i];
    clips.push({ v, n2, sh, co, mo });
  }
  // ---- UI
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let csh = 0, cco = 0, cmo = -1;
  A.seg(ctl, [{ v: -1, t: '任意' }, ...SH.map((n, i) => ({ v: i, t: n }))], csh, (v) => { csh = v; run(); }, '形状');
  A.seg(ctl, [{ v: -1, t: '任意' }, ...CO.map((c, i) => ({ v: i, t: c[0] }))], cco, (v) => { cco = v; run(); }, '颜色');
  A.seg(ctl, [{ v: -1, t: '任意' }, ...MO.map((m, i) => ({ v: i, t: m[0] }))], cmo, (v) => { cmo = v; run(); }, '运动');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const stepsS = A.slider(ctl2, { label: '去噪步数', min: 2, max: 30, step: 1, value: 16, fmt: (v) => v, on: A.debounce(run, 150) });
  let seed = 1;
  ctl2.append(A.el('button', { class: 'primary', onclick: () => { seed++; run(); } }, '重新生成'));
  const rows = ['逐帧独立（图像模型逐帧生成）', '时空联合（视频扩散）', '自回归逐帧（以前面的帧为条件）'].map((t) => {
    const r = A.el('div', { class: 'vrow' }), lab = A.el('div', { class: 'lab' }, t), film = A.el('div', { class: 'film' });
    const play = A.el('canvas', { class: 'play pixel' }); play.width = play.height = S;
    const fr = Array.from({ length: F }, () => { const c = A.el('canvas', { class: 'pixel' }); c.width = c.height = S; return c; });
    film.append(play, ...fr); r.append(lab, film); bd.append(r);
    return { play, fr, data: null };
  });
  bd.append(A.el('p', { class: 'hint' }, '左侧大图循环播放，右侧是 8 帧胶片。可以把“运动”设为“任意”：时空联合每次挑一种运动并保持；逐帧独立的每帧可能来自不同的运动轨迹，物体会乱跳。'));
  function put(cv, v, off0) {
    const ctx = cv.getContext('2d'), id = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { for (let c = 0; c < 3; c++) id.data[i * 4 + c] = A.clamp((v[off0 + i * 3 + c] + 1) * 127.5, 0, 255); id.data[i * 4 + 3] = 255; }
    ctx.putImageData(id, 0, 0);
  }
  const lw = new Float64Array(clips.length * F);
  // generic posterior-mean denoise over a list of components (arrays with offset), with optional log-prior
  function denoise(x, a, b, comps, prior) {
    const v = a * a * SIG * SIG + b * b, kk = (a * SIG * SIG) / v, D = x.length;
    let xn = 0; for (let i = 0; i < D; i++) xn += x[i] * x[i];
    let mx = -Infinity;
    comps.forEach((c, k) => { let d = 0, n2 = 0; const arr = c.arr, o = c.off; for (let i = 0; i < D; i++) { const m = arr[o + i]; d += x[i] * m; n2 += m * m; } lw[k] = -(xn - 2 * a * d + a * a * n2) / (2 * v) + (prior ? prior[k] : 0); if (lw[k] > mx) mx = lw[k]; });
    const out = new Float32Array(D); let s = 0;
    comps.forEach((c, k) => { const w = Math.exp(lw[k] - mx); if (w < 1e-9) return; s += w; const arr = c.arr, o = c.off; for (let i = 0; i < D; i++) out[i] += w * arr[o + i]; });
    for (let i = 0; i < D; i++) out[i] = (out[i] / s) * (1 - kk * a) + kk * x[i];
    return out;
  }
  function sampleRF(D, comps, steps, r, prior) {
    let x = Float32Array.from({ length: D }, () => A.gauss(r));
    for (let k = 0; k < steps; k++) {
      const t = 1 - k / steps, s = 1 - (k + 1) / steps, a = 1 - t, b = t;
      const x0 = denoise(x, a, b, comps, prior);
      for (let i = 0; i < D; i++) { const eps = (x[i] - a * x0[i]) / b; x[i] = (1 - s) * x0[i] + s * eps; }
    }
    return x;
  }
  function run() {
    const sel = clips.filter((c) => (csh < 0 || c.sh === csh) && (cco < 0 || c.co === cco) && (cmo < 0 || c.mo === cmo));
    const steps = Math.round(stepsS.value), r = A.rng(seed * 97);
    // 1) per-frame independent: components = all frames of selected clips
    const frameComps = []; sel.forEach((c) => { for (let f = 0; f < F; f++) frameComps.push({ arr: c.v, off: f * FD }); });
    const indep = new Float32Array(CD);
    for (let f = 0; f < F; f++) indep.set(sampleRF(FD, frameComps, steps, r), f * FD);
    // 2) joint
    const joint = sampleRF(CD, sel.map((c) => ({ arr: c.v, off: 0 })), steps, r);
    // 3) autoregressive: frame f conditioned on generated frames < f
    const ar = new Float32Array(CD);
    for (let f = 0; f < F; f++) {
      const prior = sel.map((c) => { let e = 0; for (let g = 0; g < f; g++) for (let i = 0; i < FD; i++) { const d = ar[g * FD + i] - c.v[g * FD + i]; e += d * d; } return -e / (2 * 0.3 * 0.3); });
      ar.set(sampleRF(FD, sel.map((c) => ({ arr: c.v, off: f * FD })), steps, r, prior), f * FD);
    }
    [indep, joint, ar].forEach((v, k) => { rows[k].data = v; rows[k].fr.forEach((cv, f) => put(cv, v, f * FD)); });
  }
  let tick = 0;
  setInterval(() => { tick = (tick + 1) % F; rows.forEach((rw) => rw.data && put(rw.play, rw.data, tick * FD)); }, 220);
  run();
});
