/* num-format — interactive demo (moved from ch09-quantization.html) */
A.defineDemo('num-format', function (mount) {
  const { FMT, encFloat, nearestE2M1, E2M1, NF4 } = A.num;
  const { bd } = A.demo(mount, '数字格式浏览器：一个数在不同格式下长什么样', '');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let fmt = 'e2m1';
  A.seg(ctl, [{ v: 'fp32', t: 'FP32' }, { v: 'bf16', t: 'BF16' }, { v: 'fp16', t: 'FP16' }, { v: 'e4m3', t: 'FP8 E4M3' }, { v: 'e5m2', t: 'FP8 E5M2' }, { v: 'e2m1', t: 'FP4 E2M1' }, { v: 'int8', t: 'INT8' }, { v: 'int4', t: 'INT4' }, { v: 'nf4', t: 'NF4' }, { v: 'tern', t: '三值' }], fmt, (v) => { fmt = v; render(); }, '格式');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const xS = A.slider(ctl2, { label: '输入值 x', min: -8, max: 8, step: 0.001, value: 2.7, fmt: (v) => v.toFixed(3), on: () => render(), width: 320 });
  const sS = A.slider(ctl2, { label: '整数/NF4/三值的缩放 s', min: 0.01, max: 2, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), on: () => render() });
  const out = A.el('div'); bd.append(out);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const view = A.canvas(cv, { height: 92 }, paint);
  let grid = [], xv = 0, qv = 0, range = 8;
  function render() {
    const x = xS.value, s = sS.value; xv = x;
    out.innerHTML = '';
    const cols = A.series();
    if (FMT[fmt]) {
      const f = FMT[fmt], r = encFloat(x, f);
      qv = r.v;
      const bits = A.el('div', { class: 'bits' + (f.m > 10 ? ' small' : '') });
      bits.append(A.el('span', { style: { background: cols[7] }, title: '符号' }, r.sign));
      for (let i = f.e - 1; i >= 0; i--) bits.append(A.el('span', { style: { background: cols[0] }, title: '指数' }, (r.ef >> i) & 1));
      for (let i = f.m - 1; i >= 0; i--) bits.append(A.el('span', { style: { background: cols[2] }, title: '尾数' }, (r.mf >> i) & 1));
      const bias = (1 << (f.e - 1)) - 1;
      const maxV = encFloat(1e40, f).v, minN = Math.pow(2, 1 - bias);
      out.append(A.el('div', { class: 'legend' }, A.el('span', { html: `<i style="background:${cols[7]}"></i>符号 1 位` }), A.el('span', { html: `<i style="background:${cols[0]}"></i>指数 ${f.e} 位（偏置 ${bias}）` }), A.el('span', { html: `<i style="background:${cols[2]}"></i>尾数 ${f.m} 位` })), bits);
      out.append(A.el('div', { class: 'stats' },
        stat('存储的值', fmtNum(r.v) + (r.sat ? '（饱和）' : '')), stat('误差', fmtNum(r.v - x)), stat('相对误差', x ? A.pct(Math.abs(r.v - x) / Math.abs(x), 3) : '—'),
        stat('最大值', fmtNum(maxV)), stat('最小正规数', fmtNum(minN)), stat('1 附近的间隔', fmtNum(Math.pow(2, -f.m)))));
      range = f.e <= 4 ? Math.min(maxV, 8) : 8;
      grid = [];
      if (f.e + f.m <= 7) for (let b = 0; b < 1 << (f.e + f.m); b++) { const ef = b >> f.m, mf = b & ((1 << f.m) - 1); const v = ef === 0 ? mf * Math.pow(2, 1 - bias - f.m) : Math.pow(2, ef - bias) * (1 + mf / (1 << f.m)); if (f.max && v > f.max) continue; if (f.ieee && ef === (1 << f.e) - 1) continue; grid.push(v, -v); }
    } else {
      let levels;
      if (fmt === 'int8') levels = Array.from({ length: 255 }, (_, i) => (i - 127) * s);
      if (fmt === 'int4') levels = Array.from({ length: 15 }, (_, i) => (i - 7) * s);
      if (fmt === 'nf4') levels = NF4.map((v) => v * 7 * s);
      if (fmt === 'tern') levels = [-s, 0, s];
      grid = levels;
      let best = levels[0]; levels.forEach((l) => { if (Math.abs(l - x) < Math.abs(best - x)) best = l; });
      qv = best;
      const nb = fmt === 'int8' ? 8 : fmt === 'tern' ? 1.58 : 4;
      out.append(A.el('p', { class: 'small' }, fmt === 'nf4' ? 'NF4 的 16 个值按标准正态分布的分位数排列（这里乘了 7s 方便和 INT4 对比），0 附近密、两端疏。' : fmt === 'tern' ? '三值只有 −s、0、+s 三个值，s 通常取这一组权重的平均绝对值（BitNet b1.58 的 absmean）。' : `${nb} 位对称整数：在 ±${fmt === 'int8' ? 127 : 7}·s 之间等间隔取值。间隔处处相同，所以小数值的相对误差大。`));
      out.append(A.el('div', { class: 'stats' }, stat('量化后', fmtNum(qv)), stat('误差', fmtNum(qv - x)), stat('可表示的值', levels.length + ' 个'), stat('位数', nb + ' bit')));
      range = 8;
    }
    view.redraw();
  }
  const stat = (k, v) => A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v));
  const fmtNum = (v) => (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(4) : (+v.toFixed(6)).toString());
  function paint(ctx, W, H) {
    const X = (v) => 20 + ((v + range) / (2 * range)) * (W - 40);
    const y0 = 46;
    ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(20, y0); ctx.lineTo(W - 20, y0); ctx.stroke();
    A.niceTicks(-range, range, 8).forEach((t) => A.text(ctx, t + '', X(t), y0 + 26, { size: 11, align: 'center', color: A.css('--muted') }));
    if (grid.length && grid.length < 600) {
      ctx.strokeStyle = A.css('--s1'); ctx.lineWidth = 1.2;
      grid.forEach((g) => { if (Math.abs(g) > range) return; ctx.beginPath(); ctx.moveTo(X(g), y0 - 10); ctx.lineTo(X(g), y0 + 10); ctx.stroke(); });
      A.text(ctx, `蓝色刻度 = 可表示的值（${grid.filter((g) => Math.abs(g) <= range).length} 个在可视范围内）`, 20, 12, { size: 11.5, color: A.css('--muted') });
    } else A.text(ctx, '可表示的值太密（数以万计），画不下', 20, 12, { size: 11.5, color: A.css('--muted') });
    ctx.fillStyle = A.css('--s2'); ctx.beginPath(); ctx.arc(X(A.clamp(xv, -range, range)), y0, 6, 0, 7); ctx.fill();
    ctx.fillStyle = A.css('--s3'); ctx.beginPath(); ctx.arc(X(A.clamp(qv, -range, range)), y0, 4, 0, 7); ctx.fill();
    A.text(ctx, '● 输入', W - 120, 12, { size: 11.5, color: A.css('--s2') });
    A.text(ctx, '● 量化后', W - 70, 12, { size: 11.5, color: A.css('--s3') });
  }
  render();
});
