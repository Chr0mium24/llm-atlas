/* spec-decode — interactive demo (moved from ch10-infra.html) */
A.defineDemo('spec-decode', function (mount) {
  const { bd } = A.demo(mount, '投机解码模拟器', '');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const aS = A.slider(ctl, { label: '接受率 α', min: 0.3, max: 0.95, step: 0.01, value: 0.75, fmt: (v) => A.pct(v, 0), on: draw });
  const gS = A.slider(ctl, { label: '草稿长度 γ', min: 1, max: 10, step: 1, value: 4, fmt: (v) => v, on: draw });
  const cS = A.slider(ctl, { label: '草稿成本比 c', min: 0.005, max: 0.5, step: 0.005, value: 0.05, fmt: (v) => v.toFixed(3), on: draw });
  const grid = A.el('div', { class: 'cols' });
  const cv = A.el('canvas', { class: 'cv' }); const sim = A.el('div', { style: { fontSize: '14px', lineHeight: '2' } });
  grid.append(cv, sim); bd.append(grid);
  const legend = A.el('div', { class: 'legend', html: '<span><i style="background:color-mix(in srgb, var(--good) 30%, transparent)"></i>草稿被接受</span><span><i style="background:color-mix(in srgb, var(--bad) 25%, transparent)"></i>草稿被拒绝（之后的全部作废）</span><span><i style="background:var(--accent-soft);border:1px solid var(--accent)"></i>大模型补的 token</span>' });
  bd.append(legend);
  const words = '投机 解码 让 大 模型 一次 前向 验证 多个 草稿 token ， 只要 草稿 足够 准 ， 速度 就能 提升 两到三 倍 ， 而且 输出 分布 和 原来 完全 一致 。'.split(' ');
  const speed = (a, g, c) => (1 - Math.pow(a, g + 1)) / (1 - a) / (1 + g * c);
  const view = A.canvas(cv, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 40, y: 16, w: W - 56, h: H - 50 };
    const a = aS.value, c = cS.value;
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 10, ymin: 0, ymax: 5, xfmt: (v) => 'γ=' + v, yfmt: (v) => v + '×', xlabel: '草稿长度' });
    const cols = A.series();
    [[0.5, cols[7]], [0.75, cols[0]], [0.9, cols[2]]].forEach(([aa, col]) => {
      ctx.strokeStyle = A.alpha(col, 0.35); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let g = 1; g <= 10; g++) { const y = ax.Y(Math.min(5, speed(aa, g, c))); g > 1 ? ctx.lineTo(ax.X(g), y) : ctx.moveTo(ax.X(g), y); } ctx.stroke();
      A.text(ctx, 'α=' + A.pct(aa, 0), ax.X(10) - 2, ax.Y(Math.min(5, speed(aa, 10, c))) - 8, { size: 11, align: 'right', color: col });
    });
    ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.5; ctx.beginPath();
    let best = 1; for (let g = 1; g <= 10; g++) { const s = speed(a, g, c); if (s > speed(a, best, c)) best = g; const y = ax.Y(Math.min(5, s)); g > 1 ? ctx.lineTo(ax.X(g), y) : ctx.moveTo(ax.X(g), y); } ctx.stroke();
    const g = gS.value;
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(g), ax.Y(Math.min(5, speed(a, g, c))), 6, 0, 7); ctx.fill();
    A.text(ctx, `当前：${speed(a, g, c).toFixed(2)}×　最优 γ=${best}`, box.x + 6, box.y + 6, { size: 12.5, weight: 600, color: cols[1] });
    A.text(ctx, '橙线 = 当前 α', box.x + 6, box.y + 24, { size: 11.5, color: A.css('--muted') });
  });
  function draw() {
    view.redraw();
    const r = A.rng(Math.round(aS.value * 1000) + gS.value * 7);
    let pos = 0, iters = 0; sim.innerHTML = '<div class="small muted">每一行 = 大模型的一次前向</div>';
    while (pos < words.length && iters < 12) {
      const row = A.el('div');
      let k = 0;
      for (; k < gS.value && pos + k < words.length; k++) {
        const ok = r() < aS.value;
        row.append(A.el('span', { class: 'tok', style: { background: ok ? 'color-mix(in srgb, var(--good) 30%, transparent)' : 'color-mix(in srgb, var(--bad) 25%, transparent)', textDecoration: ok ? 'none' : 'line-through' } }, words[pos + k]));
        if (!ok) break;
      }
      const accepted = k;
      pos += accepted;
      if (pos < words.length) { row.append(A.el('span', { class: 'tok', style: { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } }, words[pos])); pos++; }
      sim.append(row); iters++;
    }
    sim.append(A.el('div', { class: 'small' }, `${words.length} 个 token 用了 ${iters} 次大模型前向（普通解码要 ${words.length} 次）`));
  }
  draw();
});
