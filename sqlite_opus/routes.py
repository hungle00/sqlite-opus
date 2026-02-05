"""Flask routes for SQLite Opus dashboard."""

import re
from functools import wraps
from flask import Blueprint, render_template, request, jsonify, Flask, Response

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
    @basic_auth_required
    def index():
        """Render main dashboard page."""
        # Pass config info to template (blueprint_name for correct static file URLs)
        has_preconfigured_db = config.db_path is not None
        tables = []
        if has_preconfigured_db and app.sqlite_opus_db_manager.is_connected():
            tables = app.sqlite_opus_db_manager.get_tables()
        return render_template(
            "sqlite_opus/index.html",
            has_preconfigured_db=has_preconfigured_db,
            db_path=config.db_path if has_preconfigured_db else None,
            blueprint_name=config.blueprint_name,
            tables=tables,
        )
    
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
    
    @bp.route("/api/table/<table_name>", methods=["GET"])
    def get_table_info(table_name):
        """Get schema, columns, and indexes for a specific table (single hash)."""
        db_manager = app.sqlite_opus_db_manager
        if not db_manager.is_connected():
            return jsonify({"success": False, "error": "Not connected"}), 400
        
        info = db_manager.get_table_info(table_name)
        if not info.get("success"):
            return jsonify(info), 404
        return jsonify(info)
    
    def get_query_result(query, page=None, per_page=None):
        """Run query and return result dict for the partial template."""
        db_manager = app.sqlite_opus_db_manager
        if not db_manager.is_connected():
            return {"success": False, "error": "Not connected"}
        if not query:
            return {"success": False, "error": "Query required"}
        if contains_dml(query) and not config.allow_dml:
            return {
                "success": False,
                "error": "DML queries (INSERT/UPDATE/DELETE/CREATE/TRUNCATE/REPLACE) are not allowed. Set config.allow_dml = True to enable."
            }
        use_pagination = (
            query.strip().upper().startswith("SELECT")
            and page is not None
            and isinstance(page, int)
            and page >= 1
        )
        if use_pagination:
            if per_page is None or not isinstance(per_page, int) or per_page < 1:
                per_page = getattr(config, "query_results_per_page", 50)
            per_page = min(per_page, config.max_query_results)
            return db_manager.execute_query_paginated(
                query,
                page=page,
                per_page=per_page,
                max_results=config.max_query_results,
            )
        if query.strip().upper().startswith("SELECT"):
            query_upper = query.upper()
            if "LIMIT" not in query_upper:
                query = f"{query.rstrip(';')} LIMIT {config.max_query_results}"
        return db_manager.execute_query(query)

    @bp.route("/api/query/", methods=["POST"])
    def execute_query():
        """Execute a SQL query and return HTML partial (results table + pagination)."""
        data = request.get_json() or {}
        query = (data.get("query") or "").strip()
        if not query:
            return render_template(
                "sqlite_opus/partials/query_results.html",
                success=False,
                error="Query required",
                results=[],
                columns=[],
                pagination=None,
            ), 400
        page = 1
        try:
            p = data.get("page")
            if p is not None:
                page = int(p)
        except (TypeError, ValueError):
            pass
        per_page = getattr(config, "query_results_per_page", 50)
        try:
            pp = data.get("per_page")
            if pp is not None:
                per_page = int(pp)
        except (TypeError, ValueError):
            pass
        result = get_query_result(query, page=page, per_page=per_page)
        pagination = result.get("pagination")
        page_numbers = []
        if pagination and pagination.get("total_pages", 0) > 1:
            pn = pagination.get("page", 1)
            total_pages = pagination.get("total_pages", 0)
            show = sorted({1, total_pages} | set(range(max(1, pn - 2), min(total_pages, pn + 2) + 1)))
            page_numbers = show
        return render_template(
            "sqlite_opus/partials/query_results.html",
            success=result.get("success"),
            error=result.get("error"),
            results=result.get("results", []),
            columns=result.get("columns", []),
            pagination=pagination,
            page_numbers=page_numbers,
        )

def basic_auth_required(f):
    """Require HTTP Basic Auth if config.auth_user and config.auth_password are set."""
    @wraps(f)
    def decorated(*args, **kwargs):
        username = config.auth_user or ''
        password = config.auth_password or ''
        if not username and not password:
            return f(*args, **kwargs)
        auth = request.authorization
        if not auth or auth.username != username or auth.password != password:
            return Response(
                'Login required',
                401,
                {'WWW-Authenticate': 'Basic realm="Auth Required"'}
            )
        return f(*args, **kwargs)
    return decorated

def contains_dml(query: str) -> bool:
    """Return True if the query appears to be DML or DDL (write operations)."""
    query_upper = query.strip().upper()
    dml_patterns = [
        r"\bINSERT\s+INTO\b",
        r"\bUPDATE\s+\w",
        r"\bDELETE\s+FROM\b",
        r"\bCREATE\s+",
        r"\bTRUNCATE\s+",
        r"\bREPLACE\s+INTO\b",
        r"\bDROP\s+",
        r"\bALTER\s+",
    ]
    return any(re.search(p, query_upper) for p in dml_patterns)
