'''
SPDX-License-Identifier: Apache-2.0

Copyright 2026 Eaton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

@File: db_config.py
@Description: Database configuration and connection management for EMS forecasting system.

@Created: 08 February 2026
@Last Modified: 01 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
'''


import os
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from contextlib import contextmanager

# Dotenv variables
from dotenv import load_dotenv
import os

load_dotenv('./../conf/.env')

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')


class DatabaseConfig:
    """Database configuration and connection pool management."""
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        database: str = None,
        user: str = None,
        password: str = None,
        min_conn: int = 1,
        max_conn: int = 10
    ):
        """
        Initialize database configuration.
        
        Args:
            host: Database host (default from env: DB_HOST or 'localhost')
            port: Database port (default from env: DB_PORT or 5432)
            database: Database name (default from env: DB_NAME or 'ems-db')
            user: Database user (default from env: DB_USER or 'postgres')
            password: Database password (default from env: DB_PASSWORD)
            min_conn: Minimum connections in pool
            max_conn: Maximum connections in pool
        """
        self.host = host or DB_HOST
        self.port = port or int(DB_PORT)
        self.database = database or DB_NAME
        self.user = user or DB_USER
        self.password = password or DB_PASSWORD
        
        self._pool: Optional[SimpleConnectionPool] = None
        self.min_conn = min_conn
        self.max_conn = max_conn
    
    def initialize_pool(self):
        """Initialize connection pool."""
        if self._pool is None:
            self._pool = SimpleConnectionPool(
                self.min_conn,
                self.max_conn,
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password
            )
    
    def close_pool(self):
        """Close all connections in pool."""
        if self._pool is not None:
            self._pool.closeall()
            self._pool = None
    
    @contextmanager
    def get_connection(self):
        """
        Get a connection from the pool as context manager.
        
        Yields:
            psycopg2.connection: Database connection
        """
        if self._pool is None:
            self.initialize_pool()
        
        conn = self._pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            self._pool.putconn(conn)
    
    @contextmanager
    def get_cursor(self, cursor_factory=RealDictCursor):
        """
        Get a cursor from a pooled connection.
        
        Args:
            cursor_factory: Type of cursor to create
            
        Yields:
            psycopg2.cursor: Database cursor
        """
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=cursor_factory)
            try:
                yield cursor
            finally:
                cursor.close()


# Global database instance (singleton pattern)
_db_instance: Optional[DatabaseConfig] = None


def get_db() -> DatabaseConfig:
    """Get or create the global database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseConfig()
    return _db_instance


def initialize_database(config: DatabaseConfig = None):
    """
    Initialize the database with the forecasting schema.
    
    Args:
        config: Database configuration (uses default if None)
    """
    if config is None:
        config = get_db()
    
    schema_file = os.path.join(os.path.dirname(__file__), 'schema_forecasts.sql')
    
    with open(schema_file, 'r') as f:
        schema_sql = f.read()
    
    with config.get_cursor() as cursor:
        cursor.execute(schema_sql)
    
    print("Database schema initialized successfully")


if __name__ == '__main__':
    # Test database connection
    db = get_db()
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"Connected to database: {version['version']}")
        
        # Initialize schema
        initialize_database(db)
        
    finally:
        db.close_pool()