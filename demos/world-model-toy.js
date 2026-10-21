/* world-model-toy — interactive demo (moved from ch13-video.html) */
A.defineDemo('world-model-toy', function (mount) {
  const { bd } = A.demo(mount, '玩具世界模型：用方向键“玩”一个由扩散生成的画面', '每一帧都由去噪生成，条件 = 上一帧 + 你的动作');
  const S = 24, FD = S * S * 3, SIG = 0.06;
  const off = document.createElement('canvas'); off.width = off.height = S;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const P = [4, 6, 8, 10, 12, 14, 16, 18, 20];
  const frames = [];
  P.forEach((y) => P.forEach((x) => {
    const g = octx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#cfe3f8'); g.addColorStop(1, '#eef6e4');
    octx.fillStyle = g; octx.fillRect(0, 0, S, S);
    octx.fillStyle = '#6b8f4e'; octx.fillRect(17, 15, 2, 6); octx.fillStyle = '#1baf7a'; octx.beginPath(); octx.arc(18, 13, 3.2, 0, 7); octx.fill();
    octx.fillStyle = '#c9a36b'; octx.fillRect(2, 15, 6, 5); octx.fillStyle = '#e34948'; octx.beginPath(); octx.moveTo(1, 15); octx.lineTo(5, 11); octx.lineTo(9, 15); octx.fill();
    octx.fillStyle = '#eb6834'; octx.beginPath(); octx.arc(x, y, 2.6, 0, 7); octx.fill();
    octx.fillStyle = '#0b0b0b'; octx.fillRect(x, y - 1, 1, 1);
    const px = octx.getImageData(0, 0, S, S).data, v = new Float32Array(FD);
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) v[i * 3 + c] = px[i * 4 + c] / 127.5 - 1;
    frames.push({ v, x: P.indexOf(x), y: P.indexOf(y) });
  }));
  const idx = (x, y) => A.clamp(y, 0, 8) * 9 + A.clamp(x, 0, 8);
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const stepsS = A.slider(ctl, { label: '每帧去噪步数', min: 1, max: 12, step: 1, value: 6, fmt: (v) => v + (v <= 2 ? '（很快，但会糊）' : ''), on: () => {} });
  const ctxS = A.slider(ctl, { label: '上下文模糊度', min: 0.02, max: 0.4, step: 0.01, value: 0.06, fmt: (v) => v.toFixed(2) + (v > 0.15 ? '（看不清上一帧）' : ''), on: () => {} });
  const wrap = A.el('div', { class: 'flex', style: { alignItems: 'flex-start', gap: '20px' } }); bd.append(wrap);
  const big = A.el('canvas', { id: 'wm-big', class: 'pixel' }); big.width = big.height = S;
  const pad = A.el('div', { class: 'pad' });
  const hist = A.el('div', { class: 'film', style: { maxWidth: '420px' } });
  const info = A.el('div', { class: 'small', style: { marginTop: '8px' } });
  [['', null], ['↑', [0, -1]], ['', null], ['←', [-1, 0]], ['·', [0, 0]], ['→', [1, 0]], ['', null], ['↓', [0, 1]], ['', null]].forEach(([t, a]) => pad.append(a ? A.el('button', { onclick: () => act(a) }, t) : A.el('span')));
  wrap.append(big, A.el('div', null, A.el('div', { class: 'small muted', style: { marginBottom: '6px' } }, '动作（也可以点画面后用键盘方向键）'), pad, A.el('button', { style: { marginTop: '8px' }, onclick: reset }, '重置世界'), info, A.el('div', { class: 'small muted', style: { marginTop: '10px' } }, '最近的帧'), hist));
  bd.append(A.el('p', { class: 'hint' }, '模型并不知道橙色小球的“坐标”，它只看到上一帧的图像。它先判断上一帧最像哪些训练帧，再按动作去噪出下一帧。把上下文模糊度调大（看不清上一帧）再多按几次：步数少（1–2 步）时画面变糊、小球分裂成虚影，而且糊掉的帧又成为下一帧的条件，之后很难再变清晰；步数多时画面清晰，但小球可能“瞬移”到错误的位置。这两种都是自回归世界模型真实存在的误差累积。'));
  let cur, r = A.rng(3), history = [];
  function put(cv, v) { const c = cv.getContext('2d'), id = c.createImageData(S, S); for (let i = 0; i < S * S; i++) { for (let k = 0; k < 3; k++) id.data[i * 4 + k] = A.clamp((v[i * 3 + k] + 1) * 127.5, 0, 255); id.data[i * 4 + 3] = 255; } c.putImageData(id, 0, 0); }
  function reset() { cur = frames[idx(4, 4)].v.slice(); history = [cur]; render(); }
  function act(a) {
    // context weights over source frames
    const tau = ctxS.value;
    const lp = frames.map((f) => { let e = 0; for (let i = 0; i < FD; i++) { const d = cur[i] - f.v[i]; e += d * d; } return -(e / FD) / (2 * tau * tau); });
    const targets = frames.map((f) => frames[idx(f.x + a[0], f.y + a[1])].v);
    const steps = stepsS.value;
    let x = Float32Array.from({ length: FD }, () => A.gauss(r));
    for (let k = 0; k < steps; k++) {
      const t = 1 - k / steps, s = 1 - (k + 1) / steps, aa = 1 - t, b = t;
      const v = aa * aa * SIG * SIG + b * b, kk = (aa * SIG * SIG) / v;
      const lw = targets.map((m, j) => { let e = 0; for (let i = 0; i < FD; i++) { const d = x[i] - aa * m[i]; e += d * d; } return lp[j] - e / (2 * v); });
      const mx = Math.max(...lw), x0 = new Float32Array(FD); let ssum = 0;
      lw.forEach((l, j) => { const w = Math.exp(l - mx); if (w < 1e-9) return; ssum += w; const m = targets[j]; for (let i = 0; i < FD; i++) x0[i] += w * m[i]; });
      for (let i = 0; i < FD; i++) { x0[i] = (x0[i] / ssum) * (1 - kk * aa) + kk * x[i]; const eps = (x[i] - aa * x0[i]) / b; x[i] = (1 - s) * x0[i] + s * eps; }
    }
    cur = x; history.push(cur); if (history.length > 12) history.shift();
    render();
  }
  function render() {
    put(big, cur);
    hist.innerHTML = '';
    history.forEach((h) => { const c = A.el('canvas', { class: 'pixel', style: { width: '40px', height: '40px' } }); c.width = c.height = S; put(c, h); hist.append(c); });
    // sharpness: distance to nearest clean frame
    let best = Infinity; frames.forEach((f) => { let e = 0; for (let i = 0; i < FD; i++) { const d = cur[i] - f.v[i]; e += d * d; } best = Math.min(best, e); });
    info.innerHTML = `与最近的“真实”画面的偏差：<b>${Math.sqrt(best / FD).toFixed(3)}</b>（越大越糊）`;
  }
  big.tabIndex = 0;
  big.addEventListener('keydown', (e) => { const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (m) { e.preventDefault(); act(m); } });
  reset();
});
