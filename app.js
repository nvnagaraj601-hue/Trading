const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const swingFilter = document.getElementById('swingFilter');
const anniversaryHighFilter = document.getElementById('anniversaryHighFilter');
const anniversaryLowFilter = document.getElementById('anniversaryLowFilter');
const filterYear = document.getElementById('filterYear');
const statusEl = document.getElementById('status');

const sheetUrl = 'https://docs.google.com/spreadsheets/d/1Q6Nz14ts-4hh2-KkqIPp_mCuVIpqHedHBMNU1UCvRe8/export?format=csv&gid=935378781';
const refreshIntervalMs = 120000; // 2 minutes
let refreshTimer = null;
let sheetData = [];
let eventsAttached = false;

const columns = [
  'SYMBOL',
  'NSE_SYMBOL',
  'Public Holdings',
  'Mar Cap in Cr',
  'CMP',
  'Swing High',
  'Swing Low',
  'Swing',
  'Anniversary Signal High',
  'Anniversary Signal Low',
  'Anniversary Date',
  'Year',
  'Anniversary Price High',
  'Anniversary Price Low',
  'Lot Size',
  'Amount'
];

function renderHeader() {
  tableHeaderRow.innerHTML = '';
  columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column === 'Swing' ? 'Monthly Swing' : column;
    tableHeaderRow.appendChild(th);
  });
}

function formatBadge(value) {
  const badge = document.createElement('span');
  const v = String(value || '').trim();
  if (!v) {
    badge.className = 'badge badge-empty';
    badge.textContent = '';
    return badge;
  }

  const kind = v.toLowerCase() === 'buy' ? 'badge-buy' : 'badge-sell';
  badge.className = 'badge ' + kind;
  badge.textContent = v;
  return badge;
}

function renderRows(data) {
  tableBody.innerHTML = '';
  if (data.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columns.length;
    td.textContent = 'No matching symbols found.';
    td.style.textAlign = 'center';
    td.style.padding = '32px 16px';
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  data.forEach((item, rowIndex) => {
    const tr = document.createElement('tr');

    // If this is the final row, mark it so we can style it
    if (rowIndex === data.length - 1) {
      tr.classList.add('final-row');
    }

    columns.forEach((column) => {
      const td = document.createElement('td');
      const value = item[column] || '';
      // Render badges only for the canonical `Swing` (Monthly Swing) and anniversary signals
      if (column === 'Swing' || column === 'Anniversary Signal High' || column === 'Anniversary Signal Low') {
        td.appendChild(formatBadge(value || ''));
      } else {
        td.textContent = value;
      }

      // Highlight CMP values in bold
      if (column === 'CMP') {
        td.classList.add('col-cmp');
      }
      // Color Anniversary Date cells by quarter
      if (column === 'Anniversary Date' && value) {
        const monthIndex = getMonthIndex(value);
        if (monthIndex !== null) {
          const quarter = Math.floor(monthIndex / 3) + 1; // 1..4
          td.classList.add(`month-q${quarter}`);
        }
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

// Try to extract a month index (0-11) from a variety of date formats
function getMonthIndex(value) {
  if (!value) return null;

  // Try native Date parser first
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getMonth();
  }

  // Match month names (short or long)
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const mname = (value.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) || [])[0];
  if (mname) {
    return monthNames.indexOf(mname.toLowerCase().slice(0,3));
  }

  // Match numeric month in formats like 2026-03-15 or 03/15/2026
  const numeric = value.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (numeric && numeric[2]) {
    const m = parseInt(numeric[2], 10);
    if (!Number.isNaN(m) && m >= 1 && m <= 12) return m - 1;
  }

  const numeric2 = value.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (numeric2 && numeric2[2]) {
    const m = parseInt(numeric2[2], 10);
    if (!Number.isNaN(m) && m >= 1 && m <= 12) return m - 1;
  }

  return null;
}

function getUniqueYears(data) {
  return Array.from(new Set(data.map((row) => row['Year'] || ''))).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function applyFilters() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const swingValue = swingFilter.value;
  const anniversaryHighValue = anniversaryHighFilter.value;
  const anniversaryLowValue = anniversaryLowFilter.value;
  const yearValue = filterYear.value;

  const filtered = sheetData.filter((row) => {
    const matchesSearch = searchTerm === '' || columns.some((column) => {
      const value = String(row[column] || '').toLowerCase();
      return value.includes(searchTerm);
    });

    const matchesSwing = !swingValue || String(row['Swing'] || '') === swingValue;
    const matchesAnniversaryHigh = !anniversaryHighValue || String(row['Anniversary Signal High'] || '') === anniversaryHighValue;
    const matchesAnniversaryLow = !anniversaryLowValue || String(row['Anniversary Signal Low'] || '') === anniversaryLowValue;
    const matchesYear = !yearValue || String(row['Year'] || '') === yearValue;
    return matchesSearch && matchesSwing && matchesAnniversaryHigh && matchesAnniversaryLow && matchesYear;
  });

  renderRows(filtered);
}

function normalizeHeaders(headers) {
  const counts = {};
  return headers.map((header) => {
    const name = header.trim();
    counts[name] = (counts[name] || 0) + 1;
    const lower = name.toLowerCase();

    if (name === 'NSE:SYMBOL') {
      return 'NSE_SYMBOL';
    }

    // Handle anniversary columns (first occurrence = signal, second = price)
    if (lower.includes('anniversary') && lower.includes('high')) {
      return counts[name] === 1 ? 'Anniversary Signal High' : 'Anniversary Price High';
    }

    if (lower.includes('anniversary') && lower.includes('low')) {
      return counts[name] === 1 ? 'Anniversary Signal Low' : 'Anniversary Price Low';
    }

    // Map any column that mentions "swing" to our canonical names
    if (lower.includes('swing')) {
      if (lower.includes('high')) return 'Swing High';
      if (lower.includes('low')) return 'Swing Low';
      return 'Swing';
    }

    return name;
  });
}

function parseCSV(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0);
}

function initializeFilters(data) {
  const years = getUniqueYears(data);
  filterYear.innerHTML = '<option value="">All</option>';
  years.forEach((year) => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    filterYear.appendChild(option);
  });
}

function attachEvents() {
  searchInput.addEventListener('input', applyFilters);
  swingFilter.addEventListener('change', applyFilters);
  anniversaryHighFilter.addEventListener('change', applyFilters);
  anniversaryLowFilter.addEventListener('change', applyFilters);
  filterYear.addEventListener('change', applyFilters);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function loadSheetData() {
  setStatus('Loading data from the public Google Sheet…');
  try {
    const response = await fetch(sheetUrl);
    if (!response.ok) {
      throw new Error(`Sheet fetch failed (${response.status})`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);
    const headers = normalizeHeaders(rows[0] || []);
    const data = rows.slice(1).map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ? row[index].trim() : '';
      });
      return record;
    });

    sheetData = data;
    setStatus('Data loaded. Next refresh in 2 minutes.');
    renderHeader();
    initializeFilters(data);
    if (!eventsAttached) {
      attachEvents();
      eventsAttached = true;
    }
    renderRows(data);

    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      setStatus('Refreshing data automatically…');
      loadSheetData();
    }, refreshIntervalMs);
  } catch (error) {
    setStatus(`Unable to load sheet data: ${error.message}`, true);
    renderHeader();
    renderRows([]);
  }
}

loadSheetData();
