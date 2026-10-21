/* moe-router — bias ("price") balancing on a fixed set of tokens: which assignments get moved, and how little score they give up. Token vectors are random (no topics). */
A.defineDemo('moe-router', function (mount) {
  const { bd } = A.demo(mount, '价格把哪些 token 挪走了', '玩具模型（示意）：24 个随机 token，路由器偏爱前 3 个专家；无辅助损失偏置均衡（DeepSeek-V3 风格）');
  const NT = 24, D = 8, SKEW = 1.5, STEP = 0.08;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const ES = A.slider(ctl, { label: '专家数 E', min: 4, max: 32, step: 1, value: 16, fmt: (v) => v, on: () => { init(); } });
  const KS = A.slider(ctl, { label: '每个 token 选 k 个', min: 1, max: 8, step: 1, value: 2, fmt: (v) => v, on: () => route() });
  const CF = A.slider(ctl, { label: '容量因子', min: 0.5, max: 3, step: 0.05, value: 1.25, fmt: (v) => v.toFixed(2) + '×', on: () => route() });
  const chk = A.el('div', { class: 'flex', style: { marginBottom: '8px' } }); bd.append(chk);
  let shared = false;
  A.check(chk, '加 1 个共享专家', false, (v) => { shared = v; route(); });
  let timer = null;
  chk.append(A.el('button', { class: 'primary', onclick: () => { if (timer) { clearInterval(timer); timer = null; return; } timer = setInterval(() => { balanceStep(); if (iter >= 300) { clearInterval(timer); timer = null; } }, 50); } }, '开始 / 暂停调价'),
    A.el('button', { onclick: () => { balanceStep(); } }, '调一步'),
    A.el('button', { onclick: () => { if (timer) { clearInterval(timer); timer = null; } init(); } }, '重置（价格归零）'));
  const stat = A.el('div', { class: 'small', style: { margin: '4px 0 6px' } }); bd.append(stat);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  bd.append(A.el('p', { class: 'hint', html: 'token 的向量是随机数，不代表任何主题或语言。路由器给专家 1–3 额外加了分（模拟一个偏心的路由器），所以一开始它们被挤爆。每调一步：收到的 token 多于平均的专家涨价（偏置 b<sub>i</sub> 减 0.08），少于平均的降价。<b>橙色连线</b> = 和不加价格时相比被换了专家的分配；灰线粗细 = 门控权重。门控权重始终按原始分数算，价格只决定选谁。' }));
  let r, tokens, experts, skew, bias, iter, assign, load, cap;
  function init() {
    r = A.rng(17); iter = 0;
    const E = ES.value;
    tokens = Array.from({ length: NT }, (_, i) => ({ w: 't' + (i + 1), v: Array.from({ length: D }, () => A.gauss(r)) }));
    experts = Array.from({ length: E }, () => Array.from({ length: D }, () => A.gauss(r) * 0.5));
    skew = Array.from({ length: E }, (_, e) => (e < 3 ? SKEW - (e * SKEW) / 3 : 0));
    tokens.forEach((tk) => { tk.s = experts.map((ev, e) => A.dot(tk.v, ev) + skew[e]); });
    bias = new Array(E).fill(0);
    route();
  }
  const topk = (s, b, k) => s.map((x, e) => ({ e, sb: x + b[e] })).sort((a, c) => c.sb - a.sb).slice(0, k).map((x) => x.e);
  function route() {
    const E = experts.length, k = Math.min(KS.value, E);
    cap = Math.max(1, Math.floor((CF.value * NT * k) / E));
    load = new Array(E).fill(0);
    const zero = new Array(E).fill(0);
    let moved = 0, gap = 0;
    assign = tokens.map((tk) => {
      const sel = topk(tk.s, bias, k), base = topk(tk.s, zero, k);
      const g = A.softmax(sel.map((e) => tk.s[e]));
      const out = base.filter((e) => !sel.includes(e)), inn = sel.filter((e) => !base.includes(e));
      inn.forEach((e, j) => { moved++; gap += tk.s[out[j]] - tk.s[e]; });
      return sel.map((e, i) => ({ e, g: g[i], sw: !base.includes(e) }));
    });
    const used = new Array(E).fill(0);
    assign.forEach((as) => as.forEach((a) => { load[a.e]++; a.drop = used[a.e] >= cap; used[a.e]++; }));
    const mean = (NT * k) / E;
    const dropped = assign.reduce((s, as) => s + as.filter((a) => a.drop).length, 0);
    let spread = 0; tokens.forEach((tk) => { const so = tk.s.slice().sort((a, c) => c - a); spread += so[0] - so[Math.floor(E / 2)]; });
    stat.innerHTML = `调价 ${iter} 步　最大负载 / 平均 = <b>${(Math.max(...load) / mean).toFixed(2)}</b>　丢弃 <b>${dropped}</b> / ${NT * k}　空闲专家 <b>${load.filter((x) => x === 0).length}</b><br>被价格换走的分配 <b>${moved}</b> 次，平均每次让出的路由分数 <b>${moved ? (gap / moved).toFixed(2) : '—'}</b>（对照：一个 token 的最高分比排在中间的专家平均高 ${(spread / NT).toFixed(2)}）`;
    view.redraw();
  }
  function balanceStep() {
    const E = experts.length, k = Math.min(KS.value, E), mean = (NT * k) / E;
    for (let e = 0; e < E; e++) bias[e] -= STEP * Math.sign(load[e] - mean);
    iter++; route();
  }
  const view = A.canvas(cv, { get aspect() { return (cv.clientWidth || 600) < 560 ? 1.25 : 0.62; } }, (ctx, W, H) => {
    const cols = A.series(), E = experts.length, muted = A.css('--muted'), ink = A.css('--ink');
    const narrow = W < 560;
    const tx = narrow ? 34 : 70, rowH = (H - 20) / tokens.length;
    const ex0 = W * (narrow ? 0.4 : 0.46), ew = (W - ex0 - 10) / E;
    const barBase = H - 42, barTop = 60;
    const maxLoad = Math.max(...load, cap) * 1.1;
    for (let e = 0; e < E; e++) {
      const x = ex0 + e * ew;
      const h = (load[e] / maxLoad) * (barBase - barTop);
      A.bar(ctx, x + 2, barBase - h, ew - 4, h, e < 3 ? A.alpha(cols[0], 0.8) : A.alpha(muted, 0.55), 3);
      A.text(ctx, String(e + 1), x + ew / 2, barBase + 11, { size: Math.min(11, ew * 0.6), align: 'center', color: muted });
      if (ew >= 16) A.text(ctx, (-bias[e]).toFixed(1), x + ew / 2, barBase + 26, { size: Math.min(10, ew * 0.42), align: 'center', mono: true, color: bias[e] < 0 ? cols[0] : bias[e] > 0 ? ink : muted });
    }
    if (ew >= 16) A.text(ctx, '价格', ex0 - 6, barBase + 26, { size: 10.5, align: 'right', color: muted });
    A.text(ctx, '专家', ex0 - 6, barBase + 11, { size: 10.5, align: 'right', color: muted });
    const capY = barBase - (cap / maxLoad) * (barBase - barTop);
    ctx.strokeStyle = cols[7]; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ex0, capY); ctx.lineTo(W - 10, capY); ctx.stroke(); ctx.setLineDash([]);
    A.text(ctx, '容量上限', W - 12, capY - 8, { size: 11, color: cols[7], align: 'right' });
    A.text(ctx, '每个专家收到的分配数', ex0, 20, { size: 12, color: muted });
    tokens.forEach((tk, i) => {
      const y = 10 + i * rowH + rowH / 2;
      assign[i].forEach((a) => {
        const x2 = ex0 + a.e * ew + ew / 2;
        ctx.strokeStyle = a.drop ? A.alpha(cols[7], 0.85) : a.sw ? A.alpha(cols[3], 0.9) : A.alpha(muted, 0.2 + 0.45 * a.g);
        ctx.lineWidth = a.sw || a.drop ? 1.8 : 0.6 + 2.2 * a.g;
        ctx.beginPath(); ctx.moveTo(tx + 4, y); ctx.bezierCurveTo(tx + (narrow ? 60 : 120), y, x2, barTop - 40, x2, barTop - 6); ctx.stroke();
      });
      if (shared) { ctx.strokeStyle = A.alpha(muted, 0.25); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tx + 4, y); ctx.lineTo(ex0 - 30, 36); ctx.stroke(); }
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(tx, y, 2.5, 0, 7); ctx.fill();
      A.text(ctx, tk.w, tx - 7, y, { size: Math.min(11, rowH * 0.85), align: 'right', mono: true, color: muted });
    });
    if (shared) { ctx.fillStyle = muted; ctx.fillRect(ex0 - 60, 28, 50, 16); A.text(ctx, '共享专家', ex0 - 35, 36, { size: 10.5, align: 'center', color: A.css('--surface') }); }
  });
  legend.innerHTML = '<span><i style="background:var(--s1)"></i>路由器偏爱的专家 1–3</span><span><i style="background:var(--muted)"></i>其余专家</span><span><i class="line" style="background:var(--s4)"></i>被价格换了专家的分配</span><span><i class="line" style="background:var(--s8)"></i>超出容量被丢弃</span>';
  init();
});
