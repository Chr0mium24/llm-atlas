/* rvq-demo — residual vector quantization in 2D: each level quantizes what the previous levels missed */
A.defineDemo('rvq-demo', function (mount) {
  const { bd } = A.demo(mount, '残差向量量化（RVQ）：一级一级补上误差', '二维玩具：每一级是一个 8 个码字的码本（3 比特），用 k-means 在上一级的残差上学出来');
  const K = 8, LMAX = 4;
  let levels = 1, sel = 0;
  const r = A.rng(21);
  const centers = [[-1.2, 0.8], [1.0, 1.1], [0.2, -1.2], [-0.8, -0.6], [1.4, -0.3]];
  const X = Array.from({ length: 500 }, (_, i) => { const c = centers[i % centers.length]; return [c[0] + A.gauss(r) * 0.35, c[1] + A.gauss(r) * 0.35]; });
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  function kmeans(P) {
    let C = Array.from({ length: K }, (_, i) => P[Math.floor((i + 0.5) * P.length / K)].slice());
    for (let it = 0; it < 15; it++) {
      const sum = C.map(() => [0, 0, 0]);
      P.forEach((p) => { let b = 0; C.forEach((c, j) => { if (d2(p, c) < d2(p, C[b])) b = j; }); sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2]++; });
      C = C.map((c, j) => (sum[j][2] ? [sum[j][0] / sum[j][2], sum[j][1] / sum[j][2]] : c));
    }
    return C;
  }
  const books = []; let R = X.map((p) => p.slice());
  for (let l = 0; l < LMAX; l++) {
    const C = kmeans(R); books.push(C);
    R = R.map((p) => { let b = 0; C.forEach((c, j) => { if (d2(p, c) < d2(p, C[b])) b = j; }); return [p[0] - C[b][0], p[1] - C[b][1]]; });
  }
  function encode(p, L) {
    let res = p.slice(), rec = [0, 0]; const path = [[0, 0]], codes = [];
    for (let l = 0; l < L; l++) { const C = books[l]; let b = 0; C.forEach((c, j) => { if (d2(res, c) < d2(res, C[b])) b = j; }); codes.push(b); rec = [rec[0] + C[b][0], rec[1] + C[b][1]]; res = [res[0] - C[b][0], res[1] - C[b][1]]; path.push(rec.slice()); }
    return { rec, path, codes };
  }
  const mse = (L) => A.sum(X.map((p) => d2(p, encode(p, L).rec))) / X.length;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.slider(ctl, { label: '使用几级码本', min: 1, max: LMAX, step: 1, value: levels, fmt: (v) => v + ' 级（每个向量 ' + 3 * v + ' 比特）', on: (v) => { levels = v; draw(); }, width: 230 });
  ctl.append(A.el('button', { onclick: () => { sel = Math.floor(r() * X.length); draw(); } }, '换一个点看'));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  const cols = A.series();
  const view = A.canvas(cv, { aspect: 0.55 }, (ctx, W, H) => {
    const sc = Math.min(W / 5.2, H / 3.6), cx = W / 2, cy = H / 2;
    const P = (p) => [cx + p[0] * sc, cy - p[1] * sc];
    ctx.fillStyle = A.alpha(A.css('--ink'), 0.18);
    X.forEach((p) => { const [x, y] = P(p); ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4); });
    books[0].forEach((c) => { const [x, y] = P(c); ctx.strokeStyle = cols[0]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.stroke(); });
    const e = encode(X[sel], levels);
    for (let i = 1; i < e.path.length; i++) {
      const [x0, y0] = P(e.path[i - 1]), [x1, y1] = P(e.path[i]);
      A.arrow(ctx, x0, y0, x1, y1, cols[i % 6], i === 1 ? 2.5 : 2, 8);
    }
    const [tx, ty] = P(X[sel]); ctx.fillStyle = A.css('--ink'); ctx.beginPath(); ctx.arc(tx, ty, 5, 0, 7); ctx.fill();
    A.text(ctx, '原始向量', tx + 8, ty - 10, { size: 12, weight: 700 });
    const [rx, ry] = P(e.rec); ctx.strokeStyle = cols[3]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(rx - 6, ry - 6); ctx.lineTo(rx + 6, ry + 6); ctx.moveTo(rx - 6, ry + 6); ctx.lineTo(rx + 6, ry - 6); ctx.stroke();
    A.text(ctx, '重建', rx + 8, ry + 12, { size: 12, color: cols[3], weight: 700 });
    A.text(ctx, '空心圈 = 第 1 级码本的 8 个码字；箭头 = 每一级加上的码字', 10, H - 10, { size: 11.5, color: A.css('--muted') });
  });
  function draw() {
    const e = encode(X[sel], levels);
    stats.innerHTML = '';
    const items = [['这个点的编码', '[' + e.codes.join(', ') + ']'], ['这个点的重建误差', Math.sqrt(d2(X[sel], e.rec)).toFixed(3)]];
    for (let l = 1; l <= LMAX; l++) items.push([`${l} 级时的平均误差²`, mse(l).toFixed(4)]);
    items.forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px', opacity: k.includes(levels + ' 级') || !k.includes('级时') ? 1 : 0.5 } }, v))));
    hint.innerHTML = '第 1 级码本只能把每个向量粗略地归到 8 个类中心之一；第 2 级码本不去量化原始向量，而是量化“第 1 级没表示好的那部分”（残差），依此类推。每多一级，误差大约缩小到原来的几分之一，而比特数只是线性增加。神经音频编解码器（EnCodec、Mimi、DAC）就是这样把每一帧声音压成几个码本编号：第一个码本记录大致的内容，后面的码本一级级补上音色和细节。生成时，语言模型像预测文字一样预测这些编号。';
    view.redraw();
  }
  draw();
});
