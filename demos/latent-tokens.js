/* latent-tokens — interactive demo (moved from ch12-image.html) */
A.defineDemo('latent-tokens', function (mount) {
  const { bd } = A.demo(mount, '分辨率 → 潜图 → token 数', '');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const R = A.slider(ctl, { label: '图像边长（像素）', min: 256, max: 4096, step: 64, value: 1024, fmt: (v) => v + ' × ' + v, on: draw });
  let f = 8, p = 2, ch = 16;
  A.seg(ctl, [{ v: 8, t: '8×（SD/FLUX）' }, { v: 16, t: '16×' }, { v: 32, t: '32×（DC-AE）' }], f, (v) => { f = v; draw(); }, 'VAE 下采样');
  A.seg(ctl, [{ v: 4, t: '4 通道' }, { v: 16, t: '16 通道' }, { v: 32, t: '32 通道' }], ch, (v) => { ch = v; draw(); }, '潜通道数');
  A.seg(ctl, [{ v: 1, t: '1×1' }, { v: 2, t: '2×2' }, { v: 4, t: '4×4' }], p, (v) => { p = v; draw(); }, 'DiT patch');
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  function draw() {
    const r = R.value, lat = r / f, tok = Math.pow(lat / p, 2);
    const base = Math.pow(1024 / 8 / 2, 2);
    stats.innerHTML = '';
    [['像素数', A.human(r * r * 3, 1)], ['潜图', `${lat}×${lat}×${ch}（压缩 ${((r * r * 3) / (lat * lat * ch)).toFixed(0)}×）`], ['token 数', tok.toLocaleString()], ['注意力对数', A.human(tok * tok, 1)], ['相对 1024²·8×·2×2 的注意力代价', (Math.pow(tok / base, 2)).toFixed(2) + '×']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
  }
  draw();
});
