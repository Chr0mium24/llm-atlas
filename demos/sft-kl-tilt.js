/* sft-kl-tilt — KL 约束下的最优策略 π* ∝ π_ref·exp(R/β)：β 越小越听奖励模型，奖励分一路涨，真实质量先升后降 */
A.defineDemo('sft-kl-tilt', function (mount) {
  const { bd } = A.demo(mount, 'KL 约束下的最优策略：β 越小，越听奖励模型的', '玩具：一道题只有三个可能的回答；所有数字都是按公式精确算出的');
  const ANS = [
    { k: 'A', t: 'A 堪培拉。', ref: 0.5, Q: 1.0 },
    { k: 'B', t: 'B 堪培拉。（再写三句背景）', ref: 0.2, Q: 0.6 },
    { k: 'C', t: 'C 悉尼。', ref: 0.3, Q: -2.0 },
  ];
  let beta = 1, rB = 1.5;
  const R = () => [1.0, rB, -2.0];
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: 'KL 系数 β（越小越激进）', min: 0.05, max: 20, log: true, value: beta, fmt: (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1)), on: (v) => { beta = v; draw(); }, width: 210 });
  A.slider(ctl, { label: '奖励模型给啰嗦回答 B 的分（真实质量 0.6）', min: 0, max: 3, step: 0.05, value: rB, fmt: (v) => v.toFixed(2), on: (v) => { rB = v; draw(); }, width: 260 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const fp = (x) => (x < 1e-4 ? '<0.01%' : A.pct(x, x < 0.01 ? 2 : x < 0.1 ? 1 : 0));
  function solve(b) {
    const r = R(), w = ANS.map((a, i) => a.ref * Math.exp(r[i] / b)), Z = A.sum(w);
    const p = w.map((x) => x / Z);
    const ER = A.sum(p.map((x, i) => x * r[i])), EQ = A.sum(p.map((x, i) => x * ANS[i].Q));
    const KL = A.sum(p.map((x, i) => (x > 1e-300 ? x * Math.log(x / ANS[i].ref) : 0)));
    return { p, Z, ER, EQ, KL };
  }
  const BETAS = []; for (let i = 0; i <= 240; i++) BETAS.push(Math.pow(10, Math.log10(0.05) + (Math.log10(20) - Math.log10(0.05)) * i / 240)); // 0.05 … 20，与滑块一致
  const v1 = A.canvas(cv1, { aspect: 0.72 }, (ctx, W, H) => {
    const cols = A.series(), s = solve(beta);
    const box = { x: 40, y: 26, w: W - 52, h: H - 74 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 3, ymin: 0, ymax: 1, xticks: [], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => Math.round(v * 100) + '%', ylabel: '概率', ylabelOffset: 32 });
    const gw = box.w / 3, bw = gw * 0.3;
    ANS.forEach((a, i) => {
      const x0 = box.x + gw * i + gw * 0.18;
      A.bar(ctx, x0, ax.Y(a.ref), bw, ax.Y(0) - ax.Y(a.ref), A.alpha(A.css('--muted'), 0.45), 3);
      A.bar(ctx, x0 + bw + 4, ax.Y(s.p[i]), bw, ax.Y(0) - ax.Y(s.p[i]), [cols[2], cols[1], cols[7]][i], 3);
      A.text(ctx, A.pct(a.ref, 0), x0 + bw / 2, ax.Y(a.ref) - 8, { size: 11, align: 'center', color: A.css('--muted') });
      A.text(ctx, fp(s.p[i]), x0 + bw * 1.5 + 4, ax.Y(s.p[i]) - 8, { size: 11.5, align: 'center', weight: 700 });
      A.text(ctx, a.t.split(' ')[0] + ' ' + a.t.split(' ')[1].slice(0, 4) + (a.k === 'B' ? '…' : ''), box.x + gw * i + gw / 2, box.y + box.h + 14, { size: 12, align: 'center' });
      A.text(ctx, 'R=' + R()[i].toFixed(2) + '  Q=' + a.Q.toFixed(1), box.x + gw * i + gw / 2, box.y + box.h + 30, { size: 11, align: 'center', color: A.css('--muted'), mono: true });
    });
  });
  const v2 = A.canvas(cv2, { aspect: 0.72 }, (ctx, W, H) => {
    const cols = A.series(), cur = solve(beta);
    const pts = BETAS.map((b) => ({ b, ...solve(b) }));
    const ymax = Math.max(1.6, rB + 0.2);
    const box = { x: 42, y: 26, w: W - 56, h: H - 70 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1.7, ymin: -0.2, ymax, xticks: [0, 0.4, 0.8, 1.2, 1.6], xfmt: (v) => v.toFixed(1), yfmt: (v) => v.toFixed(1), xlabel: 'KL(π* ‖ π_ref)，nat', ylabel: '期望分数', ylabelOffset: 34 });
    const line = (key, c, w) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => { const x = ax.X(Math.min(p.KL, 1.7)), y = ax.Y(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
    line('ER', cols[1], 2.2); line('EQ', cols[0], 3);
    const bi = pts.reduce((b, p, i) => (p.EQ > pts[b].EQ ? i : b), 0);
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ax.X(Math.min(pts[bi].KL, 1.7)), ax.Y(pts[bi].EQ), 7, 0, 7); ctx.stroke();
    [['ER', cols[1]], ['EQ', cols[0]]].forEach(([k, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ax.X(Math.min(cur.KL, 1.7)), ax.Y(cur[k]), 5, 0, 7); ctx.fill(); });
    A.text(ctx, 'β = ' + (beta < 1 ? beta.toFixed(2) : beta.toFixed(1)), ax.X(Math.min(cur.KL, 1.7)) + 8, ax.Y(cur.ER) - 12, { size: 11.5, weight: 700, color: A.css('--ink-2') });
  });
  function draw() {
    const cols = A.series(), s = solve(beta);
    const pts = BETAS.map((b) => ({ b, ...solve(b) }));
    const bi = pts.reduce((b, p, i) => (p.EQ > pts[b].EQ ? i : b), 0), pk = pts[bi];
    stats.innerHTML = '';
    [['π*（A, B, C）', s.p.map(fp).join(' / ')], ['奖励模型的期望分 E[R]', s.ER.toFixed(2) + '（SFT 模型 ' + solve(1e6).ER.toFixed(2) + '）'], ['真实质量 E[Q]', s.EQ.toFixed(2) + '（SFT 模型 0.02）'], ['离 SFT 模型多远 KL', s.KL.toFixed(2) + ' nat']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    legend.innerHTML = `<span><i style="background:${A.alpha(A.css('--muted'), 0.45)}"></i>π_ref（SFT 模型）</span><span><i style="background:${cols[2]}"></i><i style="background:${cols[1]}"></i><i style="background:${cols[7]}"></i>π*（按 β 重新加权后）</span><span><i class="line" style="background:${cols[1]}"></i>奖励模型的期望分</span><span><i class="line" style="background:${cols[0]}"></i>真实质量（人真正的偏好）</span>`;
    const biased = rB > 1.0 + 1e-9, over = rB > 0.6 + 1e-9;
    hint.innerHTML = (biased
      ? `奖励模型高估了啰嗦的 B（给它 ${rB.toFixed(2)}，比 A 的 1.0 还高；人实际只给 0.6）。β 从大往小调：先是错误的 C 被迅速压掉，真实质量快速上升；再往下，概率开始从简洁的 A 流向奖励模型偏爱的 B，奖励分继续涨，真实质量却回落。真实质量的最高点在 β ≈ ${pk.b.toFixed(2)}、KL ≈ ${pk.KL.toFixed(2)} nat 处（右图圆圈）。这就是古德哈特定律最小的样子，也是 KL 约束存在的理由。`
      : over
        ? `B 被高估了（${rB.toFixed(2)}，人实际只给 0.6），但仍排在 A 的 1.0 之后：β 越小，概率越集中到 A，真实质量单调上升。只有当代理把错的回答排到第一，才有可钻的空子。`
        : '奖励模型对 B 的打分和人一致（不高于 0.6）时，没有可钻的空子：β 越小，概率越集中到真正最好的 A 上，真实质量单调上升。过度优化只在代理有偏差时出现。')
      + ' 无论 β 取多少，π* 都只是在 π_ref 上按 e^{R/β} 重新加权：π_ref 给 0 的回答，π* 也是 0。';
    v1.redraw(); v2.redraw();
  }
  A.onTheme(draw);
  draw();
});
