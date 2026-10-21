/* audio-stft — short-time Fourier transform on a synthetic signal: window length trades frequency resolution (harmonics) against time resolution (clicks) */
A.defineDemo('audio-stft', function (mount) {
  const { bd } = A.demo(mount, '窗长的取舍：同一段声音，换一个窗口看', '合成信号，16 kHz：0–0.36 秒是基频 125 Hz 的元音，0.42 秒和 0.45 秒各有一下咔哒声。每 2 毫秒算一帧（实际系统每 10 毫秒），频谱都是实际计算的');
  const FS = 16000, DUR = 0.6, N = Math.round(FS * DUR), F0 = 125, C1 = 0.42, GAP = 0.03, HOP = 32, NFFT = 2048;
  // ---- signal ----
  const formant = (f) => [[700, 130, 1], [1200, 150, 0.6], [2600, 250, 0.25]].reduce((s, [c, bw, a]) => s + a / (1 + ((f - c) / bw) ** 2), 0.02);
  const x = new Float64Array(N);
  let ph = 0;
  for (let n = 0; n < N; n++) {
    const t = n / FS; const f0 = F0 * (1 + 0.012 * Math.sin(2 * Math.PI * 5 * t)); ph += 2 * Math.PI * f0 / FS;
    let v = 0;
    if (t < 0.36) { for (let h = 1; h * F0 < 7800; h++) v += formant(h * F0) * Math.cos(h * ph); v *= Math.min(1, t / 0.02, (0.36 - t) / 0.02); }
    x[n] = v;
  }
  const rn = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; }; })();
  for (let n = 0; n < N; n++) x[n] += 0.002 * rn();
  [C1, C1 + GAP].forEach((tc) => { const n0 = Math.round(tc * FS); for (let k = 0; k < 24; k++) x[n0 + k] += 3 * Math.exp(-k / 4) * (k % 2 ? -1 : 1); });
  let XM = 0; for (let n = 0; n < N; n++) XM = Math.max(XM, Math.abs(x[n]));
  // ---- FFT ----
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a), h = len >> 1;
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < h; k++) { const p = i + k, q = p + h; const vr = re[q] * cr - im[q] * ci, vi = re[q] * ci + im[q] * cr; re[q] = re[p] - vr; im[q] = im[p] - vi; re[p] += vr; im[p] += vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
    }
  }
  function frameMag(centerSample, W) {
    const re = new Float64Array(NFFT), im = new Float64Array(NFFT), s0 = centerSample - (W >> 1);
    for (let i = 0; i < W; i++) { const n = s0 + i; if (n < 0 || n >= N) continue; re[i] = x[n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * (i + 0.5) / W)); }
    fft(re, im);
    const m = new Float64Array(NFFT / 2 + 1); for (let k = 0; k <= NFFT / 2; k++) m[k] = Math.hypot(re[k], im[k]);
    return m;
  }
  const bin = (f) => Math.round(f * NFFT / FS);
  // ---- mel filterbank (80 bands, 0–8 kHz, HTK formula) ----
  const hz2mel = (f) => 2595 * Math.log10(1 + f / 700), mel2hz = (m) => 700 * (Math.pow(10, m / 2595) - 1);
  const NMEL = 80, MMAX = hz2mel(8000);
  const melPts = Array.from({ length: NMEL + 2 }, (_, i) => mel2hz(MMAX * i / (NMEL + 1)));
  const melW = melPts.slice(0, NMEL).map((lo, i) => { const c = melPts[i + 1], hi = melPts[i + 2]; const w = []; for (let k = Math.floor(lo * NFFT / FS); k <= Math.ceil(hi * NFFT / FS); k++) { const f = k * FS / NFFT; const v = f <= c ? (f - lo) / (c - lo) : (hi - f) / (hi - c); if (v > 0) w.push([k, v]); } return w; });
  // ---- spectrogram cache ----
  const NFR = Math.floor(N / HOP), cache = {};
  function spec(ms) {
    if (cache[ms]) return cache[ms];
    const W = Math.round(ms / 1000 * FS), KLIN = bin(4000);
    const lin = [], mel = []; let mx = 1e-12, mmx = 1e-12;
    for (let j = 0; j < NFR; j++) {
      const m = frameMag(j * HOP + HOP / 2, W);
      const col = new Float64Array(KLIN); for (let k = 0; k < KLIN; k++) { col[k] = m[k] * m[k]; if (col[k] > mx) mx = col[k]; }
      const mc = new Float64Array(NMEL); for (let b = 0; b < NMEL; b++) { let s = 0; for (const [k, v] of melW[b]) s += v * m[k] * m[k]; mc[b] = s; if (s > mmx) mmx = s; }
      lin.push(col); mel.push(mc);
    }
    // resolution measures (same as the text): harmonic dip at t = 0.2 s, click dip between the two clicks
    const fm = frameMag(Math.round(0.2 * FS), W); let hd = 0;
    for (let h = 2; h <= 8; h++) { const pk = Math.min(fm[bin(h * F0)], fm[bin((h + 1) * F0)]); hd += 20 * Math.log10(pk / Math.max(fm[bin((h + 0.5) * F0)], 1e-9)); }
    hd /= 7;
    const e = (t) => { const mm = frameMag(Math.round(t * FS), W); let s = 0; for (let k = bin(2000); k < bin(6000); k++) s += mm[k] * mm[k]; return s; };
    const cd = 10 * Math.log10(Math.min(e(C1 + 0.001), e(C1 + GAP + 0.001)) / Math.max(e(C1 + GAP / 2 + 0.001), 1e-12));
    return (cache[ms] = { W, lin, mel, mx, mmx, hd, cd, KLIN });
  }
  // ---- controls ----
  let ms = 25, axis = 'lin';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [4, 8, 16, 25, 32, 50, 64].map((v) => ({ v, t: v + ' ms' })), ms, (v) => { ms = v; draw(); }, '窗长');
  A.seg(ctl, [{ v: 'lin', t: '线性 0–4 kHz' }, { v: 'mel', t: '梅尔 80 频带 0–8 kHz' }], axis, (v) => { axis = v; draw(); }, '频率轴');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const dipTxt = (d) => (d < 0.5 ? '（中间没有凹陷）' : '（凹陷 ' + d.toFixed(0) + ' dB）');
  const verdict = (d) => (d >= 8 ? '分得开' : d >= 3 ? '勉强' : '分不开');
  let lut = null, lutDark = null;
  function buildLut() { const dk = A.isDark(); if (lut && lutDark === dk) return; lutDark = dk; lut = []; for (let i = 0; i < 256; i++) { const m = A.seq(i / 255).match(/\d+/g).map(Number); lut.push(m); } }
  const off = document.createElement('canvas');
  let geo = null;
  const narrow0 = (mount.clientWidth || 800) < 560;
  const view = A.canvas(cv, narrow0 ? { height: 440 } : { aspect: 0.6 }, (ctx, Wc, Hc) => {
    buildLut();
    const narrow = Wc < 560;
    const S = spec(ms), useMel = axis === 'mel';
    const wbox = { x: 52, y: 22, w: Wc - 84, h: 40 };
    const box = { x: 52, y: 90, w: Wc - 84, h: Hc - 90 - 34 };
    geo = { box, useMel, S };
    // waveform strip
    const mid = wbox.y + wbox.h / 2, cols = Math.max(1, Math.floor(wbox.w));
    ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1; ctx.beginPath();
    for (let c = 0; c < cols; c++) { const a = Math.floor(c / cols * N), b = Math.floor((c + 1) / cols * N); let lo = 0, hi = 0; for (let n = a; n < b; n++) { if (x[n] < lo) lo = x[n]; if (x[n] > hi) hi = x[n]; } const sc = wbox.h / 2 / XM; ctx.moveTo(wbox.x + c + 0.5, mid - hi * sc); ctx.lineTo(wbox.x + c + 0.5, mid - lo * sc + 0.5); }
    ctx.stroke();
    A.text(ctx, '波形', wbox.x - 8, mid, { size: 11.5, align: 'right', color: A.css('--muted') });
    // window outline at the vowel and at the clicks: show how wide the window is
    const tw = ms / 1000, X = (t) => box.x + t / DUR * box.w;
    ctx.save(); ctx.strokeStyle = A.css('--accent'); ctx.lineWidth = 1.5;
    [0.2, C1 + GAP / 2].forEach((tc) => { ctx.strokeRect(X(tc - tw / 2), wbox.y - 2, Math.max(2, X(tc + tw / 2) - X(tc - tw / 2)), wbox.h + 4); });
    ctx.restore();
    A.text(ctx, narrow ? '方框 = 窗口长度' : '蓝色方框 = 一个窗口覆盖多长时间', wbox.x + wbox.w, wbox.y - 12, { size: 11, color: A.css('--accent'), align: 'right' });
    const yt = useMel ? [250, 500, 1000, 2000, 4000, 8000].map(hz2mel) : narrow ? [0, 1000, 2000, 3000, 4000] : [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000];
    A.axes(ctx, box, { xmin: 0, xmax: DUR, ymin: 0, ymax: useMel ? MMAX : 4000, xticks: narrow ? [0, 0.2, 0.4, 0.6] : [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], xfmt: (v) => Math.round(v * 1000) + ' ms', yticks: yt, yfmt: useMel ? (m) => (mel2hz(m) >= 1000 ? (mel2hz(m) / 1000).toFixed(0) + 'k' : Math.round(mel2hz(m))) : (v) => (v >= 1000 ? v / 1000 + 'k' : v), ylabel: useMel && !narrow ? '频率（Hz，按梅尔刻度排）' : '频率（Hz）', ylabelOffset: 46 });
    // spectrogram image
    const rows = useMel ? NMEL : S.KLIN, data = useMel ? S.mel : S.lin, mx = useMel ? S.mmx : S.mx;
    off.width = NFR; off.height = rows;
    const oc = off.getContext('2d'), img = oc.createImageData(NFR, rows);
    for (let j = 0; j < NFR; j++) for (let r = 0; r < rows; r++) {
      const db = 10 * Math.log10(data[j][r] / mx + 1e-12), t = A.clamp((db + 55) / 55, 0, 1), c = lut[Math.round(t * 255)];
      const p = ((rows - 1 - r) * NFR + j) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = !useMel; ctx.drawImage(off, box.x, box.y, box.w, box.h); ctx.imageSmoothingEnabled = true;
    A.text(ctx, narrow ? '元音' : '元音：谐波每隔 125 Hz 一根', X(0.18), box.y - 10, { size: 11.5, color: A.css('--ink'), weight: 600, align: 'center' });
    A.text(ctx, narrow ? '两下咔哒' : '两下咔哒，相隔 30 ms', X(C1 + GAP / 2), box.y - 10, { size: 11.5, color: A.css('--ink'), weight: 600, align: 'center' });
  });
  cv.addEventListener('mousemove', (ev) => {
    if (!geo) return; const p = A.pos(cv, ev), { box, useMel, S } = geo;
    if (p.x < box.x || p.x > box.x + box.w || p.y < box.y || p.y > box.y + box.h) { A.tip.hide(); return; }
    const t = (p.x - box.x) / box.w * DUR, j = A.clamp(Math.floor(t * FS / HOP), 0, NFR - 1), fr = (box.y + box.h - p.y) / box.h;
    let txt;
    if (useMel) { const b = A.clamp(Math.floor(fr * NMEL), 0, NMEL - 1); const db = 10 * Math.log10(S.mel[j][b] / S.mmx + 1e-12); txt = `${Math.round(t * 1000)} ms · 第 ${b + 1} 个梅尔频带（中心约 ${Math.round(melPts[b + 1])} Hz，宽约 ${Math.round(melPts[b + 2] - melPts[b])} Hz）· ${db.toFixed(0)} dB`; }
    else { const k = A.clamp(Math.floor(fr * S.KLIN), 0, S.KLIN - 1); const db = 10 * Math.log10(S.lin[j][k] / S.mx + 1e-12); txt = `${Math.round(t * 1000)} ms · ${Math.round(k * FS / NFFT)} Hz · ${db.toFixed(0)} dB（相对最大值）`; }
    A.tip.show(txt, ev.clientX, ev.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    const S = spec(ms);
    stats.innerHTML = '';
    [['窗口点数 N', S.W + ' 点'], ['频率格点间距 f_s/N', (FS / S.W).toFixed(0) + ' Hz'], ['谐波（相隔 125 Hz）', verdict(S.hd) + dipTxt(S.hd)], ['两下咔哒（相隔 30 ms）', verdict(S.cd) + dipTxt(S.cd)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    let h;
    if (ms <= 16) h = `窗长 ${ms} ms 时，频率格点相隔 ${(FS / S.W).toFixed(0)} Hz，Hann 窗的主瓣又占左右各两个格点，相隔 125 Hz 的谐波挤在一起，只看得见几条横向的亮带（共振峰）；竖着的细条纹是声带每开合一次的脉冲，每 8 毫秒一个，窗口越短越清楚。咔哒声则是两条清楚的竖线。语音学里管这种图叫“宽带频谱图”，专门用来看发音的起止。`;
    else if (ms <= 32) h = `窗长 ${ms} ms：谐波一根根分开了，两下咔哒也还分得开。语音系统的标准设置就是 25 ms 窗、10 ms 步长，正好落在这个区间。`;
    else if (S.cd >= 3) h = `窗长 ${ms} ms：谐波更清楚了，但窗口的有效宽度（约窗长的一半，${ms / 2} ms）已经接近两下咔哒的间隔（30 ms），两条竖线开始连在一起，只是刚刚还能分开（凹陷 ${S.cd.toFixed(0)} dB）。频率分得越细，时间就分得越粗，这就是时间–频率分辨率的取舍。`;
    else h = `窗长 ${ms} ms：谐波最清楚，但窗口的有效宽度（约 ${ms / 2} ms）已经超过两下咔哒的间隔（30 ms），两条竖线被抹成一条宽带，时间上分不清了。频率分得越细，时间就分得越粗，这就是时间–频率分辨率的取舍。`;
    if (axis === 'mel') h += ' 切到梅尔轴后，低频的频带很窄（1 kHz 以下约 28 个），单根谐波还看得出来；约 1.3 kHz 以上一个频带装下不止一根谐波，只剩包络。80 个频带里只有约 20 个分给 4–8 kHz。';
    hint.textContent = h;
    view.redraw();
  }
  draw();
});
