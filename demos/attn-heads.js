/* attn-heads — rule-built attention patterns (previous token, induction, copy, local window, sink, uniform) on any sentence */
A.defineDemo('attn-heads', function (mount) {
  const { bd } = A.demo(mount, '注意力模式浏览器：几种典型的头', '悬停某一行，看这个位置在关注谁');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const inp = A.el('input', { type: 'text', style: { width: '100%' } });
  inp.value = '哈利波特走进了霍格沃茨。第二天，哈利波特又走进了霍格沃茨';
  bd.insertBefore(A.el('div', { class: 'small muted' }, '输入句子（中文按字切，英文按词切）'), ctl);
  bd.insertBefore(inp, ctl);
  let head = 'induction', causal = true, hover = -1;
  const HEADS = [
    { v: 'prev', t: '前一个 token' }, { v: 'induction', t: '归纳头' }, { v: 'copy', t: '相同 token' },
    { v: 'local', t: '局部窗口 4' }, { v: 'sink', t: '注意力汇' }, { v: 'uniform', t: '均匀平均' },
  ];
  A.seg(ctl, HEADS, head, (v) => { head = v; render(); }, '头的类型');
  A.check(ctl, '因果掩码（只能看过去）', true, (v) => { causal = v; render(); });
  const DESC = {
    prev: '每个位置把几乎全部权重给紧挨着的前一个 token。它是归纳头的“前置零件”：把“我前面是谁”的信息写进当前位置。',
    induction: '当前 token 如果之前出现过，就去看它上一次出现时的“下一个 token”。比如第二个“哈”看向第一个“哈”后面的“利”，于是模型能预测下一个 token 是“利”。没出现过的 token 把权重放到开头（汇聚）。',
    copy: '看过去所有和自己相同的 token。可以用于复制、计数和指代。',
    local: '只看最近 4 个 token。Mistral、Gemma 的滑动窗口注意力就是这种模式，代价是 O(n·w) 而不是 O(n²)。',
    sink: '大部分权重落在第 1 个 token 上，剩余的权重给自己。这个头相当于“什么也不做”。',
    uniform: '对所有可见位置平均。用来汇总整段上下文的“平均语义”。',
  };
  const desc = A.el('p', { class: 'small', style: { margin: '0 0 10px' } }); bd.append(desc);
  const grid = A.el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: '16px' } });
  const cv = A.el('canvas', { class: 'cv' });
  const right = A.el('div', { style: { lineHeight: '2.2' } });
  grid.append(cv, right); bd.append(grid);
  let toks = [], M = [];
  const view = A.canvas(cv, { aspect: 1 }, paint);
  function tokenize(s) { return s.match(/[A-Za-z]+|[0-9]+|\S/g) || []; }
  function compute() {
    toks = tokenize(inp.value).slice(0, 48);
    const n = toks.length;
    M = [];
    for (let i = 0; i < n; i++) {
      const s = new Array(n).fill(-1e9);
      const vis = (j) => !causal || j <= i;
      for (let j = 0; j < n; j++) if (vis(j)) s[j] = 0;
      if (head === 'prev') { if (i > 0) s[i - 1] = 6; else s[0] = 6; }
      if (head === 'induction') {
        let found = false;
        for (let j = 1; j < n; j++) if (vis(j) && j - 1 !== i && toks[j - 1] === toks[i] && j <= i) { s[j] = 6; found = true; }
        if (!causal) for (let j = 1; j < n; j++) if (toks[j - 1] === toks[i] && j - 1 !== i) { s[j] = 6; found = true; }
        if (!found) s[0] = 5;
      }
      if (head === 'copy') { let f = false; for (let j = 0; j < n; j++) if (vis(j) && j !== i && toks[j] === toks[i]) { s[j] = 5; f = true; } if (!f) s[i] = 4; }
      if (head === 'local') { for (let j = 0; j < n; j++) if (vis(j) && Math.abs(i - j) < 4) s[j] = 4; }
      if (head === 'sink') { s[0] = 4; s[i] = Math.max(s[i], 2); }
      M.push(A.softmax(s));
    }
  }
  function paint(ctx, W, H) {
    const n = toks.length; if (!n) return;
    const pad = 28, cell = (Math.min(W, H) - pad - 4) / n;
    const fs = Math.max(8, Math.min(13, cell * 0.8));
    const masked = A.isDark() ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = pad + j * cell, y = pad + i * cell;
      if (causal && j > i) { ctx.fillStyle = masked; ctx.fillRect(x, y, cell - 1, cell - 1); continue; }
      ctx.fillStyle = A.seq(Math.pow(M[i][j], 0.7));
      ctx.fillRect(x, y, cell - 1, cell - 1);
    }
    if (hover >= 0) { ctx.strokeStyle = A.css('--s2'); ctx.lineWidth = 2; ctx.strokeRect(pad - 1, pad + hover * cell - 1, n * cell + 1, cell + 1); }
    for (let i = 0; i < n; i++) {
      A.text(ctx, toks[i], pad - 4, pad + i * cell + cell / 2, { size: fs, align: 'right', color: i === hover ? A.css('--s2') : A.css('--ink-2') });
      ctx.save(); ctx.translate(pad + i * cell + cell / 2, pad - 4); ctx.rotate(-Math.PI / 2);
      A.text(ctx, toks[i], 0, 0, { size: fs, color: A.css('--ink-2') }); ctx.restore();
    }
    A.text(ctx, 'key（被看的位置）→', pad, 8, { size: 11, color: A.css('--muted') });
    view._cell = cell; view._pad = pad;
  }
  function side() {
    const n = toks.length;
    const i = hover >= 0 ? hover : n - 1;
    right.innerHTML = `<div class="small muted" style="line-height:1.6">第 ${i + 1} 个 token「<b style="color:var(--s2)">${toks[i] || ''}</b>」的注意力分布（颜色越深权重越大）</div>`;
    toks.forEach((t, j) => {
      const w = M[i] ? M[i][j] : 0;
      right.append(A.el('span', { class: 'tok', title: (w * 100).toFixed(1) + '%', style: { background: A.alpha(A.css('--s1'), Math.min(1, w * 1.6)), color: w > 0.4 ? '#fff' : 'var(--ink)', outline: j === i ? '2px solid var(--s2)' : 'none' } }, t));
    });
    if (head === 'induction' && i > 0) {
      const top = M[i].indexOf(Math.max(...M[i]));
      if (top > 0) right.append(A.el('div', { class: 'small', style: { lineHeight: '1.6', marginTop: '8px' } }, `→ 归纳头把「${toks[top]}」的信息搬到当前位置，模型据此预测下一个 token 可能就是「${toks[top]}」。`));
    }
  }
  function render() { compute(); desc.textContent = DESC[head]; view.redraw(); side(); }
  cv.addEventListener('pointermove', (e) => {
    const p = A.pos(cv, e); const c = view._cell, pad = view._pad;
    const i = Math.floor((p.y - pad) / c);
    const h = i >= 0 && i < toks.length && p.x > pad ? i : -1;
    if (h !== hover) { hover = h; view.redraw(); side(); }
  });
  cv.addEventListener('pointerleave', () => { hover = -1; view.redraw(); side(); });
  inp.addEventListener('input', render);
  render();
});
