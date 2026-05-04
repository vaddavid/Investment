// ===== MAIN APPLICATION =====

let currentView = 'dashboard';
let currentFilter = 'all';
let currentRate = null;
let editingEntryId = null;
let marketCurrency = 'EUR';
let marketChartsLoaded = false;

/**
 * Parse decimal input - handles both comma and dot as decimal separator
 */
function parseDecimal(value) {
  if (!value) return NaN;
  return parseFloat(String(value).replace(',', '.'));
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initEntryForm();
  initTipForm();
  initSourceToggle();
  initImport();
  initFilterBar();
  setDefaultDates();
  loadRate();
  refreshAll();
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('SW registration failed:', err);
  });
}

// ===== NAVIGATION =====
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  currentView = view;
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Show target
  document.getElementById('view-' + view).classList.add('active');
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Refresh data when switching
  if (view === 'dashboard') refreshDashboard();
  if (view === 'history') refreshHistory();
  if (view === 'tips') refreshTips();
  if (view === 'add') updateTipWeekIndicator();
  if (view === 'market') {
    if (!marketChartsLoaded) {
      marketChartsLoaded = true;
      renderMarketCharts();
    }
  }
}

// ===== DEFAULT DATES =====
function setDefaultDates() {
  const today = getTodayStr();
  document.getElementById('entry-date').value = today;
  document.getElementById('tip-date').value = today;
}

// ===== RATE FETCHING =====
async function loadRate(dateStr) {
  const statusEl = document.getElementById('rate-status');
  const statusText = document.getElementById('rate-status-text');
  const rateInput = document.getElementById('entry-rate');

  statusEl.className = 'rate-status loading';
  statusText.textContent = 'Árfolyam betöltése...';

  const rate = await fetchEurHufRate(dateStr);
  if (rate) {
    currentRate = rate;
    rateInput.value = rate.toFixed(2).replace('.', ',');
    statusEl.className = 'rate-status';
    statusText.textContent = `Aktuális: ${rate.toFixed(2).replace('.', ',')} Ft/€`;
    recalcEur();
  } else {
    statusEl.className = 'rate-status error';
    statusText.textContent = 'Nem sikerült betölteni — írd be kézzel';
  }
}

// ===== SOURCE TOGGLE =====
function initSourceToggle() {
  document.querySelectorAll('#source-toggle .toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#source-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateTipWeekIndicator();
    });
  });
}

function getSelectedSource() {
  const active = document.querySelector('#source-toggle .toggle-btn.active');
  return active ? active.dataset.source : 'monthly';
}

function updateTipWeekIndicator() {
  const indicator = document.getElementById('tip-week-indicator');
  const source = getSelectedSource();

  if (source === 'tip') {
    indicator.style.display = 'flex';
    const entries = getEntries();
    const info = getTipWeekInfo(entries);
    document.getElementById('tip-week-num').textContent = info.weekNum;
    const tickerEl = document.getElementById('tip-week-ticker');
    tickerEl.textContent = info.ticker;
    tickerEl.className = 'week-ticker ' + info.ticker.toLowerCase();
    // Auto-select ticker
    document.getElementById('entry-ticker').value = info.ticker;
  } else {
    indicator.style.display = 'none';
    if (source === 'monthly') {
      document.getElementById('entry-ticker').value = 'VUAA';
    }
  }
}

// ===== ENTRY FORM =====
function initEntryForm() {
  const form = document.getElementById('entry-form');
  const hufInput = document.getElementById('entry-huf');
  const eurInput = document.getElementById('entry-eur');
  const rateInput = document.getElementById('entry-rate');
  const dateInput = document.getElementById('entry-date');

  // Auto-calc EUR when HUF changes
  hufInput.addEventListener('input', recalcEur);
  rateInput.addEventListener('input', recalcEur);

  // Auto-calc HUF when EUR changes
  eurInput.addEventListener('input', () => {
    const eur = parseDecimal(eurInput.value);
    const rate = parseDecimal(rateInput.value);
    if (eur && rate) {
      hufInput.value = Math.round(eurToHuf(eur, rate));
    }
  });

  // Reload rate when date changes
  dateInput.addEventListener('change', () => {
    loadRate(dateInput.value);
  });

  // Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEntry();
  });
}

function recalcEur() {
  const huf = parseDecimal(document.getElementById('entry-huf').value);
  const rate = parseDecimal(document.getElementById('entry-rate').value);
  if (huf && rate) {
    document.getElementById('entry-eur').value = hufToEur(huf, rate).toFixed(2).replace('.', ',');
  }
}

