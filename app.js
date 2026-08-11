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
    th.textContent = column;
    tableHeaderRow.appendChild(th);
  });
}

function formatBadge(value) {
  const badge = document.createElement('span');
  badge.className = 'badge ' + (value.toLowerCase() === 'buy' ? 'badge-buy' : 'badge-sell');
  badge.textContent = value;
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

  data.forEach((item) => {
    const tr = document.createElement('tr');
    columns.forEach((column) => {
      const td = document.createElement('td');
      const value = item[column] || '';
      if (column === 'Swing' || column === 'Anniversary Signal High' || column === 'Anniversary Signal Low') {
        td.appendChild(formatBadge(value || ''));
      } else {
        td.textContent = value;
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
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

    if (name === 'NSE:SYMBOL') {
      return 'NSE_SYMBOL';
    }

    if (name === 'Anniversary High') {
      return counts[name] === 1 ? 'Anniversary Signal High' : 'Anniversary Price High';
    }

    if (name === 'Anniversary Low') {
      return counts[name] === 1 ? 'Anniversary Signal Low' : 'Anniversary Price Low';
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
