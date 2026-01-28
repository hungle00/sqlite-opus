"""SQLite Opus - A Flask-based web dashboard for SQLite database query and management.

To bind the dashboard to your Flask app, use:

>>> import sqlite_opus as dashboard
>>> from flask import Flask
>>> app = Flask(__name__)
>>> dashboard.bind(app)

The dashboard will be available at:
    http://localhost:5000/sqlite-opus
"""

from flask import Blueprint

from sqlite_opus.core import Config, get_templates_path, get_static_path
from sqlite_opus.database import DatabaseManager

__version__ = "0.1.0"

# Module-level configuration
config = Config()

# Module-level blueprint
blueprint = Blueprint(
    config.blueprint_name,
    __name__,
    template_folder=get_templates_path(),
    static_folder=get_static_path(),
    static_url_path="/sqlite_opus/static"
)


def bind(app, url_prefix: str = None, enable_cors: bool = True, max_query_results: int = 1000):
    """
    Bind SQLite Opus dashboard to a Flask application.
    
    This function should be called after creating your Flask app but before
    running it. It will register all dashboard routes and initialize the
    database manager.
    
    Args:
        app: Flask application instance to bind the dashboard to
        url_prefix: URL prefix for dashboard routes (default: "sqlite-opus")
        enable_cors: Enable CORS support (default: True)
        max_query_results: Maximum number of query results to return (default: 1000)
    
    Example:
        >>> from flask import Flask
        >>> import sqlite_opus as dashboard
        >>> app = Flask(__name__)
        >>> dashboard.bind(app)
        >>> app.run()
    """
    # Store app reference in config
    config.app = app
    
    # Update configuration
    if url_prefix is not None:
        config.url_prefix = url_prefix
    config.enable_cors = enable_cors
    config.max_query_results = max_query_results
    
    # Initialize database manager and attach to app
    if not hasattr(app, "sqlite_opus_db_manager"):
        app.sqlite_opus_db_manager = DatabaseManager()
    
    # Enable CORS if requested
    if enable_cors:
        try:
            from flask_cors import CORS
            CORS(app)
        except ImportError:
            pass  # Flask-CORS not installed, skip
    
    # Import and register routes
    # This must be done here to avoid circular imports
    from sqlite_opus.routes import register_routes
    register_routes(blueprint, app)
    
    # Register blueprint with the app
    app.register_blueprint(blueprint, url_prefix=f"/{config.url_prefix}")


__all__ = ["bind", "config", "blueprint", "__version__"]
