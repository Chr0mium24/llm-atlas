/* compute-growth — training compute of landmark language models 2017→2026 on a log scale; frontier trend vs efficient open models */
A.defineDemo('compute-growth', function (mount) {
  const { bd } = A.demo(mount, '九年里，训练一个模型的算力涨了多少', '纵轴：最后一次训练的总浮点运算数（对数）。闭源模型多为 Epoch AI 等机构的估计，开源模型按 6 × 激活参数 × token 数估算，都只看量级');
  const D = [
    ['Transformer', 2017.45, 7e18, 'a'], ['BERT-Large', 2018.78, 2.8e20, 'o'], ['GPT-2', 2019.12, 1.5e21, 'o'], ['T5-11B', 2019.8, 4e22, 'o'],
    ['GPT-3', 2020.4, 3.1e23, 'c'], ['Gopher', 2021.95, 6.3e23, 'c'], ['Chinchilla', 2022.24, 5.8e23, 'c'], ['PaLM', 2022.27, 2.5e24, 'c'],
    ['LLaMA 65B', 2023.15, 5.5e23, 'o'], ['GPT-4', 2023.2, 2.1e25, 'c'], ['Llama 2 70B', 2023.55, 8.4e23, 'o'], ['Gemini 1.0 Ultra', 2023.93, 5e25, 'c'],
    ['Llama 3.1 405B', 2024.55, 3.8e25, 'o'], ['DeepSeek-V3', 2024.98, 3.3e24, 'o'], ['Grok 3', 2025.13, 4.6e26, 'c'], ['Qwen3-235B', 2025.3, 4.8e24, 'o'],
    ['Grok 4', 2025.52, 5e26, 'c'], ['Kimi K2', 2025.53, 3e24, 'o'], ['DeepSeek V4-Pro', 2026.31, 1e25, 'o'],
  ];
  let show = 'all', trend = true;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'all', t: '全部' }, { v: 'c', t: '只看闭源前沿' }, { v: 'o', t: '只看开源' }], show, (v) => { show = v; draw(); }, '显示');
  A.check(ctl, '前沿趋势线', trend, (v) => { trend = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i style="background:var(--s1);border-radius:50%"></i>闭源前沿</span><span><i style="background:var(--s2);border-radius:50%"></i>开源权重</span><span><i style="background:var(--muted);border-radius:50%"></i>学术原型</span>' }));
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  // frontier = running max; fit log10(C) = a + b·t on those points
  const front = []; let mx = 0; D.forEach((d) => { if (d[2] > mx) { mx = d[2]; front.push(d); } });
  const fit = (() => { const xs = front.map((d) => d[1]), ys = front.map((d) => Math.log10(d[2])); const n = xs.length, mxs = A.sum(xs) / n, mys = A.sum(ys) / n; let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mxs) * (ys[i] - mys); sxx += (x - mxs) ** 2; }); const b = sxy / sxx; return { a: mys - b * mxs, b }; })();
  let hov = -1, pts = [];
  const view = A.canvas(cv, { aspect: 0.5 }, (ctx, W, H) => {
    const box = { x: 58, y: 16, w: W - 78, h: H - 46 };
    const ax = A.axes(ctx, box, { xmin: 2017, xmax: 2026.8, ymin: 1e18, ymax: 1e27, ylog: true, yticks: [1e18, 1e20, 1e22, 1e24, 1e26], yfmt: (v) => '10' + String(Math.round(Math.log10(v))).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''), xticks: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], xfmt: (v) => "'" + String(v).slice(2) });
    if (trend) { ctx.save(); ctx.strokeStyle = A.alpha(cols[0], 0.5); ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ax.X(2017), ax.Y(Math.pow(10, fit.a + fit.b * 2017))); ctx.lineTo(ax.X(2026.8), ax.Y(Math.min(1e27, Math.pow(10, fit.a + fit.b * 2026.8)))); ctx.stroke(); ctx.restore(); }
    pts = [];
    D.forEach((d, i) => {
      if (show !== 'all' && d[3] !== show) return;
      const x = ax.X(d[1]), y = ax.Y(d[2]);
      ctx.fillStyle = d[3] === 'c' ? cols[0] : d[3] === 'o' ? cols[1] : A.css('--muted');
      ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, i === hov ? 7 : 5, 0, 7); ctx.fill(); ctx.stroke();
      if (['Transformer', 'GPT-3', 'GPT-4', 'Grok 4', 'DeepSeek-V3', 'DeepSeek V4-Pro', 'GPT-2', 'Llama 3.1 405B'].includes(d[0])) { const left = ['GPT-4', 'Grok 4', 'DeepSeek V4-Pro', 'Llama 3.1 405B'].includes(d[0]); A.text(ctx, d[0], x + (left ? -8 : 8), y + (d[3] === 'o' && d[0] !== 'DeepSeek V4-Pro' ? 13 : -11), { size: 11.5, color: A.css('--ink-2'), align: left ? 'right' : 'left' }); }
      pts.push([x, y, i]);
    });
  });
  cv.addEventListener('mousemove', (e) => {
    const rc = cv.getBoundingClientRect(), mx = e.clientX - rc.left, my = e.clientY - rc.top;
    let best = -1, bd2 = 200; pts.forEach(([x, y, i]) => { const d2 = (x - mx) ** 2 + (y - my) ** 2; if (d2 < bd2) { bd2 = d2; best = i; } });
    if (best !== hov) { hov = best; view.redraw(); }
    if (best >= 0) { const d = D[best]; A.tip.show(`<b>${d[0]}</b><br>约 ${d[2].toExponential(1).replace('e+', ' × 10^')} FLOP`, e.clientX, e.clientY); } else A.tip.hide();
  });
  cv.addEventListener('mouseleave', () => { hov = -1; A.tip.hide(); view.redraw(); });
  function draw() {
    const g = Math.pow(10, fit.b);
    stats.innerHTML = '';
    [['2017 → 2025 最大训练算力', '约 ' + A.sci(5e26 / 7e18) + ' 倍'], ['前沿趋势', '每年约 ×' + g.toFixed(1)], ['2026 开源旗舰 vs 2025 闭源最大', '约 1/' + Math.round(5e26 / 1e25)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
    hint.innerHTML = `从 2017 年的 Transformer 到 2025 年的 Grok 4，单次训练的算力涨了七八个数量级，按每年刷新的最大值拟合，约每年 ×${g.toFixed(1)}。这比 Epoch AI 对所有知名 AI 模型统计的每年 4–5 倍更快，因为语言模型在这几年里从一个小方向变成了算力投入的中心。另一条值得注意的线是开源模型（橙色）：DeepSeek、Qwen、Kimi 用比闭源前沿少一到两个数量级的算力，做到了只落后几个月的能力，靠的是 MoE、更好的数据和强化学习（第 ${A.cref('moe').replace(/[^0-9]/g, '')}、${A.cref('rl').replace(/[^0-9]/g, '')} 章）。算力决定上限，效率决定离上限多近。`;
    view.redraw();
  }
  draw();
});
