/* rl-clip — how PPO/GRPO, DAPO, CISPO and GSPO turn the same rollout into per-token gradient weights */
A.defineDemo('rl-clip', function (mount) {
  const { bd } = A.demo(mount, '同一条回答，四种算法给每个 token 多大的梯度', '玩具数据：比率 r_t 随机生成，“等等”“检查”两个反思 token 比率偏高');
  const TOK = ['设', '鸡', 'x', '只', '，', '兔', 'y', '只', '。', 'x+y', '=35', '，', '等等', '，', '检查', '腿数', '：', '2x+4y', '=94', '。'];
  const REFLECT = new Set([12, 14]);
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let adv = 1, seed = 3;
  A.seg(ctl, [{ v: 1, t: '答对（A > 0）' }, { v: -1, t: '答错（A < 0）' }], adv, (v) => { adv = v; draw(); }, '这条回答');
  const sig = A.slider(ctl, { label: '策略已经变了多少（比率的离散度）', min: 0.02, max: 0.4, step: 0.01, value: 0.12, fmt: (v) => v.toFixed(2), on: () => { gen(); draw(); }, width: 230 });
  const refl = A.slider(ctl, { label: '反思 token 的比率', min: 0.5, max: 2.5, step: 0.05, value: 1.6, fmt: (v) => v.toFixed(2), on: () => { gen(); draw(); } });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const eLow = A.slider(ctl2, { label: 'ε（下界，PPO 的对称阈值）', min: 0.05, max: 0.4, step: 0.01, value: 0.2, fmt: (v) => v.toFixed(2), on: draw });
  const eHigh = A.slider(ctl2, { label: 'ε_high（DAPO / CISPO 的上界）', min: 0.05, max: 0.6, step: 0.01, value: 0.28, fmt: (v) => v.toFixed(2), on: draw });
  ctl2.append(A.el('button', { onclick: () => { seed++; gen(); draw(); } }, '换一组随机比率'));
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span>悬停查看每个 token 的比率和四种权重</span><span><i style="background:var(--s1)"></i>梯度把这个 token 的概率往上推（颜色越深权重越大）</span><span><i style="background:var(--s8)"></i>往下压</span><span><i style="background:var(--grid);border:1px dashed var(--muted)"></i>被裁剪，梯度为 0</span>' }));
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  let lr = [];
  function gen() {
    const r = A.rng(seed * 977);
    lr = TOK.map((_, i) => (REFLECT.has(i) ? Math.log(refl.value) + A.gauss(r) * 0.03 : A.gauss(r) * sig.value));
  }
  function weights() {
    const el = eLow.value, eh = eHigh.value, A0 = adv;
    const rr = lr.map(Math.exp);
    const ppo = rr.map((x) => ((A0 > 0 && x > 1 + el) || (A0 < 0 && x < 1 - el) ? 0 : x * A0));
    const dapo = rr.map((x) => ((A0 > 0 && x > 1 + eh) || (A0 < 0 && x < 1 - el) ? 0 : x * A0));
    const cispo = rr.map((x) => Math.min(x, 1 + eh) * A0);
    const s = Math.exp(A.mean(lr));
    const gclip = (A0 > 0 && s > 1 + el) || (A0 < 0 && s < 1 - el);
    const gspo = rr.map(() => (gclip ? 0 : s * A0));
    return { rows: [['PPO / GRPO', '逐 token 比率，对称裁剪 ±ε', ppo], ['DAPO', '逐 token，非对称裁剪（上界 ε_high）', dapo], ['CISPO', '不裁剪梯度，只截断权重', cispo], ['GSPO', '整条回答的几何平均比率 s', gspo]], s };
  }
  let geo = null;
  const view = A.canvas(cv, { height: 260 }, (ctx, W, H) => {
    const { rows } = weights();
    const left = 92, showR = (W - left - 8) / TOK.length >= 30, top = showR ? 46 : 28, rowH = (H - top - 8) / rows.length, cw = (W - left - 8) / TOK.length;
    geo = { left, top, rowH, cw };
    const fs = Math.max(10, Math.min(13, cw * 0.5));
    TOK.forEach((t, i) => {
      const x = left + i * cw + cw / 2;
      ctx.save(); ctx.translate(x, 16);
      if (cw < 26) ctx.rotate(-Math.PI / 4);
      A.text(ctx, t, 0, 0, { size: fs, align: cw < 26 ? 'left' : 'center', weight: REFLECT.has(i) ? 700 : 400, color: REFLECT.has(i) ? A.css('--s2') : A.css('--ink-2') });
      ctx.restore();
      if (showR) A.text(ctx, Math.exp(lr[i]).toFixed(2), x, 34, { size: 10.5, align: 'center', mono: true, color: A.css('--muted') });
    });
    if (showR) A.text(ctx, 'r_t', left - 8, 34, { size: 11, align: 'right', color: A.css('--muted') });
    const maxW = 1 + Math.max(eHigh.value, 0.6);
    rows.forEach(([n, , w], ri) => {
      const y = top + ri * rowH;
      A.text(ctx, n, 0, y + rowH / 2, { size: 13, weight: 650 });
      w.forEach((v, i) => {
        const x = left + i * cw;
        if (v === 0) {
          ctx.fillStyle = A.css('--grid'); ctx.fillRect(x + 1, y + 3, cw - 2, rowH - 6);
          ctx.strokeStyle = A.css('--muted'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 3, y + rowH - 5); ctx.lineTo(x + cw - 3, y + 5); ctx.stroke();
        } else {
          ctx.fillStyle = A.div(A.clamp(v / maxW, -1, 1));
          ctx.fillRect(x + 1, y + 3, cw - 2, rowH - 6);
        }
      });
    });
  });
  cv.addEventListener('mousemove', (e) => {
    if (!geo) return;
    const p = A.pos(cv, e), i = Math.floor((p.x - geo.left) / geo.cw);
    if (i < 0 || i >= TOK.length || p.y < geo.top) { A.tip.hide(); return; }
    const { rows } = weights();
    A.tip.show(`<b>「${TOK[i]}」</b> r_t = ${Math.exp(lr[i]).toFixed(3)}<br>` + rows.map(([n, , w]) => `${n}：${w[i] === 0 ? '<b>0（被裁剪）</b>' : (w[i] > 0 ? '+' : '') + w[i].toFixed(3)}`).join('<br>'), e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    view.redraw();
    const { rows, s } = weights();
    const zeros = rows.map((r) => r[2].filter((v) => v === 0).length);
    const reflZero = rows.map((r) => [...REFLECT].filter((i) => r[2][i] === 0).length);
    const parts = [];
    if (adv > 0) {
      if (reflZero[0]) parts.push(`PPO 把 ${reflZero[0]} 个反思 token 的梯度裁成了 0：它们的比率已经超过 1+ε，可这次回答恰恰是答对的，这些 token 正是最该被加强的。`);
      if (reflZero[0] && !reflZero[1]) parts.push('DAPO 把上界放宽到 1+ε_high，它们又有了梯度。');
      if (reflZero[1]) parts.push(`DAPO 的上界也不够大，反思 token 仍被裁掉 ${reflZero[1]} 个。`);
      parts.push('CISPO 永远不丢梯度，只把权重截断在 1+ε_high。');
    } else {
      parts.push('答错时情况反过来：比率低于 1−ε 的 token 被裁剪（模型已经在减少它们），比率高的 token 照常被压低。');
    }
    parts.push(`GSPO 看整条回答的几何平均比率 s = ${s.toFixed(3)}：要么所有 token 一起有梯度、权重相同，要么整条一起被裁掉。各方法失去梯度的 token 数：PPO ${zeros[0]}，DAPO ${zeros[1]}，CISPO ${zeros[2]}，GSPO ${zeros[3]}。`);
    note.textContent = parts.join('');
  }
  gen(); draw();
});
