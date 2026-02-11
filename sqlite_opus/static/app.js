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

    // Insert SELECT query into query editor when user clicks a table
    const queryEditor = document.getElementById('query-editor');
    if (queryEditor) {
        queryEditor.value = `SELECT * FROM ${tableName};`;
    }

    const loadingMsg = '<p class="empty-message"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';
    const schemaContainer = document.getElementById('table-schema-container');
    const columnsContainer = document.getElementById('table-columns-container');
    const indexesContainer = document.getElementById('table-indexes-container');
    if (schemaContainer) schemaContainer.innerHTML = loadingMsg;
    if (columnsContainer) columnsContainer.innerHTML = loadingMsg;
    if (indexesContainer) indexesContainer.innerHTML = loadingMsg;

    // Only switch to schema tab if it is not already active
    const schemaTab = document.getElementById('schema-tab');
    const isSchemaActive = schemaTab && schemaTab.classList.contains('active');
    if (schemaTab && isSchemaActive) {
        schemaTab.click();
    }

    const [info, columnsHtml, indexesHtml] = await Promise.all([
        loadTableInfo(tableName),
        fetch(`api/table/${encodeURIComponent(tableName)}/columns`).then(r => r.ok ? r.text() : ''),
        fetch(`api/table/${encodeURIComponent(tableName)}/indexes`).then(r => r.ok ? r.text() : ''),
    ]);

    if (columnsContainer) columnsContainer.innerHTML = columnsHtml || '<p class="error-message">Failed to load columns</p>';
    if (indexesContainer) indexesContainer.innerHTML = indexesHtml || '<p class="error-message">Failed to load indexes</p>';

    if (info === null) {
        const errMsg = '<p class="error-message">Failed to load table info</p>';
        if (schemaContainer) schemaContainer.innerHTML = errMsg;
    } else {
        displayTableSchema(info.schema ?? null, tableName);
    }
});

// Query results via Flask partial
let lastQuery = '';
let lastPerPage = 10;

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
    const hiddenLastQuery = document.getElementById('last-executed-query');
    if (hiddenLastQuery) {
        hiddenLastQuery.value = query;
    }
    lastPerPage = 10;
    try {
        const html = await fetchQueryPartial(query, 1, lastPerPage);
        renderQueryResults(html);
    } catch (err) {
        showStatus('Request failed: ' + err.message, 'error');
    }
});

// Clear query (also clear last executed query so export uses fresh results)
document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('query-editor').value = '';
    lastQuery = '';
    const hiddenLastQuery = document.getElementById('last-executed-query');
    if (hiddenLastQuery) {
        hiddenLastQuery.value = '';
    }
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

// Export result of last executed query as CSV (uses same query as the results table)
async function exportTableToCsv() {
    const hiddenLastQuery = document.getElementById('last-executed-query');
    const query = hiddenLastQuery ? hiddenLastQuery.value.trim() : '';
    if (!query) {
        if (typeof showStatus === 'function') showStatus('Execute a query first to export results', 'error');
        return;
    }
    if (!query.toUpperCase().startsWith('SELECT')) {
        if (typeof showStatus === 'function') showStatus('Only SELECT queries can be exported as CSV', 'error');
        return;
    }
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.disabled = true;
    try {
        const res = await fetch('api/query/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (typeof showStatus === 'function') showStatus(err.error || 'Export failed', 'error');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const csvFilename = selectedTableName ? `${selectedTableName}_export.csv` : 'export.csv';
        a.download = csvFilename;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof showStatus === 'function') showStatus('CSV exported successfully', 'success');
    } catch (err) {
        if (typeof showStatus === 'function') showStatus('Export failed: ' + err.message, 'error');
    } finally {
        if (exportBtn) exportBtn.disabled = false;
    }
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
        const executeBtn = document.getElementById('execute-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');
        if (executeBtn) executeBtn.disabled = false;
        if (exportCsvBtn) exportCsvBtn.disabled = false;
    }
});
