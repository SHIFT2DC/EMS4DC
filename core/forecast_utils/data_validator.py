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

@File: data_validator.py
@Description: Data validation module to assess forecast readiness for each asset. Checks if sufficient historical data exists before allowing forecast generation.

@Created: 08 February 2026
@Last Modified: 22 April 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
'''


from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging

from forecast_utils.db_config import get_db

from utils.logging_utils import setup_logging
from utils.time_utils import current_time
setup_logging()
logger = logging.getLogger(__name__)


# Minimum requirements for different asset types
# For 10-15 second measurements: ~6 samples/min * 60 min * 24 hours = ~8,640 samples/day
# We require data after resampling to hourly intervals
MIN_SAMPLES_REQUIREMENTS = {
    'PV': 168,              # 7 days of hourly data (7 * 24)
    'WIND': 168,            # 7 days of hourly data
    'BESS': 168,            # 7 days of hourly data
    'LOAD': 336,            # 14 days of hourly data (14 * 24)
    'CRITICAL_LOAD': 336,   # 14 days of hourly data
    'AFE': 168,             # 7 days of hourly data
    'UNI_EV': 336,          # 14 days of hourly data (charging patterns vary)
    'BI_EV': 336,           # 14 days of hourly data (V2G patterns vary)
}

# Minimum data coverage percentage (to handle gaps)
MIN_COVERAGE_PCT = 70.0

class DataValidator:
    """Validates data quality and readiness for forecasting.""" 
    min_samples_requirements = MIN_SAMPLES_REQUIREMENTS
    min_coverage_pct = MIN_COVERAGE_PCT
    

    def __init__(self):
        self.db = get_db()
    
    def check_all_assets_readiness(self) -> Dict[str, bool]:
        """
        Check forecast readiness for all active assets.
        
        Returns:
            Dict mapping asset_key to readiness status
        """
        with self.db.get_cursor() as cursor:
            # Get all active assets
            cursor.execute("""
                SELECT asset_key, type 
                FROM assets 
                WHERE is_active = TRUE
            """)
            active_assets = cursor.fetchall()
        
        readiness = {}
        for asset in active_assets:
            is_ready = self.check_asset_readiness(
                asset['asset_key'], 
                asset['type']
            )
            readiness[asset['asset_key']] = is_ready
            logger.debug(f"Asset {asset['asset_key']} ({asset['type']}): "
                       f"Ready = {is_ready}")
        
        return readiness
    
    def check_asset_readiness(
        self, 
        asset_key: str, 
        asset_type: str,
        window_hours: int = 720  # default 30 days, matches training_days
    ) -> bool:
        """
        Check if a specific asset has sufficient data for forecasting.
        
        Args:
            asset_key: Unique identifier for the asset
            asset_type: Type of asset (PV, BESS, LOAD, etc.)
            
        Returns:
            True if asset is ready for forecasting
        """
        # Get minimum samples required for this asset type
        min_samples = self.min_samples_requirements.get(asset_type, 672)
        
        # Get data statistics
        stats = self._get_data_statistics(asset_key, window_hours=window_hours)
        
        if stats is None:
            logger.warning(f"No data found for asset {asset_key}")
            self._update_readiness_table(asset_key, False, 0, None, None, 
                                         0.0, min_samples)
            return False
        
        total_samples = stats['total_samples']
        first_measurement = stats['first_measurement']
        last_measurement = stats['last_measurement']
        
        # Calculate expected number of samples based on time range
        # With 10-15 second measurements, we have ~6 samples/minute
        # After resampling to hourly, we expect 1 sample per hour
        if first_measurement and last_measurement:
            time_diff = last_measurement - first_measurement
            hours = time_diff.total_seconds() / 3600
            expected_hourly_samples = int(hours)  # 1 sample per hour after resampling
            total_samples_hourly = total_samples / 6 / 60 # The data is collected every ~10 seconds, it is 360 samples/hour

            if expected_hourly_samples > 0:
                coverage_pct = (total_samples_hourly / expected_hourly_samples) * 100
            else:
                coverage_pct = 0.0
        else:
            coverage_pct = 0.0

        # Check readiness criteria
        is_ready = (
            total_samples_hourly >= min_samples and 
            coverage_pct >= self.min_coverage_pct
        )
        
        # Update readiness table
        self._update_readiness_table(
            asset_key, is_ready, total_samples, 
            first_measurement, last_measurement,
            coverage_pct, min_samples
        )
        
        if not is_ready:
            # logger.debug(
            #     f"Asset {asset_key} not ready: "
            #     f"{total_samples_hourly:.1f}/{min_samples} samples, "
            #     f"{coverage_pct:.1f}% coverage"
            # )

            logger.debug(
                f"Asset {asset_key} not ready: "
                f"{total_samples_hourly} >= {min_samples} ?? samples, "
                f"{coverage_pct:.1f}% coverage >= {self.min_coverage_pct}%??"
            )
        
        return is_ready
    
    def _get_data_statistics(self, asset_key: str, window_hours: int) -> Dict:  # <-- new param
        """
        Get statistical information about available data for an asset,
        scoped to the most recent window matching the forecast requirement.

        Args:
            asset_key: Unique identifier for the asset
            window_hours: How many hours back from the latest measurement to inspect
                
        Returns:
            Dictionary with data statistics or None if no data
        """
        power_param = f"{asset_key}_POWER"
        
        with self.db.get_cursor() as cursor:
            # Anchor the window to the most recent measurement, not the oldest
            cursor.execute("""
                SELECT MAX(time) as last_measurement
                FROM measurements
                WHERE parameter = %s AND quality = 'ok'
            """, (power_param,))
            anchor = cursor.fetchone()

            if not anchor or not anchor['last_measurement']:
                return None

            last_measurement = anchor['last_measurement']
            window_start = last_measurement - timedelta(hours=window_hours)  # <-- rolling window

            cursor.execute("""
                SELECT 
                    COUNT(*) as total_samples,
                    MIN(time) as first_measurement,
                    MAX(time) as last_measurement,
                    AVG(value) as avg_power,
                    STDDEV(value) as std_power
                FROM measurements
                WHERE parameter = %s AND quality = 'ok'
                    AND time >= %s AND time <= %s  -- scoped to window
            """, (power_param, window_start, last_measurement))
            
            result = cursor.fetchone()
            
            if result and result['total_samples'] > 0:
                return result
            return None
    
    def _update_readiness_table(
        self, 
        asset_key: str,
        is_ready: bool,
        total_samples: int,
        first_measurement: datetime,
        last_measurement: datetime,
        coverage_pct: float,
        min_samples: int
    ):
        """Update the forecast_readiness table with latest check results."""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO forecast_readiness (
                    asset_key, total_samples, first_measurement, 
                    last_measurement, data_coverage_pct, 
                    min_samples_required, is_ready_for_forecast,
                    last_checked
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (asset_key) 
                DO UPDATE SET
                    total_samples = EXCLUDED.total_samples,
                    first_measurement = EXCLUDED.first_measurement,
                    last_measurement = EXCLUDED.last_measurement,
                    data_coverage_pct = EXCLUDED.data_coverage_pct,
                    min_samples_required = EXCLUDED.min_samples_required,
                    is_ready_for_forecast = EXCLUDED.is_ready_for_forecast,
                    last_checked = EXCLUDED.last_checked
            """, (
                asset_key, total_samples, first_measurement,
                last_measurement, coverage_pct, min_samples,
                is_ready, current_time()
            ))
    
    def get_ready_assets(self) -> List[Tuple[str, str]]:
        """
        Get list of assets that are ready for forecasting.
        
        Returns:
            List of tuples (asset_key, asset_type)
        """
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT a.asset_key, a.type
                FROM assets a
                INNER JOIN forecast_readiness fr 
                    ON a.asset_key = fr.asset_key
                WHERE a.is_active = TRUE 
                    AND fr.is_ready_for_forecast = TRUE
            """)
            
            return [(row['asset_key'], row['type']) for row in cursor.fetchall()]
    
    def get_data_gap_report(self, asset_key: str, days: int = 7) -> Dict:
        """
        Generate a report of data gaps for an asset.
        
        Args:
            asset_key: Unique identifier for the asset
            days: Number of days to analyze
            
        Returns:
            Dictionary with gap analysis
        """
        power_param = f"{asset_key}_POWER"
        end_time = current_time()
        start_time = end_time - timedelta(days=days)
        
        with self.db.get_cursor() as cursor:
            # Get all timestamps
            cursor.execute("""
                SELECT time 
                FROM measurements
                WHERE parameter = %s 
                    AND time >= %s 
                    AND time <= %s
                    AND quality = 'ok'
                ORDER BY time
            """, (power_param, start_time, end_time))
            
            timestamps = [row['time'] for row in cursor.fetchall()]
        
        if len(timestamps) < 2:
            return {
                'has_data': False,
                'total_gaps': 0,
                'largest_gap_hours': 0,
                'samples': len(timestamps)
            }
        
        # Find gaps larger than expected interval (e.g., > 20 minutes)
        gaps = []
        expected_interval = timedelta(minutes=20)  # Allow some tolerance
        
        for i in range(1, len(timestamps)):
            gap = timestamps[i] - timestamps[i-1]
            if gap > expected_interval:
                gaps.append(gap.total_seconds() / 3600)  # Convert to hours
        
        return {
            'has_data': True,
            'total_samples': len(timestamps),
            'total_gaps': len(gaps),
            'largest_gap_hours': max(gaps) if gaps else 0,
            'avg_gap_hours': sum(gaps) / len(gaps) if gaps else 0,
            'start_time': timestamps[0],
            'end_time': timestamps[-1]
        }


if __name__ == '__main__':
    # Test data validation
    validator = DataValidator()
    
    print("Checking readiness for all active assets...")
    readiness = validator.check_all_assets_readiness()
    
    print("\nReadiness Summary:")
    for asset_key, is_ready in readiness.items():
        status = "✓ Ready" if is_ready else "✗ Not Ready"
        print(f"  {asset_key}: {status}")
    
    print("\nAssets ready for forecasting:")
    ready_assets = validator.get_ready_assets()
    for asset_key, asset_type in ready_assets:
        print(f"  {asset_key} ({asset_type})")