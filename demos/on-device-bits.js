/* on-device-bits — toy model for "same memory: bigger model at fewer bits, or smaller model at more bits?".
   Reducible loss L(b) = A·N^(−α) + c·4^(−b), N = 8M/b (all memory to weights). A = 406.4, α = 0.34 (Chinchilla fit);
   c is illustrative: coarse PTQ 20, good PTQ 2, QAT 0.25; "overtrained" multiplies c by 4. */
A.defineDemo('on-device-bits', function (mount) {
  const { bd } = A.demo(mount, '同样的内存：多大的模型配几位', '玩具模型：规模定律的参数项 + 量化误差项，系数是示意');
  const A0 = 406.4, AL = 0.34;
  const METH = { crude: ['粗糙的训练后量化（逐张量取整）', 20], good: ['好的训练后量化（分组 + 校准）', 2], qat: ['量化感知训练（QAT）', 0.25] };
  const MARK = [[1.76, '三值'], [2.38, 'IQ2_XXS'], [4.89, 'Q4_K_M'], [8.5, 'Q8_0'], [16, 'BF16']];
  let me = 'good', over = false;
  const c1 = A.el('div', { class: 'controls' }); bd.append(c1);
  const mS = A.slider(c1, { label: '给权重的内存 M', min: 1, max: 64, log: true, step: 0.001, value: 6, fmt: (v) => (v < 10 ? v.toFixed(1) : v.toFixed(0)) + ' GB', on: draw, width: 220 });
  A.seg(c1, Object.entries(METH).map(([v, o]) => ({ v, t: o[0] })), me, (v) => { me = v; draw(); }, '量化方法');
  A.check(c1, '过度训练的小模型（量化误差 ×4，示意）', over, (v) => { over = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const CC = cols[0], CQ = cols[1];

  const cNow = () => METH[me][1] * (over ? 4 : 1);
  function L(M, b, c) { const N = (8 * M * 1e9) / b; const cap = A0 * Math.pow(N, -AL), q = c * Math.pow(4, -b); return { N, cap, q, t: cap + q }; }
  function opt(M, c) { let best = null; for (let b = 1.5; b <= 16.0001; b += 0.01) { const r = L(M, b, c); if (!best || r.t < best.t) best = { b, ...r }; } return best; }

  let hx = null;
  const view = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    const M = mS.value, c = cNow(), o = opt(M, c);
    const box = { x: 58, y: 40, w: W - 78, h: H - 74 };
    const ymax = Math.max(0.12, Math.ceil(L(M, 16, c).t * 2.0 * 20) / 20);
    const ax = A.axes(ctx, box, { xmin: 1.5, xmax: 16, xlog: true, xticks: [2, 3, 4, 6, 8, 12, 16], xfmt: (v) => v + ' 位', ymin: 0, ymax, yfmt: (v) => v.toFixed(2), xlabel: '每权重位数 b（对数）', ylabel: '可约损失（玩具单位）', ylabelOffset: 48, xgrid: true });
    const curve = (f, color, wdt, dash) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = wdt; ctx.setLineDash(dash || []); ctx.beginPath(); let started = false;
      for (let i = 0; i <= 300; i++) { const b = 1.5 * Math.pow(16 / 1.5, i / 300); const v = f(b); if (v > ymax * 1.5) { started = false; continue; } const x = ax.X(b), y = ax.Y(Math.min(v, ymax)); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.restore();
    };
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y - 2, box.w, box.h + 4); ctx.clip();
    curve((b) => L(M, b, c).cap, CC, 2, [6, 4]);
    curve((b) => L(M, b, c).q, CQ, 2, [6, 4]);
    curve((b) => L(M, b, c).t, A.css('--ink'), 3);
    ctx.restore();
    // format markers along the bottom
    MARK.forEach(([b, t], i) => { const x = ax.X(b); ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, box.y + 14); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.restore(); A.text(ctx, t, x, box.y + 6, { size: 11, color: A.css('--muted'), align: i === MARK.length - 1 ? 'right' : 'center' }); });
    // optimum
    const xo = ax.X(o.b), yo = ax.Y(Math.min(o.t, ymax));
    ctx.fillStyle = A.css('--ink'); ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xo, yo, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    const right = xo > box.x + box.w * 0.6;
    A.text(ctx, `最优约 ${o.b.toFixed(1)} 位 → ${(o.N / 1e9).toFixed(1)}B 参数`, xo + (right ? -8 : 8), yo - 26, { size: 12.5, weight: 650, align: right ? 'right' : 'left' });
    if (hx !== null && hx >= box.x && hx <= box.x + box.w) {
      const b = ax.invX(hx), r = L(M, b, c);
      ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(hx, box.y); ctx.lineTo(hx, box.y + box.h); ctx.stroke(); ctx.restore();
      view._tip = `<b>${b.toFixed(2)} 位</b>：能放 ${(r.N / 1e9).toFixed(1)}B 参数<br><span style="color:${CC}">●</span> 参数项 ${r.cap.toFixed(3)}<br><span style="color:${CQ}">●</span> 量化项 ${r.q < 0.001 ? r.q.toExponential(1) : r.q.toFixed(3)}<br>合计 ${r.t.toFixed(3)}`;
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { hx = A.pos(cv, e).x; view.redraw(); if (view._tip) A.tip.show(view._tip, e.clientX, e.clientY); else A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { hx = null; view.redraw(); A.tip.hide(); });

  function draw() {
    const M = mS.value, c = cNow(), o = opt(M, c);
    const q4 = L(M, 4.89, c), q8 = L(M, 8.5, c), t3 = L(M, 1.76, c);
    stats.innerHTML = '';
    [['最优位数', o.b.toFixed(1) + ' 位'], ['能放下的参数', (o.N / 1e9).toFixed(1) + 'B'], ['最优点：量化项 / 参数项', A.pct(o.q / o.cap, 1)], ['Q4_K_M / Q8_0 / 三值', `${(q4.N / 1e9).toFixed(1)}B · ${(q8.N / 1e9).toFixed(1)}B · ${(t3.N / 1e9).toFixed(1)}B`]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i class="line" style="background:${CC}"></i>参数项：位数越高，放下的参数越少</span><span><i class="line" style="background:${CQ}"></i>量化项：每少一位约 ×4</span><span><i class="line" style="background:${A.css('--ink')}"></i>合计</span>`;
    const best = [['Q4_K_M', q4], ['Q8_0', q8], ['三值', t3]].sort((a, b) => a[1].t - b[1].t)[0][0];
    let msg = `${M < 10 ? M.toFixed(1) : M.toFixed(0)} GB 时，最优点在约 ${o.b.toFixed(1)} 位、${(o.N / 1e9).toFixed(1)}B 参数；三种常见格式里 ${best} 最好。`;
    if (me === 'qat') msg += ' 这里把 QAT 的量化项系数取为好的训练后量化的 1/8（示意），最优点左移约 1.8 位：同样的内存放下大一倍多的模型。三值的 Bonsai 2 27B 用 6 GB 放下 27B，走的就是把量化项压低这条路（厂商自报）。';
    else if (me === 'crude') msg += ' 取整方法粗糙时量化项大，最优点右移到 6 位左右，大模型低位并不划算。';
    else msg += ' 拖动内存滑块：内存大 10 倍，最优位数只增加约 0.6 位，所以从手机到服务器，训练后量化都停在 4 位左右。';
    if (over) msg += ' 过度训练让量化项变大（示意 ×4），最优点右移约 1 位。';
    hint.innerHTML = msg + ' 系数 c 是示意值，只用来展示两项竞争的结构；纵轴不能直接换算成评测分数。';
    view.redraw();
  }
  draw();
});
