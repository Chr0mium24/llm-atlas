/* unigram-seg — Unigram LM tokenization: every possible segmentation, its probability, Viterbi best, and sampling (subword regularization) */
A.defineDemo('unigram-seg', function (mount) {
  const { bd } = A.demo(mount, 'Unigram 分词：一句话的所有切法和它们的概率', '玩具词表；每个 token 有一个概率 p(x)');
  const PRESETS = {
    zh: { s: '大模型推理加速', v: { 大: 0.02, 模: 0.004, 型: 0.004, 推: 0.006, 理: 0.008, 加: 0.01, 速: 0.005, 模型: 0.012, 大模型: 0.004, 推理: 0.009, 加速: 0.008, 大模: 0.0003, 理加: 0.0001, 推理加速: 0.0007 } },
    en: { s: 'tokenization', v: { t: 0.01, o: 0.012, k: 0.006, e: 0.015, n: 0.012, i: 0.012, z: 0.003, a: 0.012, to: 0.01, ken: 0.003, token: 0.004, iz: 0.002, ation: 0.005, ization: 0.0025, tion: 0.006, ize: 0.002, za: 0.0008, at: 0.007, on: 0.008, ok: 0.001 } },
  };
  let key = 'zh', alpha = 1, samples = null;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'zh', t: '大模型推理加速' }, { v: 'en', t: 'tokenization' }], key, (v) => { key = v; samples = null; draw(); }, '文本');
  const aS = A.slider(ctl, { label: '采样温度 α（越小越随机）', min: 0.05, max: 2, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), on: (v) => { alpha = v; samples = null; draw(); }, width: 230 });
  ctl.append(A.el('button', { onclick: () => { sample(); draw(); } }, '按 P^α 采样 200 次'));
  const list = A.el('div'); bd.append(list);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  function segs(s, V) {
    const out = [];
    const rec = (i, cur, lp) => {
      if (i === s.length) { out.push({ toks: cur.slice(), lp }); return; }
      for (let j = i + 1; j <= s.length; j++) { const w = s.slice(i, j); if (V[w]) { cur.push(w); rec(j, cur, lp + Math.log(V[w])); cur.pop(); } }
    };
    rec(0, [], 0);
    return out.sort((a, b) => b.lp - a.lp);
  }
  function sample() {
    const { s, v } = PRESETS[key], all = segs(s, v);
    const w = all.map((x) => Math.exp(alpha * (x.lp - all[0].lp))), z = A.sum(w);
    const r = A.rng(Date.now() % 1e6), cnt = new Array(all.length).fill(0);
    for (let n = 0; n < 200; n++) { let u = r() * z, i = 0; for (; i < all.length - 1; i++) { u -= w[i]; if (u <= 0) break; } cnt[i]++; }
    samples = cnt;
  }
  function draw() {
    const { s, v } = PRESETS[key], all = segs(s, v);
    const w = all.map((x) => Math.exp(alpha * (x.lp - all[0].lp))), z = A.sum(w);
    list.innerHTML = `<div class="small muted" style="margin-bottom:6px">“${s}”一共有 <b>${all.length}</b> 种切法（只用词表里有的 token）。按整句对数概率 Σ log p(xᵢ) 从高到低排列，显示前 10 种：</div>`;
    const cols = A.series();
    all.slice(0, 10).forEach((x, i) => {
      const row = A.el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 150px', gap: '10px', alignItems: 'center', margin: '4px 0' } });
      const toks = A.el('div');
      x.toks.forEach((t, k) => toks.append(A.el('span', { class: 'tok', style: { background: A.alpha(cols[k % 6], 0.16), borderColor: A.alpha(cols[k % 6], 0.45), fontWeight: i === 0 ? 700 : 400 } }, t)));
      if (i === 0) toks.append(A.el('span', { class: 'small', style: { color: 'var(--good-ink)', marginLeft: '6px' } }, '← Viterbi 选它'));
      const share = w[i] / z;
      const barW = A.el('div', { style: { height: '12px', background: 'var(--grid)', borderRadius: '0 4px 4px 0' } }, A.el('div', { style: { height: '100%', width: (share * 100) + '%', background: 'var(--s1)', borderRadius: '0 4px 4px 0' } }));
      const extra = samples ? `　抽中 ${samples[i]} 次` : '';
      row.append(toks, A.el('span', { class: 'mono small', style: { textAlign: 'right' } }, x.lp.toFixed(2)), A.el('div', null, barW, A.el('div', { class: 'small muted' }, '采样概率 ' + A.pct(share, 1) + extra)));
      list.append(row);
    });
    note.innerHTML = `切法越“整”，乘的概率越少，总概率往往越高，所以最优切法倾向于用长 token。训练时 Unigram 从一个很大的候选词表出发，反复估计每个 token 的概率（EM 算法），删掉对整体似然贡献最小的 token，直到词表缩到目标大小。<b>子词正则化</b>：训练模型时不总用最优切法，而按 P^α 随机采样一种，模型因此见过同一个词的多种切法，对拼写错误和罕见词更稳健。α 越小，采样越随机。`;
  }
  draw();
});
