/* transformer-walk — one token's 4-d vector stepped through one Pre-Norm block (RMSNorm → attention → add → RMSNorm → MLP → add); every number is computed live */
A.defineDemo('transformer-walk', function (mount) {
  const { bd } = A.demo(mount, '一个向量穿过一个块', '玩具：d = 4，MLP 中间维度 8，ReLU；跟踪“今天 天气 很”里的“很”');
  // ---- toy numbers (same as the text) ----
  const X = [2, 0, -1, 1];
  const TOK = ['今天', '天气', '很'];
  const W = [0.2, 0.7, 0.1];
  const C = [[0, 0, 2, 0], [0, 2, 0, -1], [1, 0, 0, 0]];
  const K = [[0, 1, 0, 1], [1, 0, 0, -1], [0, -1, 1, 0], [-1, 0, 0, 0], [0, 0, -1, 1], [1, -1, 0, 0], [0, 0, 1, 0], [-1, 1, 0, 1]];
  const VV = [[0, 0, 0, 0.5], [-0.25, 0, 0, 0], [0, 0, 0.5, 0], [0, 0, 0, -0.5], [0, 0.5, 0, 0], [0, 0, -0.5, 0.5], [0.5, 0, 0, 0], [0, 0, 0, 0.5]];
  const rms = (v) => Math.sqrt(A.sum(v.map((x) => x * x)) / v.length);
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const r1 = rms(X), U1 = X.map((x) => x / r1);
  const AT = [0, 1, 2, 3].map((i) => A.sum(W.map((w, j) => w * C[j][i])));
  const H = add(X, AT), r2 = rms(H), U2 = H.map((x) => x / r2);
  const Z = K.map((k) => A.dot(k, U2)), P = Z.map((z) => Math.max(0, z));
  const M = [0, 1, 2, 3].map((i) => A.sum(P.map((p, j) => p * VV[j][i])));
  const X1 = add(H, M);
  const f = (v) => String(+v.toFixed(2));
  const vec = (v) => '(' + v.map(f).join(',\\ ') + ')';
  const act = P.map((p, i) => (p > 0 ? i : -1)).filter((i) => i >= 0);
  const STEPS = [
    { t: '嵌入', tex: String.raw`\mathbf x = E[\text{很}] = ${vec(X)}`, say: '查嵌入表，取出“很”这一行，得到一个 4 维向量。从这里开始，这个位置上始终只有这一条向量，它就是<b>残差流</b>；后面每个子层都只往它上面加东西。左图记录它由哪几份组成。' },
    { t: '归一化', tex: String.raw`\operatorname{RMS}(\mathbf x) = \sqrt{\tfrac14(4+0+1+1)} = ${f(r1)},\qquad \mathbf u = \mathbf x / ${f(r1)} = ${vec(U1)}`, say: 'RMSNorm 把向量除以均方根，让每维的典型大小约为 1。它只改大小、不改方向（右图两组柱子的比例完全相同）。被缩放的是送进注意力的<b>副本</b>，左图的残差流没有变。' },
    { t: '注意力', tex: String.raw`\mathbf a = 0.2\,${vec(C[0])} + 0.7\,${vec(C[1])} + 0.1\,${vec(C[2])} = ${vec(AT)}`, say: '“很”的 query 和三个位置的 key 算出权重（' + A.cref('attention') + '），再按权重把各位置交出的内容（value 乘 W<sub>O</sub> 之后）加起来。“天气”的权重最大，它的内容主要在第 2 维，于是被搬到了“很”这里。' },
    { t: '残差相加', tex: String.raw`\mathbf h = \mathbf x + \mathbf a = ${vec(X)} + ${vec(AT)} = ${vec(H)}`, say: '把注意力的结果<b>加回</b>残差流。左图里，原来的粉色部分原封不动，注意力只是在上面叠了一层蓝色。这一步不替换任何东西。' },
    { t: '归一化', tex: String.raw`\operatorname{RMS}(\mathbf h) = \sqrt{6.82/4} = ${f(r2)},\qquad \mathbf u' = ${vec(U2)}`, say: '给 MLP 用的第二次归一化，同样只作用在副本上。' },
    { t: '升维', tex: String.raw`z_i = \mathbf u'\cdot\mathbf k_i,\qquad \mathbf z = ${vec(Z)}`, say: 'W<sub>1</sub> 是 4×8 的矩阵，它的 8 列是 8 个“键” k<sub>i</sub>（柱子下方的小格：蓝 = +1，红 = −1，灰 = 0）。u′ 和每个键做点积，分数越高，表示 u′ 越像这个键。例如 k<sub>1</sub> = (0, 1, 0, 1)，z<sub>1</sub> = 1.07 + 0.23 = 1.30。' },
    { t: '激活', tex: String.raw`\max(0, \mathbf z) = ${vec(P)}`, say: `ReLU 把负的分数变成 0。8 个键里只有 ${act.length} 个（第 ${act.map((i) => i + 1).join('、')} 个）被激活，其余的对这个输入完全不响应。` },
    { t: '降维', tex: String.raw`\mathbf m = ${act.map((i) => f(P[i]) + '\\,\\mathbf v_{' + (i + 1) + '}').join(' + ')} = ${vec(M)}`, say: 'W<sub>2</sub> 是 8×4 的矩阵，它的第 i 行是一个“值” v<sub>i</sub>。被激活的键按各自的分数，把对应的值加起来。这就是正文“MLP 是一张键值记忆表”的读法。' },
    { t: '残差相加', tex: String.raw`\mathbf x' = \mathbf h + \mathbf m = \mathbf x + \mathbf a + \mathbf m = ${vec(X1)}`, say: '再加回去，得到这个块的输出，也就是下一个块的输入。左图三种颜色恰好是三份贡献：残差流从头到尾只被加过两次，从没被覆盖。真实模型把这个块重复 L 次。' },
  ];
  let k = 0, timer = null;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => { stop(); go(k - 1); } }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => { stop(); go(k + 1); } }, '下一步 →');
  const play = A.el('button', { onclick: () => { if (timer) { stop(); return; } if (k >= STEPS.length - 1) go(0); timer = setInterval(() => (k < STEPS.length - 1 ? go(k + 1) : stop()), 2200); play.textContent = '暂停'; } }, '自动播放');
  const stop = () => { clearInterval(timer); timer = null; play.textContent = '自动播放'; };
  bar.append(prev, next, play);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => { stop(); go(+slider.value); };
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => { stop(); go(i); } }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const grid = A.el('div', { class: 'cols' });
  const cv1 = A.el('canvas', { class: 'cv' }), cv2 = A.el('canvas', { class: 'cv' });
  grid.append(cv1, cv2);
  const legend = A.el('div', { class: 'legend' });
  bd.append(bar, slider, dots, fx, say, grid, legend);
  let cols = A.series();
  const CE = () => cols[4], CA = () => cols[0], CM = () => cols[2], CN = () => cols[3];
  const drawLegend = () => { legend.innerHTML = `<span><i style="background:${cols[4]}"></i>嵌入 x</span><span><i style="background:${cols[0]}"></i>注意力写入 a</span><span><i style="background:${cols[2]}"></i>MLP 写入 m</span><span><i style="background:${cols[3]}"></i>归一化后的副本</span><span>黑点 = 残差流当前的值</span>`; };
  A.onTheme(() => { cols = A.series(); drawLegend(); if (v1) { v1.redraw(); v2.redraw(); } });
  let v1 = null, v2 = null;
  drawLegend();

  // grouped bars: groups = [{lab, bars:[{v,c,a}]}]
  function groups(ctx, box, G, ymin, ymax, o = {}) {
    const ax = A.axes(ctx, box, { xmin: 0, xmax: G.length, ymin, ymax, xticks: [], yfmt: (v) => v.toFixed(1), ny: 4 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore();
    const gw = box.w / G.length;
    G.forEach((g, gi) => {
      const n = g.bars.length, bw = Math.min(26, (gw * 0.72) / n);
      const x0 = box.x + gi * gw + (gw - bw * n) / 2;
      g.bars.forEach((b, bi) => {
        const x = x0 + bi * bw, y0 = ax.Y(0), y1 = ax.Y(A.clamp(b.v, ymin, ymax));
        ctx.fillStyle = A.alpha(b.c, b.a ?? 0.85);
        ctx.fillRect(x + 1, Math.min(y0, y1), bw - 2, Math.abs(y1 - y0));
        if (b.lab !== false) A.text(ctx, f(b.v), x + bw / 2, b.v >= 0 ? y1 - 8 : y1 + 9, { size: 10.5, align: 'center', mono: true, color: b.a && b.a < 0.5 ? A.css('--muted') : A.css('--ink') });
      });
      A.text(ctx, g.lab, box.x + gi * gw + gw / 2, box.y + box.h + 12, { size: 11.5, align: 'center', color: A.css('--muted') });
      if (g.keys) { // mini key column under the label
        const cs = 7, kx = box.x + gi * gw + gw / 2 - cs / 2;
        g.keys.forEach((kv, r) => { ctx.fillStyle = kv > 0 ? A.alpha(cols[0], 0.9) : kv < 0 ? A.alpha(cols[7], 0.9) : A.css('--grid'); ctx.fillRect(kx, box.y + box.h + 22 + r * (cs + 1), cs, cs); });
      }
    });
    return ax;
  }
  // left: residual stream composition (stacked by sign)
  v1 = A.canvas(cv1, { aspect: 0.8 }, (ctx, W_, H_) => {
    const box = { x: 40, y: 30, w: W_ - 52, h: H_ - 70 };
    const ymin = -1.6, ymax = 2.6;
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 4, ymin, ymax, xticks: [], yfmt: (v) => v.toFixed(1), ny: 4, ylabel: '残差流（“很”这个位置的 4 维向量）', ylabelOffset: 32 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0)); ctx.lineTo(box.x + box.w, ax.Y(0)); ctx.stroke(); ctx.restore();
    const parts = [{ v: X, c: CE() }];
    if (k >= 3) parts.push({ v: AT, c: CA() });
    if (k >= 8) parts.push({ v: M, c: CM() });
    const gw = box.w / 4, bw = Math.min(44, gw * 0.5);
    for (let i = 0; i < 4; i++) {
      let pos = 0, neg = 0;
      const x = box.x + i * gw + (gw - bw) / 2;
      parts.forEach((p, pi) => {
        const v = p.v[i]; if (Math.abs(v) < 1e-9) return;
        const base = v > 0 ? pos : neg, top = base + v;
        const fresh = (pi === 1 && k === 3) || (pi === 2 && k === 8);
        ctx.fillStyle = A.alpha(p.c, fresh ? 0.95 : 0.7);
        ctx.fillRect(x, Math.min(ax.Y(base), ax.Y(top)), bw, Math.abs(ax.Y(top) - ax.Y(base)));
        if (fresh) { ctx.save(); ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, Math.min(ax.Y(base), ax.Y(top)) + 0.5, bw - 1, Math.abs(ax.Y(top) - ax.Y(base)) - 1); ctx.restore(); }
        if (v > 0) pos = top; else neg = top;
      });
      const tot = A.sum(parts.map((p) => p.v[i]));
      ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(x + bw / 2, ax.Y(tot), 4.5, 0, 7); ctx.fill();
      A.text(ctx, f(tot), x + bw + 6, ax.Y(tot), { size: 12, mono: true, weight: 600 });
      A.text(ctx, '第 ' + (i + 1) + ' 维', box.x + i * gw + gw / 2, box.y + box.h + 12, { size: 11.5, align: 'center', color: A.css('--muted') });
    }
    const lab = k < 3 ? '= x' : k < 8 ? '= x + a' : '= x + a + m';
    A.text(ctx, lab, box.x + box.w - 4, box.y + 4, { size: 13, align: 'right', weight: 650, mono: true });
  });
  // right: what this step computes
  v2 = A.canvas(cv2, { aspect: 0.8 }, (ctx, W_, H_) => {
    const box = { x: 40, y: 30, w: W_ - 52, h: H_ - 70 };
    const dims = (v, c, a) => v.map((x, i) => ({ lab: '第 ' + (i + 1) + ' 维', bars: [{ v: x, c, a }] }));
    const title = (s) => A.text(ctx, s, box.x - 32, box.y - 16, { size: 12, color: A.css('--muted') });
    if (k === 0) { groups(ctx, box, dims(X, CE()), -1.6, 2.6); title('嵌入表中“很”的那一行'); }
    else if (k === 1 || k === 4) {
      const src = k === 1 ? X : H, dst = k === 1 ? U1 : U2;
      groups(ctx, box, src.map((x, i) => ({ lab: '第 ' + (i + 1) + ' 维', bars: [{ v: x, c: k === 1 ? CE() : A.css('--muted'), a: 0.35 }, { v: dst[i], c: CN() }] })), -1.6, 2.6);
      title((k === 1 ? 'x（淡）与 u = x / RMS(x)' : 'h（淡）与 u′ = h / RMS(h)') + '：方向不变，大小归一');
    } else if (k === 2) {
      // weights as bars on the left half, result on the right half
      const half = { x: box.x, y: box.y, w: box.w * 0.42, h: box.h };
      const axw = A.axes(ctx, half, { xmin: 0, xmax: 3, ymin: 0, ymax: 1, xticks: [], yticks: [0, 0.5, 1], yfmt: (v) => v.toFixed(1) });
      TOK.forEach((t, j) => {
        const gw = half.w / 3, bw = gw * 0.55, x = half.x + j * gw + (gw - bw) / 2;
        A.bar(ctx, x, axw.Y(W[j]), bw, axw.Y(0) - axw.Y(W[j]), A.alpha(CA(), 0.35 + 0.6 * W[j]), 3);
        A.text(ctx, W[j].toFixed(1), x + bw / 2, axw.Y(W[j]) - 8, { size: 11, align: 'center', mono: true });
        A.text(ctx, t, x + bw / 2, half.y + half.h + 12, { size: 11.5, align: 'center', color: A.css('--muted') });
      });
      const rest = { x: box.x + box.w * 0.55, y: box.y, w: box.w * 0.45, h: box.h };
      groups(ctx, rest, AT.map((x, i) => ({ lab: String(i + 1), bars: [{ v: x, c: CA() }] })), -1.6, 2.6);
      title('三个位置的注意力权重 → 加权和 a');
    } else if (k === 3) {
      groups(ctx, box, X.map((x, i) => ({ lab: '第 ' + (i + 1) + ' 维', bars: [{ v: x, c: CE() }, { v: AT[i], c: CA() }, { v: H[i], c: A.css('--ink'), a: 0.75 }] })), -1.6, 2.6);
      title('x、a，以及相加得到的 h');
    } else if (k === 5 || k === 6) {
      groups(ctx, { x: box.x, y: box.y, w: box.w, h: box.h - 34 }, Z.map((z, i) => ({ lab: 'k' + (i + 1), keys: K[i], bars: k === 5 ? [{ v: z, c: CM() }] : [{ v: z, c: A.css('--muted'), a: 0.25, lab: false }, { v: P[i], c: CM(), lab: P[i] > 0 }] })), -1.8, 1.8);
      title(k === 5 ? '8 个键各自的分数 z = u′ · kᵢ' : 'ReLU 之后：负分数被置零（淡色是原分数）');
    } else if (k === 7) {
      groups(ctx, box, dims(M, CM()), -1.6, 2.6);
      title('被激活的值向量加权求和：m');
    } else {
      groups(ctx, box, X.map((x, i) => ({ lab: '第 ' + (i + 1) + ' 维', bars: [{ v: x, c: CE(), a: 0.45 }, { v: X1[i], c: A.css('--ink'), a: 0.8 }] })), -1.6, 2.6);
      title('块的输入 x（淡）与输出 x′');
    }
  });
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); slider.value = k; render(); }
  function render() {
    const s = STEPS[k];
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}`;
    v1.redraw(); v2.redraw();
  }
  render();
});
