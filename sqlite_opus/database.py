"""SQLite database connection and query management."""

import sqlite3
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any


class DatabaseManager:
    """Manages SQLite database connections and queries.
    
    Uses check_same_thread=False so the connection can be used from any
    Flask request thread. A lock is used for thread-safe access.
    """
    
    def __init__(self):
        """Initialize database manager."""
        self.current_db_path: Optional[str] = None
        self.connection: Optional[sqlite3.Connection] = None
        self._lock = threading.Lock()
    
    def connect(self, db_path: str) -> bool:
        """
        Connect to a SQLite database.
        
        Args:
            db_path: Path to SQLite database file
            
        Returns:
            True if connection successful, False otherwise
        """
        try:
            path = Path(db_path)
            if not path.exists():
                return False
            
            with self._lock:
                if self.connection:
                    self.connection.close()
                # check_same_thread=False allows use from any Flask request thread
                self.connection = sqlite3.connect(
                    db_path,
                    check_same_thread=False,
                )
                self.connection.row_factory = sqlite3.Row  # Return rows as dict-like objects
                self.current_db_path = db_path
            return True
        except Exception:
            return False
    
    def disconnect(self):
        """Close current database connection."""
        with self._lock:
            if self.connection:
                self.connection.close()
                self.connection = None
                self.current_db_path = None
    
    def execute_query(self, query: str) -> Dict[str, Any]:
        """
        Execute a SQL query.
        
        Args:
            query: SQL query string
            
        Returns:
            Dictionary with results, columns, and error info
        """
        if not self.connection:
            return {
                "success": False,
                "error": "No database connection",
                "results": [],
                "columns": []
            }
        
        with self._lock:
            try:
                cursor = self.connection.cursor()
                cursor.execute(query)
                
                # Check if query returns results
                if query.strip().upper().startswith("SELECT"):
                    results = [dict(row) for row in cursor.fetchall()]
                    columns = [description[0] for description in cursor.description] if cursor.description else []
                else:
                    # For INSERT, UPDATE, DELETE
                    self.connection.commit()
                    results = []
                    columns = []
                
                return {
                    "success": True,
                    "results": results,
                    "columns": columns,
                    "rowcount": cursor.rowcount
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "results": [],
                    "columns": []
                }
    
    def get_tables(self) -> List[str]:
        """
        Get list of all tables in the database.
        
        Returns:
            List of table names
        """
        if not self.connection:
            return []
        
        with self._lock:
            try:
                cursor = self.connection.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
                )
                return [row[0] for row in cursor.fetchall()]
            except Exception:
                return []
    
    def get_table_schema(self, table_name: str) -> Dict[str, Any]:
        """
        Get schema information for a table.
        
        Args:
            table_name: Name of the table
            
        Returns:
            Dictionary with schema information
        """
        if not self.connection:
            return {"success": False, "error": "No database connection"}
        
        with self._lock:
            try:
                cursor = self.connection.cursor()
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [dict(row) for row in cursor.fetchall()]
                
                return {
                    "success": True,
                    "columns": columns
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }
    
    def is_connected(self) -> bool:
        """Check if database is connected."""
        return self.connection is not None
