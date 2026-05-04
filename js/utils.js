// ===== UTILITY FUNCTIONS =====

/**
 * Format number as HUF currency
 */
function formatHUF(amount) {
  return new Intl.NumberFormat('hu-HU', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(Math.round(amount)) + ' Ft';
}

/**
 * Format number as EUR currency
 */
function formatEUR(amount) {
  return new Intl.NumberFormat('hu-HU', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' €';
}

/**
 * Format date to Hungarian locale string
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format date short
 */
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('hu-HU', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get month-year key from date string (e.g., "2026-05")
 */
function getMonthKey(dateStr) {
  return dateStr.substring(0, 7);
}

/**
 * Format month key to readable string
 */
function formatMonthKey(key) {
  const [year, month] = key.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1);
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
}

/**
 * Get today's date as YYYY-MM-DD
 */
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Generate UUID v4
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Convert HUF to EUR using rate
 */
function hufToEur(huf, rate) {
  if (!rate || rate === 0) return 0;
  return huf / rate;
}

/**
 * Convert EUR to HUF using rate
 */
function eurToHuf(eur, rate) {
  return eur * rate;
}

/**
 * Get the current ISO week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Determine which ticker the current tip week should go to.
 * Weeks 1,2,3 → VUAA, Week 4 → CNDX, then repeat.
 * Based on how many tip entries exist: cycle through 4 weeks.
 */
function getTipWeekInfo(entries) {
  const tipEntries = entries.filter(e => e.source === 'tip');
  // Count distinct weeks
  const weekSet = new Set();
  tipEntries.forEach(e => {
    const d = new Date(e.date);
    weekSet.add(d.getFullYear() + '-W' + getWeekNumber(d));
  });
  const weekIndex = weekSet.size % 4; // 0,1,2 → VUAA; 3 → CNDX
  const weekNum = (weekIndex % 4) + 1;
  const ticker = weekIndex < 3 ? 'VUAA' : 'CNDX';
  return { weekNum, ticker, totalWeeks: weekSet.size };
}

/**
 * Fetch EUR/HUF mid-rate from frankfurter.app (free, no API key needed)
 */
async function fetchEurHufRate(dateStr) {
  try {
    // Try specific date first
    const url = dateStr && dateStr !== getTodayStr()
      ? `https://api.frankfurter.app/${dateStr}?from=EUR&to=HUF`
      : `https://api.frankfurter.app/latest?from=EUR&to=HUF`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data.rates.HUF;
  } catch (err) {
    console.warn('Frankfurter API failed, trying fallback...', err);
    try {
      // Fallback: exchangerate-api
      const resp = await fetch('https://open.er-api.com/v6/latest/EUR');
      if (!resp.ok) throw new Error('Fallback API error');
      const data = await resp.json();
      return data.rates.HUF;
    } catch (err2) {
      console.error('All rate APIs failed', err2);
      return null;
    }
  }
}

/**
 * Show toast notification
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

/**
 * Source label in Hungarian
 */
function getSourceLabel(source) {
  switch(source) {
    case 'monthly': return 'Havi befizetés';
    case 'tip': return 'Borravalóból';
    case 'extra': return 'Extra befizetés';
    default: return source;
  }
}
