/* sft-mask — 回答掩码：同一批三条示范，损失算在全部 token 还是只算回答；一批里按 token 还是按样本平均 */
A.defineDemo('sft-mask', function (mount) {
  const { bd } = A.demo(mount, '回答掩码：损失算在哪些 token 上', '玩具数据：三条示范；每个 token 下面是基座模型给它的 −ln p（nat，示意数字）');
  // [token, p_base]; 第一个 token 不被预测（没有前文）
  const SYS = [['你', 0.05], ['是', 0.30], ['一个', 0.30], ['有', 0.10], ['帮助', 0.30], ['的', 0.60], ['助手', 0.40], ['，', 0.30], ['回答', 0.10], ['要', 0.20], ['简洁', 0.05], ['。', 0.50]];
  const S = [
    { u: [['法国', 0.01], ['的', 0.30], ['首都', 0.10], ['是', 0.40], ['哪里', 0.30], ['？', 0.70], ['〈助手〉', 0.50]], a: [['巴黎', 0.30], ['。', 0.60], ['〈结束〉', 0.10]] },
    { u: [['2', 0.02], ['加', 0.10], ['3', 0.15], ['等于', 0.50], ['几', 0.30], ['？', 0.80], ['〈助手〉', 0.50]], a: [['5', 0.40], ['。', 0.50], ['〈结束〉', 0.10]] },
    { u: [['用', 0.02], ['一句话', 0.05], ['介绍', 0.20], ['猫', 0.03], ['。', 0.40], ['〈助手〉', 0.50]], a: [['猫', 0.30], ['是', 0.50], ['一种', 0.30], ['常见', 0.20], ['的', 0.70], ['宠物', 0.40], ['。', 0.60], ['〈结束〉', 0.10]] },
  ];
  const FORMAT = new Set(['。', '〈结束〉']);
  let mask = 'answer', avg = 'token', sys = false;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'all', t: '全部 token' }, { v: 'answer', t: '只算回答' }], mask, (v) => { mask = v; draw(); }, '损失算在哪里');
  A.seg(ctl, [{ v: 'token', t: '按 token 平均' }, { v: 'sample', t: '按样本平均' }], avg, (v) => { avg = v; draw(); }, '一批里怎么平均');
  A.check(ctl, '每条前面加同一段系统提示（12 个 token）', sys, (v) => { sys = v; draw(); });
  const rows = A.el('div', { style: { margin: '4px 0 6px' } }); bd.append(rows);
  const barLab = A.el('div', { class: 'small', style: { color: 'var(--muted)', margin: '10px 0 4px' } }, '这一批的损失由哪几类 token 贡献（按上面选的平均方式加权）');
  const bar = A.el('div', { style: { display: 'flex', height: '26px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' } });
  bd.append(barLab, bar);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  let CAT;
  const setCat = () => { const cols = A.series(); CAT = { sys: { n: '系统提示', c: cols[6] }, user: { n: '用户提问（含〈助手〉标记）', c: cols[0] }, content: { n: '回答的内容', c: cols[2] }, format: { n: '回答的格式（句号、〈结束〉）', c: cols[1] } }; };
  const nl = (p) => -Math.log(p);
  function build() {
    return S.map((s, i) => {
      const toks = [];
      if (sys) { toks.push({ t: '〈系统〉', start: true, cat: 'sys' }); SYS.forEach(([t, p]) => toks.push({ t, p, cat: 'sys' })); toks.push({ t: '〈用户〉', p: 0.6, cat: 'user' }); }
      else toks.push({ t: '〈用户〉', start: true, cat: 'user' });
      s.u.forEach(([t, p]) => toks.push({ t, p, cat: 'user' }));
      s.a.forEach(([t, p]) => toks.push({ t, p, cat: FORMAT.has(t) ? 'format' : 'content', ans: true }));
      toks.forEach((k) => { k.on = !k.start && (mask === 'all' || k.ans); k.l = k.start ? 0 : nl(k.p); });
      return { i, toks, n: toks.filter((k) => k.on).length };
    });
  }
  function draw() {
    setCat();
    const B = build();
    const nTot = A.sum(B.map((b) => b.n));
    B.forEach((b) => b.toks.forEach((k) => { k.w = k.on ? (avg === 'token' ? 1 / nTot : 1 / (B.length * b.n)) : 0; }));
    const maxL = Math.max(...B.flatMap((b) => b.toks.map((k) => k.l)));
    rows.innerHTML = '';
    let total = 0; const byCat = { sys: 0, user: 0, content: 0, format: 0 };
    B.forEach((b) => {
      const line = A.el('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '6px 0', flexWrap: 'wrap' } });
      const sw = A.sum(b.toks.map((k) => k.w));
      const sl = A.sum(b.toks.map((k) => k.w * k.l));
      total += sl; b.toks.forEach((k) => { byCat[k.cat] += k.w * k.l; });
      line.append(A.el('div', { style: { minWidth: '92px', fontSize: '12.5px', color: 'var(--ink-2)', paddingTop: '3px' } }, A.el('b', null, '示范 ' + (b.i + 1)), A.el('br'), '权重 ' + A.pct(sw, 0)));
      const chips = A.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px', flex: '1' } });
      b.toks.forEach((k) => {
        const c = CAT[k.cat].c;
        const st = { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '2px 5px', borderRadius: '5px', fontSize: '13px', lineHeight: '1.25', minWidth: '24px' };
        if (k.start) Object.assign(st, { border: '1px dotted var(--axis)', color: 'var(--muted)' });
        else if (k.on) Object.assign(st, { background: A.alpha(c, 0.12 + 0.55 * k.l / maxL), border: '1px solid ' + A.alpha(c, 0.7) });
        else Object.assign(st, { border: '1px dashed var(--axis)', opacity: '0.5' });
        const sub = k.start ? '起点' : k.on ? k.l.toFixed(2) : '掩码';
        const el = A.el('span', { style: st }, A.el('span', null, k.t), A.el('span', { style: { fontSize: '10.5px', fontFamily: 'var(--mono)', color: k.on ? 'var(--ink-2)' : 'var(--muted)' } }, sub));
        el.addEventListener('mouseenter', (e) => A.tip.show(k.start ? `<b>${k.t}</b>：序列的第一个 token，前面没有东西，不用预测` : `<b>${k.t}</b>（${CAT[k.cat].n}）<br>基座模型给它的概率 p = ${k.p.toFixed(2)}<br>−ln p = ${k.l.toFixed(2)} nat<br>${k.on ? '计入损失，权重 ' + (k.w * 100).toFixed(1) + '%' : '被掩码：照样参与前向计算，但不计入损失、不产生梯度'}`, e.clientX, e.clientY));
        el.addEventListener('mouseleave', () => A.tip.hide());
        chips.append(el);
      });
      line.append(chips);
      rows.append(line);
    });
    bar.innerHTML = ''; legend.innerHTML = '';
    Object.keys(CAT).forEach((k) => {
      if (k === 'sys' && !sys) return;
      const sh = total > 0 ? byCat[k] / total : 0;
      legend.innerHTML += `<span><i style="background:${CAT[k].c}"></i>${CAT[k].n}：${A.pct(sh, 0)}</span>`;
      if (sh <= 0) return;
      bar.append(A.el('div', { style: { width: (sh * 100) + '%', background: A.alpha(CAT[k].c, 0.75), color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', whiteSpace: 'nowrap' } }, sh > 0.09 ? A.pct(sh, 0) : ''));
    });
    const ansShare = total > 0 ? (byCat.content + byCat.format) / total : 0;
    const w3 = A.sum(B[2].toks.map((k) => k.w));
    stats.innerHTML = '';
    [['计入损失的 token', nTot + ' 个'], ['回答部分占损失的比例', A.pct(ansShare, 0)], ['格式 token 占回答损失的比例', A.pct((byCat.format) / Math.max(1e-9, byCat.content + byCat.format), 0)], ['示范 3（长回答）在这一批里的权重', A.pct(w3, 0)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    let h = '';
    if (mask === 'all') h += `算全部 token 时，约 ${A.pct(1 - ansShare, 0)} 的损失来自预测“提示”本身：用户会问什么、系统提示怎么写。这些梯度教模型模仿用户，而不是回答用户；用户提问本来就难猜（“法国”只有 1% 的概率），损失大、却与“怎样回答”无关。` + (sys ? '同一段系统提示在每条样本里重复，模型很快就能背下来，背它纯属浪费。' : '');
    else h += '只算回答时，提示部分照样输入模型、参与前向计算，只是损失权重为 0。回答里最大的一项往往是〈结束〉：基座模型知道答案（“巴黎”是它的首选），却不知道答完就该停，更可能接着编下一个问题。格式和收尾，正是 SFT 最先学会的东西。';
    h += avg === 'token'
      ? ' 按 token 平均时，每个 token 权重相同，回答越长的样本在梯度里占得越多：示范 3 的回答有 8 个 token，占了这一批 ' + A.pct(w3, 0) + ' 的权重。'
      : ' 按样本平均时，每条样本先在自己内部平均、再平均到整批，三条各占三分之一，长回答里每个 token 分到的权重就小了。两种做法都有人用；分布式训练和梯度累积会在不经意间把一种换成另一种（Tülu 3 报告过这个坑）。';
    hint.innerHTML = h;
  }
  A.onTheme(draw);
  draw();
});
