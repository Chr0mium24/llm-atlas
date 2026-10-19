/* embed-arith — interactive demo (moved from ch01-tokens.html) */
A.defineDemo('embed-arith', function (mount) {
  const { bd } = A.demo(mount, '词向量算术：A − B + C ≈ ?', '玩具向量，11 维 → PCA 2 维');
  //            性别 王权 年龄 人  国家 城市 中  日  法  英  动物
  const W = {
    '男人':   [ 1, 0, .7, 1, 0, 0, 0, 0, 0, 0, 0],
    '女人':   [-1, 0, .7, 1, 0, 0, 0, 0, 0, 0, 0],
    '国王':   [ 1, 1, .8, 1, 0, 0, 0, 0, 0, 0, 0],
    '王后':   [-1, 1, .8, 1, 0, 0, 0, 0, 0, 0, 0],
    '王子':   [ 1, 1, .2, 1, 0, 0, 0, 0, 0, 0, 0],
    '公主':   [-1, 1, .2, 1, 0, 0, 0, 0, 0, 0, 0],
    '男孩':   [ 1, 0, .1, 1, 0, 0, 0, 0, 0, 0, 0],
    '女孩':   [-1, 0, .1, 1, 0, 0, 0, 0, 0, 0, 0],
    '中国':   [ 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    '北京':   [ 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    '日本':   [ 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    '东京':   [ 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0],
    '法国':   [ 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    '巴黎':   [ 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    '英国':   [ 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    '伦敦':   [ 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    '公鸡':   [ 1, 0, .6, 0, 0, 0, 0, 0, 0, 0, 1],
    '母鸡':   [-1, 0, .6, 0, 0, 0, 0, 0, 0, 0, 1],
    '小鸡':   [ 0, 0, .1, 0, 0, 0, 0, 0, 0, 0, 1],
  };
  const r = A.rng(7);
  const words = Object.keys(W);
  words.forEach((w) => { W[w] = W[w].map((x) => x + A.gauss(r) * 0.06); });
  // PCA via power iteration
  const D = 11, mean = new Array(D).fill(0);
  words.forEach((w) => W[w].forEach((x, i) => (mean[i] += x / words.length)));
  const C = Array.from({ length: D }, () => new Array(D).fill(0));
  words.forEach((w) => { const v = W[w].map((x, i) => x - mean[i]); for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) C[i][j] += v[i] * v[j]; });
  function pc(Cm, rr) { let v = new Array(D).fill(0).map(() => rr() - 0.5); for (let k = 0; k < 200; k++) { const nv = Cm.map((row) => A.dot(row, v)); const n = Math.hypot(...nv); v = nv.map((x) => x / n); } return v; }
  const p1 = pc(C, A.rng(1));
  const lam = A.dot(p1, C.map((row) => A.dot(row, p1)));
  const C2 = C.map((row, i) => row.map((x, j) => x - lam * p1[i] * p1[j]));
  const p2 = pc(C2, A.rng(2));
  const proj = (v) => { const c = v.map((x, i) => x - mean[i]); return [A.dot(c, p1), A.dot(c, p2)]; };
  const P = {}; words.forEach((w) => (P[w] = proj(W[w])));
  const cos = (a, b) => A.dot(a, b) / (Math.hypot(...a) * Math.hypot(...b));

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const opts = words.map((w) => ({ v: w, t: w }));
  let a = '国王', b = '男人', c = '女人';
  const sa = A.select(ctl, 'A', opts, a, (v) => { a = v; draw(); });
  const sb = A.select(ctl, '− B', opts, b, (v) => { b = v; draw(); });
  const sc = A.select(ctl, '+ C', opts, c, (v) => { c = v; draw(); });
  const presets = A.el('div', { class: 'flex', style: { marginBottom: '10px' } });
  [['国王 − 男人 + 女人', '国王', '男人', '女人'], ['北京 − 中国 + 日本', '北京', '中国', '日本'], ['巴黎 − 法国 + 英国', '巴黎', '法国', '英国'], ['公主 − 女孩 + 男孩', '公主', '女孩', '男孩'], ['公鸡 − 男人 + 女人', '公鸡', '男人', '女人']]
    .forEach(([t, x, y, z]) => presets.append(A.el('button', { onclick: () => { a = x; b = y; c = z; sa.value = x; sb.value = y; sc.value = z; draw(); } }, t)));
  bd.append(presets);
  const grid = A.el('div', { class: 'cols' });
  const cv = A.el('canvas', { class: 'cv' });
  const list = A.el('div');
  grid.append(cv, list); bd.append(grid);
  const view = A.canvas(cv, { aspect: 0.8 }, paint);
  let res = null;
  function draw() {
    res = W[a].map((x, i) => x - W[b][i] + W[c][i]);
    const ranked = words.filter((w) => w !== a && w !== b && w !== c).map((w) => ({ w, s: cos(res, W[w]) })).sort((x, y) => y.s - x.s).slice(0, 6);
    list.innerHTML = '<div class="small muted" style="margin-bottom:6px">结果向量与各词的余弦相似度（排除 A、B、C）</div>';
    ranked.forEach((o, i) => {
      const row = A.el('div', { style: { display: 'grid', gridTemplateColumns: '54px 1fr 50px', gap: '8px', alignItems: 'center', margin: '5px 0' } },
        A.el('b', { style: { fontWeight: i === 0 ? 700 : 500 } }, o.w),
        A.el('div', { style: { height: '14px', background: 'var(--grid)', borderRadius: '0 4px 4px 0' } }, A.el('div', { style: { height: '100%', width: Math.max(0, o.s) * 100 + '%', background: i === 0 ? 'var(--s1)' : 'var(--axis)', borderRadius: '0 4px 4px 0' } })),
        A.el('span', { class: 'mono small', style: { textAlign: 'right' } }, o.s.toFixed(3)));
      list.append(row);
    });
    list.append(A.el('p', { class: 'hint' }, '“公鸡 − 男人 + 女人” 也能得到 “母鸡”：减掉 “男人” 再加上 “女人”，相当于沿性别方向平移，其它维度（动物、年龄）不变。'));
    view.redraw();
  }
  function paint(ctx, Wd, H) {
    const xs = words.map((w) => P[w][0]), ys = words.map((w) => P[w][1]);
    const rp = proj(res);
    const x0 = Math.min(...xs, rp[0]) - 0.4, x1 = Math.max(...xs, rp[0]) + 0.4, y0 = Math.min(...ys, rp[1]) - 0.3, y1 = Math.max(...ys, rp[1]) + 0.3;
    const X = (v) => 20 + ((v - x0) / (x1 - x0)) * (Wd - 40), Y = (v) => H - 20 - ((v - y0) / (y1 - y0)) * (H - 40);
    const muted = A.css('--muted'), ink = A.css('--ink'), s1 = A.css('--s1'), s2 = A.css('--s2'), s3 = A.css('--s3');
    // arrows: b -> a (difference), then c -> result
    const pa = P[a], pb = P[b], pcc = P[c];
    A.arrow(ctx, X(pb[0]), Y(pb[1]), X(pa[0]), Y(pa[1]), A.alpha(s2, 0.8), 2);
    A.arrow(ctx, X(pcc[0]), Y(pcc[1]), X(rp[0]), Y(rp[1]), A.alpha(s2, 0.8), 2);
    words.forEach((w) => {
      const [px, py] = P[w];
      const hi = w === a || w === b || w === c;
      ctx.fillStyle = hi ? s2 : muted;
      ctx.beginPath(); ctx.arc(X(px), Y(py), hi ? 5 : 4, 0, 7); ctx.fill();
      A.text(ctx, w, X(px) + 7, Y(py) - 1, { size: 12.5, color: hi ? ink : A.css('--ink-2'), weight: hi ? 600 : 400 });
    });
    ctx.fillStyle = s1; ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(rp[0]), Y(rp[1]), 7, 0, 7); ctx.fill(); ctx.stroke();
    A.text(ctx, '结果', X(rp[0]) + 10, Y(rp[1]) + 12, { size: 12, color: s1, weight: 700 });
    A.text(ctx, '橙色箭头：B→A 的差向量，平移到 C 上', 12, 12, { size: 11.5, color: muted });
  }
  draw();
});
