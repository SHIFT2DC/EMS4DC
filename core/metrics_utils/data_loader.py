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

@File: data_loader.py
@Description: Data loader module for fetching measurements from database.

@Created: 11 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
'''


import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple
from metrics_utils.database import DatabaseConnection


class MeasurementLoader:
    """Load and process measurements from database."""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
    
    def get_active_assets(self) -> pd.DataFrame:
        """Get all active assets from the database."""
        query = """
        SELECT id, asset_key, name, type, is_active, created_at, updated_at
        FROM assets
        WHERE is_active = true
        ORDER BY asset_key
        """
        results = self.db.execute_query(query)
        return pd.DataFrame(results)
    
    def get_measurements(
        self,
        start_time: datetime,
        end_time: datetime,
        asset_keys: Optional[List[str]] = None,
        parameters: Optional[List[str]] = None,
        quality_filter: str = 'ok'
    ) -> pd.DataFrame:
        """
        Fetch measurements for a time period.
        
        Args:
            start_time: Start of time period
            end_time: End of time period
            asset_keys: List of asset keys to filter (None = all)
            parameters: List of parameter names to filter (None = all)
            quality_filter: Quality status to filter ('ok', 'error', None for all)
        
        Returns:
            DataFrame with measurements
        """
        query = """
        SELECT 
            id, measurement_id, time, parameter, value, unit, quality, asset_key
        FROM measurements
        WHERE time >= %s AND time <= %s
        """
        params = [start_time, end_time]
        
        if asset_keys:
            placeholders = ','.join(['%s'] * len(asset_keys))
            query += f" AND asset_key IN ({placeholders})"
            params.extend(asset_keys)
        
        if parameters:
            placeholders = ','.join(['%s'] * len(parameters))
            query += f" AND parameter IN ({placeholders})"
            params.extend(parameters)
        
        if quality_filter:
            query += " AND quality = %s"
            params.append(quality_filter)
        
        query += " ORDER BY time, asset_key, parameter"
        
        results = self.db.execute_query(query, tuple(params))
        df = pd.DataFrame(results)
        
        if not df.empty:
            df['time'] = pd.to_datetime(df['time'])
            df['value'] = pd.to_numeric(df['value'], errors='coerce')
        
        return df
    
    def get_power_measurements(
        self,
        start_time: datetime,
        end_time: datetime,
        asset_keys: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Get power measurements for assets.
        Power parameters end with '_POWER' in the parameter name.
        """
        df = self.get_measurements(start_time, end_time, asset_keys)
        if df.empty:
            return df
        
        # Filter for POWER parameters
        power_df = df[df['parameter'].str.endswith('_POWER')].copy()
        return power_df
    
    def get_parameter_by_asset(
        self,
        start_time: datetime,
        end_time: datetime,
        parameter_suffix: str,
        asset_keys: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Get specific parameter for multiple assets.
        
        Args:
            start_time: Start time
            end_time: End time
            parameter_suffix: Parameter suffix (e.g., 'POWER', 'SoC')
            asset_keys: List of asset keys
        
        Returns:
            DataFrame with time index and columns for each asset
        """
        df = self.get_measurements(start_time, end_time, asset_keys)
        if df.empty:
            return pd.DataFrame()
        
        # Filter for the specific parameter
        param_df = df[df['parameter'].str.endswith(f'_{parameter_suffix}')].copy()
        
        if param_df.empty:
            return pd.DataFrame()
        
        # Pivot to get time series for each asset
        pivot_df = param_df.pivot_table(
            index='time',
            columns='asset_key',
            values='value',
            aggfunc='mean'  # Handle duplicates
        )
        
        return pivot_df
    
    def resample_measurements(
        self,
        df: pd.DataFrame,
        freq: str = '1min',
        method: str = 'interpolate'
    ) -> pd.DataFrame:
        """
        Resample irregular measurements to regular intervals.
        
        Args:
            df: DataFrame with time index
            freq: Resampling frequency (e.g., '1min', '5min', '1H')
            method: Resampling method ('interpolate', 'forward_fill', 'mean')
        
        Returns:
            Resampled DataFrame
        """
        if df.empty or 'time' not in df.columns:
            return df
        
        # Set time as index if not already
        if df.index.name != 'time':
            df = df.set_index('time')
        
        if method == 'interpolate':
            return df.resample(freq).interpolate(method='time', limit=6)
        elif method == 'forward_fill':
            return df.resample(freq).ffill(limit=6)
        elif method == 'mean':
            return df.resample(freq).mean()
        else:
            return df.resample(freq).mean()
    
    def integrate_power_to_energy(
        self,
        power_df: pd.DataFrame,
        time_col: str = 'time'
    ) -> pd.DataFrame:
        """
        Integrate power (W) over time to get energy (Wh).
        Uses trapezoidal integration.
        
        Args:
            power_df: DataFrame with power values and time
            time_col: Name of time column
        
        Returns:
            DataFrame with cumulative energy
        """
        if power_df.empty:
            return pd.DataFrame()
        
        df = power_df.copy()
        
        # Ensure time is datetime and sorted
        if time_col in df.columns:
            df[time_col] = pd.to_datetime(df[time_col])
            df = df.sort_values(time_col)
        
        # Calculate time differences in hours
        time_diff = df[time_col].diff().dt.total_seconds() / 3600.0
        
        # For each power column, integrate
        energy_cols = {}
        for col in df.columns:
            if col != time_col and df[col].dtype in ['float64', 'int64']:
                # Trapezoidal integration: (P1 + P2) / 2 * dt
                avg_power = (df[col] + df[col].shift(1)) / 2
                energy_increment = avg_power * time_diff
                energy_cols[f'{col}_energy'] = energy_increment.fillna(0).cumsum()
        
        result = df[[time_col]].copy()
        for col, values in energy_cols.items():
            result[col] = values
        
        return result
    
    def get_data_quality_stats(
        self,
        start_time: datetime,
        end_time: datetime,
        asset_keys: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Get data quality statistics for a time period.
        
        Returns:
            Dictionary with quality metrics
        """
        df = self.get_measurements(
            start_time, end_time, asset_keys, quality_filter=None
        )
        
        if df.empty:
            return {
                'total_points': 0,
                'ok_points': 0,
                'error_points': 0,
                'quality_percentage': 0.0
            }
        
        total = len(df)
        ok_points = len(df[df['quality'] == 'ok'])
        error_points = total - ok_points
        
        return {
            'total_points': total,
            'ok_points': ok_points,
            'error_points': error_points,
            'quality_percentage': (ok_points / total * 100) if total > 0 else 0.0,
            'by_asset': df.groupby('asset_key')['quality'].value_counts().to_dict()
        }