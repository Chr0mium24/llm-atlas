/* rope — interactive demo (moved from ch03-transformer.html) */
A.defineDemo('rope', function (mount) {
  const { bd } = A.demo(mount, 'RoPE：旋转之后，点积只看相对距离', '头维度 d_h = 64，共 32 个旋转平面');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const D = 64;
  const mS = A.slider(ctl, { label: 'q 的位置 m', min: 0, max: 64, step: 1, value: 10, fmt: (v) => v, on: draw, width: 170 });
  const nS = A.slider(ctl, { label: 'k 的位置 n', min: 0, max: 64, step: 1, value: 4, fmt: (v) => v, on: draw, width: 170 });
  const iS = A.slider(ctl, { label: '查看第 i 个旋转平面', min: 0, max: 31, step: 1, value: 0, fmt: (v) => 'i = ' + v, on: draw, width: 190 });
  const bS = A.slider(ctl, { label: 'base', min: 100, max: 1e7, log: true, value: 10000, fmt: (v) => A.human(v, 1), on: draw, width: 200 });
  const shiftRow = A.el('div', { class: 'flex', style: { marginBottom: '8px' } }); bd.append(shiftRow);
  shiftRow.append(A.el('button', { onclick: () => { mS.value = Math.min(64, mS.value + 7); nS.value = Math.min(64, nS.value + 7); draw(); } }, 'm、n 同时 +7'),
    A.el('button', { onclick: () => { mS.value = Math.max(0, mS.value - 7); nS.value = Math.max(0, nS.value - 7); draw(); } }, 'm、n 同时 −7'));
  const readout = A.el('span', { class: 'small' }); shiftRow.append(readout);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  bd.append(A.el('p', { class: 'hint' }, '左：第 i 个二维平面里，q 被转了 m·θᵢ，k 被转了 n·θᵢ，两者的夹角只和 m−n 有关。点击“同时 +7”，两支箭头一起转，夹角和点积都不变。右：q = k 时，点积随相对距离的变化（32 个平面取平均）。距离越远，各平面的余弦相互抵消，平均值趋于 0，这就是 RoPE 的远程衰减。调大 base，衰减变慢，所以长上下文模型会调大 base。'));
  const r = A.rng(3);
  const q = Array.from({ length: D }, () => A.gauss(r)), k = Array.from({ length: D }, () => A.gauss(r));
  const theta = (i) => Math.pow(bS.value, (-2 * i) / D);
  function rot(v, pos) {
    const o = v.slice();
    for (let i = 0; i < D / 2; i++) { const a = pos * theta(i), c = Math.cos(a), s = Math.sin(a); o[2 * i] = v[2 * i] * c - v[2 * i + 1] * s; o[2 * i + 1] = v[2 * i] * s + v[2 * i + 1] * c; }
    return o;
  }
  const v1 = A.canvas(cv1, { aspect: 0.85 }, (ctx, W, H) => {
    const i = iS.value, m = mS.value, n = nS.value;
    const qr = rot(q, m), kr = rot(k, n);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    const sc = R / 2.5;
    ctx.strokeStyle = A.css('--grid'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R - 10, cy); ctx.lineTo(cx + R + 10, cy); ctx.moveTo(cx, cy - R - 10); ctx.lineTo(cx, cy + R + 10); ctx.stroke();
    const cols = A.series();
    // original (faint)
    A.arrow(ctx, cx, cy, cx + q[2 * i] * sc, cy - q[2 * i + 1] * sc, A.alpha(cols[0], 0.25), 2);
    A.arrow(ctx, cx, cy, cx + k[2 * i] * sc, cy - k[2 * i + 1] * sc, A.alpha(cols[1], 0.25), 2);
    A.arrow(ctx, cx, cy, cx + qr[2 * i] * sc, cy - qr[2 * i + 1] * sc, cols[0], 3);
    A.arrow(ctx, cx, cy, cx + kr[2 * i] * sc, cy - kr[2 * i + 1] * sc, cols[1], 3);
    A.text(ctx, `q（位置 ${m}）`, cx + qr[2 * i] * sc + 6, cy - qr[2 * i + 1] * sc - 10, { size: 12, color: cols[0], weight: 700 });
    A.text(ctx, `k（位置 ${n}）`, cx + kr[2 * i] * sc + 6, cy - kr[2 * i + 1] * sc + 12, { size: 12, color: cols[1], weight: 700 });
    const th = theta(i);
    A.text(ctx, `θ_${i} = ${th < 0.001 ? th.toExponential(2) : th.toFixed(4)}  周期 ${A.human(2 * Math.PI / th, 1)} 个位置`, 10, 14, { size: 12, color: A.css('--muted') });
    A.text(ctx, '浅色箭头 = 旋转前', 10, H - 12, { size: 11.5, color: A.css('--muted') });
    const full = A.dot(qr, kr);
    const ref = A.dot(rot(q, m - n), k);
    readout.innerHTML = `全部 64 维点积 q<sub>m</sub>·k<sub>n</sub> = <b>${full.toFixed(3)}</b>；m−n = ${m - n}；直接用相对位置算 q<sub>m−n</sub>·k<sub>0</sub> = <b>${ref.toFixed(3)}</b>（两者相等）`;
  });
  const v2 = A.canvas(cv2, { aspect: 0.85 }, (ctx, W, H) => {
    const box = { x: 44, y: 22, w: W - 60, h: H - 64 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 1e6, xlog: true, ymin: -0.4, ymax: 1, xfmt: (v) => A.human(v, 0), yfmt: (v) => v.toFixed(1), xlabel: '相对距离 |m−n|', ylabel: '平均 cos(Δ·θᵢ)', ylabelOffset: 40, xgrid: true });
    const curve = (base, color, w) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath();
      for (let p = 0; p <= 400; p++) {
        const dd = Math.pow(10, (p / 400) * 6);
        let s = 0; for (let i = 0; i < D / 2; i++) s += Math.cos(dd * Math.pow(base, (-2 * i) / D));
        s /= D / 2;
        const x = ax.X(dd), y = ax.Y(A.clamp(s, -0.2, 1));
        p ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    };
    const cols = A.series();
    curve(10000, A.css('--axis'), 2);
    curve(bS.value, cols[0], 2);
    const dd = Math.max(1, Math.abs(mS.value - nS.value));
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(dd), box.y + box.h, 5, 0, 7); ctx.fill();
    A.text(ctx, '当前 base = ' + A.human(bS.value, 1), box.x + box.w - 4, box.y + 8, { size: 12, align: 'right', color: cols[0], weight: 600 });
    A.text(ctx, '灰线：base = 10K（原版）', box.x + box.w - 4, box.y + 26, { size: 12, align: 'right', color: A.css('--muted') });
  });
  function draw() { v1.redraw(); v2.redraw(); }
});
