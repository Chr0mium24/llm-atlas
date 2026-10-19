/* ngram-poet — interactive demo (moved from ch04-generation.html) */
A.defineDemo('ngram-poet', function (mount) {
  const { bd } = A.demo(mount, '字级 n-gram 写唐诗', '语料：27 首五言唐诗');
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
  const text = POEMS.replace(/\n/g, '|');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const N = A.slider(ctl, { label: 'n（看前 n−1 个字）', min: 1, max: 5, step: 1, value: 3, fmt: (v) => 'n = ' + v + '（上下文 ' + (v - 1) + ' 字）', on: () => gen(), width: 230 });
  const T = A.slider(ctl, { label: '温度', min: 0.2, max: 2, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), on: () => gen() });
  const pre = A.el('input', { type: 'text', value: '明月', style: { width: '90px' } });
  ctl.append(A.el('label', { class: 'ctl', style: { minWidth: '90px' } }, A.el('span', { class: 'lab' }, '开头'), pre));
  ctl.append(A.el('button', { class: 'primary', onclick: () => gen(true) }, '再写一首'));
  const out = A.el('div', { style: { fontSize: '22px', letterSpacing: '0.12em', lineHeight: '1.9', margin: '10px 0', fontFamily: '"Songti SC", "STSong", serif' } });
  const info = A.el('div', { class: 'small' });
  bd.append(out, info, A.el('div', { class: 'legend' }, A.el('span', { html: '<i style="background:var(--s1)"></i>用满 n−1 字上下文' }), A.el('span', { html: '<i style="background:var(--s4)"></i>上下文没见过，退回更短' }), A.el('span', { html: '<u style="text-decoration-color:var(--s8);text-decoration-thickness:2px">下划线</u> = 与原诗逐字相同的 ≥6 字片段' })));
  // counts[k] : Map(context(len k) -> Map(char->count))
  const counts = [];
  for (let k = 0; k < 5; k++) {
    const m = new Map();
    for (let i = k; i < text.length; i++) {
      const c = text.slice(i - k, i), ch = text[i];
      if (!m.has(c)) m.set(c, new Map());
      const mm = m.get(c); mm.set(ch, (mm.get(ch) || 0) + 1);
    }
    counts.push(m);
  }
  let seed = 1;
  function gen(newSeed) {
    if (newSeed) seed++;
    const r = A.rng(seed * 7919);
    const n = N.value;
    let s = '|' + pre.value.replace(/\s/g, '');
    const lvls = Array.from(pre.value.replace(/\s/g, '')).map(() => -1);
    let lines = 0;
    for (let step = 0; step < 60 && lines < 4; step++) {
      const want = Math.min(n - 1, s.length);
      let k = want, ent = null;
      for (; k >= 0; k--) {
        const d = counts[k].get(s.slice(s.length - k));
        if (d) { const e = [...d].filter(([c]) => c !== '|'); if (e.length) { ent = e; break; } }
      }
      const w = ent.map(([, c]) => Math.pow(c, 1 / T.value));
      let u = r() * A.sum(w), i = 0;
      for (; i < w.length - 1; i++) { u -= w[i]; if (u <= 0) break; }
      const ch = ent[i][0];
      s += ch; lvls.push(k === want ? 1 : 0);
      if (ch === '。') lines++;
    }
    const body = s.slice(1);
    // copy detection: mark chars inside any >=6 window found verbatim in corpus
    const copied = new Array(body.length).fill(false);
    for (let i = 0; i + 6 <= body.length; i++) if (text.includes(body.slice(i, i + 6))) for (let j = i; j < i + 6; j++) copied[j] = true;
    out.innerHTML = '';
    Array.from(body).forEach((ch, i) => {
      const col = lvls[i] === -1 ? 'var(--ink)' : lvls[i] === 1 ? 'var(--s1)' : 'var(--s4)';
      out.append(A.el('span', { style: { color: col, textDecoration: copied[i] ? 'underline' : 'none', textDecorationColor: 'var(--s8)', textDecorationThickness: '2px', textUnderlineOffset: '6px' } }, ch));
      if (ch === '。') out.append(A.el('br'));
    });
    const cp = copied.filter(Boolean).length / Math.max(1, body.length);
    const nctx = counts[Math.min(n - 1, 4)].size;
    info.innerHTML = `逐字照抄比例 <b>${A.pct(cp, 0)}</b>。语料共 ${text.length} 字，其中出现过的 ${n - 1} 字上下文有 ${nctx} 种；而所有可能的 ${n - 1} 字组合约有 ${n > 1 ? A.sci(Math.pow(counts[0].get('').size, n - 1)) : 1} 种，绝大多数从未出现过。`;
  }
  pre.addEventListener('input', A.debounce(() => gen(), 200));
  gen();
});
