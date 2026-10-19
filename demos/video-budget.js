/* video-budget — interactive demo (moved from ch16-vlm.html) */
A.defineDemo('video-budget', function (mount) {
  const { bd } = A.demo(mount, '视频 token 预算：一段视频要占多少上下文', '每帧 token 按 Qwen3-VL 的 32×32 像素 / token 估算');
  const RES = { 360: [640, 360], 720: [1280, 720], 1080: [1920, 1080] };
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const fpsS = A.slider(ctl, { label: '采样帧率', min: 0.1, max: 4, log: true, value: 2, fmt: (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1)) + ' 帧/秒', on: () => upd() });
  const resSeg = A.seg(ctl, [{ v: 360, t: '360p' }, { v: 720, t: '720p' }, { v: 1080, t: '1080p' }], 720, () => upd(), '每帧分辨率');
  const poolSeg = A.seg(ctl, [{ v: 1, t: '无' }, { v: 2, t: '2×' }, { v: 4, t: '4×' }], 1, () => upd(), '额外 token 压缩');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const tm = A.check(ctl2, '相邻 2 帧合并为一组 token（时间 patch = 2）', true, () => upd());
  const au = A.check(ctl2, '包含音频（每秒 25 token）', false, () => upd());
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  legend.innerHTML = '<span><i class="line" style="background:var(--s1)"></i>当前设置</span><span><i class="line" style="background:var(--s2)"></i>Gemini 3 默认：每秒 1 帧 × 70 + 音频 25</span><span><i class="line" style="background:var(--s7)"></i>Gemini 3 高：每秒 1 帧 × 280 + 音频 25</span>';
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  bd.append(A.el('p', { class: 'hint' }, '横纵轴都是对数刻度，鼠标悬停可读数。真实模型还有更多手段：Qwen3-VL 的处理器会限制整段视频的总像素，视频越长每帧越小；长视频模型还会挑关键帧、合并相似的帧。'));
  const perFrame = () => { const [w, h] = RES[resSeg.value]; return (Math.round(w / 32) * Math.round(h / 32)) / (tm.checked ? 2 : 1) / poolSeg.value; };
  const perSec = () => fpsS.value * perFrame() + (au.checked ? 25 : 0);
  const LINES = () => [[perSec(), A.series()[0]], [95, A.series()[1]], [305, A.series()[6]]];
  const dur = (s) => (s < 60 ? Math.round(s) + ' 秒' : s < 3600 ? (s / 60).toFixed(s < 600 ? 1 : 0) + ' 分钟' : (s / 3600).toFixed(1) + ' 小时');
  let mx = null;
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const box = { x: 58, y: 14, w: W - 76, h: H - 48 };
    const ax = A.axes(ctx, box, { xmin: 10, xmax: 14400, xlog: true, xticks: [10, 60, 600, 3600, 14400], xfmt: (v) => ({ 10: '10 秒', 60: '1 分钟', 600: '10 分钟', 3600: '1 小时', 14400: '4 小时' }[v]), ymin: 100, ymax: 1e8, ylog: true, yfmt: (v) => A.human(v, 0), xlabel: '视频时长', xgrid: true });
    [[262144, '256K 上下文'], [1048576, '1M 上下文']].forEach(([v, t]) => {
      const y = ax.Y(v); ctx.strokeStyle = A.css('--bad'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.setLineDash([]);
      A.text(ctx, t, box.x + 6, y - 8, { size: 11.5, color: A.css('--bad') });
    });
    LINES().forEach(([r, c], i) => {
      ctx.strokeStyle = c; ctx.lineWidth = i ? 1.8 : 2.8; ctx.beginPath();
      ctx.moveTo(ax.X(10), ax.Y(A.clamp(r * 10, 100, 1e8))); ctx.lineTo(ax.X(14400), ax.Y(A.clamp(r * 14400, 100, 1e8))); ctx.stroke();
    });
    if (mx !== null && mx >= box.x && mx <= box.x + box.w) {
      const s = ax.invX(mx);
      ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, box.y); ctx.lineTo(mx, box.y + box.h); ctx.stroke();
      LINES().forEach(([r, c]) => { const v = r * s; if (v < 100 || v > 1e8) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(mx, ax.Y(v), 4, 0, 7); ctx.fill(); });
      view._tip = `<b>${dur(s)}</b><br>` + ['当前设置', 'Gemini 3 默认', 'Gemini 3 高'].map((n, i) => `<span style="color:${LINES()[i][1]}">●</span> ${n}：${A.human(LINES()[i][0] * s, 1)} token`).join('<br>');
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { mx = A.pos(cv, e).x; view.redraw(); if (view._tip) A.tip.show(view._tip, e.clientX, e.clientY); else A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { mx = null; view.redraw(); A.tip.hide(); });
  function upd() {
    view.redraw();
    const pf = perFrame(), ps = perSec();
    stats.innerHTML = '';
    [['每帧 token', A.human(pf, 1) + (tm.checked ? ' <small>（2 帧合 1 后折算）</small>' : '')], ['每秒 token', A.human(ps, ps >= 100 ? 0 : 1)], ['256K 能放', dur(262144 / ps)], ['1M 能放', dur(1048576 / ps)], ['1 小时视频', A.human(ps * 3600, 1) + ' <small>token</small>']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
  }
  upd();
});
