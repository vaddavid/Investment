// ===== LOCAL STORAGE MANAGEMENT =====

const STORAGE_KEY = 'befektetes_tracker_data';
const TIPS_KEY = 'befektetes_tracker_tips';

/**
 * Get all investment entries
 */
function getEntries() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save all entries
 */
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Add a new entry
 */
function addEntry(entry) {
  const entries = getEntries();
  entry.id = generateId();
  entry.createdAt = new Date().toISOString();
  entries.unshift(entry); // newest first
  saveEntries(entries);
  return entry;
}

/**
 * Update an existing entry
 */
function updateEntry(id, updates) {
  const entries = getEntries();
  const index = entries.findIndex(e => e.id === id);
  if (index !== -1) {
    entries[index] = { ...entries[index], ...updates, updatedAt: new Date().toISOString() };
    saveEntries(entries);
    return entries[index];
  }
  return null;
}

/**
 * Delete an entry
 */
function deleteEntry(id) {
  const entries = getEntries();
  const filtered = entries.filter(e => e.id !== id);
  saveEntries(filtered);
  return filtered;
}

/**
 * Get all tip log entries (individual daily tips)
 */
function getTips() {
  try {
    const data = localStorage.getItem(TIPS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save all tips
 */
function saveTips(tips) {
  localStorage.setItem(TIPS_KEY, JSON.stringify(tips));
}

/**
 * Add a tip entry
 */
function addTip(tip) {
  const tips = getTips();
  tip.id = generateId();
  tip.createdAt = new Date().toISOString();
  tips.unshift(tip);
  saveTips(tips);
  return tip;
}

/**
 * Delete a tip
 */
function deleteTip(id) {
  const tips = getTips();
  const filtered = tips.filter(t => t.id !== id);
  saveTips(filtered);
  return filtered;
}

/**
 * Get weekly tip summaries
 */
function getWeeklyTipSummaries() {
  const tips = getTips();
  const weeks = {};
  
  tips.forEach(tip => {
    const d = new Date(tip.date);
    const weekKey = d.getFullYear() + '-W' + String(getWeekNumber(d)).padStart(2, '0');
    if (!weeks[weekKey]) {
      weeks[weekKey] = { total: 0, count: 0, tips: [] };
    }
    weeks[weekKey].total += tip.amount;
    weeks[weekKey].count++;
    weeks[weekKey].tips.push(tip);
  });
  
  return weeks;
}

/**
 * Calculate dashboard statistics
 */
function getStats() {
  const entries = getEntries();
  const tips = getTips();
  
  let totalHUF = 0;
  let totalEUR = 0;
  let vuaaHUF = 0;
  let cndxHUF = 0;
  let vuaaEUR = 0;
  let cndxEUR = 0;
  let monthlyHUF = 0;
  let tipHUF = 0;
  let totalRateSum = 0;
  let rateCount = 0;
  
  // Current month
  const now = new Date();
  const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let currentMonthHUF = 0;
  let currentMonthEUR = 0;
  
  entries.forEach(e => {
    totalHUF += e.amountHUF || 0;
    totalEUR += e.amountEUR || 0;
    
    if (e.ticker === 'VUAA') {
      vuaaHUF += e.amountHUF || 0;
      vuaaEUR += e.amountEUR || 0;
    } else {
      cndxHUF += e.amountHUF || 0;
      cndxEUR += e.amountEUR || 0;
    }
    
    if (e.source === 'monthly') monthlyHUF += e.amountHUF || 0;
    if (e.source === 'tip') tipHUF += e.amountHUF || 0;
    
    if (e.eurHufRate) {
      totalRateSum += e.eurHufRate;
      rateCount++;
    }
    
    if (e.date && e.date.startsWith(currentMonthKey)) {
      currentMonthHUF += e.amountHUF || 0;
      currentMonthEUR += e.amountEUR || 0;
    }
  });
  
  // Total uninvested tips
  const totalTips = tips.reduce((sum, t) => sum + t.amount, 0);
  // Already invested from tips
  const investedFromTips = entries.filter(e => e.source === 'tip').reduce((sum, e) => sum + (e.amountHUF || 0), 0);
  const uninvestedTips = totalTips - investedFromTips;
  
  return {
    totalHUF, totalEUR,
    vuaaHUF, vuaaEUR,
    cndxHUF, cndxEUR,
    monthlyHUF, tipHUF,
    avgRate: rateCount > 0 ? totalRateSum / rateCount : 0,
    currentMonthHUF, currentMonthEUR,
    entryCount: entries.length,
    vuaaPercent: totalHUF > 0 ? (vuaaHUF / totalHUF * 100) : 0,
    totalTips, uninvestedTips
  };
}

/**
 * Export all data as JSON
 */
function exportData() {
  const data = {
    entries: getEntries(),
    tips: getTips(),
    exportDate: new Date().toISOString(),
    version: 1
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `befektetes_backup_${getTodayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Adatok exportálva!');
}

/**
 * Export as CSV
 */
function exportCSV() {
  const entries = getEntries();
  if (entries.length === 0) {
    showToast('Nincs exportálható adat');
    return;
  }
  
  const headers = 'Dátum;Ticker;Összeg (HUF);Összeg (EUR);EUR/HUF árfolyam;Forrás;Megjegyzés\n';
  const rows = entries.map(e => 
    `${e.date};${e.ticker};${e.amountHUF};${(e.amountEUR || 0).toFixed(2)};${(e.eurHufRate || 0).toFixed(2)};${getSourceLabel(e.source)};${e.note || ''}`
  ).join('\n');
  
  const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `befektetes_${getTodayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportálva!');
}

/**
 * Import data from JSON
 */
function importData(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (data.entries && Array.isArray(data.entries)) {
      saveEntries(data.entries);
    }
    if (data.tips && Array.isArray(data.tips)) {
      saveTips(data.tips);
    }
    showToast('Adatok importálva!');
    return true;
  } catch {
    showToast('Hibás fájl formátum!');
    return false;
  }
}
