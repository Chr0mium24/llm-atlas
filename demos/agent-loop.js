/* agent-loop — interactive demo (moved from ch15-agents.html) */
A.defineDemo('agent-loop', function (mount) {
  const { bd } = A.demo(mount, '智能体循环模拟器：修一个 bug，看上下文怎么增长', '单步执行 · 四种上下文策略 · 前缀缓存');
  const CAT = { sys: ['系统提示', 0], tools: ['工具定义', 6], user: ['用户任务', 3], asst: ['模型输出（思考 + 调用）', 1], result: ['工具结果', 2], sum: ['摘要 / 子智能体报告', 4], stub: ['已清理的结果', -1] };
  const T = [
    { th: '先跑这个测试文件，看具体报错。', call: 'bash("pytest tests/test_dates.py -x -q")', res: '1 failed：test_parse_iso_utc，ValueError: Invalid isoformat string: \'2026-10-19T08:00:00Z\'（后附 60 行 traceback）', rt: 2400, fact: '失败用例 test_parse_iso_utc，结尾带 Z 的时间串解析报错' },
    { th: '报错来自 parse_date，先找到它的定义。', call: 'grep("def parse_date", "src/")', res: 'src/utils/dates.py:42: def parse_date(s: str) -> datetime:', rt: 90, ex: 1, fact: 'parse_date 定义在 src/utils/dates.py:42' },
    { th: '读这个文件。', call: 'read_file("src/utils/dates.py")', res: '（312 行源码）……第 42–58 行：return datetime.fromisoformat(s) ……', rt: 4800, ex: 1, fact: 'parse_date 直接调用 datetime.fromisoformat' },
    { th: '再看测试期望什么。', call: 'read_file("tests/test_dates.py")', res: '（180 行测试）……assert parse_date("2026-10-19T08:00:00Z").tzinfo == timezone.utc ……', rt: 2600, ex: 1, fact: '测试要求结尾的 Z 解析为 UTC' },
    { th: '查一下还有哪些地方调用 parse_date，免得改坏别处。', call: 'grep("parse_date\\(", "--type py")', res: '23 处调用，分布在 9 个文件：src/report.py、src/api/serializers.py ……', rt: 1900, ex: 1, fact: '共 23 处调用、9 个文件，report.py 依赖输出格式' },
    { th: 'Python 3.11 之前 fromisoformat 不认结尾的 Z。看看项目要求的 Python 版本。', call: 'read_file("pyproject.toml")', res: 'requires-python = ">=3.10" ……（依赖列表）', rt: 900, ex: 1, fact: '项目要支持 Python 3.10' },
    { th: '最稳妥的改法：解析前把结尾的 Z 换成 +00:00。', call: 'edit_file("src/utils/dates.py", 第 57 行, +3 行)', res: '已修改 1 处', rt: 80, fact: '已改 dates.py：Z 换成 +00:00 再解析' },
    { th: '重跑这个测试文件。', call: 'bash("pytest tests/test_dates.py -q")', res: '6 passed in 0.4s', rt: 300 },
    { th: '再跑全量测试，确认没有改坏别处。', call: 'bash("pytest -q")', res: '1 failed, 446 passed：test_report_header，期望 "08:00:00Z"，实际得到 "08:00:00+00:00"', rt: 3200, fact: '全量测试中 report 的时间格式从 Z 变成了 +00:00' },
    { th: 'report 会把解析后的时间再格式化，时区写法变了。看它的格式化函数。', call: 'read_file("src/report.py")', res: '（405 行源码）……def format_ts(dt): return dt.isoformat() ……', rt: 5600, fact: 'report.format_ts 直接用 isoformat()' },
    { th: '在 format_ts 里把 UTC 时间写成 Z，保持原来的输出。', call: 'edit_file("src/report.py", 第 88 行, +2 行)', res: '已修改 1 处', rt: 80, fact: '已改 report.py：UTC 输出为 Z' },
    { th: '再跑一次全量测试。', call: 'bash("pytest -q")', res: '447 passed in 38.2s', rt: 250 },
    { th: '全部通过，向用户汇报。', final: '修好了。原因是项目要支持 Python 3.10，而 3.11 之前的 datetime.fromisoformat 不接受结尾的 “Z”。改了两处：dates.py 解析前把 Z 换成 +00:00；report.py 输出 UTC 时间时仍写成 Z。447 个测试全部通过。', at: 220 },
  ];
  const SUB = { th: '定位原因要读不少文件，交给子智能体，只要结论。', call: 'task("找出 parse_date 的定义和所有调用方，读相关源码和 pyproject，解释为什么结尾是 Z 的字符串会报错，300 字以内汇报")', res: '子智能体报告：parse_date 在 src/utils/dates.py:42，直接调用 datetime.fromisoformat；项目要支持 Python 3.10，而 3.11 之前 fromisoformat 不接受结尾的 Z；测试要求 Z 解析为 UTC；共 23 处调用、9 个文件，其中 report.py 会把结果再格式化输出，改的时候要注意。', rt: 480, at: 220, sub: true };

  const ctl = A.el('div', { class: 'controls' }); bd.append(ctl);
  const strat = A.seg(ctl, [{ v: 'none', t: '不管理' }, { v: 'clear', t: '清理旧结果' }, { v: 'compact', t: '摘要压缩' }, { v: 'sub', t: '子智能体' }], 'none', () => rerun(), '上下文策略');
  const win = A.slider(ctl, { label: '上下文窗口', min: 8000, max: 256000, log: true, value: 24000, fmt: (v) => Math.round(v / 1000) + 'K', on: () => rerun(), width: 170 });
  const mcp = A.slider(ctl, { label: '额外接入的 MCP 工具', min: 0, max: 80, step: 1, value: 0, fmt: (v) => v + ' 个', on: () => rerun(), width: 170 });
  const lazyBox = A.el('div', { class: 'ctl', style: { minWidth: 'auto' } }); ctl.append(lazyBox);
  const lazy = A.check(lazyBox, '按需加载工具定义', false, () => rerun());
  const btns = A.el('div', { class: 'flex', style: { marginBottom: '10px' } }); bd.append(btns);
  const bNext = A.el('button', { class: 'primary', onclick: () => { if (pos < sim.ev.length) { pos++; render(); } } }, '下一步');
  const bAuto = A.el('button', { onclick: toggleAuto }, '自动运行');
  btns.append(bNext, bAuto, A.el('button', { onclick: () => { stopAuto(); pos = 1; render(); } }, '重置'), A.el('button', { onclick: () => { stopAuto(); pos = sim.ev.length; render(); } }, '跑到底'));
  const status = A.el('span', { class: 'small muted' }); btns.append(status);
  const cv = A.el('canvas', { class: 'cv' }); bd.append(cv);
  const legend = A.el('div', { class: 'legend' }); bd.append(legend);
  const stats = A.el('div', { class: 'stats' }); bd.append(stats);
  const tr = A.el('div', { class: 'tr' }); bd.append(tr);
  bd.append(A.el('p', { class: 'hint' }, '每次“下一步”展示一个事件：模型输出、工具结果，或 harness 的上下文管理。柱状图的每一根是一次模型调用时送进去的完整上下文；柱子左边的竖线标出命中前缀缓存的部分。建议依次试四种策略，每种都跑到底；再把 MCP 工具加到 40 个，看工具定义本身占掉多少窗口，然后勾选“按需加载”。'));

  function simulate(cfg) {
    const toolTok = 2100 + (cfg.lazy ? (cfg.mcp ? 400 + cfg.mcp * 30 : 0) : cfg.mcp * 450);
    let ctx = [{ id: 'sys', c: 'sys', tok: 1800 }, { id: 'tools', c: 'tools', tok: toolTok }, { id: 'user', c: 'user', tok: 60 }];
    const turns = cfg.strat === 'sub' ? [T[0], SUB, ...T.slice(6)] : T;
    const W = cfg.win, thr = 0.75 * W;
    const calls = [], ev = [];
    let prev = [], sub = null;
    const total = (c) => A.sum(c.map((s) => s.tok));
    const call = (kind, c = ctx, pv = prev) => {
      const tot = total(c);
      let lcp = 0;
      for (let i = 0; i < Math.min(pv.length, c.length) && pv[i] === c[i].id; i++) lcp += c[i].tok;
      return { ctx: c.map((s) => ({ ...s })), tot, cached: lcp, kind, over: tot > W };
    };
    const push = (e) => { e.ctxTok = total(ctx); e.ci = calls.length - 1; ev.push(e); };
    push({ who: 'user', txt: 'tests/test_dates.py 里有测试挂了，帮我修好，并确保整个测试套件通过。', tok: 60 });
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      if (cfg.strat === 'clear' && total(ctx) > thr) {
        const res = ctx.filter((s) => s.c === 'result');
        const old = res.slice(0, Math.max(0, res.length - 2));
        let freed = 0;
        old.forEach((s) => { const j = ctx.indexOf(s); freed += s.tok - 30; ctx[j] = { id: s.id + 'x', c: 'stub', tok: 30 }; });
        if (old.length) push({ who: 'sys', txt: `上下文超过窗口的 75%，把 ${old.length} 条旧工具结果换成占位符，释放 ${A.human(freed)} token。前缀变了，下一次调用的缓存会失效。` });
      }
      if (cfg.strat === 'compact' && total(ctx) > thr && ctx.length > 5) {
        const r = call('compact'); calls.push(r); prev = r.ctx.map((s) => s.id);
        push({ who: 'sys', txt: `上下文超过窗口的 75%（${A.human(r.tot)} token）。先额外调用一次模型，把历史压缩成摘要。`, tok: 0 });
        if (r.over) { push({ who: 'err', txt: `压缩请求本身就超出窗口（${A.human(r.tot)} > ${A.human(W)}），任务中断。` }); break; }
        const keep = ctx.slice(-2), mid = ctx.slice(3, -2);
        const facts = mid.filter((s) => s.fact).map((s) => s.fact);
        const st = A.clamp(Math.round(total(mid) * 0.08), 300, 1500);
        ctx = [...ctx.slice(0, 3), { id: 'sum' + i, c: 'sum', tok: st }, ...keep];
        push({ who: 'sum', txt: '摘要：' + (facts.length ? facts.join('；') : '（无关键事实）') + '。', tok: st });
      }
      const r = call('main'); calls.push(r); prev = r.ctx.map((s) => s.id);
      if (r.over) { push({ who: 'err', txt: `请求被拒绝：上下文 ${A.human(r.tot)} token，超过窗口 ${A.human(W)}。任务在第 ${calls.length} 次调用时中断。` }); break; }
      ctx.push({ id: 'a' + i, c: 'asst', tok: t.at || 160 });
      if (t.final) { push({ who: 'final', txt: t.final, tok: t.at }); break; }
      push({ who: 'asst', txt: t.th, call: t.call, tok: t.at || 160 });
      if (t.sub) {
        let sctx = [{ id: 'ssys', c: 'sys', tok: 1200 }, { id: 'stools', c: 'tools', tok: 2100 }, { id: 'stask', c: 'user', tok: 220 }];
        let sprev = [], peak = 0, sin = 0, scache = 0, n = 0;
        T.filter((x) => x.ex).forEach((x, j) => {
          const sr = call('sub', sctx, sprev); sprev = sr.ctx.map((s) => s.id); n++; sin += sr.tot; scache += sr.cached; peak = Math.max(peak, sr.tot);
          sctx.push({ id: 'sa' + j, c: 'asst', tok: 160 }, { id: 'sr' + j, c: 'result', tok: x.rt });
          push({ who: 'sub', txt: x.th, call: x.call, tok: 160 + x.rt });
        });
        const fin = call('sub', sctx, sprev); n++; sin += fin.tot; scache += fin.cached; peak = Math.max(peak, fin.tot);
        sub = { n, peak, sin, scache };
        ctx.push({ id: 'r' + i, c: 'sum', tok: t.rt });
        push({ who: 'subr', txt: t.res, tok: t.rt, subDone: true });
      } else {
        ctx.push({ id: 'r' + i, c: 'result', tok: t.rt, fact: t.fact });
        push({ who: 'tool', txt: t.res, tok: t.rt });
      }
    }
    return { calls, ev, sub, W, thr };
  }

  let sim, pos = 1, timer = null;
  function cfg() { return { strat: strat.value, win: Math.round(win.value / 1000) * 1000, mcp: mcp.value, lazy: lazy.checked }; }
  function rerun() { sim = simulate(cfg()); pos = Math.min(Math.max(pos, 1), sim.ev.length); render(); }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } bAuto.textContent = '自动运行'; }
  function toggleAuto() {
    if (timer) { stopAuto(); return; }
    if (pos >= sim.ev.length) pos = 1;
    bAuto.textContent = '暂停';
    timer = setInterval(() => { if (pos < sim.ev.length) { pos++; render(); } else stopAuto(); }, 650);
  }
  const WHO = { user: ['用户', 3], asst: ['模型', 1], tool: ['工具结果', 2], sys: ['harness', -1], sum: ['摘要', 4], sub: ['子智能体', 6], subr: ['子智能体报告', 4], err: ['错误', 7], final: ['最终回答', 5] };
  let hover = null;
  const view = A.canvas(cv, { aspect: 0.38 }, (ctx, W, H) => {
    const cols = A.series(), col = (k) => (k < 0 ? A.css('--axis') : cols[k]);
    const box = { x: 54, y: 28, w: W - 70, h: H - 66 };
    const nVis = pos ? sim.ev[pos - 1].ci + 1 : 0;
    const slots = Math.max(14, sim.calls.length);
    const ymax = Math.max(sim.W * 1.12, ...sim.calls.map((c) => c.tot * 1.05));
    const ax = A.axes(ctx, box, { xmin: 0, xmax: slots, ymin: 0, ymax, xticks: [], yfmt: (v) => A.human(v, 0), ylabel: '上下文 token', ylabelOffset: 46 });
    const sw = box.w / slots, bw = Math.min(42, sw * 0.68);
    for (let k = 0; k < slots; k++) A.text(ctx, k + 1, box.x + (k + 0.5) * sw, box.y + box.h + 12, { size: 11, align: 'center', color: A.css('--muted') });
    A.text(ctx, '第几次模型调用', box.x + box.w, box.y + box.h + 28, { size: 11.5, align: 'right', color: A.css('--muted') });
    const line = (v, color, dash, label) => {
      const y = Math.round(ax.Y(v)) + 0.5;
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); ctx.restore();
      A.text(ctx, label, box.x + box.w - 4, y - 8, { size: 11.5, align: 'right', color });
    };
    line(sim.W, A.css('--bad'), [], '窗口 ' + A.human(sim.W, 0));
    if (strat.value === 'clear' || strat.value === 'compact') line(sim.thr, A.css('--muted'), [4, 4], '75%：触发上下文管理');
    for (let k = 0; k < nVis; k++) {
      const c = sim.calls[k], x = box.x + (k + 0.5) * sw - bw / 2;
      let acc = 0;
      ctx.globalAlpha = c.kind === 'compact' ? 0.45 : 1;
      c.ctx.forEach((s) => {
        const y0 = ax.Y(acc), y1 = ax.Y(acc + s.tok);
        ctx.fillStyle = col(CAT[s.c][1]); ctx.fillRect(x, y1, bw, y0 - y1);
        ctx.strokeStyle = A.css('--surface'); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y1 + 0.5); ctx.lineTo(x + bw, y1 + 0.5); ctx.stroke();
        acc += s.tok;
      });
      ctx.globalAlpha = 1;
      if (c.cached > 0) { ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 3, ax.Y(0)); ctx.lineTo(x - 3, ax.Y(c.cached)); ctx.stroke(); }
      if (c.kind === 'compact') A.text(ctx, '压缩', x + bw / 2, ax.Y(c.tot) - 9, { size: 11, align: 'center', color: A.css('--ink-2') });
      if (c.over) { ctx.strokeStyle = A.css('--bad'); ctx.lineWidth = 2; ctx.strokeRect(x - 1, ax.Y(c.tot), bw + 2, ax.Y(0) - ax.Y(c.tot)); A.text(ctx, '溢出', x + bw / 2, ax.Y(c.tot) - 9, { size: 11.5, align: 'center', weight: 650, color: A.css('--bad') }); }
      if (hover === k) { ctx.strokeStyle = A.css('--ink'); ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, ax.Y(c.tot) - 0.5, bw + 1, ax.Y(0) - ax.Y(c.tot) + 1); }
    }
    view._geom = { box, sw, nVis };
  });
  cv.addEventListener('mousemove', (e) => {
    const p = A.pos(cv, e), g = view._geom; if (!g) return;
    const k = Math.floor((p.x - g.box.x) / g.sw);
    if (k >= 0 && k < g.nVis) {
      if (hover !== k) { hover = k; view.redraw(); }
      const c = sim.calls[k], cols = A.series(), by = {};
      c.ctx.forEach((s) => { by[s.c] = (by[s.c] || 0) + s.tok; });
      A.tip.show(`<b>第 ${k + 1} 次调用${c.kind === 'compact' ? '（压缩）' : ''}：${A.human(c.tot)} token</b><br>` + Object.entries(by).map(([kk, v]) => `<span style="color:${CAT[kk][1] < 0 ? A.css('--axis') : cols[CAT[kk][1]]}">●</span> ${CAT[kk][0]}：${A.human(v)}`).join('<br>') + `<br>命中前缀缓存：${A.human(c.cached)}（${A.pct(c.cached / c.tot, 0)}）`, e.clientX, e.clientY);
    } else { if (hover !== null) { hover = null; view.redraw(); } A.tip.hide(); }
  });
  cv.addEventListener('mouseleave', () => { hover = null; view.redraw(); A.tip.hide(); });
  legend.innerHTML = Object.values(CAT).map(([n, c]) => `<span><i style="background:${c < 0 ? 'var(--axis)' : 'var(--s' + (c + 1) + ')'}"></i>${n}</span>`).join('') + '<span><i class="line" style="background:var(--ink);width:3px;height:12px;vertical-align:-1px"></i>命中前缀缓存的部分</span>';

  function render() {
    view.redraw();
    const nVis = sim.ev[pos - 1].ci + 1;
    const vis = sim.calls.slice(0, nVis);
    let inp = A.sum(vis.map((c) => c.tot)), cached = A.sum(vis.map((c) => c.cached)), n = vis.length;
    const subShown = sim.sub && sim.ev.slice(0, pos).some((e) => e.subDone);
    if (subShown) { inp += sim.sub.sin; cached += sim.sub.scache; n += sim.sub.n; }
    const cur = sim.ev[pos - 1].ctxTok;
    const last = sim.ev[sim.ev.length - 1];
    const end = pos >= sim.ev.length;
    status.textContent = end ? (last.who === 'final' ? '任务完成' : '任务失败') : `第 ${pos} / ${sim.ev.length} 个事件`;
    status.style.color = end ? (last.who === 'final' ? 'var(--good-ink)' : 'var(--bad)') : '';
    bNext.disabled = end;
    stats.innerHTML = '';
    const items = [
      ['当前上下文', `${A.human(cur)} <small>/ ${A.human(sim.W, 0)}（${A.pct(cur / sim.W, 0)}）</small>`],
      ['模型调用次数', n + (subShown ? ` <small>（含子智能体 ${sim.sub.n} 次）</small>` : '')],
      ['累计输入 token', A.human(inp)],
      ['前缀缓存命中', inp ? A.pct(cached / inp, 0) : '—'],
      ['折算成本（命中按 1/10 计）', A.human(inp - cached + 0.1 * cached) + ' <small>token</small>'],
    ];
    if (sim.sub) items.push(['子智能体上下文峰值', subShown ? `${A.human(sim.sub.peak)} <small>用完即弃</small>` : '—']);
    items.forEach(([k, v]) => stats.append(A.el('div', { class: 'stat' }, A.el('div', { class: 'k' }, k), A.el('div', { class: 'v', style: { fontSize: '17px' }, html: v }))));
    tr.innerHTML = '';
    const cols = A.series();
    sim.ev.slice(0, pos).forEach((e, i) => {
      const [name, c] = WHO[e.who];
      const dot = A.el('i', { style: { background: c < 0 ? A.css('--axis') : c === 7 ? A.css('--bad') : cols[c] } });
      const body = A.el('span', null, e.txt, e.call ? ' ' : null, e.call ? A.el('code', null, e.call) : null);
      const row = A.el('div', { class: 'row' + (i === pos - 1 ? ' cur' : '') + (e.who === 'sub' ? ' sub' : '') + (e.who === 'err' ? ' err' : '') },
        A.el('span', { class: 'who' }, dot, name), body, A.el('span', { class: 'tk' }, e.tok ? '+' + A.human(e.tok) : ''));
      tr.append(row);
    });
    tr.scrollTop = tr.scrollHeight;
  }
  rerun();
});
