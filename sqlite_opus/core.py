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
    
    def init_from(self, **kwargs):
        """
        Initialize configuration from keyword arguments.
        
        Args:
            **kwargs: Configuration options:
                - url_prefix: URL prefix for dashboard (default: "sqlite-opus")
                - max_query_results: Maximum number of query results (default: 1000)
                - enable_cors: Enable CORS support (default: True)
        """
        if "url_prefix" in kwargs:
            self.url_prefix = kwargs["url_prefix"]
        if "max_query_results" in kwargs:
            self.max_query_results = kwargs["max_query_results"]
        if "enable_cors" in kwargs:
            self.enable_cors = kwargs["enable_cors"]


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