function saveEntry() {
  const entry = {
    date: document.getElementById('entry-date').value,
    ticker: document.getElementById('entry-ticker').value,
    amountHUF: parseInt(document.getElementById('entry-huf').value) || 0,
    amountEUR: parseDecimal(document.getElementById('entry-eur').value) || 0,
    eurHufRate: parseDecimal(document.getElementById('entry-rate').value) || 0,
    source: getSelectedSource(),
    note: document.getElementById('entry-note').value.trim()
  };

  if (!entry.date || !entry.amountHUF) {
    showToast('Kérlek töltsd ki a dátumot és az összeget!');
    return;
  }

  if (editingEntryId) {
    updateEntry(editingEntryId, entry);
    editingEntryId = null;
    document.getElementById('btn-save-entry').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg> Mentés';
    showToast('Bejegyzés frissítve! ✓');
  } else {
    addEntry(entry);
    showToast('Bejegyzés mentve! ✓');
  }

  // Reset form
  document.getElementById('entry-huf').value = '';
  document.getElementById('entry-eur').value = '';
  document.getElementById('entry-note').value = '';
  setDefaultDates();
  loadRate();
  updateTipWeekIndicator();
}

// ===== TIP FORM =====
function initTipForm() {
  const form = document.getElementById('tip-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tip = {
      date: document.getElementById('tip-date').value,
      amount: parseInt(document.getElementById('tip-amount').value) || 0
    };
    if (!tip.date || !tip.amount) {
      showToast('Kérlek töltsd ki a dátumot és az összeget!');
      return;
    }
    addTip(tip);
    showToast('Borravaló rögzítve! ✓');
    document.getElementById('tip-amount').value = '';
    document.getElementById('tip-date').value = getTodayStr();
    refreshTips();
    refreshDashboard();
  });
}

// ===== FILTER BAR =====
function initFilterBar() {
  document.querySelectorAll('#history-filters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#history-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      refreshHistory();
    });
  });
}

