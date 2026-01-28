"""Configuration settings for SQLite Opus."""


class DefaultConfig:
    """Default configuration for Flask app."""
    
    SECRET_KEY = "dev-secret-key-change-in-production"
    DEBUG = True
    MAX_QUERY_RESULTS = 1000  # Limit number of rows returned
