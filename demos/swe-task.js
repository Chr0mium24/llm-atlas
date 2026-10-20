/* swe-task — how a SWE-bench-style task is built, solved and graded, step by step */
A.defineDemo('swe-task', function (mount) {
  const { bd } = A.demo(mount, '一道“修 issue”的题是怎样出、怎样做、怎样判的', 'SWE-bench 式任务；仓库、issue 与补丁均为虚构示例');
  const ISSUE = '<b>Issue #4127</b>：<code>parse_duration("1h30m")</code> 返回 3600，应为 5400。看起来只解析了第一个单位。';
  const STEPS = [
    { t: '从真实仓库取一个 PR', say: '出题时从开源仓库里找一个已合并的 PR：它关联一个 issue，修改了源代码，并新增了测试。这四样东西（issue、修复前的代码、修复补丁、新测试）构成一道题。', show: 'pr' },
    { t: '交给智能体什么', say: '智能体只拿到 issue 描述和修复前的仓库，运行在一个装好依赖的容器里。修复补丁和新增的测试被隐藏起来，它必须自己找到问题、自己修。', show: 'given' },
    { t: '智能体探索与修改', say: '典型的轨迹：搜索相关代码、读文件、写一个小脚本复现 bug、修改、再运行验证。下面是一条简化的轨迹。', show: 'traj' },
    { t: '提交补丁', say: '智能体结束时，harness 把它对仓库的所有修改导出成一个补丁。', show: 'patch' },
    { t: '判分：两组测试', say: '把补丁应用到修复前的仓库，再把出题时隐藏的测试放回去运行。FAIL_TO_PASS：修复前失败、应当在修复后通过的测试，证明问题被修好了；PASS_TO_PASS：原本就通过的测试，证明没有改坏别的。两组全部通过，奖励为 1，否则为 0。', show: 'grade' },
    { t: '这套判法的漏洞', say: '测试不一定完整：补丁可能只“对付”了测试覆盖的情况；issue 可能描述不清，无法从中推出测试期望的行为（SWE-bench Verified 用人工筛掉了这类题）；公开仓库的 PR 可能早已出现在训练数据里（污染）；模型还可能直接修改测试、在代码里针对测试写特例（钻奖励空子）。', show: 'holes' },
    { t: '变成训练环境', say: '同样的结构也可以用于强化学习：每道题是一个环境，奖励来自测试。为了获得成千上万道题，SWE-Gym、R2E-Gym、SWE-smith 等从提交历史自动生成任务，甚至故意注入 bug 来造题；Qwen3-Coder 训练时并行运行 2 万个环境。', show: 'env' },
  ];
  let k = 0;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  bar.append(prev, next);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const say = A.el('p', { class: 'gs-say' }), stage = A.el('div', { class: 'card', style: { fontSize: '14px', lineHeight: '1.8' } });
  bd.append(bar, dots, say, stage);
  const box = (label, body, dim) => `<div style="border:1px solid var(--grid);border-radius:8px;padding:8px 10px;margin:6px 0;${dim ? 'opacity:.4' : ''}"><div class="small muted">${label}</div>${body}</div>`;
  const testRow = (name, before, after, kind) => `<tr><td class="mono small">${name}</td><td class="small">${kind}</td><td class="small" style="color:${before ? 'var(--good-ink)' : 'var(--bad-ink, #c33)'}">${before ? '通过' : '失败'}</td><td class="small" style="color:${after ? 'var(--good-ink)' : 'var(--bad-ink, #c33)'}">${after ? '通过' : '失败'}</td></tr>`;
  function render() {
    const s = STEPS[k];
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}`;
    const code0 = '<span class="mono small">units.py：只匹配第一个“数字+单位”</span>';
    const patch = '<span class="mono small">units.py：改为循环匹配所有“数字+单位”并累加（+6 行，−2 行）</span>';
    const tests = '<span class="mono small">test_units.py：新增 test_multi_unit（"1h30m" → 5400）</span>';
    if (s.show === 'pr') stage.innerHTML = box('issue', ISSUE) + box('修复前的代码', code0) + box('修复补丁（作为参考答案）', patch) + box('PR 新增的测试', tests);
    else if (s.show === 'given') stage.innerHTML = box('给智能体：issue', ISSUE) + box('给智能体：修复前的仓库 + 容器环境', code0) + box('隐藏：修复补丁', patch, true) + box('隐藏：新增测试', tests, true);
    else if (s.show === 'traj') stage.innerHTML = box('轨迹（简化）', '<ol style="margin:0;padding-left:20px"><li>搜索 <code>parse_duration</code> → 找到 units.py</li><li>读 units.py 第 40–80 行</li><li>写脚本复现：<code>parse_duration("1h30m")</code> → 3600 ✗</li><li>修改：把单次匹配改成循环累加</li><li>再运行复现脚本 → 5400 ✓；运行已有测试 → 全部通过</li><li>结束</li></ol>');
    else if (s.show === 'patch') stage.innerHTML = box('智能体提交的补丁', '<span class="mono small">units.py：用 finditer 遍历所有“数字+单位”，累加秒数（+5 行，−2 行）</span>') + box('注意', '补丁不必与参考答案一致，只要通过测试即可。');
    else if (s.show === 'grade') stage.innerHTML = `<table style="width:100%"><tr><th>测试</th><th>类别</th><th>修复前</th><th>应用补丁后</th></tr>${testRow('test_multi_unit', false, true, 'FAIL_TO_PASS')}${testRow('test_single_unit', true, true, 'PASS_TO_PASS')}${testRow('test_invalid_input', true, true, 'PASS_TO_PASS')}${testRow('test_negative', true, true, 'PASS_TO_PASS')}</table><p class="small" style="margin:6px 0 0">全部通过 → <b>奖励 = 1</b>（这道题算解决）</p>`;
    else if (s.show === 'holes') stage.innerHTML = box('测试不完整', '若测试只检查 "1h30m"，一个专门处理“h 后接 m”的补丁也能通过，但 "2d4h" 仍是错的。') + box('描述不清', 'issue 若没说清“应为 5400”，测试期望的行为就无从推断。') + box('污染', '这个 PR 若出现在预训练数据里，模型可能“记得”补丁。') + box('钻空子', '修改或删除测试、在代码里写 <code>if s == "1h30m": return 5400</code>。');
    else stage.innerHTML = box('一道题 = 一个环境', '容器镜像（仓库 + 依赖）+ 任务描述 + 判分测试。') + box('规模', '自动从提交历史生成任务、反向注入 bug 造题；训练时成千上万个容器并行运行。') + box('奖励', '测试通过为 1，否则为 0；常加上对“修改测试文件”等行为的检查。');
  }
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); render(); }
  render();
});
