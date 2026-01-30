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
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const dbPathInput = document.getElementById('db-path');
const statusEl = document.getElementById('connection-status');

if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
        const dbPath = dbPathInput.value.trim();
        
        if (!dbPath) {
            showStatus('Please enter a database path', 'error');
            return;
        }
        
        const result = await apiRequest('api/connect', 'POST', { db_path: dbPath });
        
        if (result.success) {
            showStatus('Connected successfully', 'success');
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            document.getElementById('execute-btn').disabled = false;
            loadTables();
        } else {
            showStatus(result.error || 'Connection failed', 'error');
        }
    });
}

if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
        await apiRequest('api/disconnect', 'POST');
        showStatus('Disconnected', 'success');
        if (connectBtn) connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        document.getElementById('execute-btn').disabled = true;
        document.getElementById('tables-list').innerHTML = '<p class="empty-message">Connect to a database to see tables</p>';
        document.getElementById('results-container').innerHTML = '<p class="empty-message">Execute a query to see results</p>';
    });
}

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
        // If connection panel exists, update it
        if (dbPathInput) {
            dbPathInput.value = status.db_path || '';
        }
        if (connectBtn) {
            connectBtn.disabled = true;
        }
        if (disconnectBtn) {
            disconnectBtn.disabled = false;
        }
        document.getElementById('execute-btn').disabled = false;
    }
});
