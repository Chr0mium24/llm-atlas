/* task-reliability — interactive demo (moved from ch15-agents.html) */
A.defineDemo('task-reliability', function (mount) {
  const { bd } = A.demo(mount, '长任务的可靠性：错误会累积', '任务成功率 = 每步不出“未被发现的错”的概率的 n 次方');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const pS = A.slider(ctl, { label: '每一步的正确率 p', min: 0.9, max: 0.999, step: 0.001, value: 0.99, fmt: (v) => (v * 100).toFixed(1) + '%', on: () => draw(), width: 220 });
  const rS = A.slider(ctl, { label: '出错后被发现并改正的概率 r', min: 0, max: 0.95, step: 0.05, value: 0.7, fmt: (v) => Math.round(v * 100) + '%', on: () => draw(), width: 240 });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  legend.innerHTML = '<span><i class="line" style="background:var(--s2)"></i>不验证：pⁿ</span><span><i class="line" style="background:var(--s1)"></i>验证并改正：(1 − (1−p)(1−r))ⁿ</span>';
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  const half = (q) => Math.log(0.5) / Math.log(q);
  const view = A.canvas(cv, { aspect: 0.36 }, (ctx, W, H) => {
    const box = { x: 46, y: 14, w: W - 64, h: H - 46 };
    const p = pS.value, q = 1 - (1 - p) * (1 - rS.value);
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 1000, xlog: true, xticks: [1, 10, 30, 100, 300, 1000], xfmt: (v) => v, ymin: 0, ymax: 1, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => Math.round(v * 100) + '%', xlabel: '任务步数 n', xgrid: true });
    const cols = A.series();
    ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(0.5)); ctx.lineTo(box.x + box.w, ax.Y(0.5)); ctx.stroke(); ctx.setLineDash([]);
    [[p, cols[1]], [q, cols[0]]].forEach(([b, c]) => {
      ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i <= 300; i++) { const n = Math.pow(10, (i / 300) * 3); const x = ax.X(n), y = ax.Y(Math.pow(b, n)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      const h = half(b);
      if (h >= 1 && h <= 1000) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(ax.X(h), ax.Y(0.5), 4.5, 0, 7); ctx.fill(); A.text(ctx, Math.round(h) + ' 步', ax.X(h) + 7, ax.Y(0.5) - 10, { size: 11.5, color: c, weight: 650 }); }
    });
  });
  function draw() {
    view.redraw();
    const p = pS.value, q = 1 - (1 - p) * (1 - rS.value);
    note.innerHTML = `每步正确率 ${(p * 100).toFixed(1)}% 时，100 步任务的成功率${Math.pow(p, 100) < 0.6 ? '只有' : '是'} <b>${A.pct(Math.pow(p, 100), 0)}</b>，成功率降到 50% 时是第 ${Math.round(half(p))} 步。如果 ${Math.round(rS.value * 100)}% 的错误能被测试或检查发现并改正，等效每步正确率变为 ${(q * 100).toFixed(2)}%，100 步成功率 <b>${A.pct(Math.pow(q, 100), 0)}</b>，能做到 ${half(q) > 1000 ? '1000 步以上' : Math.round(half(q)) + ' 步'}还保持 50%。这就是编码智能体一定要“改完跑测试”的原因。真实情况更复杂：错误之间不独立，有的错无法挽回，有的错后面会自己暴露出来。`;
  }
  draw();
});
