/* param-calc — interactive demo (moved from ch03-transformer.html) */
A.defineDemo('param-calc', function (mount) {
  const { bd } = A.demo(mount, '参数量计算器', '稠密模型；MoE 见' + A.cref('moe'));
  const PRESETS = {
    'GPT-2 small': { d: 768, L: 12, h: 12, kv: 12, ff: 3072, V: 50257, glu: false, tied: true },
    'GPT-3 175B': { d: 12288, L: 96, h: 96, kv: 96, ff: 49152, V: 50257, glu: false, tied: true },
    'Llama 3 8B': { d: 4096, L: 32, h: 32, kv: 8, ff: 14336, V: 128256, glu: true, tied: false },
    'Qwen3 8B': { d: 4096, L: 36, h: 32, kv: 8, ff: 12288, V: 151936, glu: true, tied: false },
    'Llama 3 70B': { d: 8192, L: 80, h: 64, kv: 8, ff: 28672, V: 128256, glu: true, tied: false },
  };
  let cfg = { ...PRESETS['Llama 3 8B'] };
  const pre = A.el('div', { class: 'flex', style: { marginBottom: '10px' } }); bd.append(pre);
  Object.keys(PRESETS).forEach((k) => pre.append(A.el('button', { onclick: () => { cfg = { ...PRESETS[k] }; sync(); } }, k)));
  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const S = {};
  const add = (key, label, min, max, step, log) => (S[key] = A.slider(ctl, { label, min, max, step, log, value: cfg[key], fmt: (v) => Math.round(v).toLocaleString(), on: (v) => { cfg[key] = Math.round(v); if (key === 'h' && cfg.kv > cfg.h) cfg.kv = cfg.h; if (key === 'kv' && cfg.kv > cfg.h) cfg.kv = cfg.h; calc(); } }));
  add('d', '隐藏维度 d', 256, 16384, 128);
  add('L', '层数 L', 2, 128, 1);
  add('h', '注意力头数 h', 1, 128, 1);
  add('kv', 'KV 头数（GQA）', 1, 128, 1);
  add('ff', 'MLP 中间维度', 512, 65536, 256);
  add('V', '词表大小 V', 1000, 262144, 1000);
  const chk = A.el('div', { class: 'flex' }); bd.append(chk);
  const glu = A.check(chk, 'SwiGLU（3 个矩阵）', cfg.glu, (v) => { cfg.glu = v; calc(); });
  const tied = A.check(chk, '输入输出嵌入共享', cfg.tied, (v) => { cfg.tied = v; calc(); });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  let parts = [];
  const view = A.canvas(cv, { height: 56 }, (ctx, W, H) => {
    const tot = A.sum(parts.map((p) => p.v));
    let x = 0; const cols = A.series();
    parts.forEach((p, i) => {
      const w = (p.v / tot) * W;
      ctx.fillStyle = cols[p.c]; ctx.fillRect(x, 8, Math.max(0, w - 2), 32);
      if (w > 60) A.text(ctx, A.pct(p.v / tot, 0), x + 8, 24, { size: 12, color: '#fff', weight: 600 });
      x += w;
    });
  });
  function sync() { for (const k in S) S[k].value = cfg[k]; glu.checked = cfg.glu; tied.checked = cfg.tied; calc(); }
  function calc() {
    const { d, L, h, V, ff } = cfg; const kv = Math.min(cfg.kv, h);
    const dh = d / h;
    const attn = L * (d * h * dh + 2 * d * kv * dh + h * dh * d);
    const mlp = L * (cfg.glu ? 3 : 2) * d * ff;
    const norm = L * 2 * d + d;
    const emb = V * d * (cfg.tied ? 1 : 2);
    parts = [{ n: '注意力', v: attn, c: 0 }, { n: 'MLP', v: mlp, c: 2 }, { n: '嵌入 + 输出层', v: emb, c: 4 }, { n: '归一化', v: norm, c: 3 }];
    const N = attn + mlp + norm + emb;
    const nonEmb = attn + mlp + norm;
    stats.innerHTML = '';
    [['总参数', A.human(N, 2)], ['非嵌入参数', A.human(nonEmb, 2)], ['BF16 权重大小', A.bytes(N * 2)], ['每 token 前向 FLOPs ≈ 2N', A.sci(2 * nonEmb + 2 * V * d)], ['每层参数 / d²', ((attn + mlp) / L / (d * d)).toFixed(1)]]
      .forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v' }, v))));
    const cols = A.series();
    legend.innerHTML = parts.map((p) => `<span><i style="background:${cols[p.c]}"></i>${p.n} ${A.human(p.v, 2)}</span>`).join('');
    view.redraw();
  }
  calc();
});
