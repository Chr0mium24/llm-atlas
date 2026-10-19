/* bandit-pg — REINFORCE on a 4-button bandit: with vs without baseline, 40 parallel runs, entropy */
A.defineDemo('bandit-pg', function (mount) {
  const { bd } = A.demo(mount, '四个按钮的游戏：用策略梯度学会按哪个', '每个按钮得分的概率固定但未知；同一设置并行跑 40 次，看平均和波动');
  const P = [0.25, 0.55, 0.7, 0.4], NAMES = ['A', 'B', 'C', 'D'], RUNS = 40, STEPS = 400;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let shape = 'bin';
  A.seg(ctl, [{ v: 'bin', t: '0 分或 1 分' }, { v: 'pos', t: '5 分或 10 分（总是正的）' }], shape, (v) => { shape = v; run(); }, '奖励');
  const lr = A.slider(ctl, { label: '学习率 α', min: 0.01, max: 1, step: 0.01, value: 0.15, fmt: (v) => v.toFixed(2), on: A.debounce(run, 60) });
  const bias = A.slider(ctl, { label: '初始偏好：一开始更爱按 A（最差的）', min: 0, max: 4, step: 0.1, value: 0, fmt: (v) => 'θ_A = ' + v.toFixed(1), on: A.debounce(run, 60), width: 250 });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const T = A.slider(ctl2, { label: '查看第几步', min: 0, max: STEPS, step: 1, value: STEPS, fmt: (v) => v, on: () => draw(), width: 260 });
  let which = 1;
  A.seg(ctl2, [{ v: 0, t: '无基线' }, { v: 1, t: '有基线' }], which, (v) => { which = v; draw(); }, '左图显示');
  let seed = 1;
  ctl2.append(A.el('button', { onclick: () => { seed++; run(); } }, '换一批随机数'));
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const cv3 = A.el('canvas', { class: 'cv', style: { marginTop: '12px' } }); bd.append(cv3);
  bd.append(A.el('div', { class: 'legend', html: '<span><i class="line" style="background:var(--s2)"></i>无基线：用 R 更新</span><span><i class="line" style="background:var(--s1)"></i>有基线：用 R − b 更新（b 是最近得分的滑动平均）</span><span>线 = 40 次的平均，阴影 = 中间 80%</span><span><i class="line" style="background:var(--axis)"></i>最好的按钮 C 的得分率</span>' }));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  const rew = (hit) => (shape === 'bin' ? (hit ? 1 : 0) : hit ? 10 : 5);
  const expR = (pi) => A.sum(pi.map((p, i) => p * (shape === 'bin' ? P[i] : 5 + 5 * P[i])));
  const ent = (pi) => -A.sum(pi.map((p) => (p > 1e-12 ? p * Math.log2(p) : 0)));
  let H = null; // H[variant][run][step] = {pi}
  function run() {
    H = [0, 1].map((useB) => {
      const r = A.rng(seed * 131 + 7); // same random numbers for both variants
      return Array.from({ length: RUNS }, () => {
        const th = [bias.value, 0, 0, 0];
        let b = null;
        const trace = [A.softmax(th)];
        for (let s = 0; s < STEPS; s++) {
          const pi = A.softmax(th);
          let u = r(), a = 0; for (; a < 3; a++) { u -= pi[a]; if (u <= 0) break; }
          const R = rew(r() < P[a]);
          if (b === null) b = R;
          const adv = useB ? R - b : R;
          for (let j = 0; j < 4; j++) th[j] += lr.value * adv * ((j === a ? 1 : 0) - pi[j]) / (shape === 'bin' ? 1 : 5);
          b += 0.05 * (R - b);
          trace.push(A.softmax(th));
        }
        return trace;
      });
    });
    draw();
  }
  const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; };
  const series = (fn) => [0, 1].map((v) => { const out = []; for (let s = 0; s <= STEPS; s += 4) { const xs = H[v].map((tr) => fn(tr[s])); out.push({ s, m: A.mean(xs), lo: q(xs, 0.1), hi: q(xs, 0.9) }); } return out; });
  function chart(ctx, W, Hh, data, ymin, ymax, yfmt, title, ref) {
    const box = { x: 44, y: 18, w: W - 58, h: Hh - 48 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: STEPS, ymin, ymax, yfmt, xfmt: (v) => v, xlabel: '按了多少次' });
    if (ref !== undefined) { ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(ax.X(0), ax.Y(ref)); ctx.lineTo(ax.X(STEPS), ax.Y(ref)); ctx.stroke(); ctx.setLineDash([]); }
    [A.css('--s2'), A.css('--s1')].forEach((col, v) => {
      const d = data[v];
      ctx.fillStyle = A.alpha(col, 0.16); ctx.beginPath();
      d.forEach((p, i) => (i ? ctx.lineTo(ax.X(p.s), ax.Y(p.hi)) : ctx.moveTo(ax.X(p.s), ax.Y(p.hi))));
      for (let i = d.length - 1; i >= 0; i--) ctx.lineTo(ax.X(d[i].s), ax.Y(d[i].lo));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); d.forEach((p, i) => (i ? ctx.lineTo(ax.X(p.s), ax.Y(p.m)) : ctx.moveTo(ax.X(p.s), ax.Y(p.m)))); ctx.stroke();
    });
    const x = ax.X(T.value); ctx.strokeStyle = A.css('--muted'); ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke();
    A.text(ctx, title, box.x, 8, { size: 11.5, color: A.css('--muted') });
  }
  const v1 = A.canvas(cv1, { aspect: 0.75 }, (ctx, W, Hh) => {
    if (!H) return;
    const t = Math.round(T.value), pi = H[which][0][t];
    const lw = 40, rowH = (Hh - 40) / 4;
    A.text(ctx, `第 1 次运行、第 ${t} 步的策略 π（${which ? '有' : '无'}基线）`, 0, 10, { size: 11.5, color: A.css('--muted') });
    pi.forEach((p, i) => {
      const y = 28 + i * rowH;
      A.text(ctx, '按钮 ' + NAMES[i], lw - 6, y + rowH / 2 - 7, { size: 13, align: 'right', weight: 600 });
      A.text(ctx, '得分率 ' + A.pct(P[i], 0), lw - 6, y + rowH / 2 + 9, { size: 10.5, align: 'right', color: A.css('--muted') });
      A.hbar(ctx, lw + 6, y + rowH / 2 - 10, (W - lw - 70) * p, 20, i === 2 ? A.css('--s3') : A.css('--s7'));
      A.text(ctx, A.pct(p, 1), lw + 12 + (W - lw - 70) * p, y + rowH / 2, { size: 12, mono: true, color: A.css('--ink-2') });
    });
  });
  const v2 = A.canvas(cv2, { aspect: 0.75 }, (ctx, W, Hh) => {
    if (!H) return;
    const best = shape === 'bin' ? 0.7 : 8.5, lo = shape === 'bin' ? 0.2 : 6.2;
    chart(ctx, W, Hh, series(expR), lo, best + (shape === 'bin' ? 0.05 : 0.25), (v) => (shape === 'bin' ? v.toFixed(1) : v.toFixed(1)), '期望得分 J(θ) = Σ π(a)·E[R(a)]', best);
  });
  const v3 = A.canvas(cv3, { aspect: 0.22 }, (ctx, W, Hh) => {
    if (!H) return;
    chart(ctx, W, Hh, series(ent), 0, 2.05, (v) => v.toFixed(1), '策略的熵 H(π)（比特；4 个按钮均匀时为 2，总按同一个时为 0）');
  });
  function draw() {
    v1.redraw(); v2.redraw(); v3.redraw();
    const t = Math.round(T.value);
    const fin = [0, 1].map((v) => H[v].map((tr) => tr[t]));
    const onBest = fin.map((ps) => ps.filter((pi) => pi[2] > 0.8).length);
    const stuck = fin.map((ps) => ps.filter((pi) => Math.max(...pi) > 0.8 && pi[2] <= 0.8).length);
    const sd = fin.map((ps) => { const xs = ps.map(expR); const m = A.mean(xs); return Math.sqrt(A.mean(xs.map((x) => (x - m) ** 2))); });
    stats.innerHTML = '';
    [['已经学会按 C 的运行（π_C > 80%）', `无基线 ${onBest[0]} / 有基线 ${onBest[1]}`], ['锁定在错误按钮上的运行', `无基线 ${stuck[0]} / 有基线 ${stuck[1]}`], ['40 次运行之间期望得分的标准差', `无基线 ${sd[0].toFixed(3)} / 有基线 ${sd[1].toFixed(3)}`]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '15px' } }, v))));
    note.textContent = shape === 'pos'
      ? '奖励总是正的时候，没有基线的版本每按一次都会提高那个按钮的概率，哪怕它是最差的，只是好按钮被提高得多一点。信号淹没在噪声里，40 次运行之间差别很大。减去基线之后，只有“比平均好”的按钮被加强，学得又快又稳。'
      : '0/1 奖励下，没有基线时，得 0 分的按压完全不产生梯度，只有得分时才更新。有基线时，得 0 分会把这个按钮的概率压低，学习更快。把学习率调大、把初始偏好调高，可以看到一部分运行过早地锁定在 A 或 B 上：熵降到接近 0，之后再也不去试 C。这就是熵塌缩。';
  }
  run();
});
