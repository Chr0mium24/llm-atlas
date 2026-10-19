/* model-scale — interactive demo (moved from ch14-frontier.html) */
A.defineDemo('model-scale', function (mount) {
  const { bd } = A.demo(mount, '开源权重模型：总参数 vs 激活参数', '悬停查看；纵轴对数刻度');
  const M = [
    ['LLaMA 65B', 2023.12, 65, 65], ['Llama 2 70B', 2023.55, 70, 70], ['Mixtral 8×7B', 2023.95, 46.7, 12.9], ['Llama 3 70B', 2024.3, 70.6, 70.6],
    ['Llama 3.1 405B', 2024.55, 405, 405], ['DeepSeek-V3', 2024.98, 671, 37], ['Qwen3-235B-A22B', 2025.3, 235, 22], ['Kimi K2', 2025.53, 1000, 32],
    ['gpt-oss-120b', 2025.6, 117, 5.1], ['Qwen3-Next-80B-A3B', 2025.7, 80, 3], ['DeepSeek V4-Pro', 2026.35, 1600, 49, '2026 上半年'], ['DeepSeek V4-Flash', 2026.38, 284, 13, '2026 上半年'],
    ['Kimi K3', 2026.55, 2800, 104], ['Reflection Beam 1.0', 2026.79, 501, 23], ['Muse Spark Open', 2026.8, 816, null],
  ];
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--s1);border-radius:50%"></i>总参数（决定要多大显存）</span><span><i style="background:var(--s2);border-radius:50%"></i>激活参数（决定每 token 计算量）</span><span>竖线连接同一个模型；Muse Spark Open 未公布激活参数</span>' }));
  bd.append(A.el('p', { class: 'hint' }, '2023 年的开源模型是 70B 级稠密模型，总参数等于激活参数。2026 年总参数涨到 1–3T，激活参数仍然维持在 10–100B：MoE 让知识容量和计算量脱钩（' + A.cref('moe') + '），量化让这么多参数能放得下（' + A.cref('quantization') + '）。'));
  let hov = -1, pts = [];
  const fmtDate = (d) => { const y = Math.floor(d), m = Math.min(12, Math.max(1, Math.round((d - y) * 12) + 1)); return y + '-' + String(m).padStart(2, '0'); };
  const view = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    const box = { x: 54, y: 16, w: W - 74, h: H - 46 };
    const ax = A.axes(ctx, box, { xmin: 2023, xmax: 2027, xticks: [2023, 2024, 2025, 2026, 2027], xfmt: (v) => v, ymin: 1, ymax: 5000, ylog: true, yticks: [1, 10, 100, 1000], yfmt: (v) => (v >= 1000 ? v / 1000 + 'T' : v + 'B'), xgrid: true });
    const cols = A.series();
    pts = [];
    M.forEach((m, i) => {
      const x = ax.X(m[1]), yt = ax.Y(m[2]), ya = m[3] ? ax.Y(m[3]) : null;
      if (ya !== null && Math.abs(yt - ya) > 1) { ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, yt); ctx.lineTo(x, ya); ctx.stroke(); }
      const r = i === hov ? 7 : 5;
      ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
      if (ya !== null) { ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(x, ya, r, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.arc(x, yt, r, 0, 7); ctx.fill(); ctx.stroke();
      if (['Llama 3.1 405B', 'DeepSeek-V3', 'Kimi K2', 'Kimi K3', 'DeepSeek V4-Pro', 'Mixtral 8×7B', 'Qwen3-Next-80B-A3B'].includes(m[0])) A.text(ctx, m[0], x + 8, yt - 8, { size: 11.5, color: A.css('--ink-2') });
      pts.push([x, yt, i], ...(ya !== null ? [[x, ya, i]] : []));
    });
  });
  cv.addEventListener('mousemove', (e) => {
    const p = A.pos(cv, e); let best = -1, bd2 = 225;
    pts.forEach(([x, y, i]) => { const d = (x - p.x) ** 2 + (y - p.y) ** 2; if (d < bd2) { bd2 = d; best = i; } });
    if (best !== hov) { hov = best; view.redraw(); }
    if (best >= 0) { const m = M[best]; A.tip.show(`<b>${m[0]}</b><br>${m[4] || fmtDate(m[1])}<br>总参数 ${m[2] >= 1000 ? m[2] / 1000 + 'T' : m[2] + 'B'}<br>激活 ${m[3] ? m[3] + 'B（' + A.pct(m[3] / m[2], 1) + '）' : '未公布'}`, e.clientX, e.clientY); } else A.tip.hide();
  });
  cv.addEventListener('mouseleave', () => { hov = -1; view.redraw(); A.tip.hide(); });
});
