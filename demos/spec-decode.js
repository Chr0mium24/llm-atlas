/* spec-decode — speculative decoding: speedup vs draft length γ (with batch size B against the ridge B*), and one sampled run showing accept / reject per big-model forward */
A.defineDemo('spec-decode', function (mount) {
  const { bd } = A.demo(mount, '投机解码模拟器', '加速比按正文公式计算；批大小一项只看权重（短上下文），拐点 B* = 295（H100）');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const aS = A.slider(ctl, { label: '接受率 α', min: 0.3, max: 0.95, step: 0.01, value: 0.75, fmt: (v) => A.pct(v, 0), on: draw });
  const gS = A.slider(ctl, { label: '草稿长度 γ', min: 1, max: 10, step: 1, value: 4, fmt: (v) => v, on: draw });
  const cS = A.slider(ctl, { label: '草稿成本比 c', min: 0.005, max: 0.5, step: 0.005, value: 0.05, fmt: (v) => v.toFixed(3), on: draw });
  const bS = A.slider(ctl, { label: '批大小 B', min: 1, max: 256, step: 1, value: 1, fmt: (v) => String(v), on: draw });
  const grid = A.el('div', { class: 'cols' });
  const cv = A.el('canvas', { class: 'cv' }); const sim = A.el('div', { style: { fontSize: '14px', lineHeight: '2' } });
  grid.append(cv, sim); bd.append(grid);
  const legend = A.el('div', { class: 'legend', html: '<span><i style="background:color-mix(in srgb, var(--good) 30%, transparent)"></i>草稿被接受</span><span><i style="background:color-mix(in srgb, var(--bad) 25%, transparent)"></i>草稿被拒绝（划掉；之后的草稿全部作废）</span><span><i style="background:var(--accent-soft);border:1px solid var(--accent)"></i>大模型自己补的 token</span>' });
  bd.append(legend);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const BSTAR = 295;
  const words = '投机 解码 让 大 模型 一次 前向 验证 多个 草稿 token ， 只要 草稿 足够 准 ， 速度 就能 提升 两到三 倍 ， 而且 输出 分布 和 原来 完全 一致 。'.split(' ');
  const alts = '模型 一次 并行 很多 小 词 猜 算 提高 不变 的 了 就 快 再'.split(' ');
  const verify = (g, B) => Math.max(1, B / BSTAR) / Math.max(1, (B * (g + 1)) / BSTAR);
  const speed = (a, g, c, B) => ((1 - Math.pow(a, g + 1)) / (1 - a) / (1 + g * c)) * verify(g, B);
  const view = A.canvas(cv, { aspect: 0.75 }, (ctx, W, H) => {
    const box = { x: 46, y: 16, w: W - 62, h: H - 50 };
    const a = aS.value, c = cS.value, B = bS.value;
    let top = 1; for (const aa of [0.5, 0.9, a]) for (let g = 1; g <= 10; g++) top = Math.max(top, speed(aa, g, c, B));
    const ymax = Math.min(9, Math.max(3, Math.ceil(top * 1.15)));
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 10, ymin: 0, ymax, xfmt: (v) => 'γ=' + v, yfmt: (v) => v + '×', xlabel: '草稿长度', ylabel: '加速比', ylabelOffset: 40 });
    ctx.save(); ctx.strokeStyle = A.css('--axis'); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(box.x, ax.Y(1)); ctx.lineTo(box.x + box.w, ax.Y(1)); ctx.stroke(); ctx.restore();
    A.text(ctx, '1×：不加速', box.x + box.w - 4, ax.Y(1) - 8, { size: 11, align: 'right', color: A.css('--muted') });
    const cols = A.series();
    [[0.5, cols[7]], [0.9, cols[2]]].forEach(([aa, col]) => {
      ctx.strokeStyle = A.alpha(col, 0.45); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let g = 1; g <= 10; g++) { const y = ax.Y(Math.min(ymax, speed(aa, g, c, B))); g > 1 ? ctx.lineTo(ax.X(g), y) : ctx.moveTo(ax.X(g), y); } ctx.stroke();
      A.text(ctx, 'α=' + A.pct(aa, 0), ax.X(10) - 2, ax.Y(Math.min(ymax, speed(aa, 10, c, B))) - 8, { size: 11, align: 'right', color: col });
    });
    ctx.strokeStyle = cols[1]; ctx.lineWidth = 2.5; ctx.beginPath();
    let best = 1; for (let g = 1; g <= 10; g++) { const s = speed(a, g, c, B); if (s > speed(a, best, c, B)) best = g; const y = ax.Y(Math.min(ymax, s)); g > 1 ? ctx.lineTo(ax.X(g), y) : ctx.moveTo(ax.X(g), y); } ctx.stroke();
    const g = gS.value;
    ctx.fillStyle = cols[1]; ctx.beginPath(); ctx.arc(ax.X(g), ax.Y(Math.min(ymax, speed(a, g, c, B))), 6, 0, 7); ctx.fill();
    A.text(ctx, `当前：${speed(a, g, c, B).toFixed(2)}×　最优 γ=${best}`, box.x + 6, box.y + 6, { size: 12.5, weight: 600, color: cols[1] });
    A.text(ctx, '橙线 = 当前 α', box.x + 6, box.y + 24, { size: 11.5, color: A.css('--muted') });
  });
  function draw() {
    view.redraw();
    const a = aS.value, g = gS.value, c = cS.value, B = bS.value;
    const r = A.rng(Math.round(a * 1000) + g * 7);
    let pos = 0, iters = 0; sim.innerHTML = '<div class="small muted">每一行 = 大模型的一次前向（批里一个请求的视角）</div>';
    while (pos < words.length && iters < 12) {
      const row = A.el('div');
      let k = 0;
      for (; k < g && pos + k < words.length; k++) {
        const ok = r() < a;
        let j = (pos + k * 3 + iters) % alts.length; if (alts[j] === words[pos + k]) j = (j + 1) % alts.length; const w = ok ? words[pos + k] : alts[j];
        row.append(A.el('span', { class: 'tok', style: { background: ok ? 'color-mix(in srgb, var(--good) 30%, transparent)' : 'color-mix(in srgb, var(--bad) 25%, transparent)', textDecoration: ok ? 'none' : 'line-through' } }, w));
        if (!ok) break;
      }
      pos += k;
      if (pos < words.length) { row.append(A.el('span', { class: 'tok', style: { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } }, words[pos])); pos++; }
      sim.append(row); iters++;
    }
    sim.append(A.el('div', { class: 'small' }, `${words.length} 个 token 用了 ${iters} 次大模型前向（普通解码要 ${words.length} 次）`));
    const v = verify(g, B);
    hint.innerHTML = `被拒绝的位置（划掉的词）由大模型换成它自己的词。批大小 B = ${B} 时，一轮验证要算 B(γ+1) = ${B * (g + 1)} 个位置` +
      (v >= 0.999 ? `，还没超过拐点 ${BSTAR}，多算的位置几乎免费。` : `，超过了拐点 ${BSTAR}，验证比一步普通解码慢 ${(1 / v).toFixed(2)} 倍，加速比要乘 ${v.toFixed(2)}。`) +
      ' 试试：γ = 4 时把批从 1 拖到 64、128、256，加速比从约 2.5 倍降到 2.3、1.2、0.6 倍。长上下文时读 KV 占了大头，这笔账会翻过来（见正文的意外框），这里没有画。';
  }
  draw();
});
