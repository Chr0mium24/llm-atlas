/* generation-compress — "prediction is compression": encode a line of text with a character n-gram model trained on 27 Tang poems; each character costs −log2 p bits (arithmetic coding gets within ~2 bits of the total) */
A.defineDemo('generation-compress', function (mount) {
  const { bd } = A.demo(mount, '预测即压缩：给一句诗编码要多少比特', '字级 n-gram，语料是 27 首五言唐诗（与上面的写诗演示相同）；所有概率都按公式实际计算');
  const POEMS = `床前明月光，疑是地上霜。举头望明月，低头思故乡。
春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。
白日依山尽，黄河入海流。欲穷千里目，更上一层楼。
红豆生南国，春来发几枝。愿君多采撷，此物最相思。
空山不见人，但闻人语响。返景入深林，复照青苔上。
千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。
锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。
松下问童子，言师采药去。只在此山中，云深不知处。
向晚意不适，驱车登古原。夕阳无限好，只是近黄昏。
功盖三分国，名成八阵图。江流石不转，遗恨失吞吴。
独坐幽篁里，弹琴复长啸。深林人不知，明月来相照。
众鸟高飞尽，孤云独去闲。相看两不厌，只有敬亭山。
君自故乡来，应知故乡事。来日绮窗前，寒梅著花未。
绿蚁新醅酒，红泥小火炉。晚来天欲雪，能饮一杯无。
国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。
空山新雨后，天气晚来秋。明月松间照，清泉石上流。竹喧归浣女，莲动下渔舟。随意春芳歇，王孙自可留。
好雨知时节，当春乃发生。随风潜入夜，润物细无声。野径云俱黑，江船火独明。晓看红湿处，花重锦官城。
离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。
青山横北郭，白水绕东城。此地一为别，孤蓬万里征。浮云游子意，落日故人情。挥手自兹去，萧萧班马鸣。
岱宗夫如何，齐鲁青未了。造化钟神秀，阴阳割昏晓。荡胸生曾云，决眦入归鸟。会当凌绝顶，一览众山小。
单车欲问边，属国过居延。征蓬出汉塞，归雁入胡天。大漠孤烟直，长河落日圆。萧关逢候骑，都护在燕然。
城阙辅三秦，风烟望五津。与君离别意，同是宦游人。海内存知己，天涯若比邻。无为在歧路，儿女共沾巾。
故人具鸡黍，邀我至田家。绿树村边合，青山郭外斜。开轩面场圃，把酒话桑麻。待到重阳日，还来就菊花。
细草微风岸，危樯独夜舟。星垂平野阔，月涌大江流。名岂文章著，官应老病休。飘飘何所似，天地一沙鸥。
花间一壶酒，独酌无相亲。举杯邀明月，对影成三人。
移舟泊烟渚，日暮客愁新。野旷天低树，江清月近人。
客路青山外，行舟绿水前。潮平两岸阔，风正一帆悬。海日生残夜，江春入旧年。乡书何处达，归雁洛阳边。`;
  const corpus = '|' + POEMS.split('\n').join('|') + '|';
  const K = new Set(corpus).size + 1; // distinct characters + one "unseen" slot
  // counts[k]: context of length k -> {tot, m: Map(char -> count)}
  const counts = [];
  for (let k = 0; k <= 3; k++) {
    const m = new Map();
    for (let i = k; i < corpus.length; i++) {
      const c = corpus.slice(i - k, i), ch = corpus[i];
      if (!m.has(c)) m.set(c, { tot: 0, m: new Map() });
      const e = m.get(c); e.tot++; e.m.set(ch, (e.m.get(ch) || 0) + 1);
    }
    counts.push(m);
  }
  // interpolated estimate: start from add-one unigram, then for each longer context that was seen, p_k = (count + p_{k-1}) / (total + 1)
  function prob(ctx, ch, order) {
    if (order < 0) return { p: 1 / K, used: -1 };
    const u = counts[0].get('');
    let p = ((u.m.get(ch) || 0) + 1) / (u.tot + K), used = 0;
    for (let k = 1; k <= order; k++) {
      if (ctx.length < k) break;
      const e = counts[k].get(ctx.slice(ctx.length - k));
      if (!e) break;
      p = ((e.m.get(ch) || 0) + p) / (e.tot + 1); used = k;
    }
    return { p, used };
  }
  const PRESET = { seen: '床前明月光，疑是地上霜。', fresh: '春风又绿江南岸，明月何时照我还。' };
  let which = 'seen', order = 2;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const inp = A.el('input', { type: 'text', value: PRESET.seen, style: { width: '260px', fontSize: '15px' } });
  const seg = A.seg(ctl, [{ v: 'seen', t: '语料里有的一句' }, { v: 'fresh', t: '语料里没有的一句' }], which, (v) => { which = v; inp.value = PRESET[v]; draw(); }, '要编码的文字');
  ctl.append(A.el('label', { class: 'ctl', style: { minWidth: '260px' } }, A.el('span', { class: 'lab' }, '也可以自己改'), inp));
  A.seg(ctl, [{ v: -1, t: '均匀猜' }, { v: 0, t: '只看字频' }, { v: 1, t: '看前 1 字' }, { v: 2, t: '看前 2 字' }, { v: 3, t: '看前 3 字' }], order, (v) => { order = v; draw(); }, '模型');
  inp.addEventListener('input', A.debounce(() => { seg.set(inp.value === PRESET.seen ? 'seen' : inp.value === PRESET.fresh ? 'fresh' : null); draw(); }, 150));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--s1)"></i>用满了设定的上下文</span><span><i style="background:var(--s4)"></i>这段上下文语料里没出现过，退回更短的</span><span><i class="line" style="background:var(--muted)"></i>均匀猜每字的比特数（log₂ ' + K + '）</span>' }));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  let rows = [];
  const view = A.canvas(cv, { height: 280 }, (ctx, W, H) => {
    const n = rows.length; if (!n) return;
    const box = { x: 44, y: 36, w: W - 56, h: H - 74 };
    const ymax = 16;
    const ax = A.axes(ctx, box, { xmin: 0, xmax: n, ymin: 0, ymax, xticks: [], yticks: [0, 4, 8, 12, 16], yfmt: (v) => v, ylabel: '这个字花的比特数 −log₂ p', ylabelOffset: 36 });
    const cols = A.series(), bw = Math.min(30, (box.w / n) * 0.7);
    rows.forEach((r, i) => {
      const x = ax.X(i + 0.5), y = ax.Y(Math.min(r.b, ymax));
      A.bar(ctx, x - bw / 2, y, bw, box.y + box.h - y, r.full ? cols[0] : cols[3], 3);
      if (r.b >= 0.05) A.text(ctx, r.b < 10 ? r.b.toFixed(1) : r.b.toFixed(0), x, y - 8, { size: 10.5, align: 'center', color: A.css('--ink-2'), mono: true });
      A.text(ctx, r.ch, x, box.y + box.h + 14, { size: 14, align: 'center' });
    });
    const yu = ax.Y(Math.log2(K));
    ctx.save(); ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(box.x, yu); ctx.lineTo(box.x + box.w, yu); ctx.stroke(); ctx.restore();
    view.hit = (mx) => { const i = Math.floor(ax.invX(mx)); return i >= 0 && i < n ? i : -1; };
  });
  cv.addEventListener('mousemove', (e) => {
    const p = A.pos(cv, e), i = view.hit ? view.hit(p.x) : -1;
    if (i < 0) { A.tip.hide(); return; }
    const r = rows[i];
    const ctxTxt = r.used > 0 ? '“' + r.ctx.replace(/\|/g, '⏎') + '”' : r.used === 0 ? '（不看上下文）' : '（均匀）';
    A.tip.show(`<b>${r.ch}</b>　上下文 ${ctxTxt}<br>p = ${r.p < 0.001 ? A.sci(r.p) : r.p.toFixed(3)}，−log₂ p = <b>${r.b.toFixed(2)}</b> 比特`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    const s = Array.from(inp.value.replace(/\s/g, ''));
    let ctxS = '|';
    rows = s.map((ch) => {
      const { p, used } = prob(ctxS, ch, order);
      const r = { ch, p, b: -Math.log2(p), used, full: used >= Math.min(order, ctxS.length), ctx: used > 0 ? ctxS.slice(ctxS.length - used) : '' };
      ctxS += ch; return r;
    });
    const tot = A.sum(rows.map((r) => r.b)), n = rows.length || 1;
    const bytes = A.sum(s.map((ch) => new TextEncoder().encode(ch).length)) || 1;
    stats.innerHTML = '';
    [['总码长', tot.toFixed(1) + ' 比特'], ['平均每字', (tot / n).toFixed(2) + ' 比特'], ['UTF-8 原文', bytes * 8 + ' 比特'], ['压缩到原文的', A.pct(tot / (bytes * 8), 1)], ['每字困惑度 2^(比特/字)', Math.pow(2, tot / n) < 1000 ? Math.pow(2, tot / n).toFixed(1) : A.sci(Math.pow(2, tot / n))]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    const inCorpus = corpus.includes(s.join(''));
    let msg;
    if (order < 0) msg = `什么都不学，每个字都在 ${K} 个候选里均匀猜，每字 log₂ ${K} ≈ ${Math.log2(K).toFixed(2)} 比特。这已经比 UTF-8 的 24 比特 / 字短得多，因为字表只有 ${K - 1} 个字。`;
    else if (order === 0) msg = '只看字频：常见的字（标点、“山”“人”“不”）便宜，罕见的字贵。平均下来比均匀猜省一点。';
    else if (inCorpus) msg = '这句在语料里出现过：看前几个字时，下一个字几乎是确定的，绝大多数字只花零点几比特，整句被压到原文的百分之几。这是“背下来”的压缩，不是理解。';
    else msg = '这句语料里没有。前 1–3 个字的组合大多从没见过（橙色柱子：只能退回更短的上下文），见过的又常常接错字。上下文加长，码长不降反升：n-gram 只会记，不会把“春风”“明月”的用法推广到新句子里。真正的语言模型赢在这里。';
    hint.textContent = msg;
    view.redraw();
  }
  draw();
});
