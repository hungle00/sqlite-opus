"""Example: SQLite Opus dashboard with FastAPI
Mount Flask app inside FastAPI

Run: uvicorn example_fastapi_usage:app --reload --host 0.0.0.0 --port 8000
"""

from flask import Flask
import sqlite_opus as dashboard
from fastapi import FastAPI
from starlette.middleware.wsgi import WSGIMiddleware

# --- 1. Create Flask app and bind dashboard (same as example_usage.py) ---
# Avoid calling bind() twice: when running "python example_fastapi_usage.py", uvicorn
# re-imports the module to get "app" -> blueprint is already registered but register_routes
# runs again -> AssertionError. If an app is already bound (config.app), reuse it.
if getattr(dashboard.config, "app", None) is not None and isinstance(dashboard.config.app, Flask):
    flask_app = dashboard.config.app
else:
    flask_app = Flask(__name__)
    dashboard.bind(
        flask_app,
        db_path="db.sqlite3",
        auth_user="admin",
        auth_password="password",
        allow_dml=True,
    )

    @flask_app.route("/")
    def flask_home():
        # When mounted at /app, links must use /app/sqlite-opus (full path on FastAPI)
        return "Flask app: Hello! Go to <a href='/app/sqlite-opus'>/app/sqlite-opus</a> for the dashboard."


# --- 2. Create FastAPI app and mount Flask ---
app = FastAPI(
    title="SQLite Opus + FastAPI",
    description="Example: Flask app (with SQLite Opus) mounted inside FastAPI",
)


@app.get("/")
def fastapi_root():
    return {
        "message": "FastAPI app. Visit /app/ for Flask, /app/sqlite-opus for the dashboard.",
        "links": {
            "flask_app": "/app/",
            "sqlite_opus_dashboard": "/app/sqlite-opus",
            "docs": "/docs",
        },
    }


# Mount Flask app at /app (must mount after defining FastAPI routes)
app.mount("/app", WSGIMiddleware(flask_app))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("fastapi_usage:app", host="0.0.0.0", port=8000, reload=True)
