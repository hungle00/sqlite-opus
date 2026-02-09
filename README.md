# SQLite Opus

A Flask-based web dashboard for SQLite database query and management.

## Installation

```bash
pip install sqlite-opus
```

Or install from source:

```bash
git clone https://github.com/hungle00/sqlite-opus.git
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

## Screenshots

![SQLite Opus Dashboard](screenshots/sqlite-opus.png)

*Dashboard: tables list, table schema viewer, and SQL query editor with results.*

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
- `query_results_per_page`: Rows per page for paginated SELECT results (default: `50`)
- `enable_cors`: Enable CORS support (default: `True`)

## Features

- **Web-based SQLite Query Interface**: Execute SQL queries through a web dashboard
- **Database Connection Management**: Connect to and disconnect from SQLite databases
- **Table Schema Viewer**: View table structures and schemas
- **Query Results Display**: View query results in a formatted table with **pagination** (powered by the [paginate](https://pypi.org/project/paginate/) library)

## Development

### Setup Development Environment

```bash
# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install in development mode with dev dependencies
pip install -e ".[dev]"
```

## Requirements

- Python >= 3.10
- Flask >= 2.3.0
- Flask-CORS >= 4.0.0 (optional, for CORS support)

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
