/* latent-tokens — resolution → latent → tokens → compute bill for one image (MMDiT estimate: 2·N_act·n + 4·L·n²·d per step) */
A.defineDemo('latent-tokens', function (mount) {
  const { bd } = A.demo(mount, '一张图的账单：分辨率 → 潜图 → token → 计算量', '计算量按 MMDiT 估算：每步 ≈ 2 × 每个 token 经过的参数 × 序列长度 + 注意力；不含文本编码器和 VAE（它们只跑一次，占比很小）');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const R = A.slider(ctl, { label: '图像边长（像素）', min: 256, max: 4096, step: 64, value: 1024, fmt: (v) => v + ' × ' + v, on: draw });
  let f = 8, p = 2, ch = 16, nt = 512, model = 'flux', cfg = false;
  A.seg(ctl, [{ v: 8, t: '8×（SD/FLUX）' }, { v: 16, t: '16×' }, { v: 32, t: '32×（DC-AE）' }], f, (v) => { f = v; draw(); }, 'VAE 下采样');
  A.seg(ctl, [{ v: 4, t: '4 通道' }, { v: 16, t: '16 通道' }, { v: 32, t: '32 通道' }], ch, (v) => { ch = v; draw(); }, '潜通道数');
  A.seg(ctl, [{ v: 1, t: '1×1' }, { v: 2, t: '2×2' }, { v: 4, t: '4×4' }], p, (v) => { p = v; draw(); }, 'DiT patch');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  // N: total params; act: params each token passes through (one stream of each block, no adaLN weights); L blocks; d width
  const M = {
    sd3m: { t: 'SD3 Medium（2B）', N: 2.0e9, act: 0.68e9, L: 24, d: 1536 },
    sd3: { t: 'SD3 8B', N: 8.1e9, act: 2.7e9, L: 38, d: 2432 },
    flux: { t: 'FLUX.1（12B）', N: 11.9e9, act: 6.45e9, L: 57, d: 3072 },
  };
  A.seg(ctl2, Object.entries(M).map(([v, o]) => ({ v, t: o.t })), model, (v) => { model = v; draw(); }, '去噪网络');
  A.seg(ctl2, [{ v: 77, t: '77（CLIP）' }, { v: 256, t: '256' }, { v: 512, t: '512（T5）' }], nt, (v) => { nt = v; draw(); }, '文本 token');
  const K = A.slider(ctl2, { label: '去噪步数', min: 1, max: 50, step: 1, value: 28, fmt: (v) => v + ' 步', on: draw, width: 160 });
  A.check(ctl2, 'CFG（每步跑两遍）', cfg, (v) => { cfg = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  const dur = (sec) => sec < 120 ? sec.toFixed(1) + ' 秒' : sec < 7200 ? (sec / 60).toFixed(0) + ' 分钟' : sec < 172800 ? (sec / 3600).toFixed(1) + ' 小时' : (sec / 86400).toFixed(0) + ' 天';
  function draw() {
    const r = R.value, lat = r / f, side = Math.ceil(lat / p), tok = side * side, m = M[model];
    const n = tok + nt;
    const step = 2 * m.act * n + 4 * m.L * n * n * m.d, passes = Math.round(K.value) * (cfg ? 2 : 1), total = step * passes;
    const attnShare = (4 * m.L * n * n * m.d) / step;
    stats.innerHTML = '';
    [['像素数', A.human(r * r * 3, 1)], ['潜图', `${lat}×${lat}×${ch}（少 ${((r * r * 3) / (lat * lat * ch)).toFixed(0)} 倍）`], ['图像 token', tok.toLocaleString()], ['序列总长（+ 文本）', n.toLocaleString()],
      ['每步计算量', A.sci(step) + ' FLOP'], ['注意力占每步', A.pct(attnShare, 0)], ['整张图', total < 1e18 ? (total / 1e15).toFixed(total < 1e15 ? 2 : 1) + ' PFLOP' : A.sci(total) + ' FLOP'], ['H100 满载（989 TFLOP/s）', dur(total / 9.89e14)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    note.innerHTML = `${m.t}：总参数 ${A.human(m.N, 1)}，但每个 token 只经过约 ${A.human(m.act, 2)}（文本和图像各走一套权重；adaLN 的调制权重只作用于时间步向量，不随 token 数增长）。` +
      (lat % p ? `潜图边长 ${lat} 不能被 patch 整除，按补边算成 ${side}×${side} 个 token。` : '') + (r >= 2048 ? '分辨率翻倍，token 数变成 4 倍，线性层计算量 4 倍、注意力 16 倍：高分辨率时注意力开始占大头。' : '把边长拉到 2048 或 4096，看注意力的占比怎样上升；把 VAE 换成 32× 压缩，同样的分辨率 token 数降到 1/16。') +
      '潜通道数只改变每个 patch 拉平后的长度（投影到宽度 d 之前），不改变 token 数，对计算量几乎没有影响；它影响的是重建质量（见「潜空间的取舍」）。实际利用率达不到满载，真实耗时更长；少步蒸馏把 28 步压到 1–4 步，是降低成本最直接的一项。';
  }
  draw();
});
