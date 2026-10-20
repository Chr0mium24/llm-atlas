/* attn-step — the chapter's toy (小猫 追 红 球, d = 3, d_h = 2): from embeddings to outputs, frame by frame, all numbers computed */
A.defineDemo('attn-step', function (mount) {
  const { bd } = A.demo(mount, '手算一次注意力：小猫追红球', '4 个词，d = 3，d_h = 2；与正文是同一组数字，全部按公式实时计算');
  const WORDS = { 小猫: [1, 1, 0], 追: [0, 1, 0], 红: [0, 0, 1], 球: [1, 0, 0] };
  const FEAT = ['事物', '会动', '颜色'];
  const WQ = [[0, 2], [1, 0], [2, 0]], WK = [[1, -1], [0, 1], [0, 1]], WV = [[0, 0], [1, 0], [0, 1]];
  const ORDERS = { a: ['小猫', '追', '红', '球'], b: ['红', '球', '追', '小猫'] };
  const dh = 2;
  let order = 'a', qi = 3, k = 0, causal = false;
  const STEPS = [
    { t: '每个词一个向量', tex: String.raw`\mathbf x_i \in \mathbb R^{d},\quad d = 3`, say: `每个词先查表得到一个 3 维向量（${A.cref('tokens')}的嵌入）。这里三个数分别表示“是不是事物”“会不会动”“是不是颜色”，是为了好读而手工设定的；真实模型的维度没有名字。下面三个 3×2 的矩阵就是这个注意力头要学的全部参数。` },
    { t: '乘三个矩阵', tex: String.raw`\mathbf q_i = \mathbf x_i W_Q,\quad \mathbf k_i = \mathbf x_i W_K,\quad \mathbf v_i = \mathbf x_i W_V`, say: '同一个 x 乘三个不同的矩阵，得到三个 2 维向量：query（我在找什么）、key（我能被怎样找到）、value（被选中时交出什么）。x 只含 0 和 1，所以乘法就是“x 的哪几位是 1，就把 W 的哪几行加起来”。' },
    { t: '和每个 key 点积', tex: String.raw`s_{ij} = \mathbf q_i\cdot\mathbf k_j`, say: '当前词的 query 和每个词的 key 做点积：方向越一致，分数越高。' },
    { t: '除以 √d_h', tex: String.raw`s_{ij} \leftarrow s_{ij}/\sqrt{d_h} = s_{ij}/\sqrt 2`, say: '分数除以 √d_h。这里 d_h = 2，只是除以 1.41；大模型的 d_h = 128，要除以 11.3（为什么要除，见正文“为什么要除以 √d_h”一节）。' },
    { t: '因果掩码', tex: String.raw`s_{ij} \leftarrow -\infty\quad (j > i)`, say: '' },
    { t: 'softmax 得到权重', tex: String.raw`a_{ij} = \frac{e^{s_{ij}}}{\sum_{j'} e^{s_{ij'}}}`, say: '取指数变成正数，再除以总和：分数变成加起来等于 1 的权重，即当前词把多少“注意力”分给每个词。' },
    { t: '加权求和 value', tex: String.raw`\mathbf o_i = \sum_j a_{ij}\,\mathbf v_j`, say: '按权重把各词的 value 加起来，就是当前词的输出：它从上下文里收集到的信息。这个头的 value 只有两维：“会动”和“颜色”。' },
    { t: '所有词一起算', tex: String.raw`O = \operatorname{softmax}\!\Big(\frac{QK^\top}{\sqrt{d_h}} + M\Big)V`, say: '每个词做同样的计算，写成矩阵就是两次矩阵乘法，GPU 一次并行算完。每行是一个词的权重，最右一列是它的输出。' },
  ];
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  const qs = A.el('div', { class: 'seg' });
  let qb = [];
  function buildQ() {
    qs.innerHTML = '';
    qb = ORDERS[order].map((t, i) => { const b = A.el('button', { type: 'button', class: i === qi ? 'on' : '', onclick: () => { qi = i; qb.forEach((x, j) => x.classList.toggle('on', j === i)); render(); } }, t); qs.append(b); return b; });
  }
  buildQ();
  const cmi = A.check(bar, '因果掩码', false, (v) => { causal = v; render(); });
  bar.prepend(prev, next, A.el('span', { class: 'small muted', style: { marginLeft: '6px' } }, '计算哪个词：'), qs);
  const ctl2 = A.el('div', { class: 'flex', style: { marginBottom: '6px' } });
  ctl2.append(A.el('span', { class: 'small muted' }, '词序：'));
  A.seg(ctl2, [{ v: 'a', t: '小猫 追 红 球' }, { v: 'b', t: '红 球 追 小猫' }], order, (v) => { const w = ORDERS[order][qi]; order = v; qi = ORDERS[order].indexOf(w); buildQ(); render(); });
  ctl2.append(A.el('span', { class: 'small muted' }, '（换词序看置换等变；第 8 步最明显）'));
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { type: 'button', class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' }), stage = A.el('div', { class: 'tablewrap' });
  bd.append(bar, ctl2, slider, dots, fx, say, stage);
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); slider.value = k; render(); }
  const mul = (x, W) => [0, 1].map((j) => x.reduce((s, xi, i) => s + xi * W[i][j], 0));
  const f2 = (x) => (x === -Infinity ? '−∞' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
  const fi = (x) => (x < 0 ? '−' : '') + Math.abs(x);
  const vec = (v, f = fi) => '(' + v.map(f).join(', ') + ')';
  function model() {
    const T = ORDERS[order], X = T.map((w) => WORDS[w]);
    const Q = X.map((x) => mul(x, WQ)), K = X.map((x) => mul(x, WK)), V = X.map((x) => mul(x, WV));
    const row = (i) => {
      const raw = K.map((kk) => Q[i][0] * kk[0] + Q[i][1] * kk[1]);
      const sc = raw.map((x) => x / Math.sqrt(dh));
      const msk = sc.map((x, j) => (causal && j > i ? -Infinity : x));
      const e = msk.map((x) => (x === -Infinity ? 0 : Math.exp(x)));
      const z = A.sum(e), a = e.map((x) => x / z);
      const o = [0, 1].map((c) => A.sum(a.map((w, j) => w * V[j][c])));
      return { raw, sc, msk, e, z, a, o };
    };
    return { T, X, Q, K, V, row };
  }
  function mat(W, title) {
    return `<table style="width:auto;display:inline-table;margin-right:14px"><tr><th colspan="3">${title}</th></tr>` + W.map((r, i) => `<tr><td class="small muted">${FEAT[i]}</td>${r.map((x) => `<td class="num mono">${fi(x)}</td>`).join('')}</tr>`).join('') + '</table>';
  }
  function render() {
    const s = STEPS[k], m = model(), T = m.T, c = m.row(qi);
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    let txt = s.say, extra = '';
    if (k === 4) txt = causal ? `生成模型不能偷看后面的词：第 ${qi + 1} 个词之后的分数设为 −∞，softmax 之后权重恰好为 0。` : '当前没有勾选“因果掩码”：每个词都能看到整句话，这一步什么也不改。勾上它，再从这一步往后看一遍。';
    if (k === 1) extra = `　例如「${T[qi]}」的 x = ${vec(m.X[qi])}，q = ${vec(m.Q[qi])}。`;
    if (k === 5) { const top = c.a.indexOf(Math.max(...c.a)); extra = `　「${T[qi]}」最大的权重给了「${T[top]}」（${A.pct(c.a[top], 1)}）。`; }
    if (k === 6) extra = `　「${T[qi]}」的输出 o = ${vec(c.o, (x) => x.toFixed(2))}。`;
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${txt}${extra}`;
    if (k === 0) { stage.innerHTML = `<table style="width:auto"><tr><th>词</th>${FEAT.map((f) => `<th class="num">${f}</th>`).join('')}</tr>${T.map((t, i) => `<tr><td><b>${t}</b></td>${m.X[i].map((x) => `<td class="num mono">${x}</td>`).join('')}</tr>`).join('')}</table><div style="margin-top:8px">${mat(WQ, 'W_Q（3×2）')}${mat(WK, 'W_K')}${mat(WV, 'W_V')}</div>`; return; }
    if (k === 1) { stage.innerHTML = `<table style="width:auto"><tr><th>词</th><th>x</th><th>q = xW<sub>Q</sub></th><th>k = xW<sub>K</sub></th><th>v = xW<sub>V</sub></th></tr>${T.map((t, i) => `<tr${i === qi ? ' style="outline:2px solid var(--s2)"' : ''}><td><b>${t}</b></td><td class="mono">${vec(m.X[i])}</td><td class="mono">${vec(m.Q[i])}</td><td class="mono">${vec(m.K[i])}</td><td class="mono">${vec(m.V[i])}</td></tr>`).join('')}</table><p class="small muted" style="margin:6px 0 0">key 的两维可以读作（是事物, 是描述），query 的两维读作（找事物, 找描述），value 的两维是（会动, 颜色）。</p>`; return; }
    if (k === 7) { stage.innerHTML = matrix(m); return; }
    const rows = T.map((t, j) => {
      const cells = [`<td><b>${t}</b>${j === qi ? ' <span class="small" style="color:var(--s2)">← 当前</span>' : ''}</td>`, `<td class="num mono">${vec(m.K[j])}</td>`];
      cells.push(`<td class="num mono">${fi(c.raw[j])}</td>`);
      if (k >= 3) cells.push(`<td class="num mono">${f2(c.sc[j])}</td>`);
      if (k >= 4) cells.push(`<td class="num mono" style="${c.msk[j] === -Infinity ? 'color:var(--muted)' : ''}">${f2(c.msk[j])}</td>`);
      if (k >= 5) cells.push(`<td class="num mono">${c.e[j] ? c.e[j].toFixed(2) : '0'}</td><td><div style="display:flex;gap:6px;align-items:center"><div style="height:12px;width:${Math.round(c.a[j] * 120)}px;background:var(--s1);border-radius:0 4px 4px 0"></div><span class="mono small">${(c.a[j] * 100).toFixed(1)}%</span></div></td>`);
      if (k >= 6) cells.push(`<td class="num mono">${vec(m.V[j])}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    });
    const head = ['词', 'key k<sub>j</sub>', 'q·k'];
    if (k >= 3) head.push('÷√2'); if (k >= 4) head.push('掩码后'); if (k >= 5) head.push('e<sup>s</sup>', '权重 a'); if (k >= 6) head.push('value v<sub>j</sub>');
    stage.innerHTML = `<p class="small" style="margin:4px 0">当前词「<b>${T[qi]}</b>」的 query：<span class="mono">q = ${vec(m.Q[qi])}</span></p><table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table>` +
      (k >= 5 ? `<p class="small">e<sup>s</sup> 的总和 = <span class="mono">${c.z.toFixed(2)}</span>，每项除以它得到权重。` + (k >= 6 ? `输出 <span class="mono">o = Σ a·v = ${vec(c.o, (x) => x.toFixed(3))}</span>。` : '') + '</p>' : '');
  }
  function matrix(m) {
    const T = m.T;
    let h = '<table style="width:auto"><tr><th></th>' + T.map((t) => `<th class="num">${t}</th>`).join('') + '<th class="num">输出 o（会动, 颜色）</th></tr>';
    T.forEach((t, i) => {
      const c = m.row(i);
      h += `<tr><td><b>${t}</b></td>` + c.a.map((w, j) => (causal && j > i ? '<td class="num" style="background:var(--grid);color:var(--muted)">0</td>' : `<td class="num mono" style="background:${A.seq(Math.pow(w, 0.7))};color:${w > 0.45 ? (A.isDark() ? '#0d1b2a' : '#fff') : 'var(--ink)'}">${(w * 100).toFixed(0)}%</td>`)).join('') + `<td class="num mono">${vec(c.o, (x) => x.toFixed(2))}</td></tr>`;
    });
    const note = causal
      ? (order === 'a' ? '加了掩码：“红”看不到后面的“球”，只好把 67% 的权重给了“小猫”；“球”在最后，照样能把“追”和“红”收进来。信息只能从前往后流。' : '加了掩码以后，换了词序，各词的输出就不同了：掩码让每个位置“知道自己前面有几个词”，顺序信息从这里漏了进来。')
      : (order === 'a' ? '行 = 正在计算的词（query），列 = 被看的词（key）。切换成“红 球 追 小猫”：每个词的那一行只是换了位置，数值完全不变。' : '换了词序，每个词的权重和输出与原句完全一样，只是行列跟着换了位置：不加位置信息，“小猫追红球”和“红球追小猫”在注意力看来没有区别。');
    return h + `</table><p class="small muted">${note}</p>`;
  }
  render();
});
