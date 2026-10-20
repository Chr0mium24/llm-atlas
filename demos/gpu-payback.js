/* gpu-payback — does an AI GPU pay for itself? yearly cash flow under falling rental prices vs straight-line depreciation; the accounting-life debate */
A.defineDemo('gpu-payback', function (mount) {
  const { bd } = A.demo(mount, '一张 GPU 能不能回本', '按出租算力计：每年的现金流 = 租价 × 利用率 × 8760 小时 − 电费与运维。全部参数为示意，可自行调整');
  let capex = 40000, p0 = 3, dec = 0.25, util = 0.75, life = 6;
  const opex = 0.25, Y = 7;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '每张卡的总投入（含服务器、网络、机房分摊）', min: 20000, max: 70000, step: 2500, value: capex, fmt: (v) => '$' + (v / 1000).toFixed(1) + 'k', on: (v) => { capex = v; draw(); }, width: 210 });
  A.slider(ctl, { label: '第一年的租价（每卡每小时）', min: 1, max: 6, step: 0.25, value: p0, fmt: (v) => '$' + v.toFixed(2), on: (v) => { p0 = v; draw(); }, width: 210 });
  A.slider(ctl, { label: '租价每年下降', min: 0, max: 0.6, step: 0.05, value: dec, fmt: (v) => A.pct(v, 0), on: (v) => { dec = v; draw(); }, width: 210 });
  A.slider(ctl, { label: '利用率', min: 0.3, max: 1, step: 0.05, value: util, fmt: (v) => A.pct(v, 0), on: (v) => { util = v; draw(); }, width: 210 });
  A.seg(ctl, [{ v: 3, t: '3 年' }, { v: 5, t: '5 年' }, { v: 6, t: '6 年' }], life, (v) => { life = v; draw(); }, '会计折旧年限');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const yearly = () => Array.from({ length: Y }, (_, y) => {
    let s = 0; for (let m = 0; m < 12; m++) { const p = p0 * Math.pow(1 - dec, (y * 12 + m) / 12); s += Math.max(0, (p * util - opex) * 730); } return s;
  });
  const view = A.canvas(cv, { aspect: 0.44 }, (ctx, W, H) => {
    const cf = yearly(), dep = capex / life;
    const ymax = Math.max(dep, cf[0]) * 1.15;
    const box = { x: 62, y: 46, w: W - 84, h: H - 82 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: Y, ymin: 0, ymax, xticks: [], yfmt: (v) => '$' + Math.round(v / 1000) + 'k', ylabel: '每年（美元）', ylabelOffset: 54 });
    const bw = (box.w / Y) * 0.56;
    let cum = 0;
    cf.forEach((v, y) => {
      cum += v; const paid = cum >= capex;
      const x = ax.X(y + 0.5) - bw / 2;
      A.bar(ctx, x, ax.Y(v), bw, ax.Y(0) - ax.Y(v), paid ? cols[2] : cols[0]);
      A.text(ctx, '第 ' + (y + 1) + ' 年', ax.X(y + 0.5), box.y + box.h + 12, { size: 11.5, align: 'center', color: A.css('--muted') });
      if (y < life) { const profit = v - dep; A.text(ctx, (profit >= 0 ? '+' : '−') + '$' + Math.abs(profit / 1000).toFixed(1) + 'k', ax.X(y + 0.5), Math.min(ax.Y(v), ax.Y(dep)) - 10, { size: 11, align: 'center', color: profit >= 0 ? A.css('--good-ink') : A.css('--bad') }); }
    });
    ctx.save(); ctx.strokeStyle = cols[1]; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(dep)); ctx.lineTo(ax.X(life), ax.Y(dep)); ctx.stroke(); ctx.restore();
    A.text(ctx, '柱：当年现金流（回本后变绿）　柱上数字：当年账面利润 = 现金流 − 折旧', box.x - 54, 10, { size: 11, color: A.css('--muted') });
    A.text(ctx, '虚线：每年折旧 $' + (dep / 1000).toFixed(1) + 'k（' + life + ' 年直线折旧）', box.x + box.w, box.y - 8, { size: 11.5, align: 'right', color: cols[1], weight: 700 });
  });
  function draw() {
    const cf = yearly(); let cum = 0, pay = null;
    for (let y = 0; y < Y; y++) { const prev = cum; cum += cf[y]; if (pay === null && cum >= capex) pay = y + (capex - prev) / cf[y]; }
    const c3 = A.sum(cf.slice(0, 3));
    stats.innerHTML = '';
    [['回本时间', pay === null ? '7 年内回不了本' : '约 ' + pay.toFixed(1) + ' 年'], ['前 3 年累计现金 / 投入', A.pct(c3 / capex, 0)], ['第 1 年账面利润率', A.pct((cf[0] - capex / life) / cf[0], 0)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = '会计上，买卡的钱不在当年一次性记为成本，而是按“使用年限”平摊成每年的折旧。年限越长，每年的折旧越少，<b>早几年的账面利润就越好看</b>；但现金流不会因此改变。租价每年都在下降（新一代芯片每一两年就出一代，H100 的租价从 2023 年的紧缺高位一路下跌），所以每年的现金流越来越少，后几年可能连折旧都覆盖不了。争论的核心是：一张卡在被新一代淘汰之前，累计赚到的现金能否超过投入？试着把“租价每年下降”从 25% 调到 40%：回本时间从四年多变成回不了本，而选 6 年折旧时，第一年的账面利润依然很好看。';
    view.redraw();
  }
  draw();
});
