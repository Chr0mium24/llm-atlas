/* grpo-toy — interactive demo (moved from ch06-reasoning.html) */
A.defineDemo('grpo-toy', function (mount) {
  const { bd } = A.demo(mount, 'GRPO 玩具：只给“对 / 错”，策略自己变好', '一组 G 个采样 → 组内标准化优势 → 策略梯度');
  const STRATS = [
    { n: '直接报答案', acc: 0.12, len: 20 },
    { n: '抄题干数字', acc: 0.05, len: 15 },
    { n: '简单列式', acc: 0.32, len: 120 },
    { n: '分步推导', acc: 0.58, len: 600 },
    { n: '分步 + 自我检查', acc: 0.82, len: 1800 },
    { n: '多思路对比再验证', acc: 0.9, len: 4200 },
  ];
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const G = A.slider(ctl, { label: '组大小 G', min: 2, max: 32, step: 1, value: 8, fmt: (v) => v });
  const lr = A.slider(ctl, { label: '学习率', min: 0.05, max: 2, step: 0.05, value: 0.5, fmt: (v) => v.toFixed(2) });
  const beta = A.slider(ctl, { label: 'KL 系数 β', min: 0, max: 0.5, step: 0.01, value: 0.02, fmt: (v) => v.toFixed(2) });
  const diff = A.slider(ctl, { label: '题目难度', min: 0, max: 1, step: 0.01, value: 0.3, fmt: (v) => (v < 0.2 ? '简单' : v < 0.6 ? '中等' : v < 0.9 ? '难' : '极难') + ' ' + v.toFixed(2) });
  const btns = A.el('div', { class: 'flex', style: { marginBottom: '10px' } }); bd.append(btns);
  let timer = null;
  btns.append(A.el('button', { onclick: () => step(1) }, '训练 1 步'), A.el('button', { class: 'primary', onclick: () => run() }, '连续训练 / 暂停'), A.el('button', { onclick: reset }, '重置'));
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2); bd.append(grid);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const tbl = A.el('div', { class: 'small', style: { marginTop: '8px' } }); bd.append(tbl);
  legend.innerHTML = '<span><i class="line" style="background:var(--s1)"></i>期望正确率</span><span><i class="line" style="background:var(--s2)"></i>平均思维链长度（token，右图按 0–4500 缩放）</span>';
  let theta, ref, hist, it, lastGroup, rnd;
  const accOf = (i) => STRATS[i].acc * (1 - diff.value * 0.92);
  function reset() { theta = [1.2, 1.0, 0.6, 0.0, -0.8, -1.5]; ref = theta.slice(); hist = []; it = 0; lastGroup = null; rnd = A.rng(5); record(); render(); }
  function pi() { return A.softmax(theta); }
  function record() { const p = pi(); hist.push({ acc: A.sum(p.map((x, i) => x * accOf(i))), len: A.sum(p.map((x, i) => x * STRATS[i].len)) }); }
  function step(n) {
    for (let k = 0; k < n; k++) {
      const p = pi(), g = Math.round(G.value);
      const grp = [];
      for (let j = 0; j < g; j++) {
        let u = rnd(), a = 0; for (; a < 5; a++) { u -= p[a]; if (u <= 0) break; }
        grp.push({ a, r: rnd() < accOf(a) ? 1 : 0 });
      }
      const m = A.mean(grp.map((x) => x.r)), sd = Math.sqrt(A.mean(grp.map((x) => (x.r - m) ** 2)));
      grp.forEach((x) => (x.adv = sd > 1e-9 ? (x.r - m) / sd : 0));
      const grad = new Array(6).fill(0);
      grp.forEach((x) => { for (let i = 0; i < 6; i++) grad[i] += (x.adv * ((i === x.a ? 1 : 0) - p[i])) / g; });
      // KL(pi||ref) gradient wrt logits: p_i*(log p_i/ref_i - KL)
      const pr = A.softmax(ref);
      const kl = A.sum(p.map((x, i) => x * Math.log(x / pr[i])));
      for (let i = 0; i < 6; i++) theta[i] += lr.value * (grad[i] - beta.value * p[i] * (Math.log(p[i] / pr[i]) - kl));
      lastGroup = grp; it++; record();
    }
    render();
  }
  function run() {
    if (timer) { clearInterval(timer); timer = null; return; }
    timer = setInterval(() => { step(1); if (it > 400) { clearInterval(timer); timer = null; } }, 60);
  }
  const v1 = A.canvas(cv1, { aspect: 0.75 }, (ctx, W, H) => {
    const p = pi(), cols = A.series();
    const lw = 116, rowH = (H - 30) / 6;
    A.text(ctx, '策略 π(策略)　[答对率 · 思维链长度]', 0, 10, { size: 12, color: A.css('--muted') });
    STRATS.forEach((s, i) => {
      const y = 24 + i * rowH;
      A.text(ctx, s.n, lw - 8, y + rowH / 2 - 6, { size: 12.5, align: 'right' });
      A.text(ctx, A.pct(accOf(i), 0) + ' · ' + s.len + ' tok', lw - 8, y + rowH / 2 + 9, { size: 10.5, align: 'right', color: A.css('--muted') });
      A.hbar(ctx, lw, y + rowH / 2 - 9, (W - lw - 54) * p[i], 18, cols[0]);
      A.text(ctx, A.pct(p[i], 1), lw + (W - lw - 54) * p[i] + 6, y + rowH / 2, { size: 12, mono: true, color: A.css('--ink-2') });
    });
  });
  const v2 = A.canvas(cv2, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 40, y: 16, w: W - 56, h: H - 48 };
    const n = Math.max(50, hist.length);
    const ax = A.axes(ctx, box, { xmin: 0, xmax: n, ymin: 0, ymax: 1, yfmt: (v) => A.pct(v, 0), xfmt: (v) => v, xlabel: '训练步数' });
    const cols = A.series();
    ctx.lineWidth = 2;
    ctx.strokeStyle = cols[0]; ctx.beginPath(); hist.forEach((h, i) => { const x = ax.X(i), y = ax.Y(h.acc); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    ctx.strokeStyle = cols[1]; ctx.beginPath(); hist.forEach((h, i) => { const x = ax.X(i), y = ax.Y(h.len / 4500); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    const last = hist[hist.length - 1];
    A.text(ctx, '正确率 ' + A.pct(last.acc, 1), box.x + 6, box.y + 6, { size: 12, color: cols[0], weight: 600 });
    A.text(ctx, '平均长度 ' + Math.round(last.len) + ' tok', box.x + 6, box.y + 24, { size: 12, color: cols[1], weight: 600 });
  });
  function render() {
    v1.redraw(); v2.redraw();
    if (!lastGroup) { tbl.innerHTML = '<span class="muted">点击“训练 1 步”查看一组采样的奖励和优势。</span>'; return; }
    const allSame = lastGroup.every((x) => x.r === lastGroup[0].r);
    tbl.innerHTML = `<b>第 ${it} 步的采样组：</b> ` + lastGroup.map((x) => `<span class="tok" style="background:${x.r ? 'color-mix(in srgb, var(--good) 22%, transparent)' : 'color-mix(in srgb, var(--bad) 18%, transparent)'}">${STRATS[x.a].n} ${x.r ? '✓' : '✗'} <b>${x.adv >= 0 ? '+' : ''}${x.adv.toFixed(2)}</b></span>`).join(' ') +
      (allSame ? '<div style="color:var(--s2);margin-top:4px">⚠ 这一组奖励全部相同，优势全为 0，这一步没有学到任何东西。</div>' : '');
  }
  reset();
});
