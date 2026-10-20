/* tokens-zero — the chapter's toy corpus: five phrases, run BPE by hand one merge at a time, then encode a new phrase */
A.defineDemo('tokens-zero', function (mount) {
  const { bd } = A.demo(mount, '玩具语料上的 BPE：数相邻对、合并最多的一对', '五个短语，次数可改；每一帧都是实际计算');
  const PH = [['大模型', 6], ['小模型', 2], ['模型训练', 3], ['训练数据', 4], ['大数据', 1]];
  const NEWS = '小模型训练数据';
  const MAXM = 5;
  const counts = PH.map((p) => p[1]);

  // controls: phrase counts
  const ctl = A.el('div', { class: 'controls' });
  bd.append(A.el('div', { class: 'small muted' }, '语料：每个短语出现几次（改了之后从第 1 帧重新算）'), ctl);
  PH.forEach(([w], i) => {
    const inp = A.el('input', { type: 'number', min: 1, max: 30, value: counts[i], style: { width: '64px' } });
    inp.oninput = () => { const v = Math.round(+inp.value); if (v >= 1 && v <= 30) { counts[i] = v; build(); go(0); } };
    ctl.append(A.el('label', { class: 'ctl', style: { minWidth: '90px' } }, A.el('span', { class: 'lab' }, w), inp));
  });

  // step bar
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  bar.append(prev, next);
  const slider = A.el('input', { type: 'range', min: 0, max: 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const grid = A.el('div', { class: 'cols' });
  const left = A.el('div'), right = A.el('div');
  grid.append(left, right);
  bd.append(bar, slider, dots, fx, say, grid);
  bd.append(A.el('p', { class: 'hint' }, '合并的各帧里，左边是整个语料现在的切法（每个色块是一个 token，“×6”表示这个短语出现 6 次），右边是所有相邻对的出现次数，最上面那一对下一步会被合并。试着把“小模型”改成 12 次，看合并顺序和最后的切法怎么变。'));

  const cols = A.series();
  let frames = [], k = 0, dotEls = [];
  function mergeSeq(s, a, b) { const o = []; for (let i = 0; i < s.length; i++) { if (i < s.length - 1 && s[i] === a && s[i + 1] === b) { o.push(a + b); i++; } else o.push(s[i]); } return o; }
  function pairCounts(seqs) {
    const m = new Map();
    seqs.forEach((q) => { for (let i = 0; i < q.s.length - 1; i++) { const key = q.s[i] + '\u0001' + q.s[i + 1]; m.set(key, (m.get(key) || 0) + q.c); } });
    return [...m].map(([key, c]) => ({ a: key.split('\u0001')[0], b: key.split('\u0001')[1], c })).sort((x, y) => y.c - x.c);
  }
  function build() {
    let seqs = PH.map(([w], i) => ({ s: Array.from(w), c: counts[i] }));
    const total = (ss) => A.sum(ss.map((q) => q.s.length * q.c));
    const vocab = []; seqs.forEach((q) => q.s.forEach((ch) => { if (!vocab.includes(ch)) vocab.push(ch); }));
    frames = [{ kind: 'init', seqs: seqs.map((q) => ({ s: q.s.slice(), c: q.c })), pairs: pairCounts(seqs), N: total(seqs), V: vocab.length }];
    const merges = [];
    for (let m = 0; m < MAXM; m++) {
      const pc = pairCounts(seqs);
      if (!pc.length || pc[0].c < 2) break;
      const { a, b, c } = pc[0];
      const N0 = total(seqs);
      seqs = seqs.map((q) => ({ s: mergeSeq(q.s, a, b), c: q.c }));
      merges.push([a, b]);
      vocab.push(a + b);
      frames.push({ kind: 'merge', a, b, c, tie: pc.length > 1 && pc[1].c === c, N0, seqs: seqs.map((q) => ({ s: q.s.slice(), c: q.c })), pairs: pairCounts(seqs), N: total(seqs), V: vocab.length, m: m + 1 });
    }
    // encode a new phrase by applying merges in learned order
    let s = Array.from(NEWS); const trace = [s.slice()];
    merges.forEach(([a, b]) => { s = mergeSeq(s, a, b); trace.push(s.slice()); });
    frames.push({ kind: 'encode', merges, trace, vocab: vocab.slice(), out: s });
    slider.max = frames.length - 1;
    dots.innerHTML = '';
    dotEls = frames.map((f, i) => {
      const t = f.kind === 'init' ? '一字一个' : f.kind === 'merge' ? '合并 ' + f.m : '切新句子';
      const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + t); dots.append(d); return d;
    });
  }
  const chip = (t, i, strong) => A.el('span', { class: 'tok', style: { background: A.alpha(cols[i % 6], strong ? 0.32 : 0.14), borderColor: A.alpha(cols[i % 6], strong ? 0.8 : 0.4), fontWeight: strong ? 700 : 400 } }, t);
  function corpusView(f, hl) {
    const box = A.el('div');
    box.append(A.el('div', { class: 'small muted', style: { marginBottom: '4px' } }, `整个语料现在是 ${f.N} 个 token，词表 V = ${f.V}`));
    f.seqs.forEach((q) => {
      const row = A.el('div', { style: { margin: '3px 0' } });
      q.s.forEach((t, i) => row.append(chip(t, i, hl && t === hl)));
      row.append(A.el('span', { class: 'small muted', style: { marginLeft: '6px' } }, '×' + q.c + ' = ' + q.s.length * q.c + ' 个'));
      box.append(row);
    });
    return box;
  }
  function pairView(f) {
    const box = A.el('div');
    box.append(A.el('div', { class: 'small muted', style: { marginBottom: '4px' } }, f.pairs.length ? '相邻对的出现次数（按次数排序）' : '没有相邻对了'));
    const mx = f.pairs.length ? f.pairs[0].c : 1;
    f.pairs.slice(0, 8).forEach((p, i) => {
      const row = A.el('div', { style: { display: 'grid', gridTemplateColumns: '92px 1fr 30px', gap: '8px', alignItems: 'center', margin: '3px 0' } },
        A.el('span', { class: 'mono small', style: { fontWeight: i === 0 ? 700 : 400 } }, p.a + ' · ' + p.b),
        A.el('div', { style: { height: '12px', background: 'var(--grid)', borderRadius: '0 4px 4px 0' } }, A.el('div', { style: { height: '100%', width: (p.c / mx * 100) + '%', background: i === 0 ? 'var(--s1)' : 'var(--axis)', borderRadius: '0 4px 4px 0' } })),
        A.el('span', { class: 'mono small', style: { textAlign: 'right' } }, String(p.c)));
      box.append(row);
    });
    return box;
  }
  function tex(s) { if (window.katex) katex.render(s, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s; }
  function go(i) { k = A.clamp(i, 0, frames.length - 1); slider.value = k; render(); }
  function render() {
    const f = frames[k];
    prev.disabled = k === 0; next.disabled = k === frames.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    left.innerHTML = ''; right.innerHTML = '';
    if (f.kind === 'init') {
      tex(String.raw`N = \sum_{\text{短语}} \text{字数}\times\text{次数} = ${f.N},\qquad V = ${f.V}`);
      const p = f.pairs[0];
      say.innerHTML = `<b>第 1 步 · 一个字一个 token。</b>出发点是最笨的切法：每个字单独是一个 token。语料里出现过 ${f.V} 种字，这就是初始词表。右边数出每一对相邻的字一共出现几次：“${p.a} ${p.b}”出现 ${p.c} 次，最多，下一步合并它。`;
      left.append(corpusView(f)); right.append(pairView(f));
    } else if (f.kind === 'merge') {
      tex(String.raw`N' = N - \operatorname{count}(\text{${f.a}},\text{${f.b}}) = ${f.N0} - ${f.c} = ${f.N}`);
      const nx = f.pairs[0];
      say.innerHTML = `<b>第 ${k + 1} 步 · 第 ${f.m} 次合并：${f.a} + ${f.b} → ${f.a + f.b}。</b>这一对出现 ${f.c} 次，每次出现都把两个 token 变成一个，所以总数正好少 ${f.c} 个；词表多了一个新 token，V = ${f.V}。${f.tie ? '（有两对次数相同，这里取先数到的那一对；真实实现也要定一个这样的规则。）' : ''}` +
        (nx && nx.c >= 2 ? `重新数一遍：新 token 只会和它左右的邻居组成新的对，其余的对次数不变或变少。现在最多的是“${nx.a} ${nx.b}”，${nx.c} 次，不会超过 ${f.c}。` : '已经没有出现两次以上的相邻对，合并到此为止。');
      left.append(corpusView(f, f.a + f.b)); right.append(pairView(f));
    } else {
      const ids = f.out.map((t) => f.vocab.indexOf(t) + 1);
      tex(String.raw`\text{${NEWS}} \;\to\; [\,${ids.join(',\\ ')}\,]`);
      say.innerHTML = `<b>第 ${k + 1} 步 · 切一句没见过的话。</b>“${NEWS}”整句从没在语料里出现过。编码时不再数次数，而是把学到的 ${f.merges.length} 条合并规则<b>按学到的顺序</b>依次套用，最后得到 ${f.out.length} 个 token，再查词表换成编号（这里从 1 开始编号）。`;
      const tr = A.el('div');
      tr.append(A.el('div', { class: 'small muted', style: { marginBottom: '4px' } }, '依次套用每条规则'));
      f.trace.forEach((s, i) => {
        const row = A.el('div', { style: { margin: '3px 0' } });
        row.append(A.el('span', { class: 'small muted', style: { display: 'inline-block', width: '124px', whiteSpace: 'nowrap' } }, i === 0 ? '开始' : '规则 ' + i + '：' + f.merges[i - 1].join(' + ')));
        s.forEach((t, j) => row.append(chip(t, j, i > 0 && t === f.merges[i - 1].join(''))));
        tr.append(row);
      });
      left.append(tr);
      const vb = A.el('div');
      vb.append(A.el('div', { class: 'small muted', style: { marginBottom: '4px' } }, `词表（V = ${f.vocab.length}），编号从 1 开始`));
      const tbl = A.el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '4px' } });
      f.vocab.forEach((t, i) => tbl.append(A.el('div', { class: 'small', style: { border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 6px', background: f.out.includes(t) ? A.alpha(cols[0], 0.14) : 'var(--page)', fontWeight: f.out.includes(t) ? 700 : 400 } }, (i + 1) + '　' + t)));
      vb.append(tbl);
      right.append(vb);
    }
  }
  build();
  go(0);
});
