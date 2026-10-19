/* training-pipeline — interactive demo (moved from ch05-training.html) */
A.defineDemo('training-pipeline', function (mount) {
  const { bd } = A.demo(mount, '一个 2026 年大模型的训练流水线', '阶段划分各家略有不同');
  const ST = [
    { t: '预训练', s: '10–40T token', data: '网页、书籍、代码、论文、多语言，经过去重、质量过滤、毒性过滤；混合比例本身是精心调过的超参数。', obj: '下一个 token 预测（交叉熵）；常加 MTP 辅助头。', cost: '占总算力的大头（传统上 >90%，现在 RL 份额在上升）。数千到上万张 GPU 训练数周到数月。', out: '“基座模型”：会续写，知识丰富，但不会好好回答问题。' },
    { t: '中期训练 / 退火', s: '数千亿–数 T', data: '学习率衰减阶段换上更高质量的数据：教材、数学、代码、合成推理数据、指令格式数据。', obj: '同预训练。', cost: '比例不大，但对最终能力影响很大。WSD（warmup-stable-decay）学习率调度让这一阶段可以灵活插入。', out: '基座的推理和代码能力明显提升。' },
    { t: '长上下文扩展', s: '数百亿 token', data: '长文档、长代码仓库、合成的长依赖任务（大海捞针、多跳检索）。', obj: '同预训练，序列长度从 4K/8K 逐步拉到 128K–1M；同时调整 RoPE base 或 YaRN（' + A.cref('transformer') + '）。', cost: '注意力的 O(n²) 让单步很贵，需要上下文并行（' + A.cref('training-systems') + '）。', out: '能处理 128K–1M token。Kimi K3 和 DeepSeek V4 都是 1M。' },
    { t: 'SFT 监督微调', s: '数十万–数百万条', data: '人工或强模型生成的 (指令, 优质回答) 对，包括多轮对话、工具调用轨迹、长思维链。', obj: '只在“回答”部分算交叉熵。', cost: '很便宜。', out: '会按对话格式回答、会调工具。Kimi K3 从这个阶段开始做 MXFP4 量化感知训练。' },
    { t: '偏好对齐', s: 'RLHF / DPO', data: '对同一问题的两个回答，人类或 AI 标注哪个更好。', obj: 'RLHF：先训练奖励模型（Bradley-Terry），再用 PPO 最大化奖励，同时用 KL 约束不要偏离太远。DPO：一个闭式损失，直接用偏好对优化策略，不需要单独的奖励模型。', cost: '中等。', out: '更有帮助、更安全、风格更好。缺点是容易讨好用户、回答变长，以及奖励被“钻空子”（reward hacking）。' },
    { t: '强化学习 RLVR', s: '可验证奖励', data: '有标准答案的数学题、带单元测试的编程题、可自动检查的智能体任务（终端、浏览器、MCP 工具环境）。', obj: 'GRPO 等策略梯度：一组采样答案互相比较，答对的加强，答错的削弱（' + A.cref('rl') + '）。', cost: '2025 年后迅速上升，前沿模型的 RL 算力已接近预训练的同一数量级。', out: '长思维链、自我检查、多步工具调用能力。' },
    { t: '蒸馏 / 小模型', s: '大 → 小', data: '大模型生成的回答和推理轨迹。', obj: '离线蒸馏：在大模型的输出上做 SFT。在线策略蒸馏（on-policy distillation）：小模型自己生成，大模型逐 token 打分（最小化反向 KL），比离线蒸馏更不容易出现分布偏移。', cost: '便宜。', out: 'Flash、mini 等版本。R1 蒸馏版让 7B 小模型也有了长思维链。' },
  ];
  const pipe = A.el('div', { class: 'pipe' }); bd.append(pipe);
  const card = A.el('div', { class: 'card' }); bd.append(card);
  const btns = ST.map((s, i) => { const b = A.el('button', { onclick: () => sel(i) }, s.t, A.el('small', null, s.s)); pipe.append(b); return b; });
  function sel(i) {
    btns.forEach((b, j) => b.classList.toggle('on', i === j));
    const s = ST[i];
    card.innerHTML = `<div class="t">${i + 1}. ${s.t}</div><table style="margin:6px 0 0"><tr><th>数据</th><td>${s.data}</td></tr><tr><th>目标</th><td>${s.obj}</td></tr><tr><th>代价</th><td>${s.cost}</td></tr><tr><th>得到</th><td>${s.out}</td></tr></table>`;
  }
  sel(0);
});
