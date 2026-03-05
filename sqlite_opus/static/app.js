// Basic JavaScript for SQLite Opus Dashboard

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

// HTMX: before execute-query form submit — block if query is empty and show error
document.body.addEventListener('htmx:beforeRequest', (e) => {
    const form = e.detail?.elt?.closest?.('form');
    if (form?.id !== 'query-form') return;
    const query = (document.getElementById('query-editor')?.value || '').trim();
    if (!query) {
        e.preventDefault();
        showStatus('Please enter a query', 'error');
    }
});

// HTMX: after query results swap — sync last-executed-query for Export CSV
document.body.addEventListener('htmx:afterSwap', (e) => {
    if (e.detail?.target?.id !== 'query-results-area') return;
    const queryEditor = document.getElementById('query-editor');
    const hiddenLastQuery = document.getElementById('last-executed-query');
    if (queryEditor && hiddenLastQuery) {
        hiddenLastQuery.value = queryEditor.value.trim();
    }
});

// Clear query (and last-executed-query so export uses fresh state)
document.getElementById('clear-btn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('query-editor').value = '';
    const hiddenLastQuery = document.getElementById('last-executed-query');
    if (hiddenLastQuery) hiddenLastQuery.value = '';
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
    const res = await fetch('api/status');
    const status = res.ok ? await res.json() : {};
    if (status.connected) {
        const executeBtn = document.getElementById('execute-btn');
        const exportCsvBtn = document.getElementById('export-csv-btn');
        if (executeBtn) executeBtn.disabled = false;
        if (exportCsvBtn) exportCsvBtn.disabled = false;
    }
});
