/* rl-passk — toy model of "RL sharpens vs discovers": pass@k curves before / after RLVR */
A.defineDemo('rl-passk', function (mount) {
  const { bd } = A.demo(mount, 'RL 是锐化还是发现：pass@k 曲线为什么会交叉', '玩具模型：400 道题，每题有一个基座答对率 p');
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const S = A.slider(ctl, { label: 'RL 训练量', min: 0, max: 10, step: 0.1, value: 5, fmt: (v) => v.toFixed(1), on: draw });
  const G = A.slider(ctl, { label: '每题采样数 G', min: 2, max: 64, step: 1, value: 8, fmt: (v) => v, on: draw });
  const K = A.slider(ctl, { label: '熵塌缩强度（稀有正确路径被剪掉的速度）', min: 0, max: 0.6, step: 0.01, value: 0.25, fmt: (v) => v.toFixed(2), on: draw, width: 250 });
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  bd.append(A.el('div', { class: 'legend', html: '<span><i class="line" style="background:var(--axis)"></i>基座模型</span><span><i class="line" style="background:var(--s2)"></i>标准 RLVR</span><span><i class="line" style="background:var(--s1)"></i>边界感知的 RL（专门在没做对过的题上探索）</span>' }));
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const note = A.el('p', { class: 'hint' }); bd.append(note);
  // problems: 25% never solved (40% of them "dormant", i.e. reachable with exploration), 35% rarely solved, 40% usually solved
  const r = A.rng(8), P = [];
  for (let i = 0; i < 400; i++) {
    const u = r();
    if (u < 0.25) P.push({ p: 0, dormant: r() < 0.4 });
    else if (u < 0.6) P.push({ p: Math.pow(10, -3.3 + 2 * r()), dormant: false });
    else P.push({ p: 0.05 + 0.9 * Math.pow(r(), 0.8), dormant: false });
  }
  const ks = []; for (let e = 0; e <= 10.0001; e += 0.1) ks.push(Math.pow(2, e));
  const passk = (ps, k) => A.mean(ps.map((p) => 1 - Math.pow(1 - p, k)));
  const logit = (p) => Math.log(p / (1 - p)), sigm = (z) => 1 / (1 + Math.exp(-z));
  function after(mode) {
    const s = S.value, g = G.value, aware = mode === 'aware', kap = K.value * (aware ? 0.3 : 1);
    return P.map(({ p, dormant }) => {
      if (p === 0) return aware && dormant ? 0.15 * (1 - Math.exp(-0.25 * s)) : 0; // never solved: no gradient unless exploration finds a correct sample
      const u = 1 - Math.pow(1 - p, g) - Math.pow(p, g); // chance that a group has mixed results, i.e. a non-zero GRPO gradient
      let q = sigm(logit(A.clamp(p, 1e-6, 1 - 1e-6)) + 1.2 * s * u * (aware && p < 0.2 ? 3 : 1)); // sharpening where there is signal
      if (p < 0.2) q *= Math.exp(-kap * s); // rare correct paths get pruned as the policy concentrates
      return A.clamp(q, 0, 1);
    });
  }
  let curves = null;
  const view = A.canvas(cv, { aspect: 0.48 }, (ctx, W, H) => {
    if (!curves) return;
    const box = { x: 46, y: 14, w: W - 62, h: H - 48 };
    const ax = A.axes(ctx, box, { xmin: 1, xmax: 1024, xlog: true, xticks: [1, 4, 16, 64, 256, 1024], xfmt: (v) => 'k=' + v, ymin: 0, ymax: 1, yfmt: (v) => A.pct(v, 0), xlabel: '采样次数 k', xgrid: true });
    const cols = A.series();
    [[curves.base, A.css('--axis')], [curves.std, cols[1]], [curves.aware, cols[0]]].forEach(([ys, c]) => {
      ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.beginPath();
      ks.forEach((k, i) => { const x = ax.X(k), y = ax.Y(ys[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    });
    const ci = ks.findIndex((k, i) => i > 0 && curves.std[i] < curves.base[i]);
    if (ci > 0) {
      const x = ax.X(ks[ci]), y = ax.Y(curves.base[ci]);
      ctx.fillStyle = cols[7]; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      A.text(ctx, `k ≈ ${Math.round(ks[ci])} 之后，标准 RLVR 不如基座`, x + 8, y + 14, { size: 11.5, color: cols[7] });
    }
  });
  function draw() {
    const base = P.map((o) => o.p), std = after('std'), aware = after('aware');
    curves = { base: ks.map((k) => passk(base, k)), std: ks.map((k) => passk(std, k)), aware: ks.map((k) => passk(aware, k)) };
    view.redraw();
    stats.innerHTML = '';
    const solvedNever = P.filter((o, i) => o.p === 0 && aware[i] > 0).length;
    [['pass@1：基座 → 标准 RLVR', A.pct(passk(base, 1), 1) + ' → ' + A.pct(passk(std, 1), 1)], ['pass@256：基座 → 标准 RLVR', A.pct(passk(base, 256), 1) + ' → ' + A.pct(passk(std, 256), 1)], ['pass@256：边界感知 RL', A.pct(passk(aware, 256), 1)], ['原本永远做不对、后来能做对的题', solvedNever + ' 道']]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '16px' } }, v))));
    const zero = P.filter((o) => o.p === 0).length;
    note.textContent = `${zero} 道题基座一次都做不对：一组 ${G.value} 个回答全错，组内优势全为 0，标准 RLVR 在这些题上没有任何梯度。它只能把“偶尔会做”的题练得更稳（pass@1 上升），同时策略变尖，一些稀有的正确路径被剪掉，所以 k 很大时反而不如基座。把熵塌缩强度调到 0，交叉就消失；把每题采样数 G 调大，更多稀有的题能拿到信号。边界感知的 RL 用专门的探索或课程，让一部分从没做对过的题出现正确样本，大 k 的曲线才能真正抬高。`;
  }
  draw();
});
