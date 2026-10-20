/* tokens-compare — one sentence, six ways to cut it (word-level, characters, raw UTF-8 bytes, char-BPE, byte-BPE, entropy-based byte patches). All tokenizers are trained in the browser on a small built-in corpus: a simulation, not the output of any real tokenizer */
A.defineDemo('tokens-compare', function (mount) {
  const { bd } = A.demo(mount, '同一句话，六种切法', '在内置小语料上现场训练的模拟，不是任何真实分词器的输出');
  const PAIRS = [
    ["大模型在读一段文字之前，要先把它切成一串 token。", "Before a large model reads a piece of text, it first cuts the text into a sequence of tokens."],
    ["每个 token 有一个编号，编号再换成一个向量。", "Each token has an ID, and each ID is then replaced by a vector."],
    ["词表越大，同一句话切出的 token 越少。", "The larger the vocabulary, the fewer tokens the same sentence needs."],
    ["但是词表越大，嵌入矩阵和输出层的参数也越多。", "But a larger vocabulary also means more parameters in the embedding matrix and the output layer."],
    ["训练分词器的数据决定了哪种语言更省 token。", "The data used to train the tokenizer decides which language needs fewer tokens."],
    ["如果训练数据大多是英文，中文的每个汉字可能要占三个 token。", "If most of the training data is English, each Chinese character may take three tokens."],
    ["模型看不到单词里的字母，所以它常常数错字母。", "The model cannot see the letters inside a word, so it often miscounts the letters."],
    ["数字怎么切，会影响模型做加法和乘法的准确率。", "How numbers are split affects how accurately the model can add and multiply."],
    ["字节级的分词器可以编码任何文本，永远不会遇到不认识的字符。", "A byte-level tokenizer can encode any text and never meets an unknown character."],
    ["意思相近的词，训练之后向量的方向也相近。", "Words with similar meanings end up with vectors pointing in similar directions after training."],
    ["模型预测下一个 token 时，会给词表里的每个 token 打一个分数。", "When the model predicts the next token, it gives a score to every token in the vocabulary."],
    ["这些分数经过 softmax 变成概率，加起来等于一。", "These scores pass through a softmax and become probabilities that add up to one."],
    ["有的研究者认为，将来的模型会直接读取字节，不再需要分词器。", "Some researchers believe that future models will read bytes directly and will no longer need a tokenizer."],
    ["但是字节序列更长，注意力的计算量也会随之增加。", "But byte sequences are longer, and the cost of attention grows with them."],
    ["今天的主流模型仍然使用十万到二十五万个 token 的词表。", "Mainstream models today still use vocabularies of one hundred thousand to two hundred and fifty thousand tokens."],
    ["分词看起来只是预处理，其实决定了模型能看到什么。", "Tokenization looks like simple preprocessing, but it decides what the model is able to see."],
    ["一个汉字在 UTF-8 里占三个字节，一个英文字母只占一个字节。", "In UTF-8 a Chinese character takes three bytes, while an English letter takes only one byte."],
    ["分词器先把文本切成小块，再在每一块里合并常见的字节。", "The tokenizer first splits the text into chunks and then merges common bytes inside each chunk."],
    ["最常出现的一对相邻符号会被合并成一个新的 token。", "The pair of adjacent symbols that appears most often is merged into a new token."],
    ["合并的次数越多，词表就越大，序列就越短。", "The more merges we make, the larger the vocabulary and the shorter the sequence."],
    ["每一次合并节省的 token 数，都不会比上一次更多。", "Each merge saves no more tokens than the merge before it."],
    ["嵌入矩阵的每一行，就是一个 token 的向量。", "Each row of the embedding matrix is the vector of one token."],
    ["训练时没有出现过的 token，它的向量几乎不会被更新。", "A token that never appears during training almost never has its vector updated."],
    ["小模型常常让输入和输出共用同一张嵌入表。", "Small models often let the input and the output share the same embedding table."],
    ["同样的一段话，中文的字数大约只有英文字母数的三分之一。", "For the same passage, Chinese uses only about one third as many characters as English uses letters."],
    ["所以中文是更贵还是更便宜，要看分词器怎样对待汉字。", "So whether Chinese is more expensive or cheaper depends on how the tokenizer treats Chinese characters."],
    ["上下文窗口按 token 计算，token 越多，能放下的内容就越少。", "The context window is counted in tokens, so the more tokens a text needs, the less content fits."],
    ["API 也按 token 收费，同样的内容用的 token 越少就越便宜。", "APIs also charge by the token, so the same content is cheaper when it needs fewer tokens."],
    ["2019 年的 GPT-2 有 50257 个 token，2024 年的 Llama 3 有 128256 个。", "GPT-2 had 50257 tokens in 2019, and Llama 3 had 128256 in 2024."],
  ];
  const TRAIN = PAIRS.map((p) => p[0]).join('\n') + '\n' + PAIRS.map((p) => p[1]).join('\n');
  const enc = new TextEncoder();
  const RE = /[㐀-鿿]+|[ ]?[A-Za-z]+|[0-9]+|\s+|[^\sA-Za-z0-9㐀-鿿]+/g;
  const isDigits = (c) => /^[0-9]+$/.test(c);
  function pretok(text, digit) {
    const out = [];
    for (const c of text.match(RE) || []) {
      if (isDigits(c) && digit !== 'whole') {
        if (digit === 'single') out.push(...c.split(''));
        else if (digit === 'l2r') for (let i = 0; i < c.length; i += 3) out.push(c.slice(i, i + 3));
        else { const r = c.length % 3; if (r) out.push(c.slice(0, r)); for (let i = r; i < c.length; i += 3) out.push(c.slice(i, i + 3)); }
      } else out.push(c);
    }
    return out;
  }
  const charSet = new Set(Array.from(TRAIN));
  const charSyms = (w) => Array.from(w).map((x) => (charSet.has(x) ? x : '\u0000UNK'));
  const byteSyms = (w) => Array.from(enc.encode(w)).map((b) => String.fromCharCode(b));
  function trainBPE(toSyms) {
    const counts = new Map(); for (const c of pretok(TRAIN, 'whole')) counts.set(c, (counts.get(c) || 0) + 1);
    const seqs = [...counts].map(([k, c]) => ({ s: toSyms(k), c })), merges = [];
    for (let m = 0; m < 1500; m++) {
      const pairs = new Map();
      for (const q of seqs) for (let i = 0; i < q.s.length - 1; i++) { const k = q.s[i] + '\u0001' + q.s[i + 1]; pairs.set(k, (pairs.get(k) || 0) + q.c); }
      let best = null, bc = 1; for (const [k, c] of pairs) if (c > bc) { best = k; bc = c; }
      if (!best) break;
      const [a, b] = best.split('\u0001'); merges.push(best);
      for (const q of seqs) { if (q.s.length < 2) continue; const o = []; for (let i = 0; i < q.s.length; i++) { if (i < q.s.length - 1 && q.s[i] === a && q.s[i + 1] === b) { o.push(a + b); i++; } else o.push(q.s[i]); } q.s = o; }
    }
    return merges;
  }
  function applyBPE(chunks, toSyms, merges, K, digitTok) {
    const rank = new Map(merges.slice(0, K).map((k, i) => [k, i])), out = [];
    for (const c of chunks) {
      if (digitTok && isDigits(c) && c.length <= 3) { out.push(digitTok(c)); continue; }
      let s = toSyms(c);
      while (s.length > 1) {
        let bi = -1, br = Infinity;
        for (let i = 0; i < s.length - 1; i++) { const r = rank.get(s[i] + '\u0001' + s[i + 1]); if (r !== undefined && r < br) { br = r; bi = i; } }
        if (bi < 0) break;
        s = s.slice(0, bi).concat([s[bi] + s[bi + 1]], s.slice(bi + 2));
      }
      out.push(...s);
    }
    return out;
  }
  // word-level: English words seen in the corpus; Chinese by longest match against a small dictionary
  const WZ = new Set('大模型 模型 在 读 一段 文字 之前 要 先 把 它 切成 一串 每个 有 一个 编号 再 换成 向量 词表 越大 同 一句话 切出 的 越少 但是 嵌入 矩阵 和 输出层 参数 也 越多 训练 分词器 数据 决定 了 哪种 语言 更 省 如果 大多 是 英文 中文 汉字 可能 占 三个 看不到 单词 里 字母 所以 常常 数错 数字 怎么 切 会 影响 做 加法 乘法 准确率 字节级 可以 编码 任何 文本 永远 不会 遇到 不认识 字符 意思 相近 词 之后 方向 预测 下一个 时 给 打 分数 这些 经过 变成 概率 加起来 等于 一 研究者 认为 将来 直接 读取 字节 不再 需要 序列 更长 注意力 计算量 随之 增加 今天 主流 仍然 使用 十万 到 二十五万 看起来 只是 预处理 其实 能 什么 小块 合并 常见 最常 出现 一对 相邻 符号 新 次数 就 短 节省 数 都 比 上 一次 行 没有 出现过 几乎 被 更新 小模型 让 输入 共用 同一张 表 同样 话 字数 大约 只有 英文字母 三分之一 贵 便宜 看 对待 上下文 窗口 按 计算 放下 内容 少 收费 用 年'.split(' '));
  const WE = new Set((TRAIN.match(/[A-Za-z]+(?:-[0-9]+)?/g) || []).map((w) => w.toLowerCase()));
  function wordLevel(text) {
    const out = [];
    for (const c of text.match(RE) || []) {
      if (/^[㐀-鿿]+$/.test(c)) {
        const s = Array.from(c); let i = 0, unk = '';
        while (i < s.length) {
          let hit = null;
          for (let L = Math.min(5, s.length - i); L >= 1; L--) { const w = s.slice(i, i + L).join(''); if (WZ.has(w)) { hit = w; break; } }
          if (hit) { if (unk) { out.push({ t: '[UNK]', unk }); unk = ''; } out.push({ t: hit }); i += Array.from(hit).length; } else { unk += s[i]; i++; }
        }
        if (unk) out.push({ t: '[UNK]', unk });
      } else if (/^\s+$/.test(c)) continue;
      else if (/[A-Za-z]/.test(c)) out.push(WE.has(c.trim().toLowerCase()) ? { t: c.trim() } : { t: '[UNK]', unk: c.trim() });
      else if (isDigits(c)) out.push(TRAIN.includes(c) ? { t: c } : { t: '[UNK]', unk: c });
      else out.push(charSet.has(c) ? { t: c } : { t: '[UNK]', unk: c });
    }
    return out;
  }
  // entropy model for byte patches: interpolated byte trigram trained on the corpus
  const tb = enc.encode(TRAIN), c1 = new Float64Array(256), c2 = new Map(), c3 = new Map();
  for (let i = 0; i < tb.length; i++) {
    c1[tb[i]]++;
    if (i >= 1) { const k = tb[i - 1]; if (!c2.has(k)) c2.set(k, new Float64Array(256)); c2.get(k)[tb[i]]++; }
    if (i >= 2) { const k = tb[i - 2] * 256 + tb[i - 1]; if (!c3.has(k)) c3.set(k, new Float64Array(256)); c3.get(k)[tb[i]]++; }
  }
  function entropyAt(a, b) {
    const t3 = a >= 0 && b >= 0 ? c3.get(a * 256 + b) : null, t2 = b >= 0 ? c2.get(b) : null;
    const s3 = t3 ? A.sum(t3) : 0, s2 = t2 ? A.sum(t2) : 0;
    const l3 = s3 ? s3 / (s3 + 2) : 0, l2 = s2 ? (1 - l3) * s2 / (s2 + 2) : 0, l1 = (1 - l3 - l2) * 0.95, l0 = 1 - l3 - l2 - l1;
    let h = 0;
    for (let x = 0; x < 256; x++) { const p = (t3 ? l3 * t3[x] / s3 : 0) + (t2 ? l2 * t2[x] / s2 : 0) + l1 * c1[x] / tb.length + l0 / 256; if (p > 0) h -= p * Math.log2(p); }
    return h;
  }
  function patches(text, th) {
    const b = enc.encode(text), out = []; let cur = [];
    for (let i = 0; i < b.length; i++) { const h = entropyAt(i >= 2 ? b[i - 2] : -1, i >= 1 ? b[i - 1] : -1); if (cur.length && h > th) { out.push(cur); cur = []; } cur.push(b[i]); }
    if (cur.length) out.push(cur);
    return out;
  }
  const fatal = new TextDecoder('utf-8', { fatal: true });
  const hex = (b) => b.toString(16).toUpperCase().padStart(2, '0');
  // decode what can be decoded; bytes that belong to a character cut by a token boundary are shown in hex
  function showBytes(arr) {
    try { return { s: fatal.decode(Uint8Array.from(arr)) }; } catch (e) { /* fall through */ }
    let s = '', i = 0;
    while (i < arr.length) {
      const b = arr[i], n = b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 0;
      let ok = n > 0 && i + n <= arr.length;
      for (let j = 1; ok && j < n; j++) if ((arr[i + j] & 0xc0) !== 0x80) ok = false;
      if (ok) { s += fatal.decode(Uint8Array.from(arr.slice(i, i + n))); i += n; } else { s += '‹' + hex(b) + '›'; i++; }
    }
    return { s, raw: true };
  }
  const strBytes = (t) => Array.from(t, (ch) => ch.charCodeAt(0));

  // ---------- UI ----------
  const PRESETS = ['大模型的分词器决定了中文的成本。', 'Unbelievably, strawberry has three r letters.', '12345 + 67890 = 80235', '猫在键盘上睡觉 😀', 'The tokenizer decides what the model can see.'];
  const pre = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const inp = A.el('input', { type: 'text', style: { width: '100%' } }); inp.value = PRESETS[0];
  PRESETS.forEach((p) => pre.append(A.el('button', { onclick: () => { inp.value = p; render(); } }, p.length > 16 ? p.slice(0, 15) + '…' : p)));
  bd.append(pre, inp);
  const ctl = A.el('div', { class: 'controls', style: { marginTop: '10px' } }); bd.append(ctl);
  let digit = 'whole';
  const sK = A.slider(ctl, { label: 'BPE 合并次数（第 4、5 行）', min: 0, max: 600, step: 10, value: 300, fmt: (v) => v.toFixed(0), on: () => render(), width: 230 });
  A.seg(ctl, [{ v: 'whole', t: '整串' }, { v: 'single', t: '单个数字' }, { v: 'l2r', t: '从左每三位' }, { v: 'r2l', t: '从右每三位' }], digit, (v) => { digit = v; render(); }, '数字怎么预分词（第 5 行）');
  const sT = A.slider(ctl, { label: '熵阈值 θ（第 6 行，比特）', min: 0.5, max: 5, step: 0.1, value: 3, fmt: (v) => v.toFixed(1), on: () => render(), width: 220 });
  const rows = A.el('div', { style: { marginTop: '6px' } }); bd.append(rows);
  bd.append(A.el('p', { class: 'hint' }, '所有分词器都只在内置的 29 对中英文句子上训练，所以“没见过”的字和词很多，这正好放大了每一代方法要解决的问题。按词和按字符时，没见过的东西只能变成 [UNK]（红色）；字节级永远不会。第 5 行选了“单个数字”或“每三位”之后，假设 1–3 位的数字串都在词表里（GPT-4 的分词器就有全部 1110 个这样的 token）。第 6 行用一个小的字节三元语法模型估计“下一个字节有多难猜”，熵超过 θ 就开一个新组；一个组里的字节在 BLT 里会先被一个小模型合成一个向量。‹E5› 这样的是被切开的汉字的单个字节：汉字的首字节只有 E4–E9 几种、好猜，第二个字节才决定是哪个字，所以中文的组常常从字的中间开始。'));
  let MC = null, MB = null;
  const cols = A.series();
  function chipRow(label, desc, items) {
    const n = items.length, nu = items.filter((x) => x.unk !== undefined).length;
    const narrow = rows.clientWidth > 0 && rows.clientWidth < 560;
    const row = A.el('div', { style: { display: 'grid', gridTemplateColumns: narrow ? 'minmax(0,1fr) 56px' : '150px minmax(0,1fr) 64px', gap: narrow ? '2px 8px' : '10px', alignItems: 'start', padding: '6px 0', borderBottom: '1px solid var(--grid)' } });
    row.append(A.el('div', { style: narrow ? { gridColumn: '1 / -1' } : null }, A.el('div', { style: { fontWeight: 600, fontSize: '13.5px' } }, label), A.el('div', { class: 'small muted', style: { fontSize: '12px', lineHeight: '1.4' } }, desc)));
    const box = A.el('div', { style: { lineHeight: '2' } });
    items.forEach((x, i) => {
      const c = cols[i % 6];
      const isU = x.unk !== undefined;
      box.append(A.el('span', { class: 'tok', title: isU ? '没见过：' + x.unk : x.raw ? '不完整的 UTF-8 字节' : '', style: isU ? { color: 'var(--bad)', borderColor: 'var(--bad)', background: 'transparent' } : { background: A.alpha(c, 0.15), borderColor: A.alpha(c, 0.45), fontSize: x.raw ? '11.5px' : '14px' } }, x.t.replace(/ /g, '·').replace(/\n/g, '⏎')));
    });
    row.append(box, A.el('div', { style: { textAlign: 'right' } }, A.el('div', { style: { fontWeight: 650, fontSize: '17px' } }, String(n)), A.el('div', { class: 'small muted', style: { fontSize: '12px' } }, nu ? nu + ' 个 [UNK]' : 'token')));
    return row;
  }
  function render() {
    const s = inp.value;
    rows.innerHTML = '';
    if (!s) return;
    const K = sK.value;
    rows.append(chipRow('按词', '词表 = 语料里的词；中文按词典最长匹配', wordLevel(s)));
    rows.append(chipRow('按字符', '词表 = 语料里出现过的 ' + charSet.size + ' 个字符', Array.from(s).filter((x) => x !== ' ').map((x) => (charSet.has(x) ? { t: x } : { t: '[UNK]', unk: x }))));
    rows.append(chipRow('UTF-8 字节', '词表 = 256 个字节', Array.from(enc.encode(s)).map((b) => (b < 128 ? { t: String.fromCharCode(b) } : { t: '‹' + hex(b) + '›', raw: true }))));
    if (!MC) { rows.append(A.el('p', { class: 'small muted' }, '正在训练两个 BPE 分词器……')); return; }
    const k1 = Math.min(K, MC.length), k2 = Math.min(K, MB.length);
    rows.append(chipRow('子词 BPE', '从字符开始，' + k1 + ' 次合并；没见过的字符仍是 [UNK]', applyBPE(pretok(s, 'whole'), charSyms, MC, k1).map((t) => (t.indexOf('\u0000UNK') >= 0 ? { t: '[UNK]', unk: '?' } : { t }))));
    rows.append(chipRow('字节级 BPE', '从 256 个字节开始，' + k2 + ' 次合并', applyBPE(pretok(s, digit), byteSyms, MB, k2, digit === 'whole' ? null : (c) => c).map((t) => { const r = showBytes(strBytes(t)); return { t: r.s, raw: r.raw }; })));
    rows.append(chipRow('字节 + 按熵分组', 'BLT 的思路：难猜的地方开新组（θ = ' + sT.value.toFixed(1) + '）', patches(s, sT.value).map((p) => { const r = showBytes(p); return { t: r.s, raw: r.raw }; })));
  }
  inp.addEventListener('input', A.debounce(render, 120));
  render();
  setTimeout(() => { MC = trainBPE(charSyms); MB = trainBPE(byteSyms); sK.input.max = Math.max(MC.length, MB.length); render(); }, 30);
});
