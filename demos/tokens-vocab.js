/* tokens-vocab — the vocabulary-size ledger: (A) a byte-level BPE trained in the browser on a built-in Chinese–English parallel text, token counts vs V and vs the tokenizer's data mix; (B) real model configs: how much shorter sequences must get before a bigger vocabulary pays for itself */
A.defineDemo('tokens-vocab', function (mount) {
  // data-part="a" shows only part A, "b" only part B; no attribute shows both
  const part = (mount.dataset.part || '').toLowerCase(), showA = part !== 'b', showB = part !== 'a';
  const { bd } = A.demo(mount, part === 'a' ? '同一段内容，中文和英文各要多少 token' : part === 'b' ? '换成大词表，序列至少要短多少才不亏' : '词表大小的账：序列短了多少，参数和算力多了多少', part === 'a' ? '浏览器里现场训练的玩具分词器' : part === 'b' ? '真实模型配置的算术' : 'A：浏览器里现场训练的玩具分词器；B：真实模型配置的算术');
  // 28 parallel sentence pairs (same content in Chinese and English)
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
    ["API 也按 token 收费，同样的内容用的 token 越少就越便宜。", "APIs also charge by the token, so the same content is cheaper when it needs fewer tokens."]
  ];
  const ZH = PAIRS.map((p) => p[0]).join(''), EN = PAIRS.map((p) => p[1]).join(' ');
  const nZh = Array.from(ZH).length, nEn = Array.from(EN).length;
  const RE = /[㐀-鿿]+|[ ]?[A-Za-z]+|[0-9]+|\s+|[^\sA-Za-z0-9㐀-鿿]/g;
  const enc = new TextEncoder();
  const toSyms = (w) => Array.from(enc.encode(w)).map((b) => String.fromCharCode(b));
  const cache = {};
  // weighted byte-level BPE; records token counts of the Chinese and English halves after every merge
  function train(w) {
    const key = w.toFixed(2); if (cache[key]) return cache[key];
    const types = new Map();
    const add = (text, lang) => { for (const c of text.match(RE) || []) { let t = types.get(c); if (!t) { t = { z: 0, e: 0 }; types.set(c, t); } t[lang]++; } };
    add(ZH, 'z'); add(EN, 'e');
    const seqs = [...types].map(([c, t]) => ({ s: toSyms(c), z: t.z, e: t.e, wt: w * t.z + (1 - w) * t.e }));
    const count = (lang) => A.sum(seqs.map((q) => q.s.length * q[lang]));
    const zh = [count('z')], en = [count('e')];
    for (let m = 0; m < 2000; m++) {
      const pw = new Map(), po = new Map();
      for (const q of seqs) for (let i = 0; i < q.s.length - 1; i++) { const k = q.s[i] + '\u0001' + q.s[i + 1]; pw.set(k, (pw.get(k) || 0) + q.wt); po.set(k, (po.get(k) || 0) + q.z + q.e); }
      let best = null, bc = 0;
      for (const [k, c] of pw) if (po.get(k) >= 2 && c > bc) { best = k; bc = c; }
      if (!best) break;
      const [a, b] = best.split('\u0001');
      let dz = 0, de = 0;
      for (const q of seqs) {
        if (q.s.length < 2) continue;
        const o = [];
        for (let i = 0; i < q.s.length; i++) { if (i < q.s.length - 1 && q.s[i] === a && q.s[i + 1] === b) { o.push(a + b); i++; } else o.push(q.s[i]); }
        const d = q.s.length - o.length; if (d) { dz += d * q.z; de += d * q.e; q.s = o; }
      }
      zh.push(zh[zh.length - 1] - dz); en.push(en[en.length - 1] - de);
    }
    return (cache[key] = { zh, en });
  }

  // ---------- part A ----------
  if (showA) {
  if (!part) bd.append(A.el('div', { style: { fontWeight: 650, margin: '2px 0 6px' } }, 'A · 同一段内容，中文和英文各要多少 token'));
  const ctlA = A.el('div', { class: 'controls' }); bd.append(ctlA);
  let wZh = 0.2, res = train(wZh);
  const sMix = A.slider(ctlA, { label: '分词器训练语料里中文的比重', min: 0.1, max: 0.9, step: 0.1, value: wZh, fmt: (v) => Math.round(v * 100) + '%', on: A.debounce((v) => { wZh = v; res = train(wZh); sV.input.max = res.zh.length - 1; if (sV.value > res.zh.length - 1) sV.value = res.zh.length - 1; drawA(); }, 120), width: 240 });
  const sV = A.slider(ctlA, { label: '合并次数（词表 = 256 + 合并次数）', min: 0, max: res.zh.length - 1, step: 1, value: 300, fmt: (v) => v.toFixed(0), on: () => drawA(), width: 260 });
  const cvA = A.el('canvas', { class: 'cv' }); bd.append(cvA);
  const stA = A.el('div', { class: 'stats' }); bd.append(stA);
  bd.append(A.el('p', { class: 'hint' }, `内置 ${PAIRS.length} 对中英文句子，意思一一对应：中文 ${nZh} 个字符（${enc.encode(ZH).length} 字节），英文 ${nEn} 个字符。分词器在这段文字上现场训练（字节级 BPE，只合并出现至少两次的对），再数这段文字本身切出多少 token。合并次数为 0 时就是 UTF-8 字节：中文反而更短，因为一个汉字 3 字节、却顶英文三四个字母。把中文比重拉到 10%，中间一段中文的 token 数是英文的近两倍；拉到 90%，反过来。玩具语料很小，绝对数字不能外推，趋势和真实分词器一致。`));
  const viewA = A.canvas(cvA, { get aspect() { return cvA.clientWidth < 600 ? 0.72 : 0.42; } }, (ctx, W, H) => {
    const box = { x: 54, y: 28, w: W - 70, h: H - 62 };
    const M = res.zh.length - 1, k = Math.min(sV.value, M);
    const ymax = Math.ceil(Math.max(res.zh[0], res.en[0]) / 500) * 500;
    const ax = A.axes(ctx, box, { xmin: 256, xmax: 256 + M, ymin: 0, ymax, yfmt: (v) => v.toFixed(0), xfmt: (v) => v.toFixed(0), xlabel: '词表大小 V', ylabel: '整段文字的 token 数', ylabelOffset: 46 });
    const c = A.series();
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = A.alpha(c[0], 0.7); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(nZh)); ctx.lineTo(box.x + box.w, ax.Y(nZh)); ctx.stroke(); ctx.restore();
    A.text(ctx, '中文字符数（1 字 1 token 的水平）', box.x + 6, ax.Y(nZh) - 9, { size: 11, color: c[0] });
    [[res.zh, c[0], '中文'], [res.en, c[1], '英文']].forEach(([arr, col, lab]) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
      arr.forEach((v, i) => (i ? ctx.lineTo(ax.X(256 + i), ax.Y(v)) : ctx.moveTo(ax.X(256), ax.Y(v))));
      ctx.stroke();
      A.text(ctx, lab, ax.X(256 + M) + 3, ax.Y(arr[M]) - 10, { size: 12, color: col, weight: 700, align: 'right' });
    });
    ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax.X(256 + k), box.y); ctx.lineTo(ax.X(256 + k), box.y + box.h); ctx.stroke();
    [[res.zh[k], c[0]], [res.en[k], c[1]]].forEach(([v, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax.X(256 + k), ax.Y(v), 4.5, 0, 7); ctx.fill(); });
  });
  function drawA() {
    const M = res.zh.length - 1, k = Math.min(sV.value, M), z = res.zh[k], e = res.en[k];
    stA.innerHTML = '';
    [['词表大小', String(256 + k)], ['中文 token', z + ' <small>' + (nZh / z).toFixed(2) + ' 字/token</small>'], ['英文 token', e + ' <small>' + (nEn / e).toFixed(2) + ' 字符/token</small>'], ['中文 ÷ 英文', (z / e).toFixed(2) + ' <small>' + (z > e ? '中文更贵' : '中文更省') + '</small>']]
      .forEach(([kk, v]) => stA.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    viewA.redraw();
  }
  drawA();
  }

  // ---------- part B ----------
  if (showB) {
  if (!part) bd.append(A.el('div', { style: { fontWeight: 650, margin: '18px 0 6px' } }, 'B · 真实规模：换成大词表，序列至少要短多少才不亏'));
  const MODELS = [
    { k: '1b', t: 'Llama 3.2 1B', d: 2048, nb: 0.973e9, tied: true },
    { k: '8b', t: 'Llama 3 8B', d: 4096, nb: 6.98e9, tied: false },
    { k: '70b', t: 'Llama 3 70B', d: 8192, nb: 68.45e9, tied: false },
  ];
  const V0 = 32000;
  const ctlB = A.el('div', { class: 'controls' }); bd.append(ctlB);
  let mk = '8b';
  A.seg(ctlB, MODELS.map((m) => ({ v: m.k, t: m.t })), mk, (v) => { mk = v; drawB(); }, '模型（真实配置）');
  const sVB = A.slider(ctlB, { label: '词表大小 V', min: 16000, max: 512000, log: true, step: 0.001, value: 128256, fmt: (v) => Math.round(v / 1000) + 'K', on: () => drawB(), width: 260 });
  const cvB = A.el('canvas', { class: 'cv' }); bd.append(cvB);
  const stB = A.el('div', { class: 'stats' }); bd.append(stB);
  bd.append(A.el('p', { class: 'hint' }, '每个 token 的前向算力约为 2 × (非嵌入参数 + V·d)：查嵌入表几乎不花算力，输出层要和 V 个 token 各做一次点积。从 3.2 万（Llama 2 的词表）换到 V，序列至少要短 1 − (N + 32000·d)/(N + V·d) 才不亏，N 为非嵌入参数。这里没算注意力：它随序列长度增长得更快，序列变短的好处只会更大；也没算训练时 logits 占的显存。'));
  const breakEven = (m, V) => 1 - (m.nb + V0 * m.d) / (m.nb + V * m.d);
  const viewB = A.canvas(cvB, { get aspect() { return cvB.clientWidth < 600 ? 0.72 : 0.42; } }, (ctx, W, H) => {
    const box = { x: 54, y: 28, w: W - 70, h: H - 62 };
    const ax = A.axes(ctx, box, { xlog: true, xmin: 16000, xmax: 512000, ymin: -0.1, ymax: 0.5, xticks: [16000, 32000, 64000, 128000, 256000, 512000], xfmt: (v) => Math.round(v / 1000) + 'K', yticks: [-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5], yfmt: (v) => Math.round(v * 100) + '%', xlabel: '词表大小 V（对数刻度）', ylabel: '序列至少要短多少才不亏', ylabelOffset: 46 });
    const c = A.series();
    ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y - 14, box.w, box.h + 14); ctx.clip();
    MODELS.forEach((m, i) => {
      const on = m.k === mk;
      ctx.strokeStyle = on ? c[i] : A.alpha(c[i], 0.45); ctx.lineWidth = on ? 2.6 : 1.6; ctx.beginPath();
      for (let j = 0; j <= 120; j++) { const V = 16000 * Math.pow(32, j / 120); const y = breakEven(m, V); j ? ctx.lineTo(ax.X(V), ax.Y(y)) : ctx.moveTo(ax.X(V), ax.Y(y)); }
      ctx.stroke();
      A.text(ctx, m.t, ax.X(512000) - 4, ax.Y(breakEven(m, 512000)) - 9, { size: 11.5, color: c[i], weight: on ? 700 : 500, align: 'right' });
    });
    ctx.restore();
    // Llama 2 -> Llama 3 data point
    const px = ax.X(128256), py = ax.Y(0.15);
    ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.fill();
    A.text(ctx, W < 600 ? 'Llama 2→3 最多少 15%' : 'Llama 2 → 3：最多少 15%（据 Meta）', px - 8, py - 12, { size: W < 600 ? 10.5 : 11.5, color: A.css('--ink-2'), align: 'right' });
    const m = MODELS.find((x) => x.k === mk), V = sVB.value, y = breakEven(m, V);
    ctx.strokeStyle = A.css('--ink-2'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(ax.X(V), box.y); ctx.lineTo(ax.X(V), box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c[MODELS.indexOf(m)]; ctx.beginPath(); ctx.arc(ax.X(V), ax.Y(y), 5, 0, 7); ctx.fill();
  });
  function drawB() {
    const m = MODELS.find((x) => x.k === mk), V = sVB.value;
    const pv = (m.tied ? 1 : 2) * V * m.d, total = m.nb + pv, head = V * m.d / (m.nb + V * m.d);
    stB.innerHTML = '';
    [['词表相关参数', A.human(pv, 2) + ' <small>' + (m.tied ? '共享嵌入，1 张表' : '输入、输出 2 张表') + '</small>'], ['占全部参数', A.pct(pv / total, 1)], ['输出层占每 token 算力', A.pct(head, 1)], ['相对 3.2 万词表', (breakEven(m, V) >= 0 ? '至少短 ' : '可以长 ') + A.pct(Math.abs(breakEven(m, V)), 1)]]
      .forEach(([kk, v]) => stB.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    viewB.redraw();
  }
  drawB();
  }
});
