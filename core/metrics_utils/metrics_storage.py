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

@File: metrics_storage.py
@Description: Metrics storage module for persisting calculated metrics to database.

@Created: 11 February 2026
@Last Modified: 05 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional
from metrics_utils.database import DatabaseConnection
from utils.time_utils import current_time


class MetricsStorage:
    """Store calculated metrics in database."""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
        self._ensure_tables_exist()
    
    def _ensure_tables_exist(self):
        """Create metrics tables if they don't exist."""
        
        # Main metrics summary table
        create_summary_table = """
        CREATE TABLE IF NOT EXISTS metrics_summary (
            id SERIAL PRIMARY KEY,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL,
            calculation_time TIMESTAMP NOT NULL,
            metric_category VARCHAR(50) NOT NULL,
            metrics_json JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(period_start, period_end, metric_category)
        );
        
        CREATE INDEX IF NOT EXISTS idx_metrics_summary_period 
        ON metrics_summary(period_start, period_end);
        
        CREATE INDEX IF NOT EXISTS idx_metrics_summary_category 
        ON metrics_summary(metric_category);
        """
        
        # Asset-specific metrics table
        create_asset_metrics_table = """
        CREATE TABLE IF NOT EXISTS asset_metrics (
            id SERIAL PRIMARY KEY,
            period_start TIMESTAMP NOT NULL,
            period_end TIMESTAMP NOT NULL,
            asset_key VARCHAR(50) NOT NULL,
            asset_type VARCHAR(50) NOT NULL,
            metric_name VARCHAR(100) NOT NULL,
            metric_value DOUBLE PRECISION,
            metric_unit VARCHAR(20),
            calculation_time TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(period_start, period_end, asset_key, metric_name)
        );
        
        CREATE INDEX IF NOT EXISTS idx_asset_metrics_period 
        ON asset_metrics(period_start, period_end);
        
        CREATE INDEX IF NOT EXISTS idx_asset_metrics_asset 
        ON asset_metrics(asset_key);
        """
        
        # Time-series aggregated metrics
        create_timeseries_table = """
        CREATE TABLE IF NOT EXISTS metrics_timeseries (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            asset_key VARCHAR(50),
            parameter VARCHAR(100) NOT NULL,
            aggregated_value DOUBLE PRECISION,
            aggregation_type VARCHAR(20) NOT NULL,
            aggregation_interval VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(timestamp, asset_key, parameter, aggregation_type, aggregation_interval)
        );
        
        CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_timestamp 
        ON metrics_timeseries(timestamp);
        
        CREATE INDEX IF NOT EXISTS idx_metrics_timeseries_asset_param 
        ON metrics_timeseries(asset_key, parameter);
        """
        
        try:
            self.db.execute_query(create_summary_table)
            self.db.execute_query(create_asset_metrics_table)
            self.db.execute_query(create_timeseries_table)
        except Exception as e:
            print(f"Warning: Could not create tables: {e}")
    
    def store_energy_flow_metrics(
        self,
        metrics: Dict,
        period_start: datetime,
        period_end: datetime
    ):
        """Store energy flow metrics."""
        
        # Store main summary
        self._store_metrics_summary(
            period_start,
            period_end,
            'energy_flow',
            metrics
        )
        
        # Store grid metrics as individual records
        if 'grid' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'GRID',
                metrics['grid'], 'grid_'
            )
        
        # Store renewable metrics
        if 'renewable' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'RENEWABLE',
                metrics['renewable'], 'renewable_'
            )
        
        # Store load metrics
        if 'load' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'LOAD',
                metrics['load'], 'load_'
            )
        
        # Store EV metrics
        if 'ev' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'EV',
                metrics['ev'], 'ev_'
            )
        
        # Store BESS metrics
        if 'bess' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'BESS',
                metrics['bess'], 'bess_'
            )
    
    def store_device_performance_metrics(
        self,
        metrics: Dict,
        period_start: datetime,
        period_end: datetime
    ):
        """Store device-specific performance metrics."""
        
        self._store_metrics_summary(
            period_start,
            period_end,
            'device_performance',
            metrics
        )
        
        # Store PV metrics per device
        if 'pv' in metrics:
            for asset_key, pv_metrics in metrics['pv'].items():
                self._store_individual_metrics(
                    period_start, period_end, asset_key, 'PV',
                    pv_metrics, 'pv_'
                )
        
        # Store wind metrics per device
        if 'wind' in metrics:
            for asset_key, wind_metrics in metrics['wind'].items():
                self._store_individual_metrics(
                    period_start, period_end, asset_key, 'WIND',
                    wind_metrics, 'wind_'
                )
        
        # Store BESS metrics per device
        if 'bess' in metrics:
            for asset_key, bess_metrics in metrics['bess'].items():
                self._store_individual_metrics(
                    period_start, period_end, asset_key, 'BESS',
                    bess_metrics, 'bess_perf_'
                )
        
        # Store EV charger metrics per device
        if 'ev_chargers' in metrics:
            for asset_key, ev_metrics in metrics['ev_chargers'].items():
                asset_type = 'BI_EV' if ev_metrics.get('is_bidirectional') else 'UNI_EV'
                self._store_individual_metrics(
                    period_start, period_end, asset_key, asset_type,
                    ev_metrics, 'ev_'
                )
    
    def store_efficiency_metrics(
        self,
        metrics: Dict,
        period_start: datetime,
        period_end: datetime
    ):
        """Store efficiency and utilization metrics."""
        
        self._store_metrics_summary(
            period_start,
            period_end,
            'efficiency_utilization',
            metrics
        )
        
        # Store load factor
        if 'load_factor' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'SYSTEM',
                metrics['load_factor'], 'load_factor_'
            )
        
        # Store self-consumption metrics
        if 'self_consumption' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'SYSTEM',
                metrics['self_consumption'], 'self_consumption_'
            )
        
        # Store renewable share
        if 'renewable_share' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'SYSTEM',
                metrics['renewable_share'], 'renewable_share_'
            )
        
        # Store system efficiency
        if 'system_efficiency' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'SYSTEM',
                metrics['system_efficiency'], 'system_efficiency_'
            )
    
    def store_statistical_metrics(
        self,
        metrics: Dict,
        period_start: datetime,
        period_end: datetime
    ):
        """Store statistical and data quality metrics."""
        
        self._store_metrics_summary(
            period_start,
            period_end,
            'statistical',
            metrics
        )
        
        # Store data quality metrics
        if 'data_quality' in metrics:
            self._store_individual_metrics(
                period_start, period_end, 'system', 'DATA_QUALITY',
                metrics['data_quality'], 'data_quality_'
            )
    
    def _store_metrics_summary(
        self,
        period_start: datetime,
        period_end: datetime,
        category: str,
        metrics: Dict
    ):
        """Store metrics summary as JSON."""
        
        # Remove datetime objects for JSON serialization
        clean_metrics = self._clean_metrics_for_json(metrics)
        
        query = """
        INSERT INTO metrics_summary (period_start, period_end, calculation_time, metric_category, metrics_json)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (period_start, period_end, metric_category)
        DO UPDATE SET 
            calculation_time = EXCLUDED.calculation_time,
            metrics_json = EXCLUDED.metrics_json
        """
        
        params = (
            period_start,
            period_end,
            current_time(),
            category,
            json.dumps(clean_metrics)
        )
        
        try:
            self.db.execute_query(query, params)
        except Exception as e:
            print(f"Error storing metrics summary: {e}")
    
    def _store_individual_metrics(
        self,
        period_start: datetime,
        period_end: datetime,
        asset_key: str,
        asset_type: str,
        metrics: Dict,
        prefix: str = ''
    ):
        """Store individual metric values."""
        
        records = []
        
        for key, value in metrics.items():
            # Skip non-numeric values and nested dicts
            if not isinstance(value, (int, float)):
                continue
            
            metric_name = f"{prefix}{key}"
            
            # Determine unit from metric name
            unit = self._infer_unit(key)
            
            records.append((
                period_start,
                period_end,
                asset_key,
                asset_type,
                metric_name,
                float(value),
                unit,
                current_time()
            ))
        
        if not records:
            return
        
        query = """
        INSERT INTO asset_metrics 
        (period_start, period_end, asset_key, asset_type, metric_name, metric_value, metric_unit, calculation_time)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (period_start, period_end, asset_key, metric_name)
        DO UPDATE SET 
            metric_value = EXCLUDED.metric_value,
            calculation_time = EXCLUDED.calculation_time
        """
        
        try:
            self.db.execute_many(query, records)
        except Exception as e:
            print(f"Error storing individual metrics: {e}")
    
    def _clean_metrics_for_json(self, obj):
        """Clean metrics dictionary for JSON serialization."""
        if isinstance(obj, dict):
            # Convert any non-string keys to strings
            cleaned_dict = {}
            for k, v in obj.items():
                # Handle tuple keys (from pandas groupby)
                if isinstance(k, tuple):
                    key_str = '_'.join(str(x) for x in k)
                else:
                    key_str = str(k) if not isinstance(k, (str, int, float, bool, type(None))) else k
                cleaned_dict[key_str] = self._clean_metrics_for_json(v)
            return cleaned_dict
        elif isinstance(obj, list):
            return [self._clean_metrics_for_json(item) for item in obj]
        elif isinstance(obj, tuple):
            # Convert tuples to lists for JSON
            return [self._clean_metrics_for_json(item) for item in obj]
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif pd.isna(obj):
            return None
        elif isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        else:
            return obj
    
    def _infer_unit(self, metric_name: str) -> str:
        """Infer unit from metric name."""
        metric_lower = metric_name.lower()
        
        if '_wh' in metric_lower or 'energy' in metric_lower:
            return 'Wh'
        elif '_kwh' in metric_lower:
            return 'kWh'
        elif '_w' in metric_lower or 'power' in metric_lower:
            return 'W'
        elif 'percent' in metric_lower or 'rate' in metric_lower or 'efficiency' in metric_lower or 'factor' in metric_lower:
            return '%'
        elif 'soc' in metric_lower:
            return '%'
        elif 'cycles' in metric_lower or 'count' in metric_lower or 'sessions' in metric_lower:
            return 'count'
        elif 'hours' in metric_lower:
            return 'hours'
        else:
            return ''
    
    def get_metrics_summary(
        self,
        period_start: datetime,
        period_end: datetime,
        category: Optional[str] = None
    ) -> List[Dict]:
        """Retrieve metrics summary for a period."""
        
        query = """
        SELECT period_start, period_end, calculation_time, metric_category, metrics_json
        FROM metrics_summary
        WHERE period_start >= %s AND period_end <= %s
        """
        params = [period_start, period_end]
        
        if category:
            query += " AND metric_category = %s"
            params.append(category)
        
        query += " ORDER BY period_start DESC"
        
        return self.db.execute_query(query, tuple(params))
    
    def get_asset_metrics(
        self,
        period_start: datetime,
        period_end: datetime,
        asset_key: Optional[str] = None
    ) -> List[Dict]:
        """Retrieve asset-specific metrics."""
        
        query = """
        SELECT period_start, period_end, asset_key, asset_type, 
               metric_name, metric_value, metric_unit, calculation_time
        FROM asset_metrics
        WHERE period_start >= %s AND period_end <= %s
        """
        params = [period_start, period_end]
        
        if asset_key:
            query += " AND asset_key = %s"
            params.append(asset_key)
        
        query += " ORDER BY period_start DESC, asset_key, metric_name"
        
        return self.db.execute_query(query, tuple(params))