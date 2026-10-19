/* noise-schedule — interactive demo (moved from ch11-diffusion.html) */
A.defineDemo('noise-schedule', function (mount) {
  const { bd } = A.demo(mount, '噪声调度：信噪比随时间怎么变化', 'log SNR = log(a² / b²)');
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i class="line" style="background:var(--s1)"></i>DDPM 线性 β（1000 步）</span><span><i class="line" style="background:var(--s2)"></i>余弦调度（2021）</span><span><i class="line" style="background:var(--s3)"></i>Rectified Flow（a=1−t, b=t）</span><span><i class="line" style="background:var(--s4)"></i>RF + 分辨率偏移 shift=3（SD3 / FLUX 式）</span>' }));
  bd.append(A.el('p', { class: 'hint' }, '分辨率越高，相邻像素越相关，同样的噪声“盖不住”图像结构，所以高分辨率模型会把时间往高噪声一侧偏移（SD3 的 timestep shift）。纵轴越低噪声越大；悬停查看数值。'));
  const linBeta = (() => { const ab = []; let p = 1; for (let i = 0; i < 1000; i++) { p *= 1 - (1e-4 + (0.02 - 1e-4) * i / 999); ab.push(p); } return ab; })();
  const curves = [
    (t) => { const ab = linBeta[Math.min(999, Math.max(0, Math.round(t * 999)))]; return Math.log(ab / (1 - ab)); },
    (t) => { const ab = Math.pow(Math.cos(((t + 0.008) / 1.008) * Math.PI / 2), 2); return Math.log(ab / (1 - ab)); },
    (t) => 2 * Math.log((1 - t) / t),
    (t) => { const ts = (3 * t) / (1 + 2 * t); return 2 * Math.log((1 - ts) / ts); },
  ];
  let mx = null;
  const view = A.canvas(cv, { aspect: 0.36 }, (ctx, W, H) => {
    const box = { x: 40, y: 12, w: W - 56, h: H - 40 };
    const ax = A.axes(ctx, box, { xmin: 0, xmax: 1, ymin: -12, ymax: 12, xfmt: (v) => 't=' + v, yfmt: (v) => v, xgrid: true });
    const cols = A.series();
    curves.forEach((f, ci) => { ctx.strokeStyle = cols[ci]; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 1; i < 300; i++) { const t = i / 300, y = ax.Y(A.clamp(f(t), -12, 12)); i > 1 ? ctx.lineTo(ax.X(t), y) : ctx.moveTo(ax.X(t), y); } ctx.stroke(); });
    if (mx !== null && mx > box.x && mx < box.x + box.w) {
      const t = ax.invX(mx);
      ctx.strokeStyle = A.css('--axis'); ctx.beginPath(); ctx.moveTo(mx, box.y); ctx.lineTo(mx, box.y + box.h); ctx.stroke();
      view._tip = `<b>t = ${t.toFixed(2)}</b><br>` + ['线性 β', '余弦', 'RF', 'RF shift=3'].map((n, i) => `<span style="color:${cols[i]}">●</span> ${n}：${curves[i](t).toFixed(2)}`).join('<br>');
    } else view._tip = null;
  });
  cv.addEventListener('mousemove', (e) => { mx = A.pos(cv, e).x; view.redraw(); view._tip ? A.tip.show(view._tip, e.clientX, e.clientY) : A.tip.hide(); });
  cv.addEventListener('mouseleave', () => { mx = null; view.redraw(); A.tip.hide(); });
});