// ===== IMPORT =====
function initImport() {
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (importData(ev.target.result)) {
        refreshAll();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// ===== REFRESH ALL =====
function refreshAll() {
  refreshDashboard();
  refreshHistory();
  refreshTips();
  updateTipWeekIndicator();
}

// ===== DASHBOARD =====
function refreshDashboard() {
  const stats = getStats();
  const entries = getEntries();

  document.getElementById('dash-total-eur').textContent = formatEUR(stats.totalEUR);
  document.getElementById('dash-total-huf').textContent = formatHUF(stats.totalHUF);
  document.getElementById('dash-month-eur').textContent = formatEUR(stats.currentMonthEUR);
  document.getElementById('dash-avg-rate').textContent = stats.avgRate > 0 ? stats.avgRate.toFixed(2) : '—';
  document.getElementById('dash-vuaa').textContent = formatEUR(stats.vuaaEUR);
  document.getElementById('dash-cndx').textContent = formatEUR(stats.cndxEUR);

  const vuaaPct = Math.round(stats.vuaaPercent);
  const cndxPct = 100 - vuaaPct;
  document.getElementById('dash-vuaa-pct').textContent = vuaaPct || 0;
  document.getElementById('dash-cndx-pct').textContent = cndxPct || 0;
  document.getElementById('dash-ratio-fill').style.width = (vuaaPct || 50) + '%';

  // Uninvested tips
  const tipCard = document.getElementById('tip-balance-card');
  if (stats.uninvestedTips > 0) {
    tipCard.style.display = 'block';
    document.getElementById('dash-uninvested').textContent = formatHUF(stats.uninvestedTips);
  } else {
    tipCard.style.display = 'none';
  }

  // Recent entries
  const recentList = document.getElementById('dash-recent');
  const recent = entries.slice(0, 5);

  if (recent.length === 0) {
    recentList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📈</div>
        <p>Még nincs bejegyzés.<br>Kezdd el a nyilvántartást!</p>
      </div>`;
    return;
  }

  recentList.innerHTML = recent.map(e => renderEntryItem(e)).join('');
}

// ===== HISTORY =====
function refreshHistory() {
  let entries = getEntries();
  const emptyEl = document.getElementById('history-empty');
  const listEl = document.getElementById('history-list');

  // Apply filter
  if (currentFilter === 'VUAA' || currentFilter === 'CNDX') {
    entries = entries.filter(e => e.ticker === currentFilter);
  } else if (currentFilter === 'monthly' || currentFilter === 'tip') {
    entries = entries.filter(e => e.source === currentFilter);
  }

  if (entries.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';

  // Group by month
  const months = {};
  entries.forEach(e => {
    const key = getMonthKey(e.date);
    if (!months[key]) months[key] = [];
    months[key].push(e);
  });

  let html = '';
  Object.keys(months).sort().reverse().forEach(key => {
    const monthTotal = months[key].reduce((s, e) => s + (e.amountHUF || 0), 0);
    html += `<div class="month-header">${formatMonthKey(key)} — ${formatHUF(monthTotal)}</div>`;
    months[key].forEach(e => {
      html += renderEntryItem(e);
    });
  });

  listEl.innerHTML = html;
}

// ===== TIPS =====
function refreshTips() {
  const tips = getTips();
  const tipList = document.getElementById('tip-list');
  const weeklyDiv = document.getElementById('weekly-summaries');

  // Individual tips
  if (tips.length === 0) {
    tipList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💵</div>
        <p>Még nincs rögzített borravaló.</p>
      </div>`;
  } else {
    tipList.innerHTML = tips.map(t => `
      <li class="entry-item" onclick="confirmDeleteTip('${t.id}')">
        <div class="entry-icon" style="background: var(--accent-green-dim); color: var(--accent-green);">💵</div>
        <div class="entry-info">
          <div class="entry-title">${formatHUF(t.amount)}</div>
          <div class="entry-meta">${formatDate(t.date)}</div>
        </div>
        <div style="color: var(--text-muted); font-size: 1.2rem;">×</div>
      </li>
    `).join('');
  }

  // Weekly summaries
  const weeks = getWeeklyTipSummaries();
  const weekKeys = Object.keys(weeks).sort().reverse();

  if (weekKeys.length === 0) {
    weeklyDiv.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 8px 0;">Még nincs heti összesítés.</p>';
  } else {
    weeklyDiv.innerHTML = weekKeys.map(key => {
      const w = weeks[key];
      return `
        <div class="card" style="padding: 14px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; font-size: 0.9rem;">${key}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${w.count} borravaló</div>
            </div>
            <div style="font-weight: 700; color: var(--accent-green); font-size: 1.1rem;">${formatHUF(w.total)}</div>
          </div>
        </div>`;
    }).join('');
  }
}

// ===== RENDER ENTRY ITEM =====
function renderEntryItem(entry) {
  const tickerClass = entry.ticker.toLowerCase();
  return `
    <li class="entry-item" onclick="showEntryDetail('${entry.id}')">
      <div class="entry-icon ${tickerClass}">${entry.ticker}</div>
      <div class="entry-info">
        <div class="entry-title">${getSourceLabel(entry.source)}</div>
        <div class="entry-meta">${formatDateShort(entry.date)}${entry.eurHufRate ? ' · ' + entry.eurHufRate.toFixed(1) + ' Ft/€' : ''}</div>
      </div>
      <div class="entry-amount">
        <div class="amount-eur">${formatEUR(entry.amountEUR || 0)}</div>
        <div class="amount-huf">${formatHUF(entry.amountHUF || 0)}</div>
      </div>
    </li>`;
}

// ===== ENTRY DETAIL MODAL =====
function showEntryDetail(id) {
  const entries = getEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;

  editingEntryId = id;
  const modal = document.getElementById('entry-modal');
  const body = document.getElementById('modal-body');

  body.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Ticker</div>
          <div class="stat-value" style="color: ${entry.ticker === 'VUAA' ? 'var(--accent-green)' : 'var(--accent-blue)'}">${entry.ticker}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Forrás</div>
          <div class="stat-value" style="font-size: 0.9rem;">${getSourceLabel(entry.source)}</div>
        </div>
      </div>
      <div class="card" style="margin-bottom: 12px;">
        <div class="card-title">Dátum</div>
        <div style="font-size: 1rem;">${formatDate(entry.date)}</div>
      </div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Összeg (HUF)</div>
          <div class="stat-value" style="font-size: 1rem;">${formatHUF(entry.amountHUF)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Összeg (EUR)</div>
          <div class="stat-value" style="font-size: 1rem;">${formatEUR(entry.amountEUR || 0)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">EUR/HUF árfolyam</div>
        <div style="font-size: 1.1rem; font-weight: 600;">${entry.eurHufRate ? entry.eurHufRate.toFixed(2) + ' Ft/€' : '—'}</div>
      </div>
      ${entry.note ? `<div class="card"><div class="card-title">Megjegyzés</div><div style="font-size: 0.9rem;">${entry.note}</div></div>` : ''}
    </div>`;

  document.getElementById('modal-delete-btn').onclick = () => {
    if (confirm('Biztosan törlöd ezt a bejegyzést?')) {
      deleteEntry(id);
      closeModal();
      refreshAll();
      showToast('Bejegyzés törölve');
    }
  };

  document.getElementById('modal-edit-btn').onclick = () => {
    editEntry(entry);
  };

  modal.classList.add('active');
}

function editEntry(entry) {
  closeModal();
  editingEntryId = entry.id;

  // Switch to add view
  switchView('add');

  // Fill form with entry data
  document.getElementById('entry-date').value = entry.date;
  document.getElementById('entry-ticker').value = entry.ticker;
  document.getElementById('entry-huf').value = entry.amountHUF;
  document.getElementById('entry-eur').value = (entry.amountEUR || 0).toFixed(2).replace('.', ',');
  document.getElementById('entry-rate').value = (entry.eurHufRate || 0).toFixed(2).replace('.', ',');
  document.getElementById('entry-note').value = entry.note || '';

  // Set source toggle
  document.querySelectorAll('#source-toggle .toggle-btn').forEach(b => {
    b.classList.remove('active');
    if (b.dataset.source === entry.source) b.classList.add('active');
  });

  // Change button text
  document.getElementById('btn-save-entry').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Frissítés';

  updateTipWeekIndicator();
}

function closeModal() {
  document.getElementById('entry-modal').classList.remove('active');
  editingEntryId = null;
}

// ===== MARKET VIEW =====
function setMarketCurrency(currency) {
  marketCurrency = currency;
  document.querySelectorAll('.market-currency-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.currency === currency) btn.classList.add('active');
  });
  renderMarketCharts();
}

function renderMarketCharts() {
  const isHuf = marketCurrency === 'HUF';
  
  // XETR (Xetra) is in EUR. TradingView can multiply it by EURHUF inline
  const vuaaSymbol = isHuf ? 'XETR:VUAA*FX_IDC:EURHUF' : 'XETR:VUAA';
  const cndxSymbol = isHuf ? 'XETR:CNDX*FX_IDC:EURHUF' : 'XETR:CNDX';
  const eurhufSymbol = 'FX_IDC:EURHUF';

  createTvWidget('tv-chart-vuaa', vuaaSymbol);
  createTvWidget('tv-chart-cndx', cndxSymbol);
  createTvWidget('tv-chart-eurhuf', eurhufSymbol);

  // Hide the text prices since the chart provides the exact price
  document.getElementById('vuaa-price').style.display = 'none';
  document.getElementById('cndx-price').style.display = 'none';
  document.getElementById('eurhuf-price').style.display = 'none';
}

function createTvWidget(containerId, symbol) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  if (!window.TradingView) {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => initWidget(containerId, symbol);
    document.head.appendChild(script);
  } else {
    initWidget(containerId, symbol);
  }
}

function initWidget(containerId, symbol) {
  new TradingView.widget({
    "autosize": true,
    "symbol": symbol,
    "interval": "D",
    "timezone": "Europe/Budapest",
    "theme": "dark",
    "style": "3", // Area chart
    "locale": "hu_HU",
    "enable_publishing": false,
    "backgroundColor": "rgba(26, 34, 64, 0)", // transparent to match card
    "gridColor": "rgba(255, 255, 255, 0.05)",
    "hide_top_toolbar": true,
    "hide_legend": false,
    "save_image": false,
    "container_id": containerId
  });
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'entry-modal') closeModal();
});

// ===== CONFIRM ACTIONS =====
function confirmDeleteTip(id) {
  if (confirm('Biztosan törlöd ezt a borravalót?')) {
    deleteTip(id);
    refreshTips();
    refreshDashboard();
    showToast('Borravaló törölve');
  }
}

function confirmClearData() {
  if (confirm('FIGYELEM! Ez az összes adatodat véglegesen törli. Biztosan folytatod?')) {
    if (confirm('Tényleg biztos vagy benne? Ez nem visszavonható!')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TIPS_KEY);
      refreshAll();
      showToast('Minden adat törölve');
    }
  }
}
