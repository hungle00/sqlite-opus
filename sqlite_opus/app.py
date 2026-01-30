"""Flask application factory for SQLite Opus dashboard.

Note: This is the old way of using SQLite Opus. The recommended way is to use
the library pattern with bind():

    from flask import Flask
    import sqlite_opus as dashboard
    app = Flask(__name__)
    dashboard.bind(app)
"""

from flask import Flask, Blueprint
from flask_cors import CORS

from sqlite_opus.database import DatabaseManager
from sqlite_opus.routes import register_routes
from sqlite_opus.core import get_templates_path, get_static_path
from sqlite_opus import config


def create_app(app_config=None):
    """
    Create and configure Flask application.
    
    Args:
        app_config: Optional Flask configuration dictionary
        
    Returns:
        Flask application instance
    """
    app = Flask(__name__)
    
    # Enable CORS
    CORS(app)
    
    # Load Flask configuration
    if app_config:
        app.config.update(app_config)
    else:
        app.config.from_object("sqlite_opus.config.DefaultConfig")
    
    # Set db_path for testing (can be set before calling create_app())
    # Example: config.db_path = "test.db" before calling create_app()
    # Or uncomment the line below to test with a specific database:
    config.db_path = "db.sqlite3"  # or any path to your SQLite database
    
    # Initialize database manager
    app.sqlite_opus_db_manager = DatabaseManager()
    
    # Auto-connect to database if db_path is configured
    if config.db_path:
        db_manager = app.sqlite_opus_db_manager
        success = db_manager.connect(config.db_path)
        if not success:
            import warnings
            warnings.warn(
                f"Failed to auto-connect to database at '{config.db_path}'. "
                "Please check the path and try connecting manually.",
                UserWarning
            )
    
    # Create blueprint and register routes
    bp = Blueprint(
        "sqlite_opus",
        __name__,
        template_folder=get_templates_path(),
        static_folder=get_static_path(),
        static_url_path="/sqlite_opus/static"
    )
    register_routes(bp, app)
    
    # Register blueprint
    app.register_blueprint(bp, url_prefix="/")
    
    return app


if __name__ == "__main__":
    # For testing: set db_path before creating app to auto-connect
    # Uncomment the line below and set your database path:
    # config.db_path = "db.sqlite3"
    
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
