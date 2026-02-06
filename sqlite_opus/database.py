"""SQLite database connection and query management."""

import re
import sqlite3
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any


def _strip_limit_offset(query: str) -> str:
    """Remove trailing LIMIT and OFFSET clauses from a SQL query (case-insensitive)."""
    q = query.strip().rstrip(";").strip()
    # Remove LIMIT n and OFFSET n in either order (from the end)
    for _ in range(2):  # at most two clauses
        # Match OFFSET <digits> or LIMIT <digits> at end
        m = re.search(r"\s+(?:OFFSET\s+\d+|LIMIT\s+\d+)\s*$", q, re.IGNORECASE)
        if m:
            q = q[: m.start()].rstrip()
        else:
            break
    return q


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
        with self._lock:
            if self.connection:
                self.connection.close()
                self.connection = None
                self.current_db_path = None
    
    def execute_query(self, query: str) -> Dict[str, Any]:
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

    def execute_query_paginated(
        self,
        query: str,
        page: int = 1,
        per_page: int = 50,
        max_results: int = 10000,
    ) -> Dict[str, Any]:
        """Execute a SELECT query with pagination. Returns one page of results and pagination metadata."""
        if not self.connection:
            return {
                "success": False,
                "error": "No database connection",
                "results": [],
                "columns": [],
                "pagination": None,
            }
        q = query.strip().rstrip(";").strip()
        if not q.upper().startswith("SELECT"):
            return self.execute_query(query)

        page = max(1, page)
        per_page = max(1, min(per_page, max_results))

        with self._lock:
            try:
                cursor = self.connection.cursor()
                base_query = _strip_limit_offset(q)
                count_query = f"SELECT COUNT(*) FROM ({base_query}) AS _cnt"
                cursor.execute(count_query)
                total_count = cursor.fetchone()[0]

                offset = (page - 1) * per_page
                limit = per_page
                total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 0

                data_query = f"{base_query} LIMIT {limit} OFFSET {offset}"
                cursor.execute(data_query)
                results = [dict(row) for row in cursor.fetchall()]
                columns = [d[0] for d in (cursor.description or [])]

                pagination = {
                    "page": page,
                    "per_page": per_page,
                    "total_count": total_count,
                    "total_pages": total_pages,
                }

                return {
                    "success": True,
                    "results": results,
                    "columns": columns,
                    "rowcount": len(results),
                    "pagination": pagination,
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "results": [],
                    "columns": [],
                    "pagination": None,
                }

    def get_tables(self) -> List[str]:
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
        if not self.connection:
            return {"success": False, "error": "No database connection"}
        
        with self._lock:
            try:
                cursor = self.connection.cursor()
                cursor.execute(
                    "SELECT sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('table', 'view')",
                    (table_name,)
                )
                result = cursor.fetchone()
                if result:
                    return {
                        "success": True,
                        "schema": result[0]
                    }
                else:
                    return {"success": False, "error": "Table not found"}
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

    def _safe_table_identifier(self, table_name: str) -> Optional[str]:
        """Return table name if it is a safe SQL identifier (alphanumeric + underscore), else None."""
        if not table_name or not table_name.strip():
            return None
        s = table_name.strip()
        if not s.replace("_", "").isalnum():
            return None
        return s

    def get_all_columns(self, table_name: str) -> List[Dict[str, Any]]:
        """Return list of column info dicts for a table. Empty list on error."""
        if not self.connection:
            return []
        with self._lock:
            try:
                cursor = self.connection.cursor()
                # PRAGMA table_info(?) does not support bound params (SQLite limitation).
                # Try table-valued function first (SQLite 3.16+), then fallback to PRAGMA with safe identifier.
                try:
                    cursor.execute("SELECT * FROM pragma_table_info(?)", (table_name,))
                except sqlite3.OperationalError:
                    safe_name = self._safe_table_identifier(table_name)
                    if safe_name is None:
                        return []
                    cursor.execute(f'PRAGMA table_info("{safe_name}")')
                columns = []
                for row in cursor.fetchall():
                    columns.append({
                        "name": row[1],
                        "type": row[2],
                        "notnull": bool(row[3]),
                        "dflt_value": row[4],
                        "pk": bool(row[5]),
                    })
                return columns
            except Exception:
                return []

    def get_indexes(self, table_name: str) -> List[Dict[str, Any]]:
        """Return list of index info dicts for a table. Empty list on error."""
        if not self.connection:
            return []
        with self._lock:
            try:
                cursor = self.connection.cursor()
                try:
                    cursor.execute("SELECT * FROM pragma_index_list(?)", (table_name,))
                except sqlite3.OperationalError:
                    safe_name = self._safe_table_identifier(table_name)
                    if safe_name is None:
                        return []
                    cursor.execute(f'PRAGMA index_list("{safe_name}")')
                indexes = []
                for row in cursor.fetchall():
                    indexes.append({
                        "name": row[1],
                        "unique": bool(row[2]),
                        "origin": row[3] or "",
                    })
                return indexes
            except Exception:
                return []

    def is_connected(self) -> bool:
        """Check if database is connected."""
        return self.connection is not None
