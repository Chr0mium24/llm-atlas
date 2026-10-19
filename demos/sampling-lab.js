/* sampling-lab — interactive demo (moved from ch04-generation.html) */
A.defineDemo('sampling-lab', function (mount) {
  const { bd } = A.demo(mount, '采样实验室：温度、top-k、top-p、min-p', '候选和 logit 为示意');
  const CTX = {
    weather: { p: '今天天气很', c: [['好', 3.2], ['热', 2.8], ['冷', 2.3], ['不错', 2.1], ['晴朗', 1.6], ['闷', 1.2], ['糟糕', 1.0], ['舒服', 0.8], ['奇怪', 0.2], ['适合', 0.1], ['潮湿', 0.0], ['差', -0.3], ['蓝', -1.6], ['猫', -3.0], ['量子', -4.2]] },
    math: { p: '1 + 1 =', c: [[' 2', 7.0], [' 3', 2.2], [' 11', 1.9], [' 二', 1.6], [' ?', 1.0], [' 1', 0.8], [' 0', 0.3], [' two', 0.2], [' 4', 0.0], [' 10', -0.5], [' x', -1.5], [' 猫', -4.0]] },
    story: { p: '从前有一只', c: [['小兔子', 2.0], ['猫', 1.95], ['狐狸', 1.9], ['小狗', 1.85], ['老虎', 1.7], ['小鸟', 1.6], ['熊', 1.5], ['龙', 1.4], ['乌龟', 1.3], ['蚂蚁', 1.2], ['青蛙', 1.1], ['猴子', 1.0], ['鲸鱼', 0.7], ['机器人', 0.5], ['桌子', -1.5]] },
  };
  let key = 'weather';
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'weather', t: '今天天气很…' }, { v: 'math', t: '1 + 1 =' }, { v: 'story', t: '从前有一只…' }], key, (v) => { key = v; hist = null; seqOut.textContent = ''; render(); }, '上下文');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const T = A.slider(ctl2, { label: '温度 T', min: 0.05, max: 2.5, step: 0.05, value: 1, fmt: (v) => v.toFixed(2), on: () => { hist = null; render(); } });
  const K = A.slider(ctl2, { label: 'top-k（15 = 不限）', min: 1, max: 15, step: 1, value: 15, fmt: (v) => (v >= 15 ? '不限' : v), on: () => { hist = null; render(); } });
  const P = A.slider(ctl2, { label: 'top-p', min: 0.05, max: 1, step: 0.01, value: 1, fmt: (v) => v.toFixed(2), on: () => { hist = null; render(); } });
  const MP = A.slider(ctl2, { label: 'min-p', min: 0, max: 0.5, step: 0.01, value: 0, fmt: (v) => v.toFixed(2), on: () => { hist = null; render(); } });
  const btns = A.el('div', { class: 'flex', style: { marginBottom: '10px' } }); bd.append(btns);
  const seqOut = A.el('span', { class: 'mono', style: { fontSize: '15px' } });
  btns.append(A.el('button', { class: 'primary', onclick: () => sampleN(1) }, '采样 1 次'), A.el('button', { onclick: () => sampleN(500) }, '采样 500 次看分布'), A.el('button', { onclick: () => { hist = null; seqOut.textContent = ''; render(); } }, '清空'), seqOut);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  let hist = null, probs = [], kept = [];
  const rr = A.rng(Date.now() % 100000);
  function compute() {
    const c = CTX[key].c;
    const raw = A.softmax(c.map((x) => x[1]));
    let p = A.softmax(c.map((x) => x[1]), T.value);
    const order = p.map((v, i) => i).sort((a, b) => p[b] - p[a]);
    const keep = new Array(p.length).fill(true);
    const k = K.value >= 15 ? p.length : K.value;
    order.forEach((i, r) => { if (r >= k) keep[i] = false; });
    let cum = 0;
    order.forEach((i) => { if (!keep[i]) return; if (cum >= P.value) keep[i] = false; cum += p[i]; });
    const mx = Math.max(...p);
    p.forEach((v, i) => { if (v < MP.value * mx) keep[i] = false; });
    keep[order[0]] = true;
    const z = A.sum(p.filter((v, i) => keep[i]));
    probs = p.map((v, i) => (keep[i] ? v / z : 0));
    kept = keep;
    return { raw, pT: p };
  }
  function sampleN(n) {
    compute();
    if (!hist || n === 1) hist = hist || new Array(probs.length).fill(0);
    let last = 0;
    for (let s = 0; s < n; s++) {
      let u = rr(), i = 0;
      for (; i < probs.length - 1; i++) { u -= probs[i]; if (u <= 0) break; }
      hist[i]++; last = i;
    }
    if (n === 1) seqOut.innerHTML = `${CTX[key].p}<b style="color:var(--s1)">${CTX[key].c[last][0]}</b>`;
    render();
  }
  let last = {};
  function render() {
    last = compute();
    view.redraw();
    const nk = kept.filter(Boolean).length;
    const H = -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
    stats.innerHTML = '';
    [['保留的候选数', nk + ' / ' + probs.length], ['最终分布的熵', H.toFixed(2) + ' bit'], ['最可能的 token', CTX[key].c[probs.indexOf(Math.max(...probs))][0] + '  ' + A.pct(Math.max(...probs))]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' } }, v))));
  }
  const view = A.canvas(cv, { height: 380 }, (ctx, W, H) => {
    const c = CTX[key].c, n = c.length, cols = A.series();
    const left = 74, right = 64, rowH = (H - 20) / n, bh = Math.min(16, rowH * 0.62);
    const mx = Math.max(...probs, ...(last.raw || [0]), ...(hist ? hist.map((h) => h / A.sum(hist)) : [0]));
    c.forEach(([t], i) => {
      const y = 8 + i * rowH;
      A.text(ctx, t, left - 8, y + rowH / 2, { size: 13, align: 'right', color: kept[i] ? A.css('--ink') : A.css('--muted') });
      const wRaw = ((last.raw[i]) / mx) * (W - left - right);
      ctx.strokeStyle = A.css('--axis'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.strokeRect(left + 0.5, y + (rowH - bh) / 2 + 0.5, Math.max(1, wRaw), bh); ctx.setLineDash([]);
      const w = (probs[i] / mx) * (W - left - right);
      A.hbar(ctx, left, y + (rowH - bh) / 2, w, bh, kept[i] ? cols[0] : A.css('--grid'));
      if (hist) {
        const hp = hist[i] / A.sum(hist);
        const x = left + (hp / mx) * (W - left - right);
        ctx.fillStyle = cols[1]; ctx.fillRect(x - 1.5, y + (rowH - bh) / 2 - 3, 3, bh + 6);
      }
      A.text(ctx, kept[i] ? A.pct(probs[i]) : '已过滤', W - right + 6, y + rowH / 2, { size: 12, color: kept[i] ? A.css('--ink-2') : A.css('--muted'), mono: true });
    });
  });
  legend.innerHTML = `<span><i style="background:var(--s1)"></i>处理后的采样概率</span><span><i style="border:1px dashed var(--axis);background:none"></i>原始 softmax（T=1，无过滤）</span><span><i style="background:var(--s2);width:3px"></i>实际采样频率</span>`;
  render();
});
