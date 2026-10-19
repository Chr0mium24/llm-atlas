/* kv-cache — interactive demo (moved from ch08-long-context.html) */
A.defineDemo('kv-cache', function (mount) {
  const { bd } = A.demo(mount, 'KV cache 计算器：同一个 70B 级模型，换不同的注意力', '80 层 · 64 个 Q 头 · 头维度 128');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  let bytes = 2;
  A.seg(ctl, [{ v: 2, t: 'BF16' }, { v: 1, t: 'FP8' }, { v: 0.5625, t: '4-bit' }], 2, (v) => { bytes = v; view.redraw(); }, 'KV 精度');
  const B = A.slider(ctl, { label: '并发请求数（batch）', min: 1, max: 64, step: 1, value: 1, fmt: (v) => v, on: () => view.redraw() });
  const L = 80, H = 64, DH = 128;
  const V = [
    { n: 'MHA（64 组 KV）', c: 7, f: (n) => 2 * L * H * DH * bytes * n },
    { n: 'GQA-8（Llama 3 70B）', c: 0, f: (n) => 2 * L * 8 * DH * bytes * n },
    { n: 'MQA（1 组 KV）', c: 2, f: (n) => 2 * L * 1 * DH * bytes * n },
    { n: 'MLA（512+64 维潜向量）', c: 1, f: (n) => L * 576 * bytes * n },
    { n: '滑窗 5:1（局部窗口 1024）', c: 4, f: (n) => (L / 6) * 2 * 8 * DH * bytes * n + ((5 * L) / 6) * 2 * 8 * DH * bytes * Math.min(n, 1024) },
    { n: '混合 3:1（线性 + MLA）', c: 6, f: (n) => (L / 4) * 576 * bytes * n + ((3 * L) / 4) * H * DH * DH * bytes },
  ];
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  legend.innerHTML = V.map((v) => `<span><i class="line" style="background:var(--s${v.c + 1})"></i>${v.n}</span>`).join('');
  bd.append(A.el('p', { class: 'hint' }, '纵轴是对数刻度。混合 3:1 在短上下文时反而更大，因为线性注意力层各有一个固定的 128×128 状态矩阵（每头），但它不随长度增长；上下文到几十万以后，优势非常明显。鼠标悬停查看具体数值。'));
  let mx = null;
  const view = A.canvas(cv, { aspect: 0.5 }, (ctx, W, Hh) => {
    const box = { x: 58, y: 14, w: W - 78, h: Hh - 48 };
    const b = B.value;
    const ax = A.axes(ctx, box, { xmin: 1024, xmax: 1048576, xlog: true, xticks: [1024, 8192, 32768, 131072, 1048576], xfmt: (v) => (v >= 1048576 ? '1M' : v / 1024 + 'K'), ymin: 1e7, ymax: 1e13, ylog: true, yfmt: (v) => A.bytes(v, 0), xlabel: '上下文长度', xgrid: true });
    const cols = A.series();
    [[16e9, '16 GB（M3 Mac）'], [80e9, '80 GB（H100）'], [192e9, '192 GB（B200）']].forEach(([v, t]) => {
      const y = ax.Y(v); ctx.strokeStyle = A.css('--muted'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.setLineDash([]);
      A.text(ctx, t, box.x + 4, y - 7, { size: 11, color: A.css('--muted') });
    });
    V.forEach((v) => {
      ctx.strokeStyle = cols[v.c]; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 200; i++) { const n = Math.pow(2, 10 + (i / 200) * 10); const y = ax.Y(A.clamp(v.f(n) * b, 1e7, 1e13)); i ? ctx.lineTo(ax.X(n), y) : ctx.moveTo(ax.X(n), y); }
      ctx.stroke();
    });
    if (mx !== null && mx >= box.x && mx <= box.x + box.w) {
      const n = Math.round(ax.invX(mx));
      ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(mx, box.y); ctx.lineTo(mx, box.y + box.h); ctx.stroke();
      V.forEach((v) => { ctx.fillStyle = cols[v.c]; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, ax.Y(A.clamp(v.f(n) * b, 1e7, 1e13)), 4, 0, 7); ctx.fill(); ctx.stroke(); });
      view._tip = `<b>${A.human(n, 0)} token × ${b} 个请求</b><br>` + V.map((v) => `<span style="color:${cols[v.c]}">●</span> ${v.n}：${A.bytes(v.f(n) * b)}`).join('<br>');
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { const p = A.pos(cv, e); mx = p.x; view.redraw(); if (view._tip) A.tip.show(view._tip, e.clientX, e.clientY); else A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { mx = null; view.redraw(); A.tip.hide(); });
  const tbl = A.el('div', { class: 'tablewrap' }); bd.append(tbl);
  tbl.innerHTML = `<table><tr><th>真实模型</th><th>注意力</th><th class="num">KV / token（BF16）</th><th class="num">128K 上下文</th><th class="num">1M 上下文</th></tr>
  ${[['Llama 3 8B', 'GQA 32 层 × 8 头', 2 * 32 * 8 * 128 * 2], ['Llama 3 70B', 'GQA 80 层 × 8 头', 2 * 80 * 8 * 128 * 2], ['DeepSeek-V3', 'MLA 61 层 × 576', 61 * 576 * 2], ['Kimi K3（估算）', '24 层 Gated MLA × 576 + 69 层 KDA 固定状态', 24 * 576 * 2]]
    .map(([n, a, b]) => `<tr><td>${n}</td><td class="small">${a}</td><td class="num">${A.bytes(b)}</td><td class="num">${A.bytes(b * 131072)}</td><td class="num">${A.bytes(b * 1048576)}</td></tr>`).join('')}</table>`;
});
