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

async function loadTableSchema(table_name) {
    const result = await apiRequest(`api/table/${encodeURIComponent(table_name)}/schema`, 'GET');
    if (result.success && result.schema != null) {
        return result.schema;
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

// Click on table name: load and display schema
document.getElementById('tables-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.table-item');
    if (!item) return;
    const tableName = item.dataset.tableName;
    if (!tableName) return;

    const container = document.getElementById('table-schema-container');
    if (container) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-spinner fa-spin"></i> Loading schema...</p>';
    }

    document.getElementById('schema-tab').click();

    const schema = await loadTableSchema(tableName);
    if (schema === null && container) {
        container.innerHTML = '<p class="error-message">Failed to load schema</p>';
    } else {
        displayTableSchema(schema, tableName);
    }
});

// Execute query
document.getElementById('execute-btn').addEventListener('click', async () => {
    const query = document.getElementById('query-editor').value.trim();
    
    if (!query) {
        showStatus('Please enter a query', 'error');
        const container = document.getElementById('results-container');
        if (container) {
            container.innerHTML = '<p class="empty-message">Please enter a query above.</p>';
        }
        return;
    }
    
    const result = await apiRequest('api/query', 'POST', { query: query });
    displayResults(result);
});

// Clear query
document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('query-editor').value = '';
});

// Display query results
function displayResults(result) {
    const container = document.getElementById('results-container');
    
    if (!result.success) {
        container.innerHTML = `<div class="error-message">Error: ${result.error}</div>`;
        return;
    }
    
    if (result.results.length === 0) {
        container.innerHTML = '<p class="empty-message">No results returned</p>';
        return;
    }
    
    // Create table
    let html = '<table class="results-table"><thead><tr>';
    result.columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    result.results.forEach(row => {
        html += '<tr>';
        result.columns.forEach(col => {
            html += `<td>${row[col] ?? ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
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
