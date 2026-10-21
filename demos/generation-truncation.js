/* generation-truncation — sweep temperature for a fixed toy distribution (a few plausible tokens + 20 000 junk tokens) and compare what top-k / top-p / min-p let in (junk mass) and what they cut (plausible mass) */
A.defineDemo('generation-truncation', function (mount) {
  const { bd } = A.demo(mount, '把温度从 0.3 扫到 3：三种截断各自漏进了什么、砍掉了什么', '示意分布：少数“合理”的候选 + 2 万个“垃圾” token（logit 约为 −8 ± 1，模仿真实词表的长尾）；数值按公式实际计算');
  const NJ = 20000;
  function build(kind) {
    const r = A.rng(7), z = [], good = [];
    if (kind === 'open') for (let i = 0; i < 30; i++) { z.push(3 - (2 * i) / 29); good.push(1); }
    else { [8, 4.5, 4, 3.5].forEach((v) => { z.push(v); good.push(1); }); }
    for (let i = 0; i < NJ; i++) { z.push(-8 + A.gauss(r)); good.push(0); }
    const idx = z.map((v, i) => i).sort((a, b) => z[b] - z[a]); // order does not depend on T
    return { z: idx.map((i) => z[i]), good: idx.map((i) => good[i]), nGood: good.filter(Boolean).length };
  }
  const DIST = { open: build('open'), peak: build('peak') };
  let kind = 'open', T = 1, k = 10, P = 0.9, MP = 0.1;
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  A.seg(ctl, [{ v: 'open', t: '开放的上下文（30 个合理候选，差不多一样好）' }, { v: 'peak', t: '确定的上下文（1 个明显答案 + 3 个备选）' }], kind, (v) => { kind = v; draw(); }, '分布');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  A.slider(ctl2, { label: '温度 T（图中竖线）', min: 0.3, max: 3, step: 0.05, value: T, fmt: (v) => v.toFixed(2), on: (v) => { T = v; draw(false); }, width: 170 });
  A.slider(ctl2, { label: 'top-k 的 k', min: 1, max: 50, step: 1, value: k, fmt: (v) => v, on: (v) => { k = v; draw(); }, width: 150 });
  A.slider(ctl2, { label: 'top-p 的 p', min: 0.5, max: 0.99, step: 0.01, value: P, fmt: (v) => v.toFixed(2), on: (v) => { P = v; draw(); }, width: 150 });
  A.slider(ctl2, { label: 'min-p 的 p_min', min: 0.01, max: 0.3, step: 0.01, value: MP, fmt: (v) => v.toFixed(2), on: (v) => { MP = v; draw(); }, width: 150 });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const cols = A.series();
  const METHODS = [
    { id: 'none', name: '不截断', col: () => A.css('--muted'), dash: [5, 4] },
    { id: 'topk', name: 'top-k', col: () => cols[2] },
    { id: 'topp', name: 'top-p', col: () => cols[0] },
    { id: 'minp', name: 'min-p', col: () => cols[1] },
  ];
  bd.append(A.el('div', { class: 'legend', html: METHODS.map((m) => `<span><i class="line" style="background:${m.col()}${m.dash ? ';opacity:.7' : ''}"></i>${m.name}</span>`).join('') }));
  const tbl = A.el('div', { class: 'tablewrap' }); bd.append(tbl);
  const hint = A.el('p', { class: 'hint' }); bd.append(hint);
  // returns stats for one (distribution, T, method)
  function analyze(D, t, m) {
    const z = D.z, g = D.good, n = z.length, e = new Float64Array(n);
    let S = 0; for (let i = 0; i < n; i++) { e[i] = Math.exp((z[i] - z[0]) / t); S += e[i]; }
    let cut = n;
    if (m === 'topk') cut = Math.min(k, n);
    else if (m === 'topp') { let c = 0; for (let i = 0; i < n; i++) { c += e[i] / S; if (c >= P) { cut = i + 1; break; } } }
    else if (m === 'minp') { const th = MP * e[0]; cut = 0; while (cut < n && e[cut] >= th) cut++; }
    let km = 0, junk = 0, goodCut = 0, goodTot = 0;
    for (let i = 0; i < n; i++) { const p = e[i] / S; if (g[i]) goodTot += p; if (i < cut) { km += p; if (!g[i]) junk += p; } else if (g[i]) goodCut += p; }
    let H = 0; for (let i = 0; i < cut; i++) { const q = e[i] / S / km; if (q > 0) H -= q * Math.log2(q); }
    return { nk: cut, junk: junk / km, goodCut: goodCut / goodTot, H, cutMass: Math.max(0, 1 - km) };
  }
  const TS = []; for (let t = 0.3; t <= 3.0001; t += 0.05) TS.push(+t.toFixed(2));
  let curves = null;
  function sweep() { const D = DIST[kind]; curves = METHODS.map((m) => TS.map((t) => analyze(D, t, m.id))); }
  const view = A.canvas(cv, { height: 320 }, (ctx, W, H) => {
    if (!curves) return;
    const gap = 46, w = (W - 60 - gap) / 2;
    const b1 = { x: 52, y: 42, w, h: H - 84 }, b2 = { x: 52 + w + gap, y: 42, w, h: H - 84 };
    const a1 = A.axes(ctx, b1, { xmin: 0.3, xmax: 3, ymin: 1e-5, ymax: 1, ylog: true, yticks: [1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1], yfmt: (v) => (v >= 0.01 ? A.pct(v, 0) : v >= 1e-3 ? '0.1%' : v >= 1e-4 ? '0.01%' : '0.001%'), xticks: [0.5, 1, 1.5, 2, 2.5, 3], xfmt: (v) => v, xlabel: '温度 T', ylabel: '每一步抽到垃圾 token 的概率（对数）', ylabelOffset: 44 });
    const a2 = A.axes(ctx, b2, { xmin: 0.3, xmax: 3, ymin: 0, ymax: 1, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => A.pct(v, 0), xticks: [0.5, 1, 1.5, 2, 2.5, 3], xfmt: (v) => v, xlabel: '温度 T', ylabel: '被砍掉的“合理候选”概率', ylabelOffset: 40 });
    METHODS.forEach((m, j) => {
      [[a1, (s) => Math.max(s.junk, 1e-5), b1], [a2, (s) => s.goodCut, b2]].forEach(([ax, f]) => {
        ctx.save(); ctx.strokeStyle = m.col(); ctx.lineWidth = m.id === 'none' ? 1.5 : 2.5; if (m.dash) ctx.setLineDash(m.dash);
        ctx.beginPath(); TS.forEach((t, i) => { const x = ax.X(t), y = ax.Y(f(curves[j][i])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
      });
    });
    [[a1, b1], [a2, b2]].forEach(([ax, b]) => { const x = ax.X(T); ctx.save(); ctx.strokeStyle = A.css('--ink'); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h); ctx.stroke(); ctx.restore(); });
    view.boxes = [[a1, b1, 'junk'], [a2, b2, 'good']];
  });
  cv.addEventListener('mousemove', (e) => {
    if (!view.boxes) return;
    const p = A.pos(cv, e);
    const hit = view.boxes.find(([, b]) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    if (!hit) { A.tip.hide(); return; }
    const t = A.clamp(Math.round(hit[0].invX(p.x) / 0.05) * 0.05, 0.3, 3), i = TS.indexOf(+t.toFixed(2));
    if (i < 0) return;
    const rows = METHODS.map((m, j) => { const s = curves[j][i]; return `${m.name}：${hit[2] === 'junk' ? '垃圾 ' + fmtP(s.junk) : '砍掉 ' + A.pct(s.goodCut, 0)}，保留 ${A.human(s.nk)} 个`; });
    A.tip.show(`<b>T = ${t.toFixed(2)}</b><br>${rows.join('<br>')}`, e.clientX, e.clientY);
  });
  cv.addEventListener('mouseleave', () => A.tip.hide());
  const fmtP = (x) => (x < 1e-5 ? '≈0' : x < 0.001 ? A.pct(x, 3) : x < 0.1 ? A.pct(x, 2) : A.pct(x, 0));
  function draw(resweep = true) {
    if (resweep || !curves) sweep();
    const D = DIST[kind];
    const cur = METHODS.map((m) => analyze(D, T, m.id));
    const name = { none: '不截断', topk: `top-k（k = ${k}）`, topp: `top-p（p = ${P.toFixed(2)}）`, minp: `min-p（p_min = ${MP.toFixed(2)}）` };
    tbl.innerHTML = `<table><tr><th>T = ${T.toFixed(2)}</th><th>保留的候选</th><th>截掉的概率</th><th>截断后的熵</th><th>每步抽到垃圾</th><th>写 500 个 token 一个垃圾都不出</th></tr>${METHODS.map((m, j) => {
      const s = cur[j], clean = Math.pow(1 - s.junk, 500);
      return `<tr><td><b>${name[m.id]}</b></td><td class="num mono">${A.human(s.nk)}</td><td class="num mono">${A.pct(s.cutMass, 1)}</td><td class="num mono">${s.H.toFixed(2)} bit</td><td class="num mono">${fmtP(s.junk)}</td><td class="num mono">${clean > 0.995 ? '≈100%' : clean < 0.001 ? '≈0' : A.pct(clean, 1)}</td></tr>`;
    }).join('')}</table>`;
    const tp = cur[2], mp = cur[3], tk = cur[1];
    let msg;
    if (T <= 1.05) msg = `T ≤ 1 时三种截断都把垃圾挡在外面（不截断时每步仍有 ${fmtP(cur[0].junk)} 的概率抽到垃圾，几百步下来几乎必然出事）。它们的区别在右图：${kind === 'open' ? `30 个候选差不多一样好时，被砍掉的合理概率：top-k（k = ${k}）${A.pct(tk.goodCut, 0)}，top-p ${A.pct(tp.goodCut, 0)}，min-p ${A.pct(mp.goodCut, 0)}。温度低时分布变尖，top-p 和 min-p 也会只留下前几个。` : '一个明显答案时，top-p 和 min-p 只留下一两个候选，top-k 仍留满 k 个（多出来的是垃圾，只是此刻概率极小）。'}把温度往右拖。`;
    else msg = `温度升高，2 万个垃圾 token 的总概率迅速变大。top-p 只管“累计到 ${P.toFixed(2)}”，于是一口气放进 ${A.human(tp.nk)} 个候选，每步有 ${fmtP(tp.junk)} 抽到垃圾；min-p 的门槛跟着最高概率走，只留 ${A.human(mp.nk)} 个，垃圾 ${fmtP(mp.junk)}。这就是 min-p 论文的主张“高温下更稳”。实际部署很少用 T > 1.2；在常用温度下 min-p 的优势有多大，仍有争议（见下面的争议框）。${kind === 'peak' ? `确定的上下文里，top-k 的 ${k} 个名额有 ${k - 4 > 0 ? k - 4 : 0} 个只能分给垃圾。` : ''}`;
    hint.textContent = msg;
    view.redraw();
  }
  draw();
});
