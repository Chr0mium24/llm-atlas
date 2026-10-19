/* rag-toy — interactive demo (moved from ch15-agents.html) */
A.defineDemo('rag-toy', function (mount) {
  const { bd } = A.demo(mount, 'RAG 玩具：切块、嵌入、召回', '一份虚构的网盘帮助文档 · 7 个问题');
  const DOC = `星河云盘帮助中心

一、账户与登录
星河云盘支持手机号、邮箱和第三方账号登录。连续输错密码 5 次，账户会被锁定 30 分钟。开启两步验证后，在新设备上登录需要输入手机收到的 6 位验证码。忘记密码时，可以在登录页点击“找回密码”，通过绑定的手机号或邮箱重置。

二、存储空间与套餐
免费版提供 15 GB 存储空间，单个文件的上传上限为 2 GB。付费套餐分为标准版（200 GB，每月 12 元）和专业版（2 TB，每月 30 元），按年订阅打八折。专业版的单个文件上传上限为 50 GB，并保留 180 天的历史版本。空间用满后不能再上传新文件，已有文件仍可正常下载和分享。

三、退款政策
付费套餐购买后 7 天内，且已用空间未超过免费额度，可以在“订单管理”中申请全额退款。超过 7 天的订单不支持退款，但可以随时关闭自动续费，当前周期结束后不再扣费。退款会在 3 至 5 个工作日内原路退回。

四、同步与备份
电脑客户端会自动同步“星河云盘”文件夹里的所有改动。如果两台设备同时修改同一文件，后同步的一方会生成一个“冲突副本”，两个版本都会保留，需要手动合并。手机 App 默认开启相册备份，只在连接 Wi-Fi 时上传照片和视频。如需停用，在 App 的“设置 → 相册备份”中关闭开关即可。

五、分享与协作
文件和文件夹都可以生成分享链接。链接的有效期可选 1 天、7 天、30 天或永久，也可以设置 4 位提取码。共享文件夹最多邀请 50 名成员，成员可以设为“仅查看”或“可编辑”。

六、回收站与恢复
删除的文件会进入回收站，保留 30 天，期间可随时恢复。专业版用户的回收站保留 90 天。在回收站中再次删除的文件会被永久清除，无法找回。

七、常见错误代码
E-4011：登录状态已过期，请重新登录。
E-4012：单个文件超过当前套餐的上传上限，请升级套餐或分卷压缩后上传。
E-4013：存储空间已满，请清理文件或升级套餐。
E-5003：服务器繁忙，请稍后重试。
E-5010：同步服务暂时不可用，客户端会在恢复后自动重试。`;
  const QS = [
    ['免费用户能用多大的空间？', '免费版提供 15 GB 存储空间'],
    ['开了年费会员后悔了，能退钱吗？', '7 天内，且已用空间未超过免费额度，可以在“订单管理”中申请全额退款'],
    ['E-4012 是什么错误？', 'E-4012：单个文件超过当前套餐的上传上限'],
    ['不小心删掉的文件还能找回来吗？', '保留 30 天，期间可随时恢复'],
    ['分享出去的链接多久会失效？', '有效期可选 1 天、7 天、30 天或永久'],
    ['手机上怎么关掉照片自动上传？', '在 App 的“设置 → 相册备份”中关闭开关'],
    ['两台电脑同时改同一个文件会怎样？', '后同步的一方会生成一个“冲突副本”'],
  ];
  // toy "embedding model": a hand-written concept table (synonyms share a dimension)
  const CONCEPTS = [
    ['免费'], ['空间', '容量', '多大', '存储'], ['付费', '套餐', '会员', '订阅', '年费', '标准版', '专业版'], ['元', '价格', '多少钱', '扣费', '收费', '续费'],
    ['退款', '退钱', '退费', '退回'], ['后悔', '不想要', '不满意'], ['登录', '密码', '账号', '账户', '验证码'], ['同步', '备份', '自动上传'], ['上传'],
    ['设备', '电脑', '客户端', '手机', 'App'], ['手机', 'App', '移动端'], ['照片', '相册', '图片', '视频'], ['关闭', '关掉', '停用', '关了'],
    ['冲突', '同时修改', '同时改', '合并'], ['分享', '共享', '链接', '提取码', '发给'], ['有效期', '多久', '失效', '过期', '保留'],
    ['删除', '删掉', '删了', '清除', '清理'], ['恢复', '找回', '还原', '回来'], ['回收站', '垃圾桶'], ['错误', '报错', '故障', '不可用', '繁忙', '失败'],
    ['文件', '文件夹', '资料'], ['成员', '邀请', '协作', '同事'], ['下载'],
  ];
  const FORMS = new Map();
  CONCEPTS.forEach((fs, ci) => fs.forEach((f) => { if (!FORMS.has(f)) FORMS.set(f, []); FORMS.get(f).push(ci); }));
  const FORM_LIST = [...FORMS.keys()].sort((a, b) => b.length - a.length);
  const HB = 64, isCJK = (ch) => /[一-鿿]/.test(ch);
  const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % HB; };
  function semVec(text) {
    const v = new Float64Array(CONCEPTS.length + HB);
    for (let i = 0; i < text.length;) {
      const f = FORM_LIST.find((x) => text.startsWith(x, i));
      if (f) { FORMS.get(f).forEach((ci) => v[ci] += 1); i += f.length; } else i++;
    }
    for (let i = 0; i + 1 < text.length; i++) if (isCJK(text[i]) && isCJK(text[i + 1])) v[CONCEPTS.length + hash(text.slice(i, i + 2))] += 1;
    for (let i = 0; i < v.length; i++) v[i] = Math.sqrt(v[i]) * (i < CONCEPTS.length ? 1 : 0.25);
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  }
  function lexTerms(text) {
    const out = [];
    (text.match(/[A-Za-z0-9][A-Za-z0-9\-]*/g) || []).forEach((t) => out.push(t.toLowerCase()));
    for (let i = 0; i + 1 < text.length; i++) if (isCJK(text[i]) && isCJK(text[i + 1])) out.push(text.slice(i, i + 2));
    return out;
  }
  const SENTS = (() => { const out = []; let cur = ''; for (const ch of DOC) { cur += ch; if ('。！？\n'.includes(ch)) { out.push(cur); cur = ''; } } if (cur) out.push(cur); return out; })();
  function chunkify(mode, size, overlap) {
    const out = [];
    if (mode === 'fixed') {
      const step = Math.max(1, Math.round(size * (1 - overlap)));
      for (let s = 0; s < DOC.length; s += step) { out.push(DOC.slice(s, s + size)); if (s + size >= DOC.length) break; }
    } else {
      let cur = '';
      SENTS.forEach((s) => { if (cur && (cur + s).trim().length > size) { out.push(cur); cur = ''; } cur += s; });
      if (cur.trim()) out.push(cur);
    }
    return out.filter((c) => c.trim().length);
  }
  function index(chunks) {
    const docs = chunks.map((c) => { const terms = lexTerms(c), tf = new Map(); terms.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1)); return { text: c, tf, dl: terms.length, sv: semVec(c) }; });
    const df = new Map(); docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
    return { docs, df, avgdl: A.mean(docs.map((d) => d.dl)) || 1 };
  }
  function search(ix, q, mode) {
    const N = ix.docs.length, qt = [...new Set(lexTerms(q))], qv = semVec(q);
    const bm = ix.docs.map((d) => A.sum(qt.map((t) => { const tf = d.tf.get(t) || 0; if (!tf) return 0; const n = ix.df.get(t); const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5)); return idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * d.dl / ix.avgdl)); })));
    const sem = ix.docs.map((d) => A.dot(d.sv, qv));
    const rank = (sc) => { const o = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]); const r = new Array(sc.length); o.forEach(([, i], k) => (r[i] = k + 1)); return r; };
    let sc;
    if (mode === 'bm25') sc = bm; else if (mode === 'dense') sc = sem;
    else { const r1 = rank(bm), r2 = rank(sem); sc = r1.map((r, i) => 1 / (60 + r) + 1 / (60 + r2[i])); }
    return sc.map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);
  }
  const has = (chunk, ans) => chunk.includes(ans);

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const qSel = A.select(ctl, '问题', [...QS.map((q, i) => ({ v: String(i), t: q[0] })), { v: 'c', t: '（自己输入）' }], '1', () => { custom.classList.toggle('hidden', qSel.value !== 'c'); update(); });
  qSel.style.minWidth = '260px';
  const custom = A.el('input', { type: 'text', value: '回收站里的东西能放多久', class: 'hidden', style: { minWidth: '240px', alignSelf: 'flex-end' } });
  custom.addEventListener('input', A.debounce(update, 120)); ctl.append(custom);
  const mode = A.seg(ctl, [{ v: 'bm25', t: '关键词 BM25' }, { v: 'dense', t: '向量（玩具嵌入）' }, { v: 'hybrid', t: '混合 RRF' }], 'dense', update, '检索方式');
  const ctl2 = A.el('div', { class: 'controls' }); bd.append(ctl2);
  const cm = A.seg(ctl2, [{ v: 'fixed', t: '按固定字数' }, { v: 'sent', t: '按句子打包' }], 'fixed', () => { ovS.input.disabled = cm.value !== 'fixed'; update(); }, '切块方式');
  const sizeS = A.slider(ctl2, { label: '块大小（字）', min: 20, max: 400, step: 10, value: 60, fmt: (v) => v, on: update });
  const ovS = A.slider(ctl2, { label: '相邻块重叠', min: 0, max: 0.5, step: 0.05, value: 0, fmt: (v) => Math.round(v * 100) + '%', on: update });
  const kS = A.slider(ctl2, { label: 'top-k', min: 1, max: 6, step: 1, value: 2, fmt: (v) => v, on: update });
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const list = A.el('div', { class: 'chunks' }); bd.append(list);
  const cv = A.el('canvas', { class: 'cv', style: { marginTop: '14px' } }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  legend.innerHTML = '<span><i class="line" style="background:var(--s2)"></i>关键词 BM25</span><span><i class="line" style="background:var(--s1)"></i>向量（玩具嵌入）</span><span><i class="line" style="background:var(--s3)"></i>混合 RRF</span><span>竖线：当前块大小</span>';
  bd.append(A.el('p', { class: 'hint' }, '“命中”指 top-k 里至少有一块包含完整的答案句（绿色高亮）。下图统计 7 个问题的命中率，横轴是块大小，粗线是当前的检索方式。默认问题“退钱”：BM25 找不到，因为文档里写的是“退款”。换到 E-4012 那题，把块大小设为 100、top-k 设为 1：玩具嵌入不认识编号，排错了；关键词检索精确命中；混合检索两头都能照顾到。固定字数切分的结果很看运气，比如“分享链接”那题的答案恰好跨过第 600 个字，块大小是 40、60、100、200 时都被切断；加一点重叠，或者改成按句子打包，就稳定多了。块很大时命中率看起来很高，那是因为 top-k 几乎把整份文档都放进了上下文（看“送进上下文”）；真实资料库有成千上万份文档，大块的相似度被稀释，排序会明显变差。'));

  const SIZES = []; for (let s = 20; s <= 400; s += 10) SIZES.push(s);
  let curve = null, curveKey = '';
  function calcCurve() {
    const key = [cm.value, ovS.value, kS.value].join();
    if (key === curveKey) return;
    curveKey = key;
    curve = { bm25: [], dense: [], hybrid: [] };
    SIZES.forEach((sz) => {
      const ix = index(chunkify(cm.value, sz, ovS.value));
      ['bm25', 'dense', 'hybrid'].forEach((m) => {
        const hit = QS.filter(([q, a]) => search(ix, q, m).slice(0, kS.value).some((r) => has(ix.docs[r.i].text, a))).length;
        curve[m].push(hit / QS.length);
      });
    });
  }
  const view = A.canvas(cv, { aspect: 0.32 }, (ctx, W, H) => {
    const box = { x: 46, y: 22, w: W - 64, h: H - 56 };
    const ax = A.axes(ctx, box, { xmin: 20, xmax: 400, ymin: 0, ymax: 1, yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: (v) => Math.round(v * 100) + '%', xfmt: (v) => v, xlabel: '块大小（字）', xgrid: false });
    A.text(ctx, `7 个问题的命中率（top-${kS.value}）`, box.x, 8, { size: 11.5, color: A.css('--muted') });
    const cols = A.series();
    [['bm25', cols[1]], ['dense', cols[0]], ['hybrid', cols[2]]].forEach(([m, c], j) => {
      ctx.strokeStyle = c; ctx.lineWidth = m === mode.value ? 2.6 : 1.6; ctx.beginPath();
      curve[m].forEach((y, i) => { const x = ax.X(SIZES[i]), yy = ax.Y(y) + (j - 1) * 1.5; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      ctx.stroke();
    });
    const x = ax.X(sizeS.value);
    ctx.strokeStyle = A.css('--ink-2'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
  });
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function update() {
    calcCurve();
    const chunks = chunkify(cm.value, sizeS.value, ovS.value), ix = index(chunks);
    const isC = qSel.value === 'c';
    const q = isC ? custom.value.trim() || '回收站' : QS[+qSel.value][0], ans = isC ? null : QS[+qSel.value][1];
    const res = search(ix, q, mode.value), k = kS.value, top = res.slice(0, k);
    const hit = ans ? top.some((r) => has(ix.docs[r.i].text, ans)) : null;
    const best = ans ? res.findIndex((r) => has(ix.docs[r.i].text, ans)) : -1;
    const ctxChars = A.sum(top.map((r) => ix.docs[r.i].text.length));
    const mi = ['bm25', 'dense', 'hybrid'].indexOf(mode.value), szi = SIZES.indexOf(sizeS.value);
    stats.innerHTML = '';
    [['切出的块数', chunks.length + ` <small>平均 ${Math.round(A.mean(chunks.map((c) => c.length)))} 字</small>`],
      ['送进上下文', `${ctxChars} 字 <small>≈ ${Math.round(ctxChars / 1.5)} token</small>`],
      ['本题', ans ? (hit ? '<span style="color:var(--good-ink)">命中</span>' : '<span style="color:var(--bad)">未命中</span>') + (best >= 0 ? ` <small>含答案的块排第 ${best + 1}</small>` : ' <small>答案被切断</small>') : '<small>自定义问题无标准答案</small>'],
      ['7 题命中率', szi >= 0 ? A.pct(curve[mode.value][szi], 0) : '—'],
    ].forEach(([kk, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, kk), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    const smax = Math.max(1e-9, top[0] ? top[0].s : 1);
    list.innerHTML = '';
    top.forEach((r, j) => {
      const t = ix.docs[r.i].text, ok = ans && has(t, ans);
      let html = esc(t.trim());
      if (ok) html = html.replace(esc(ans), '<mark>' + esc(ans) + '</mark>');
      const sc = mode.value === 'hybrid' ? r.s.toFixed(4) : mode.value === 'dense' ? '余弦 ' + r.s.toFixed(3) : 'BM25 ' + r.s.toFixed(2);
      list.append(A.el('div', { class: 'chunk' },
        A.el('div', { class: 'meta' }, A.el('b', null, '#' + (j + 1)), A.el('span', null, '块 ' + (r.i + 1)), A.el('span', { class: 'sb' }, A.el('i', { style: { width: Math.max(0, (r.s / smax) * 100) + '%' } })), A.el('span', null, sc),
          ans ? A.el('span', { class: ok ? 'ok' : 'no' }, ok ? '✓ 含完整答案' : '✗ 不含答案') : null),
        A.el('div', { class: 'txt', html })));
    });
    view.redraw();
  }
  update();
});
