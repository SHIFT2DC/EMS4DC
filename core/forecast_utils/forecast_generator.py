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

@File: forecast_generator.py
@Description: Forecast generator module that orchestrates training and prediction for all assets. Handles data preparation, model training, prediction, and database storage.

@Created: 08 February 2026
@Last Modified: 05 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
import logging
import json

from forecast_utils.db_config import get_db
from forecast_utils.data_validator import DataValidator, MIN_SAMPLES_REQUIREMENTS
from forecast_utils.forecast_models import create_forecaster, ForecastResult

from utils.logging_utils import setup_logging
from utils.time_utils import current_time
setup_logging()
logger = logging.getLogger(__name__)


class ForecastGenerator:
    """Main class for generating and managing forecasts."""
    
    def __init__(self, model_type: str = 'auto'):
        """
        Initialize forecast generator.
        
        Args:
            model_type: Type of model to use ('auto', 'prophet', 'moving_average', 'persistence')
        """
        self.db = get_db()
        self.validator = DataValidator()
        self.model_type = model_type
    
    def generate_all_forecasts(
        self, 
        horizon_hours: int = 12,
        interval_minutes: int = 60,  # Changed to hourly by default
        force: bool = False
    ) -> Dict[str, bool]:
        """
        Generate forecasts for all ready assets.
        
        Args:
            horizon_hours: Forecast horizon in hours
            interval_minutes: Interval between forecast points (default: 60 for hourly)
            force: Force forecast generation even if asset not marked ready
            
        Returns:
            Dictionary mapping asset_key to success status
        """
        logger.info("Starting forecast generation for all assets...")
        
        # Clear existing forecasts
        self._clear_existing_forecasts()
        
        # Get assets ready for forecasting
        if force:
            ready_assets = self._get_all_active_assets()
        else:
            ready_assets = self.validator.get_ready_assets()
        
        if not ready_assets:
            logger.warning("No assets ready for forecasting")
            return {}
        
        logger.debug(f"Generating forecasts for {len(ready_assets)} assets")
        
        results = {}
        for asset_key, asset_type in ready_assets:
            try:
                success = self.generate_forecast(
                    asset_key, 
                    asset_type,
                    horizon_hours,
                    interval_minutes
                )
                results[asset_key] = success
                
                if success:
                    logger.debug(f"✓ Forecast generated for {asset_key}")
                else:
                    logger.warning(f"✗ Forecast generation failed for {asset_key}")
                    
            except Exception as e:
                logger.error(f"Error generating forecast for {asset_key}: {str(e)}")
                results[asset_key] = False
        
        # Log summary
        success_count = sum(results.values())
        logger.debug(f"Forecast generation complete: {success_count}/{len(results)} successful")
        
        return results
    
    def generate_forecast(
        self,
        asset_key: str,
        asset_type: str,
        horizon_hours: int = 12,
        interval_minutes: int = 60,  # Changed default to 60 minutes (hourly)
        training_days: int = 30
    ) -> bool:
        """
        Generate forecast for a single asset.
        
        Args:
            asset_key: Unique identifier for the asset
            asset_type: Type of asset
            horizon_hours: Forecast horizon in hours
            interval_minutes: Interval between forecast points (default: 60 for hourly)
            training_days: Days of historical data to use for training
            
        Returns:
            True if successful
        """
        logger.debug(f"Generating forecast for {asset_key} ({asset_type})")
        
        # Load historical data (will be resampled to hourly)
        historical_data = self._load_historical_data(asset_key, training_days)
        
        # Get minimum required samples for this asset type
        min_required_samples = MIN_SAMPLES_REQUIREMENTS.get(asset_type, 168)
        
        if historical_data is None or len(historical_data) < min_required_samples:
            logger.warning(
                f"Insufficient data for {asset_key}: "
                f"{len(historical_data) if historical_data is not None else 0}/{min_required_samples} samples"
            )
            return False
        
        # Create and train forecaster
        forecaster = create_forecaster(asset_key, asset_type, self.model_type)
        
        try:
            forecaster.train(historical_data)
        except Exception as e:
            logger.error(f"Training failed for {asset_key}: {str(e)}")
            return False
        
        # Generate predictions
        try:
            forecast_result = forecaster.predict(horizon_hours, interval_minutes)
        except Exception as e:
            logger.error(f"Prediction failed for {asset_key}: {str(e)}")
            return False
        
        # Save forecast to database
        try:
            self._save_forecast(asset_key, forecast_result)
        except Exception as e:
            logger.error(f"Failed to save forecast for {asset_key}: {str(e)}")
            return False
        
        # Save model metadata
        try:
            self._save_model_metadata(
                asset_key,
                forecaster,
                historical_data,
                forecast_result
            )
        except Exception as e:
            logger.error(f"Failed to save model metadata for {asset_key}: {str(e)}")
            # Non-critical, continue
        
        return True
    
    def _load_historical_data(
        self, 
        asset_key: str, 
        days: int = 30,
        resample_interval: str = '1H'
    ) -> Optional[pd.DataFrame]:
        """
        Load historical power measurements for an asset.
        Since measurements come every 10-15 seconds, they are resampled to hourly intervals.
        
        Args:
            asset_key: Unique identifier for the asset
            days: Number of days of historical data to load
            resample_interval: Resampling interval (default: '1H' for hourly)
            
        Returns:
            DataFrame with 'timestamp' and 'power' columns (resampled)
        """
        power_param = f"{asset_key}_POWER"
        end_time = current_time()
        start_time = end_time - timedelta(days=days)
        
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT time as timestamp, value as power
                FROM measurements
                WHERE parameter = %s
                    AND time >= %s
                    AND time <= %s
                    AND quality = 'ok'
                ORDER BY time
            """, (power_param, start_time, end_time))
            
            rows = cursor.fetchall()
        
        if not rows:
            return None
        
        df = pd.DataFrame(rows)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['power'] = df['power'].astype(float)
        
        # Resample high-frequency data (10-15 sec) to hourly intervals
        # This handles irregular timestamps and missing data
        df = df.set_index('timestamp')
        df_resampled = df.resample(resample_interval).agg({
            'power': 'mean'  # Average power over each hour
        }).reset_index()
        
        # Remove any NaN values that might result from gaps
        df_resampled = df_resampled.dropna()
        
        logger.debug(f"Loaded {len(rows)} raw measurements, resampled to {len(df_resampled)} hourly points")
        
        return df_resampled
    
    def _save_forecast(self, asset_key: str, forecast_result: ForecastResult):
        """
        Save forecast results to database.
        
        Args:
            asset_key: Unique identifier for the asset
            forecast_result: Forecast results to save
        """
        forecast_timestamp = current_time()
        
        # Prepare data for batch insert
        records = []
        for i, timestamp in enumerate(forecast_result.timestamps):
            record = (
                asset_key,
                forecast_timestamp,
                timestamp,
                float(forecast_result.predictions[i]),
                float(forecast_result.confidence_lower[i]) if forecast_result.confidence_lower is not None else None,
                float(forecast_result.confidence_upper[i]) if forecast_result.confidence_upper is not None else None,
                f"{forecast_result.model_type}_{forecast_result.model_version}"
            )
            records.append(record)
        
        # Batch insert
        with self.db.get_cursor() as cursor:
            cursor.executemany("""
                INSERT INTO forecasts (
                    asset_key, forecast_timestamp, horizon_timestamp,
                    predicted_power, confidence_lower, confidence_upper,
                    model_version
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, records)
        
        logger.debug(f"Saved {len(records)} forecast points for {asset_key}")
    
    def _save_model_metadata(
        self,
        asset_key: str,
        forecaster,
        training_data: pd.DataFrame,
        forecast_result: ForecastResult
    ):
        """
        Save model training metadata to database.
        
        Args:
            asset_key: Unique identifier for the asset
            forecaster: Trained forecaster instance
            training_data: Historical data used for training
            forecast_result: Forecast results
        """
        # Deactivate previous models
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                UPDATE model_metadata
                SET is_active = FALSE
                WHERE asset_key = %s
            """, (asset_key,))
        
        # Save new model metadata
        model_params = forecaster.get_model_params()
        
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO model_metadata (
                    asset_key, model_version, training_start_date,
                    training_end_date, samples_count, model_type,
                    model_params, performance_metrics, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                asset_key,
                f"{forecast_result.model_type}_{forecast_result.model_version}",
                training_data['timestamp'].min(),
                training_data['timestamp'].max(),
                len(training_data),
                forecast_result.model_type,
                json.dumps(model_params),
                json.dumps(forecast_result.metrics) if forecast_result.metrics else None,
                True
            ))
    
    def _clear_existing_forecasts(self):
        """Clear all existing forecasts from the database."""
        with self.db.get_cursor() as cursor:
            cursor.execute("DELETE FROM forecasts")
            deleted_count = cursor.rowcount
        
        logger.debug(f"Cleared {deleted_count} existing forecast records")
    
    def _get_all_active_assets(self) -> List[Tuple[str, str]]:
        """Get all active assets regardless of readiness status."""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT asset_key, type
                FROM assets
                WHERE is_active = TRUE
            """)
            
            return [(row['asset_key'], row['type']) for row in cursor.fetchall()]
    
    def get_latest_forecasts(
        self, 
        asset_key: Optional[str] = None
    ) -> pd.DataFrame:
        """
        Retrieve latest forecasts from database.
        
        Args:
            asset_key: Optional filter for specific asset
            
        Returns:
            DataFrame with forecast data
        """
        with self.db.get_cursor() as cursor:
            if asset_key:
                cursor.execute("""
                    SELECT 
                        asset_key,
                        forecast_timestamp,
                        horizon_timestamp,
                        predicted_power,
                        confidence_lower,
                        confidence_upper,
                        model_version
                    FROM forecasts
                    WHERE asset_key = %s
                    ORDER BY horizon_timestamp
                """, (asset_key,))
            else:
                cursor.execute("""
                    SELECT 
                        asset_key,
                        forecast_timestamp,
                        horizon_timestamp,
                        predicted_power,
                        confidence_lower,
                        confidence_upper,
                        model_version
                    FROM forecasts
                    ORDER BY asset_key, horizon_timestamp
                """)
            
            rows = cursor.fetchall()
        
        if not rows:
            return pd.DataFrame()
        
        return pd.DataFrame(rows)
    
    def get_forecast_summary(self) -> Dict:
        """
        Get summary of current forecasts in database.
        
        Returns:
            Dictionary with summary statistics
        """
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT asset_key) as num_assets,
                    COUNT(*) as total_predictions,
                    MIN(forecast_timestamp) as oldest_forecast,
                    MAX(forecast_timestamp) as newest_forecast,
                    MIN(horizon_timestamp) as first_horizon,
                    MAX(horizon_timestamp) as last_horizon
                FROM forecasts
            """)
            
            summary = cursor.fetchone()
        
        return dict(summary) if summary else {}


if __name__ == '__main__':
    # Test forecast generation
    generator = ForecastGenerator(model_type='auto')
    
    print("Generating forecasts for all ready assets...")
    results = generator.generate_all_forecasts(
        horizon_hours=12,
        interval_minutes=15
    )
    
    print("\nGeneration Results:")
    for asset_key, success in results.items():
        status = "✓" if success else "✗"
        print(f"  {status} {asset_key}")
    
    print("\nForecast Summary:")
    summary = generator.get_forecast_summary()
    for key, value in summary.items():
        print(f"  {key}: {value}")