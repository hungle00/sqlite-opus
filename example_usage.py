"""Example usage of SQLite Opus dashboard.

This demonstrates how to use sqlite_opus as a library, similar to
Flask-MonitoringDashboard.
"""

from flask import Flask
import sqlite_opus as dashboard

# Create Flask app
app = Flask(__name__)

# Bind the dashboard to your Flask app
# The dashboard will be available at http://localhost:5000/sqlite-opus
# dashboard.bind(app)

# You can also customize the configuration:
# dashboard.config.url_prefix = "my-dashboard"  # Change URL prefix
# dashboard.config.max_query_results = 500      # Limit query results
# dashboard.config.db_path = "db.sqlite3"       # Pre-configure database path
# dashboard.bind(app, url_prefix="my-dashboard", max_query_results=500)

# Example with pre-configured database:
dashboard.config.db_path = "db.sqlite3"  # Database will auto-connect
dashboard.config.auth_user = "admin"
dashboard.config.auth_password = "password"
dashboard.config.allow_dml = True
dashboard.bind(app)

# Define your own routes
@app.route("/")
def home():
    return "Welcome to my Flask app! Visit /sqlite-opus for the dashboard."


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
