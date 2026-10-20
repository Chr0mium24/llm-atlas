/* abstain-score — why binary grading rewards confident guessing: expected score vs answer threshold under different wrong-answer penalties */
A.defineDemo('abstain-score', function (mount) {
  const { bd } = A.demo(mount, '为什么评测在奖励“瞎猜”', '1000 道题；模型对每题有一个校准良好的把握 c（答对的概率就是 c）；策略：把握超过阈值 τ 才作答，否则说“不知道”');
  let k = 0, hard = 0.5;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '答错扣几分（答对 +1，不答 0）', min: 0, max: 4, step: 0.25, value: k, fmt: (v) => (v === 0 ? '不扣分（只看准确率）' : '−' + v), on: (v) => { k = v; draw(); }, width: 240 });
  A.slider(ctl, { label: '题目难度（模型没把握的题占多少）', min: 0.1, max: 0.9, step: 0.05, value: hard, fmt: (v) => A.pct(v, 0), on: (v) => { hard = v; sample(); draw(); }, width: 240 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  let C = [];
  function sample() {
    const r = A.rng(31); C = [];
    for (let i = 0; i < 1000; i++) { const lowConf = r() < hard; const u = r(); C.push(lowConf ? 0.05 + 0.5 * u * u : 0.55 + 0.45 * Math.sqrt(u)); }
  }
  const evalAt = (tau, pen) => { let s = 0, ans = 0, wrong = 0; C.forEach((c) => { if (c > tau) { ans++; s += c - (1 - c) * pen; wrong += 1 - c; } }); return { score: s / C.length, ansRate: ans / C.length, wrongRate: wrong / C.length, acc: (ans ? (ans - wrong) / C.length : 0) }; };
  const view = A.canvas(cv, { aspect: 0.45 }, (ctx, W, H) => {
    const box = { x: 54, y: 28, w: W - 74, h: H - 64 };
    const ymin = -1.4, ymax = 0.8;
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1, ymin, ymax, xfmt: (v) => v.toFixed(1), yfmt: (v) => v.toFixed(1), yticks: [-1, -0.5, 0, 0.5], xlabel: '作答阈值 τ（把握超过它才回答）', ylabel: '每题平均得分', ylabelOffset: 44 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore();
    const line = (pen, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); for (let i = 0; i <= 100; i++) { const t = i / 100, y = ax.Y(A.clamp(evalAt(t, pen).score, ymin, ymax)); i ? ctx.lineTo(ax.X(t), y) : ctx.moveTo(ax.X(t), y); } ctx.stroke(); };
    line(0, A.alpha(cols[1], k === 0 ? 1 : 0.35), k === 0 ? 3 : 1.5);
    if (k > 0) line(k, cols[0], 3);
    const tStar = k / (1 + k);
    ctx.fillStyle = k === 0 ? cols[1] : cols[0]; ctx.beginPath(); ctx.arc(ax.X(tStar), ax.Y(A.clamp(evalAt(tStar, k).score, ymin, ymax)), 6, 0, 7); ctx.fill();
    A.text(ctx, '最优阈值 τ* = k/(1+k) = ' + tStar.toFixed(2), ax.X(Math.min(tStar, 0.6)) + 10, ax.Y(evalAt(tStar, k).score) - 14, { size: 12, weight: 700, color: k === 0 ? cols[1] : cols[0] });
    A.text(ctx, '浅色线：不扣分时', box.x + box.w - 4, box.y + 8, { size: 11.5, align: 'right', color: A.css('--muted') });
  });
  function draw() {
    if (!C.length) sample();
    const tStar = k / (1 + k), e = evalAt(tStar, k), e0 = evalAt(0, 0);
    stats.innerHTML = '';
    [['最优策略的作答率', A.pct(e.ansRate, 0)], ['其中答错（幻觉）的比例（占全部题）', A.pct(e.wrongRate, 1)], ['“全都作答”时的幻觉比例', A.pct(e0.wrongRate, 1)], ['准确率（答对 / 全部题）', A.pct(e.acc, 1)]]
      .forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = k === 0
      ? '只看准确率时，答错和不答一样都是 0 分，那么只要有一丝把握，回答总比说“不知道”划算：最优阈值是 0，模型应该对每道题都给出答案，没把握的题就“自信地猜”。如果训练和评测都这样计分，模型就会学会编造。这是 OpenAI（2025）对幻觉为何持续存在的解释之一。'
      : `答错扣 ${k} 分时，作答的期望得分是 c − (1 − c)·${k}，只有当把握 c 超过 k/(1+k) = ${tStar.toFixed(2)} 才值得回答。模型会在没把握时说“不知道”，幻觉从 ${A.pct(e0.wrongRate, 0)} 降到 ${A.pct(e.wrongRate, 1)}，代价是一些本来能蒙对的题也放弃了：准确率（答对的题占全部题）从 ${A.pct(1 - e0.wrongRate, 0)} 降到 ${A.pct(e.acc, 0)}。只看准确率的排行榜会惩罚这种诚实。OpenAI 建议评测明确告知这个阈值，并据此计分，让“承认不知道”得到回报。`;
    view.redraw();
  }
  draw();
});
