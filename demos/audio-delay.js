/* audio-delay — five ways to arrange a K-codebook × T-frame token grid into generation steps; step through and see what each token can condition on */
A.defineDemo('audio-delay', function (mount) {
  const { bd } = A.demo(mount, '多码本 token 的五种排法：谁先写，谁看得见谁', '4 级码本 × 6 帧的玩具编号表；格子里的数字是它在第几步生成。点任意一个格子，跳到它生成的那一步');
  const K = 4, T = 6;
  const PATS = {
    flat: { t: '展平', tex: String.raw`p(\mathbf Q)=\prod_{t}\prod_{k} p\big(q_{t,k}\mid q_{<t,\cdot},\ q_{t,<k}\big)`, note: '一帧一帧地写，每帧从第 1 级写到第 4 级。完全符合链式法则，没有任何近似，代价是步数等于编号总数。' },
    par: { t: '并行', tex: String.raw`p(\mathbf Q)\approx\prod_{t}\prod_{k} p\big(q_{t,k}\mid q_{<t,\cdot}\big)`, note: '每一步同时写出一帧的 4 级。步数最少，但同一帧的 4 级互相看不见：第 2 级不知道第 1 级选了哪个码字，可它量化的恰恰是第 1 级留下的残差。' },
    delay: { t: '延迟', tex: String.raw`P_s=\{(s-k+1,\ k)\},\qquad S=T+K-1`, note: '第 k 级整体往后推 k−1 步。每一步同时写“第 1 级的第 s 帧、第 2 级的第 s−1 帧……”，写第 k 级时，同一帧更粗的级都已经写好了。' },
    valle: { t: '先粗后细（VALL-E）', tex: String.raw`\prod_{t} p\big(q_{t,1}\mid q_{<t,1}\big)\times\prod_{k\ge 2} p\big(\mathbf q_{:,k}\mid \mathbf q_{:,<k}\big)`, note: '先自回归地逐帧写完第 1 级（决定内容和节奏），再一步写出整行第 2 级、一步整行第 3 级……非自回归的每一行，能看见所有帧更粗的级，但同一行的各帧互相看不见。' },
    depth: { t: '深度 Transformer（Moshi）', tex: String.raw`\mathbf z_t=\text{大}(q_{<t,\cdot}),\qquad q_{t,k}\sim\text{小}\big(\mathbf z_t,\ q_{t,<k}\big)`, note: '顺序和展平一样，没有近似；区别在谁来走：大模型每帧只走 1 步，给出上下文向量；帧内的 4 级由一个小得多的模型逐个生成。' },
  };
  function schedule(p) {
    const S = [];
    if (p === 'flat' || p === 'depth') for (let t = 1; t <= T; t++) for (let k = 1; k <= K; k++) S.push([[t, k]]);
    if (p === 'par') for (let t = 1; t <= T; t++) S.push(Array.from({ length: K }, (_, i) => [t, i + 1]));
    if (p === 'delay') for (let s = 1; s <= T + K - 1; s++) { const g = []; for (let k = 1; k <= K; k++) { const t = s - k + 1; if (t >= 1 && t <= T) g.push([t, k]); } S.push(g); }
    if (p === 'valle') { for (let t = 1; t <= T; t++) S.push([[t, 1]]); for (let k = 2; k <= K; k++) S.push(Array.from({ length: T }, (_, i) => [i + 1, k])); }
    return S;
  }
  let pat = 'delay', S = schedule(pat), step = 0, sel = null;
  const stepOf = () => { const m = {}; S.forEach((g, s) => g.forEach(([t, k]) => (m[t + ',' + k] = s))); return m; };
  const isParent = (t, k, tt, kk) => tt < t || (tt === t && kk < k); // exact frame-major chain rule
  // ---- UI ----
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const seg = A.seg(ctl, Object.entries(PATS).map(([v, o]) => ({ v, t: o.t })), pat, (v) => { pat = v; S = schedule(pat); step = 0; sel = null; render(); }, '排法');
  const bar = A.el('div', { class: 'flex', style: { margin: '6px 0' } });
  const prev = A.el('button', { onclick: () => go(step - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(step + 1) }, '下一步 →');
  bar.append(prev, next); bd.append(bar);
  const slider = A.el('input', { type: 'range', min: 0, max: S.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value); bd.append(slider);
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const cv = A.el('canvas', { class: 'cv' });
  const stats = A.el('div', { class: 'stats' });
  bd.append(fx, say, cv, stats);
  const cols = A.series();
  let cells = [];
  function go(i) { step = A.clamp(i, 0, S.length - 1); sel = null; render(); }
  const view = A.canvas(cv, { height: 300 }, (ctx, W, H) => {
    const m = stepOf(), g = S[step], target = sel || g[Math.floor((g.length - 1) / 2)];
    const narrow = W < 560, lx = narrow ? 44 : 86, top = 24, cw = Math.min(96, (W - lx - 10) / T), ch = Math.min(46, (H - top - 62) / K);
    cells = [];
    if (narrow) A.text(ctx, '帧', lx - 8, top - 10, { size: 11.5, align: 'right', color: A.css('--muted') });
    for (let t = 1; t <= T; t++) A.text(ctx, narrow ? String(t) : '第 ' + t + ' 帧', lx + (t - 0.5) * cw, top - 10, { size: 11.5, align: 'center', color: A.css('--muted') });
    for (let k = 1; k <= K; k++) A.text(ctx, narrow ? k + ' 级' : '第 ' + k + ' 级' + (k === 1 ? '（粗）' : k === K ? '（细）' : ''), lx - 8, top + (k - 0.5) * ch, { size: 11.5, align: 'right', color: A.css('--ink-2') });
    const inStep = (t, k) => g.some(([a, b]) => a === t && b === k);
    for (let t = 1; t <= T; t++) for (let k = 1; k <= K; k++) {
      const x = lx + (t - 1) * cw + 3, y = top + (k - 1) * ch + 3, w = cw - 6, h = ch - 6, s = m[t + ',' + k];
      cells.push({ x, y, w, h, t, k });
      const done = s < step, now = inStep(t, k);
      ctx.fillStyle = done ? A.alpha(cols[k], 0.45) : now ? A.alpha(cols[k], 0.85) : 'transparent';
      ctx.fillRect(x, y, w, h);
      ctx.lineWidth = now ? 2.5 : 1; ctx.strokeStyle = now ? A.css('--accent') : A.css('--grid');
      if (!done && !now) ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.setLineDash([]);
      A.text(ctx, narrow ? String(s + 1) : '第 ' + (s + 1) + ' 步', x + w / 2, y + h / 2, { size: 11.5, align: 'center', color: done || now ? A.css('--ink') : A.css('--muted'), weight: now ? 700 : 400 });
      // relation to the selected target token
      const [tt, tk] = target;
      if (t === tt && k === tk) { ctx.lineWidth = 3; ctx.strokeStyle = A.css('--ink'); ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); }
      else {
        const seen = s < m[tt + ',' + tk], parent = isParent(tt, tk, t, k);
        if (parent && !seen) { ctx.strokeStyle = A.css('--bad'); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x + w - 16, y + 5); ctx.lineTo(x + w - 6, y + 15); ctx.moveTo(x + w - 6, y + 5); ctx.lineTo(x + w - 16, y + 15); ctx.stroke(); }
        if (!parent && seen) { ctx.fillStyle = cols[6]; ctx.beginPath(); ctx.arc(x + w - 10, y + 10, 5, 0, 7); ctx.fill(); }
      }
    }
    const ly = top + K * ch + 16;
    const leg = narrow ? ['格中数字 = 第几步生成；蓝框 = 这一步同时生成', '实心 = 已生成；虚线 = 还没生成；黑框 = 选中', '红叉 = 精确分解要它看见、它却看不见', '紫点 = 额外看见的后面帧的粗码'] : ['蓝框 = 这一步同时生成；实心 = 已生成；虚线 = 还没生成；黑框 = 选中的编号', '红叉 = 精确分解要它看见、它却看不见的；紫点 = 精确分解之外额外看见的（后面帧的粗码）'];
    leg.forEach((l, i) => A.text(ctx, l, 10, ly + 17 * i, { size: 11.5, color: A.css('--muted') }));
  });
  cv.addEventListener('click', (ev) => {
    const p = A.pos(cv, ev), c = cells.find((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
    if (!c) return; const m = stepOf(); step = m[c.t + ',' + c.k]; sel = [c.t, c.k]; render();
  });
  function render() {
    slider.max = S.length - 1; slider.value = step;
    prev.disabled = step === 0; next.disabled = step === S.length - 1;
    const o = PATS[pat], g = S[step], target = sel || g[Math.floor((g.length - 1) / 2)], m = stepOf();
    if (window.katex) katex.render(o.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = o.tex;
    let miss = 0, extra = 0, seenN = 0;
    for (let t = 1; t <= T; t++) for (let k = 1; k <= K; k++) { if (t === target[0] && k === target[1]) continue; const seen = m[t + ',' + k] < m[target + ''], par = isParent(target[0], target[1], t, k); if (seen) seenN++; if (par && !seen) miss++; if (!par && seen) extra++; }
    const list = g.map(([t, k]) => `(${t},${k})`).join('、');
    let big = 0, small = 0;
    S.slice(0, step + 1).forEach((gg) => { if (pat === 'depth') { small += gg.length; if (gg[0][1] === 1) big++; } else big++; });
    const callTxt = pat === 'depth' ? `到这一步，大模型走了 ${big} 步，小模型走了 ${small} 步。` : `到这一步，模型走了 ${big} 步。`;
    say.innerHTML = `<b>第 ${step + 1} / ${S.length} 步。</b>${o.note} 这一步同时生成 ${list}（括号里是“第几帧，第几级”）。选中的 (${target[0]},${target[1]}) 生成时看得见 ${seenN} 个编号` + (miss ? `，<b>缺了 ${miss} 个</b>精确分解要求它看见的（红叉）` : '，精确分解要求的一个不缺') + (extra ? `，另外还看见 ${extra} 个后面帧的粗码（紫点）` : '') + `。${callTxt}`;
    const f = 50, sec = 30, Tn = f * sec;
    const steps = { flat: Tn * 4, par: Tn, delay: Tn + 3, valle: Tn + 3, depth: Tn };
    const fad = { flat: '0.86', par: '2.58', delay: '0.96', valle: '未测（它测的“先粗后细”第二阶段逐帧并行，3000 步，1.98）', depth: '未测（与展平同一分解）' };
    stats.innerHTML = '';
    [['本例总步数', S.length + ' 步（4 级 × 6 帧 = 24 个编号）'], ['MusicGen 设置下 30 秒的步数', pat === 'depth' ? `大模型 ${Tn}，小模型 ${Tn * 4}` : steps[pat] + ' 步'], ['MusicGen 实测 FAD（越低越好）', fad[pat]]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '15px' } }, v))));
    seg.set(pat);
    view.redraw();
  }
  render();
});
