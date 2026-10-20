/* LLM Atlas — shared helpers: chapter registry, nav, page components, demo loader, theme, canvas, controls, math, plotting. */
(function () {
  /* ---------- chapter registry ----------
     s: file slug (s + '.html'); t: title; st: 'new' (rewritten) | 'old' (pre-restructure text) | 'todo' (placeholder)
     n: fixed label (序 / 附); otherwise chapters are numbered 1..N in order. */
  const CHAPTERS = [
    { s: 'index', t: '总览', home: true },
    { s: 'prologue', t: '九年简史', n: '序', st: 'todo' },
    { part: '一 · Transformer 怎么工作' },
    { s: 'tokens', t: '分词与嵌入', st: 'new' },
    { s: 'attention', t: '注意力机制', st: 'new' },
    { s: 'transformer', t: 'Transformer 结构与位置编码', st: 'new' },
    { s: 'generation', t: '自回归生成与采样', st: 'new' },
    { part: '二 · 预训练' },
    { s: 'data', t: '预训练数据', st: 'new' },
    { s: 'scaling', t: '规模定律与优化器', st: 'new' },
    { part: '三 · 后训练' },
    { s: 'sft', t: 'SFT 与偏好优化', st: 'new' },
    { s: 'rl', t: '强化学习', st: 'new' },
    { s: 'distillation', t: '蒸馏与能力整合', st: 'new' },
    { s: 'reasoning', t: '推理模型与推理时算力', st: 'new' },
    { s: 'agents', t: '智能体', st: 'new' },
    { s: 'coding', t: 'AI 编程', st: 'new' },
    { part: '四 · 架构演进' },
    { s: 'moe', t: '混合专家 MoE', st: 'new' },
    { s: 'long-context', t: '长上下文与注意力变体', st: 'new' },
    { part: '五 · 硬件与部署' },
    { s: 'hardware', t: '芯片、内核与编译器', st: 'new' },
    { s: 'quantization', t: '量化', st: 'new' },
    { s: 'serving', t: '推理系统', st: 'new' },
    { s: 'training-systems', t: '训练系统', st: 'new' },
    { s: 'on-device', t: '本地与端侧部署', st: 'new' },
    { part: '六 · 多模态' },
    { s: 'vlm', t: '多模态理解', st: 'new' },
    { s: 'diffusion', t: '扩散与流匹配', st: 'new' },
    { s: 'image', t: '文生图与图生图', st: 'new' },
    { s: 'video', t: '视频生成', st: 'new' },
    { s: 'audio', t: '语音、音频与音乐', st: 'new' },
    { s: 'spatial', t: '3D 与空间智能', st: 'new' },
    { s: 'world-models', t: '世界模型', st: 'todo' },
    { s: 'embodied', t: '具身智能与 VLA', st: 'todo' },
    { part: '七 · 理解与评判' },
    { s: 'interpretability', t: '可解释性', st: 'todo' },
    { s: 'evaluation', t: '评测', st: 'todo' },
    { s: 'alignment', t: '对齐', st: 'todo' },
    { s: 'jailbreak', t: '越狱与防御', st: 'todo' },
    { part: '八 · 应用与社会' },
    { s: 'science', t: 'AI for Science 与数学', st: 'todo' },
    { s: 'industry', t: '产业、算力经济与治理', st: 'todo' },
    { part: '收尾' },
    { s: 'frontier', t: '前沿地图与开放问题', st: 'old' },
    { part: '附录' },
    { s: 'nn-basics', t: '神经网络速成', n: '附', st: 'todo' },
  ];
  // assign numbers, part names, file names
  {
    let k = 0, part = null;
    CHAPTERS.forEach((c) => {
      if (c.part) { part = c.part; return; }
      c.f = c.s + '.html';
      c.partName = part;
      if (!c.home && !c.n) c.n = String(++k);
    });
  }

  const A = {};
  window.A = A;
  A.CHAPTERS = CHAPTERS;
  A.chapters = CHAPTERS.filter((c) => c.s);
  A.ch = (slug) => CHAPTERS.find((c) => c.s === slug);
  A.chLabel = (c) => (c.n === '序' ? '序章' : c.n === '附' ? '附录' : c.home ? '' : '第 ' + c.n + ' 章');
  A.cref = (slug) => { const c = A.ch(slug); return c ? A.chLabel(c) : ''; };
  A.STATUS = { new: '新版', old: '旧版', todo: '待写' };

  /* ---------- DOM ---------- */
  A.$ = (s, r = document) => r.querySelector(s);
  A.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  A.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  A.css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  A.series = () => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => A.css('--s' + i));

  /* ---------- theme ---------- */
  const THEME_KEY = 'llm-atlas-theme';
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  A.isDark = () => {
    const t = document.documentElement.dataset.theme;
    if (t) return t === 'dark';
    return matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const themeCbs = [];
  A.onTheme = (cb) => themeCbs.push(cb);
  const fireTheme = () => themeCbs.forEach((cb) => cb());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);
  function cycleTheme() {
    const cur = document.documentElement.dataset.theme || 'auto';
    const next = cur === 'auto' ? (A.isDark() ? 'light' : 'dark') : cur === 'light' ? 'dark' : 'auto';
    if (next === 'auto') { delete document.documentElement.dataset.theme; localStorage.removeItem(THEME_KEY); }
    else { document.documentElement.dataset.theme = next; localStorage.setItem(THEME_KEY, next); }
    updateThemeBtn(); fireTheme();
  }
  function updateThemeBtn() {
    const b = document.getElementById('theme-btn');
    if (!b) return;
    const t = document.documentElement.dataset.theme || 'auto';
    b.textContent = t === 'auto' ? '主题：跟随系统' : t === 'dark' ? '主题：深色' : '主题：浅色';
  }

  /* ---------- nav, kicker, pager ---------- */
  function currentSlug() {
    if (document.body.dataset.chapter) return document.body.dataset.chapter;
    const f = location.pathname.split('/').pop() || 'index.html';
    return f.replace(/\.html$/, '') || 'index';
  }
  function buildNav() {
    const here = currentSlug();
    const side = document.getElementById('side');
    if (!side) return;
    side.append(A.el('a', { class: 'brand', href: 'index.html' }, '大模型全景图谱', A.el('small', null, '从 Transformer 到 2026 前沿')));
    const flat = A.chapters;
    let idx = -1;
    CHAPTERS.forEach((c) => {
      if (c.part) { side.append(A.el('div', { class: 'part' }, c.part)); return; }
      const on = c.s === here;
      const badge = c.st && c.st !== 'new' ? A.el('span', { class: 'st st-' + c.st }, A.STATUS[c.st]) : null;
      side.append(A.el('a', { class: 'ch' + (on ? ' on' : '') + (c.st === 'todo' ? ' todo' : ''), href: c.f }, A.el('span', { class: 'n' }, c.home ? '' : c.n), A.el('span', { class: 'tt' }, c.t), badge));
      if (on) {
        idx = flat.indexOf(c);
        const hs = A.$$('main h2[id]');
        if (hs.length) {
          const toc = A.el('div', { class: 'toc' });
          hs.forEach((h) => toc.append(A.el('a', { href: '#' + h.id }, h.dataset.short || h.textContent)));
          side.append(toc);
        }
      }
    });
    const tools = A.el('div', { class: 'tools' }, A.el('a', { class: 'btn', href: 'glossary.html' }, '术语表'), A.el('button', { id: 'theme-btn', onclick: cycleTheme }, ''));
    side.append(tools);
    updateThemeBtn();
    const mb = A.el('button', { id: 'menu-btn', onclick: () => side.classList.toggle('open') }, '☰ 目录');
    document.body.append(mb);
    const cur = flat[idx];
    // kicker: chapter label + part
    const kick = A.$('main .kicker');
    if (kick && cur && !kick.textContent.trim()) kick.textContent = [A.chLabel(cur), cur.partName].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
    // status banner for old / placeholder chapters
    const hdr = A.$('main header');
    if (hdr && cur && cur.st === 'old') hdr.after(A.el('div', { class: 'callout warn status-note', html: '<b>旧版内容。</b>这一章还是改版前的文字：正文较简略，历史只有列表。它会按新模板重写（推导折叠块、“主干 + 支线”的历史、争议与反直觉框）。演示是可用的。' }));
    // pager
    const pager = document.getElementById('pager');
    if (pager && idx >= 0) {
      const prev = flat[idx - 1], next = flat[idx + 1];
      const lab = (c) => [A.chLabel(c), c.t].filter(Boolean).join(' · ');
      pager.append(prev ? A.el('a', { href: prev.f }, A.el('small', null, '← 上一章'), lab(prev)) : A.el('span'));
      pager.append(next ? A.el('a', { href: next.f, style: { textAlign: 'right' } }, A.el('small', null, '下一章 →'), lab(next)) : A.el('span'));
    }
  }

  /* ---------- cross references: <a class="xref" data-ref="slug"></a> → chapter number ---------- */
  function fillXrefs() {
    A.$$('a.xref[data-ref]').forEach((a) => {
      const c = A.ch(a.dataset.ref);
      if (!c) return;
      a.href = c.f + (a.dataset.hash ? '#' + a.dataset.hash : '');
      if (!a.dataset.keep) a.textContent = a.dataset.full ? [A.chLabel(c), c.t].join(' · ') : c.n;
      a.title = A.chLabel(c) + ' · ' + c.t;
    });
  }

  /* ---------- history timelines: toggle side branches ---------- */
  function initHistory() {
    A.$$('.hist').forEach((h) => {
      const br = A.$$('details.hist-branch', h);
      if (!br.length) return;
      const btn = A.el('button', { class: 'hist-toggle' }, '展开全部支线');
      let open = false;
      btn.onclick = () => { open = !open; br.forEach((d) => (d.open = open)); btn.textContent = open ? '只看主干' : '展开全部支线'; };
      h.before(A.el('div', { class: 'hist-bar' }, A.el('span', { class: 'small muted' }, '主干是一条因果链；支线是被淘汰的路线和争论，默认折叠。'), btn));
    });
  }

  /* ---------- concepts: <dfn data-t="id"> defines, <span class="term" data-t="id"> refers (registry: assets/terms.js) ---------- */
  function initTerms() {
    if (!A.$('[data-t], .prereq, #glossary')) return;
    const go = () => {
      const T = window.ATLAS_TERMS || {};
      A.terms = T;
      const here = currentSlug();
      // where a term is defined: rewritten chapters carry <dfn id="t-…">; older pages don't, so those fall back to the glossary
      const defHref = (id) => {
        const slug = ((T[id] && T[id].at) || '').split('#')[0], c = A.ch(slug);
        if (slug === here && document.getElementById('t-' + id)) return '#t-' + id;
        if (c && c.st === 'new' && slug !== here) return c.f + '#t-' + id;
        return null;
      };
      const glossHref = (id) => (here === 'glossary' ? '' : 'glossary.html') + '#t-' + id;
      A.termHref = (id) => defHref(id) || glossHref(id);
      A.$$('dfn[data-t]').forEach((d) => { if (!d.id) d.id = 't-' + d.dataset.t; d.classList.add('dfn'); });
      const head = (def) => `<div class="tp-h"><b>${def.t}</b> <span class="tp-en">${def.en}</span></div><div class="tp-d">${def.d}</div>`;
      const whereLabel = (def) => { const c = A.ch(def.at.split('#')[0]); return c ? [A.chLabel(c), c.t].filter(Boolean).join(' · ') : ''; };
      A.$$('.term[data-t]').forEach((el) => {
        const id = el.dataset.t, def = T[id];
        if (!def) { el.classList.add('term-missing'); return; }
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        const hover = head(def) + '<div class="tp-f">点击固定这张卡片</div>';
        const show = (e) => { if (pinnedFor === el) return; const r = el.getBoundingClientRect(); A.tip.show(hover, e && e.clientX ? e.clientX : r.left, e && e.clientY ? e.clientY : r.bottom); };
        el.addEventListener('mouseenter', show);
        el.addEventListener('mouseleave', () => A.tip.hide());
        const open = () => {
          A.tip.hide();
          const where = defHref(id), lab = whereLabel(def);
          const links = (where
            ? `<a href="${where}" data-jump="1">跳到定义处${lab && where[0] !== '#' ? '（' + lab + '）' : ''} →</a>`
            : `<span class="tp-note">它所在的「${lab}」还没按新格式重写，原文里没有正式定义。</span>`) +
            (here === 'glossary' ? '' : `<a href="${glossHref(id)}" data-jump="1">在术语表中查看</a>`);
          pin(el, head(def) + `<div class="tp-links">${links}</div>`);
        };
        el.addEventListener('click', (e) => { e.preventDefault(); pinnedFor === el ? unpin() : open(); });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      A.$$('.prereq').forEach((box) => {
        const ds = A.$$('dfn[data-t]');
        if (!ds.length) return;
        const seen = new Set();
        const list = A.el('div', { class: 'prereq-new' }, A.el('span', { class: 'lab' }, '本章会从零定义：'));
        ds.forEach((d) => { if (seen.has(d.dataset.t)) return; seen.add(d.dataset.t); list.append(A.el('a', { href: '#t-' + d.dataset.t, 'data-jump': '1' }, (T[d.dataset.t] || {}).t || d.textContent)); });
        box.append(list);
      });
      if (location.hash.startsWith('#t-')) { const tg = document.getElementById(location.hash.slice(1)); if (tg) setTimeout(() => tg.scrollIntoView({ block: 'center' }), 50); }
      document.dispatchEvent(new Event('atlas-terms'));
    };
    if (window.ATLAS_TERMS) { go(); return; }
    const s = document.createElement('script');
    s.src = 'assets/terms.js' + (document.body.dataset.v ? '?v=' + document.body.dataset.v : '');
    s.onload = go;
    document.head.append(s);
  }

  /* ---------- pinned term card ---------- */
  let popEl = null, pinnedFor = null;
  function pin(anchor, html) {
    if (!popEl) {
      popEl = A.el('div', { class: 'term-pop', role: 'dialog' });
      document.body.append(popEl);
      document.addEventListener('mousedown', (e) => { if (pinnedFor && !popEl.contains(e.target) && !pinnedFor.contains(e.target)) unpin(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') unpin(); });
      addEventListener('scroll', () => pinnedFor && place(), { passive: true });
      addEventListener('resize', () => pinnedFor && place());
    }
    pinnedFor = anchor;
    popEl.innerHTML = html;
    popEl.prepend(A.el('button', { class: 'tp-x', 'aria-label': '关闭', onclick: unpin }, '×'));
    A.renderMath(popEl);
    popEl.style.display = 'block';
    place();
  }
  function place() {
    const r = pinnedFor.getBoundingClientRect(), p = popEl.getBoundingClientRect();
    let left = Math.min(Math.max(8, r.left), innerWidth - p.width - 8);
    let top = r.bottom + 8;
    if (top + p.height > innerHeight - 8) top = Math.max(8, r.top - p.height - 8);
    popEl.style.left = left + 'px'; popEl.style.top = top + 'px';
  }
  function unpin() { if (popEl) popEl.style.display = 'none'; pinnedFor = null; }

  /* ---------- "back" button after in-site jumps (terms, cross-references, prerequisite links) ---------- */
  const BACK_KEY = 'atlas-back', RESTORE_KEY = 'atlas-restore';
  const pageFile = () => location.pathname.split('/').pop() || 'index.html';
  function initBack() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || !(a.matches('a.xref, a[data-jump]'))) return;
      const cur = A.ch(currentSlug());
      sessionStorage.setItem(BACK_KEY, JSON.stringify({ url: pageFile(), y: scrollY, title: cur ? [A.chLabel(cur), cur.t].filter(Boolean).join(' · ') : document.title, t: Date.now() }));
      unpin();
    }, true);
    addEventListener('hashchange', showBack);
    let r = null;
    try { r = JSON.parse(sessionStorage.getItem(RESTORE_KEY) || 'null'); } catch (e) {}
    if (r && r.url === pageFile()) { sessionStorage.removeItem(RESTORE_KEY); setTimeout(() => scrollTo(0, r.y), 400); }
    showBack();
  }
  function showBack() {
    let m = null;
    try { m = JSON.parse(sessionStorage.getItem(BACK_KEY) || 'null'); } catch (e) {}
    const old = document.getElementById('back-btn');
    if (!m || Date.now() - m.t > 30 * 60 * 1000) { if (old) old.remove(); return; }
    const same = m.url === pageFile();
    if (same && !location.hash) { if (old) old.remove(); return; }
    const b = old || A.el('div', { id: 'back-btn' });
    b.innerHTML = '';
    const go = A.el('button', { class: 'bb-go' }, '← 返回' + (same ? '刚才读到的位置' : '：' + m.title));
    const x = A.el('button', { class: 'bb-x', 'aria-label': '关闭' }, '×');
    go.onclick = () => {
      sessionStorage.removeItem(BACK_KEY); b.remove();
      if (same) { history.replaceState(null, '', location.pathname + location.search); scrollTo({ top: m.y, behavior: 'instant' }); return; }
      const ref = document.referrer ? document.referrer.split('#')[0].split('/').pop() : '';
      if (ref === m.url && history.length > 1) { history.back(); return; }
      sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ url: m.url, y: m.y }));
      location.href = m.url;
    };
    x.onclick = () => { sessionStorage.removeItem(BACK_KEY); b.remove(); };
    b.append(go, x);
    if (!old) document.body.append(b);
  }

  /* ---------- formula cards: <div class="fx" data-syms='{…}' data-steps='[…]'> \[…\] <div class="fx-read">…</div> <div class="fx-eg">…</div> </div>
     Shows only the formula; clicking it unfolds: how to read it, every symbol, a worked example, a step-by-step build-up. ---------- */
  function stepper(steps) {
    const wrap = A.el('div', { class: 'fx-build' });
    const bar = A.el('div', { class: 'steps' }), fx = A.el('div', { class: 'fxs' }), say = A.el('div', { class: 'say' });
    wrap.append(bar, fx, say);
    const btns = steps.map((s, i) => { const b = A.el('button', { type: 'button', onclick: () => show(i) }, '第 ' + (i + 1) + ' 步'); bar.append(b); return b; });
    function show(i) {
      btns.forEach((b, j) => b.classList.toggle('on', j === i));
      if (window.katex) katex.render(steps[i].tex, fx, { displayMode: true, throwOnError: false, trust: true, strict: 'ignore' });
      else fx.textContent = steps[i].tex;
      say.innerHTML = steps[i].say;
      renderMath(say);
    }
    wrap.showFirst = () => show(0);
    return wrap;
  }
  A.stepper = stepper;
  function initFormulaCards() {
    A.$$('.fx').forEach((box) => {
      if (box.dataset.fxInit) return;
      box.dataset.fxInit = '1';
      const more = A.el('div', { class: 'fx-more' });
      const parts = [];
      const sec = (label, node) => A.el('div', { class: 'fx-sec' }, A.el('div', { class: 'fx-lab' }, label), node);
      const read = A.$('.fx-read', box), eg = A.$('.fx-eg', box), dl = A.$('dl.fx-syms', box);
      let syms = null, steps = null;
      // symbols: <dl class="fx-syms"><dt data-sym="R">\(R\)</dt><dd>奖励……</dd>…</dl>, linked to \htmlClass{sym-R}{R} in the formula
      if (dl) {
        syms = {};
        A.$$('dt', dl).forEach((dt) => { const dd = dt.nextElementSibling; if (dt.dataset.sym && dd) syms[dt.dataset.sym] = dt.innerHTML + '：' + dd.innerHTML; });
        box.dataset.syms = JSON.stringify(syms);
      } else {
        try { syms = box.dataset.syms ? JSON.parse(box.dataset.syms) : null; } catch (e) { console.warn('bad data-syms', e); }
      }
      // steps: <div class="fx-step" data-tex="…">一句话说明</div>
      const stepEls = A.$$('.fx-step', box);
      if (stepEls.length) { steps = stepEls.map((el) => ({ tex: el.dataset.tex, say: el.innerHTML })); stepEls.forEach((el) => el.remove()); }
      if (read) { more.append(sec('读法', read)); parts.push('读法'); }
      if (dl) { more.append(sec('每个符号', dl)); parts.push('符号'); }
      else if (syms) { const ul = A.el('ul', { class: 'fx-symlist' }); Object.values(syms).forEach((v) => ul.append(A.el('li', { html: v }))); more.append(sec('每个符号', ul)); parts.push('符号'); }
      if (eg) { more.append(sec('代入数字', eg)); parts.push('例子'); }
      let st = null;
      if (steps) { st = stepper(steps); more.append(sec('一步步搭起来', st)); parts.push('逐步拼装'); }
      if (!parts.length) return;
      const hint = A.el('button', { type: 'button', class: 'fx-hint' });
      const label = () => (box.classList.contains('open') ? '收起 ▴' : '点开看' + parts.join(' · ') + ' ▾');
      hint.textContent = label();
      box.append(hint, more);
      let first = true;
      const toggle = () => {
        box.classList.toggle('open');
        if (first && st) { st.showFirst(); first = false; }
        hint.textContent = label();
      };
      hint.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      box.addEventListener('click', (e) => { if (e.target.closest('.fx-more, a, button, .term')) return; if (getSelection && String(getSelection()).length) return; toggle(); });
    });
  }

  /* ---------- math (KaTeX auto-render; delimiters \( \) and \[ \]) ---------- */
  function renderMath(el) {
    if (typeof renderMathInElement !== 'function') return;
    renderMathInElement(el || document.querySelector('main') || document.body, {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false,
      // \htmlClass lets formulas carry symbol classes (colour coding, hover explanations); content is our own
      trust: (ctx) => ctx.command === '\\htmlClass' || ctx.command === '\\htmlData',
      strict: 'ignore',
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'canvas'],
    });
    initSymbols(el || document);
  }
  A.renderMath = renderMath;
  // <div data-syms='{"R":"奖励","b":"基线"}'> + \htmlClass{sym-R}{R} in its formulas: hovering a symbol explains it and
  // highlights every occurrence of the same symbol in that block
  function initSymbols(root) {
    A.$$('[data-syms]', root.nodeType ? root : document).forEach((box) => {
      if (box.dataset.symInit) return;
      box.dataset.symInit = '1';
      let map = {};
      try { map = JSON.parse(box.dataset.syms); } catch (e) { return; }
      A.$$('[class*="sym-"]', box).forEach((el) => {
        const cls = [...el.classList].find((c) => c.startsWith('sym-'));
        const key = cls && cls.slice(4);
        if (!key || !map[key]) return;
        el.style.cursor = 'help';
        el.addEventListener('mouseenter', (e) => {
          A.$$('.' + cls, box).forEach((x) => x.classList.add('sym-on'));
          A.tip.show(map[key], e.clientX, e.clientY);
        });
        el.addEventListener('mouseleave', () => { A.$$('.' + cls, box).forEach((x) => x.classList.remove('sym-on')); A.tip.hide(); });
      });
    });
  }

  /* ---------- demo loader: <div data-demo="name"></div> loads demos/name.js ---------- */
  const DEMOS = {};
  const pending = {};
  A.defineDemo = function (name, fn) {
    DEMOS[name] = fn;
    (pending[name] || []).forEach((el) => mountDemo(name, el));
    delete pending[name];
  };
  function mountDemo(name, el) {
    if (el.dataset.mounted) return;
    el.dataset.mounted = '1';
    try { DEMOS[name](el); }
    catch (e) { console.error('demo ' + name + ' failed', e); el.append(A.el('p', { class: 'small', style: { color: 'var(--bad)' } }, '演示加载失败：' + e.message)); }
  }
  function loadDemos() {
    const ver = document.body.dataset.v ? '?v=' + document.body.dataset.v : '';
    A.$$('[data-demo]').forEach((el) => {
      const name = el.dataset.demo;
      if (DEMOS[name]) { mountDemo(name, el); return; }
      const first = !pending[name];
      (pending[name] = pending[name] || []).push(el);
      if (first) {
        const s = document.createElement('script');
        s.src = 'demos/' + name + '.js' + ver;
        s.onerror = () => (pending[name] || []).forEach((m) => m.append(A.el('p', { class: 'small', style: { color: 'var(--bad)' } }, '找不到演示 ' + name)));
        document.head.append(s);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildNav();
    fillXrefs();
    initHistory();
    initTerms();
    initFormulaCards();
    renderMath();
    loadDemos();
    initBack();
  });

  /* ---------- tooltip ---------- */
  let tipEl = null;
  A.tip = {
    show(html, x, y) {
      if (!tipEl) { tipEl = A.el('div', { class: 'tooltip' }); document.body.append(tipEl); }
      tipEl.innerHTML = html; tipEl.style.display = 'block';
      if (html.indexOf('\\(') >= 0) A.renderMath(tipEl);
      const r = tipEl.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > innerHeight - 8) top = y - r.height - 14;
      tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
    },
    hide() { if (tipEl) tipEl.style.display = 'none'; },
  };

  /* ---------- canvas ---------- */
  // A.canvas(canvasEl, {aspect|height}, draw(ctx,W,H)) -> {ctx, redraw, W, H}
  A.canvas = function (cv, opt, draw) {
    const o = { ctx: cv.getContext('2d'), W: 0, H: 0, draw };
    o.redraw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth || cv.parentElement.clientWidth;
      const H = opt.height || Math.round(W * (opt.aspect || 0.5));
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.height = H + 'px';
      }
      o.W = W; o.H = H;
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.ctx.clearRect(0, 0, W, H);
      if (o.draw) o.draw(o.ctx, W, H);
    };
    new ResizeObserver(() => o.redraw()).observe(cv);
    A.onTheme(() => o.redraw());
    requestAnimationFrame(o.redraw);
    return o;
  };
  // mouse position in CSS px relative to canvas
  A.pos = (cv, e) => {
    const r = cv.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };

  /* ---------- controls ---------- */
  // A.slider(parent, {label,min,max,step,value,fmt,log,on}) ; log: value = 10^slider
  A.slider = function (parent, o) {
    const fmt = o.fmt || ((v) => (Math.abs(v) >= 100 ? v.toFixed(0) : +v.toFixed(3)));
    const val = A.el('span', { class: 'val' });
    const input = A.el('input', { type: 'range', min: o.log ? Math.log10(o.min) : o.min, max: o.log ? Math.log10(o.max) : o.max, step: o.step || (o.log ? 0.01 : (o.max - o.min) / 100) });
    const wrap = A.el('label', { class: 'ctl', style: o.width ? { minWidth: o.width + 'px' } : null },
      A.el('span', { class: 'lab' }, A.el('span', null, o.label), val), input);
    const s = {
      el: wrap, input,
      get value() { const v = +input.value; return o.log ? Math.pow(10, v) : v; },
      set value(v) { input.value = o.log ? Math.log10(v) : v; val.textContent = fmt(s.value); },
    };
    s.value = o.value;
    input.addEventListener('input', () => { val.textContent = fmt(s.value); o.on && o.on(s.value); });
    parent.append(wrap);
    return s;
  };
  // segmented control
  A.seg = function (parent, opts, value, on, label) {
    const box = A.el('div', { class: 'seg' });
    const s = { el: box, value };
    const btns = opts.map((op) => {
      const b = A.el('button', { type: 'button', class: op.v === value ? 'on' : '' }, op.t);
      b.onclick = () => { s.set(op.v); on && on(op.v); };
      box.append(b); return b;
    });
    s.set = (v) => { s.value = v; btns.forEach((b, i) => b.classList.toggle('on', opts[i].v === v)); };
    if (label) parent.append(A.el('div', { class: 'ctl', style: { minWidth: 'auto' } }, A.el('span', { class: 'lab' }, label), box));
    else parent.append(box);
    return s;
  };
  A.check = function (parent, label, checked, on) {
    const input = A.el('input', { type: 'checkbox' });
    input.checked = !!checked;
    input.onchange = () => on && on(input.checked);
    const l = A.el('label', { class: 'chk' }, input, label);
    parent.append(l);
    return input;
  };
  A.select = function (parent, label, opts, value, on) {
    const sel = A.el('select');
    opts.forEach((op) => sel.append(A.el('option', { value: op.v }, op.t)));
    sel.value = value;
    sel.onchange = () => on && on(sel.value);
    parent.append(A.el('label', { class: 'ctl' }, A.el('span', { class: 'lab' }, label), sel));
    return sel;
  };

  /* ---------- math ---------- */
  A.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  A.gauss = (r) => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  A.softmax = (arr, T = 1) => {
    const m = Math.max(...arr.map((x) => x / T));
    const e = arr.map((x) => Math.exp(x / T - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / s);
  };
  A.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  A.lerp = (a, b, t) => a + (b - a) * t;
  A.dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  A.sum = (a) => a.reduce((x, y) => x + y, 0);
  A.mean = (a) => A.sum(a) / a.length;

  /* ---------- formatting ---------- */
  A.human = (n, d = 1) => {
    const a = Math.abs(n);
    if (a >= 1e12) return +(n / 1e12).toFixed(d) + 'T';
    if (a >= 1e9) return +(n / 1e9).toFixed(d) + 'B';
    if (a >= 1e6) return +(n / 1e6).toFixed(d) + 'M';
    if (a >= 1e3) return +(n / 1e3).toFixed(d) + 'K';
    return +n.toFixed(d) + '';
  };
  A.bytes = (b, d = 1) => {
    const a = Math.abs(b);
    if (a >= 1e12) return +(b / 1e12).toFixed(d) + ' TB';
    if (a >= 1e9) return +(b / 1e9).toFixed(d) + ' GB';
    if (a >= 1e6) return +(b / 1e6).toFixed(d) + ' MB';
    if (a >= 1e3) return +(b / 1e3).toFixed(d) + ' KB';
    return b.toFixed(0) + ' B';
  };
  A.sci = (x) => {
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(x)));
    const m = x / Math.pow(10, e);
    return (+m.toFixed(2)) + '×10' + String(e).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] || (c === '-' ? '⁻' : c)).join('');
  };
  A.pct = (x, d = 1) => (x * 100).toFixed(d) + '%';

  /* ---------- colors ---------- */
  const hex2rgb = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  A.hex2rgb = hex2rgb;
  A.alpha = (hex, a) => { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const SEQ_LIGHT = ['#f3f2ee', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
  const SEQ_DARK = ['#222220', '#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
  function rampAt(ramp, t) {
    t = A.clamp(t, 0, 1) * (ramp.length - 1);
    const i = Math.min(Math.floor(t), ramp.length - 2), f = t - i;
    const a = hex2rgb(ramp[i]), b = hex2rgb(ramp[i + 1]);
    return `rgb(${Math.round(A.lerp(a[0], b[0], f))},${Math.round(A.lerp(a[1], b[1], f))},${Math.round(A.lerp(a[2], b[2], f))})`;
  }
  A.seq = (t) => rampAt(A.isDark() ? SEQ_DARK : SEQ_LIGHT, t);
  A.div = (t) => { // -1..1 : red .. gray .. blue
    const mid = A.isDark() ? '#383835' : '#f0efec';
    const neg = A.isDark() ? '#e66767' : '#e34948', pos = A.isDark() ? '#3987e5' : '#2a78d6';
    return t < 0 ? rampAt([mid, neg], -t) : rampAt([mid, pos], t);
  };

  /* ---------- plotting ---------- */
  A.niceTicks = (min, max, n = 5) => {
    const span = max - min || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = mag * (err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1);
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(12));
    return out;
  };
  A.logTicks = (min, max) => {
    const out = [];
    for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++) out.push(Math.pow(10, e));
    return out;
  };
  // A.axes(ctx, box{x,y,w,h}, o) -> {X, Y, inv}
  A.axes = function (ctx, box, o) {
    const tx = o.xlog ? Math.log10 : (v) => v, ty = o.ylog ? Math.log10 : (v) => v;
    const x0 = tx(o.xmin), x1 = tx(o.xmax), y0 = ty(o.ymin), y1 = ty(o.ymax);
    const X = (v) => box.x + ((tx(v) - x0) / (x1 - x0)) * box.w;
    const Y = (v) => box.y + box.h - ((ty(v) - y0) / (y1 - y0)) * box.h;
    const invX = (px) => { const t = x0 + ((px - box.x) / box.w) * (x1 - x0); return o.xlog ? Math.pow(10, t) : t; };
    const invY = (py) => { const t = y0 + ((box.y + box.h - py) / box.h) * (y1 - y0); return o.ylog ? Math.pow(10, t) : t; };
    const grid = A.css('--grid'), axis = A.css('--axis'), muted = A.css('--muted');
    ctx.save();
    ctx.font = '11.5px ' + A.css('--sans');
    ctx.lineWidth = 1;
    const xt = o.xticks || (o.xlog ? A.logTicks(o.xmin, o.xmax) : A.niceTicks(o.xmin, o.xmax, o.nx || 6));
    const yt = o.yticks || (o.ylog ? A.logTicks(o.ymin, o.ymax) : A.niceTicks(o.ymin, o.ymax, o.ny || 5));
    ctx.fillStyle = muted;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yt.forEach((v) => {
      const y = Math.round(Y(v)) + 0.5;
      if (y < box.y - 1 || y > box.y + box.h + 1) return;
      ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke();
      if (!o.noYLabels) ctx.fillText(o.yfmt ? o.yfmt(v) : A.human(v, 2), box.x - 6, y);
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xt.forEach((v) => {
      const x = Math.round(X(v)) + 0.5;
      if (x < box.x - 1 || x > box.x + box.w + 1) return;
      if (o.xgrid) { ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); }
      ctx.fillText(o.xfmt ? o.xfmt(v) : A.human(v, 2), x, box.y + box.h + 6);
    });
    ctx.strokeStyle = axis; ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h + 0.5); ctx.lineTo(box.x + box.w, box.y + box.h + 0.5); ctx.stroke();
    if (o.xlabel) { ctx.textAlign = 'right'; ctx.fillText(o.xlabel, box.x + box.w, box.y + box.h + 22); }
    if (o.ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(o.ylabel, box.x - (o.ylabelOffset ?? 40), box.y - 8); }
    ctx.restore();
    return { X, Y, invX, invY };
  };
  // rounded-top bar
  A.bar = function (ctx, x, y, w, h, color, r = 4) {
    if (h <= 0 || w <= 0) return;
    r = Math.min(r, w / 2, h);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h);
    ctx.closePath(); ctx.fill();
  };
  // horizontal bar rounded at right end
  A.hbar = function (ctx, x, y, w, h, color, r = 4) {
    if (h <= 0 || w <= 0) return;
    r = Math.min(r, h / 2, w);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x, y + h);
    ctx.closePath(); ctx.fill();
  };
  A.text = function (ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = (o.weight || '') + ' ' + (o.size || 12) + 'px ' + (o.mono ? A.css('--mono') : A.css('--sans'));
    ctx.fillStyle = o.color || A.css('--ink');
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    ctx.fillText(s, x, y);
    ctx.restore();
  };
  A.arrow = function (ctx, x0, y0, x1, y1, color, w = 2, head = 8) {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
    ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };


  /* ---------- number formats (FP32 … FP4, NF4) ---------- */
  const FMT = {
    fp32: { n: 'FP32', e: 8, m: 23, ieee: true },
    bf16: { n: 'BF16', e: 8, m: 7, ieee: true },
    fp16: { n: 'FP16', e: 5, m: 10, ieee: true },
    e4m3: { n: 'FP8 E4M3', e: 4, m: 3, max: 448 },
    e5m2: { n: 'FP8 E5M2', e: 5, m: 2, ieee: true },
    e2m1: { n: 'FP4 E2M1', e: 2, m: 1, max: 6 },
  };
  function encFloat(x, f) {
    const bias = (1 << (f.e - 1)) - 1;
    const emin = 1 - bias;
    const emax = f.ieee ? (1 << f.e) - 2 - bias : (1 << f.e) - 1 - bias;
    const maxMant = f.max ? Math.round((f.max / Math.pow(2, emax) - 1) * (1 << f.m)) : (1 << f.m) - 1;
    const maxVal = Math.pow(2, emax) * (1 + maxMant / (1 << f.m));
    const sign = x < 0 || Object.is(x, -0) ? 1 : 0;
    const a = Math.abs(x);
    if (a === 0) return { v: 0, sign, ef: 0, mf: 0 };
    if (a >= maxVal) return { v: (sign ? -1 : 1) * maxVal, sign, ef: emax + bias, mf: maxMant, sat: a > maxVal };
    let ex = Math.floor(Math.log2(a));
    if (ex < emin) {
      const mf = Math.round(a / Math.pow(2, emin - f.m));
      if (mf >= 1 << f.m) return { v: (sign ? -1 : 1) * Math.pow(2, emin), sign, ef: 1, mf: 0 };
      return { v: (sign ? -1 : 1) * mf * Math.pow(2, emin - f.m), sign, ef: 0, mf };
    }
    let mf = Math.round((a / Math.pow(2, ex) - 1) * (1 << f.m));
    if (mf >= 1 << f.m) { mf = 0; ex++; }
    if (ex > emax || (ex === emax && mf > maxMant)) return { v: (sign ? -1 : 1) * maxVal, sign, ef: emax + bias, mf: maxMant, sat: true };
    return { v: (sign ? -1 : 1) * Math.pow(2, ex) * (1 + mf / (1 << f.m)), sign, ef: ex + bias, mf };
  }
  const E2M1 = [0, 0.5, 1, 1.5, 2, 3, 4, 6];
  function nearestE2M1(x) { const a = Math.abs(x); let best = 0, bd = Infinity; for (const g of E2M1) { const d = Math.abs(a - g); if (d < bd) { bd = d; best = g; } } return Math.sign(x) * best; }
  const NF4 = [-1, -0.6961928009986877, -0.5250730514526367, -0.39491748809814453, -0.28444138169288635, -0.18477343022823334, -0.09105003625154495, 0, 0.07958029955625534, 0.16093020141124725, 0.24611230194568634, 0.33791524171829224, 0.44070982933044434, 0.5626170039176941, 0.7229568362236023, 1];
  A.num = { FMT, encFloat, E2M1, nearestE2M1, NF4 };

  A.debounce = (fn, ms = 60) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  // build a demo card: returns {root, bd}
  A.demo = function (mount, title, sub) {
    const m = typeof mount === 'string' ? document.getElementById(mount) : mount;
    m.classList.add('demo');
    const hd = A.el('div', { class: 'hd' }, A.el('span', { class: 'tag' }, '交互'), A.el('span', { class: 't' }, title), sub ? A.el('span', { class: 'sub' }, sub) : null);
    const bd = A.el('div', { class: 'bd' });
    m.append(hd, bd);
    return { root: m, bd };
  };
})();
