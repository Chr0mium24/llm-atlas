/* importance-sampling — estimate an expectation under a new policy with samples from the old one; KL, ESS, truncation */
A.defineDemo('importance-sampling', function (mount) {
  const { bd } = A.demo(mount, '重要性采样：用旧策略的样本估计新策略的平均得分', '8 种可能的回答；每次抽 32 个旧样本，重复 400 次');
  const K = 8, N = 32, TRIALS = 400;
  const F = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1]; // reward of each kind of answer
  const base = A.softmax([1.2, 2.0, 2.4, 2.1, 1.5, 0.8, 0.2, -0.4]); // old policy
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const tau = A.slider(ctl, { label: '新策略离旧策略多远（往高分回答倾斜）', min: 0, max: 4, step: 0.05, value: 1.2, fmt: (v) => v.toFixed(2), on: run, width: 260 });
  let C = 0;
  A.seg(ctl, [{ v: 0, t: '不截断' }, { v: 2, t: '权重截断在 2' }, { v: 5, t: '截断在 5' }], C, (v) => { C = v; run(); }, '截断权重');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--axis)"></i>旧策略 π_old（样本来自它）</span><span><i style="background:var(--s1)"></i>新策略 π_new</span><span><i style="background:var(--s3)"></i>400 次估计的分布</span><span><i class="line" style="background:var(--s8)"></i>真实值 E_new[R]</span>' }));
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  let pNew, est, truth, kl, essMean;
  function run() {
    pNew = A.softmax(base.map((p, i) => Math.log(p) + tau.value * F[i] * 2));
    truth = A.sum(pNew.map((p, i) => p * F[i]));
    kl = A.sum(pNew.map((p, i) => p * Math.log(p / base[i])));
    const r = A.rng(5);
    est = []; let essSum = 0;
    for (let t = 0; t < TRIALS; t++) {
      let s = 0, sw = 0, sw2 = 0;
      for (let n = 0; n < N; n++) {
        let u = r(), x = 0; for (; x < K - 1; x++) { u -= base[x]; if (u <= 0) break; }
        let w = pNew[x] / base[x]; if (C) w = Math.min(w, C);
        s += w * F[x]; sw += w; sw2 += w * w;
      }
      est.push(s / N); essSum += (sw * sw) / sw2 / N;
    }
    essMean = essSum / TRIALS;
    const m = A.mean(est), sd = Math.sqrt(A.mean(est.map((e) => (e - m) ** 2)));
    stats.innerHTML = '';
    [['KL(π_new ‖ π_old)', kl.toFixed(3) + ' nat'], ['真实值 E_new[R]', truth.toFixed(3)], ['估计的平均 ± 标准差', m.toFixed(3) + ' ± ' + sd.toFixed(3)], ['有效样本比例 ESS / N', A.pct(essMean, 0)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    const bias = m - truth;
    note.textContent = (kl < 0.05 ? '两个策略几乎一样，权重都接近 1，估计又准又稳。' : kl < 0.5 ? '新策略偏向高分回答，这些回答在旧样本里少见，抽到时权重很大。估计仍然无偏，但波动明显变大。' : '两个策略差得很远：新策略最常给的回答，旧策略几乎不会生成，偶尔抽到一个就带着极大的权重。估计的波动非常大，ESS 很低，相当于 32 个样本里只有几个在起作用。这就是为什么要限制每次更新的幅度（信任域）。')
      + (C ? ` 截断权重让波动变小，代价是估计系统性地偏低了 ${Math.abs(bias).toFixed(3)}：用一点偏差换方差。PPO 的裁剪和 TIS 都是这种取舍。` : '');
    v1.redraw(); v2.redraw();
  }
  const v1 = A.canvas(cv1, { aspect: 0.75 }, (ctx, W, H) => {
    if (!pNew) return;
    const box = { x: 34, y: 18, w: W - 44, h: H - 64 };
    const mx = Math.max(...base, ...pNew) * 1.1, bw = box.w / K;
    A.axes(ctx, box, { xmin: 0, xmax: K, ymin: 0, ymax: mx, xticks: [], yfmt: (v) => A.pct(v, 0) });
    for (let i = 0; i < K; i++) {
      const x = box.x + i * bw;
      const h0 = (base[i] / mx) * box.h, h1 = (pNew[i] / mx) * box.h;
      A.bar(ctx, x + bw * 0.12, box.y + box.h - h0, bw * 0.36, h0, A.css('--axis'), 3);
      A.bar(ctx, x + bw * 0.52, box.y + box.h - h1, bw * 0.36, h1, A.css('--s1'), 3);
      A.text(ctx, 'R=' + F[i], x + bw / 2, box.y + box.h + 12, { size: 10.5, align: 'center', color: A.css('--muted') });
      A.text(ctx, '×' + (pNew[i] / base[i]).toFixed(pNew[i] / base[i] > 10 ? 0 : 1), x + bw / 2, box.y + box.h + 28, { size: 10.5, align: 'center', mono: true, color: A.css('--ink-2') });
    }
    A.text(ctx, '每种回答的概率；下面一行是权重 π_new / π_old', box.x, 8, { size: 11.5, color: A.css('--muted') });
  });
  const v2 = A.canvas(cv2, { aspect: 0.75 }, (ctx, W, H) => {
    if (!est) return;
    const box = { x: 34, y: 18, w: W - 44, h: H - 50 };
    const lo = 0, hi = 1.2, nb = 48, cnt = new Array(nb).fill(0);
    est.forEach((e) => { const b = Math.floor(((A.clamp(e, lo, hi - 1e-9) - lo) / (hi - lo)) * nb); cnt[b]++; });
    const mx = Math.max(...cnt);
    const ax = A.axes(ctx, box, { xmin: lo, xmax: hi, ymin: 0, ymax: 1, yticks: [], xfmt: (v) => v.toFixed(1), xlabel: '一次估计的结果' });
    const bw = box.w / nb;
    cnt.forEach((c, i) => { const h = (c / mx) * box.h; A.bar(ctx, box.x + i * bw + 0.5, box.y + box.h - h, bw - 1, h, A.css('--s3'), 2); });
    ctx.strokeStyle = A.css('--s8'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax.X(truth), box.y); ctx.lineTo(ax.X(truth), box.y + box.h); ctx.stroke();
    A.text(ctx, '400 次估计的分布（每次 32 个旧样本）', box.x, 8, { size: 11.5, color: A.css('--muted') });
  });
  run();
});
