/* image-tokens — interactive demo (moved from ch16-vlm.html) */
A.defineDemo('image-tokens', function (mount) {
  const { bd } = A.demo(mount, '图像 token 计算器：同一张图，各家要花多少 token', '拖动宽高或选预设');
  const PRE = [['正方形 1024²', 1024, 1024], ['1080p 截图', 1920, 1080], ['手机长截图', 1179, 2556], ['A4 扫描 300dpi', 2480, 3508], ['4K 照片', 3840, 2160], ['横幅', 3000, 600], ['小图 320×240', 320, 240]];
  const ST = [
    { v: 'fixed', t: 'LLaVA-1.5 固定 336' }, { v: 'anyres', t: 'LLaVA-NeXT 切片' }, { v: 'intern', t: 'InternVL 动态切片' },
    { v: 'q25', t: 'Qwen2.5-VL 原生' }, { v: 'q3', t: 'Qwen3-VL 原生' }, { v: 'gpt', t: 'GPT-4o（2024 规则）' }, { v: 'gem', t: 'Gemini 3' },
  ];
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const pre = A.seg(ctl, PRE.map((p, i) => ({ v: i, t: p[0] })), 1, (i) => { wS.value = PRE[i][1]; hS.value = PRE[i][2]; update(); }, '预设');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const wS = A.slider(ctl2, { label: '宽（像素）', min: 64, max: 4096, step: 1, value: 1920, fmt: (v) => v, on: () => { pre.set(-1); update(); } });
  const hS = A.slider(ctl2, { label: '高（像素）', min: 64, max: 4096, step: 1, value: 1080, fmt: (v) => v, on: () => { pre.set(-1); update(); } });
  const capS = A.seg(ctl2, [{ v: 256, t: '256' }, { v: 1280, t: '1280' }, { v: 4096, t: '4096' }, { v: 16384, t: '16384' }], 1280, update, 'Qwen：token 上限（max_pixels）');
  const gem = A.seg(ctl2, [{ v: 280, t: '低 280' }, { v: 560, t: '中 560' }, { v: 1120, t: '高 1120' }, { v: 2240, t: '超高 2240' }], 1120, update, 'Gemini：media_resolution');
  const ctl3 = A.el('div', { class: 'controls' }); bd.append(ctl3);
  const st = A.seg(ctl3, ST, 'q3', update, '方案');
  const grid = A.el('div', { class: 'cols' }); bd.append(grid);
  const left = A.el('div'), right = A.el('div'); grid.append(left, right);
  const cvI = A.el('canvas', { class: 'cv' }); left.append(cvI);
  const note = A.el('p', { class: 'hint' }); left.append(note);
  const stats = A.el('div', { class: 'stats', style: { marginTop: 0 } }); right.append(stats);
  const cvB = A.el('canvas', { class: 'cv' }); right.append(cvB);
  const pipe = A.el('div', { class: 'vlm-pipe' }); bd.append(pipe);

  function smart(W, H, f, maxTok, minTok = 4) {
    const maxP = maxTok * f * f, minP = minTok * f * f;
    let h = Math.max(f, Math.round(H / f) * f), w = Math.max(f, Math.round(W / f) * f);
    if (h * w > maxP) { const b = Math.sqrt((H * W) / maxP); h = Math.max(f, Math.floor(H / b / f) * f); w = Math.max(f, Math.floor(W / b / f) * f); }
    else if (h * w < minP) { const b = Math.sqrt(minP / (H * W)); h = Math.ceil((H * b) / f) * f; w = Math.ceil((W * b) / f) * f; }
    return { w, h };
  }
  function calc(k, W, H) {
    if (k === 'fixed') {
      const s = Math.max(W, H);
      return { tok: 576, vw: s, vh: s, img: { x: (s - W) / 2, y: (s - H) / 2, w: W, h: H }, cells: [24, 24], note: `先补成 ${s}×${s} 的正方形（灰色是补的部分），再缩到 336×336，切成 24×24 个 14 像素的 patch。每个 token 对应原图约 ${Math.round(s / 24)}×${Math.round(s / 24)} 像素。` };
    }
    if (k === 'anyres') {
      const opts = [[1, 2], [2, 1], [2, 2], [1, 3], [3, 1]];
      let best = null;
      opts.forEach(([c, r]) => {
        const rw = 336 * c, rh = 336 * r, sc = Math.min(rw / W, rh / H), dw = Math.round(W * sc), dh = Math.round(H * sc);
        const eff = Math.min(dw * dh, W * H), waste = rw * rh - eff;
        if (!best || eff > best.eff || (eff === best.eff && waste < best.waste)) best = { c, r, rw, rh, dw, dh, eff, waste };
      });
      const { c, r, rw, rh, dw, dh } = best;
      const fc = Math.round((24 * c * dw) / rw), fr = Math.round((24 * r * dh) / rh);
      return { tok: 576 + fc * fr + fr, vw: rw, vh: rh, img: { x: (rw - dw) / 2, y: (rh - dh) / 2, w: dw, h: dh }, tiles: [c, r], cells: [24 * c, 24 * r], note: `选 ${c}×${r} 的网格（${rw}×${rh}），图按比例缩放后居中。每块 336² 得 576 个 token，去掉填充区域、每行末尾加一个换行 token，共 ${fc * fr + fr} 个；再加一张 336² 缩略图 576 个。` };
    }
    if (k === 'intern') {
      const asp = W / H, cand = [];
      for (let i = 1; i <= 12; i++) for (let j = 1; j <= 12; j++) if (i * j <= 12) cand.push([i, j]);
      cand.sort((a, b) => a[0] * a[1] - b[0] * b[1]);
      let best = [1, 1], bd2 = Infinity;
      cand.forEach(([i, j]) => { const d = Math.abs(asp - i / j); if (d < bd2) { bd2 = d; best = [i, j]; } else if (d === bd2 && W * H > 0.5 * 448 * 448 * i * j) best = [i, j]; });
      const [i, j] = best, n = i * j;
      return { tok: 256 * (n + (n > 1 ? 1 : 0)), vw: 448 * i, vh: 448 * j, img: { x: 0, y: 0, w: 448 * i, h: 448 * j }, tiles: [i, j], cells: [16 * i, 16 * j], note: `宽高比 ${asp.toFixed(2)} 最接近 ${i}:${j}，把图缩放（会略微拉伸${W * H < 448 * 448 * n * 0.5 ? '；原图小得多，会被放大' : ''}）到 ${448 * i}×${448 * j}，切成 ${n} 块 448²。每块经 pixel shuffle 后 256 个 token${n > 1 ? '，另加一张缩略图 256 个' : ''}。` };
    }
    if (k === 'q25' || k === 'q3') {
      const f = k === 'q25' ? 28 : 32, p = f / 2, { w, h } = smart(W, H, f, Math.round(capS.value));
      return { tok: (w / f) * (h / f), vw: w, vh: h, img: { x: 0, y: 0, w, h }, cells: [w / f, h / f], f, p, rw: w, rh: h, note: `缩放到 ${w}×${h}（${f} 的整数倍，总像素不超过上限），切成 ${p}×${p} 的 patch，2×2 合并后每个 token 对应 ${f}×${f} 像素。` };
    }
    if (k === 'gpt') {
      let w = W, h = H;
      if (Math.max(w, h) > 2048) { const s = 2048 / Math.max(w, h); w *= s; h *= s; }
      if (Math.min(w, h) > 768) { const s = 768 / Math.min(w, h); w *= s; h *= s; }
      w = Math.round(w); h = Math.round(h);
      const tc = Math.ceil(w / 512), tr = Math.ceil(h / 512);
      return { tok: 85 + 170 * tc * tr, vw: 512 * tc, vh: 512 * tr, img: { x: 0, y: 0, w, h }, tiles: [tc, tr], note: `先缩到 2048 以内，再把短边缩到 768：${w}×${h}。按 512×512 切成 ${tc}×${tr} = ${tc * tr} 块，每块 170 token，再加 85。` };
    }
    const lv = gem.value;
    return { tok: lv, vw: W, vh: H, img: { x: 0, y: 0, w: W, h: H }, note: `token 数由 media_resolution 决定，与原图大小无关：当前 ${lv}。内部如何切分没有公开，这里不画网格。` };
  }
  function picture(ctx, x, y, w, h, W, H) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = A.css('--surface'); ctx.fillRect(x, y, w, h);
    const sx = w / W, sy = h / H, cols = A.series();
    ctx.fillStyle = A.alpha(cols[0], 0.85); ctx.fillRect(x, y, w, Math.max(1, 64 * sy));
    ctx.fillStyle = A.alpha(cols[2], 0.35); ctx.fillRect(x + w * 0.62, y + 110 * sy, w * 0.32, Math.min(h * 0.3, w * 0.24 * (sy / sx)));
    const r = A.rng(5);
    ctx.fillStyle = A.css('--muted');
    for (let ly = 110; ly < H - 20; ly += 34) {
      const len = (ly < 110 + H * 0.3 ? 0.55 : 0.9) * (0.5 + 0.5 * r());
      ctx.fillRect(x + 40 * sx, y + ly * sy, Math.max(1, (W - 80) * len * sx), Math.max(0.6, 14 * sy));
    }
    ctx.restore();
  }
  const viewI = A.canvas(cvI, { aspect: 0.78 }, (ctx, CW, CH) => {
    const W = wS.value, H = hS.value, r = calc(st.value, W, H);
    const sc = Math.min((CW - 20) / r.vw, (CH - 20) / r.vh), ox = (CW - r.vw * sc) / 2, oy = (CH - r.vh * sc) / 2;
    ctx.fillStyle = A.css('--grid'); ctx.fillRect(ox, oy, r.vw * sc, r.vh * sc);
    if (st.value === 'intern') picture(ctx, ox, oy, r.vw * sc, r.vh * sc, W, H);
    else picture(ctx, ox + r.img.x * sc, oy + r.img.y * sc, r.img.w * sc, r.img.h * sc, r.img.w, r.img.h);
    const acc = A.series()[1];
    if (r.cells) {
      const [cx, cy] = r.cells, dx = (r.vw * sc) / cx, dy = (r.vh * sc) / cy;
      if (dx >= 2.5 && dy >= 2.5) {
        ctx.strokeStyle = A.alpha(acc, 0.55); ctx.lineWidth = 0.6; ctx.beginPath();
        for (let i = 0; i <= cx; i++) { const x = Math.round(ox + i * dx) + 0.5; ctx.moveTo(x, oy); ctx.lineTo(x, oy + r.vh * sc); }
        for (let j = 0; j <= cy; j++) { const y = Math.round(oy + j * dy) + 0.5; ctx.moveTo(ox, y); ctx.lineTo(ox + r.vw * sc, y); }
        ctx.stroke();
      } else { ctx.fillStyle = A.alpha(acc, 0.18); ctx.fillRect(ox, oy, r.vw * sc, r.vh * sc); A.text(ctx, '格子太密（每格不到 2.5 像素），未画出', CW / 2, CH - 10, { size: 11.5, align: 'center', color: A.css('--muted') }); }
    }
    if (r.tiles) {
      const [tx, ty] = r.tiles, dx = (r.vw * sc) / tx, dy = (r.vh * sc) / ty;
      ctx.strokeStyle = acc; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let i = 0; i <= tx; i++) { const x = ox + i * dx; ctx.moveTo(x, oy); ctx.lineTo(x, oy + r.vh * sc); }
      for (let j = 0; j <= ty; j++) { const y = oy + j * dy; ctx.moveTo(ox, y); ctx.lineTo(ox + r.vw * sc, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, r.vw * sc - 1, r.vh * sc - 1);
  });
  const viewB = A.canvas(cvB, { aspect: 0.62 }, (ctx, CW, CH) => {
    const W = wS.value, H = hS.value, rows = ST.map((s) => [s, calc(s.v, W, H).tok]);
    const L = Math.min(132, CW * 0.42), fs = CW < 380 ? 11 : 12, top = 6, rh = (CH - top - 4) / rows.length, mx = Math.max(...rows.map((r) => r[1])) * 1.18;
    rows.forEach(([s, tok], i) => {
      const y = top + i * rh, on = s.v === st.value;
      A.text(ctx, s.t, L - 8, y + rh / 2, { size: fs, align: 'right', color: on ? A.css('--ink') : A.css('--ink-2'), weight: on ? 650 : '' });
      A.hbar(ctx, L, y + rh * 0.2, ((CW - L - 8) * tok) / mx, rh * 0.6, on ? A.series()[0] : A.css('--axis'));
      A.text(ctx, A.human(tok, 1), L + ((CW - L - 8) * tok) / mx + 6, y + rh / 2, { size: fs, mono: true, color: on ? A.css('--ink') : A.css('--muted') });
    });
  });
  cvB.addEventListener('click', (e) => { const p = A.pos(cvB, e), i = Math.floor((p.y - 6) / ((viewB.H - 10) / ST.length)); if (i >= 0 && i < ST.length) { st.set(ST[i].v); update(); } });
  cvB.style.cursor = 'pointer';
  function update() {
    const W = wS.value, H = hS.value, r = calc(st.value, W, H);
    viewI.redraw(); viewB.redraw();
    note.textContent = r.note;
    const cover = Math.sqrt((W * H) / r.tok);
    stats.innerHTML = '';
    [['图像 token', A.human(r.tok, 1)], ['每个 token 覆盖原图', `约 ${Math.round(cover)}×${Math.round(cover)} <small>像素</small>`], ['同样的 token 可装', `约 ${A.human(r.tok * 1.5, 1)} <small>个汉字</small>`], ['注意力计算量', `${(r.tok / 576) ** 2 >= 10 ? Math.round((r.tok / 576) ** 2) : ((r.tok / 576) ** 2).toFixed(2)}× <small>（相对 576 token）</small>`]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    if (r.f) {
      const np = (r.rw / r.p) * (r.rh / r.p);
      pipe.innerHTML = `<b>张量的变化（${st.value === 'q25' ? 'Qwen2.5-VL' : 'Qwen3-VL'}）</b>：原图 ${W}×${H}×3 → 缩放到 ${r.rw}×${r.rh} → 切成 ${r.p}×${r.p} 的 patch：${r.rw / r.p}×${r.rh / r.p} = <b>${A.human(np, 1)}</b> 个 → ViT 编码，每个 patch 一个向量 → 相邻 2×2 拼接，4 个变 1 个：<b>${A.human(np / 4, 1)}</b> 个 → MLP 投影到语言模型的隐藏维度 → 加上视觉起止标记，和文字 token 拼成一条序列。`;
    } else pipe.innerHTML = '<b>每格是什么</b>：细格是一个 token（LLaVA 是一个 14×14 patch；InternVL 是 pixel shuffle 后的一个 token），粗线是切片或计费块的边界。点右侧柱状图的某一行可以切换方案。';
  }
  A.onTheme(update);
  update();
});
