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

@File: database.py
@Description: Database connection and configuration module for EMS metrics system.

@Created: 11 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional

# Dotenv variables
from dotenv import load_dotenv
import os

load_dotenv('./../web-app/backend/.env')

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')

class DatabaseConfig:
    """Database configuration settings."""
    
    def __init__(self):
        self.host = DB_HOST
        self.port = DB_PORT
        self.database = DB_NAME
        self.user = DB_USER
        self.password = DB_PASSWORD
    
    def get_connection_string(self) -> str:
        """Get PostgreSQL connection string."""
        return f"host={self.host} port={self.port} dbname={self.database} user={self.user} password={self.password}"


class DatabaseConnection:
    """Manage database connections and queries."""
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        self.config = config or DatabaseConfig()
        self._connection = None
    
    def connect(self):
        """Establish database connection."""
        if self._connection is None or self._connection.closed:
            self._connection = psycopg2.connect(
                self.config.get_connection_string(),
                cursor_factory=RealDictCursor
            )
        return self._connection
    
    def close(self):
        """Close database connection."""
        if self._connection and not self._connection.closed:
            self._connection.close()
            self._connection = None
    
    @contextmanager
    def get_cursor(self):
        """Context manager for database cursor."""
        conn = self.connect()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
    
    def execute_query(self, query: str, params: tuple = None):
        """Execute a query and return results."""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            if cursor.description:  # SELECT query
                return cursor.fetchall()
            return None
    
    def execute_many(self, query: str, params_list: list):
        """Execute many queries with different parameters."""
        with self.get_cursor() as cursor:
            cursor.executemany(query, params_list)