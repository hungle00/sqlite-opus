"""Core configuration and utilities for SQLite Opus."""

import os
from typing import Optional
from flask import Flask


class Config:
    """Configuration class for SQLite Opus dashboard."""
    
    def __init__(self):
        """Initialize configuration with default values."""
        self.app: Optional[Flask] = None
        self.url_prefix: str = "sqlite-opus"  # URL prefix for dashboard routes
        self.blueprint_name: str = "sqlite_opus"
        self.max_query_results: int = 1000
        self.enable_cors: bool = True
        self.db_path: Optional[str] = None  # Pre-configured database path
        self.auth_user: Optional[str] = None  # Basic Auth username (optional)
        self.auth_password: Optional[str] = None  # Basic Auth password (optional)
        self.allow_dml: bool = False  # If True, allow DML (INSERT/UPDATE/DELETE/...) in query API
    
    def init_from(self, **kwargs):
        """
        Initialize configuration from keyword arguments.
        
        Args:
            **kwargs: Configuration options:
                - url_prefix: URL prefix for dashboard (default: "sqlite-opus")
                - max_query_results: Maximum number of query results (default: 1000)
                - enable_cors: Enable CORS support (default: True)
                - db_path: Path to SQLite database file (default: None)
                - auth_user: Basic Auth username for index route (default: None)
                - auth_password: Basic Auth password for index route (default: None)
                - allow_dml: Allow DML queries in /api/query (default: False)
        """
        if "url_prefix" in kwargs:
            self.url_prefix = kwargs["url_prefix"]
        if "max_query_results" in kwargs:
            self.max_query_results = kwargs["max_query_results"]
        if "enable_cors" in kwargs:
            self.enable_cors = kwargs["enable_cors"]
        if "db_path" in kwargs:
            self.db_path = kwargs["db_path"]
        if "auth_user" in kwargs:
            self.auth_user = kwargs["auth_user"]
        if "auth_password" in kwargs:
            self.auth_password = kwargs["auth_password"]
        if "allow_dml" in kwargs:
            self.allow_dml = kwargs["allow_dml"]


def get_package_path() -> str:
    """
    Get the absolute path to the sqlite_opus package directory.
    
    Returns:
        Absolute path to sqlite_opus package
    """
    return os.path.abspath(os.path.dirname(__file__))


def get_templates_path() -> str:
    """
    Get the absolute path to templates directory.
    
    Returns:
        Absolute path to templates folder
    """
    return os.path.join(get_package_path(), "templates")


def get_static_path() -> str:
    """
    Get the absolute path to static directory.
    
    Returns:
        Absolute path to static folder
    """
    return os.path.join(get_package_path(), "static")
