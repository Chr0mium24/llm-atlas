/* majority-vote — interactive demo (moved from ch06-reasoning.html) */
A.defineDemo('majority-vote', function (mount) {
  const { bd } = A.demo(mount, '并行采样：多数投票 vs 有完美验证器', '蒙特卡洛模拟，每个点 2000 次');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const pS = A.slider(ctl, { label: '单次答对率 p', min: 0.02, max: 0.95, step: 0.01, value: 0.35, fmt: (v) => A.pct(v, 0), on: draw });
  const wS = A.slider(ctl, { label: '最常见错误答案占错误的比例', min: 0.1, max: 1, step: 0.01, value: 0.3, fmt: (v) => A.pct(v, 0), on: draw, width: 230 });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  legend.innerHTML = '<span><i class="line" style="background:var(--s1)"></i>pass@N（有完美验证器，N 个里有一个对就算对）</span><span><i class="line" style="background:var(--s2)"></i>多数投票</span><span><i class="line" style="background:var(--axis)"></i>单次采样</span>';
  const Ns = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128];
  let mv = [];
  function sim() {
    const p = pS.value, w1 = wS.value, r = A.rng(11);
    // wrong answers: top wrong has share w1 of wrong mass, rest spread over 8 answers
    const wrong = [w1]; for (let i = 0; i < 8; i++) wrong.push((1 - w1) / 8);
    mv = Ns.map((N) => {
      let ok = 0;
      for (let t = 0; t < 2000; t++) {
        const cnt = new Array(10).fill(0);
        for (let s = 0; s < N; s++) {
          let u = r();
          if (u < p) cnt[0]++;
          else { u = (u - p) / (1 - p); let i = 0; for (; i < 8; i++) { u -= wrong[i]; if (u <= 0) break; } cnt[1 + i]++; }
        }
        const mx = Math.max(...cnt);
        const winners = cnt.map((c, i) => (c === mx ? i : -1)).filter((i) => i >= 0);
        if (winners.includes(0)) ok += 1 / winners.length;
      }
      return ok / 2000;
    });
  }
  const view = A.canvas(cv, { aspect: 0.45 }, (ctx, W, H) => {
    const box = { x: 46, y: 16, w: W - 66, h: H - 50 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 128, xlog: true, xticks: [1, 2, 4, 8, 16, 32, 64, 128], xfmt: (v) => 'N=' + v, ymin: 0, ymax: 1, yfmt: (v) => A.pct(v, 0), xgrid: true });
    const cols = A.series(), p = pS.value;
    const line = (ys, c, wd) => { ctx.strokeStyle = c; ctx.lineWidth = wd; ctx.beginPath(); Ns.forEach((N, i) => { const x = ax.X(N), y = ax.Y(ys[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); Ns.forEach((N, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ax.X(N), ax.Y(ys[i]), 3, 0, 7); ctx.fill(); }); };
    line(Ns.map(() => p), A.css('--axis'), 2);
    line(Ns.map((N) => 1 - Math.pow(1 - p, N)), cols[0], 2);
    line(mv, cols[1], 2);
  });
  function draw() {
    sim(); view.redraw();
    const p = pS.value, top = (1 - p) * wS.value;
    note.textContent = p > top
      ? `正确答案（${A.pct(p, 0)}）比最常见的错误答案（${A.pct(top, 0)}）更常出现，所以投票越多越准，最终趋近 100%。但 pass@N 涨得更快：只要能可靠地验证（单元测试、数学核对），多采样的价值就更大。`
      : `最常见的错误答案（${A.pct(top, 0)}）比正确答案（${A.pct(p, 0)}）更常出现，投票越多反而越错，最终趋近 0。这时只有验证器（或者让模型自己想得更深、提高 p）有用。`;
  }
  draw();
});
