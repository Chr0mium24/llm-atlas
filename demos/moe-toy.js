/* moe-toy — the chapter's running toy: 6 tokens, 4 experts, top-2. Step through scores → softmax → top-k → gates → output → loads → capacity → aux loss → params → bias */
A.defineDemo('moe-toy', function (mount) {
  const { bd } = A.demo(mount, '手算一个 MoE 层：6 个 token、4 个专家、每个选 2 个', '数字都按正文的公式实际算出；单步查看');
  const Z = [[2, 1, 0, 0], [2, 0, 1, 0], [1, 2, 0, 0], [2, 0, 0, 1], [0, 1, 2, 0], [1, 0, 2, 0]];
  const T = Z.length, E = 4, K = 2, CAP = 3;
  const BIAS = [-0.6, 0, 0, 0.6];
  const sm = (a) => A.softmax(a);
  const P = Z.map(sm);
  const topk = (z) => z.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, K).map((x) => x[1]);
  const SEL = Z.map(topk);
  const SELB = Z.map((z) => topk(z.map((v, i) => v + BIAS[i])));
  const gates = (z, sel) => { const e = sel.map((i) => Math.exp(z[i])); const s = A.sum(e); return e.map((x) => x / s); };
  const G = Z.map((z, t) => gates(z, SEL[t]));
  const GB = Z.map((z, t) => gates(z, SELB[t]));
  const countLoad = (sel) => { const c = [0, 0, 0, 0]; sel.forEach((s) => s.forEach((i) => c[i]++)); return c; };
  const LOAD = countLoad(SEL), LOADB = countLoad(SELB);
  const F = LOAD.map((c) => c / (K * T));
  const PM = [0, 1, 2, 3].map((i) => A.mean(P.map((p) => p[i])));
  const AUX = E * A.sum(F.map((f, i) => f * PM[i]));
  // capacity: tokens processed in order t1..t6
  const used = [0, 0, 0, 0];
  const DROP = SEL.map((s) => s.map((i) => (used[i]++ >= CAP)));
  const f3 = (x) => x.toFixed(3), f2 = (x) => x.toFixed(2);
  const STEPS = [
    { t: '路由器打分', tex: String.raw`z_{t,i} = \mathbf x_t\,W_r\ \ (\text{第 } t \text{ 个 token 给第 } i \text{ 个专家的分数})`, say: '路由器是一个 d×4 的线性层，给每个 token 算 4 个分数。为了好算，这里每个 token 的分数都是 2、1、0、0 的某种排列：token 1 最喜欢专家 1，其次专家 2。注意 6 个 token 里有 4 个把专家 1 排在第一或第二。' },
    { t: 'softmax', tex: String.raw`p_{t,i} = \frac{e^{z_{t,i}}}{\sum_j e^{z_{t,j}}} = \frac{(7.39,\ 2.72,\ 1,\ 1)}{12.11} = (0.610,\ 0.225,\ 0.083,\ 0.083)`, say: '把分数变成和为 1 的概率。因为每行都是 2、1、0、0 的排列，每行的概率也都是 0.610、0.225、0.083、0.083 的排列。' },
    { t: '选 top-2', tex: String.raw`S_t = \operatorname{TopK}(\mathbf p_t,\ 2)`, say: '每个 token 只保留概率最高的 2 个专家（蓝底）。其余两个专家对这个 token 完全不计算：它们的参数在，但这一次不用。' },
    { t: '重新归一化', tex: String.raw`g_{t,i} = \frac{p_{t,i}}{\sum_{j\in S_t} p_{t,j}} = \frac{0.610}{0.610+0.225} = 0.731,\quad \frac{0.225}{0.835} = 0.269`, say: '被选中的两个概率再除以它们的和，变成门控权重，加起来等于 1。0.731 恰好是 e/(1+e)：两个分数差 1，权重比就是 e 倍。' },
    { t: '加权求和', tex: String.raw`\mathbf y_1 = 0.731\cdot\underbrace{(1,\,0)}_{\text{专家 1 的输出}} + 0.269\cdot\underbrace{(0,\,2)}_{\text{专家 2 的输出}} = (0.731,\ 0.538)`, say: '以 token 1 为例：专家 1 和专家 2 各算一遍（假设输出分别是 (1, 0) 和 (0, 2)），按门控权重加起来，就是这一层 MoE 的输出，再加回残差流。' },
    { t: '数负载', tex: String.raw`f_i = \frac{\text{专家 } i \text{ 被选中的次数}}{kT} = \frac{(5,\ 3,\ 3,\ 1)}{12} = (0.417,\ 0.25,\ 0.25,\ 0.083)`, say: '6 个 token × 2 = 12 次分配。专家 1 收到 5 次，专家 4 只有 1 次。均匀的话每个专家应该是 3 次。' },
    { t: '容量与丢 token', tex: String.raw`C = \Big\lfloor c\cdot\frac{kT}{E}\Big\rfloor = \Big\lfloor 1.0\times\frac{12}{4}\Big\rfloor = 3`, say: '每个专家每批最多处理 C = 3 次分配（容量因子 c = 1.0）。按顺序处理，专家 1 收满 t1、t2、t3 后，t4 和 t6 送来的那一份被丢掉（红叉）：这两个 token 只剩另一个专家的输出。' },
    { t: '辅助损失', tex: String.raw`E\sum_i f_iP_i = 4\times(\underbrace{0.417\times0.394}_{\text{专家 1}} + 0.054 + 0.071 + 0.009) = 1.19`, say: 'P_i 是 6 个 token 给专家 i 的平均概率（浅色条）。完全均匀时这个值是 1，这里是 1.19。它的梯度会把专家 1 的分数往下压、把专家 4 往上抬（见“负载均衡”一节的推导）。' },
    { t: '参数账', tex: String.raw`\text{总参数} = 4P,\qquad \text{每个 token 激活} = 2P`, say: '设每个专家有 P 个参数。这一层总共存了 4P，每个 token 只算 2P。和一个参数为 2P 的稠密 MLP 相比：计算量相同，参数多了一倍。DeepSeek-V3 是 256 个专家选 8 个（外加 1 个共享专家），比例更悬殊。' },
    { t: '预告：加偏置', tex: String.raw`S_t = \operatorname{TopK}(\mathbf z_t + \mathbf b),\quad \mathbf b = (-0.6,\ 0,\ 0,\ +0.6)\ \Rightarrow\ \text{负载} = (3,\ 3,\ 3,\ 3)`, say: '给专家 1 减 0.6、专家 4 加 0.6，只在“选谁”时用。t3 和 t6 的第二选择从专家 1 换成了专家 4，负载变成完全均匀。门控权重仍按原分数算：t3 选中专家 2（分数 2）和专家 4（分数 0），权重 0.881 和 0.119。这是“无辅助损失均衡”一节的做法。' },
  ];
  let k = 0;
  const bar = A.el('div', { class: 'flex', style: { marginBottom: '8px' } });
  const prev = A.el('button', { onclick: () => go(k - 1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => go(k + 1) }, '下一步 →');
  bar.append(prev, next);
  const slider = A.el('input', { type: 'range', min: 0, max: STEPS.length - 1, step: 1, value: 0, style: { width: '100%' } });
  slider.oninput = () => go(+slider.value);
  const dots = A.el('div', { class: 'gs-dots' });
  const dotEls = STEPS.map((s, i) => { const d = A.el('button', { class: 'gs-dot', onclick: () => go(i) }, (i + 1) + ' ' + s.t); dots.append(d); return d; });
  const fx = A.el('div', { class: 'gs-fx' }), say = A.el('p', { class: 'gs-say' });
  const cv = A.el('canvas', { class: 'cv' });
  const legend = A.el('div', { class: 'legend' });
  bd.append(bar, slider, dots, fx, say, cv, legend);
  let cells = [];
  const view = A.canvas(cv, { aspect: 0.44 }, (ctx, W, H) => {
    const cols = A.series(), ink = A.css('--ink'), muted = A.css('--muted'), accent = A.css('--accent'), bad = A.css('--bad');
    const useB = k === 9;
    const sel = useB ? SELB : SEL, gg = useB ? GB : G;
    // ---- table
    const tx = 44, ty = 46, tw = Math.min(W * 0.56, 420), cw = tw / E, rh = Math.min(30, (H - ty - 14) / T);
    A.text(ctx, k === 0 ? '路由分数 z' : k === 1 ? '概率 p' : k >= 3 ? '门控权重 g（只有选中的两个）' : '概率 p，蓝底 = 被选中', tx - 34, 10, { size: 12, color: muted });
    for (let i = 0; i < E; i++) A.text(ctx, '专家 ' + (i + 1), tx + i * cw + cw / 2, ty - 8, { size: 12, align: 'center', weight: 600, color: cols[i] });
    cells = [];
    for (let t = 0; t < T; t++) {
      const y = ty + t * rh;
      A.text(ctx, 't' + (t + 1), tx - 10, y + rh / 2, { size: 12.5, align: 'right', weight: k === 4 && t === 0 ? 700 : 500, color: k === 4 && t === 0 ? ink : A.css('--ink-2') });
      for (let i = 0; i < E; i++) {
        const x = tx + i * cw;
        const j = sel[t].indexOf(i), isSel = j >= 0 && k >= 2;
        const dropped = !useB && k >= 6 && k <= 8 && j >= 0 && DROP[t][j];
        ctx.fillStyle = isSel ? A.alpha(accent, k === 4 && t !== 0 ? 0.08 : 0.2) : A.alpha(A.css('--grid'), 0.35);
        ctx.fillRect(x + 2, y + 2, cw - 4, rh - 4);
        let s;
        if (k === 0) s = String(Z[t][i]);
        else if (k <= 2) s = f3(P[t][i]);
        else s = j >= 0 ? f3(gg[t][j]) : '·';
        A.text(ctx, s, x + cw / 2, y + rh / 2, { size: 12.5, align: 'center', mono: true, color: isSel || k < 2 ? ink : muted });
        if (useB && j >= 0 && SEL[t].indexOf(i) < 0) { ctx.strokeStyle = cols[3]; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, cw - 6, rh - 6); }
        if (dropped) {
          ctx.strokeStyle = bad; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(x + 8, y + 6); ctx.lineTo(x + cw - 8, y + rh - 6); ctx.moveTo(x + cw - 8, y + 6); ctx.lineTo(x + 8, y + rh - 6); ctx.stroke();
        }
        cells.push({ x, y, w: cw, h: rh, t, i });
      }
    }
    // ---- load bars
    const bx = tx + tw + 50, bw = W - bx - 16;
    if (k >= 5 && bw > 80) {
      const load = useB ? LOADB : LOAD;
      const box = { x: bx, y: ty, w: bw, h: rh * T - 18 };
      const ymax = 6;
      const ax = A.axes(ctx, box, { xmin: 0, xmax: E, ymin: 0, ymax, yticks: [0, 1, 2, 3, 4, 5, 6], xticks: [], yfmt: (v) => v, ylabel: k === 7 ? '分配次数 / 平均概率×12' : '收到的分配次数', ylabelOffset: 30 });
      const w = box.w / E * 0.6;
      for (let i = 0; i < E; i++) {
        const xc = ax.X(i + 0.5);
        if (k === 7) {
          const ph = PM[i] * K * T;
          A.bar(ctx, xc - w / 2 - 2, ax.Y(ph), w / 2, ax.Y(0) - ax.Y(ph), A.alpha(cols[i], 0.35), 2);
          A.bar(ctx, xc + 2, ax.Y(load[i]), w / 2, ax.Y(0) - ax.Y(load[i]), cols[i], 2);
        } else {
          A.bar(ctx, xc - w / 2, ax.Y(load[i]), w, ax.Y(0) - ax.Y(load[i]), cols[i], 3);
          if (k === 6 && load[i] > CAP) { ctx.fillStyle = A.alpha(bad, 0.35); ctx.fillRect(xc - w / 2, ax.Y(load[i]), w, ax.Y(CAP) - ax.Y(load[i])); }
        }
        A.text(ctx, String(load[i]), xc, ax.Y(load[i]) - 9, { size: 12, align: 'center', mono: true });
        A.text(ctx, 'E' + (i + 1), xc, box.y + box.h + 12, { size: 11.5, align: 'center', color: muted });
      }
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = k === 6 ? bad : A.css('--axis'); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(box.x, ax.Y(3)); ctx.lineTo(box.x + box.w, ax.Y(3)); ctx.stroke(); ctx.restore();
    } else if (bw > 80) {
      A.text(ctx, '第 6 步起，这里显示每个专家收到多少次分配', bx, ty + 20, { size: 12, color: muted });
    }
  });
  cv.addEventListener('mousemove', (e) => {
    const p = A.pos(cv, e);
    const c = cells.find((c) => p.x >= c.x && p.x < c.x + c.w && p.y >= c.y && p.y < c.y + c.h);
    if (!c) { A.tip.hide(); return; }
    const useB = k === 9, sel = useB ? SELB : SEL, gg = useB ? GB : G;
    const j = sel[c.t].indexOf(c.i);
    const extra = useB ? `，加偏置后的分数 ${(Z[c.t][c.i] + BIAS[c.i]).toFixed(1)}` : '';
    A.tip.show(`t${c.t + 1} → 专家 ${c.i + 1}<br>分数 z = ${Z[c.t][c.i]}${extra}，概率 p = ${f3(P[c.t][c.i])}<br>${j >= 0 ? '被选中，门控权重 ' + f3(gg[c.t][j]) + (!useB && DROP[c.t][j] ? '（容量 3 时被丢弃）' : '') : '没被选中：不计算'}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  function go(i) { k = A.clamp(i, 0, STEPS.length - 1); slider.value = k; render(); }
  function render() {
    const s = STEPS[k];
    prev.disabled = k === 0; next.disabled = k === STEPS.length - 1;
    dotEls.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('done', i < k); });
    if (window.katex) katex.render(s.tex, fx, { displayMode: true, throwOnError: false }); else fx.textContent = s.tex;
    say.innerHTML = `<b>第 ${k + 1} 步 · ${s.t}。</b>${s.say}`;
    legend.innerHTML = k === 7 ? '<span><i style="background:var(--s1);opacity:.35"></i>浅色：平均概率 P<sub>i</sub> × 12（可导）</span><span><i style="background:var(--s1)"></i>深色：实际分配次数（不可导）</span><span><i class="line" style="background:var(--axis)"></i>虚线：均匀时每个专家 3 次</span>'
      : k === 9 ? '<span><i style="background:none;border:2px solid var(--s4)"></i>加偏置后换了专家的分配</span><span><i class="line" style="background:var(--axis)"></i>虚线：均匀时每个专家 3 次</span>'
        : '<span><i style="background:var(--accent-soft);border:1px solid var(--accent)"></i>被选中的专家</span>' + (k >= 6 && k <= 8 ? '<span style="color:var(--bad)">✕ 超出容量被丢弃</span>' : '') + (k >= 5 ? '<span><i class="line" style="background:' + (k === 6 ? 'var(--bad)' : 'var(--axis)') + '"></i>虚线：' + (k === 6 ? '容量 C = 3' : '均匀时每个专家 3 次') + '</span>' : '');
    view.redraw();
  }
  render();
  // self-check of the numbers quoted in the text
  if (Math.abs(AUX - 1.19) > 0.01 || LOAD.join() !== '5,3,3,1' || LOADB.join() !== '3,3,3,3') console.warn('moe-toy: numbers drifted', AUX, LOAD, LOADB);
});
