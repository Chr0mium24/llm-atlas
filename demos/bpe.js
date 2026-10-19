/* bpe — interactive demo (moved from ch01-tokens.html) */
A.defineDemo('bpe', function (mount) {
  const { bd } = A.demo(mount, 'BPE 分词器：从字符开始，一步步合并', '可编辑语料和输入');
  const CORPUS = `大模型的训练分为预训练和后训练两个阶段。预训练阶段，模型在海量文本上学习预测下一个词；后训练阶段，模型学习遵循指令、进行推理和使用工具。
大模型的推理需要大量显存，量化可以把模型的权重从十六位压缩到四位甚至更低。混合专家模型只激活一部分专家，所以推理更快。
The model learns to predict the next token. The training of large language models needs a lot of data and a lot of compute.
Language models use attention. The attention mechanism lets every token look at every other token in the context.
扩散模型从噪声开始，一步步去噪，生成图像和视频。视频生成模型需要在时间上保持一致。`;
  const ctl = A.el('div', { class: 'controls' });
  bd.append(A.el('div', { class: 'small muted' }, '训练语料（可修改）'));
  const ta = A.el('textarea', { rows: 6 }); ta.value = CORPUS; bd.append(ta);
  bd.append(ctl);
  let mode = 'char';
  A.seg(ctl, [{ v: 'char', t: '字符级' }, { v: 'byte', t: '字节级（GPT 风格）' }], 'char', (v) => { mode = v; retrain(); }, '基础符号');
  const sl = A.slider(ctl, { label: '合并次数', min: 0, max: 300, step: 1, value: 60, fmt: (v) => v.toFixed(0), on: () => render(), width: 260 });
  bd.append(A.el('div', { class: 'small muted', style: { marginTop: '6px' } }, '待切分的文本（可修改）'));
  const inp = A.el('input', { type: 'text', style: { width: '100%' } });
  inp.value = '大模型的量化可以让推理更快。The attention of language models.';
  bd.append(inp);
  const out = A.el('div', { style: { margin: '10px 0', lineHeight: '2.1' } });
  const stats = A.el('div', { class: 'stats' });
  const mergesBox = A.el('div', { class: 'small', style: { maxHeight: '170px', overflowY: 'auto', fontFamily: 'var(--mono)', background: 'var(--page)', borderRadius: '8px', padding: '8px 10px', border: '1px solid var(--border)' } });
  bd.append(out, stats, A.el('div', { class: 'small muted' }, '学到的合并规则（按顺序；括号里是该对在语料中出现的次数）'), mergesBox);
  bd.append(A.el('p', { class: 'hint' }, '合并次数为 0 时每个字符（或字节）一个 token。往右拖，高频片段（“模型”“训练”“ the”）先被合并。切到字节级，合并次数小的时候一个汉字占 3 个 token。'));

  const RE = /[㐀-鿿]+|[ ]?[A-Za-z]+|[0-9]+|\s+|[^\sA-Za-z0-9㐀-鿿]/g;
  const enc = new TextEncoder();
  const toSyms = (chunk) => mode === 'char' ? Array.from(chunk) : Array.from(enc.encode(chunk)).map((b) => String.fromCharCode(b));
  let merges = [];
  function retrain() {
    const counts = new Map();
    for (const w of ta.value.match(RE) || []) counts.set(w, (counts.get(w) || 0) + 1);
    const seqs = [...counts].map(([w, c]) => ({ s: toSyms(w), c }));
    merges = [];
    for (let m = 0; m < 300; m++) {
      const pairs = new Map();
      for (const q of seqs) for (let i = 0; i < q.s.length - 1; i++) {
        const k = q.s[i] + '\u0001' + q.s[i + 1];
        pairs.set(k, (pairs.get(k) || 0) + q.c);
      }
      let best = null, bc = 1;
      for (const [k, c] of pairs) if (c > bc) { best = k; bc = c; }
      if (!best) break;
      const [a, b] = best.split('\u0001');
      merges.push([a, b, bc]);
      for (const q of seqs) q.s = mergeOnce(q.s, a, b);
    }
    sl.input.max = merges.length;
    render();
  }
  function mergeOnce(s, a, b) {
    const o = [];
    for (let i = 0; i < s.length; i++) {
      if (i < s.length - 1 && s[i] === a && s[i + 1] === b) { o.push(a + b); i++; } else o.push(s[i]);
    }
    return o;
  }
  const dec = new TextDecoder('utf-8', { fatal: true });
  function show(sym) {
    if (mode === 'char') return sym;
    const bytes = Uint8Array.from(sym, (c) => c.charCodeAt(0));
    try { return dec.decode(bytes); } catch (e) { return Array.from(bytes).map((b) => '<' + b.toString(16).toUpperCase() + '>').join(''); }
  }
  function render() {
    const n = Math.min(sl.value, merges.length);
    const ms = merges.slice(0, n);
    const toks = [];
    for (const chunk of inp.value.match(RE) || []) {
      let s = toSyms(chunk);
      for (const [a, b] of ms) if (s.length > 1) s = mergeOnce(s, a, b);
      toks.push(...s);
    }
    out.innerHTML = '';
    const cols = A.series();
    toks.forEach((t, i) => {
      const c = cols[i % 6];
      const label = show(t).replace(/ /g, '·');
      out.append(A.el('span', { class: 'tok', style: { background: A.alpha(c, 0.16), borderColor: A.alpha(c, 0.45) }, title: 'token #' + i }, label));
    });
    const nChar = Array.from(inp.value).length;
    const base = mode === 'char' ? new Set(Array.from(ta.value + inp.value)).size : 256;
    stats.innerHTML = '';
    [['token 数', toks.length], ['字符数', nChar], ['平均每 token 字符', (nChar / toks.length).toFixed(2)], ['词表大小', base + n + (mode === 'char' ? '（基础 ' + base + ' + 合并 ' + n + '）' : '（256 字节 + ' + n + '）')]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, String(v)))));
    mergesBox.innerHTML = ms.length ? ms.map(([a, b, c], i) => `${i + 1}. <b>${esc(show(a))}</b> + <b>${esc(show(b))}</b> → ${esc(show(a + b))} <span style="color:var(--muted)">(${c})</span>`.replace(/ \+ /g, ' + ')).join('<br>') : '<span class="muted">（还没有合并）</span>';
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/ /g, '·');
  ta.addEventListener('input', A.debounce(retrain, 250));
  inp.addEventListener('input', render);
  retrain();
});
