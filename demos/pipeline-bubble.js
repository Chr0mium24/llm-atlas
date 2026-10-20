/* pipeline-bubble — GPipe vs 1F1B pipeline schedules: idle "bubble" and in-flight activations */
A.defineDemo('pipeline-bubble', function (mount) {
  const { bd } = A.demo(mount, '流水线并行的“气泡”', '每行是一段流水线（一组卡），每格是一个时间单位；F = 前向，B = 反向（这里假设反向耗时是前向的 2 倍）');
  let p = 4, m = 8, sched = 'gpipe';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '流水线段数 p', min: 2, max: 8, step: 1, value: p, fmt: (v) => v, on: (v) => { p = v; draw(); }, width: 160 });
  A.slider(ctl, { label: '微批次数 m', min: 1, max: 24, step: 1, value: m, fmt: (v) => v, on: (v) => { m = v; draw(); }, width: 160 });
  A.seg(ctl, [{ v: 'gpipe', t: 'GPipe：先全部前向再全部反向' }, { v: '1f1b', t: '1F1B：前向反向交替' }], sched, (v) => { sched = v; draw(); }, '调度');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  // simulate: each stage processes ops in a fixed order; op starts when its dependency is done and stage is free
  function simulate() {
    const F = 1, Bt = 2;
    const order = [];
    for (let s = 0; s < p; s++) {
      const ops = [];
      if (sched === 'gpipe') { for (let i = 0; i < m; i++) ops.push(['F', i]); for (let i = 0; i < m; i++) ops.push(['B', i]); }
      else { const warm = Math.min(p - s, m); for (let i = 0; i < warm; i++) ops.push(['F', i]); let f = warm, b = 0; while (b < m) { ops.push(['B', b++]); if (f < m) ops.push(['F', f++]); } }
      order.push(ops);
    }
    const done = {}; const free = new Array(p).fill(0); const idx = new Array(p).fill(0); const blocks = [];
    let progress = true;
    while (progress) {
      progress = false;
      for (let s = 0; s < p; s++) {
        if (idx[s] >= order[s].length) continue;
        const [t, i] = order[s][idx[s]];
        const dep = t === 'F' ? (s === 0 ? 0 : done[`F${s - 1}_${i}`]) : (s === p - 1 ? done[`F${s}_${i}`] : done[`B${s + 1}_${i}`]);
        if (dep === undefined) continue;
        const st = Math.max(free[s], dep), en = st + (t === 'F' ? F : Bt);
        done[`${t}${s}_${i}`] = en; free[s] = en; idx[s]++; blocks.push({ s, t, i, st, en }); progress = true;
      }
    }
    const T = Math.max(...free);
    let peak = 0;
    for (let s = 0; s < p; s++) { let live = 0, mx = 0; blocks.filter((b) => b.s === s).sort((a, b) => a.st - b.st).forEach((b) => { live += b.t === 'F' ? 1 : -1; mx = Math.max(mx, live); }); peak = Math.max(peak, mx); }
    return { blocks, T, busy: p * m * (F + Bt), peak };
  }
  let R;
  const view = A.canvas(cv, { aspect: 0.36 }, (ctx, W, H) => {
    const x0 = 64, rowH = Math.min(30, (H - 30) / p), unit = (W - x0 - 10) / R.T;
    for (let s = 0; s < p; s++) {
      const y = 10 + s * rowH;
      A.text(ctx, '第 ' + (s + 1) + ' 段', x0 - 8, y + rowH / 2, { size: 11.5, align: 'right', color: A.css('--muted') });
      ctx.fillStyle = A.alpha(A.css('--ink'), 0.06); ctx.fillRect(x0, y + 2, R.T * unit, rowH - 4);
    }
    R.blocks.forEach((b) => {
      const y = 10 + b.s * rowH, x = x0 + b.st * unit, w = (b.en - b.st) * unit;
      ctx.fillStyle = b.t === 'F' ? A.alpha(cols[0], 0.35 + 0.5 * (1 - b.i / Math.max(1, m))) : A.alpha(cols[1], 0.35 + 0.5 * (1 - b.i / Math.max(1, m)));
      ctx.fillRect(x + 1, y + 3, w - 2, rowH - 6);
      if (w > 18) A.text(ctx, b.t + (b.i + 1), x + w / 2, y + rowH / 2, { size: 10.5, align: 'center', color: '#fff', weight: 600 });
    });
    A.text(ctx, '时间 →', W - 10, H - 8, { size: 11.5, align: 'right', color: A.css('--muted') });
  });
  function draw() {
    R = simulate();
    const total = p * R.T, bubble = 1 - R.busy / total;
    stats.innerHTML = '';
    [['总时间', R.T + ' 个单位'], ['空闲（气泡）比例', A.pct(bubble, 1)], ['公式 (p−1)/(m+p−1)', A.pct((p - 1) / (m + p - 1), 1)], ['每段最多同时保存的激活', R.peak + ' 个微批次']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    hint.innerHTML = '一批数据被切成 m 个微批次依次流过 p 段。开头要等第一个微批次流到最后一段，结尾要等最后一个反向传回第一段，这两段时间里总有一些卡在空等，叫“气泡”，比例约为 (p − 1)/(m + p − 1)。微批次越多，气泡越小，但每个微批次越小、单卡效率越低。GPipe 和 1F1B 的气泡一样大，区别在显存：GPipe 要先把 m 个微批次的激活全部存着等反向，1F1B 让反向尽早开始，每段最多只存约 p 个。交错式调度、DeepSeek 的 DualPipe 进一步把通信藏进计算、压缩气泡。';
    view.redraw();
  }
  draw();
});
