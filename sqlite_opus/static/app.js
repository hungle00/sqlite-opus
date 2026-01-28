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

// Connection management
document.getElementById('connect-btn').addEventListener('click', async () => {
    const dbPath = document.getElementById('db-path').value.trim();
    
    if (!dbPath) {
        showStatus('Please enter a database path', 'error');
        return;
    }
    
    const result = await apiRequest('/api/connect', 'POST', { db_path: dbPath });
    
    if (result.success) {
        showStatus('Connected successfully', 'success');
        document.getElementById('connect-btn').disabled = true;
        document.getElementById('disconnect-btn').disabled = false;
        document.getElementById('execute-btn').disabled = false;
        loadTables();
    } else {
        showStatus(result.error || 'Connection failed', 'error');
    }
});

document.getElementById('disconnect-btn').addEventListener('click', async () => {
    await apiRequest('/api/disconnect', 'POST');
    showStatus('Disconnected', 'success');
    document.getElementById('connect-btn').disabled = false;
    document.getElementById('disconnect-btn').disabled = true;
    document.getElementById('execute-btn').disabled = true;
    document.getElementById('tables-list').innerHTML = '<p class="empty-message">Connect to a database to see tables</p>';
    document.getElementById('results-container').innerHTML = '<p class="empty-message">Execute a query to see results</p>';
});

// Load tables
async function loadTables() {
    const result = await apiRequest('/api/tables');
    
    if (result.success && result.tables.length > 0) {
        const tablesList = document.getElementById('tables-list');
        tablesList.innerHTML = result.tables.map(table => 
            `<div class="table-item">${table}</div>`
        ).join('');
    } else {
        document.getElementById('tables-list').innerHTML = '<p class="empty-message">No tables found</p>';
    }
}

// Execute query
document.getElementById('execute-btn').addEventListener('click', async () => {
    const query = document.getElementById('query-editor').value.trim();
    
    if (!query) {
        showStatus('Please enter a query', 'error');
        return;
    }
    
    const result = await apiRequest('/api/query', 'POST', { query: query });
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
    const statusEl = document.getElementById('connection-status');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    
    setTimeout(() => {
        statusEl.className = 'status-message';
    }, 5000);
}

// Check connection status on load
window.addEventListener('load', async () => {
    const status = await apiRequest('/api/status');
    if (status.connected) {
        document.getElementById('db-path').value = status.db_path || '';
        document.getElementById('connect-btn').disabled = true;
        document.getElementById('disconnect-btn').disabled = false;
        document.getElementById('execute-btn').disabled = false;
        loadTables();
    }
});
