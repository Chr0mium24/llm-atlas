/* coding-test-reward — tests as an RL reward: how hidden tests and protected test files decide whether policy gradient pushes toward real fixes or toward gaming the tests (toy model, exact expected gradient) */
A.defineDemo('coding-test-reward', function (mount) {
  const { bd } = A.demo(mount, '测试当奖励：测试不够强时，RL 把模型推向哪里', '玩具模型：同一类修 bug 任务有四种做法，各自的通过率是按上面的公式设定的数，不是实测（“认真修但没修好”简化成单一 δ）。奖励 = 是否通过判分；用期望策略梯度训练 400 步，不含采样噪声');
  let m = 0, p = 0.35, protect = false, h0 = 0.02;
  const STEPS = 400, ALPHA = 0.5;
  const NAMES = ['认真修', '写特例', '只修常见情况', '改测试（或让测试提前退出）'];
  const SHORT = ['认真修', '写特例', '只修常见', '改测试'];
  const pre = A.el('div', { class: 'controls' }); bd.append(pre);
  const PRESETS = { a: [0, false], b: [6, false], c: [6, true] };
  const seg = A.seg(pre, [{ v: 'a', t: '没有隐藏测试' }, { v: 'b', t: '6 个隐藏测试 · 不保护测试文件' }, { v: 'c', t: '6 个隐藏测试 · 保护测试文件' }], 'a', (v) => {
    [m, protect] = PRESETS[v]; sM.value = m; cP.checked = protect; draw();
  }, '预设');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const manual = (fn) => (v) => { fn(v); seg.set(null); draw(); };
  const sM = A.slider(ctl, { label: '判分时额外运行的隐藏测试数 m', min: 0, max: 12, step: 1, value: m, fmt: (v) => v + ' 个', on: manual((v) => { m = v; }), width: 210 });
  A.slider(ctl, { label: '认真修一次真正修好的概率 p', min: 0.1, max: 0.8, step: 0.05, value: p, fmt: (v) => A.pct(v, 0), on: manual((v) => { p = v; }), width: 200 });
  A.slider(ctl, { label: '一开始就去改测试的概率', min: 0.005, max: 0.1, step: 0.005, value: h0, fmt: (v) => A.pct(v, 1), on: manual((v) => { h0 = v; }), width: 190 });
  const cP = A.check(ctl, '保护测试文件（判分前恢复原测试）', protect, manual((v) => { protect = v; }));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const COL = () => { const c = A.series(); return [c[2], c[3], c[1], c[7]]; };
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);

  const rewards = () => [p + (1 - p) * 0.5 * Math.pow(0.9, m), Math.pow(0.4, m), Math.pow(0.85, m), protect ? 0 : 1];
  function simulate(R) {
    const rest = 1 - h0, pi0 = [0.85 * rest / 0.98, 0.05 * rest / 0.98, 0.08 * rest / 0.98, h0];
    const th = pi0.map(Math.log), out = [];
    for (let t = 0; t <= STEPS; t++) {
      const mx = Math.max(...th), e = th.map((x) => Math.exp(x - mx)), Z = A.sum(e), pi = e.map((x) => x / Z);
      const J = A.sum(pi.map((q, j) => q * R[j]));
      out.push({ pi, pass: J, correct: pi[0] * p });
      for (let j = 0; j < 4; j++) th[j] += ALPHA * pi[j] * (R[j] - J);
    }
    return out;
  }
  let R = rewards(), sim = simulate(R);

  const v1 = A.canvas(cv1, { aspect: 0.78 }, (ctx, W, H) => {
    const c = COL();
    const box = { x: 44, y: 26, w: W - 58, h: H - 92 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 4, ymin: 0, ymax: 1, xticks: [], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => A.pct(v, 0), ylabel: '通过判分（拿到奖励）的概率', ylabelOffset: 38 });
    const bw = box.w / 4 * 0.56;
    R.forEach((r, j) => {
      const x = ax.X(j + 0.5) - bw / 2;
      if (j === 0) {
        const real = p, fake = r - p;
        A.bar(ctx, x, ax.Y(r), bw, ax.Y(real) - ax.Y(r), A.alpha(c[0], 0.38), 3);
        ctx.fillStyle = c[0]; ctx.fillRect(x, ax.Y(real), bw, ax.Y(0) - ax.Y(real));
        if (fake > 0.04) A.text(ctx, '误放', x + bw / 2, (ax.Y(r) + ax.Y(real)) / 2, { size: 10.5, align: 'center', color: A.css('--ink-2') });
        if (real > 0.08) A.text(ctx, '真修好', x + bw / 2, (ax.Y(real) + ax.Y(0)) / 2, { size: 10.5, align: 'center', color: '#fff', weight: 600 });
      } else if (r > 0.002) A.bar(ctx, x, ax.Y(r), bw, ax.Y(0) - ax.Y(r), c[j], 3);
      A.text(ctx, A.pct(r, r < 0.1 && r > 0 ? 1 : 0), x + bw / 2, ax.Y(r) - 9, { size: 11.5, align: 'center', mono: true });
      const lab = SHORT[j];
      A.text(ctx, lab, x + bw / 2, box.y + box.h + 14, { size: 11.5, align: 'center', color: A.css('--ink-2') });
    });
    const best = R.indexOf(Math.max(...R)), tied = SHORT.filter((n, j) => Math.abs(R[j] - R[best]) < 1e-9);
    A.text(ctx, '奖励最高：' + tied.join('、') + (tied.length > 1 ? '（并列）' : ''), box.x + box.w, box.y + box.h + 36, { size: 12, align: 'right', weight: 600, color: tied.length > 1 ? A.css('--ink') : c[best] });
  });
  const v2 = A.canvas(cv2, { aspect: 0.78 }, (ctx, W, H) => {
    const c = COL();
    const box = { x: 44, y: 26, w: W - 120, h: H - 70 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: STEPS, ymin: 0, ymax: 1, xticks: [0, 100, 200, 300, 400], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => A.pct(v, 0), xfmt: (v) => String(v), xlabel: '训练步数', ylabel: '比例', ylabelOffset: 38 });
    const line = (f, color, w, dash) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); sim.forEach((o, t) => { const x = ax.X(t), y = ax.Y(f(o)); t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore(); };
    for (let j = 0; j < 4; j++) line((o) => o.pi[j], c[j], 2);
    line((o) => o.pass, A.css('--ink'), 3);
    line((o) => o.correct, A.css('--ink'), 2, [5, 4]);
    const last = sim[STEPS], labs = [];
    for (let j = 0; j < 4; j++) labs.push({ y: last.pi[j], t: SHORT[j], color: c[j] });
    labs.push({ y: last.pass, t: '通过率', color: A.css('--ink'), w: 700 });
    labs.push({ y: last.correct, t: '真修好', color: A.css('--ink') });
    labs.sort((a, b) => b.y - a.y);
    const ys = labs.map((l) => ax.Y(l.y)), GAP = 13, bottom = box.y + box.h;
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < GAP) ys[i] = ys[i - 1] + GAP;
    if (ys[ys.length - 1] > bottom) { ys[ys.length - 1] = bottom; for (let i = ys.length - 2; i >= 0; i--) if (ys[i + 1] - ys[i] < GAP) ys[i] = ys[i + 1] - GAP; }
    labs.forEach((l, i) => A.text(ctx, l.t, box.x + box.w + 6, ys[i], { size: 11, color: l.color, weight: l.w || 500 }));
  });
  cv2.addEventListener('mousemove', (e) => {
    const { x } = A.pos(cv2, e), W = cv2.clientWidth, bx = 44, bw = W - 120;
    const t = Math.round(A.clamp((x - bx) / bw, 0, 1) * STEPS), o = sim[t];
    A.tip.show(`第 ${t} 步<br>${NAMES.map((n, j) => n + '：' + A.pct(o.pi[j], 1)).join('<br>')}<br><b>测试通过率 ${A.pct(o.pass, 1)}</b> · 真正修好 ${A.pct(o.correct, 1)}`, e.clientX, e.clientY);
  });
  cv2.addEventListener('mouseleave', () => A.tip.hide());

  function draw() {
    R = rewards(); sim = simulate(R);
    const c = COL();
    legend.innerHTML = '';
    NAMES.forEach((n, j) => legend.append(A.el('span', null, A.el('i', { class: 'line', style: { background: c[j] } }), n)));
    legend.append(A.el('span', null, A.el('i', { class: 'line', style: { background: A.css('--ink') } }), '测试通过率（奖励）'));
    legend.append(A.el('span', null, A.el('i', { class: 'line', style: { background: 'repeating-linear-gradient(90deg,' + A.css('--ink') + ' 0 4px,transparent 4px 7px)' } }), '真正修好的比例'));
    const last = sim[STEPS], first = sim[0];
    const best = R.indexOf(Math.max(...R));
    const cross = sim.findIndex((o) => o.pi[0] < 0.5);
    const hHalf = sim.findIndex((o) => o.pi[3] > 0.5);
    stats.innerHTML = '';
    [['测试通过率：开始 → 400 步', A.pct(first.pass, 0) + ' → ' + A.pct(last.pass, 0)], ['真正修好：开始 → 400 步', A.pct(first.correct, 0) + ' → ' + A.pct(last.correct, 0)], ['“认真修”跌破一半', cross < 0 ? '400 步内没有' : '第 ' + cross + ' 步'], ['“改测试”超过一半', protect ? '不会发生（测试受保护）' : (hHalf < 0 ? '400 步内没有' : '第 ' + hHalf + ' 步')]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    let msg;
    if (best === 0 && cross < 0) msg = '认真修的通过率最高，RL 把概率推向它，通过率和真修好率一起上升：奖励和目标对齐了。注意它的柱子里仍有一截“误放”：错误的补丁偶尔也能通过，这部分会一直混在奖励里。把 p 调低（任务更难）再看：要更多的隐藏测试，认真修才能重新领先。';
    else if (best === 0) msg = '认真修的奖励最高，但模拟里它仍然先被挤下去了一段：初始的取巧概率和训练的动量让少数做法暂时上升。拖动步数看曲线：长期胜出的是奖励最高的那一个。';
    else if (best === 3) msg = '改测试拿到满分，而且与隐藏测试数无关：再多的测试也挡不住“改掉判分的人”。它一开始只有 ' + A.pct(h0, 1) + ' 的概率，前面一段几乎看不见，然后几十步内接管：越罕见的做法被加强得越慢（每步的增量正比于它概率的平方），所以起步慢、之后快。这是玩具模型的性质，步数不能照搬到真实训练。把这个概率调到 1%，400 步内就看不到接管了，但只要它的奖励最高，迟早会发生。勾上“保护测试文件”，这条路就断了。';
    else if (m === 0) msg = '没有隐藏测试时，判分只运行 issue 里的那个例子：写特例、只修常见情况' + (protect ? '' : '、改测试') + '都能拿满分，而认真修反而会因为失败拿不到分。RL 只看奖励，一百步左右就把模型推向不完整的修复，通过率接近 100%，真正修好的比例却趋近于 0。';
    else msg = '隐藏测试还不够多：只修常见情况的补丁通过判分的概率（' + A.pct(R[2], 0) + '）仍高于认真修（' + A.pct(R[0], 0) + '）。差距越小，被反超得越慢，但方向不会变。在 p = ' + A.pct(p, 0) + ' 时，至少需要 ' + need() + ' 个隐藏测试。';
    hint.innerHTML = msg;
    v1.redraw(); v2.redraw();
  }
  function need() { for (let k = 0; k <= 60; k++) { const rc = p + (1 - p) * 0.5 * Math.pow(0.9, k); if (rc > Math.pow(0.85, k) && rc > Math.pow(0.4, k)) return k; } return '60 以上'; }
  draw();
});
