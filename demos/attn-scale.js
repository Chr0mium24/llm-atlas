/* attn-scale — interactive demo (moved from ch02-attention.html) */
A.defineDemo('attn-scale', function (mount) {
  const { bd } = A.demo(mount, '维度 d 越大，不缩放的 softmax 越容易饱和', '每次抽 16 个随机 key');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const dS = A.slider(ctl, { label: '维度 d', min: 2, max: 1024, log: true, value: 128, fmt: (v) => Math.round(v), on: () => view.redraw(), width: 260 });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const view = A.canvas(cv, { aspect: 0.32 }, paint);
  function paint(ctx, W, H) {
    const d = Math.round(dS.value), r = A.rng(42), trials = 300, n = 16;
    let maxRaw = 0, maxScaled = 0, entRaw = 0, entScaled = 0;
    const histRaw = [], histSc = [];
    for (let t = 0; t < trials; t++) {
      const q = Array.from({ length: d }, () => A.gauss(r));
      const s = [];
      for (let j = 0; j < n; j++) { let dot = 0; for (let i = 0; i < d; i++) dot += q[i] * A.gauss(r); s.push(dot); }
      const pr = A.softmax(s), ps = A.softmax(s.map((x) => x / Math.sqrt(d)));
      maxRaw += Math.max(...pr) / trials; maxScaled += Math.max(...ps) / trials;
      entRaw += -pr.reduce((a, p) => a + (p > 1e-12 ? p * Math.log2(p) : 0), 0) / trials;
      entScaled += -ps.reduce((a, p) => a + (p > 1e-12 ? p * Math.log2(p) : 0), 0) / trials;
      if (t < 120) { histRaw.push(...s); histSc.push(...s.map((x) => x / Math.sqrt(d))); }
    }
    const cols = A.series();
    const half = (W - 30) / 2;
    const drawHist = (x0, data, color, title, range) => {
      const bins = 41, cnt = new Array(bins).fill(0);
      data.forEach((v) => { const b = Math.floor(((v + range) / (2 * range)) * bins); if (b >= 0 && b < bins) cnt[b]++; });
      const mx = Math.max(...cnt);
      const box = { x: x0 + 10, y: 26, w: half - 20, h: H - 60 };
      A.axes(ctx, box, { xmin: -range, xmax: range, ymin: 0, ymax: 1, yticks: [], xticks: A.niceTicks(-range, range, 4), xfmt: (v) => +v.toFixed(1) + '' });
      const bw = box.w / bins;
      cnt.forEach((c, i) => A.bar(ctx, box.x + i * bw + 1, box.y + box.h - (c / mx) * box.h, bw - 2, (c / mx) * box.h, color, 2));
      A.text(ctx, title, box.x, 12, { size: 12.5, weight: 600 });
    };
    const range = Math.max(4, 3.5 * Math.sqrt(d));
    drawHist(0, histRaw, cols[1], '不缩放：q·k（标准差 ≈ √d = ' + Math.sqrt(d).toFixed(1) + '）', range);
    drawHist(half + 30, histSc, cols[0], '缩放：q·k / √d（标准差 ≈ 1）', 4);
    legend.innerHTML = `<span>16 个 key 中权重最大者的平均权重：不缩放 <b>${(maxRaw * 100).toFixed(1)}%</b>，缩放后 <b>${(maxScaled * 100).toFixed(1)}%</b></span><span>平均熵：不缩放 <b>${entRaw.toFixed(2)}</b> bit，缩放后 <b>${entScaled.toFixed(2)}</b> bit（均匀分布 = 4 bit）</span>`;
  }
});
