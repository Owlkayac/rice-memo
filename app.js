(function () {
  'use strict';

  /* ---------- 設定 ---------- */
  var CATS = ['作業', '水管理', '生育', '病害虫', '資材', '天候', '収穫調製', '販売', '気づき'];
  var COLORS = {
    '作業': '#3f7d4e', '水管理': '#2f7d9e', '生育': '#7d9a2a', '病害虫': '#b8482e',
    '資材': '#7d5fa8', '天候': '#5f7686', '収穫調製': '#8a6a3a', '販売': '#b58217', '気づき': '#a84a76'
  };
  var RULES = {
    '病害虫': ['病', '害虫', '虫', 'カメムシ', 'いもち', 'イモチ', 'ウンカ', '紋枯', '斑点', '食害', '雑草', 'ヒエ', '被害', '枯れ', '変色'],
    '水管理': ['水位', '湛水', '落水', '中干し', '掛け流し', '用水', '排水', '入水', '溝切', '水'],
    '資材': ['肥料', '農薬', '薬剤', '散布', '購入', '資材', '燃料', '軽油', '苗箱', '培土', '追肥', '元肥', '穂肥', '除草剤', '種籾', '米袋', '袋'],
    '販売': ['販売', '出荷', '注文', '予約', '発送', '価格', '単価', 'お客', '直売', '納品', '売'],
    '天候': ['雨', '台風', '風', '猛暑', '気温', '天気', '霜', '日照', '干ばつ', '雷'],
    '生育': ['生育', '出穂', '分げつ', '穂', '葉色', '草丈', '茎数', '登熟', '倒伏', '籾'],
    '収穫調製': ['刈取', '刈り取り', 'コンバイン', '乾燥', '籾摺', '脱穀', '調製', '玄米', '色彩選別', '水分', '収量', '反収', '検査', '等級', 'ライスセンター'],
    '作業': ['耕', '代掻', '代かき', '田植', '草刈', '畦', '畔', '整備', '点検', '修理', '播種', '育苗', '移植', '作業']
  };
  var KEY = 'nogyo-memo-v1';

  var notes = [];
  var storageOk = true;

  /* ---------- 小道具 ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return fmt(new Date()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ---------- 保存 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      notes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(notes)) notes = [];
    } catch (e) {
      storageOk = false;
      notes = [];
    }
  }
  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch (e) {
      if (storageOk) {
        storageOk = false;
        toast('保存できませんでした。書き出しでバックアップしてください');
      }
    }
  }

  /* ---------- 分類 ----------
     いまはキーワードによる簡易分類です。
     あとでAI分類につなぐときは、classifyText の中身だけを差し替えます。
     戻り値: Promise<{cat: string, kws: string[], src: string}> */
  function ruleClassify(text) {
    var best = '気づき', bestScore = 0, bestKws = [];
    CATS.forEach(function (cat) {
      var words = RULES[cat];
      if (!words) return;
      var hits = words.filter(function (w) { return text.indexOf(w) >= 0; });
      if (hits.length > bestScore) { bestScore = hits.length; best = cat; bestKws = hits; }
    });
    return { cat: best, kws: bestKws.slice(0, 3), src: 'rule' };
  }
  function classifyText(text) {
    return Promise.resolve(ruleClassify(text));
  }

  /* ---------- 画面の描画 ---------- */
  function fieldNames() {
    var s = {};
    notes.forEach(function (n) { if (n.field) s[n.field] = 1; });
    return Object.keys(s).sort();
  }
  function renderFilters() {
    var fs = fieldNames();
    $('field-list').innerHTML = fs.map(function (f) { return '<option value="' + esc(f) + '">'; }).join('');
    var lf = $('l-field'), cur = lf.value;
    lf.innerHTML = '<option value="">すべての圃場</option>' + fs.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('');
    lf.value = fs.indexOf(cur) >= 0 ? cur : '';
    var lc = $('l-cat'), cc = lc.value;
    lc.innerHTML = '<option value="">すべての分野</option>' + CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    lc.value = cc;
  }
  function srcLabel(s) { return s === 'manual' ? '手動で変更' : s === 'ai' ? 'AI分類' : '簡易分類'; }

  function renderList() {
    var cat = $('l-cat').value, fld = $('l-field').value, q = $('l-q').value.trim();
    var arr = notes.filter(function (n) {
      return (!cat || n.cat === cat) && (!fld || n.field === fld) &&
        (!q || n.text.indexOf(q) >= 0 || (n.kws || []).join(' ').indexOf(q) >= 0);
    }).sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0);
    });
    if (!arr.length) {
      $('list').innerHTML = '<div class="empty">' + (notes.length
        ? '条件に合うメモがありません。'
        : 'まだメモがありません。「記録」から最初の1件を書いてみましょう。') + '</div>';
      return;
    }
    $('list').innerHTML = arr.map(function (n) {
      var opts = CATS.map(function (c) { return '<option' + (c === n.cat ? ' selected' : '') + '>' + c + '</option>'; }).join('');
      var color = COLORS[n.cat] || '#5f7686';
      return '<div class="card" data-id="' + esc(n.id) + '">' +
        '<div class="note-head">' + esc(n.date) + (n.field ? ' ・ ' + esc(n.field) : '') + '</div>' +
        '<p class="note-text">' + esc(n.text) + '</p>' +
        '<div class="chips">' +
          '<select class="cat-select" style="background:' + color + '" aria-label="分野を変更">' + opts + '</select>' +
          (n.kws || []).map(function (k) { return '<span class="kw">' + esc(k) + '</span>'; }).join('') +
          '<span class="src">' + srcLabel(n.src) + '</span>' +
          '<button class="del">削除</button>' +
        '</div></div>';
    }).join('');
  }

  function bars(el, rows, colorFn) {
    if (!rows.length) {
      el.innerHTML = '<div class="empty small">この期間のデータがありません。</div>';
      return;
    }
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    el.innerHTML = rows.map(function (r) {
      return '<div class="bar-row"><span>' + esc(r[0]) + '</span><div class="bar-track"><div class="bar-fill" style="width:' +
        Math.round(r[1] / max * 100) + '%;background:' + colorFn(r[0]) + '"></div></div><span>' + r[1] + '</span></div>';
    }).join('');
  }
  function inRange() {
    var v = $('s-range').value;
    if (v === 'all') return notes.slice();
    if (v === 'year') return notes.filter(function (n) { return n.date.slice(0, 4) === today().slice(0, 4); });
    var from = fmt(new Date(Date.now() - Number(v) * 86400000));
    return notes.filter(function (n) { return n.date >= from; });
  }
  function renderStats() {
    var arr = inRange();
    var cc = {}, fc = {}, mc = {}, kc = {};
    CATS.forEach(function (c) { cc[c] = 0; });
    arr.forEach(function (n) {
      if (n.cat) cc[n.cat] = (cc[n.cat] || 0) + 1;
      var f = n.field || '(圃場なし)';
      fc[f] = (fc[f] || 0) + 1;
      var m = n.date.slice(0, 7);
      mc[m] = (mc[m] || 0) + 1;
      (n.kws || []).forEach(function (k) { kc[k] = (kc[k] || 0) + 1; });
    });
    var byCount = function (a, b) { return b[1] - a[1]; };
    bars($('st-cat'), CATS.map(function (c) { return [c, cc[c]]; }).filter(function (r) { return r[1] > 0; }).sort(byCount),
      function (k) { return COLORS[k]; });
    bars($('st-field'), Object.keys(fc).map(function (k) { return [k, fc[k]]; }).sort(byCount).slice(0, 8),
      function () { return 'var(--brand)'; });
    bars($('st-month'), Object.keys(mc).sort().map(function (k) { return [k, mc[k]]; }),
      function () { return 'var(--brand)'; });
    var kws = Object.keys(kc).map(function (k) { return [k, kc[k]]; }).sort(byCount).slice(0, 12);
    $('st-kw').innerHTML = kws.length
      ? kws.map(function (k) { return '<span class="kw">' + esc(k[0]) + ' ' + k[1] + '</span>'; }).join('')
      : '<div class="empty small">キーワードがまだありません。</div>';

    var d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    var lo = fmt(new Date(d.getTime() - 15 * 86400000)), hi = fmt(new Date(d.getTime() + 15 * 86400000));
    var last = notes.filter(function (n) { return n.date >= lo && n.date <= hi; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    $('st-last').innerHTML = last.length
      ? last.slice(0, 8).map(function (n) {
          return '<li>' + esc(n.date) + ' <strong>' + esc(n.cat || '未分類') + '</strong> ' +
            esc(n.text.slice(0, 60)) + (n.text.length > 60 ? '…' : '') + '</li>';
        }).join('')
      : '<li class="none">去年の同じ時期のメモはありません。</li>';
  }
  function renderAll() {
    $('count').textContent = notes.length + '件';
    renderFilters();
    renderList();
    renderStats();
  }

  /* ---------- 操作 ---------- */
  document.querySelectorAll('nav button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('nav button').forEach(function (x) {
        x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      });
      ['write', 'list', 'stats'].forEach(function (t) { $('tab-' + t).hidden = (t !== b.dataset.tab); });
      if (b.dataset.tab === 'stats') renderStats();
      window.scrollTo(0, 0);
    });
  });

  $('save').addEventListener('click', async function () {
    var text = $('f-text').value.trim();
    if (!text) { toast('メモを入力してください'); $('f-text').focus(); return; }
    var btn = $('save');
    btn.disabled = true;
    var r = await classifyText(text);
    var n = {
      id: uid(), date: $('f-date').value || today(), field: $('f-field').value.trim(),
      text: text, cat: r.cat, kws: r.kws, src: r.src, created: Date.now()
    };
    notes.push(n);
    persist();
    $('f-text').value = '';
    $('status').textContent = '「' + n.cat + '」に分類して保存しました';
    btn.disabled = false;
    renderAll();
  });

  $('list').addEventListener('change', function (e) {
    if (!e.target.classList.contains('cat-select')) return;
    var id = e.target.closest('.card').dataset.id;
    var n = notes.find(function (x) { return x.id === id; });
    if (n) { n.cat = e.target.value; n.src = 'manual'; persist(); renderAll(); }
  });
  $('list').addEventListener('click', function (e) {
    if (!e.target.classList.contains('del')) return;
    var id = e.target.closest('.card').dataset.id;
    if (confirm('このメモを削除しますか?')) {
      notes = notes.filter(function (x) { return x.id !== id; });
      persist();
      renderAll();
    }
  });
  ['l-cat', 'l-field'].forEach(function (id) { $(id).addEventListener('change', renderList); });
  $('l-q').addEventListener('input', renderList);
  $('s-range').addEventListener('change', renderStats);

  $('reclassify').addEventListener('click', async function () {
    var targets = notes.filter(function (n) { return n.src !== 'manual'; });
    if (!targets.length) { toast('やり直すメモはありません'); return; }
    for (var i = 0; i < targets.length; i++) {
      var r = await classifyText(targets[i].text);
      targets[i].cat = r.cat;
      targets[i].kws = r.kws;
      targets[i].src = r.src;
    }
    persist();
    renderAll();
    toast(targets.length + '件を分類し直しました');
  });

  /* ---------- 書き出し・読み込み ---------- */
  $('export').addEventListener('click', function () {
    if (!notes.length) { toast('書き出すメモがありません'); return; }
    var blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'nogyo-memo-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('書き出しました');
  });
  $('import-btn').addEventListener('click', function () { $('import-file').click(); });
  $('import-file').addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('bad');
        var have = {};
        notes.forEach(function (n) { have[n.id] = 1; });
        var added = 0;
        data.forEach(function (n) {
          if (n && n.id && typeof n.text === 'string' && typeof n.date === 'string' && !have[n.id]) {
            notes.push({
              id: String(n.id), date: n.date, field: String(n.field || ''), text: n.text,
              cat: CATS.indexOf(n.cat) >= 0 ? n.cat : null,
              kws: Array.isArray(n.kws) ? n.kws.map(String) : [],
              src: n.src || 'rule', created: n.created || Date.now()
            });
            added++;
          }
        });
        persist();
        renderAll();
        toast(added + '件を読み込みました');
      } catch (err) {
        toast('読み込めませんでした。書き出したJSONを選んでください');
      }
      e.target.value = '';
    };
    reader.readAsText(f);
  });

  /* ---------- 起動 ---------- */
  $('f-date').value = today();
  load();
  if (!storageOk) toast('この環境では保存できません。書き出しでバックアップしてください');
  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
