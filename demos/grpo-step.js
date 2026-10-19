/* grpo-step — one GRPO update, frame by frame: sample a group → score → baseline → advantages → token directions → new probabilities */
A.defineDemo('grpo-step', function (mount) {
  const { bd } = A.demo(mount, 'GRPO 的一步：从采样到更新', '可单步、可拖动；每一帧对应正文里的一个公式');
  const Q = '鸡兔同笼：共 35 个头、94 条腿，兔有几只？';
  const POOL = [
    { tok: ['设', '兔', 'x', '只', '，', '4x', '+', '2(35−x)', '=', '94', '→', 'x', '=', '12'], ans: 12 },
    { tok: ['全', '当', '鸡', '：', '70', '条', '腿', '，', '多', '24', '条', '÷', '2', '=', '12'], ans: 12 },
    { tok: ['94', '÷', '4', '≈', '23', '，', '兔', '23', '只'], ans: 23 },
    { tok: ['35', '−', '12', '=', '23', '，', '兔', '有', '23'], ans: 23 },
    { tok: ['设', '鸡', 'x', '，', '2x', '+', '4(35−x)', '=', '94', '→', 'x', '=', '23', '，', '兔', '12'], ans: 12 },
    { tok: ['腿', '94', '头', '35', '，', '差', '59', '，', '兔', '10'], ans: 10 },
  ];
  const STEPS = [
    { t: '题目', tex: String.raw`q`, say: '从题库里抽一道有标准答案的题。标准答案是 12，但模型看不到它。' },
    { t: '采样一组回答', tex: String.raw`o_1,\dots,o_G \sim \pi_{\text{old}}(\cdot\mid q),\quad G = 4`, say: '让当前模型对同一道题独立写 4 条回答（rollout）。每条回答是一串 token，长度各不相同。' },
    { t: '打分', tex: String.raw`R_i = \mathbb 1\big[\text{最终答案} = 12\big]`, say: '判分程序只看最终答案对不对：对得 1 分，错得 0 分。中间的推理写得好不好，它不管。' },
    { t: '组内基线', tex: String.raw`\bar R = \tfrac1G\textstyle\sum_i R_i,\qquad \sigma_R = \operatorname{std}(R_1,\dots,R_G)`, say: '用这一组的平均分当基线：这道题对现在的模型来说“平均能拿多少分”。不需要价值网络。' },
    { t: '优势', tex: String.raw`\hat A_i = \dfrac{R_i - \bar R}{\sigma_R}`, say: '每条回答比组内平均好多少。答对的为正、答错的为负。如果 4 条全对或全错，所有优势都是 0。' },
    { t: '每个 token 的方向', tex: String.raw`\nabla_\theta J \;\propto\; \sum_i \hat A_i \sum_t \nabla_\theta \log\pi_\theta(o_{i,t}\mid q, o_{i,<t})`, say: '一条回答的每个 token 都分到这条回答的优势：蓝色的 token 概率会被提高，红色的被压低。注意整条回答一起加强，包括其中多余的废话，这就是粗糙的功劳分配。' },
    { t: '更新之后', tex: String.raw`\theta \leftarrow \theta + \alpha\,\nabla_\theta J`, say: '沿梯度更新一小步（PPO 式裁剪保证步子不太大）。下次再遇到这类题，写出正确思路的概率更高，写出错误思路的概率更低。' },
  ];
  let k = 0, pick = [0, 2, 1, 5], timer = null;
  const top = A.el('div', { class: 'gs-top' });
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  const play = A.el('button', { onclick: () => { if (timer) { stop(); return; } if (k >= STEPS.length - 1) go(0); timer = setInterval(() => (k < STEPS.length - 1 ? go(k + 1) : stop()), 1800); play.textContent = '暂停'; } }, '自动播放');
  const stop = () => { clearInterval(timer); timer = null; play.textContent = '自动播放'; };
  const groups = A.el('div', { class: 'seg' });
  [['两对两错', [0, 2, 1, 5]], ['三对一错', [0, 1, 4, 3]], ['全对', [0, 1, 4, 0]], ['全错', [2, 3, 5, 2]]].forEach(([n, p], i) => {
    const b = A.el('button', { class: i === 0 ? 'on' : '', onclick: () => { pick = p; A.$$('button', groups).forEach((x) => x.classList.remove('on')); b.classList.add('on'); render(); } }, n);
    groups.append(b);
  });
  bar.append(prev, next, play, A.el('span', { class: 'small muted', style: { marginLeft: '8px' } }, '这一组回答：'), groups);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const stage = A.el('div', { class: 'gs-stage' });
  bd.append(bar, slider, dots, top, fx, say, stage);
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); slider.value = k; render(); }
  function stats() {
    const R = pick.map((j) => (POOL[j].ans === 12 ? 1 : 0));
    const m = A.mean(R), sd = Math.sqrt(A.mean(R.map((r) => (r - m) ** 2)));
    const adv = R.map((r) => (sd > 0 ? (r - m) / sd : 0));
    return { R, m, sd, adv };
  }
  function render() {
    const s = STEPS[k], { R, m, sd, adv } = stats();
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    top.innerHTML = `<b>题目</b>　${Q}`;
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    let extra = '';
    if (k === 3) extra = `　这一组：\\(\\bar R = ${m.toFixed(2)}\\)，\\(\\sigma_R = ${sd.toFixed(2)}\\)。`;
    if (k === 4) extra = sd > 0 ? `　代入：${adv.map((a, i) => `\\(\\hat A_${i + 1} = ${a >= 0 ? '+' : ''}${a.toFixed(2)}\\)`).join('，')}。` : '　这一组 4 条回答得分相同，\\(\\sigma_R = 0\\)，优势全部为 0：这道题这一轮什么也学不到。';
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}${extra}`;
    A.renderMath(say);
    stage.innerHTML = '';
    if (k === 0) { stage.append(A.el('div', { class: 'gs-empty' }, '还没有回答。点“下一步”让模型采样。')); return; }
    const mx = Math.max(...pick.map((j) => POOL[j].tok.length));
    pick.forEach((j, i) => {
      const o = POOL[j], ok = o.ans === 12;
      const row = A.el('div', { class: 'gs-row' });
      const head = A.el('div', { class: 'gs-head' }, A.el('b', null, 'o' + (i + 1)));
      if (k >= 2) head.append(A.el('span', { class: 'gs-r ' + (ok ? 'ok' : 'no') }, (ok ? '✓ R=1' : '✗ R=0')));
      if (k >= 4) head.append(A.el('span', { class: 'gs-a' }, 'Â=' + (adv[i] >= 0 ? '+' : '') + adv[i].toFixed(2)));
      const toks = A.el('div', { class: 'gs-toks' });
      o.tok.forEach((t, ti) => {
        const ch = A.el('span', { class: 'gs-tok' }, t);
        if (k >= 5 && adv[i] !== 0) {
          const pos = adv[i] > 0;
          ch.style.background = pos ? 'color-mix(in srgb, var(--s1) 32%, transparent)' : 'color-mix(in srgb, var(--s8) 28%, transparent)';
          ch.style.borderColor = pos ? 'var(--s1)' : 'var(--s8)';
          ch.title = (pos ? '概率提高' : '概率压低') + '，权重 ' + Math.abs(adv[i]).toFixed(2);
        }
        if (k === 1) ch.style.animationDelay = (ti * 35) + 'ms';
        if (k === 1) ch.classList.add('gs-in');
        toks.append(ch);
      });
      row.append(head, toks);
      if (k >= 6) {
        const p0 = 0.25, p1 = adv[i] === 0 ? p0 : A.clamp(p0 * Math.exp(0.35 * adv[i]), 0.02, 0.9);
        row.append(A.el('div', { class: 'gs-prob' }, A.el('span', { class: 'small muted' }, `这类写法的概率：${A.pct(p0, 0)} → `), A.el('b', { style: { color: p1 > p0 ? 'var(--s1)' : p1 < p0 ? 'var(--s8)' : 'var(--muted)' } }, A.pct(p1, 0))));
      }
      stage.append(row);
    });
    if (k >= 5) stage.append(A.el('div', { class: 'legend' }, A.el('span', { html: '<i style="background:color-mix(in srgb, var(--s1) 40%, transparent)"></i>概率被提高' }), A.el('span', { html: '<i style="background:color-mix(in srgb, var(--s8) 35%, transparent)"></i>概率被压低' }), A.el('span', null, '更新后概率为示意')));
  }
  render();
});
