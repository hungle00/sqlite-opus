"""Flask routes for SQLite Opus dashboard."""

from flask import Blueprint, render_template, request, jsonify, Flask

# Import config from main module (avoid circular import by importing inside bind())
from sqlite_opus import config


def register_routes(bp: Blueprint, app: Flask):
    """
    Register all routes with the blueprint.
    
    Args:
        bp: Blueprint instance to register routes with
        app: Flask application instance (for accessing database manager)
    """
    
    @bp.route("/")
    def index():
        """Render main dashboard page."""
        return render_template("index.html")
    
    @bp.route("/api/connect", methods=["POST"])
    def connect_database():
        """Connect to a SQLite database."""
        data = request.get_json()
        db_path = data.get("db_path")
        
        if not db_path:
            return jsonify({"success": False, "error": "Database path required"}), 400
        
        db_manager = app.sqlite_opus_db_manager
        success = db_manager.connect(db_path)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Connected successfully",
                "tables": db_manager.get_tables()
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to connect to database"
            }), 400
    
    @bp.route("/api/disconnect", methods=["POST"])
    def disconnect_database():
        """Disconnect from current database."""
        app.sqlite_opus_db_manager.disconnect()
        return jsonify({"success": True, "message": "Disconnected"})
    
    @bp.route("/api/status", methods=["GET"])
    def get_status():
        """Get current connection status."""
        db_manager = app.sqlite_opus_db_manager
        return jsonify({
            "connected": db_manager.is_connected(),
            "db_path": db_manager.current_db_path,
            "tables": db_manager.get_tables() if db_manager.is_connected() else []
        })
    
    @bp.route("/api/tables", methods=["GET"])
    def get_tables():
        """Get list of all tables."""
        db_manager = app.sqlite_opus_db_manager
        if not db_manager.is_connected():
            return jsonify({"success": False, "error": "Not connected"}), 400
        
        tables = db_manager.get_tables()
        return jsonify({"success": True, "tables": tables})
    
    @bp.route("/api/table/<table_name>/schema", methods=["GET"])
    def get_table_schema(table_name):
        """Get schema for a specific table."""
        db_manager = app.sqlite_opus_db_manager
        if not db_manager.is_connected():
            return jsonify({"success": False, "error": "Not connected"}), 400
        
        schema = db_manager.get_table_schema(table_name)
        return jsonify(schema)
    
    @bp.route("/api/query", methods=["POST"])
    def execute_query():
        """Execute a SQL query."""
        db_manager = app.sqlite_opus_db_manager
        if not db_manager.is_connected():
            return jsonify({"success": False, "error": "Not connected"}), 400
        
        data = request.get_json()
        query = data.get("query")
        
        if not query:
            return jsonify({"success": False, "error": "Query required"}), 400
        
        # Apply max results limit from config
        if query.strip().upper().startswith("SELECT"):
            # Add LIMIT clause if not present
            query_upper = query.upper()
            if "LIMIT" not in query_upper:
                # Simple check - in production, you'd want a proper SQL parser
                query = f"{query.rstrip(';')} LIMIT {config.max_query_results}"
        
        result = db_manager.execute_query(query)
        return jsonify(result)
