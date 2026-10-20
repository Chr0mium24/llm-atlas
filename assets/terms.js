/* LLM Atlas — concept registry for hover definitions and the glossary.
   id: { t: 中文名, en: English, d: 一两句定义（数学用 \( \)，会被 KaTeX 渲染）, at: 'slug#anchor' (where it is defined) }
   Mark the defining occurrence with <dfn data-t="id">…</dfn> and later uses with <span class="term" data-t="id">…</span>.
   If the defining chapter has not been rewritten yet (no <dfn> there), clicks go to the glossary entry instead. */
window.ATLAS_TERMS = {
  // ---- basics used across chapters
  'cross-entropy': { t: '交叉熵', en: 'cross-entropy', d: String.raw`\(-\log p(\text{正确答案})\)：模型给正确答案的概率越高，交叉熵越小。语言模型预训练和 SFT 的损失函数。`, at: 'generation#ar' },
  'exposure-bias': { t: '暴露偏差', en: 'exposure bias', d: '训练时模型总看到正确的前文，推理时却要接着自己写的、可能出错的前文往下写；它从没练过“写错之后怎么办”。', at: 'rl#why' },

  // ---- tokens.html
  oov: { t: '未登录词', en: 'out-of-vocabulary (OOV)', d: '词表里没有的词。按词分词时只能把它替换成一个“未知”符号，信息就丢了。子词和字节级分词消除了这个问题。', at: 'tokens#why' },
  subword: { t: '子词分词', en: 'subword tokenization', d: '常见片段整体作为一个 token，罕见词拆成几块，最坏退回单个字节。在序列长度和词表大小之间折中。', at: 'tokens#why' },
  token: { t: 'token', en: 'token', d: '分词切出的基本单位，可能是一个词、半个词、几个字或一个字节。每个 token 有一个整数编号。', at: 'tokens#why' },
  vocab: { t: '词表', en: 'vocabulary', d: String.raw`所有可能的 token 的集合，大小记作 \(V\)，2026 年的大模型通常在 10 万到 26 万之间。`, at: 'tokens#why' },
  fertility: { t: '切分率（fertility）', en: 'fertility', d: '平均每个词（或字）被切成几个 token。越低越省；同一个分词器对不同语言差别很大。', at: 'tokens#why' },
  bpe: { t: 'BPE', en: 'byte pair encoding', d: '从单个字符或字节开始，反复把语料中出现次数最多的相邻一对合并成新 token，直到词表达到目标大小。本质是贪心压缩。', at: 'tokens#bpe' },
  utf8: { t: 'UTF-8', en: 'UTF-8', d: '最常用的文本编码：ASCII 字符占 1 个字节，大部分欧洲文字 2 个，汉字 3 个，emoji 4 个。', at: 'tokens#bytes' },
  'byte-bpe': { t: '字节级 BPE', en: 'byte-level BPE', d: '以 256 种字节为起始符号做 BPE（GPT-2 起）。任何文本都能编码，没有未登录词；代价是非拉丁文字可能占多个 token。', at: 'tokens#bytes' },
  'unigram-lm': { t: 'Unigram 分词', en: 'unigram language model tokenization', d: String.raw`给每个 token 一个概率 \(p(x)\)，在一句话所有可能的切法里选 \(\sum_i \log p(x_i)\) 最大的那种（Viterbi 算法）。`, at: 'tokens#unigram' },
  'subword-reg': { t: '子词正则化', en: 'subword regularization', d: '训练时不总用最优切法，而按概率随机采样一种切法，让模型见过同一个词的多种切法，更稳健。', at: 'tokens#unigram' },
  'special-token': { t: '特殊 token', en: 'special token', d: '不对应普通文字的控制符号：文本开始 / 结束、对话角色、思维链边界、工具调用、图像占位等。', at: 'tokens#vocab' },
  'chat-template': { t: '聊天模板', en: 'chat template', d: '把一段对话按固定格式插入特殊 token（系统、用户、助手、工具……）后拼成一条序列。用错模板，模型表现会明显下降。', at: 'tokens#vocab' },
  'embedding-matrix': { t: '嵌入矩阵', en: 'embedding matrix', d: String.raw`形状 \(V\times d\) 的参数矩阵 \(E\)，第 \(i\) 行是编号为 \(i\) 的 token 的向量。和其它参数一起训练。`, at: 'tokens#embed' },
  embedding: { t: '嵌入（向量）', en: 'embedding', d: String.raw`一个 token 对应的 \(d\) 维向量，即嵌入矩阵的一行。训练后意思相近的 token，嵌入的方向也相近。`, at: 'tokens#embed' },
  'one-hot': { t: '独热向量', en: 'one-hot vector', d: String.raw`长度为 \(V\)、只有第 \(i\) 位是 1、其余都是 0 的向量。用它乘嵌入矩阵，等于取出第 \(i\) 行。`, at: 'tokens#embed' },
  cosine: { t: '余弦相似度', en: 'cosine similarity', d: String.raw`\(\cos(\mathbf u,\mathbf v) = \frac{\mathbf u\cdot\mathbf v}{\|\mathbf u\|\|\mathbf v\|}\)，只看两个向量的方向是否一致，取值在 −1 到 1 之间。`, at: 'tokens#embed' },
  distributional: { t: '分布假说', en: 'distributional hypothesis', d: '一个词的意思由它出现的上下文决定。出现在相似上下文里的词，意思相近。词向量和语言模型都建立在这个假设上。', at: 'tokens#meaning' },
  pmi: { t: '点互信息（PMI）', en: 'pointwise mutual information', d: String.raw`\(\mathrm{PMI}(w,c) = \log\frac{p(w,c)}{p(w)\,p(c)}\)：两个词一起出现的频率，比各自独立时偶然相遇的频率高多少倍（取对数）。`, at: 'tokens#meaning' },
  logit: { t: 'logit', en: 'logit', d: String.raw`模型对每个候选 token 给出的未归一化分数 \(z_i\)。经过 softmax 才变成概率；所有 logit 同加一个常数，概率不变。`, at: 'tokens#output' },
  softmax: { t: 'softmax', en: 'softmax', d: String.raw`把一组任意实数分数 \(z_1,\dots,z_n\) 变成和为 1 的概率：\(p_i = e^{z_i} / \sum_j e^{z_j}\)。分数越高，概率越大；所有分数同加一个常数，结果不变。`, at: 'tokens#output' },
  'tied-embeddings': { t: '共享嵌入', en: 'tied embeddings', d: String.raw`让输出矩阵直接复用输入的嵌入矩阵（\(W = E\)），省下 \(Vd\) 个参数。小模型常用，大模型通常不共享。`, at: 'tokens#output' },

  // ---- reinforcement learning (rl.html)
  agent: { t: '智能体（RL）', en: 'agent', d: '做决定的一方。在语言模型的 RL 里，智能体就是模型本身。', at: 'rl#rl0-game' },
  environment: { t: '环境', en: 'environment', d: '接收智能体的动作、给出新状态和奖励的一方：按钮游戏里的按钮，数学题的判分程序，智能体任务里的沙盒。', at: 'rl#rl0-game' },
  policy: { t: '策略', en: 'policy', d: String.raw`智能体在每个状态下选择各个动作的概率分布 \(\pi_\theta(a\mid s)\)。语言模型给出下一个 token 的分布，它本身就是策略。`, at: 'rl#rl0-game' },
  reward: { t: '奖励', en: 'reward', d: String.raw`环境在某个动作或一局结束之后给出的分数 \(R\)。RL 只靠它来学习，没有标准答案。`, at: 'rl#rl0-game' },
  objective: { t: '期望奖励', en: 'expected reward', d: String.raw`\(J(\theta) = \mathbb E_{a\sim\pi_\theta}[R(a)]\)：按当前策略行动，平均能拿多少分。RL 的目标是让它最大。`, at: 'rl#rl0-game' },
  'policy-gradient': { t: '策略梯度', en: 'policy gradient', d: String.raw`\(\nabla_\theta J = \mathbb E\big[R\,\nabla_\theta\log\pi_\theta(a)\big]\)：采样一个动作，按它的得分把它的对数概率往上推。最早的形式叫 REINFORCE（1992）。`, at: 'rl#rl0-pg' },
  baseline: { t: '基线', en: 'baseline', d: String.raw`从奖励里减去的参考值 \(b\)，通常取平均得分。它不改变梯度的期望，但能大幅降低梯度估计的方差。`, at: 'rl#rl0-baseline' },
  advantage: { t: '优势', en: 'advantage', d: String.raw`\(A = R - b\)：这个动作（或这条回答）比平均水平好多少。正的就加强，负的就削弱。`, at: 'rl#rl0-baseline' },
  'gradient-variance': { t: '梯度估计的方差', en: 'variance of the gradient estimate', d: '用少量样本估计梯度时，每次估计结果的波动大小。方差大，训练就慢、不稳定。', at: 'rl#rl0-baseline' },
  entropy: { t: '熵（策略的）', en: 'entropy', d: String.raw`\(H(\pi) = -\sum_a \pi(a)\log\pi(a)\)，衡量策略的随机程度：完全均匀时最大，总选同一个动作时为 0。`, at: 'rl#rl0-entropy' },
  exploration: { t: '探索与利用', en: 'exploration vs. exploitation', d: '利用：选目前看来最好的动作；探索：尝试其它动作，看会不会更好。只利用不探索，可能永远发现不了更好的选择。', at: 'rl#rl0-entropy' },
  'entropy-collapse': { t: '熵塌缩', en: 'entropy collapse', d: '训练中策略的熵过早地降到接近 0：模型几乎总做同一种选择，停止探索。', at: 'rl#rl0-entropy' },
  state: { t: '状态', en: 'state', d: String.raw`智能体做决定时能看到的全部信息 \(s_t\)。语言模型里是题目加上已经生成的前缀。`, at: 'rl#rl0-steps' },
  trajectory: { t: '轨迹', en: 'trajectory / episode', d: '从开始到结束的一整局：状态、动作、奖励交替组成的序列。语言模型里就是一条完整的回答。', at: 'rl#rl0-steps' },
  rollout: { t: '采样（rollout）', en: 'rollout', d: '让当前策略实际跑一局、生成轨迹。在语言模型里就是让模型生成回答，通常占 RL 算力的一半左右。', at: 'rl#rl0-steps' },
  return: { t: '回报', en: 'return', d: String.raw`从第 \(t\) 步到结束拿到的奖励之和 \(G_t = \sum_{k\ge t}\gamma^{k-t} r_k\)。语言模型通常只在最后给一次奖励、取 \(\gamma = 1\)，回报就是那一个分数。`, at: 'rl#rl0-steps' },
  credit: { t: '功劳分配', en: 'credit assignment', d: '最后的奖励该归功于哪些动作。一盘棋走了 60 步才分胜负，哪几步是好棋？', at: 'rl#rl0-steps' },
  value: { t: '价值函数', en: 'value function', d: String.raw`\(V(s)\)：从状态 \(s\) 出发、按当前策略继续行动，平均能拿多少回报。\(Q(s,a)\) 则是先做动作 \(a\) 再继续的平均回报。`, at: 'rl#rl0-steps' },
  critic: { t: '价值网络（critic）', en: 'critic', d: String.raw`学习价值函数 \(V(s)\) 的神经网络，用来给每一步估计优势。和它配合、负责选动作的策略叫 actor。`, at: 'rl#rl0-steps' },
  gae: { t: 'GAE', en: 'generalized advantage estimation', d: String.raw`用价值网络逐步估计优势：TD 误差 \(\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)\) 按 \((\gamma\lambda)^l\) 加权累加，\(\lambda\) 在偏差和方差之间折中。`, at: 'rl#rl0-steps' },
  'on-policy': { t: '同策略', en: 'on-policy', d: '用当前策略自己采的样本来更新当前策略。策略梯度公式默认就是同策略。', at: 'rl#rl0-offpolicy' },
  'off-policy': { t: '离策略', en: 'off-policy', d: '用另一个策略（比如几步之前的旧策略）采的样本来更新当前策略，需要重要性采样来修正。', at: 'rl#rl0-offpolicy' },
  'importance-sampling': { t: '重要性采样', en: 'importance sampling', d: String.raw`用分布 \(q\) 的样本估计分布 \(p\) 下的期望：每个样本乘上权重 \(p(x)/q(x)\)。两个分布差得越远，权重越不均匀，估计越不稳定。`, at: 'rl#rl0-offpolicy' },
  kl: { t: 'KL 散度', en: 'Kullback–Leibler divergence', d: String.raw`\(D_{\text{KL}}(p\,\|\,q) = \sum_x p(x)\log\frac{p(x)}{q(x)}\)，衡量两个分布差多少：恒 \(\ge 0\)，两者相同时为 0，不对称。`, at: 'rl#rl0-offpolicy' },
  'trust-region': { t: '信任域', en: 'trust region', d: '只在离当前策略不远（KL 小）的范围内更新，因为离得越远，用旧样本估计的梯度越不可信。TRPO、PPO 的核心思想。', at: 'rl#rl0-offpolicy' },
  ess: { t: '有效样本量', en: 'effective sample size (ESS)', d: String.raw`\(\text{ESS} = (\sum_i w_i)^2 / \sum_i w_i^2\)：一批带权重的样本相当于多少个等权样本。权重越不均匀，ESS 越小。`, at: 'rl#rl0-offpolicy' },
  ratio: { t: '重要性比率', en: 'importance ratio', d: String.raw`\(r_t = \pi_\theta(y_t) / \pi_{\text{old}}(y_t)\)：当前策略和采样时的策略给同一个 token 的概率之比。`, at: 'rl#ppo' },
  clip: { t: '裁剪（PPO）', en: 'clipping', d: String.raw`把重要性比率限制在 \([1-\epsilon,\, 1+\epsilon]\) 内：一个 token 已经被往对的方向推够了，就不再给它梯度。`, at: 'rl#ppo' },
  ppo: { t: 'PPO', en: 'proximal policy optimization', d: '2017 年的策略梯度算法：重要性采样 + 裁剪 + 价值网络。此后七年 RL 微调的默认算法。', at: 'rl#ppo' },
  rlhf: { t: 'RLHF', en: 'reinforcement learning from human feedback', d: '用人类偏好训练奖励模型，再用 RL 优化语言模型。InstructGPT 和 ChatGPT 的做法。', at: 'sft#rm' },
  grpo: { t: 'GRPO', en: 'group relative policy optimization', d: String.raw`每道题采样一组 \(G\) 个回答，用组内平均奖励当基线，去掉价值网络。DeepSeekMath（2024）提出，R1 用它训练。`, at: 'rl#grpo' },
  rlvr: { t: 'RLVR', en: 'RL with verifiable rewards', d: '只在能自动判断对错的任务上做 RL：数学比对答案、代码跑测试、智能体检查终态。', at: 'rl#reward' },
  'reward-hacking': { t: '钻奖励空子', en: 'reward hacking', d: '模型找到了提高奖励、却不真正完成任务的办法，比如写得更长讨好评分模型、修改单元测试。', at: 'rl#reward' },
  passk: { t: 'pass@k', en: 'pass@k', d: String.raw`每道题采样 \(k\) 次，至少一次答对就算解出。\(k = 1\) 看“一次做对”，\(k\) 很大时看能力的边界。`, at: 'rl#debate' },

  // ---- attention (attention.html)
  rnn: { t: '循环神经网络', en: 'recurrent neural network (RNN)', d: String.raw`从左到右逐个读 token，每一步用当前 token 更新一个固定大小的隐藏状态：\(\mathbf h_t = \tanh(W\mathbf h_{t-1} + U\mathbf x_t)\)。LSTM、GRU 是加了门控的改进版。`, at: 'attention#before' },
  'vanishing-grad': { t: '梯度消失', en: 'vanishing gradient', d: '梯度要经过很多次连乘才能传到前面的层或前面的时间步；每次乘的因子小于 1 时，梯度指数级衰减，前面的部分几乎学不到东西。', at: 'attention#before' },
  'attention-mech': { t: '注意力', en: 'attention', d: '对每个位置算一个相关度，按相关度把各位置的信息加权平均。2014 年用于机器翻译，2017 年成为 Transformer 的核心。', at: 'attention#before' },
  'self-attention': { t: '自注意力', en: 'self-attention', d: '序列内部的注意力：query、key、value 都来自同一个序列，每个位置去看同一序列中的其它位置。', at: 'attention#before' },
  'attn-query': { t: 'query（查询）', en: 'query', d: String.raw`\(\mathbf q = \mathbf x W_Q\)：一个位置“在找什么样的信息”。和每个 key 做点积，得到相关度分数。`, at: 'attention#qkv' },
  'attn-key': { t: 'key（键）', en: 'key', d: String.raw`\(\mathbf k = \mathbf x W_K\)：一个位置“有什么样的信息”，供 query 匹配。`, at: 'attention#qkv' },
  'attn-value': { t: 'value（值）', en: 'value', d: String.raw`\(\mathbf v = \mathbf x W_V\)：一个位置被关注时“交出去的内容”。注意力输出是 value 的加权平均。`, at: 'attention#qkv' },
  'multi-head': { t: '多头注意力', en: 'multi-head attention', d: String.raw`把 \(d\) 维切成 \(h\) 个 \(d/h\) 维的头，各自独立做注意力，结果拼接后乘 \(W_O\)。参数量和单个 \(d\) 维的头相同。`, at: 'attention#multihead' },
  'causal-mask': { t: '因果掩码', en: 'causal mask', d: String.raw`softmax 之前把“后面位置”的分数设为 \(-\infty\)，使每个位置只能看到自己和前面的 token。生成模型必须用它。`, at: 'attention#causal' },
  'cross-attention': { t: '交叉注意力', en: 'cross-attention', d: 'query 来自一个序列，key 和 value 来自另一个序列。翻译模型的解码器用它读原句，文生图模型用它读提示词。', at: 'attention#causal' },
  'induction-head': { t: '归纳头', en: 'induction head', d: '一种两层配合的注意力电路：看到 A 时，找到上文中 A 之后出现过的 B，把它复制为预测。与上下文学习能力的出现同步形成。', at: 'attention#patterns' },
  icl: { t: '上下文学习', en: 'in-context learning (ICL)', d: '不更新参数，只在提示词里给几个示例，模型就能完成新任务。few-shot 提示依赖这种能力。', at: 'attention#patterns' },
  'attention-sink': { t: '注意力汇', en: 'attention sink', d: '很多注意力头把大量权重放在第一个 token 上。softmax 的权重和必须为 1，没什么要看时多余的权重要有个去处。', at: 'attention#patterns' },

  // ---- transformer (transformer.html)
  'decoder-only': { t: '只有解码器', en: 'decoder-only', d: '只用带因果掩码的自注意力、任务统一为“预测下一个 token”的 Transformer。GPT 系列及几乎所有当今大语言模型都是这种结构。', at: 'transformer#why' },
  block: { t: 'Transformer 块', en: 'Transformer block', d: String.raw`模型重复堆叠的基本单元：\(\mathbf h = \mathbf x + \operatorname{Attn}(\operatorname{Norm}(\mathbf x))\)，\(\mathbf x' = \mathbf h + \operatorname{MLP}(\operatorname{Norm}(\mathbf h))\)。`, at: 'transformer#why' },
  residual: { t: '残差连接', en: 'residual connection', d: String.raw`子层只输出一个修改量，加回输入：\(\mathbf x_{l+1} = \mathbf x_l + F(\mathbf x_l)\)。反向传播时梯度有一条不衰减的直通路径。`, at: 'transformer#residual' },
  'residual-stream': { t: '残差流', en: 'residual stream', d: '每个位置上贯穿所有层的那条向量。注意力和 MLP 从中读取信息、把结果加回去，所有层共享这条“总线”。', at: 'transformer#residual' },
  ffn: { t: '前馈网络（MLP）', en: 'feed-forward network', d: String.raw`每个块的第二个子层，对每个位置独立计算：\(\phi(\mathbf xW_1)W_2\)，先升维到约 \(4d\)、过激活函数、再降回 \(d\)。约占每层参数的三分之二。`, at: 'transformer#mlp' },
  swiglu: { t: 'SwiGLU', en: 'SwiGLU', d: String.raw`带门控的 MLP：\((\operatorname{SiLU}(\mathbf xW_1)\odot \mathbf xW_3)\,W_2\)。三个矩阵，中间维度约 \(\tfrac83 d\)。2023 年起的标准。`, at: 'transformer#mlp' },
  layernorm: { t: '层归一化', en: 'LayerNorm', d: String.raw`对每个位置的向量减去均值、除以标准差，再乘可学习的系数：\(\mathbf g\odot(\mathbf x-\mu)/\sigma + \mathbf b\)。`, at: 'transformer#norm' },
  rmsnorm: { t: 'RMSNorm', en: 'RMSNorm', d: String.raw`只除以均方根的归一化：\(\mathbf g\odot\mathbf x/\sqrt{\tfrac1d\sum_i x_i^2}\)。比 LayerNorm 省，效果相当，是现在的标准。`, at: 'transformer#norm' },
  'pre-norm': { t: 'Pre-Norm', en: 'pre-normalization', d: String.raw`只对子层的输入做归一化，残差路径不经过归一化：\(\mathbf x + F(\operatorname{Norm}(\mathbf x))\)。训练稳定，但残差流会随层数变长。`, at: 'transformer#norm' },
  'perm-equiv': { t: '置换等变', en: 'permutation equivariance', d: '把输入的顺序打乱，输出只是同样地被打乱，数值不变。不带位置信息的注意力就是这样，因此分不清顺序。', at: 'transformer#position' },
  'pos-enc': { t: '位置编码', en: 'positional encoding', d: '向模型注入 token 顺序信息的方法：正弦编码、可学习的位置向量、相对位置偏置、RoPE 等。', at: 'transformer#position' },
  rope: { t: 'RoPE', en: 'rotary position embedding', d: String.raw`按位置旋转 query 和 key：第 \(i\) 个二维平面转 \(m\theta_i\)，\(\theta_i = b^{-2i/d}\)。旋转后点积只依赖相对位置 \(n-m\)。`, at: 'transformer#position' },
  flops: { t: 'FLOPs', en: 'floating-point operations', d: String.raw`浮点运算次数，一次乘加记 2 次。稠密模型前向每 token 约 \(2N\)，训练约 \(6N\)（\(N\) 为参数量）。注意与表示“每秒运算次数”的 FLOPS 区分。`, at: 'transformer#params' },

  // ---- generation (generation.html)
  autoregressive: { t: '自回归', en: 'autoregressive', d: String.raw`按 \(p(x_1,\dots,x_T) = \prod_t p(x_t\mid x_{<t})\) 从左到右逐个生成：每一步的输出成为下一步的输入。`, at: 'generation#ar' },
  'teacher-forcing': { t: 'teacher forcing', en: 'teacher forcing', d: '训练时每一步都输入真实的前缀，而不是模型自己生成的前缀。配合因果掩码，所有位置可以并行计算损失。', at: 'generation#ar' },
  perplexity: { t: '困惑度', en: 'perplexity', d: String.raw`交叉熵损失的指数 \(\exp(\mathcal L)\)：模型平均在多少个等可能的候选里犹豫。依赖分词方式，不同词表的模型不可直接比较。`, at: 'generation#ppl' },
  bpb: { t: '每字节比特数', en: 'bits per byte', d: String.raw`总损失换算成比特（除以 \(\ln 2\)）再除以文本的 UTF-8 字节数。与分词无关，可跨模型比较，也等于模型压缩这段文本的码长。`, at: 'generation#ppl' },
  ngram: { t: 'n-gram 模型', en: 'n-gram model', d: String.raw`假设下一个 token 只依赖前 \(n-1\) 个，用语料中的出现次数估计条件概率。受数据稀疏限制，上下文很短。`, at: 'generation#ngram' },
  greedy: { t: '贪心解码', en: 'greedy decoding', d: '每一步都选概率最高的 token。确定，但开放式生成时容易陷入重复。', at: 'generation#decode' },
  temperature: { t: '温度', en: 'temperature', d: String.raw`softmax 前把 logit 除以 \(T\)：\(p_i\propto e^{z_i/T}\)。\(T<1\) 分布变尖，\(T>1\) 变平，\(T\to 0\) 即贪心。`, at: 'generation#decode' },
  'top-k': { t: 'top-k 采样', en: 'top-k sampling', d: String.raw`只在概率最高的 \(k\) 个 token 中重新归一化后采样。`, at: 'generation#decode' },
  'top-p': { t: 'top-p 采样', en: 'nucleus / top-p sampling', d: String.raw`按概率从高到低累加，保留累计达到 \(p\) 的最小头部集合，在其中采样。候选数随分布形状自动伸缩。`, at: 'generation#decode' },
  'min-p': { t: 'min-p 采样', en: 'min-p sampling', d: String.raw`只保留概率不低于 \(p_{\min}\times p_{\max}\) 的 token。宣称在高温下更稳，但其优势在 2025 年的复查中受到质疑。`, at: 'generation#decode' },
  'beam-search': { t: '束搜索', en: 'beam search', d: String.raw`同时保留 \(b\) 条得分最高的部分序列，逐步扩展。适合翻译等答案确定的任务，开放式生成中会导致空洞重复。`, at: 'generation#decode' },
  'constrained-decoding': { t: '约束解码', en: 'constrained decoding', d: '每一步按语法（JSON Schema、正则等）屏蔽不合法的 token，保证输出一定能被解析。结构化输出和工具调用依赖它。', at: 'generation#constrained' },
  mtp: { t: '多 token 预测', en: 'multi-token prediction (MTP)', d: '训练时额外预测后面第 2、3 个 token，训练信号更密；推理时这些额外预测可作为投机解码的草稿。DeepSeek-V3 采用。', at: 'generation#beyond' },
  'diffusion-lm': { t: '扩散语言模型', en: 'diffusion language model', d: '从全部被遮住的序列出发，多轮并行地填写和修改各位置，而不是从左到右逐个生成。代表：LLaDA、Gemini Diffusion、Mercury。', at: 'generation#beyond' },
  calibration: { t: '校准', en: 'calibration', d: '模型给出的概率与实际正确率是否一致：说 70% 有把握的答案，是否大约 70% 是对的。后训练常使模型过度自信。', at: 'generation#myths' },

  // ---- data (data.html)
  'common-crawl': { t: 'Common Crawl', en: 'Common Crawl', d: '非营利组织自 2008 年起定期抓取全网并免费公开的网页存档，每次抓取数十亿网页，是绝大多数预训练语料的来源。', at: 'data#why' },
  jaccard: { t: 'Jaccard 相似度', en: 'Jaccard similarity', d: String.raw`两个集合交集大小除以并集大小：\(J(A,B) = |A\cap B|/|A\cup B|\)，0 到 1。去重时 A、B 是两篇文档的片段集合。`, at: 'data#dedup' },
  minhash: { t: 'MinHash', en: 'MinHash', d: String.raw`用随机哈希函数取集合的最小哈希值作为签名：两个集合最小值相等的概率恰好是它们的 Jaccard 相似度。配合 LSH 分桶，可在数十亿文档中快速找到近似重复。`, at: 'data#dedup' },
  'quality-classifier': { t: '质量分类器', en: 'quality classifier', d: '给每篇文档打分、只保留高分文档的小模型。正例可以是“像维基百科”“像优质问答”，或由大模型按教育价值标注（FineWeb-Edu）。', at: 'data#quality' },
  'data-mixture': { t: '数据配比', en: 'data mixture', d: '网页、代码、数学、论文、书籍、多语言等各类数据在训练中所占的比例。通常在小模型上搜索后外推到大模型。', at: 'data#mixture' },
  'mid-training': { t: '中期训练（退火）', en: 'mid-training / annealing', d: '预训练末段学习率降到接近 0 时，换用质量最高的数据（数学、代码、合成推理和智能体数据）。对最终能力影响很大。', at: 'data#mixture' },
  'synthetic-data': { t: '合成数据', en: 'synthetic data', d: '由模型生成的训练数据：改写网页、生成教科书和习题、蒸馏推理过程等。2024 年后成为预训练的重要组成部分。', at: 'data#synthetic' },
  rephrasing: { t: '改写', en: 'rephrasing', d: '让模型把已有文本改写成问答、百科、要点等不同形式。不增加新信息，但让知识以多种形式出现，更容易被模型存成可检索的形式。', at: 'data#synthetic' },
  'model-collapse': { t: '模型崩溃', en: 'model collapse', d: '递归地只用前代模型生成的数据训练，分布的长尾逐代消失，最终塌缩成少数模式。保留并累积真实数据可以避免。', at: 'data#synthetic' },
  'data-wall': { t: '数据墙', en: 'data wall', d: '公开的高质量人类文本约 300 万亿 token，按现有趋势将在 2026–2032 年间用完（Epoch AI 估计）。', at: 'data#limits' },
  memorization: { t: '记忆（训练数据）', en: 'memorization', d: '模型逐字背下并能复现部分训练数据。随模型规模、数据重复次数和提示长度增长，去重可显著缓解。', at: 'data#limits' },

  // ---- scaling (scaling.html)
  'power-law': { t: '幂律', en: 'power law', d: String.raw`\(y = Kx^{-\alpha}\)：在双对数坐标里是斜率为 \(-\alpha\) 的直线。\(x\) 增加 10 倍，\(y\) 变为 \(10^{-\alpha}\) 倍。`, at: 'scaling#powerlaw' },
  'scaling-law': { t: '规模定律', en: 'scaling law', d: String.raw`损失随参数量、数据量、算力按幂律下降的经验规律，例如 \(L(N,D) = E + A/N^\alpha + B/D^\beta\)。用于从小规模实验外推大模型的表现。`, at: 'scaling#powerlaw' },
  'irreducible-loss': { t: '不可约损失', en: 'irreducible loss', d: String.raw`规模定律中的常数项 \(E\)：数据本身的熵，无论模型多大、数据多多都消不掉。`, at: 'scaling#powerlaw' },
  overtraining: { t: '过度训练', en: 'overtraining', d: '用远超训练算力最优值的数据训练较小的模型（如 Llama 3 8B 用 15T token，约每参数 1900 个）。训练多花算力，换来推理更便宜。', at: 'scaling#chinchilla' },
  emergence: { t: '涌现', en: 'emergent abilities', d: '某些任务的表现在模型达到一定规模后看似突然出现。很大程度上可由不连续的评分方式解释（如精确匹配）。', at: 'scaling#emergence' },
  adam: { t: 'Adam', en: 'Adam optimizer', d: String.raw`维护梯度的滑动平均 \(\mathbf m\) 和梯度平方的滑动平均 \(\mathbf v\)，按 \(\hat{\mathbf m}/\sqrt{\hat{\mathbf v}}\) 更新：动量 + 逐参数自适应步长。每个参数多存两份状态。`, at: 'scaling#optim' },
  adamw: { t: 'AdamW', en: 'AdamW', d: '把权重衰减从梯度中解耦、直接作用于参数的 Adam。2017 年起大模型训练的默认优化器。', at: 'scaling#optim' },
  wsd: { t: 'WSD 调度', en: 'warmup-stable-decay schedule', d: '学习率先预热、再长时间保持恒定、最后 10–20% 快速衰减。可从稳定阶段任意分叉出衰减，便于测规模定律、延长训练和在衰减段换数据。', at: 'scaling#optim' },
  svd: { t: '奇异值分解', en: 'singular value decomposition (SVD)', d: String.raw`任意矩阵 \(M = U\Sigma V^\top\)：先旋转（\(V^\top\)），再沿各轴按奇异值 \(\sigma_i\ge 0\) 缩放（\(\Sigma\)），再旋转（\(U\)）。最大奇异值即谱范数。`, at: 'scaling#muon' },
  muon: { t: 'Muon', en: 'Muon optimizer', d: String.raw`对隐藏层权重的动量矩阵做正交化后更新：\(W\leftarrow W - \eta\,UV^\top\)，所有奇异方向等幅更新；用牛顿-舒尔茨迭代近似。2025–26 年被 Kimi K2、GLM-4.5、DeepSeek V4 采用。`, at: 'scaling#muon' },
  'loss-spike': { t: '损失尖峰', en: 'loss spike', d: '训练中损失突然暴涨的现象，常与注意力分数或激活值失控有关；严重时需回滚到之前的检查点重来。', at: 'scaling#muon' },

  // ---- sft (sft.html)
  'base-model': { t: '基座模型', en: 'base model', d: '只经过预训练的模型：会续写任何文本，但不会按指令回答。', at: 'sft#base' },
  'post-training': { t: '后训练', en: 'post-training', d: '预训练之后把基座模型变成可用助手的所有步骤：SFT、偏好优化、强化学习、蒸馏等。', at: 'sft#base' },
  sft: { t: '监督微调（SFT）', en: 'supervised fine-tuning', d: '在“指令-回答”对上最小化交叉熵，只对回答部分计算损失，教模型以助手的身份和格式回答。', at: 'sft#sft' },
  'superficial-alignment': { t: '浅层对齐假说', en: 'superficial alignment hypothesis', d: '模型的知识和能力几乎全部来自预训练，SFT 只是教它用什么格式和风格说出来（LIMA, 2023）。对弱基座不完全成立。', at: 'sft#sft' },
  'reward-model': { t: '奖励模型', en: 'reward model', d: '从“两个回答哪个更好”的比较数据中学出的打分模型，按 Bradley-Terry 模型训练。是人类偏好的不完美代理。', at: 'sft#rm' },
  'bradley-terry': { t: 'Bradley-Terry 模型', en: 'Bradley–Terry model', d: String.raw`\(P(y_w\succ y_l) = \sigma(r_w - r_l)\)：比较的胜率只取决于两者的分差。与 Elo 等级分相同。`, at: 'sft#rm' },
  dpo: { t: 'DPO', en: 'direct preference optimization', d: String.raw`利用 KL 约束下 RLHF 最优解的闭式形式，直接在偏好对上训练：\(-\log\sigma\big(\beta\log\frac{\pi_\theta(y_w)}{\pi_{\text{ref}}(y_w)} - \beta\log\frac{\pi_\theta(y_l)}{\pi_{\text{ref}}(y_l)}\big)\)。不需要奖励模型和 RL。`, at: 'sft#dpo' },
  lora: { t: 'LoRA', en: 'low-rank adaptation', d: String.raw`冻结原权重，只训练低秩增量 \(\Delta W = BA\)（秩 \(r\) 通常 8–64）。可训练参数降到 1% 以下；QLoRA 再把原权重量化到 4 比特。`, at: 'sft#lora' },
  'task-vector': { t: '任务向量', en: 'task vector', d: String.raw`微调后权重减去微调前权重 \(\tau = \theta_{\text{ft}} - \theta_{\text{base}}\)。多个任务向量相加可合并能力，取负可去除行为。`, at: 'sft#merge' },

  // ---- distillation (distillation.html)
  'knowledge-distillation': { t: '知识蒸馏', en: 'knowledge distillation', d: String.raw`用老师模型的输出训练学生模型。经典形式是让学生在温度 \(T\) 下逼近老师的软标签分布（Hinton 等, 2015）。`, at: 'distillation#kd' },
  'offline-distillation': { t: '离线蒸馏', en: 'offline / sequence-level distillation', d: '用老师生成的文本对学生做 SFT。最小化正向 KL；学生只见过老师的前缀，有暴露偏差。', at: 'distillation#kd' },
  opd: { t: '在线策略蒸馏', en: 'on-policy distillation', d: String.raw`学生自己采样回答，老师对每个 token 打分，按 \(A_t = \log\pi_{\text{老师}}(y_t) - \log\pi_\theta(y_t)\) 做策略梯度。最小化反向 KL，信号比 RL 密得多。`, at: 'distillation#onpolicy' },
  seesaw: { t: '跷跷板效应', en: 'seesaw effect', d: '多领域混合后训练时，一个领域变好、另一个变差的相互拉扯（如数学提升而代码下降）。', at: 'distillation#mopd' },
  mopd: { t: '多教师在线蒸馏（MOPD）', en: 'multi-teacher on-policy distillation', d: '先用 RL 训练各领域的专科老师，学生在自己的采样上按题目领域接受对应老师的逐 token 打分，再叠加结果奖励。小米 MiMo-V2-Flash 提出（2026）。', at: 'distillation#mopd' },
  'context-distillation': { t: '上下文蒸馏', en: 'context distillation', d: '以“带着提示或示范的自己”为老师，训练“不带提示的自己”去模仿，把上下文的效果写进权重。SDFT 是它在持续学习上的推广。', at: 'distillation#self' },

  // ---- reasoning (reasoning.html)
  cot: { t: '思维链', en: 'chain of thought (CoT)', d: String.raw`回答前先写出中间推理步骤。写下 \(T\) 个 token，可用的串行计算从 \(L\) 层扩展到约 \(L\times T\) 步，理论上扩展了 Transformer 能计算的函数类。`, at: 'reasoning#why' },
  'self-consistency': { t: '多数投票（自洽性）', en: 'self-consistency', d: '同一问题采样多条推理，取出现最多的答案。正确答案是最常见答案时有效；存在常见的陷阱答案时会稳定地选错。', at: 'reasoning#ttc' },
  overthinking: { t: '过度思考', en: 'overthinking', d: '推理模型在简单问题上写出过长的思考、得到答案后反复验证，浪费算力；有时想得越久越差。', at: 'reasoning#budget' },
  'cot-faithfulness': { t: '思维链忠实性', en: 'CoT faithfulness', d: '思维链是否如实反映了决定答案的因素。实验显示模型受暗示影响时常常不在思维链里承认（约 25–39%）。', at: 'reasoning#faithful' },

  // ---- agents (agents.html)
  'agent-llm': { t: '智能体', en: 'agent', d: '模型 + 一组工具 + 一个循环：模型输出思考和工具调用，外部程序执行并把结果追加回上下文，直到任务完成。', at: 'agents#loop' },
  harness: { t: 'harness', en: 'agent harness', d: '智能体循环之外的程序：执行工具、管理上下文、处理权限与错误、规划与验证。同一模型换 harness，分数可差十几个百分点。', at: 'agents#loop' },
  'tool-calling': { t: '工具调用', en: 'tool / function calling', d: '工具用 JSON Schema 描述；模型按约定格式（常包在特殊 token 里）输出调用，harness 解析并执行，结果回填上下文。', at: 'agents#tools' },
  mcp: { t: 'MCP', en: 'Model Context Protocol', d: '应用与工具服务之间的开放协议（Anthropic, 2024-11），服务器提供 tools、resources、prompts，把 N×M 个集成变成 N+M。2025-12 捐给 Linux 基金会。', at: 'agents#tools' },
  'context-engineering': { t: '上下文工程', en: 'context engineering', d: '在多步任务中决定每一步往有限上下文里放什么：保持前缀稳定、清理旧结果、压缩、按需检索、外部记忆、子智能体。', at: 'agents#context' },
  compaction: { t: '压缩（上下文）', en: 'compaction', d: '上下文快满时让模型把历史写成摘要，用摘要替换原文继续工作。会改动前缀、使缓存失效。', at: 'agents#context' },
  subagent: { t: '子智能体', en: 'subagent', d: '在全新上下文中执行子任务、只把结论交回主智能体的智能体。让主上下文保持干净，代价是额外的调用。', at: 'agents#context' },
  rag: { t: 'RAG', en: 'retrieval-augmented generation', d: '先从资料库检索相关片段放进上下文，再让模型回答：切块、嵌入、召回、重排、生成。', at: 'agents#rag' },
  'hybrid-retrieval': { t: '混合检索', en: 'hybrid retrieval', d: String.raw`同时用向量检索（语义）和关键词检索（BM25，精确匹配），常用倒数排名融合 \(\sum 1/(k + \text{rank})\) 合并结果。`, at: 'agents#rag' },
  'agentic-search': { t: '智能体搜索', en: 'agentic search', d: '由模型自己决定搜什么、读什么、是否换关键词再搜，检索成为循环中的一种动作，而非固定流水线。', at: 'agents#rag' },
  'prompt-injection': { t: '提示注入', en: 'prompt injection', d: '工具返回的不可信内容（网页、邮件等）中夹带指令，诱使模型执行。根源是模型无法从结构上区分指令和数据。', at: 'agents#security' },

  // ---- coding (coding.html)
  fim: { t: '中间填空（FIM）', en: 'fill-in-the-middle', d: '训练时把文档重排为“前缀、后缀、中间”并用特殊 token 标记，模型从左到右预测中间段时已看过前后文。编辑器补全依赖它。', at: 'coding#train' },
  'swe-bench': { t: 'SWE-bench', en: 'SWE-bench', d: '用真实 GitHub 仓库的 issue 出题：给出 issue 和修复前的仓库，以 PR 中的测试（FAIL_TO_PASS 与 PASS_TO_PASS）判分。Verified 为人工筛选的 500 题，Pro 更难、更难污染。', at: 'coding#eval' },
  'vibe-coding': { t: 'vibe coding', en: 'vibe coding', d: '用自然语言描述需求、接受 AI 的全部修改而不读代码的编程方式（Karpathy, 2025-02）。适合原型，不适合需长期维护的软件。', at: 'coding#forms' },

  // ---- moe (moe.html)
  moe: { t: '混合专家（MoE）', en: 'mixture of experts', d: String.raw`把 MLP 换成 \(E\) 个专家加一个路由器，每个 token 只送给得分最高的 \(k\) 个专家。参数量约为 \(E\) 个专家，计算量约为 \(k\) 个。`, at: 'moe#idea' },
  expert: { t: '专家', en: 'expert', d: 'MoE 层中的一个小 MLP。细粒度 MoE 有几百个专家，外加所有 token 都经过的共享专家。', at: 'moe#idea' },
  router: { t: '路由器', en: 'router / gate', d: String.raw`一个 \(d\times E\) 的线性层，给每个专家打分，选出 top-k 并给出门控权重。与模型一起训练。`, at: 'moe#idea' },
  'routing-collapse': { t: '路由坍缩', en: 'routing collapse', d: '路由器把大部分 token 送给少数专家，其余专家得不到训练。需要辅助损失或无辅助损失的偏置调节来均衡负载。', at: 'moe#balance' },

  // ---- long-context (long-context.html)
  'kv-cache': { t: 'KV 缓存', en: 'KV cache', d: String.raw`生成时缓存历史 token 的 K、V，避免重算。每 token 大小 \(2\times L\times h_{kv}\times d_h\times\) 字节数；长上下文推理时常是显存的主要占用。`, at: 'long-context#kv' },
  gqa: { t: 'GQA', en: 'grouped-query attention', d: '把 Q 头分组，每组共享一组 K/V 头（如 64 个 Q 头配 8 个 KV 头），KV 缓存按比例缩小。2023 年后的默认设计。', at: 'long-context#kv' },
  mla: { t: 'MLA', en: 'multi-head latent attention', d: '把每个 token 的 K、V 联合压缩为一个低维潜向量（如 512 维）加一个 64 维的 RoPE 向量来缓存，计算时把上投影吸收进 Q 和输出投影。DeepSeek-V2 提出。', at: 'long-context#kv' },
  'flash-attention': { t: 'FlashAttention', en: 'FlashAttention', d: String.raw`把注意力分块在片上 SRAM 中算完、不写出 \(n\times n\) 矩阵的精确实现，借助在线 softmax。显存从 \(O(n^2)\) 降到 \(O(n)\)，速度提升 2–4 倍。`, at: 'long-context#flash' },
  'online-softmax': { t: '在线 softmax', en: 'online softmax', d: String.raw`分块扫描时维护当前最大值 \(m\) 与归一化因子 \(\ell\)，遇到更大值时把已累积的结果乘 \(e^{m - m_{\text{新}}}\) 修正，最终结果与一次性计算完全一致。`, at: 'long-context#flash' },
  'linear-attention': { t: '线性注意力', en: 'linear attention', d: String.raw`去掉 softmax，用结合律把历史压成固定大小的状态 \(S_t = S_{t-1} + \mathbf v_t\mathbf k_t^\top\)，读取 \(\mathbf o_t = S_t\mathbf q_t\)。代价线性、显存常数，但精确回忆能力有限；DeltaNet、KDA 加入误差修正与遗忘门。`, at: 'long-context#linear' },
  ssm: { t: '状态空间模型', en: 'state space model (SSM)', d: '以固定大小的状态做递推、状态更新由输入选择性控制的序列模型，代表是 Mamba。Mamba-2 证明它与一类线性注意力等价。', at: 'long-context#linear' },

  // ---- hardware (hardware.html)
  'tensor-core': { t: '张量核心', en: 'tensor core', d: 'GPU 中专门做小矩阵乘加的电路，一个周期完成上千次乘加；大模型的算力几乎全部来自它。精度越低，吞吐越高。', at: 'hardware#gpu' },
  sram: { t: '片上 SRAM', en: 'on-chip SRAM', d: '紧挨计算单元的高速小容量存储（每个 SM 几百 KB）。高性能内核的关键是让数据在这里被反复使用。', at: 'hardware#gpu' },
  hbm: { t: 'HBM', en: 'high-bandwidth memory', d: '与芯片封装在一起的堆叠显存，容量几十到几百 GB、带宽每秒数 TB。大模型推理常受它的带宽限制。', at: 'hardware#gpu' },
  'arithmetic-intensity': { t: '算术强度', en: 'arithmetic intensity', d: '每从显存读写一个字节所做的运算次数（FLOPs/字节）。低于芯片的“峰值算力 ÷ 带宽”时访存受限，高于时计算受限。', at: 'hardware#roofline' },
  roofline: { t: 'Roofline 模型', en: 'roofline model', d: String.raw`可达性能 \(=\min(P_{\text{峰值}},\ I\times\text{BW})\)：判断一段计算受限于算力还是带宽。单用户解码的强度约为 1，远低于拐点。`, at: 'hardware#roofline' },
  'systolic-array': { t: '脉动阵列', en: 'systolic array', d: '乘加单元组成的网格，权重驻留在单元中，输入数据逐拍流过、部分和沿另一方向累加。TPU 的矩阵单元采用这种结构，能效高但不够灵活。', at: 'hardware#arch' },

  // ---- quantization (quantization.html)
  quantization: { t: '量化', en: 'quantization', d: String.raw`用更少的位数表示权重、激活或 KV 缓存：\(\hat w = s\cdot\operatorname{round}(w/s)\)。省显存、省带宽、能用低精度算力，代价是误差。`, at: 'quantization#why' },
  bpw: { t: '每权重位数（bpw）', en: 'bits per weight', d: '包括缩放因子等开销在内的平均位数：位宽 + 缩放位数 ÷ 组大小。例如 Q4_0 为 4.5、MXFP4 为 4.25。', at: 'quantization#basics' },
  microscaling: { t: '微缩放格式', en: 'microscaling (MX / NVFP4)', d: '每 16 或 32 个低位数共享一个缩放因子的硬件格式：MXFP4 用 E8M0 缩放、组大小 32；NVFP4 用 FP8 缩放、组大小 16，外加张量级缩放。', at: 'quantization#basics' },
  'outlier-features': { t: '离群特征', en: 'outlier features', d: '激活中少数幅度大几十倍的固定通道（约 6.7B 参数以上出现），会撑大缩放因子、毁掉其余数值的精度。', at: 'quantization#outliers' },
  ptq: { t: '训练后量化（PTQ）', en: 'post-training quantization', d: '模型训练完后直接量化，最多用少量校准数据（GPTQ、AWQ、imatrix）。4 位以上通常够用。', at: 'quantization#qat' },
  qat: { t: '量化感知训练（QAT）', en: 'quantization-aware training', d: '训练时前向使用量化后的权重、反向用直通估计器更新高精度潜权重，让模型适应量化网格。低于 4 位基本必需。', at: 'quantization#qat' },
  ste: { t: '直通估计器（STE）', en: 'straight-through estimator', d: '反向传播时把取整当作恒等函数，梯度原样传给潜权重（超出可表示范围时置零），使不可导的量化可以被训练。', at: 'quantization#qat' },

  // ---- serving (serving.html)
  prefill: { t: '预填充', en: 'prefill', d: '一次性处理整个提示、算出全部 KV 缓存和第一个 token 的阶段。大矩阵乘法，计算受限，决定首 token 延迟（TTFT）。', at: 'serving#phases' },
  decode: { t: '解码（阶段）', en: 'decode', d: '之后每步生成一个 token 的阶段。矩阵乘向量，访存受限，决定每 token 间隔（TPOT）；靠批处理提高吞吐。', at: 'serving#phases' },
  goodput: { t: '有效吞吐', en: 'goodput', d: '满足延迟要求（如首 token 与每 token 延迟上限）的那部分吞吐，比单纯的吞吐更能反映服务质量。', at: 'serving#phases' },
  'continuous-batching': { t: '连续批处理', en: 'continuous batching', d: '每个解码步都把已结束的请求换成队列中的新请求，而不是等一整批都结束（Orca, 2022）。', at: 'serving#batching' },
  'paged-attention': { t: 'PagedAttention', en: 'PagedAttention', d: 'KV 缓存按固定大小的块按需分配、用块表映射，借鉴操作系统分页；显存浪费从 60–80% 降到 4% 以下（vLLM, 2023）。', at: 'serving#batching' },
  'prefix-cache': { t: '前缀缓存', en: 'prefix caching', d: '多个请求共享的前缀（系统提示、对话历史、工具说明）只计算一次 KV，之后直接复用。API 对缓存命中的输入大幅降价。', at: 'serving#batching' },
  'spec-decoding': { t: '投机解码', en: 'speculative decoding', d: String.raw`草稿先猜 \(\gamma\) 个 token，大模型一次前向并行验证，按 \(\min(1, p/q)\) 接受、拒绝时从残差分布重抽；输出分布与大模型完全相同，速度提升 2–3 倍。`, at: 'serving#spec' },
  'pd-disagg': { t: '预填充与解码分离', en: 'prefill/decode disaggregation', d: '把预填充和解码放在不同的 GPU 池，KV 缓存经高速网络传输，两类负载互不干扰、分别扩容。', at: 'serving#disagg' },

  // ---- training-systems (training-systems.html)
  recompute: { t: '激活重算', en: 'activation recomputation', d: '前向时只保存少数层的输入，反向时重新计算中间激活，用约 30% 的额外计算换数倍的显存；选择性重算只重算便宜而占显存的部分。', at: 'training-systems#memory' },
  'data-parallel': { t: '数据并行', en: 'data parallelism', d: '每张卡一份完整模型、处理不同数据，每步对梯度做全规约求平均。最简单，但每卡要装下整个模型与优化器状态。', at: 'training-systems#parallel' },
  'zero-fsdp': { t: 'ZeRO / FSDP', en: 'ZeRO / fully sharded data parallel', d: '在数据并行的卡之间依次切分优化器状态、梯度、参数（ZeRO-1/2/3），用到时再收集。状态显存约降为 1/n，通信增加。', at: 'training-systems#parallel' },
  'tensor-parallel': { t: '张量并行', en: 'tensor parallelism', d: '把每个矩阵乘法按行或列切到多张卡上，每层两次全规约；通信频繁，通常限于一个 NVLink 域内。', at: 'training-systems#parallel' },
  'pipeline-parallel': { t: '流水线并行', en: 'pipeline parallelism', d: String.raw`按层切成 \(p\) 段放在不同机器上，数据切成 \(m\) 个微批次流过；空闲“气泡”比例约 \((p-1)/(m+p-1)\)。`, at: 'training-systems#parallel' },
  mfu: { t: 'MFU', en: 'model FLOPs utilization', d: String.raw`模型理论计算量（每 token \(6N\)）占硬件峰值算力的比例。大规模训练做到 40–50% 就算很好。`, at: 'training-systems#comm' },

  // ---- on-device (on-device.html)
  'unified-memory': { t: '统一内存', en: 'unified memory', d: 'CPU 与 GPU 共享同一块内存（Apple 芯片、DGX Spark 等）。容量大，能放下大模型；带宽与算力通常低于同价位的独立显卡。', at: 'on-device#mac' },
  npu: { t: 'NPU', en: 'neural processing unit', d: '专为神经网络推理设计的加速器（手机、嵌入式芯片中常见）。算子集合封闭、需专用工具链；擅长计算受限的预填充，解码仍受内存带宽限制。', at: 'on-device#phone' },

  // ---- vlm (vlm.html)
  vit: { t: 'ViT', en: 'Vision Transformer', d: '把图像切成固定大小的 patch，每块投影成一个向量，加位置编码后用 Transformer 编码器处理。几乎所有多模态模型的视觉编码器都是 ViT。', at: 'vlm#vit' },
  patch: { t: 'patch（图像块）', en: 'patch', d: String.raw`图像被切成的 \(P\times P\) 像素小方块（如 14 或 16 像素），相当于图像的“token”。数量与图像面积成正比。`, at: 'vlm#vit' },
  clip: { t: 'CLIP', en: 'Contrastive Language–Image Pre-training', d: '用 4 亿网络图文对，以对比学习同时训练图像编码器和文本编码器，使配对的图文向量相近。支持零样本分类，是多模态模型视觉编码器的起点。', at: 'vlm#clip' },
  contrastive: { t: '对比学习', en: 'contrastive learning', d: String.raw`让配对样本相似、不配对样本不相似的训练方式。CLIP 的损失是 \(N\times N\) 相似度矩阵上按行、按列的交叉熵（InfoNCE），等价于抬高互信息的下界。`, at: 'vlm#clip' },
  llava: { t: 'LLaVA', en: 'Large Language and Vision Assistant', d: '视觉编码器 + 投影层 + 语言模型的多模态范式（2023）：先训投影层对齐，再做视觉指令微调。', at: 'vlm#llava' },
  projector: { t: '投影层', en: 'projector', d: '把视觉编码器输出的向量映射到语言模型嵌入维度的小网络（线性层或两层 MLP），通常配合 2×2 patch 合并。', at: 'vlm#llava' },
  'native-multimodal': { t: '原生多模态', en: 'native multimodal', d: '从预训练阶段就混合图文（及音视频）数据训练的模型，而不是先训好语言模型再“装上眼睛”。', at: 'vlm#llava' },

  // ---- diffusion (diffusion.html)
  'diffusion-model': { t: '扩散模型', en: 'diffusion model', d: String.raw`前向把数据逐步混入高斯噪声 \(\mathbf x_t = a_t\mathbf x_0 + b_t\boldsymbol\varepsilon\)，训练网络去噪；生成时从纯噪声出发反复去噪。图像与视频生成的主流方法。`, at: 'diffusion#forward' },
  'flow-matching': { t: '流匹配', en: 'flow matching / rectified flow', d: String.raw`用直线插值 \(\mathbf x_t = (1-t)\mathbf x_0 + t\boldsymbol\varepsilon\) 定义路径，回归速度 \(\boldsymbol\varepsilon - \mathbf x_0\)，生成时解 ODE。路径更直、少步误差更小；SD3、FLUX 起的标准。`, at: 'diffusion#forward' },
  score: { t: '分数', en: 'score', d: String.raw`对数概率密度的梯度 \(\nabla_{\mathbf x}\log p_t(\mathbf x)\)，指向密度上升最快的方向。由 Tweedie 公式，它等于 \(-\mathbb E[\boldsymbol\varepsilon\mid\mathbf x_t]/b_t\)，即去噪器隐含的信息。`, at: 'diffusion#reverse' },
  cfg: { t: '无分类器引导（CFG）', en: 'classifier-free guidance', d: String.raw`\(\hat\varepsilon = \hat\varepsilon(\varnothing) + w(\hat\varepsilon(c) - \hat\varepsilon(\varnothing))\)：放大条件带来的改变，相当于从 \(p(\mathbf x)p(c\mid\mathbf x)^w\) 采样。更贴题、多样性下降。`, at: 'diffusion#cfg' },

  // ---- image (image.html)
  vae: { t: 'VAE', en: 'variational autoencoder', d: '把图像压缩成小得多的潜表示（每边压缩约 8 倍）并能解码回来的网络。潜空间扩散在它的潜空间里去噪。', at: 'image#latent' },
  'latent-diffusion': { t: '潜空间扩散', en: 'latent diffusion', d: '先用 VAE 把图像压缩成潜图，在潜图上做扩散，最后解码成像素（Stable Diffusion, 2022）。计算量减少数十倍。', at: 'image#latent' },
  dit: { t: 'DiT', en: 'Diffusion Transformer', d: '用 Transformer 处理潜图 patch 的去噪网络，时间步和条件经 adaLN 注入。扩展性好，是 Sora 之后大型图像与视频模型的基础。', at: 'image#backbone' },
  mmdit: { t: 'MMDiT', en: 'multimodal DiT', d: '文本 token 与图像 token 拼成一条序列做联合注意力、两种模态各有权重的 DiT（SD3, 2024）。FLUX、Qwen-Image 沿用。', at: 'image#backbone' },
  sdedit: { t: 'SDEdit（图生图）', en: 'SDEdit', d: '把输入图加噪到中间时刻 s，再从那里去噪。强度 s 越大，保留原图越少、越自由。', at: 'image#control' },
  controlnet: { t: 'ControlNet', en: 'ControlNet', d: '复制去噪网络的编码器接收边缘、深度、姿态等控制信号，经零初始化的卷积注入冻结的主网络，训练初期不破坏原能力。', at: 'image#control' },
  'unified-model': { t: '理解与生成统一模型', en: 'unified understanding & generation', d: '同一个模型既能看图也能画图，常由语言模型负责理解与规划、扩散或自回归头负责生成像素（GPT-4o、BAGEL 等）。', at: 'image#unified' },

  // ---- video (video.html)
  'spacetime-patch': { t: '时空 patch', en: 'spacetime patch', d: '把潜视频沿时间和空间切成的小块（常为 1×2×2），每块一个 token；任意时长、分辨率的视频都变成一串 token（Sora, 2024）。', at: 'video#arch' },
  'diffusion-forcing': { t: 'Diffusion Forcing', en: 'Diffusion Forcing', d: '训练时给每一帧独立的噪声水平，使模型能以“不完美的前帧”为条件逐帧生成，缓解自回归视频的误差累积（2024）。', at: 'video#consistency' },

  // ---- audio (audio.html)
  mel: { t: '梅尔频谱', en: 'mel spectrogram', d: String.raw`每隔约 10 毫秒做一次短时傅里叶变换，把频率按梅尔刻度 \(m = 2595\log_{10}(1 + f/700)\) 分成几十个频带并取对数能量。声音的“图像”表示。`, at: 'audio#features' },
  asr: { t: '语音识别（ASR）', en: 'automatic speech recognition', d: '把语音转写成文字。Whisper 用编码器读梅尔频谱、解码器像语言模型一样生成文字，68 万小时弱监督数据带来鲁棒性。', at: 'audio#features' },
  'neural-codec': { t: '神经音频编解码器', en: 'neural audio codec', d: '把波形压成每秒几十帧、每帧几个码本编号的网络（SoundStream、EnCodec、Mimi），并能解码还原。让语言模型可以“预测声音 token”。', at: 'audio#codec' },
  rvq: { t: '残差向量量化（RVQ）', en: 'residual vector quantization', d: '第 1 级码本量化原始向量，第 k 级量化前 k−1 级留下的残差；码率 = 帧率 × 级数 × log₂(码本大小)。', at: 'audio#codec' },
  'full-duplex': { t: '全双工对话', en: 'full-duplex dialogue', d: '同时听和说、可随时被打断或插话的语音对话模型（Moshi、GPT-Live）。', at: 'audio#duplex' },

  // ---- spatial (spatial.html)
  nerf: { t: '神经辐射场（NeRF）', en: 'neural radiance field', d: '用一个 MLP 表示场景：输入坐标与视角，输出密度和颜色；沿光线做可微体渲染，从多张照片优化得到。', at: 'spatial#nerf' },
  'volume-rendering': { t: '体渲染', en: 'volume rendering', d: String.raw`沿光线累加 \(C = \sum_i T_i\alpha_i\mathbf c_i\)，\(\alpha_i = 1 - e^{-\sigma_i\delta_i}\)，\(T_i = \prod_{j<i}(1-\alpha_j)\)。来自比尔-朗伯定律，NeRF 与高斯泼溅共用。`, at: 'spatial#nerf' },
  'gaussian-splatting': { t: '3D 高斯泼溅', en: '3D Gaussian splatting', d: '用几百万个带位置、协方差、颜色、不透明度的三维高斯椭球表示场景，投影到屏幕后按深度排序混合，可实时渲染（2023）。', at: 'spatial#gs' },
  sds: { t: '分数蒸馏采样（SDS）', en: 'score distillation sampling', d: '从随机视角渲染三维表示、加噪后让二维扩散模型预测噪声，用预测与真实噪声之差更新三维参数，借二维模型生成三维（DreamFusion, 2022）。', at: 'spatial#gen' },

  // ---- world-models (world-models.html)
  'world-model': { t: '世界模型', en: 'world model', d: String.raw`学习环境动态 \(p(\mathbf s_{t+1}\mid\mathbf s_{\le t}, \mathbf a_t)\) 的模型：给定观测与动作预测下一刻。用于在想象中训练智能体、可交互的视频世界、驾驶与机器人仿真。`, at: 'world-models#what' },
  jepa: { t: 'JEPA', en: 'joint-embedding predictive architecture', d: '只在抽象表示空间里预测未来、不重建像素的自监督架构（LeCun）；用停止梯度与慢速更新的目标编码器防止表示塌缩。V-JEPA 2 用它做机器人规划。', at: 'world-models#debate' },

  // ---- embodied (embodied.html)
  vla: { t: 'VLA', en: 'vision-language-action model', d: '以视觉语言模型为骨干、直接输出机器人动作的模型：动作可离散成 token（RT-2），或由流匹配动作专家生成连续的动作块（π0）。', at: 'embodied#vla' },
  'behavior-cloning': { t: '行为克隆', en: 'behavior cloning', d: String.raw`用监督学习模仿专家在各状态下的动作。偏离示范后的状态没见过，误差累积，代价上界随步数平方增长（\(T^2\varepsilon\)）；DAgger 降为线性。`, at: 'embodied#bc' },
  wam: { t: '世界动作模型', en: 'world action model', d: '以大规模预训练的视频世界模型为骨干，在预测未来画面的同时解码出动作的机器人策略（2026 年兴起，如 NVIDIA DreamZero）。', at: 'embodied#wam' },
};
