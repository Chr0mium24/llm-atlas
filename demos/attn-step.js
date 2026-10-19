/* attn-step — scaled dot-product attention for one query, frame by frame, with real numbers (d_k = 2) */
A.defineDemo('attn-step', function (mount) {
  const { bd } = A.demo(mount, '一次注意力计算，逐步代入数字', '5 个 token，d_k = 2；所有数字都按公式实际计算');
  const T = ['小猫', '坐在', '垫子', '上', '它'];
  const Kv = [[2.0, 0.3], [0.1, 1.2], [1.2, -0.6], [-0.3, 0.9], [0.4, 0.2]];
  const Qv = [[0.2, 0.5], [1.5, 0.4], [0.3, 1.0], [1.0, -0.8], [1.8, 0.2]];
  const Vv = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0.2, 0.8], [0.3, 0, 0]];
  const VNAME = ['动物', '动作', '位置'];
  const dk = 2;
  let qi = 4, k = 0, causal = true;
  const STEPS = [
    { t: '取出 query', tex: String.raw`\mathbf q_i = \mathbf x_i W_Q`, say: '当前位置的向量乘上矩阵 W_Q，得到它的 query：“我在找什么样的信息”。这里直接给出算好的 q。' },
    { t: '和每个 key 点积', tex: String.raw`s_{ij} = \mathbf q_i\cdot\mathbf k_j`, say: '每个位置都有一个 key（同样是 x 乘 W_K 得来），表示“我能提供什么”。q 和每个 k 做点积，方向越一致分数越高。' },
    { t: '除以 √d', tex: String.raw`s_{ij} \leftarrow s_{ij} / \sqrt{d_k}`, say: '把分数除以 √d_k，防止维度大时分数过大、softmax 饱和（下一节详细讲）。' },
    { t: '因果掩码', tex: String.raw`s_{ij} \leftarrow -\infty \quad (j > i)`, say: '生成模型不能偷看后面的 token：位置 i 之后的分数设为 −∞，softmax 之后权重为 0。' },
    { t: 'softmax 得到权重', tex: String.raw`a_{ij} = \frac{e^{s_{ij}}}{\sum_{j'} e^{s_{ij'}}}`, say: '把分数变成和为 1 的权重：这个位置把多少“注意力”分给每个位置。' },
    { t: '加权求和 value', tex: String.raw`\mathbf o_i = \sum_j a_{ij}\,\mathbf v_j`, say: '每个位置的 value 是它要“交出去”的内容。按权重加权平均，就是这个位置的输出：它从上下文里收集到的信息。' },
    { t: '所有位置一起算', tex: String.raw`O = \operatorname{softmax}\!\Big(\frac{QK^\top}{\sqrt{d_k}} + M\Big)V`, say: '每个位置都做同样的计算，写成矩阵就是一次 n×n 的运算，GPU 可以并行完成。下表每一行是一个位置的权重，灰色是被掩码遮住的部分。' },
  ];
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  const qs = A.el('div', { class: 'seg' });
  const qb = T.map((t, i) => { const b = A.el('button', { class: i === qi ? 'on' : '', onclick: () => { qi = i; qb.forEach((x, j) => x.classList.toggle('on', j === i)); render(); } }, t); qs.append(b); return b; });
  const cm = A.el('label', { class: 'chk' }); const cmi = A.el('input', { type: 'checkbox' }); cmi.checked = true; cmi.onchange = () => { causal = cmi.checked; render(); }; cm.append(cmi, '因果掩码');
  bar.append(prev, next, A.el('span', { class: 'small muted', style: { marginLeft: '6px' } }, '计算哪个位置：'), qs, cm);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' }), stage = A.el('div', { class: 'tablewrap' });
  bd.append(bar, slider, dots, fx, say, stage);
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); slider.value = k; render(); }
  const f2 = (x) => (x === -Infinity ? '−∞' : (x >= 0 ? '' : '−') + Math.abs(x).toFixed(2));
  function compute(i) {
    const raw = Kv.map((kk) => Qv[i][0] * kk[0] + Qv[i][1] * kk[1]);
    const sc = raw.map((x) => x / Math.sqrt(dk));
    const msk = sc.map((x, j) => (causal && j > i ? -Infinity : x));
    const mx = Math.max(...msk.filter((x) => x !== -Infinity));
    const e = msk.map((x) => (x === -Infinity ? 0 : Math.exp(x - mx)));
    const z = A.sum(e);
    const a = e.map((x) => x / z);
    const o = [0, 1, 2].map((c) => A.sum(a.map((w, j) => w * Vv[j][c])));
    return { raw, sc, msk, a, o };
  }
  function render() {
    const s = STEPS[k];
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    const c = compute(qi);
    let extra = '';
    if (k === 5) extra = `　代入：\\(\\mathbf o_{${qi + 1}} = (${c.o.map((x) => x.toFixed(2)).join(',\\ ')})\\)，三个分量分别对应“${VNAME.join('、')}”。` + (qi === 4 ? '“它”的输出主要来自“小猫”：这就是代词找到了指代对象。' : '');
    if (k === 4) extra = `　最大的权重给了“${T[c.a.indexOf(Math.max(...c.a))]}”（${A.pct(Math.max(...c.a), 0)}）。`;
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}${extra}`;
    A.renderMath(say);
    if (k === 6) { stage.innerHTML = matrix(); return; }
    const rows = T.map((t, j) => {
      const cells = [`<td><b>${t}</b>${j === qi ? ' <span class="small" style="color:var(--s2)">← 当前</span>' : ''}</td>`];
      cells.push(`<td class="num mono">(${Kv[j].map(f2).join(', ')})</td>`);
      if (k >= 1) cells.push(`<td class="num mono">${f2(c.raw[j])}</td>`);
      if (k >= 2) cells.push(`<td class="num mono">${f2(c.sc[j])}</td>`);
      if (k >= 3) cells.push(`<td class="num mono" style="${c.msk[j] === -Infinity ? 'color:var(--muted)' : ''}">${f2(c.msk[j])}</td>`);
      if (k >= 4) cells.push(`<td><div style="display:flex;gap:6px;align-items:center"><div style="height:12px;width:${Math.round(c.a[j] * 120)}px;background:var(--s1);border-radius:0 4px 4px 0"></div><span class="mono small">${(c.a[j] * 100).toFixed(1)}%</span></div></td>`);
      if (k >= 5) cells.push(`<td class="num mono">(${Vv[j].map((x) => x.toFixed(1)).join(', ')})</td>`);
      return `<tr>${cells.join('')}</tr>`;
    });
    const head = ['位置', 'key k<sub>j</sub>'];
    if (k >= 1) head.push('q·k'); if (k >= 2) head.push('÷√2'); if (k >= 3) head.push('掩码后'); if (k >= 4) head.push('权重 a'); if (k >= 5) head.push('value v<sub>j</sub>（动物, 动作, 位置）');
    stage.innerHTML = `<p class="small" style="margin:4px 0">当前位置「<b>${T[qi]}</b>」的 query：<span class="mono">q = (${Qv[qi].map(f2).join(', ')})</span></p><table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table>` +
      (k >= 5 ? `<p class="small">输出 <span class="mono">o = Σ a·v = (${c.o.map((x) => x.toFixed(3)).join(', ')})</span></p>` : '');
  }
  function matrix() {
    let h = '<table style="width:auto"><tr><th></th>' + T.map((t) => `<th class="num">${t}</th>`).join('') + '</tr>';
    T.forEach((t, i) => {
      const c = compute(i);
      h += `<tr><td><b>${t}</b></td>` + c.a.map((w, j) => (causal && j > i ? '<td class="num" style="background:var(--grid);color:var(--muted)">0</td>' : `<td class="num mono" style="background:${A.seq(Math.pow(w, 0.7))};color:${w > 0.45 ? '#fff' : 'var(--ink)'}">${(w * 100).toFixed(0)}%</td>`)).join('') + '</tr>';
    });
    return h + '</table><p class="small muted">行 = 正在计算的位置（query），列 = 被看的位置（key）。第一行“小猫”只能看自己，所以权重是 100%。</p>';
  }
  render();
});
