/* toy-t2i — interactive demo (moved from ch12-image.html) */
A.defineDemo('toy-t2i', function (mount) {
  const { bd } = A.demo(mount, '玩具文生图 + 图生图', '流匹配 · CFG · 精确最优去噪器 · 150 张训练图');
  const S = 32, D = S * S * 3;
  const SHAPES = ['圆', '方块', '三角', '星星', '爱心'], COLORS = [['红', '#e34948'], ['蓝', '#2a78d6'], ['绿', '#1baf7a'], ['黄', '#eda100'], ['紫', '#6250d6']];
  const POS = [[16, 16, 10.5], [11, 12, 7], [21, 20, 8]];
  const off = document.createElement('canvas'); off.width = off.height = S;
  const octx = off.getContext('2d', { willReadFrequently: true });
  function drawShape(ctx, shape, cx, cy, r) {
    ctx.beginPath();
    if (shape === 0) ctx.arc(cx, cy, r, 0, 7);
    if (shape === 1) ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
    if (shape === 2) { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.95, cy + r * 0.75); ctx.lineTo(cx - r * 0.95, cy + r * 0.75); ctx.closePath(); }
    if (shape === 3) for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    if (shape === 4) { const s = r / 10; ctx.moveTo(cx, cy + 8 * s); ctx.bezierCurveTo(cx - 12 * s, cy - 1 * s, cx - 7 * s, cy - 11 * s, cx, cy - 4 * s); ctx.bezierCurveTo(cx + 7 * s, cy - 11 * s, cx + 12 * s, cy - 1 * s, cx, cy + 8 * s); }
    ctx.fill();
  }
  const imgs = [];
  for (let sh = 0; sh < 5; sh++) for (let co = 0; co < 5; co++) for (let bg = 0; bg < 2; bg++) for (let po = 0; po < 3; po++) {
    const g = octx.createLinearGradient(0, 0, 0, S);
    if (bg === 0) { g.addColorStop(0, '#bcdcfb'); g.addColorStop(1, '#f6f9fc'); } else { g.addColorStop(0, '#060c1c'); g.addColorStop(1, '#1b2a4a'); }
    octx.fillStyle = g; octx.fillRect(0, 0, S, S);
    if (bg === 1) { octx.fillStyle = '#e8ecf5'; [[4, 5], [27, 4], [6, 26], [28, 27], [15, 3]].forEach(([x, y]) => octx.fillRect(x, y, 1, 1)); }
    octx.fillStyle = COLORS[co][1];
    drawShape(octx, sh, POS[po][0], POS[po][1], POS[po][2]);
    const px = octx.getImageData(0, 0, S, S).data, v = new Float32Array(D);
    for (let i = 0; i < S * S; i++) for (let c = 0; c < 3; c++) v[i * 3 + c] = px[i * 4 + c] / 127.5 - 1;
    let n2 = 0; for (let i = 0; i < D; i++) n2 += v[i] * v[i];
    imgs.push({ v, n2, sh, co, bg, po });
  }
  const SIG = 0.1;
  // ---- parse prompt
  function parse(p) {
    const c = { sh: -1, co: -1, bg: -1, po: -1 };
    const ps = p.replace(/星空/g, ''); // “星空”只表示夜晚，不算形状
    [[/圆|circle/i, 0], [/方|square/i, 1], [/三角|triangle/i, 2], [/星|star/i, 3], [/心|heart/i, 4]].forEach(([re, i]) => { if (re.test(ps) && c.sh < 0) c.sh = i; });
    [[/红|red/i, 0], [/蓝|blue/i, 1], [/绿|green/i, 2], [/黄|yellow/i, 3], [/紫|purple/i, 4]].forEach(([re, i]) => { if (re.test(p) && c.co < 0) c.co = i; });
    if (/夜|晚上|黑|night|dark|星空/i.test(p)) c.bg = 1; else if (/白天|天空|蓝天|day|sky/i.test(p)) c.bg = 0;
    if (/左上|upper left/i.test(p)) c.po = 1; else if (/右下|lower right/i.test(p)) c.po = 2; else if (/中间|居中|大|center|big/i.test(p)) c.po = 0;
    return c;
  }
  const match = (im, c) => (c.sh < 0 || im.sh === c.sh) && (c.co < 0 || im.co === c.co) && (c.bg < 0 || im.bg === c.bg) && (c.po < 0 || im.po === c.po);
  // ---- denoiser: returns [x0_uncond, x0_cond]
  const lw = new Float64Array(imgs.length);
  function denoise(x, a, b, mask) {
    const v = a * a * SIG * SIG + b * b;
    let xn = 0; for (let i = 0; i < D; i++) xn += x[i] * x[i];
    for (let k = 0; k < imgs.length; k++) { const m = imgs[k].v; let d = 0; for (let i = 0; i < D; i++) d += x[i] * m[i]; lw[k] = -(xn - 2 * a * d + a * a * imgs[k].n2) / (2 * v); }
    const kk = (a * SIG * SIG) / v;
    const post = (useMask) => {
      let mx = -Infinity; for (let k = 0; k < imgs.length; k++) if (!useMask || mask[k]) mx = Math.max(mx, lw[k]);
      const out = new Float32Array(D); let s = 0;
      for (let k = 0; k < imgs.length; k++) { if (useMask && !mask[k]) continue; const w = Math.exp(lw[k] - mx); if (w < 1e-9) continue; s += w; const m = imgs[k].v; for (let i = 0; i < D; i++) out[i] += w * m[i]; }
      for (let i = 0; i < D; i++) out[i] = (out[i] / s) * (1 - kk * a) + kk * x[i];
      return out;
    };
    return [post(false), mask ? post(true) : null];
  }
  // RF sampler from t0 -> 0
  function sample(x, t0, steps, mask, w, record) {
    const frames = [];
    for (let k = 0; k < steps; k++) {
      const t = t0 * (1 - k / steps), s = t0 * (1 - (k + 1) / steps);
      const a = 1 - t, b = t;
      let [xu, xc] = denoise(x, a, b, mask);
      const x0 = xc ? xu.map((u, i) => u + w * (xc[i] - u)) : xu;
      if (record && (k % Math.max(1, Math.round(steps / 5)) === 0)) frames.push({ xt: x.slice(), x0: x0.slice(), t });
      const nx = new Float32Array(D);
      for (let i = 0; i < D; i++) { const eps = (x[i] - a * x0[i]) / b; nx[i] = (1 - s) * x0[i] + s * eps; }
      x = nx;
    }
    if (record) frames.push({ xt: x.slice(), x0: x.slice(), t: 0 });
    return { x, frames };
  }
  function paint(cv, v) {
    const ctx = cv.getContext('2d'); cv.width = cv.height = S;
    const id = ctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { for (let c = 0; c < 3; c++) id.data[i * 4 + c] = A.clamp((v[i * 3 + c] + 1) * 127.5, 0, 255); id.data[i * 4 + 3] = 255; }
    ctx.putImageData(id, 0, 0); cv.classList.add('pixel');
  }
  // ---- UI
  let tab = 'i2i';
  const tabs = A.el('div', { class: 'controls' }); bd.append(tabs);
  A.seg(tabs, [{ v: 't2i', t: '文生图' }, { v: 'i2i', t: '图生图（画草图）' }, { v: 'data', t: '看训练集' }], tab, (v) => { tab = v; show(); }, '模式');
  const promptIn = A.el('input', { type: 'text', style: { width: '100%', fontSize: '15px' } });
  promptIn.value = '一张图';
  const chips = A.el('div', { class: 'chips' });
  ['夜晚的一颗黄色星星', '蓝天下红色的爱心', '左上角的绿色三角', '紫色方块', '圆', '一张图'].forEach((p) => chips.append(A.el('button', { class: 'chip', onclick: () => { promptIn.value = p; run(); } }, p)));
  const parsed = A.el('div', { class: 'small', style: { margin: '4px 0 8px' } });
  bd.append(A.el('div', { class: 'small muted' }, '提示词（可识别：形状、颜色、白天/夜晚、左上/右下/中间）'), promptIn, chips, parsed);
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const stepsS = A.slider(ctl, { label: '采样步数', min: 1, max: 50, step: 1, value: 20, fmt: (v) => v, on: A.debounce(() => run(), 150) });
  const wS = A.slider(ctl, { label: 'CFG 引导强度', min: 0, max: 8, step: 0.1, value: 3, fmt: (v) => v.toFixed(1), on: A.debounce(() => run(), 150) });
  const strS = A.slider(ctl, { label: '图生图强度（加噪到 t）', min: 0.05, max: 1, step: 0.01, value: 0.35, fmt: (v) => v.toFixed(2), on: A.debounce(() => run(), 150) });
  let seed = 1;
  ctl.append(A.el('button', { class: 'primary', onclick: () => { seed++; run(); } }, '换随机种子生成'));
  const panT2I = A.el('div'), panI2I = A.el('div'), panData = A.el('div');
  bd.append(panT2I, panI2I, panData);
  // t2i panel
  const outRow = A.el('div', { class: 'imgrow' }); const stripRow = A.el('div', { class: 'imgrow strip', style: { marginTop: '12px' } });
  const outCvs = [0, 1, 2, 3].map((i) => { const c = A.el('canvas'); outRow.append(A.el('figure', null, c, '样本 ' + (i + 1))); return c; });
  panT2I.append(outRow, A.el('div', { class: 'small muted', style: { marginTop: '12px' } }, '样本 1 的去噪过程：上行是当前的 xₜ，下行是这一步预测的干净图 x̂₀（真实产品里的“预览图”）'), stripRow);
  // i2i panel
  const sk = A.el('canvas', { id: 'sketch', class: 'pixel' }); sk.width = sk.height = S;
  const skctx = sk.getContext('2d', { willReadFrequently: true });
  const pal = A.el('div', { class: 'flex', style: { margin: '8px 0' } });
  let brush = '#e34948', bsize = 3;
  ['#e34948', '#2a78d6', '#1baf7a', '#eda100', '#6250d6', '#ffffff', '#0d1b33'].forEach((c) => { const b = A.el('button', { class: 'swatch' + (c === brush ? ' on' : ''), style: { background: c }, onclick: () => { brush = c; A.$$('.swatch', pal).forEach((x) => x.classList.remove('on')); b.classList.add('on'); } }); pal.append(b); });
  pal.append(A.el('button', { onclick: () => fillBg(0) }, '白天背景'), A.el('button', { onclick: () => fillBg(1) }, '夜晚背景'), A.el('button', { onclick: () => { exampleSketch(); run(); } }, '示例草图'));
  const sz = A.slider(pal, { label: '笔刷', min: 1, max: 8, step: 1, value: 3, fmt: (v) => v + ' px', on: (v) => (bsize = v), width: 120 });
  const i2iOut = A.el('div', { class: 'imgrow' });
  const noisedCv = A.el('canvas'), resCvs = [0, 1, 2].map(() => A.el('canvas'));
  i2iOut.append(A.el('figure', null, noisedCv, '加噪后的起点'), ...resCvs.map((c, i) => A.el('figure', null, c, '结果 ' + (i + 1))));
  panI2I.append(A.el('div', { class: 'flex', style: { alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' } }, A.el('div', { style: { width: '290px', flex: 'none' } }, A.el('div', { class: 'small muted' }, '在这里画（32×32，放大显示）'), sk, pal), A.el('div', { class: 'grow', style: { minWidth: '280px' } }, i2iOut, A.el('p', { class: 'hint' }, '强度小：保留草图的颜色和位置，只做“修整”；强度大：几乎从噪声开始，草图只提供粗略的构图。提示词仍然生效，比如画一个红色的团，提示词写“蓝色的星星”，再调强度看变化。'))));
  function fillBg(bg) { const g = skctx.createLinearGradient(0, 0, 0, S); if (bg === 0) { g.addColorStop(0, '#bcdcfb'); g.addColorStop(1, '#f6f9fc'); } else { g.addColorStop(0, '#060c1c'); g.addColorStop(1, '#1b2a4a'); } skctx.fillStyle = g; skctx.fillRect(0, 0, S, S); run(); }
  function exampleSketch() { fillBgNoRun(); skctx.fillStyle = '#e34948'; skctx.beginPath(); skctx.ellipse(13, 14, 8, 6, 0.4, 0, 7); skctx.fill(); skctx.fillRect(14, 15, 7, 6); }
  function fillBgNoRun() { const g = skctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#bcdcfb'); g.addColorStop(1, '#f6f9fc'); skctx.fillStyle = g; skctx.fillRect(0, 0, S, S); }
  let drawing = false;
  const dot = (e) => { const r = sk.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * S, y = ((e.clientY - r.top) / r.height) * S; skctx.fillStyle = brush; skctx.beginPath(); skctx.arc(x, y, bsize / 2, 0, 7); skctx.fill(); };
  sk.addEventListener('pointerdown', (e) => { drawing = true; sk.setPointerCapture(e.pointerId); dot(e); });
  sk.addEventListener('pointermove', (e) => { if (drawing) dot(e); });
  sk.addEventListener('pointerup', () => { drawing = false; run(); });
  // data panel
  const dataGrid = A.el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '4px' } });
  panData.append(A.el('p', { class: 'small' }, '全部 150 张训练图。真实模型的训练集是数十亿张图文对，它学到的是可以组合、泛化的去噪器；这里的最优去噪器只会在训练图之间插值。'), dataGrid);
  imgs.forEach((im) => { const c = A.el('canvas', { style: { width: '100%', aspectRatio: '1', borderRadius: '4px' } }); paint(c, im.v); dataGrid.append(c); });
  function show() { panT2I.classList.toggle('hidden', tab !== 't2i'); panI2I.classList.toggle('hidden', tab !== 'i2i'); panData.classList.toggle('hidden', tab !== 'data'); strS.el.classList.toggle('hidden', tab !== 'i2i'); run(); }
  function run() {
    const c = parse(promptIn.value);
    const mask = imgs.map((im) => match(im, c));
    const n = mask.filter(Boolean).length;
    const any = c.sh >= 0 || c.co >= 0 || c.bg >= 0 || c.po >= 0;
    const lab = (k, arr) => (k < 0 ? '<span class="muted">未指定</span>' : '<b>' + arr[k] + '</b>');
    parsed.innerHTML = `解析结果 → 形状 ${lab(c.sh, SHAPES)} · 颜色 ${lab(c.co, COLORS.map((x) => x[0]))} · 背景 ${lab(c.bg, ['白天', '夜晚'])} · 位置 ${lab(c.po, ['中间', '左上', '右下'])}　匹配训练图 <b>${n}</b> 张` + (any && !n ? '　<span style="color:var(--bad)">没有匹配的训练图，退回无条件生成</span>' : '');
    const useMask = any && n ? mask : null;
    const steps = Math.round(stepsS.value), w = wS.value;
    if (tab === 't2i') {
      outCvs.forEach((cv, i) => {
        const r = A.rng(seed * 1000 + i * 17);
        const x = Float32Array.from({ length: D }, () => A.gauss(r));
        const res = sample(x, 1, steps, useMask, w, i === 0);
        paint(cv, res.x);
        if (i === 0) {
          stripRow.innerHTML = '';
          res.frames.forEach((f) => { const a = A.el('canvas'), b = A.el('canvas'); paint(a, f.xt); paint(b, f.x0); stripRow.append(A.el('figure', null, a, b, 't=' + f.t.toFixed(2))); });
        }
      });
    } else if (tab === 'i2i') {
      const px = skctx.getImageData(0, 0, S, S).data, x0 = new Float32Array(D);
      for (let i = 0; i < S * S; i++) for (let c2 = 0; c2 < 3; c2++) x0[i * 3 + c2] = px[i * 4 + c2] / 127.5 - 1;
      const t0 = strS.value;
      resCvs.forEach((cv, i) => {
        const r = A.rng(seed * 1000 + i * 31);
        const x = Float32Array.from(x0, (v) => (1 - t0) * v + t0 * A.gauss(r));
        if (i === 0) paint(noisedCv, x);
        paint(cv, sample(x, t0, Math.max(1, Math.round(steps * t0)), useMask, w, false).x);
      });
    }
  }
  promptIn.addEventListener('input', A.debounce(run, 300));
  exampleSketch();
  show();
});
