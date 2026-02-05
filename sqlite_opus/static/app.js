// Basic JavaScript for SQLite Opus Dashboard

// API helper functions
async function apiRequest(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    return response.json();
}

// Connection management (only if connection panel exists)
const statusEl = document.getElementById('connection-status');

async function loadTableInfo(table_name) {
    const result = await apiRequest(`api/table/${encodeURIComponent(table_name)}`, 'GET');
    if (result.success) {
        return result;
    }
    return null;
}

function displayTableSchema(schemaString, tableName) {
    const container = document.getElementById('table-schema-container');
    if (!container) return;

    if (!schemaString || typeof schemaString !== 'string') {
        container.innerHTML = '<p class="empty-message">No schema information</p>';
        return;
    }

    const trimmed = schemaString.trim();
    if (!trimmed) {
        container.innerHTML = '<p class="empty-message">No schema information</p>';
        return;
    }

    let html = `<p class="schema-table-name"><strong>${escapeHtml(tableName)}</strong></p>`;
    html += '<pre class="schema-sql"><code>' + escapeHtml(trimmed) + '</code></pre>';
    container.innerHTML = html;
}

function displayTableColumns(columns, tableName) {
    const container = document.getElementById('table-columns-container');
    if (!container) return;

    if (!Array.isArray(columns) || columns.length === 0) {
        container.innerHTML = `<p class="table-columns-name"><strong>${escapeHtml(tableName)}</strong></p><p class="empty-message">No columns</p>`;
        return;
    }

    let html = `<p class="table-columns-name"><strong>${escapeHtml(tableName)}</strong></p>`;
    html += '<table class="results-table info-table"><thead><tr>';
    html += '<th>Name</th><th>Type</th><th>Not Null</th><th>Default</th><th>PK</th>';
    html += '</tr></thead><tbody>';
    columns.forEach(col => {
        html += '<tr>';
        html += `<td>${escapeHtml(String(col.name ?? ''))}</td>`;
        html += `<td>${escapeHtml(String(col.type ?? ''))}</td>`;
        html += `<td>${col.notnull ? 'Yes' : 'No'}</td>`;
        html += `<td>${escapeHtml(col.dflt_value != null ? String(col.dflt_value) : '')}</td>`;
        html += `<td>${col.pk ? 'Yes' : 'No'}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function displayTableIndexes(indexes, tableName) {
    const container = document.getElementById('table-indexes-container');
    if (!container) return;

    if (!Array.isArray(indexes) || indexes.length === 0) {
        container.innerHTML = `<p class="table-indexes-name"><strong>${escapeHtml(tableName)}</strong></p><p class="empty-message">No indexes</p>`;
        return;
    }

    let html = `<p class="table-indexes-name"><strong>${escapeHtml(tableName)}</strong></p>`;
    html += '<table class="results-table info-table"><thead><tr>';
    html += '<th>Name</th><th>Unique</th><th>Origin</th>';
    html += '</tr></thead><tbody>';
    indexes.forEach(idx => {
        html += '<tr>';
        html += `<td>${escapeHtml(String(idx.name ?? ''))}</td>`;
        html += `<td>${idx.unique ? 'Yes' : 'No'}</td>`;
        html += `<td>${escapeHtml(String(idx.origin ?? ''))}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Currently selected table (for export)
let selectedTableName = null;

// Click on table name: load and display schema, columns, indexes
document.getElementById('tables-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.table-item');
    if (!item) return;
    const tableName = item.dataset.tableName;
    if (!tableName) return;

    selectedTableName = tableName;
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.disabled = false;

    const loadingMsg = '<p class="empty-message"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    const schemaContainer = document.getElementById('table-schema-container');
    const columnsContainer = document.getElementById('table-columns-container');
    const indexesContainer = document.getElementById('table-indexes-container');
    if (schemaContainer) schemaContainer.innerHTML = loadingMsg;
    if (columnsContainer) columnsContainer.innerHTML = loadingMsg;
    if (indexesContainer) indexesContainer.innerHTML = loadingMsg;

    document.getElementById('schema-tab').click();

    const info = await loadTableInfo(tableName);
    if (info === null) {
        const errMsg = '<p class="error-message">Failed to load table info</p>';
        if (schemaContainer) schemaContainer.innerHTML = errMsg;
        if (columnsContainer) columnsContainer.innerHTML = errMsg;
        if (indexesContainer) indexesContainer.innerHTML = errMsg;
    } else {
        displayTableSchema(info.schema ?? null, tableName);
        displayTableColumns(info.columns ?? [], tableName);
        displayTableIndexes(info.indexes ?? [], tableName);
    }
});

// Query results via Flask partial
let lastQuery = '';
let lastPerPage = 50;

async function fetchQueryPartial(query, page, perPage) {
    const res = await fetch('api/query/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, page: page || 1, per_page: perPage || 50 }),
    });
    const html = await res.text();
    return html;
}

function renderQueryResults(html) {
    const area = document.getElementById('query-results-area');
    if (area) area.innerHTML = html;
}

// Execute query (page 1) – fetch HTML partial and inject
document.getElementById('execute-btn').addEventListener('click', async () => {
    const query = document.getElementById('query-editor').value.trim();
    if (!query) {
        showStatus('Please enter a query', 'error');
        const area = document.getElementById('query-results-area');
        if (area) {
            area.innerHTML = '<div id="results-container" class="results-container"><p class="empty-message">Please enter a query above.</p></div><div id="pagination-bar" class="pagination-bar" style="display: none;"></div>';
        }
        return;
    }
    lastQuery = query;
    lastPerPage = 50;
    try {
        const html = await fetchQueryPartial(query, 1, lastPerPage);
        renderQueryResults(html);
    } catch (err) {
        showStatus('Request failed: ' + err.message, 'error');
    }
});

// Clear query
document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('query-editor').value = '';
});

// Pagination: delegate on query-results-area so it works after partial inject
document.getElementById('query-results-area').addEventListener('click', async (e) => {
    const btn = e.target.closest('.pagination-btn');
    if (!btn || !lastQuery) return;
    const page = parseInt(btn.dataset.page, 10);
    if (isNaN(page)) return;
    try {
        const html = await fetchQueryPartial(lastQuery, page, lastPerPage);
        renderQueryResults(html);
    } catch (err) {
        showStatus('Request failed: ' + err.message, 'error');
    }
});

// Export selected table as CSV via API
async function exportTableToCsv() {
    if (!selectedTableName) {
        if (typeof showStatus === 'function') showStatus('Select a table first', 'error');
        return;
    }
    // const exportBtn = document.getElementById('export-csv-btn');
    // if (exportBtn) exportBtn.disabled = true;
    // call api/table/${encodeURIComponent(selectedTableName)}/export
}

const exportCsvBtn = document.getElementById('export-csv-btn');
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportTableToCsv);
}

// Show status message
function showStatus(message, type) {
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        
        setTimeout(() => {
            statusEl.className = 'status-message';
        }, 5000);
    }
}

// Check connection status on load
window.addEventListener('load', async () => {
    const status = await apiRequest('api/status');
    if (status.connected) {
        document.getElementById('execute-btn').disabled = false;
    }
});
