(() => {
  'use strict';

  const STORE_KEY = 'lycheepay.v1';

  // 减免规则（金额单位：分）
  const RULES = {
    mai: { amount: 2000 },
    deng: { amount: 100 },
    full: { step: 10000, amount: 500 },
  };

  const defaultState = () => ({
    products: [], // { n: 序号, p: 价格(分), s?: 库存 }
    selected: {}, // 序号 -> 数量
    sold: {}, // 序号 -> 已完成订单的数量
    rules: { mai: false, deng: false, full: false },
  });

  let state = load();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.products)) {
        if (Array.isArray(s.selected)) s.selected = Object.fromEntries(s.selected.map((n) => [n, 1]));
        return { ...defaultState(), ...s, rules: { ...defaultState().rules, ...s.rules } };
      }
    } catch (_) { /* ignore */ }
    return defaultState();
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const fmt = (cents) => {
    const v = cents / 100;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
  };

  const toCents = (str) => (str.trim() === '' ? NaN : Math.round(Number(str)) * 100);

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  // 库存余量：负数表示超卖，无库存限制返回 null
  function remain(x, q) {
    return x.s == null ? null : x.s - (state.sold[x.n] || 0) - q;
  }

  // ---------- 计算 ----------
  function calc() {
    const map = new Map(state.products.map((x) => [x.n, x]));
    const lines = Object.entries(state.selected)
      .map(([n, q]) => ({ n: Number(n), q, x: map.get(Number(n)) }))
      .filter((l) => l.x && l.q > 0)
      .map((l) => ({ n: l.n, q: l.q, p: l.x.p, rem: remain(l.x, l.q) }))
      .sort((a, b) => a.n - b.n);
    const count = lines.reduce((s, l) => s + l.q, 0);
    const subtotal = lines.reduce((s, l) => s + l.p * l.q, 0);

    const off = { full: 0, mai: 0, deng: 0 };
    if (count) {
      if (state.rules.full) off.full = Math.floor(subtotal / RULES.full.step) * RULES.full.amount;
      if (state.rules.mai) off.mai = RULES.mai.amount;
      if (state.rules.deng) off.deng = RULES.deng.amount;
    }
    const discount = off.full + off.mai + off.deng;
    const total = Math.max(0, subtotal - discount);
    return { lines, count, subtotal, off, discount, total };
  }

  // ---------- 结账页 ----------
  function renderCheckout() {
    const grid = $('#grid');
    const sorted = [...state.products].sort((a, b) => a.n - b.n);
    const wrap = grid.parentElement;
    const top = wrap.scrollTop;

    grid.innerHTML = sorted
      .map((x) => {
        const q = state.selected[x.n] || 0;
        const rem = remain(x, q);
        const over = rem !== null && rem < 0;
        let stockTxt = '';
        if (rem !== null) stockTxt = over ? ` 超${-rem}` : ` 剩${rem}`;
        return (
          `<div class="item${q ? ' on' : ''}${over ? ' over' : ''}" data-n="${x.n}" role="button">` +
          (q ? `<span class="qty">×${q}</span><span class="minus" data-minus>−</span>` : '') +
          `<span class="no">${x.n}</span><span class="pr">¥${fmt(x.p)}${stockTxt}</span></div>`
        );
      })
      .join('');
    wrap.scrollTop = top;
    $('#grid-empty').hidden = sorted.length > 0;

    $$('.rule').forEach((b) => b.classList.toggle('on', !!state.rules[b.dataset.rule]));
    renderTotal();
  }

  function renderTotal() {
    const r = calc();
    $('#total').textContent = fmt(r.total);
    $('#chips').innerHTML = r.lines
      .map((l) => {
        const times = l.q > 1 ? ' ×' + l.q : '';
        const warn = l.rem !== null && l.rem < 0;
        return `<span class="chip${warn ? ' warn' : ''}"><b>${l.n}号</b> ¥${fmt(l.p)}${times}${warn ? ' 超卖' : ''}</span>`;
      })
      .join('');
    if (!r.count) {
      $('#detail').textContent = '未选择商品';
      return;
    }
    const parts = [`共${r.count}件 ¥${fmt(r.subtotal)}`];
    if (r.off.full) parts.push(`满减 -${fmt(r.off.full)}`);
    if (r.off.mai) parts.push(`麦序 -${fmt(r.off.mai)}`);
    if (r.off.deng) parts.push(`灯牌 -${fmt(r.off.deng)}`);
    $('#detail').textContent = parts.join('  ·  ');
  }

  $('#grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.item');
    if (!btn) return;
    const n = Number(btn.dataset.n);
    const q = state.selected[n] || 0;
    const next = e.target.closest('[data-minus]') ? q - 1 : q + 1;
    if (next > 0) state.selected[n] = next;
    else delete state.selected[n];
    state.rules.full = calc().subtotal >= RULES.full.step;
    save();
    renderCheckout();
    if (navigator.vibrate) navigator.vibrate(8);
  });

  $$('.rule').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.rule;
      state.rules[k] = !state.rules[k];
      b.classList.toggle('on', state.rules[k]);
      save();
      renderTotal();
    })
  );

  function resetOrder() {
    state.selected = {};
    state.rules = { mai: false, deng: false, full: false };
    save();
    renderCheckout();
  }

  $('#btn-cancel').addEventListener('click', resetOrder);

  $('#btn-done').addEventListener('click', () => {
    const entries = Object.entries(state.selected);
    if (!entries.length) return;
    for (const [n, q] of entries) state.sold[n] = (state.sold[n] || 0) + q;
    resetOrder();
    toast('已记录，下一单');
  });

  // ---------- 设置页 ----------
  function renderSetup() {
    const sorted = [...state.products].sort((a, b) => a.n - b.n);
    $('#count').textContent = sorted.length ? `共 ${sorted.length} 件` : '';
    $('#list-empty').hidden = sorted.length > 0;
    $('#list').innerHTML = sorted
      .map(
        (x) =>
          `<div class="row" data-n="${x.n}">` +
          `<div class="no">${x.n}<small>已售${state.sold[x.n] || 0}</small></div>` +
          `<div class="price-wrap"><input class="price-in" type="number" inputmode="numeric" min="0" step="1" value="${fmt(x.p)}"></div>` +
          `<input class="stock-in" type="number" inputmode="numeric" min="0" placeholder="不限" value="${x.s == null ? '' : x.s}">` +
          `<button class="del" aria-label="删除">✕</button></div>`
      )
      .join('');
  }

  $('#btn-add').addEventListener('click', () => {
    const from = parseInt($('#in-from').value, 10);
    const toRaw = $('#in-to').value;
    const to = toRaw === '' ? from : parseInt(toRaw, 10);
    const price = toCents($('#in-price').value);
    const stockRaw = $('#in-stock').value;
    const stock = stockRaw === '' ? null : parseInt(stockRaw, 10);

    if (!(from > 0) || !(to >= from)) return toast('请检查序号');
    if (!(price >= 0)) return toast('请输入价格');
    if (stock !== null && !(stock >= 0)) return toast('请检查库存');
    if (to - from > 999) return toast('一次最多添加 1000 个');

    const map = new Map(state.products.map((x) => [x.n, x]));
    for (let n = from; n <= to; n++) {
      const item = map.get(n) || { n };
      item.p = price;
      if (stock !== null) item.s = stock;
      if (!map.has(n)) state.products.push(item);
    }
    save();
    renderSetup();
    toast(`已添加 ${from === to ? from + ' 号' : from + '–' + to + ' 号'}  ¥${fmt(price)}`);

    // 方便连续录入：下一个序号自动接上
    $('#in-from').value = to + 1;
    $('#in-to').value = '';
    $('#in-price').focus();
    $('#in-price').select();
  });

  $('#list').addEventListener('change', (e) => {
    if (!e.target.matches('input')) return;
    const n = Number(e.target.closest('.row').dataset.n);
    const item = state.products.find((x) => x.n === n);
    if (!item) return;

    if (e.target.matches('.stock-in')) {
      const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
      if (v === null) delete item.s;
      else if (v >= 0) item.s = v;
      else e.target.value = item.s ?? '';
      save();
      return;
    }

    const price = toCents(e.target.value);
    if (!(price >= 0)) {
      e.target.value = fmt(item.p);
      return;
    }
    item.p = price;
    save();
  });

  $('#list').addEventListener('click', (e) => {
    if (!e.target.closest('.del')) return;
    const n = Number(e.target.closest('.row').dataset.n);
    state.products = state.products.filter((x) => x.n !== n);
    delete state.selected[n];
    delete state.sold[n];
    save();
    renderSetup();
  });

  // confirm() 在内置浏览器/WebView 里可能被屏蔽，改为再点一次确认
  function confirmTap(btn, action) {
    const label = btn.textContent;
    let timer = null;
    btn.addEventListener('click', () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        btn.textContent = label;
        btn.classList.remove('armed');
        action();
        return;
      }
      btn.textContent = '再点一次确认';
      btn.classList.add('armed');
      timer = setTimeout(() => {
        timer = null;
        btn.textContent = label;
        btn.classList.remove('armed');
      }, 3000);
    });
  }

  confirmTap($('#btn-reset-sold'), () => {
    state.sold = {};
    save();
    renderSetup();
    toast('已售已清零');
  });

  confirmTap($('#btn-reset'), () => {
    state = defaultState();
    save();
    for (const id of ['#in-from', '#in-to', '#in-price', '#in-stock']) $(id).value = '';
    renderSetup();
    toast('已清空，可以设置新场次');
  });

  // ---------- 标签切换 ----------
  function showTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + name));
    if (name === 'checkout') renderCheckout();
    else renderSetup();
    history.replaceState(null, '', '#' + name);
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // 没有商品时默认进入设置页
  const hash = location.hash.slice(1);
  showTab(hash === 'setup' || (!hash && !state.products.length) ? 'setup' : 'checkout');

  // ---------- PWA ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
