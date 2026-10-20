/* spatial-camera — pinhole camera: world point → camera coordinates (extrinsics R, t) → pixel (intrinsics f, c); one pixel = one ray */
A.defineDemo('spatial-camera', function (mount) {
  const { bd } = A.demo(mount, '针孔相机：三维点怎样落到像素上', '左：俯视图（可直接拖动相机）；右：这台相机拍到的 640×480 画面；所有坐标按公式实际计算');
  const W0 = 640, H0 = 480;
  const OBJ = [
    { k: 'A', n: '红球', p: [0.5, 0.25, 2], r: 0.15, c: '--s8' },
    { k: 'B', n: '绿方块', p: [-0.7, 0.35, 3], r: 0.2, c: '--s3', box: true },
    { k: 'C', n: '黄灯', p: [1.4, -0.6, 3.5], r: 0.12, c: '--s4' },
  ];
  const WALL = { z: 4, x0: -2.5, x1: 2.5, y0: -1, y1: 0.8 };
  let cam = { x: 0, z: 0, yaw: 0, f: 500 }, sel = 'A', showRay = true;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const sx = A.slider(ctl, { label: '相机左右位置 x', min: -1.5, max: 1.5, step: 0.05, value: 0, fmt: (v) => v.toFixed(2) + ' m', on: (v) => { cam.x = v; draw(); }, width: 150 });
  const sz = A.slider(ctl, { label: '相机前后位置 z', min: -1.5, max: 1.5, step: 0.05, value: 0, fmt: (v) => v.toFixed(2) + ' m', on: (v) => { cam.z = v; draw(); }, width: 150 });
  A.slider(ctl, { label: '朝向 θ（正数向右转）', min: -60, max: 60, step: 1, value: 0, fmt: (v) => v + '°', on: (v) => { cam.yaw = v; draw(); }, width: 160 });
  A.slider(ctl, { label: '焦距 f', min: 200, max: 1000, step: 10, value: 500, fmt: (v) => v + ' 像素', on: (v) => { cam.f = v; draw(); }, width: 150 });
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.seg(ctl2, OBJ.map((o) => ({ t: o.k + ' ' + o.n, v: o.k })), sel, (v) => { sel = v; draw(); }, '看哪个点的计算');
  A.check(ctl2, '画出这个像素对应的光线', showRay, (v) => { showRay = v; draw(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const say = A.el('p', { class: 'gs-say' }); bd.append(say);
  const grid = A.el('div', { class: 'cols' });
  const cvT = A.el('canvas', { class: 'cv', style: { touchAction: 'none', cursor: 'grab' } }), cvI = A.el('canvas', { class: 'cv' });
  grid.append(cvT, cvI); bd.append(grid);
  bd.append(A.el('p', { class: 'hint' }, '俯视图里 x 向右、z 向前（向上），y 轴朝下（垂直于屏幕，看不到）。相机坐标是“以相机为原点、z 轴沿视线”的坐标：先减去相机位置，再用旋转 R 转到相机的朝向（外参），然后除以深度 Z、乘焦距 f、加上画面中心 (320, 240)（内参）。把相机往右挪，所有点在画面里往左移，近的移得多、远的移得少：这个差（视差）就是从两张照片恢复深度的依据。勾选“光线”时，俯视图里的虚线是这个像素对应的整条光线：线上空心圆处的点离相机的深度是它的 1.5 倍、2 倍，却落在完全相同的像素上，单张照片分不出它们。'));

  const R = () => { const t = cam.yaw * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); return [[c, 0, -s], [0, 1, 0], [s, 0, c]]; };
  const toCam = (p) => { const r = R(), d = [p[0] - cam.x, p[1], p[2] - cam.z]; return r.map((row) => row[0] * d[0] + row[1] * d[1] + row[2] * d[2]); };
  const proj = (Xc) => [cam.f * Xc[0] / Xc[2] + W0 / 2, cam.f * Xc[1] / Xc[2] + H0 / 2];
  const cols = () => Object.fromEntries(OBJ.map((o) => [o.k, A.css(o.c)]));
  const fmt = (v, d = 2) => (Math.abs(v) < 0.005 && d === 2 ? '0.00' : v.toFixed(d));

  // top view
  let tv = null, drag = false;
  const vT = A.canvas(cvT, { aspect: 0.86 }, (ctx, W, H) => {
    const box = { x: 34, y: 18, w: W - 46, h: H - 50 };
    const span = { x0: -3, x1: 3, z0: -1.8, z1: 5 };
    const sc = Math.min(box.w / (span.x1 - span.x0), box.h / (span.z1 - span.z0));
    const ox = box.x + box.w / 2 - sc * (span.x0 + span.x1) / 2, oz = box.y + box.h / 2 + sc * (span.z0 + span.z1) / 2;
    const X = (x) => ox + sc * x, Z = (z) => oz - sc * z;
    tv = { X, Z, sc, ox, oz };
    const ink = A.css('--ink'), mut = A.css('--muted'), grid = A.css('--grid'), C = cols();
    ctx.strokeStyle = grid; ctx.lineWidth = 1;
    for (let x = -3; x <= 3; x++) { ctx.beginPath(); ctx.moveTo(X(x), Z(span.z0)); ctx.lineTo(X(x), Z(span.z1)); ctx.stroke(); }
    for (let z = -1; z <= 5; z++) { ctx.beginPath(); ctx.moveTo(X(span.x0), Z(z)); ctx.lineTo(X(span.x1), Z(z)); ctx.stroke(); }
    A.text(ctx, 'x →', X(2.95), Z(span.z0) - 8, { size: 11, align: 'right', color: mut });
    A.text(ctx, 'z（向前）↑', X(-2.95), Z(4.85), { size: 11, color: mut });
    // wall
    ctx.strokeStyle = A.css('--s1'); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(X(WALL.x0), Z(WALL.z)); ctx.lineTo(X(WALL.x1), Z(WALL.z)); ctx.stroke();
    A.text(ctx, '蓝墙 z = 4', X(WALL.x1), Z(WALL.z) - 10, { size: 11, align: 'right', color: A.css('--s1') });
    // frustum
    const t = cam.yaw * Math.PI / 180, fwd = [Math.sin(t), Math.cos(t)], half = Math.atan(W0 / 2 / cam.f);
    ctx.save(); ctx.fillStyle = A.alpha(A.css('--accent'), 0.08); ctx.beginPath(); ctx.moveTo(X(cam.x), Z(cam.z));
    [-half, half].forEach((a) => { const d = [Math.sin(t + a), Math.cos(t + a)]; ctx.lineTo(X(cam.x + 7 * d[0]), Z(cam.z + 7 * d[1])); });
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    [-half, half].forEach((a) => { const d = [Math.sin(t + a), Math.cos(t + a)]; ctx.beginPath(); ctx.moveTo(X(cam.x), Z(cam.z)); ctx.lineTo(X(cam.x + 7 * d[0]), Z(cam.z + 7 * d[1])); ctx.stroke(); });
    ctx.restore();
    // selected ray
    const o = OBJ.find((q) => q.k === sel), Xc = toCam(o.p);
    if (showRay && Xc[2] > 0.05) {
      const dx = o.p[0] - cam.x, dz = o.p[2] - cam.z;
      // extend to the wall (or 3x)
      let sMax = 3; if (dz > 1e-6 && cam.z < WALL.z) sMax = Math.min(3, (WALL.z - cam.z) / dz);
      ctx.save(); ctx.strokeStyle = C[sel]; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(X(cam.x), Z(cam.z)); ctx.lineTo(X(cam.x + sMax * dx), Z(cam.z + sMax * dz)); ctx.stroke(); ctx.restore();
      [1.5, 2].filter((s) => s <= sMax + 1e-9).forEach((s) => { ctx.strokeStyle = C[sel]; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X(cam.x + s * dx), Z(cam.z + s * dz), 5, 0, 7); ctx.stroke(); A.text(ctx, '×' + s, X(cam.x + s * dx) + 8, Z(cam.z + s * dz), { size: 10.5, color: C[sel] }); });
      if (sMax < 3) { ctx.fillStyle = A.css('--s1'); ctx.beginPath(); ctx.arc(X(cam.x + sMax * dx), Z(cam.z + sMax * dz), 4, 0, 7); ctx.fill(); }
    }
    // objects
    OBJ.forEach((q) => {
      ctx.fillStyle = C[q.k];
      if (q.box) ctx.fillRect(X(q.p[0]) - q.r * sc, Z(q.p[2]) - q.r * sc, 2 * q.r * sc, 2 * q.r * sc);
      else { ctx.beginPath(); ctx.arc(X(q.p[0]), Z(q.p[2]), Math.max(4, q.r * sc), 0, 7); ctx.fill(); }
      A.text(ctx, q.k, X(q.p[0]) + q.r * sc + 4, Z(q.p[2]) - q.r * sc - 2, { size: 11.5, weight: 650, color: q.k === sel ? ink : A.css('--ink-2') });
    });
    // camera
    ctx.save(); ctx.translate(X(cam.x), Z(cam.z)); ctx.rotate(t);
    ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-8, 6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    A.text(ctx, '相机', X(cam.x) + 12, Z(cam.z) + 10, { size: 11.5, weight: 600 });
  });
  const near = (e) => { if (!tv) return false; const p = A.pos(cvT, e); return Math.hypot(p.x - tv.X(cam.x), p.y - tv.Z(cam.z)) < 26; };
  cvT.addEventListener('pointerdown', (e) => { if (near(e)) { drag = true; cvT.setPointerCapture(e.pointerId); cvT.style.cursor = 'grabbing'; } });
  cvT.addEventListener('pointermove', (e) => {
    if (!drag) { cvT.style.cursor = near(e) ? 'grab' : 'default'; return; }
    const p = A.pos(cvT, e);
    cam.x = A.clamp(Math.round(((p.x - tv.ox) / tv.sc) * 20) / 20, -1.5, 1.5);
    cam.z = A.clamp(Math.round(((tv.oz - p.y) / tv.sc) * 20) / 20, -1.5, 1.5);
    sx.value = cam.x; sz.value = cam.z; draw();
  });
  const end = () => { drag = false; cvT.style.cursor = 'grab'; };
  cvT.addEventListener('pointerup', end); cvT.addEventListener('pointercancel', end);

  // image view
  const vI = A.canvas(cvI, { aspect: 0.86 }, (ctx, W, H) => {
    const s = Math.min((W - 20) / W0, (H - 56) / H0), iw = W0 * s, ih = H0 * s, ix = (W - iw) / 2, iy = 22;
    const P = (u, v) => [ix + u * s, iy + v * s];
    const ink = A.css('--ink'), mut = A.css('--muted'), C = cols();
    ctx.fillStyle = A.css('--surface-2'); ctx.fillRect(ix, iy, iw, ih);
    ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    // wall grid
    const wcol = A.css('--s1');
    const seg = (a, b) => {
      ctx.beginPath(); let pen = false;
      for (let i = 0; i <= 40; i++) {
        const p = [A.lerp(a[0], b[0], i / 40), A.lerp(a[1], b[1], i / 40), A.lerp(a[2], b[2], i / 40)], Xc = toCam(p);
        if (Xc[2] < 0.05) { pen = false; continue; }
        const [u, v] = proj(Xc), q = P(u, v);
        if (Math.abs(q[0]) > 1e5 || Math.abs(q[1]) > 1e5) { pen = false; continue; }
        pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true;
      }
      ctx.stroke();
    };
    const corners = [[WALL.x0, WALL.y0], [WALL.x1, WALL.y0], [WALL.x1, WALL.y1], [WALL.x0, WALL.y1]].map(([x, y]) => toCam([x, y, WALL.z]));
    if (corners.every((c) => c[2] > 0.05)) { ctx.fillStyle = A.alpha(wcol, 0.14); ctx.beginPath(); corners.forEach((c, i) => { const q = P(...proj(c)); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = A.alpha(wcol, 0.55); ctx.lineWidth = 1;
    for (let x = WALL.x0; x <= WALL.x1 + 1e-9; x += 0.5) seg([x, WALL.y0, WALL.z], [x, WALL.y1, WALL.z]);
    [WALL.y0, -0.5, 0, 0.5, WALL.y1].forEach((y) => seg([WALL.x0, y, WALL.z], [WALL.x1, y, WALL.z]));
    // objects, far first
    OBJ.map((q) => ({ q, Xc: toCam(q.p) })).filter((o) => o.Xc[2] > 0.05).sort((a, b) => b.Xc[2] - a.Xc[2]).forEach(({ q, Xc }) => {
      const [u, v] = proj(Xc), c = P(u, v), rr = Math.max(2, cam.f * q.r / Xc[2] * s);
      ctx.fillStyle = C[q.k];
      if (q.box) ctx.fillRect(c[0] - rr, c[1] - rr, 2 * rr, 2 * rr); else { ctx.beginPath(); ctx.arc(c[0], c[1], rr, 0, 7); ctx.fill(); }
      A.text(ctx, q.k, c[0] + rr + 3, c[1] - rr, { size: 11.5, weight: 650, color: ink });
    });
    // principal point
    const pc = P(W0 / 2, H0 / 2); ctx.strokeStyle = mut; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pc[0] - 6, pc[1]); ctx.lineTo(pc[0] + 6, pc[1]); ctx.moveTo(pc[0], pc[1] - 6); ctx.lineTo(pc[0], pc[1] + 6); ctx.stroke();
    // selected crosshair
    const o = OBJ.find((q) => q.k === sel), Xc = toCam(o.p);
    if (Xc[2] > 0.05) {
      const [u, v] = proj(Xc), c = P(u, v);
      ctx.strokeStyle = ink; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(c[0], iy); ctx.lineTo(c[0], iy + ih); ctx.moveTo(ix, c[1]); ctx.lineTo(ix + iw, c[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    ctx.strokeStyle = A.css('--axis'); ctx.strokeRect(ix, iy, iw, ih);
    A.text(ctx, '(0, 0)', ix, iy - 9, { size: 10.5, color: mut });
    A.text(ctx, 'u →', ix + iw, iy - 9, { size: 10.5, color: mut, align: 'right' });
    A.text(ctx, 'v ↓', ix + 4, iy + ih - 9, { size: 10.5, color: mut });
    A.text(ctx, '+ 是画面中心 (320, 240)', ix + iw, iy + ih + 14, { size: 11, color: mut, align: 'right' });
  });

  function draw() {
    const o = OBJ.find((q) => q.k === sel), Xc = toCam(o.p);
    stats.innerHTML = '';
    const inFront = Xc[2] > 0.05;
    const uv = inFront ? proj(Xc) : null;
    const inside = uv && uv[0] >= 0 && uv[0] <= W0 && uv[1] >= 0 && uv[1] <= H0;
    [['世界坐标 Xw', `(${o.p.map((v) => fmt(v)).join(', ')})`], ['相机坐标 Xc = R(Xw − C)', `(${Xc.map((v) => fmt(v)).join(', ')})`],
      ['像素 (u, v)', inFront ? `(${uv[0].toFixed(1)}, ${uv[1].toFixed(1)})` + (inside ? '' : ' 画面外') : '在相机背后']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '15px', fontFamily: 'var(--mono)' } }, v))));
    say.innerHTML = inFront
      ? `<b>${o.k} ${o.n}：</b>u = f·X/Z + c<sub>x</sub> = ${cam.f} × ${fmt(Xc[0])} / ${fmt(Xc[2])} + 320 = ${uv[0].toFixed(1)}；v = ${cam.f} × ${fmt(Xc[1])} / ${fmt(Xc[2])} + 240 = ${uv[1].toFixed(1)}。它离相机 ${fmt(Xc[2])} m，半径 ${o.r} m，在画面里约 ${(cam.f * o.r / Xc[2]).toFixed(0)} 像素：大小和深度成反比。`
      : `<b>${o.k} ${o.n}</b> 在相机背后（Z ≤ 0），拍不到。`;
    vT.redraw(); vI.redraw();
  }
  draw();
});
