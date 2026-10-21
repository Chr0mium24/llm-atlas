/* moe-sizes — interactive demo (moved from ch07-moe.html) */
A.defineDemo('moe-sizes', function (mount) {
  const { bd } = A.demo(mount, '总参数 vs 激活参数：主流模型对比', '点击条形查看部署估算');
  const M = [
    { n: 'Mixtral 8×7B', t: 46.7, a: 12.9, cfg: '8 选 2', d: '2023-12' },
    { n: 'Llama 3.1 405B（稠密）', t: 405, a: 405, cfg: '稠密模型，所有参数每次都用', d: '2024-07' },
    { n: 'DeepSeek-V3', t: 671, a: 37, cfg: '256 选 8 + 1 共享', d: '2024-12' },
    { n: 'Qwen3-235B-A22B', t: 235, a: 22, cfg: '128 选 8', d: '2025-04' },
    { n: 'Kimi K2', t: 1000, a: 32, cfg: '384 选 8 + 1 共享', d: '2025-07' },
    { n: 'gpt-oss-120b', t: 117, a: 5.1, cfg: '128 选 4，MXFP4 发布', d: '2025-08' },
    { n: 'Qwen3-Next-80B-A3B', t: 80, a: 3, cfg: '512 选 10 + 1 共享，混合线性注意力', d: '2025-09' },
    { n: 'DeepSeek V4-Flash', t: 284, a: 13, cfg: '256 选 6 + 1 共享，前 3 层哈希路由', d: '2026-04' },
    { n: 'DeepSeek V4-Pro', t: 1600, a: 49, cfg: '384 选 6 + 1 共享，专家 FP4 QAT', d: '2026-04' },
    { n: 'Kimi K3', t: 2800, a: 104, cfg: '896 选 16 + 2 共享，MXFP4 专家', d: '2026-07' },
    { n: 'DeepSeek V4.1-Flash', t: 748, a: 16, cfg: '384 选 6 + 1 共享；552B 主体 + 196B Engram 查找表（条形按两者之和画）；激活 8B（预填充）/ 16B（解码），这里画解码', d: '2026-09' },
    { n: 'Reflection Beam 1.0', t: 501, a: 23, cfg: 'MoE，开源权重（2026-10-16 发布）', d: '2026-10' },
  ];
  let sel = 9;
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend', html: '<span><i style="background:var(--grid);border:1px solid var(--axis)"></i>总参数（决定显存）</span><span><i style="background:var(--s1)"></i>激活参数（决定每 token 计算量）</span>' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  let rows = [];
  const view = A.canvas(cv, { height: 400 }, (ctx, W, H) => {
    const lw = W < 560 ? 132 : 170, rowH = (H - 30) / M.length;
    const ax = A.axes(ctx, { x: lw, y: 4, w: W - lw - 20, h: H - 30 }, { xmin: 1, xmax: W < 560 ? 60000 : 12000, xlog: true, ymin: 0, ymax: 1, yticks: [], xticks: [1, 10, 100, 1000], xfmt: (v) => v + 'B', xgrid: true });
    rows = [];
    M.forEach((m, i) => {
      const y = 6 + i * rowH, bh = Math.min(18, rowH * 0.66);
      const on = i === sel;
      A.text(ctx, m.n, lw - 8, y + rowH / 2, { size: W < 560 ? 10.5 : 12.5, align: 'right', weight: on ? 700 : 400, color: on ? A.css('--ink') : A.css('--ink-2') });
      ctx.fillStyle = A.css('--grid'); ctx.fillRect(lw, y + (rowH - bh) / 2, ax.X(m.t) - lw, bh);
      ctx.strokeStyle = on ? A.css('--accent') : A.css('--axis'); ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(lw + 0.5, y + (rowH - bh) / 2 + 0.5, ax.X(m.t) - lw - 1, bh - 1);
      A.hbar(ctx, lw, y + (rowH - bh) / 2 + 3, ax.X(m.a) - lw, bh - 6, A.css('--s1'));
      A.text(ctx, `${m.a}B / ${m.t >= 1000 ? (m.t / 1000) + 'T' : m.t + 'B'}`, ax.X(m.t) + 4, y + rowH / 2, { size: W < 560 ? 9.5 : 11.5, mono: true, color: A.css('--muted') });
      rows.push([y, y + rowH]);
    });
  });
  cv.addEventListener('click', (e) => { const p = A.pos(cv, e); const i = rows.findIndex(([a, b]) => p.y >= a && p.y < b); if (i >= 0) { sel = i; view.redraw(); info(); } });
  cv.addEventListener('mousemove', (e) => { const p = A.pos(cv, e); cv.style.cursor = rows.some(([a, b]) => p.y >= a && p.y < b) ? 'pointer' : 'default'; });
  function info() {
    const m = M[sel];
    stats.innerHTML = '';
    [['模型', m.n + '（' + m.d + '）'], ['专家配置', m.cfg], ['激活比例', A.pct(m.a / m.t, 1)], ['权重 FP8', A.bytes(m.t * 1e9)], ['权重 4-bit', A.bytes(m.t * 1e9 * 0.53)], ['每 token 计算', A.sci(2 * m.a * 1e9) + ' FLOPs'], ['FP8 需要几张 80GB 卡', Math.ceil((m.t * 1e9 * 1.15) / 80e9) + ' 张']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '15px' } }, v))));
  }
  info();
});
