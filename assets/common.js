/* LLM Atlas — shared helpers: nav, theme, canvas, controls, math, plotting. */
(function () {
  const CHAPTERS = [
    { f: 'index.html', n: '', t: '总览与时间线' },
    { part: '第一部分 · Transformer 基础' },
    { f: 'ch01-tokens.html', n: '1', t: '分词与嵌入' },
    { f: 'ch02-attention.html', n: '2', t: '注意力机制' },
    { f: 'ch03-transformer.html', n: '3', t: 'Transformer 结构与位置编码' },
    { f: 'ch04-generation.html', n: '4', t: '自回归生成与采样' },
    { part: '第二部分 · 训练与能力' },
    { f: 'ch05-training.html', n: '5', t: '规模定律与训练流水线' },
    { f: 'ch06-reasoning.html', n: '6', t: '推理模型与强化学习' },
    { f: 'ch07-moe.html', n: '7', t: '混合专家 MoE' },
    { part: '第三部分 · 效率：上下文、量化、Infra' },
    { f: 'ch08-long-context.html', n: '8', t: '长上下文与注意力变体' },
    { f: 'ch09-quantization.html', n: '9', t: '量化：从 INT8 到 1-bit' },
    { f: 'ch10-infra.html', n: '10', t: '推理与训练 Infra' },
    { part: '第四部分 · 生成：图像与视频' },
    { f: 'ch11-diffusion.html', n: '11', t: '扩散与流匹配原理' },
    { f: 'ch12-image.html', n: '12', t: '文生图与图生图' },
    { f: 'ch13-video.html', n: '13', t: '视频生成与世界模型' },
    { part: '第五部分 · 前沿' },
    { f: 'ch14-frontier.html', n: '14', t: '2026 前沿地图' },
    { part: '第六部分 · 智能体与多模态' },
    { f: 'ch15-agents.html', n: '15', t: '智能体：工具、上下文与检索' },
    { f: 'ch16-vlm.html', n: '16', t: '多模态理解：视觉、视频与语音' },
  ];

  const A = {};
  window.A = A;
  A.CHAPTERS = CHAPTERS;

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

  /* ---------- nav ---------- */
  function buildNav() {
    const here = location.pathname.split('/').pop() || 'index.html';
    const side = document.getElementById('side');
    if (!side) return;
    side.append(A.el('a', { class: 'brand', href: 'index.html' }, '大模型全景图谱', A.el('small', null, '从 Transformer 到 2026 前沿')));
    let idx = -1;
    const flat = CHAPTERS.filter((c) => c.f);
    CHAPTERS.forEach((c) => {
      if (c.part) { side.append(A.el('div', { class: 'part' }, c.part)); return; }
      const on = c.f === here;
      side.append(A.el('a', { class: 'ch' + (on ? ' on' : ''), href: c.f }, A.el('span', { class: 'n' }, c.n), A.el('span', null, c.t)));
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
    const tools = A.el('div', { class: 'tools' }, A.el('button', { id: 'theme-btn', onclick: cycleTheme }, ''));
    side.append(tools);
    updateThemeBtn();
    const mb = A.el('button', { id: 'menu-btn', onclick: () => side.classList.toggle('open') }, '☰ 目录');
    document.body.append(mb);
    const pager = document.getElementById('pager');
    if (pager && idx >= 0) {
      const prev = flat[idx - 1], next = flat[idx + 1];
      pager.append(prev ? A.el('a', { href: prev.f }, A.el('small', null, '← 上一章'), prev.t) : A.el('span'));
      pager.append(next ? A.el('a', { href: next.f, style: { textAlign: 'right' } }, A.el('small', null, '下一章 →'), next.t) : A.el('span'));
    }
  }
  document.addEventListener('DOMContentLoaded', buildNav);

  /* ---------- tooltip ---------- */
  let tipEl = null;
  A.tip = {
    show(html, x, y) {
      if (!tipEl) { tipEl = A.el('div', { class: 'tooltip' }); document.body.append(tipEl); }
      tipEl.innerHTML = html; tipEl.style.display = 'block';
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
