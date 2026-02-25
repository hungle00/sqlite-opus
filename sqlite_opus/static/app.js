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
const statusBanner = document.getElementById('app-status-banner');
const statusMessageEl = document.getElementById('app-status-message');

// Currently selected table (for export)
let selectedTableName = null;

// Query type select: insert template into query editor
const queryTypeSnippets = {
    select: 'SELECT * FROM table_name;',
    insert: 'INSERT INTO table_name (column1, column2) VALUES (?, ?);',
    update: 'UPDATE table_name SET column1 = ? WHERE ;',
    delete: 'DELETE FROM table_name WHERE ;',
    truncate: 'DELETE FROM table_name;',
    replace: 'REPLACE INTO table_name (column1) VALUES (?);',
};

const queryTypeSelect = document.getElementById('query-type-select');
const queryEditorEl = document.getElementById('query-editor');
if (queryTypeSelect && queryEditorEl) {
    queryTypeSelect.addEventListener('change', function () {
        const value = this.value;
        if (!value || !queryTypeSnippets[value]) return;
        let snippet = queryTypeSnippets[value];
        const table = selectedTableName || 'table_name';
        snippet = snippet.replace(/table_name/g, table);
        queryEditorEl.value = snippet;
        queryEditorEl.focus();
        queryTypeSelect.value = '';
    });
}

const loadingMsg = '<p class="empty-message"><i class="fas fa-spinner fa-spin"></i> Loading...</p>';

// HTMX: before table info request — set selected table, query editor, show loading, flag for tab switch
let pendingTableInfoLoad = false;
document.body.addEventListener('htmx:beforeRequest', (e) => {
    const elt = e.detail?.elt;
    if (!elt?.classList?.contains('table-item') || !elt?.getAttribute?.('hx-get')) return;
    pendingTableInfoLoad = true;
    const tableName = elt.dataset?.tableName;
    if (tableName) {
        selectedTableName = tableName;
        const queryEditor = document.getElementById('query-editor');
        if (queryEditor) queryEditor.value = `SELECT * FROM ${tableName};`;
    }
    const schemaContainer = document.getElementById('table-schema-container');
    const columnsContainer = document.getElementById('table-columns-container');
    const indexesContainer = document.getElementById('table-indexes-container');
    if (schemaContainer) schemaContainer.innerHTML = loadingMsg;
    if (columnsContainer) columnsContainer.innerHTML = loadingMsg;
    if (indexesContainer) indexesContainer.innerHTML = loadingMsg;
});
document.body.addEventListener('htmx:afterSettle', () => {
    if (!pendingTableInfoLoad) return;
    pendingTableInfoLoad = false;
    const schemaTab = document.getElementById('schema-tab');
    const isSchemaActive = schemaTab && schemaTab.classList.contains('active');
    if (schemaTab && isSchemaActive) schemaTab.click();
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

// Show status message in top banner (only visible when called; hides after 5s or on dismiss)
function showStatus(message, type) {
    if (!statusBanner || !statusMessageEl) return;
    statusMessageEl.textContent = message;
    statusBanner.className = `app-status-banner app-status-banner--${type}`;
    statusBanner.hidden = false;
    const hide = () => {
        statusBanner.hidden = true;
    };
    clearTimeout(showStatus._timeout);
    showStatus._timeout = setTimeout(hide, 5000);
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
