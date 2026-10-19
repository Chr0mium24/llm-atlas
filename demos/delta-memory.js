/* delta-memory — interactive demo (moved from ch08-long-context.html) */
A.defineDemo('delta-memory', function (mount) {
  const { bd } = A.demo(mount, '固定大小的记忆：加法 vs Delta rule vs 带遗忘的 Delta', '状态 S 是 d×d 矩阵；查询 kᵢ 取回 vᵢ');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const dS = A.slider(ctl, { label: '状态维度 d', min: 4, max: 64, step: 1, value: 16, fmt: (v) => v + '（状态 ' + v + '×' + v + '）', on: draw, width: 200 });
  const NS = A.slider(ctl, { label: '写入的 (k, v) 对数 N', min: 2, max: 128, step: 1, value: 32, fmt: (v) => v, on: draw });
  const aS = A.slider(ctl, { label: '衰减 α（门控）', min: 0.8, max: 1, step: 0.005, value: 0.95, fmt: (v) => v.toFixed(3), on: draw });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  legend.innerHTML = '<span><i class="line" style="background:var(--s2)"></i>线性注意力（加法写入）</span><span><i class="line" style="background:var(--s1)"></i>DeltaNet（β=1）</span><span><i class="line" style="background:var(--s3)"></i>Gated DeltaNet（衰减 α + delta）</span><span><i class="line" style="background:var(--axis)"></i>softmax 注意力 / KV cache（全部保存，=1）</span>';
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  let res = null;
  function run() {
    const d = dS.value, N = NS.value, al = aS.value, r = A.rng(21);
    const unit = () => { const x = Array.from({ length: d }, () => A.gauss(r)); const n = Math.hypot(...x); return x.map((y) => y / n); };
    const K = Array.from({ length: N }, unit), Vv = Array.from({ length: N }, unit);
    const mk = () => Array.from({ length: d }, () => new Float64Array(d));
    const S1 = mk(), S2 = mk(), S3 = mk();
    const read = (S, k) => S.map((row) => A.dot(row, k));
    for (let i = 0; i < N; i++) {
      const k = K[i], v = Vv[i];
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) S1[a][b] += v[a] * k[b];
      const p2 = read(S2, k);
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) S2[a][b] += (v[a] - p2[a]) * k[b];
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) S3[a][b] *= al;
      const p3 = read(S3, k);
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) S3[a][b] += (v[a] - p3[a]) * k[b];
    }
    const cos = (a, b) => A.dot(a, b) / (Math.hypot(...a) * Math.hypot(...b) + 1e-12);
    res = [S1, S2, S3].map((S) => K.map((k, i) => cos(read(S, k), Vv[i])));
  }
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const N = NS.value, box = { x: 44, y: 14, w: W - 60, h: H - 48 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: Math.max(2, N), ymin: -0.2, ymax: 1.05, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => v.toFixed(2), xfmt: (v) => Math.round(v), xlabel: '第 i 个写入的条目（左旧右新）' });
    const cols = A.series();
    ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax.X(1), ax.Y(1)); ctx.lineTo(ax.X(N), ax.Y(1)); ctx.stroke();
    [[res[0], cols[1]], [res[1], cols[0]], [res[2], cols[2]]].forEach(([ys, c]) => {
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath();
      ys.forEach((y, i) => { const x = ax.X(i + 1), yy = ax.Y(A.clamp(y, -0.2, 1.05)); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      ctx.stroke();
    });
    A.text(ctx, '取回的向量与正确 value 的余弦相似度', box.x, 6, { size: 11.5, color: A.css('--muted') });
  });
  function draw() {
    run(); view.redraw();
    const d = dS.value, N = NS.value;
    const avg = res.map((x) => A.mean(x));
    note.innerHTML = `平均回忆质量：加法 <b>${avg[0].toFixed(2)}</b>，Delta <b>${avg[1].toFixed(2)}</b>，Gated Delta <b>${avg[2].toFixed(2)}</b>。` +
      `状态只有 ${d}×${d} = ${d * d} 个数；而 KV cache 存全部 N 对要 ${N}×${2 * d} = ${N * 2 * d} 个数，且随 N 增长。` +
      (N > d ? `N &gt; d 时状态装不下全部条目：Delta rule 保住最近写入的，牺牲最旧的；加法写入则所有条目一起变模糊。` : `N ≤ d 时，Delta rule 可以几乎完美地记住全部条目，加法写入仍有串扰。`);
  }
  draw();
});
