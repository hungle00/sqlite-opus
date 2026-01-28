# SQLite Opus

A Flask-based web dashboard for SQLite database query and management.

## Installation

```bash
pip install sqlite-opus
```

Or install from source:

```bash
git clone https://github.com/yourusername/sqlite-opus.git
cd sqlite-opus
pip install -e .
```

## Quick Start

SQLite Opus can be used as a library, similar to Flask-MonitoringDashboard:

```python
from flask import Flask
import sqlite_opus as dashboard

app = Flask(__name__)

# Bind the dashboard to your Flask app
dashboard.bind(app)

# The dashboard will be available at http://localhost:5000/sqlite-opus
app.run()
```

## Configuration

You can customize the dashboard configuration:

```python
import sqlite_opus as dashboard

# Option 1: Configure before binding
dashboard.config.url_prefix = "my-dashboard"
dashboard.config.max_query_results = 500
dashboard.bind(app)

# Option 2: Configure during binding
dashboard.bind(
    app,
    url_prefix="my-dashboard",
    max_query_results=500,
    enable_cors=True
)
```

### Configuration Options

- `url_prefix`: URL prefix for dashboard routes (default: `"sqlite-opus"`)
- `max_query_results`: Maximum number of query results to return (default: `1000`)
- `enable_cors`: Enable CORS support (default: `True`)

## Features

- **Web-based SQLite Query Interface**: Execute SQL queries through a web dashboard
- **Database Connection Management**: Connect to and disconnect from SQLite databases
- **Table Schema Viewer**: View table structures and schemas
- **Query Results Display**: View query results in a formatted table
- **RESTful API**: All features accessible via API endpoints

## API Endpoints

Once the dashboard is bound to your Flask app, the following endpoints are available:

- `GET /sqlite-opus/` - Main dashboard page
- `POST /sqlite-opus/api/connect` - Connect to a SQLite database
- `POST /sqlite-opus/api/disconnect` - Disconnect from current database
- `GET /sqlite-opus/api/status` - Get connection status
- `GET /sqlite-opus/api/tables` - Get list of all tables
- `GET /sqlite-opus/api/table/<table_name>/schema` - Get table schema
- `POST /sqlite-opus/api/query` - Execute SQL query

## Development

### Setup Development Environment

```bash
# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install in development mode with dev dependencies
pip install -e ".[dev]"
```

### Running Tests

```bash
pytest
```

### Code Formatting

```bash
black sqlite_opus/
flake8 sqlite_opus/
```

## Requirements

- Python >= 3.10
- Flask >= 2.3.0
- Flask-CORS >= 4.0.0 (optional, for CORS support)

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
