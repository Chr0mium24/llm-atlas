/* batching — interactive demo (moved from ch10-infra.html) */
A.defineDemo('batching', function (mount) {
  const { bd } = A.demo(mount, '静态批处理 vs 连续批处理（同一串请求）', '6 个槽位；KV 显存：预留最大长度 vs 分页');
  const ctl = A.el('div', { class: 'flex', style: { marginBottom: '10px' } }); bd.append(ctl);
  let running = false;
  ctl.append(A.el('button', { class: 'primary', onclick: () => { running = !running; if (running) loop(); } }, '运行 / 暂停'), A.el('button', { onclick: () => { reset(); view.redraw(); info(); } }, '重置'));
  const spd = A.slider(ctl, { label: '到达率', min: 0.05, max: 0.4, step: 0.01, value: 0.08, fmt: (v) => v.toFixed(2) + ' 个/步', on: () => {} });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const stats = A.el('div', { class: 'cols' }); bd.append(stats);
  const S = 6, MAXLEN = 160, HIST = 240;
  let t, reqs, lanes;
  function reset() {
    t = 0; const r = A.rng(3); reqs = [];
    let at = 0;
    for (let i = 0; i < 400; i++) { at += -Math.log(1 - r()) / 0.16; reqs.push({ id: i, at, len: Math.round(8 + Math.pow(r(), 2.2) * 150), color: i % 8 }); }
    lanes = ['static', 'cont'].map((mode) => ({ mode, slots: new Array(S).fill(null), queue: [], hist: [], done: [], next: 0, busy: 0, total: 0, kvRes: 0, kvUsed: 0 }));
  }
  function stepLane(L) {
    const rate = spd.value;
    // arrivals (re-time requests by current rate)
    while (L.next < reqs.length && reqs[L.next].at * (0.16 / rate) <= t) { L.queue.push({ ...reqs[L.next], arr: t, prog: 0 }); L.next++; }
    if (L.mode === 'static') {
      // a new batch starts only when every slot of the previous batch has finished
      if (L.slots.every((s) => !s || s.done)) { L.slots = L.slots.map(() => null); for (let i = 0; i < S && L.queue.length; i++) L.slots[i] = L.queue.shift(); }
    } else {
      for (let i = 0; i < S; i++) if (!L.slots[i] && L.queue.length) L.slots[i] = L.queue.shift();
    }
    const snap = [];
    let res = 0, used = 0, busy = 0;
    L.slots.forEach((s, i) => {
      if (!s || s.done) { snap.push(-1); if (s && s.done) res += MAXLEN; return; }
      s.prog++; busy++; used += s.prog;
      res += L.mode === 'static' ? MAXLEN : Math.ceil(s.prog / 16) * 16;
      snap.push(s.color);
      if (s.prog >= s.len) { L.done.push(t - s.arr + 1); if (L.mode === 'static') s.done = true; else L.slots[i] = null; }
    });
    L.busy += busy; L.total += S; L.kvRes += res; L.kvUsed += used;
    L.hist.push(snap);
    if (L.hist.length > HIST) L.hist.shift();
  }
  function loop() { if (!running) return; for (let k = 0; k < 2; k++) { t++; lanes.forEach(stepLane); } view.redraw(); info(); requestAnimationFrame(loop); }
  const view = A.canvas(cv, { aspect: 0.42 }, (ctx, W, H) => {
    const cols = A.series();
    const laneH = (H - 30) / 2;
    lanes.forEach((L, li) => {
      const y0 = li * (laneH + 20) + 18;
      A.text(ctx, L.mode === 'static' ? '静态批处理' : '连续批处理', 0, y0 - 9, { size: 12.5, weight: 600 });
      A.text(ctx, '队列 ' + L.queue.length, W - 2, y0 - 9, { size: 12, align: 'right', color: L.queue.length > 10 ? A.css('--s8') : A.css('--muted') });
      const rowH = laneH / S, cw = W / HIST;
      for (let s = 0; s < S; s++) { ctx.fillStyle = A.css('--grid'); ctx.fillRect(0, y0 + s * rowH + 1, W, rowH - 2); }
      L.hist.forEach((colsAt, x) => colsAt.forEach((c, s) => { if (c >= 0) { ctx.fillStyle = cols[c]; ctx.fillRect(x * cw, y0 + s * rowH + 1, cw + 0.6, rowH - 2); } }));
    });
  });
  function info() {
    stats.innerHTML = '';
    lanes.forEach((L) => {
      const lat = L.done.length ? A.mean(L.done) : 0;
      const card = A.el('div', { class: 'card' });
      card.innerHTML = `<div class="t">${L.mode === 'static' ? '静态批处理 + 预留最大长度' : '连续批处理 + 分页 KV'}</div>
        <div class="d">已完成 <b>${L.done.length}</b> 个请求　平均延迟 <b>${lat.toFixed(0)}</b> 步<br>槽位利用率 <b>${A.pct(L.busy / Math.max(1, L.total), 0)}</b>　KV 显存利用率 <b>${A.pct(L.kvUsed / Math.max(1, L.kvRes), 0)}</b></div>`;
      stats.append(card);
    });
  }
  bd.append(A.el('p', { class: 'hint' }, '已预先运行 300 步。每一行是一个槽位，颜色块是正在生成的请求，灰色是空闲。左右两边换了两件事：调度决定槽位利用率（静态批处理里，一批中的短请求结束后，槽位要空等到最长的请求结束；连续批处理随时补位），显存分配决定 KV 利用率（静态方案为每个请求预留最大长度 160 token，分页方案按 16 token 一块按需分配）。默认到达率 0.08 个/步时，连续批处理几乎不排队，静态批处理的队列越排越长；超过约 0.11 个/步，两者都会过载。'));
  reset(); for (let k = 0; k < 300; k++) { t++; lanes.forEach(stepLane); } info();
});
