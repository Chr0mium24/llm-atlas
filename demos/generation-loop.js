/* generation-loop — why greedy / beam search fall into loops: a toy bigram story model plus an induction-style copy bonus (β per earlier occurrence of the same word pair) makes every repetition raise the probability of the next one */
A.defineDemo('generation-loop', function (mount) {
  const { bd } = A.demo(mount, '重复的自我强化：贪心、束搜索与采样', '玩具模型：logit = 二元分数 + s × “这两个词连着出现过几次”（模仿归纳头的复制），再减去存在惩罚；其余按公式实际计算');
  const ANIMAL = { '，': 2.2, 住在: 1.8, 喜欢: 1.2, 很: 1.0, '。': 0.8 };
  const END = { '。': 2.2, '，': 1.6 };
  const PRON = { 喜欢: 1.8, 每天: 1.6, 很: 1.4, 想: 1.3, 住在: 1.0 };
  const M = {
    '▶': { 从前: 3.0, 有一天: 2.0, 很久以前: 1.5 },
    从前: { 有: 2.5, 住着: 1.8, '，': 1.0 }, 很久以前: { '，': 2.0, 住着: 1.6, 有: 1.5 },
    有一天: { '，': 2.5, 早上: 1.0 }, 早上: { '，': 2.5 },
    有: { 一只: 2.8, 一个: 2.2, 两只: 0.8 }, 住着: { 一只: 2.0, 一个: 2.0, 一位: 1.2 },
    一只: { 小猫: 2.2, 小狗: 2.0, 狐狸: 1.6, 小鸟: 1.4, 老虎: 1.0, 乌龟: 0.9, 龙: 0.3, 桌子: -2.0 },
    一个: { 小女孩: 2.0, 国王: 1.6, 老人: 1.5, 机器人: 0.8, 小猫: 0.3 },
    两只: { 小猫: 1.5, 小鸟: 1.5, 狐狸: 1.0 }, 一位: { 国王: 1.8, 老人: 1.8, 公主: 1.6 },
    '，': { 它: 1.8, 每天: 1.5, 有一天: 1.3, 住在: 1.2, 他: 1.0, 她: 0.8 },
    '。': { 有一天: 1.8, 它: 1.0, 每天: 1.0, 他: 0.8, 从前: 0.2 },
    住在: { 森林里: 2.0, 河边: 1.6, 山上: 1.5, 城堡里: 1.0, 月亮上: 0.2 },
    每天: { 去: 1.8, 都: 1.5, 睡觉: 1.1, 唱歌: 1.0 }, 都: { 去: 1.8, 唱歌: 1.2, 很: 1.0 },
    去: { 河边: 1.8, 钓鱼: 1.5, 森林里: 1.4, 山上: 1.2 },
    喜欢: { 唱歌: 1.6, 吃鱼: 1.5, 钓鱼: 1.4, 睡觉: 1.3, 星星: 1.1 },
    很: { 开心: 1.8, 聪明: 1.5, 孤独: 1.2, 饿: 1.0 }, 想: { 去: 1.8, 回家: 1.4, 吃鱼: 1.2, 唱歌: 0.8 },
  };
  ['小猫', '小狗', '狐狸', '小鸟', '老虎', '乌龟', '龙', '桌子', '小女孩', '国王', '老人', '机器人', '公主'].forEach((w) => (M[w] = ANIMAL));
  ['森林里', '河边', '山上', '城堡里', '月亮上', '唱歌', '钓鱼', '睡觉', '星星', '吃鱼', '开心', '孤独', '聪明', '饿', '回家'].forEach((w) => (M[w] = END));
  ['它', '他', '她'].forEach((w) => (M[w] = PRON));
  const N = 60, BEAM = 4;
  let method = 'greedy', beta = 0.5, pen = 0, seed = 1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'greedy', t: '贪心' }, { v: 'beam', t: '束搜索（4 条）' }, { v: 'sample', t: '采样（T = 1，top-p = 0.9）' }], method, (v) => { method = v; draw(); }, '解码方法');
  A.slider(ctl, { label: '自我强化 s（0 = 纯二元模型）', min: 0, max: 1.5, step: 0.05, value: beta, fmt: (v) => v.toFixed(2), on: (v) => { beta = v; draw(); }, width: 190 });
  A.slider(ctl, { label: '存在惩罚 α（出现过的词 logit 减 α）', min: 0, max: 2, step: 0.05, value: pen, fmt: (v) => v.toFixed(2), on: (v) => { pen = v; draw(); }, width: 210 });
  const reseed = A.el('button', { onclick: () => { seed++; draw(); } }, '换一组随机数'); ctl.append(reseed);
  const out = A.el('div', { style: { lineHeight: '2.0', margin: '8px 0 4px', minHeight: '64px' } }); bd.append(out);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--s1)"></i>选中的词的概率</span><span><i style="background:var(--s8)"></i>这个词让一个 4 词片段第二次（或更多次）出现</span>' }));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  // next-word distribution given the whole prefix
  function dist(seq, T) {
    const last = seq[seq.length - 1], c = Object.entries(M[last] || M['。']);
    const z = c.map(([w, v]) => {
      let rep = 0; for (let i = 0; i + 1 < seq.length; i++) if (seq[i] === last && seq[i + 1] === w) rep++;
      return v + beta * rep - (pen && seq.indexOf(w, 1) > 0 ? pen : 0);
    });
    const m = Math.max(...z), e = z.map((x) => Math.exp((x - m) / T)), s = A.sum(e);
    return c.map(([w], i) => [w, e[i] / s]).sort((a, b) => b[1] - a[1]);
  }
  function gen(how, sd) {
    if (how === 'beam') {
      let beams = [{ s: ['▶'], lp: 0, pr: [] }];
      for (let t = 0; t < N; t++) {
        const cand = [];
        beams.forEach((b) => dist(b.s, 1).forEach(([w, p]) => cand.push({ s: b.s.concat(w), lp: b.lp + Math.log(p), pr: b.pr.concat(p) })));
        cand.sort((a, b) => b.lp - a.lp); beams = cand.slice(0, BEAM);
      }
      return { seq: beams[0].s.slice(1), pr: beams[0].pr };
    }
    const r = A.rng(sd * 7919 + 17), seq = ['▶'], pr = [];
    for (let t = 0; t < N; t++) {
      const d = dist(seq, 1); let pick = d[0];
      if (how === 'sample') {
        const keep = []; let c = 0; for (const x of d) { keep.push(x); c += x[1]; if (c >= 0.9) break; }
        let u = r() * A.sum(keep.map((x) => x[1])); pick = keep[keep.length - 1];
        for (const x of keep) { u -= x[1]; if (u <= 0) { pick = x; break; } }
      }
      seq.push(pick[0]); pr.push(pick[1]);
    }
    return { seq: seq.slice(1), pr };
  }
  function repeatFlags(seq) {
    const seen = new Set(), f = seq.map(() => false);
    for (let i = 3; i < seq.length; i++) { const g = seq.slice(i - 3, i + 1).join('|'); if (seen.has(g)) f[i] = true; seen.add(g); }
    return f;
  }
  const rate = (f) => f.slice(3).filter(Boolean).length / Math.max(1, f.length - 3);
  let cur = null;
  const view = A.canvas(cv, { height: 230 }, (ctx, W, H) => {
    if (!cur) return;
    const box = { x: 46, y: 36, w: W - 60, h: H - 72 };
    const ax = A.axes(ctx, box, { xmin: 0.5, xmax: N + 0.5, ymin: 0, ymax: 1, xticks: [1, 10, 20, 30, 40, 50, 60], xfmt: (v) => v, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => A.pct(v, 0), xlabel: '第几个词', ylabel: '模型给选中的词的概率', ylabelOffset: 38 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.beginPath();
    cur.pr.forEach((p, i) => { const x = ax.X(i + 1), y = ax.Y(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
    cur.pr.forEach((p, i) => { ctx.fillStyle = cur.f[i] ? A.css('--s8') : A.css('--s1'); ctx.beginPath(); ctx.arc(ax.X(i + 1), ax.Y(p), 3.2, 0, 7); ctx.fill(); });
    view.ax = ax;
  });
  cv.addEventListener('mousemove', (e) => {
    if (!view.ax || !cur) return;
    const i = Math.round(view.ax.invX(A.pos(cv, e).x)) - 1;
    if (i < 0 || i >= N) { A.tip.hide(); return; }
    A.tip.show(`第 ${i + 1} 个词“<b>${cur.seq[i]}</b>”：概率 ${A.pct(cur.pr[i], 1)}${cur.f[i] ? '（重复片段）' : ''}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function draw() {
    reseed.disabled = method !== 'sample';
    const g = gen(method, seed), f = repeatFlags(g.seq);
    cur = { seq: g.seq, pr: g.pr, f };
    out.innerHTML = g.seq.map((w, i) => `<span class="tok" style="${f[i] ? 'background:' + A.alpha(A.css('--s8'), 0.18) + ';border-color:var(--s8)' : ''}">${w}</span>`).join('');
    const last10 = A.mean(g.pr.slice(-10));
    let avg = null;
    if (method === 'sample') { const rs = []; for (let s = 1; s <= 20; s++) rs.push(rate(repeatFlags(gen('sample', s).seq))); avg = A.mean(rs); }
    stats.innerHTML = '';
    [['重复的 4 词片段占比', A.pct(rate(f), 0)], ['最后 10 个词的平均概率', A.pct(last10, 0)], ...(avg !== null ? [['20 组随机数的平均重复率', A.pct(avg, 0)]] : [])]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    let msg;
    if (method === 'greedy') msg = beta === 0
      ? '纯二元模型：贪心是确定的，下一个词只取决于上一个词，所以只要某个词第二次出现，后面就逐字重演，陷入固定的循环。注意概率没有变化：每一圈都一样。'
      : pen >= 1 && beta <= 0.6
        ? '存在惩罚把出现过的词压低，贪心被迫换说法，循环被打断。代价是连“，”“。”“有一天”这类本该反复出现的词也被惩罚了；惩罚太大，句子就会变得别扭。'
        : '加上自我强化后，同样的循环里，所选词的概率一圈比一圈高（图中红点逐步爬向 100%）：前文里这句话出现得越多，模型越确信下一句还是它。贪心每步只取最大值，进去就出不来。';
    else if (method === 'beam') msg = '束搜索找的是整段概率最高的序列，比贪心“更会找”，结果却更糟：在自我强化下，最省概率的写法是把一个短片段无限重复下去，概率逼近 100%。这正是“似然最高 ≠ 文本最好”。';
    else msg = beta >= 1 && pen < 1
      ? '自我强化很强时，采样也会被拖进循环：一旦偶然重复一两次，重复的概率就高到很难再抽到别的词。这时需要重复惩罚，或者在训练上解决（例如让模型见过“重复之后要跳出来”的数据）。'
      : '采样每步按概率抽，偶尔抽到不是第一名的词，就跳出了正在形成的循环。点“换一组随机数”多试几次，看 20 组的平均重复率；再把 s 拉到 1 以上看看。';
    hint.textContent = msg;
    view.redraw();
  }
  draw();
});
