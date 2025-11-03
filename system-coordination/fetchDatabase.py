'''
SPDX-License-Identifier: Apache-2.0

Copyright 2025 Eaton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and

File: fetchDatabase.py
Description: This script connects to PostgreSQL and queries average values for the most recent 15-minute interval, and also provides methods to get the most recent individual values.

Created: 1st July 2025
Last Modified: 30th October 2025
Version: v1.0.0
'''


import psycopg2
import pandas as pd
from datetime import datetime
import sys


class LastIntervalQuerier:
    def __init__(self, host: str, database: str, user: str, password: str, port: int = 5432):
        """Initialize database connection parameters."""
        self.connection_params = {
            'host': host,
            'database': database,
            'user': user,
            'password': password,
            'port': port
        }
        self.connection = None

    def connect(self) -> bool:
        """Establish database connection."""
        try:
            self.connection = psycopg2.connect(**self.connection_params)
            return True
        except psycopg2.Error as e:
            print(f"Error connecting to database: {e}")
            return False

    def disconnect(self):
        """Close database connection."""
        if self.connection:
            self.connection.close()

    def get_last_15min_averages(self, table_name: str = "measurements", 
                          max_age_minutes: int = 20,
                          timezone: str = None) -> pd.DataFrame:
        """
        Query average values for the most recent 15-minute interval with freshness check.

        Args:
            table_name: Name of the measurements table
            max_age_minutes: Maximum age in minutes for data to be considered fresh (default: 20)
            timezone: Timezone for comparison (e.g., 'UTC', 'Europe/Amsterdam'). 
                    If None, uses naive datetime comparison

        Returns:
            pandas.DataFrame with parameter averages for the last 15-minute interval
            Returns empty DataFrame if data is too old or if no data found
        """
        if not self.connection:
            print("No database connection. Connect first.")
            return pd.DataFrame()

        query = f"""
        WITH latest_interval AS (
            -- Find the most recent 15-minute bucket that has data
            SELECT 
                DATE_TRUNC('hour', MAX(time)) + 
                INTERVAL '15 min' * FLOOR(EXTRACT(MINUTE FROM MAX(time)) / 15) as interval_start
            FROM {table_name}
        ),
        interval_bounds AS (
            SELECT 
                interval_start,
                interval_start + INTERVAL '15 minutes' as interval_end
            FROM latest_interval
        )
        SELECT 
            parameter,
            ROUND(AVG(value)::numeric, 4) as average_value,
            unit,
            COUNT(*) as sample_count,
            MIN(ib.interval_start) as interval_start,
            MIN(ib.interval_end) as interval_end
        FROM {table_name} m
        CROSS JOIN interval_bounds ib
        WHERE m.time >= ib.interval_start 
        AND m.time < ib.interval_end
        AND quality = 'ok'
        GROUP BY parameter, unit
        ORDER BY parameter;
        """

        try:
            df = pd.read_sql_query(query, self.connection)
            
            if df.empty:
                print("No data found for the last 15-minute interval")
                return pd.DataFrame()
            
            # Get the interval end time for freshness check
            interval_end = df.iloc[0]['interval_end']
            interval_start = df.iloc[0]['interval_start']
            
            # Perform freshness check
            current_time = datetime.now()
            if timezone:
                # Handle timezone-aware comparison
                import pytz
                tz = pytz.timezone(timezone)
                current_time = current_time.replace(tzinfo=tz)
                # Ensure interval_end is timezone-aware for comparison
                if interval_end.tzinfo is None:
                    interval_end = tz.localize(interval_end)
            
            # Calculate age of the data
            data_age = current_time - interval_end
            age_minutes = data_age.total_seconds() / 60
            
            print(f"Last 15-minute interval: {interval_start} to {interval_end}")
            print(f"Data age: {age_minutes:.1f} minutes")
            
            # Check if data is fresh enough
            if age_minutes > max_age_minutes:
                print(f"WARNING: Data is too old ({age_minutes:.1f} minutes > {max_age_minutes} minutes threshold)")
                print("Returning empty DataFrame - consider checking your data fetching module")
                return pd.DataFrame()
            
            print(f"Data is fresh (within {max_age_minutes} minutes)")
            print(f"Retrieved averages for {len(df)} parameters")
            return df
            
        except Exception as e:
            print(f"Error executing query: {e}")
            return pd.DataFrame()

    def get_most_recent_values(self, table_name: str = "measurements",
                             max_age_minutes: int = 2,
                             timezone: str = None,
                             parameters: list = None) -> pd.DataFrame:
        """
        Query the most recent value for each parameter with freshness check.

        Args:
            table_name: Name of the measurements table
            max_age_minutes: Maximum age in minutes for data to be considered fresh (default: 20)
            timezone: Timezone for comparison (e.g., 'UTC', 'Europe/Amsterdam'). 
                    If None, uses naive datetime comparison
            parameters: List of specific parameters to fetch. If None, fetches all parameters

        Returns:
            pandas.DataFrame with the most recent value for each parameter
            Returns empty DataFrame if data is too old or if no data found
        """
        if not self.connection:
            print("No database connection. Connect first.")
            return pd.DataFrame()

        # Build parameter filter if specified
        parameter_filter = ""
        if parameters:
            parameter_list = "', '".join(parameters)
            parameter_filter = f"AND parameter IN ('{parameter_list}')"

        query = f"""
        WITH ranked_measurements AS (
            SELECT 
                parameter,
                value,
                unit,
                time,
                ROW_NUMBER() OVER (PARTITION BY parameter ORDER BY time DESC) as rn
            FROM {table_name}
            WHERE quality = 'ok'
            {parameter_filter}
        )
        SELECT 
            parameter,
            ROUND(value::numeric, 4) as latest_value,
            unit,
            time as measurement_time
        FROM ranked_measurements
        WHERE rn = 1
        ORDER BY parameter;
        """

        try:
            df = pd.read_sql_query(query, self.connection)
            
            if df.empty:
                print("No recent data found")
                return pd.DataFrame()
            
            # Get the most recent timestamp among the most recent values for freshness check
            most_recent_time = df['measurement_time'].max()
            
            # Perform freshness check
            current_time = datetime.now()
            if timezone:
                # Handle timezone-aware comparison
                import pytz
                tz = pytz.timezone(timezone)
                current_time = current_time.replace(tzinfo=tz)
                # Ensure measurement time is timezone-aware for comparison
                if most_recent_time.tzinfo is None:
                    most_recent_time = tz.localize(most_recent_time)
            
            # Calculate age of the oldest recent data
            data_age = current_time - most_recent_time
            age_minutes = data_age.total_seconds() / 60
            
            print(f"Most recent measurements time range: {df['measurement_time'].min()} to {df['measurement_time'].max()}")
            print(f"Oldest recent data age: {age_minutes:.1f} minutes")
            
            # Check if data is fresh enough
            if age_minutes > max_age_minutes:
                print(f"WARNING: Data is too old ({age_minutes:.1f} minutes > {max_age_minutes} minutes threshold)")
                print("Returning empty DataFrame - consider checking your data fetching module")
                return pd.DataFrame()
            
            print(f"Data is fresh (within {max_age_minutes} minutes)")
            print(f"Retrieved most recent values for {len(df)} parameters")
            return df
            
        except Exception as e:
            print(f"Error executing query: {e}")
            return pd.DataFrame()

    def get_simple_averages(self, table_name: str = "measurements") -> dict:
        """
        Get a simple dictionary of parameter: average_value for the last 15-minute interval.

        Returns:
            Dictionary with parameter names as keys and average values as values
        """
        df = self.get_last_15min_averages(table_name)
        if df.empty:
            return {}

        return dict(zip(df['parameter'], df['average_value']))

    def get_simple_recent_values(self, table_name: str = "measurements", parameters: list = None) -> dict:
        """
        Get a simple dictionary of parameter: latest_value for the most recent measurements.

        Args:
            table_name: Name of the measurements table
            parameters: List of specific parameters to fetch. If None, fetches all parameters

        Returns:
            Dictionary with parameter names as keys and latest values as values
        """
        df = self.get_most_recent_values(table_name, parameters=parameters)
        if df.empty:
            return {}

        return dict(zip(df['parameter'], df['latest_value']))


