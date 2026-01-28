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


def create_app(config=None):
    """
    Create and configure Flask application.
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        Flask application instance
    """
    app = Flask(__name__)
    
    # Enable CORS
    CORS(app)
    
    # Load configuration
    if config:
        app.config.update(config)
    else:
        app.config.from_object("sqlite_opus.config.DefaultConfig")
    
    # Initialize database manager
    app.sqlite_opus_db_manager = DatabaseManager()
    
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
    app.register_blueprint(bp, url_prefix="/sqlite-opus")
    
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
