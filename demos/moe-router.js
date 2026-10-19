/* moe-router — interactive demo (moved from ch07-moe.html) */
A.defineDemo('moe-router', function (mount) {
  const { bd } = A.demo(mount, '路由模拟器：token 怎么分给专家', '无辅助损失偏置均衡（DeepSeek-V3 风格）');
  const TYPES = [
    { n: '代码', w: ['def', 'return', '{', 'import', 'for', 'self'] },
    { n: '数学', w: ['∫', '=', '证明', 'x²', '矩阵', '求导'] },
    { n: '中文', w: ['的', '我们', '天气', '因为', '春天', '说'] },
    { n: '英文', w: ['the', 'house', 'running', 'because', 'beautiful', 'and'] },
  ];
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const ES = A.slider(ctl, { label: '专家数 E', min: 4, max: 32, step: 1, value: 16, fmt: (v) => v, on: () => { init(); } });
  const KS = A.slider(ctl, { label: '每个 token 选 k 个', min: 1, max: 8, step: 1, value: 2, fmt: (v) => v, on: () => route() });
  const CF = A.slider(ctl, { label: '容量系数', min: 0.5, max: 3, step: 0.05, value: 1.25, fmt: (v) => v.toFixed(2) + '×', on: () => route() });
  const chk = A.el('div', { class: 'flex', style: { marginBottom: '8px' } }); bd.append(chk);
  let shared = false;
  A.check(chk, '加 1 个共享专家', false, (v) => { shared = v; route(); });
  let timer = null;
  chk.append(A.el('button', { class: 'primary', onclick: () => { if (timer) { clearInterval(timer); timer = null; return; } timer = setInterval(() => { balanceStep(); if (iter > 300) { clearInterval(timer); timer = null; } }, 50); } }, '开始 / 暂停均衡'),
    A.el('button', { onclick: () => init() }, '重置（不均衡的初始路由器）'));
  const stat = A.el('span', { class: 'small' }); chk.append(stat);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  bd.append(A.el('p', { class: 'hint' }, '初始路由器故意偏向前几个专家（模拟路由坍缩）。点“开始均衡”，每一步把超载专家的偏置调低、闲置专家的调高。红色虚线 = 容量上限，超出容量的 token 被丢弃（连线变红）。'));
  const D = 8; let r, tokens, experts, bias, iter, assign, load;
  function init() {
    r = A.rng(17); iter = 0;
    const E = ES.value;
    const typeVec = TYPES.map(() => Array.from({ length: D }, () => A.gauss(r)));
    tokens = [];
    TYPES.forEach((t, ti) => t.w.forEach((w) => tokens.push({ w, t: ti, v: typeVec[ti].map((x) => x + A.gauss(r) * 0.7) })));
    experts = Array.from({ length: E }, () => Array.from({ length: D }, () => A.gauss(r) * 0.5));
    bias = Array.from({ length: E }, (_, e) => (e < 3 ? 3.2 - e * 0.6 : 0));
    route();
  }
  function route() {
    const E = experts.length, k = Math.min(KS.value, E);
    const cap = Math.max(1, Math.round((CF.value * tokens.length * k) / E));
    load = new Array(E).fill(0);
    assign = tokens.map((tk) => {
      const s = experts.map((ev, e) => A.dot(tk.v, ev));
      const sel = s.map((x, e) => ({ e, sb: x + bias[e], s: x })).sort((a, b) => b.sb - a.sb).slice(0, k);
      const g = A.softmax(sel.map((x) => x.s));
      return sel.map((x, i) => ({ e: x.e, g: g[i] }));
    });
    // capacity: process tokens in order
    const used = new Array(E).fill(0);
    assign.forEach((as) => as.forEach((a) => { load[a.e]++; a.drop = used[a.e] >= cap; used[a.e]++; }));
    const mean = (tokens.length * k) / E;
    const dropped = assign.reduce((s, as) => s + as.filter((a) => a.drop).length, 0);
    stat.innerHTML = `迭代 ${iter}　最大负载 / 平均 = <b>${(Math.max(...load) / mean).toFixed(2)}</b>　丢弃 <b>${dropped}</b> / ${tokens.length * k} 次分配　空闲专家 <b>${load.filter((x) => x === 0).length}</b>`;
    view._cap = cap;
    view.redraw();
  }
  function balanceStep() {
    const E = experts.length, k = KS.value, mean = (tokens.length * k) / E;
    for (let e = 0; e < E; e++) bias[e] -= 0.08 * Math.sign(load[e] - mean);
    iter++; route();
  }
  const view = A.canvas(cv, { aspect: 0.62 }, (ctx, W, H) => {
    const cols = A.series(), E = experts.length;
    const tx = 90, rowH = (H - 20) / tokens.length;
    const ex0 = W * 0.48, ew = (W - ex0 - 10) / E;
    const barBase = H - 30, barTop = 60;
    const maxLoad = Math.max(...load, view._cap) * 1.1;
    // expert load bars
    for (let e = 0; e < E; e++) {
      const x = ex0 + e * ew;
      const h = (load[e] / maxLoad) * (barBase - barTop);
      A.bar(ctx, x + 2, barBase - h, ew - 4, h, A.alpha(cols[6], 0.75), 3);
      A.text(ctx, 'E' + (e + 1), x + ew / 2, barBase + 12, { size: Math.min(11, ew * 0.45), align: 'center', color: A.css('--muted') });
    }
    const capY = barBase - (view._cap / maxLoad) * (barBase - barTop);
    ctx.strokeStyle = cols[7]; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ex0, capY); ctx.lineTo(W - 10, capY); ctx.stroke(); ctx.setLineDash([]);
    A.text(ctx, '容量上限', W - 12, capY - 8, { size: 11, color: cols[7], align: 'right' });
    A.text(ctx, '每个专家收到的 token 数', ex0, 20, { size: 12, color: A.css('--muted') });
    // links
    tokens.forEach((tk, i) => {
      const y = 10 + i * rowH + rowH / 2;
      assign[i].forEach((a) => {
        const x2 = ex0 + a.e * ew + ew / 2;
        ctx.strokeStyle = a.drop ? A.alpha(cols[7], 0.8) : A.alpha(cols[tk.t], 0.25 + 0.5 * a.g);
        ctx.lineWidth = 0.6 + 2.4 * a.g;
        ctx.beginPath(); ctx.moveTo(tx + 4, y); ctx.bezierCurveTo(tx + 120, y, x2, barTop - 40, x2, barTop - 6); ctx.stroke();
      });
      if (shared) { ctx.strokeStyle = A.alpha(A.css('--muted'), 0.25); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(tx + 4, y); ctx.lineTo(ex0 - 30, 36); ctx.stroke(); }
      ctx.fillStyle = cols[tk.t]; ctx.beginPath(); ctx.arc(tx, y, 3.5, 0, 7); ctx.fill();
      A.text(ctx, tk.w, tx - 8, y, { size: Math.min(12, rowH * 0.8), align: 'right', mono: true });
    });
    if (shared) { ctx.fillStyle = A.css('--muted'); ctx.fillRect(ex0 - 60, 28, 50, 16); A.text(ctx, '共享专家', ex0 - 35, 36, { size: 10.5, align: 'center', color: A.css('--surface') }); }
  });
  legend.innerHTML = TYPES.map((t, i) => `<span><i style="background:var(--s${i + 1});border-radius:50%"></i>${t.n} token</span>`).join('') + '<span><i class="line" style="background:var(--s8)"></i>超出容量被丢弃</span>';
  init();
});
