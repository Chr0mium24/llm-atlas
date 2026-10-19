/* video-tokens — interactive demo (moved from ch13-video.html) */
A.defineDemo('video-tokens', function (mount) {
  const { bd } = A.demo(mount, '视频的 token 账：为什么生成一段视频要几分钟', '以 Wan 2.1 14B 的结构估算（40 层，d=5120）');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const dur = A.slider(ctl, { label: '时长', min: 1, max: 30, step: 1, value: 5, fmt: (v) => v + ' 秒', on: draw });
  const fps = A.slider(ctl, { label: '帧率', min: 8, max: 30, step: 1, value: 16, fmt: (v) => v + ' fps', on: draw });
  let res = [1280, 720], sp = 8, attn = 'full';
  A.seg(ctl, [{ v: '480', t: '480p' }, { v: '720', t: '720p' }, { v: '1080', t: '1080p' }, { v: '2160', t: '4K' }], '720', (v) => { res = { 480: [854, 480], 720: [1280, 720], 1080: [1920, 1080], 2160: [3840, 2160] }[v]; draw(); }, '分辨率');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.seg(ctl2, [{ v: 8, t: '4×8×8' }, { v: 16, t: '4×16×16' }], sp, (v) => { sp = v; draw(); }, 'VAE 压缩（时×高×宽）');
  A.seg(ctl2, [{ v: 'full', t: '全 3D 注意力' }, { v: 'fact', t: '空间 + 时间分解' }], attn, (v) => { attn = v; draw(); }, '注意力');
  const steps = A.slider(ctl2, { label: '去噪步数', min: 1, max: 50, step: 1, value: 50, fmt: (v) => v + ' 步', on: draw });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  let parts = [0, 0];
  const view = A.canvas(cv, { height: 54 }, (ctx, W) => {
    const tot = parts[0] + parts[1], cols = A.series();
    const w0 = (parts[0] / tot) * W;
    ctx.fillStyle = cols[0]; ctx.fillRect(0, 6, w0 - 1, 26); ctx.fillStyle = cols[1]; ctx.fillRect(w0 + 1, 6, W - w0 - 1, 26);
    A.text(ctx, '线性层（∝ token 数）' + A.pct(parts[0] / tot, 0), 6, 44, { size: 12, color: cols[0], weight: 600 });
    A.text(ctx, '注意力（∝ token 数²）' + A.pct(parts[1] / tot, 0), W - 6, 44, { size: 12, color: cols[1], weight: 600, align: 'right' });
  });
  function draw() {
    const frames = Math.round(dur.value * fps.value) + 1;
    const lt = 1 + Math.ceil((frames - 1) / 4), lh = Math.round(res[1] / sp), lw = Math.round(res[0] / sp);
    const tok = lt * Math.ceil(lh / 2) * Math.ceil(lw / 2);
    const N = 14e9, L = 40, d = 5120;
    const lin = 2 * N * tok;
    const perFrame = Math.ceil(lh / 2) * Math.ceil(lw / 2);
    const att = attn === 'full' ? 4 * L * tok * tok * d : 4 * L * d * (tok * perFrame + tok * lt);
    parts = [lin, att];
    const total = (lin + att) * steps.value * 2; // ×2 for CFG
    const sec = total / (989e12 * 0.4);
    stats.innerHTML = '';
    [['像素值', A.human(frames * res[0] * res[1] * 3, 1)], ['潜视频', `${lt}×${lh}×${lw}`], ['token 数', tok.toLocaleString()], ['单次前向', A.sci(lin + att) + ' FLOPs'], ['总计（含 CFG ×2）', A.sci(total)], ['单张 H100 约需', sec > 3600 ? (sec / 3600).toFixed(1) + ' 小时' : sec > 60 ? (sec / 60).toFixed(1) + ' 分钟' : sec.toFixed(0) + ' 秒']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    view.redraw();
  }
  bd.append(A.el('p', { class: 'hint' }, '默认设置（720p、5 秒、16fps、4×8×8）约 7.6 万个 token，与 Wan 2.1 720p 的实际规模一致。分辨率翻倍，token 数变成 4 倍，注意力代价变成 16 倍。所以长视频和高分辨率要靠更强的压缩（4×16×16）、稀疏注意力、少步蒸馏，以及先生成低分辨率再超分。'));
  draw();
});
