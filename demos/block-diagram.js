/* block-diagram — interactive demo (moved from ch03-transformer.html) */
A.defineDemo('block-diagram', function (mount) {
  const { bd } = A.demo(mount, '现代 Transformer 块（点击组件）', 'Llama 风格');
  const INFO = {
    emb: ['词嵌入', '把 token id 换成 d 维向量（' + A.cref('tokens') + '）。从这里开始，每个位置的向量就是一条“残差流”。'],
    norm1: ['RMSNorm', '只按均方根缩放：x / sqrt(mean(x²)) · g。没有减均值和偏置，比 LayerNorm 更便宜。放在子层<b>之前</b>（Pre-Norm），残差路径上就没有归一化，梯度可以直接传过去。'],
    attn: ['多头自注意力（GQA + RoPE）', '先算 Q、K、V，对 Q、K 施加 RoPE 旋转，再做带因果掩码的缩放点积注意力。GQA 让多个 Q 头共享一组 K/V 头（比如 64 个 Q 头配 8 个 KV 头），KV cache 变成原来的 1/8。这是唯一在 token 之间交换信息的地方。'],
    add1: ['残差相加', 'x ← x + Attn(Norm(x))。注意力的输出是在原向量上“增量修改”，不是替换。'],
    norm2: ['RMSNorm', '同上，给 MLP 用的那一份。'],
    ffn: ['SwiGLU 前馈网络（MLP）', 'FFN(x) = W₂ · (SiLU(W₁x) ⊙ W₃x)。三个矩阵，中间维度通常约为 8/3·d 再取整（Llama 3 8B：d=4096，中间维度 14336）。每个 token 独立计算，参数量约占整层的 2/3。大模型里这一块常换成 MoE：一组专家 MLP 加一个路由器。'],
    add2: ['残差相加', 'x ← x + MLP(Norm(x))。'],
    stack: ['× L 层', '同样的块重复 L 次（Llama 3 8B 是 32 层，70B 是 80 层，Kimi K3 是 93 层）。每层的参数不同，结构相同。'],
    normf: ['最终 RMSNorm', '所有层之后再归一化一次。'],
    head: ['输出层（LM Head）', '乘以 d×V 的矩阵得到 V 个 logit，softmax 后得到下一个 token 的概率。训练时和真实的下一个 token 算交叉熵；推理时从这个分布里采样（' + A.cref('generation') + '）。'],
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  const W = 360, H = 560;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.id = 'block-svg';
  svg.style.width = '100%'; svg.style.maxWidth = '380px';
  const panel = A.el('div', { class: 'card', style: { alignSelf: 'start' } });
  const grid = A.el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,380px) minmax(0,1fr)', gap: '18px' } });
  grid.append(A.el('div', null, svg), panel); bd.append(grid);
  const mk = (tag, attrs) => { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.append(e); return e; };
  const cols = A.series();
  const boxes = {};
  // wires
  mk('path', { class: 'wire', d: 'M180 520 L180 60' });
  // residual skip paths
  mk('path', { class: 'res', d: 'M180 420 L320 420 L320 296 L196 296' });
  mk('path', { class: 'res', d: 'M180 280 L320 280 L320 160 L196 160' });
  const box = (k, x, y, w, h, label, color) => {
    const r = mk('rect', { class: 'box', x, y, width: w, height: h, rx: 9, fill: A.alpha(color, 0.16) });
    r.addEventListener('click', () => sel(k));
    boxes[k] = r;
    const t = mk('text', { x: x + w / 2, y: y + h / 2 + 4.5, 'text-anchor': 'middle' }); t.textContent = label;
  };
  const circ = (k, cy) => {
    const c = mk('circle', { class: 'box', cx: 180, cy, r: 14, fill: A.alpha(cols[1], 0.2) });
    c.addEventListener('click', () => sel(k)); boxes[k] = c;
    const t = mk('text', { x: 180, y: cy + 5, 'text-anchor': 'middle' }); t.textContent = '+';
  };
  box('head', 90, 10, 180, 36, '输出层 → softmax', cols[6]);
  box('normf', 110, 60, 140, 30, 'RMSNorm', cols[3]);
  mk('rect', { x: 40, y: 104, width: 300, height: 352, rx: 14, fill: 'none', stroke: A.css('--axis'), 'stroke-dasharray': '6 5' });
  box('stack', 266, 112, 66, 26, '× L 层', cols[7]);
  circ('add2', 160);
  box('ffn', 95, 186, 170, 40, 'SwiGLU MLP / MoE', cols[2]);
  box('norm2', 110, 240, 140, 28, 'RMSNorm', cols[3]);
  circ('add1', 296);
  box('attn', 95, 322, 170, 40, '多头注意力 · GQA · RoPE', cols[0]);
  box('norm1', 110, 378, 140, 28, 'RMSNorm', cols[3]);
  box('emb', 90, 480, 180, 36, '词嵌入（token → 向量）', cols[4]);
  const lbl = mk('text', { x: 326, y: 360, 'text-anchor': 'end' }); lbl.textContent = '残差'; lbl.style.fill = cols[1]; lbl.style.fontSize = '12px';
  function sel(k) {
    Object.values(boxes).forEach((b) => b.classList.remove('on'));
    boxes[k].classList.add('on');
    panel.innerHTML = `<div class="n">组件</div><div class="t">${INFO[k][0]}</div><div class="d" style="font-size:14.5px;line-height:1.75">${INFO[k][1]}</div>`;
  }
  sel('attn');
});
