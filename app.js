const tableHeaderRow = document.getElementById('tableHeaderRow');
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const swingFilter = document.getElementById('swingFilter');
const anniversaryHighFilter = document.getElementById('anniversaryHighFilter');
const anniversaryLowFilter = document.getElementById('anniversaryLowFilter');
const filterYear = document.getElementById('filterYear');

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

  const filtered = NIFTY50_DATA.filter((row) => {
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

function initializeFilters() {
  const years = getUniqueYears(NIFTY50_DATA);
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

function init() {
  renderHeader();
  initializeFilters();
  attachEvents();
  renderRows(NIFTY50_DATA);
}

init();
