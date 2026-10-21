/* swe-task — how a SWE-bench-style task is built, solved and graded, on the chapter's toy repo (小统计 / median) */
A.defineDemo('swe-task', function (mount) {
  const { bd } = A.demo(mount, '一道“修 issue”的题是怎样出、怎样做、怎样判的', 'SWE-bench 式任务，用本章「从零开始」的玩具仓库“小统计”；最后一步可以换一个补丁看判分结果');
  const ISSUE = '<b>issue</b>：对 4、1、3、2 求中位数，返回 3，应该是 2.5。';
  const CODE0 = '<span class="small">core.py：中位数函数先排序，再取长度一半（向下取整）处的数</span>';
  const REF = '<span class="small">core.py：个数为偶数时取中间两个数的平均（参考答案，判分时不用）</span>';
  const NEWT = '<span class="small">test_core.py 新增 1 个测试：4、1、3、2 的中位数应为 2.5</span>';
  const OLD = [['三个数的平均数', 'avg'], ['负数的平均数', 'avg'], ['3、1、2 的中位数是 2', 'odd'], ['只有一个数时的中位数', 'odd'], ['空列表会报错', 'empty']];
  const PATCHES = {
    good: { t: '认真修好', d: '个数为偶数时取中间两个数的平均，奇数时照旧。', fix: true, odd: true },
    special: { t: '写特例', d: '如果输入正好是 4、1、3、2，就返回 2.5，否则照旧。', fix: true, odd: true, wrong: true },
    regress: { t: '改坏了奇数情况', d: '不论奇偶，一律取中间两个数的平均。', fix: true, odd: false },
  };
  const STEPS = [
    { t: '出题', say: '从开源仓库里找一个已合并的拉取请求（PR）：它关联一个 issue，改了源代码，还新增了测试。issue、修复前的代码、修复补丁、新增的测试，四样东西构成一道题。', show: 'pr' },
    { t: '交给智能体什么', say: '智能体只拿到 issue 和修复前的仓库，运行在装好依赖的容器里。修复补丁和新增的测试被藏起来：它要自己定位、复现、修改，就是「从零开始」里的 10 轮循环。', show: 'given' },
    { t: '交出补丁', say: '循环结束时，harness 把智能体对仓库的全部修改导出成一个补丁。补丁不必和参考答案一样，判分只看测试。', show: 'patch' },
    { t: '判分：两组测试', say: '把补丁打到修复前的仓库上，放回藏起来的测试一起运行。FAIL_TO_PASS 组修复前失败、修复后应通过，相当于复现测试；PASS_TO_PASS 组原本就通过、修复后仍应通过，防回归。两组全过记为解决（RL 里奖励为 1），否则为 0。换一个补丁看看。', show: 'grade' },
  ];
  let k = 0, which = 'good';
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  bar.append(prev, next);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const say = A.el('p', { class: 'gs-say' });
  const segBox = A.el('div', { class: 'controls' });
  const seg = A.seg(segBox, Object.entries(PATCHES).map(([v, o]) => ({ v, t: o.t })), which, (v) => { which = v; render(); }, '智能体交的补丁');
  const stage = A.el('div', { class: 'card', style: { fontSize: '14px', lineHeight: '1.8' } });
  bd.append(bar, dots, say, segBox, stage);
  const box = (label, body, dim) => `<div style="border:1px solid var(--grid);border-radius:8px;padding:8px 10px;margin:6px 0;${dim ? 'opacity:.4' : ''}"><div class="small muted">${label}</div>${body}</div>`;
  const cell = (ok) => `<td class="small" style="color:${ok ? 'var(--good-ink)' : 'var(--bad-ink, #c33)'}">${ok ? '通过' : '失败'}</td>`;
  const row = (name, kind, before, after) => `<tr><td class="small">${name}</td><td class="small mono">${kind}</td>${cell(before)}${cell(after)}</tr>`;
  function render() {
    const s = STEPS[k], P = PATCHES[which];
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}`;
    segBox.style.display = k >= 2 ? '' : 'none';
    if (s.show === 'pr') stage.innerHTML = box('issue', ISSUE) + box('修复前的代码', CODE0) + box('修复补丁', REF) + box('PR 新增的测试', NEWT);
    else if (s.show === 'given') stage.innerHTML = box('给智能体：issue', ISSUE) + box('给智能体：修复前的仓库 + 容器环境', CODE0) + box('藏起来：修复补丁', REF, true) + box('藏起来：新增的测试', NEWT, true);
    else if (s.show === 'patch') stage.innerHTML = box('智能体交的补丁：' + P.t, '<span class="small">' + P.d + '</span>');
    else {
      const rows = [row('4、1、3、2 的中位数应为 2.5', 'FAIL_TO_PASS', false, P.fix)].concat(OLD.map(([n, kind]) => row(n, 'PASS_TO_PASS', true, kind === 'odd' ? P.odd : true)));
      const solved = P.fix && P.odd;
      const verdict = solved ? (P.wrong ? '全部通过 → <b>记为解决，奖励 = 1</b>。可它没修好：对 1、2、3、4 求中位数照样错。藏起来的测试只有 issue 里那一个例子，误放率是 100%。' : '全部通过 → <b>记为解决，奖励 = 1</b>。')
        : '有一个防回归测试失败 → <b>未解决，奖励 = 0</b>：修了偶数，弄坏了奇数，PASS_TO_PASS 抓住了回归。';
      stage.innerHTML = `<div class="small muted">补丁：${P.t}</div><table style="width:100%"><tr><th>测试</th><th>组</th><th>修复前</th><th>打上补丁后</th></tr>${rows.join('')}</table><p class="small" style="margin:6px 0 0">${verdict}</p>`;
    }
  }
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); render(); }
  render();
});