def main():
    DB_CONFIG = {
        'host': 'localhost',
        'database': 'ems-db',
        'user': 'postgres',
        'password': 'erl-ems-db-shift2dc',
        'port': 5432
    }

    # Initialize querier
    querier = LastIntervalQuerier(**DB_CONFIG)

    if not querier.connect():
        sys.exit(1)

    try:
        # Get detailed DataFrame for 15-minute averages
        print("=== 15-Minute Averages ===")
        df_avg = querier.get_last_15min_averages()

        if not df_avg.empty:
            for _, row in df_avg.iterrows():
                print(f"{row['parameter']}: {row['average_value']} {row['unit']} "
                      f"(from {row['sample_count']} samples)")

            print(f"\nDataFrame shape: {df_avg.shape}")

        # Get most recent values
        print("\n=== Most Recent Values ===")
        df_recent = querier.get_most_recent_values()

        if not df_recent.empty:
            for _, row in df_recent.iterrows():
                print(f"{row['parameter']}: {row['latest_value']} {row['unit']} "
                      f"(at {row['measurement_time']})")

            print(f"\nDataFrame shape: {df_recent.shape}")

        # Get simple dictionary formats
        print("\n=== Simple Dictionary Formats ===")
        averages_dict = querier.get_simple_averages()
        recent_dict = querier.get_simple_recent_values()
        
        print("15-minute averages:")
        for param, avg_val in averages_dict.items():
            print(f"  {param}: {avg_val}")
            
        print("\nMost recent values:")
        for param, recent_val in recent_dict.items():
            print(f"  {param}: {recent_val}")

        # Example: Get recent values for specific parameters only
        print("\n=== Specific Parameters (Recent Values) ===")
        specific_params = ['temperature', 'pressure']  # Example parameter names
        specific_recent = querier.get_simple_recent_values(parameters=specific_params)
        for param, val in specific_recent.items():
            print(f"  {param}: {val}")

    except Exception as e:
        print(f"Error in main execution: {e}")

    finally:
        querier.disconnect()


# Quick usage functions
def get_last_15min_data(host, database, user, password, port=5432, table_name="measurements"):
    """
    Quick function to get last 15-minute averages.

    Returns:
        Dictionary with parameter: average_value pairs
    """
    querier = LastIntervalQuerier(host, database, user, password, port)
    if querier.connect():
        try:
            return querier.get_simple_averages(table_name)
        finally:
            querier.disconnect()
    return {}


def get_most_recent_data(host, database, user, password, port=5432, table_name="measurements", parameters=None):
    """
    Quick function to get most recent values.

    Args:
        host, database, user, password, port: Database connection parameters
        table_name: Name of the measurements table
        parameters: List of specific parameters to fetch. If None, fetches all parameters

    Returns:
        Dictionary with parameter: latest_value pairs
    """
    querier = LastIntervalQuerier(host, database, user, password, port)
    if querier.connect():
        try:
            return querier.get_simple_recent_values(table_name, parameters)
        finally:
            querier.disconnect()
    return {}


if __name__ == "__main__":
    main()