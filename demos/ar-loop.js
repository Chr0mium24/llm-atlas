/* ar-loop — the autoregressive sampling loop, step by step: logits → temperature softmax → top-p → draw u → append */
A.defineDemo('ar-loop', function (mount) {
  const { bd } = A.demo(mount, '自回归生成：一个词一个词地采样', '比正文的 5 词模型大一点（约 50 个词），但仍只看上一个词；logit 是手工设定的，其余数字都按公式实际计算');
  const ANIMAL = { '，': 2.2, 住在: 1.8, 喜欢: 1.2, 很: 1.0, '。': 0.8 };
  const END = { '。': 2.2, '，': 1.6 };
  const PRON = { 喜欢: 1.8, 每天: 1.6, 很: 1.4, 想: 1.3, 住在: 1.0 };
  const M = {
    '▶': { 从前: 3.0, 有一天: 2.0, 很久以前: 1.5 },
    从前: { 有: 2.5, 住着: 1.8, '，': 1.0 },
    很久以前: { '，': 2.0, 住着: 1.6, 有: 1.5 },
    有一天: { '，': 2.5, 早上: 1.0 },
    早上: { '，': 2.5 },
    有: { 一只: 2.8, 一个: 2.2, 两只: 0.8 },
    住着: { 一只: 2.0, 一个: 2.0, 一位: 1.2 },
    一只: { 小猫: 2.2, 小狗: 2.0, 狐狸: 1.6, 小鸟: 1.4, 老虎: 1.0, 乌龟: 0.9, 龙: 0.3, 桌子: -2.0 },
    一个: { 小女孩: 2.0, 国王: 1.6, 老人: 1.5, 机器人: 0.8, 小猫: 0.3 },
    两只: { 小猫: 1.5, 小鸟: 1.5, 狐狸: 1.0 },
    一位: { 国王: 1.8, 老人: 1.8, 公主: 1.6 },
    '，': { 它: 1.8, 每天: 1.5, 有一天: 1.3, 住在: 1.2, 他: 1.0, 她: 0.8 },
    '。': { 有一天: 1.8, 它: 1.0, 每天: 1.0, 他: 0.8, 从前: 0.2 },
    住在: { 森林里: 2.0, 河边: 1.6, 山上: 1.5, 城堡里: 1.0, 月亮上: 0.2 },
    每天: { 去: 1.8, 都: 1.5, 睡觉: 1.1, 唱歌: 1.0 },
    都: { 去: 1.8, 唱歌: 1.2, 很: 1.0 },
    去: { 河边: 1.8, 钓鱼: 1.5, 森林里: 1.4, 山上: 1.2 },
    喜欢: { 唱歌: 1.6, 吃鱼: 1.5, 钓鱼: 1.4, 睡觉: 1.3, 星星: 1.1 },
    很: { 开心: 1.8, 聪明: 1.5, 孤独: 1.2, 饿: 1.0 },
    想: { 去: 1.8, 回家: 1.4, 吃鱼: 1.2, 唱歌: 0.8 },
  };
  ['小猫', '小狗', '狐狸', '小鸟', '老虎', '乌龟', '龙', '桌子', '小女孩', '国王', '老人', '机器人', '公主'].forEach((w) => (M[w] = ANIMAL));
  ['森林里', '河边', '山上', '城堡里', '月亮上', '唱歌', '钓鱼', '睡觉', '星星', '吃鱼', '开心', '孤独', '聪明', '饿', '回家'].forEach((w) => (M[w] = END));
  ['它', '他', '她'].forEach((w) => (M[w] = PRON));
  const NTOK = 12, SUB = 5;
  const SUBS = [
    { t: '算 logit', tex: String.raw`\mathbf z = f_\theta(x_{<t})`, say: '模型读入目前为止的全部前缀，为词表里每个候选词输出一个分数（logit）。这个玩具模型只看最后一个词；真实模型通过注意力看整段前缀。' },
    { t: '温度 + softmax', tex: String.raw`p_i = \frac{e^{z_i/T}}{\sum_j e^{z_j/T}}`, say: '每个 logit 除以温度 T，再做 softmax，得到和为 1 的概率。T 越小，高分词的优势被放得越大。' },
    { t: 'top-p 截断', tex: String.raw`p'_i = \frac{p_i}{\sum_{j\in S}p_j},\quad i \in S`, say: '按概率从高到低累加，累计达到 p 就停，只保留这些候选（集合 S），再重新归一化。尾部那些不太可能的词被砍掉。' },
    { t: '抽随机数', tex: String.raw`u\sim\mathcal U(0,1),\quad x_t = \min\Big\{i : \textstyle\sum_{j\le i}p'_j \ge u\Big\}`, say: '把保留下来的候选按概率排成一条总长为 1 的线段，抽一个 0 到 1 之间的随机数 u，它落在哪一段，就选哪个词。' },
    { t: '接到末尾', tex: String.raw`x_{<t+1} = (x_{<t},\ x_t)`, say: '把选中的词接到前缀末尾，再回到第 1 步预测下一个。整段文字就是这个循环跑很多次的结果，每一步都依赖上一步的选择，所以无法并行。' },
  ];
  let T = 1, P = 1, seed = 11, k = 0, seq = [], timer = null;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  const play = A.el('button', { onclick: () => toggle() }, '自动播放');
  const reseed = A.el('button', { onclick: () => { seed = (seed * 7919 + 13) % 100003; build(); render(); } }, '换一组随机数');
  bar.append(prev, next, play, reseed);
  const ctl = A.el('div', { class: 'controls' });
  A.slider(ctl, { label: '温度 T', min: 0.2, max: 2, step: 0.05, value: T, fmt: (v) => v.toFixed(2), on: (v) => { T = v; build(); render(); }, width: 170 });
  A.slider(ctl, { label: 'top-p', min: 0.3, max: 1, step: 0.01, value: P, fmt: (v) => v.toFixed(2), on: (v) => { P = v; build(); render(); }, width: 170 });
  const slider = A.el('input', { type: 'range', min: 0, max: NTOK * SUB - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = SUBS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(Math.floor(k / SUB) * SUB + i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const prefix = A.el('div', { style: { margin: '6px 0 4px', lineHeight: '2.1' } });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' }), stage = A.el('div', { class: 'tablewrap' });
  bd.append(bar, ctl, slider, dots, prefix, fx, say, stage);

  function softmax(z, t) { const m = Math.max(...z); const e = z.map((x) => Math.exp((x - m) / t)); const s = A.sum(e); return e.map((x) => x / s); }
  function build() {
    const r = A.rng(seed);
    seq = []; let last = '▶';
    for (let n = 0; n < NTOK; n++) {
      const c = Object.entries(M[last] || M['。']).sort((a, b) => b[1] - a[1]);
      const z = c.map((x) => x[1]), p = softmax(z, T);
      const keep = []; let cum = 0;
      p.forEach((v, i) => { keep.push(cum < P || i === 0); cum += v; });
      const zs = A.sum(p.filter((v, i) => keep[i]));
      const pp = p.map((v, i) => (keep[i] ? v / zs : 0));
      const u = r();
      let acc = 0, pick = -1;
      for (let i = 0; i < pp.length; i++) { if (!keep[i]) continue; acc += pp[i]; if (acc >= u) { pick = i; break; } }
      if (pick < 0) pick = keep.lastIndexOf(true);
      seq.push({ c: c.map((x) => x[0]), z, p, keep, pp, u, pick, w: c[pick][0] });
      last = c[pick][0];
    }
  }
  function go(i) { k = A.clamp(i, 0, NTOK * SUB - 1); slider.value = k; render(); }
  function toggle() {
    if (timer) { clearInterval(timer); timer = null; play.textContent = '自动播放'; return; }
    play.textContent = '暂停';
    timer = setInterval(() => { if (k >= NTOK * SUB - 1 || !mount.isConnected) { toggle(); return; } go(k + 1); }, A.reducedMotion && A.reducedMotion() ? 1600 : 900);
  }
  const chip = (w, on) => `<span class="tok" style="${on ? 'background:' + A.alpha(A.series()[0], 0.22) + ';border-color:var(--s1);font-weight:700' : ''}">${w}</span>`;
  function render() {
    const t = Math.floor(k / SUB), s = k % SUB, st = seq[t];
    prev.disabled = k === 0; next.disabled = k === NTOK * SUB - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === s); d.classList.toggle('done', i < s); });
    const done = seq.slice(0, t + (s === 4 ? 1 : 0)).map((x, i) => chip(x.w, s === 4 && i === t)).join('');
    prefix.innerHTML = `<span class="small muted">第 ${t + 1} / ${NTOK} 个词　前缀：</span>${done || '<span class="small muted">（空，从开头生成）</span>'}${s < 4 ? '<span class="tok" style="border-style:dashed;color:var(--muted)">？</span>' : ''}`;
    if (window.katex) katex.render(SUBS[s].tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = SUBS[s].tex;
    let extra = '';
    if (s === 2) extra = `　保留了 ${st.keep.filter(Boolean).length} / ${st.c.length} 个候选。`;
    if (s === 3) extra = `　这次 u = ${st.u.toFixed(3)}，落在“${st.w}”那一段（它的概率是 ${A.pct(st.pp[st.pick], 1)}）。`;
    if (s === 4) extra = st.pick === 0 ? '　这次选中的恰好是最可能的词。' : `　这次选中的是第 ${st.pick + 1} 可能的词：采样不总选最大的，这正是输出有变化的来源。`;
    say.innerHTML = `<b>第 ${s + 1} 步 · ${SUBS[s].t}。</b>${SUBS[s].say}${extra}`;
    if (s === 3) { stage.innerHTML = line(st); return; }
    if (s === 4) { stage.innerHTML = '<p class="small muted" style="margin:4px 0">点“下一步”开始预测下一个词。拖动顶部的温度和 top-p 会重新生成整段：温度低时几乎总选第一名，温度高时更常选到靠后的词。</p>'; return; }
    const head = ['候选词', 'logit z'];
    if (s >= 1) head.push('z / T', 'softmax 概率 p');
    if (s >= 2) head.push('top-p 后 p′');
    let cum = 0;
    const rows = st.c.map((w, i) => {
      const cells = [`<td><b>${w}</b></td>`, `<td class="num mono">${st.z[i].toFixed(1)}</td>`];
      if (s >= 1) {
        cells.push(`<td class="num mono">${(st.z[i] / T).toFixed(2)}</td>`);
        cells.push(`<td><div style="display:flex;gap:6px;align-items:center"><div style="height:11px;width:${Math.round(st.p[i] * 140)}px;background:${s >= 2 && !st.keep[i] ? 'var(--grid)' : 'var(--s1)'};border-radius:0 4px 4px 0"></div><span class="mono small">${A.pct(st.p[i], 1)}</span>${s >= 2 ? `<span class="small muted">累计 ${A.pct((cum += st.p[i]), 0)}</span>` : ''}</div></td>`);
      }
      if (s >= 2) cells.push(st.keep[i] ? `<td><div style="display:flex;gap:6px;align-items:center"><div style="height:11px;width:${Math.round(st.pp[i] * 140)}px;background:var(--s2);border-radius:0 4px 4px 0"></div><span class="mono small">${A.pct(st.pp[i], 1)}</span></div></td>` : '<td class="small muted">截掉</td>');
      return `<tr style="${s >= 2 && !st.keep[i] ? 'opacity:.55' : ''}">${cells.join('')}</tr>`;
    });
    stage.innerHTML = `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table>`;
  }
  function line(st) {
    const cols = A.series();
    let acc = 0;
    const segs = st.c.map((w, i) => {
      if (!st.keep[i]) return '';
      const x0 = acc; acc += st.pp[i];
      return `<div title="${w} ${A.pct(st.pp[i], 1)}" style="position:absolute;left:${x0 * 100}%;width:${st.pp[i] * 100}%;top:0;bottom:0;background:${A.alpha(cols[i % 6], i === st.pick ? 0.55 : 0.22)};border-right:2px solid var(--surface);display:flex;align-items:center;justify-content:center;font-size:13px;overflow:hidden;white-space:nowrap;${i === st.pick ? 'font-weight:700' : ''}">${st.pp[i] > 0.06 ? w : ''}</div>`;
    }).join('');
    return `<div style="position:relative;height:44px;margin:26px 0 8px;border-radius:6px;overflow:visible;background:var(--grid)">${segs}
      <div style="position:absolute;left:${st.u * 100}%;top:-4px;bottom:-6px;width:2px;background:var(--ink)"></div>
      <div class="mono small" style="position:absolute;left:${st.u * 100}%;top:-24px;transform:translateX(-50%);white-space:nowrap;background:var(--surface);padding:0 4px">u = ${st.u.toFixed(3)}</div></div>
      <div class="small muted" style="display:flex;justify-content:space-between"><span>0</span><span>每段的长度 = 该词的概率 p′</span><span>1</span></div>`;
  }
  build(); render();
});
