/* matmul-tiling — C = A·B on an 8×8 grid of blocks: computing a T×T tile of C at once reuses loaded blocks; step through k */
A.defineDemo('matmul-tiling', function (mount) {
  const { bd } = A.demo(mount, '分块矩阵乘法：一次算一块，数据复用多少次', 'A、B、C 都切成 8×8 个小块；玩具设定：片上一次最多放 24 个小块');
  const N = 8;
  let T = 2, k = 0, ti = 0, tj = 0;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 1, t: 'T = 1（不分块复用）' }, { v: 2, t: 'T = 2' }, { v: 4, t: 'T = 4' }, { v: 8, t: 'T = 8（整个 C）' }], T, (v) => { T = v; k = 0; ti = tj = 0; draw(); }, '一次计算的 C 区域边长 T');
  const bar = A.el('div', { class: 'flex', style: { margin: '6px 0' } });
  const prev = A.el('button', { onclick: () => step(-1) }, '← 上一步');
  const next = A.el('button', { class: 'primary', onclick: () => step(1) }, '下一步 →');
  const fin = A.el('button', { onclick: () => { k = N - 1; draw(); } }, '算完这一块');
  bar.append(prev, next, fin); bd.append(bar);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  function step(d) { k = A.clamp(k + d, 0, N - 1); draw(); }
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const gap = 26, cell = Math.min((W - 4 * gap) / (3 * N), (H - 40) / N), y0 = 24;
    const mats = [['A', 0], ['B', 1], ['C = A·B', 2]];
    mats.forEach(([name, m]) => {
      const x0 = gap + m * (N * cell + gap);
      A.text(ctx, name, x0, 12, { size: 12.5, weight: 700 });
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        let fill = A.alpha(A.css('--ink'), 0.05);
        if (m === 0 && r >= ti && r < ti + T && c === k) fill = A.alpha(cols[0], 0.75);
        else if (m === 0 && r >= ti && r < ti + T && c < k) fill = A.alpha(cols[0], 0.2);
        if (m === 1 && c >= tj && c < tj + T && r === k) fill = A.alpha(cols[1], 0.75);
        else if (m === 1 && c >= tj && c < tj + T && r < k) fill = A.alpha(cols[1], 0.2);
        if (m === 2 && r >= ti && r < ti + T && c >= tj && c < tj + T) fill = A.alpha(cols[2], 0.25 + 0.6 * (k + 1) / N);
        ctx.fillStyle = fill; ctx.fillRect(x0 + c * cell + 1, y0 + r * cell + 1, cell - 2, cell - 2);
      }
      if (m < 2) A.text(ctx, m === 0 ? '×' : '=', x0 + N * cell + gap / 2, y0 + N * cell / 2, { size: 16, align: 'center', color: A.css('--muted') });
    });
  });
  function draw() {
    prev.disabled = k === 0; next.disabled = k === N - 1;
    const loadsTile = 2 * T * (k + 1);
    const flopsTile = T * T * (k + 1);
    const totalLoads = (N / T) * (N / T) * 2 * T * N;
    const totalFlops = N * N * N;
    const onChip = T * T + 2 * T, CAP = 24, fits = onChip <= CAP;
    stats.innerHTML = '';
    [['这一块目前读入的 A、B 小块', String(loadsTile)], ['已完成的“小块乘加”', String(flopsTile)], ['整个 C 需要读入的小块数', totalLoads + '（不复用时 ' + 2 * N * N * N + '）'], ['乘加 / 读入', (totalFlops / totalLoads).toFixed(1) + ' = T / 2'], ['片上要放（累加器 T² + 读入 2T）', onChip + ' / ' + CAP + (fits ? ' ✓' : ' ✗ 放不下')]]
      .forEach(([kk, v], i) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '16px', color: i === 4 ? (fits ? 'var(--good-ink)' : 'var(--bad)') : '' } }, v))));
    hint.innerHTML = `计算 C 的一个 ${T}×${T} 区域：沿 k 方向一步步走，每一步从显存读入 A 的 ${T} 个小块（一列）和 B 的 ${T} 个小块（一行），在片上做 ${T}×${T} = ${T * T} 次小块乘加，结果一直累加在片上，不写回。每个读入的小块被用了 ${T} 次。整个乘法的读入量从 2N³ 降到 2N³/T，<b>算术强度与 T 成正比</b>：按小块数是每次读入做 T/2 次乘加，按正文的单位是 T/b FLOPs/字节。但 T×T 的累加器要一直留在片上，片上要放的东西随 T² 增长：在这个玩具里 T = 8 复用最高，却放不下，只能取 T = 4。真实 GPU 上同样是容量决定了块多大，这就是内核要精心选择分块大小的原因；FlashAttention（${A.cref('long-context')}）是同一个思路用在注意力上。`;
    view.redraw();
  }
  draw();
});
