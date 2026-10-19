/* minhash-lsh — near-duplicate detection: shingles → Jaccard → MinHash estimate → LSH banding S-curve */
A.defineDemo('minhash-lsh', function (mount) {
  const { bd } = A.demo(mount, '近似去重：MinHash 与 LSH 分桶', '两段文本的相似度怎样被估计出来，又怎样在数十亿文档里快速找到相似的一对');
  const PRE = {
    news: ['据新华社报道，今年第三季度全国规模以上工业增加值同比增长5.2%，增速比上季度加快0.3个百分点，其中高技术制造业增长明显。', '据新华社消息，今年第三季度全国规模以上工业增加值同比增长5.2%，增速比上季度加快0.3个百分点，其中高技术制造业增长较快。'],
    tmpl: ['本店主营各类二手手机，价格实惠，质量保证，欢迎来电咨询，地址：上海市徐汇区漕溪北路100号。', '本店主营各类二手电脑，价格实惠，质量保证，欢迎来电咨询，地址：北京市海淀区中关村大街27号。'],
    diff: ['注意力让每个位置都能从其它位置收集信息，但它本身不知道顺序，需要额外的位置编码。', '今天下午的比赛因为下雨推迟到明天上午九点，请各位选手提前半小时到场签到。'],
  };
  let key = 'news';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'news', t: '转载改写的新闻' }, { v: 'tmpl', t: '模板网页' }, { v: 'diff', t: '无关文本' }], key, (v) => { key = v; ta.value = PRE[v][0]; tb.value = PRE[v][1]; draw(); }, '例子');
  const ta = A.el('textarea', { rows: 2, style: { width: '100%', fontSize: '14px' } }), tb = A.el('textarea', { rows: 2, style: { width: '100%', fontSize: '14px' } });
  ta.value = PRE[key][0]; tb.value = PRE[key][1]; ta.oninput = tb.oninput = () => draw();
  bd.append(A.el('div', { class: 'small muted' }, '文档 A（可编辑）'), ta, A.el('div', { class: 'small muted', style: { marginTop: '6px' } }, '文档 B（可编辑）'), tb);
  const ctl2 = A.el('div', { class: 'controls', style: { marginTop: '8px' } }); bd.append(ctl2);
  const SH = A.slider(ctl2, { label: 'shingle 长度（连续几个字）', min: 2, max: 8, step: 1, value: 4, fmt: (v) => v + ' 字', on: () => draw(), width: 190 });
  const BS = A.slider(ctl2, { label: '分桶数 b', min: 1, max: 40, step: 1, value: 14, fmt: (v) => v, on: () => draw(), width: 150 });
  const RS = A.slider(ctl2, { label: '每桶行数 r', min: 1, max: 20, step: 1, value: 8, fmt: (v) => v, on: () => draw(), width: 150 });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const fnv = (s, seed) => { let h = (2166136261 ^ seed) >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; return h >>> 0; };
  const shingles = (t, n) => { const s = new Set(); const c = t.replace(/\s+/g, ''); for (let i = 0; i + n <= c.length; i++) s.add(c.slice(i, i + n)); return s; };
  let cur = { J: 0, est: 0 };
  function compute() {
    const n = SH.value, A1 = shingles(ta.value, n), B1 = shingles(tb.value, n);
    let inter = 0; A1.forEach((x) => { if (B1.has(x)) inter++; });
    const uni = A1.size + B1.size - inter, J = uni ? inter / uni : 0;
    const k = BS.value * RS.value;
    const sig = (S) => Array.from({ length: k }, (_, i) => { let m = 4294967296; S.forEach((x) => { const h = fnv(x, i * 2654435761 >>> 0); if (h < m) m = h; }); return m; });
    const sa = sig(A1), sb = sig(B1);
    let eq = 0; for (let i = 0; i < k; i++) if (sa[i] === sb[i]) eq++;
    let hit = 0; for (let b = 0; b < BS.value; b++) { let ok = true; for (let r = 0; r < RS.value; r++) if (sa[b * RS.value + r] !== sb[b * RS.value + r]) { ok = false; break; } if (ok) hit++; }
    return { A: A1.size, B: B1.size, inter, J, est: k ? eq / k : 0, k, hit };
  }
  const P = (s) => 1 - Math.pow(1 - Math.pow(s, RS.value), BS.value);
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 54, y: 18, w: W - 72, h: H - 58 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1, ymin: 0, ymax: 1, xfmt: (v) => v.toFixed(1), yfmt: (v) => v.toFixed(1), xlabel: '两篇文档的真实 Jaccard 相似度 s', ylabel: '被分进同一个桶（成为候选）的概率', ylabelOffset: 44 });
    const thr = Math.pow(1 / BS.value, 1 / RS.value);
    ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(ax.X(thr), box.y); ctx.lineTo(ax.X(thr), box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
    A.text(ctx, '阈值 ≈ (1/b)^(1/r) = ' + thr.toFixed(2), ax.X(thr) + 6, box.y + 10, { size: 12, color: A.css('--muted') });
    const cols = A.series();
    ctx.strokeStyle = cols[0]; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const s = i / 200; i ? ctx.lineTo(ax.X(s), ax.Y(P(s))) : ctx.moveTo(ax.X(s), ax.Y(P(s))); }
    ctx.stroke();
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(cur.J), ax.Y(P(cur.J)), 6, 0, 7); ctx.fill();
    A.text(ctx, '这一对：s = ' + cur.J.toFixed(2) + '，P = ' + A.pct(P(cur.J), 1), ax.X(cur.J) + (cur.J > 0.6 ? -10 : 10), ax.Y(P(cur.J)) + (P(cur.J) > 0.5 ? 16 : -14), { size: 12, color: cols[1], weight: 700, align: cur.J > 0.6 ? 'right' : 'left' });
  });
  function draw() {
    cur = compute();
    stats.innerHTML = '';
    [['shingle 数 A / B / 共有', `${cur.A} / ${cur.B} / ${cur.inter}`], ['真实 Jaccard', cur.J.toFixed(3)], [`MinHash 估计（${cur.k} 个哈希）`, cur.est.toFixed(3)], ['命中的桶', `${cur.hit} / ${BS.value}` + (cur.hit ? '　→ 候选' : '')]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = `每篇文档切成长度为 ${SH.value} 的 shingle 集合，两篇的 Jaccard 相似度是“交集 / 并集”。直接两两比较数十亿篇文档不可能，于是给每篇算 b × r = ${cur.k} 个 MinHash 值作为“签名”：每个哈希值相等的概率正好等于 Jaccard。再把签名切成 ${BS.value} 段、每段 ${RS.value} 个，任意一段完全相同就进同一个桶、成为候选对。曲线是 1 − (1 − s<sup>r</sup>)<sup>b</sup>：相似度高于阈值的几乎必被抓到，低于阈值的几乎不会被误抓。调 b 和 r 可以移动阈值、改变曲线的陡峭程度。`;
    view.redraw();
  }
  draw();
});
