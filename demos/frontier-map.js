/* frontier-map — interactive demo (moved from ch14-frontier.html) */
A.defineDemo('frontier-map', function (mount) {
  const { bd } = A.demo(mount, '前沿方向（按领域筛选）', '');
  const T = { arch: ['架构', 1], train: ['训练', 2], post: ['后训练与推理', 3], eff: ['效率与系统', 4], gen: ['多模态生成', 5], world: ['世界模型与新范式', 7] };
  const C = [
    { t: 'arch', h: '混合线性注意力', q: '1M 上下文下，KV cache 和 O(n²) 计算太贵。', a: '大部分层换成固定状态的线性注意力（Delta rule + 门控），每隔几层保留一层全注意力。', w: 'Kimi Linear / KDA（2025-10）；Qwen3-Next、Qwen3.5（Gated DeltaNet）；Nemotron 3（Mamba-2 混合）；Kimi K3：69 层 KDA + 24 层 Gated MLA，百万上下文时解码吞吐最高约 6×。', ch: 'long-context' },
    { t: 'arch', h: '稀疏与压缩注意力', q: '保留 softmax 的精确检索能力，同时降低长上下文成本。', a: '先压缩 KV（多 token 合一），再让每个 query 只看 top-k。', w: 'DeepSeek V3.2 DSA（2025-09）；DeepSeek V4 CSA + HCA：1M 时单 token FLOPs 为 V3.2 的 27%、KV 为 10%。', ch: 'long-context' },
    { t: 'arch', h: '改造残差连接', q: '近百层的超深 MoE 中，信息只能逐层往上传。', a: '多条残差流 + 可学习的混合；或让每层直接从任意早期层取表示。', w: 'DeepSeek V4 mHC（流形约束超连接）；Kimi K3 Attention Residuals。', ch: 'transformer' },
    { t: 'arch', h: '超细粒度 MoE', q: '在算力不变的前提下继续增加知识容量。', a: '专家切得更小、更多（数百到近千个），在潜空间路由，改进负载均衡。', w: 'Kimi K3：896 选 16 + 2 共享，Stable LatentMoE，称缩放效率较 K2 提升约 2.5×；Qwen3-Next 512 选 10。', ch: 'moe' },
    { t: 'train', h: '新优化器：Muon', q: 'AdamW 在万亿参数规模下不够稳定、效率不够高。', a: '对动量矩阵做正交化（Newton-Schulz 迭代），配合 QK-Clip 等防止 logit 爆炸。', w: 'Moonlight → Kimi K2 MuonClip（2025，1T 参数无 loss spike）；DeepSeek V4 采用 Muon。', ch: 'scaling' },
    { t: 'train', h: 'FP4 训练与量化感知训练', q: '推理想用 4 位，又不想有精度损失。', a: '训练时就用低精度前向（伪量化 + STE），或者直接用 NVFP4/MXFP4 做预训练。', w: 'Kimi K3：从 SFT 起 MXFP4 权重 + MXFP8 激活；DeepSeek V4：专家 FP4 QAT；NVIDIA：12B 模型 NVFP4 预训练 10T token。', ch: 'quantization' },
    { t: 'train', h: '数据：合成、多模态、智能体轨迹', q: '高质量人类文本接近用尽。', a: '强模型生成并经验证器过滤的合成数据；视频、图像数据；智能体在环境中的交互轨迹。', w: 'DeepSeek V4 预训练 32T+ token；各家大量使用合成推理数据和工具调用数据。', ch: 'data' },
    { t: 'post', h: 'RL 规模化与智能体 RL', q: '如何让模型可靠地完成长链条的真实任务。', a: '在沙盒终端、浏览器、MCP 工具环境里大规模异步 rollout，以任务是否完成作为奖励。', w: 'Kimi K3：Terminal-Bench 2.1 88.3%、BrowseComp 91.2%、MCPMark 94.5%；智能体评测成为主战场。', ch: 'rl' },
    { t: 'post', h: '在线策略蒸馏', q: 'RL 的奖励太稀疏，样本效率低。', a: '学生模型自己采样，教师逐 token 打分（反向 KL），信号密集。', w: '据报道 DeepSeek V4 的后训练以在线策略蒸馏为主；Flash / mini 系列普遍使用。', ch: 'distillation' },
    { t: 'post', h: '推理时算力', q: '同一个模型，多花推理算力能换多少准确率。', a: '更长的思维链、并行多路思考再汇总、验证器挑选、自适应决定想多久。', w: 'Gemini Deep Think 等并行思考；Exploratory Sampling（2026）等提升采样多样性的解码方法。', ch: 'reasoning' },
    { t: 'eff', h: '1-bit / 三值与端侧模型', q: '在手机和消费级显卡上跑足够聪明的模型。', a: 'Hadamard 旋转消除离群值 + 三值 / 二值量化；或从头做低位 QAT。', w: 'PrismML 1-bit Bonsai（2026-03，8B 占 1.15 GB）、Ternary Bonsai 2 27B（1.76 bpw，5.9 GB）；腾讯 HY-1.8B-2Bit；Gemma QAT。', ch: 'quantization' },
    { t: 'eff', h: 'FP4 推理与缩放优化', q: 'FP4 的块缩放太粗，误差偏大。', a: '更好地选择块缩放（Hessian 引导、自适应 4/6 缩放）、旋转、残差通道。', w: 'Four over Six、SOAR、ScaleSweep、H-Scale、FOCUS 等 2026 年论文；DeepSeek-R1 NVFP4 与 FP8 相差约 1%。', ch: 'quantization' },
    { t: 'eff', h: 'P/D 分离、宽 EP 与 KV 分层', q: '大 MoE + 长上下文的服务成本。', a: 'prefill 与 decode 分池；数十张卡做专家并行；KV 在显存 / 内存 / SSD 之间分层缓存。', w: 'vLLM / SGLang / Dynamo P/D 分离（单机 goodput 2.5×）；Mooncake；Kimi K3 建议 ≥64 卡超节点部署。', ch: 'serving' },
    { t: 'eff', h: '投机解码与 MTP', q: 'decode 受带宽限制，算力闲置。', a: '草稿头预测多个 token，大模型一次验证。', w: 'EAGLE-3、P-EAGLE（并行起草）；MTP 头（DeepSeek）；社区给 Bonsai 2 加 MTP 头，decode +24.5%。', ch: 'serving' },
    { t: 'gen', h: '原生全模态', q: '把文本、图像、视频、音频的理解和生成放进同一个模型。', a: '统一 token 序列；自回归主干 + 扩散解码头；多模态输入原生支持。', w: 'Meta Muse Spark Open（原生文本 / 图像 / 视频 / 音频输入）；Gemini Omni；HunyuanImage 3.0；BAGEL。', ch: 'vlm' },
    { t: 'gen', h: '图像：编辑、参考与文字', q: '用户要的是“照我说的改”，而且要保持人物和品牌的一致性。', a: '上下文内编辑、多参考图合成、强文本编码器。', w: 'GPT Image 2、Nano Banana Pro / 2（14 张参考、4K）、Seedream 5.0、FLUX.2、Qwen-Image-2.0。', ch: 'image' },
    { t: 'gen', h: '视频：音视频联合与多镜头', q: '生成能直接用的成片：对白、音效、口型、镜头切换。', a: '统一的音视频联合 DiT；大量参考输入；更长时长与更高分辨率。', w: 'Seedance 2.0 / 2.5、Kling 3.0（原生 4K）、Veo 3.1 / Gemini Omni Flash、Wan 3.0；Sora 于 2026-09 关停。', ch: 'video' },
    { t: 'world', h: '交互式世界模型', q: '实时、可控、长时间保持一致的生成世界。', a: '动作条件的自回归视频扩散 + 少步蒸馏 + 长时记忆机制。', w: 'Genie 3 / Project Genie；Matrix-Game 3.5（Patch Memory）；Waymo World Model；NVIDIA Cosmos 3；World Labs Marble。', ch: 'world-models' },
    { t: 'world', h: '扩散语言模型', q: '自回归一次一个 token，太慢且无法回头修改。', a: '把文本生成也做成并行去噪；与线性注意力结合以支持长上下文。', w: 'LLaDA 2.x（最大 100B）、Gemini Diffusion、Mercury；block-hybrid 线性注意力 dLLM 解码吞吐 1.7×（2026）。', ch: 'generation' },
    { t: 'world', h: '持续学习与记忆', q: '模型部署后无法学习新知识。', a: '外部记忆、记忆层、测试时训练、上下文工程与智能体记忆系统。', w: '被普遍预测为 2027 年前后的重点；DeepSeek 的 Engram 条件记忆曾被传闻用于 V4，但最终未出现在 V4 中。', ch: 'distillation' },
  ];
  let filt = 'all';
  const chips = A.el('div', { class: 'chips' }); bd.append(chips);
  const grid = A.el('div', { class: 'fgrid' }); bd.append(grid);
  const all = [['all', '全部', 0], ...Object.entries(T).map(([k, v]) => [k, v[0], v[1]])];
  const chipEls = all.map(([k, n, c]) => { const b = A.el('button', { class: 'chip' + (k === filt ? ' on' : ''), onclick: () => { filt = k; render(); } }, c ? A.el('span', { class: 'dot', style: { background: `var(--s${c})` } }) : null, n); chips.append(b); return [k, b]; });
  function render() {
    chipEls.forEach(([k, b]) => b.classList.toggle('on', k === filt));
    grid.innerHTML = '';
    C.filter((c) => filt === 'all' || c.t === filt).forEach((c) => {
      const tg = T[c.t];
      const ch = A.ch(c.ch);
      grid.append(A.el('div', { class: 'fcard', style: { borderTop: `3px solid var(--s${tg[1]})` } },
        A.el('div', { class: 'tg', style: { color: 'var(--ink-2)' } }, tg[0]),
        A.el('h3', null, c.h),
        A.el('dl', null, A.el('dt', null, '要解决的问题'), A.el('dd', null, c.q), A.el('dt', null, '主流做法'), A.el('dd', null, c.a), A.el('dt', null, '代表工作'), A.el('dd', null, c.w)),
        A.el('div', { class: 'small', style: { marginTop: '8px' } }, A.el('a', { href: ch.f }, '→ ' + A.chLabel(ch) + ' · ' + ch.t))));
    });
  }
  render();
});
