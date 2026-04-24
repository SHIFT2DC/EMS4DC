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

@File: model_trainer.py
@Description: Model training and retraining scheduler. Manages periodic retraining to improve forecast accuracy as more data accumulates.

@Created: 08 February 2026
@Last Modified: 05 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
'''


from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
import json

from forecast_utils.db_config import get_db
from forecast_utils.data_validator import DataValidator
from forecast_utils.forecast_generator import ForecastGenerator

from utils.logging_utils import setup_logging
from utils.time_utils import current_time
setup_logging()
logger = logging.getLogger(__name__)


class ModelTrainer:
    """Manages model training and retraining schedules."""
    
    # Training configuration
    INITIAL_TRAINING_DAYS = 14      # Days of data for initial training
    RETRAINING_DAYS = 30            # Days of data for retraining
    MIN_RETRAINING_INTERVAL_HOURS = 24  # Minimum time between retrainings
    
    def __init__(self):
        self.db = get_db()
        self.validator = DataValidator()
        self.generator = ForecastGenerator()
    
    def should_retrain(self, asset_key: str) -> Dict:
        """
        Determine if an asset's model should be retrained.
        
        Args:
            asset_key: Unique identifier for the asset
            
        Returns:
            Dictionary with decision and reasoning
        """
        # Check when model was last trained
        last_training = self._get_last_training_info(asset_key)
        
        if last_training is None:
            return {
                'should_retrain': True,
                'reason': 'No model exists yet',
                'priority': 'high'
            }
        
        # Check if minimum interval has passed
        time_since_training = current_time() - last_training['trained_at']
        hours_since_training = time_since_training.total_seconds() / 3600
        
        if hours_since_training < self.MIN_RETRAINING_INTERVAL_HOURS:
            return {
                'should_retrain': False,
                'reason': f'Trained {hours_since_training:.1f}h ago (min: {self.MIN_RETRAINING_INTERVAL_HOURS}h)',
                'priority': 'none'
            }
        
        # Check if new data is available
        new_data_count = self._count_new_data_points(
            asset_key,
            last_training['training_end_date']
        )
        
        # Decision criteria
        days_since_training = hours_since_training / 24
        
        # High priority: More than 7 days and significant new data
        if days_since_training > 7 and new_data_count > 1000:
            return {
                'should_retrain': True,
                'reason': f'{days_since_training:.1f} days old, {new_data_count} new samples',
                'priority': 'high',
                'new_samples': new_data_count
            }
        
        # Medium priority: More than 3 days
        if days_since_training > 3 and new_data_count > 500:
            return {
                'should_retrain': True,
                'reason': f'{days_since_training:.1f} days old, {new_data_count} new samples',
                'priority': 'medium',
                'new_samples': new_data_count
            }
        
        # Low priority: More than 1 day
        if days_since_training > 1 and new_data_count > 100:
            return {
                'should_retrain': True,
                'reason': f'{days_since_training:.1f} days old, {new_data_count} new samples',
                'priority': 'low',
                'new_samples': new_data_count
            }
        
        return {
            'should_retrain': False,
            'reason': f'Recent training ({days_since_training:.1f}d ago), limited new data ({new_data_count} samples)',
            'priority': 'none'
        }
    
    def retrain_all_models(self, force: bool = False) -> Dict[str, bool]:
        """
        Retrain models for all assets that need it.
        
        Args:
            force: Force retraining regardless of criteria
            
        Returns:
            Dictionary mapping asset_key to success status
        """
        logger.debug("Checking which models need retraining...")
        
        # Get all active assets
        ready_assets = self.validator.get_ready_assets()
        
        if not ready_assets:
            logger.warning("No assets ready for training")
            return {}
        
        results = {}
        for asset_key, asset_type in ready_assets:
            decision = self.should_retrain(asset_key)
            
            if force or decision['should_retrain']:
                logger.debug(f"Retraining {asset_key}: {decision['reason']}")
                
                try:
                    success = self.generator.generate_forecast(
                        asset_key,
                        asset_type,
                        training_days=self.RETRAINING_DAYS
                    )
                    results[asset_key] = success
                    
                    if success:
                        logger.debug(f"✓ Model retrained for {asset_key}")
                    else:
                        logger.warning(f"✗ Retraining failed for {asset_key}")
                        
                except Exception as e:
                    logger.error(f"Error retraining {asset_key}: {str(e)}")
                    results[asset_key] = False
            else:
                logger.debug(f"Skipping {asset_key}: {decision['reason']}")
                results[asset_key] = None  # None indicates skipped
        
        # Log summary
        trained = sum(1 for v in results.values() if v is True)
        failed = sum(1 for v in results.values() if v is False)
        skipped = sum(1 for v in results.values() if v is None)
        
        logger.debug(f"Retraining complete: {trained} trained, {failed} failed, {skipped} skipped")
        
        return results
    
    def get_retraining_schedule(self) -> Dict[str, Dict]:
        """
        Get retraining schedule for all assets.
        
        Returns:
            Dictionary with retraining info for each asset
        """
        ready_assets = self.validator.get_ready_assets()
        
        schedule = {}
        for asset_key, asset_type in ready_assets:
            decision = self.should_retrain(asset_key)
            last_training = self._get_last_training_info(asset_key)
            
            schedule[asset_key] = {
                'asset_type': asset_type,
                'should_retrain': decision['should_retrain'],
                'reason': decision['reason'],
                'priority': decision['priority'],
                'last_trained': last_training['trained_at'] if last_training else None,
                'model_version': last_training['model_version'] if last_training else None,
                'samples_used': last_training['samples_count'] if last_training else None
            }
        
        return schedule
    
    def _get_last_training_info(self, asset_key: str) -> Optional[Dict]:
        """Get information about the last training for an asset."""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT 
                    model_version,
                    training_start_date,
                    training_end_date,
                    samples_count,
                    model_type,
                    trained_at,
                    performance_metrics
                FROM model_metadata
                WHERE asset_key = %s AND is_active = TRUE
                ORDER BY trained_at DESC
                LIMIT 1
            """, (asset_key,))
            
            result = cursor.fetchone()
        
        return dict(result) if result else None
    
    def _count_new_data_points(
        self, 
        asset_key: str, 
        since_date: datetime
    ) -> int:
        """Count how many new data points are available since last training."""
        power_param = f"{asset_key}_POWER"
        
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM measurements
                WHERE parameter = %s 
                    AND time > %s
                    AND quality = 'ok'
            """, (power_param, since_date))
            
            result = cursor.fetchone()
        
        return result['count'] if result else 0
    
    def get_model_performance_summary(self) -> Dict:
        """
        Get performance summary for all active models.
        
        Returns:
            Dictionary with performance metrics per asset
        """
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT 
                    m.asset_key,
                    a.type as asset_type,
                    m.model_type,
                    m.model_version,
                    m.samples_count,
                    m.trained_at,
                    m.performance_metrics
                FROM model_metadata m
                INNER JOIN assets a ON m.asset_key = a.asset_key
                WHERE m.is_active = TRUE
                ORDER BY m.trained_at DESC
            """)
            
            rows = cursor.fetchall()
        
        summary = {}
        for row in rows:
            metrics = json.loads(row['performance_metrics']) if row['performance_metrics'] else {}
            
            summary[row['asset_key']] = {
                'asset_type': row['asset_type'],
                'model_type': row['model_type'],
                'model_version': row['model_version'],
                'samples_count': row['samples_count'],
                'trained_at': row['trained_at'],
                'metrics': metrics
            }
        
        return summary
    
    def cleanup_old_metadata(self, keep_versions: int = 5):
        """
        Clean up old model metadata, keeping only the most recent versions.
        
        Args:
            keep_versions: Number of model versions to keep per asset
        """
        with self.db.get_cursor() as cursor:
            # Get all assets
            cursor.execute("SELECT DISTINCT asset_key FROM model_metadata")
            assets = [row['asset_key'] for row in cursor.fetchall()]
        
        deleted_count = 0
        for asset_key in assets:
            with self.db.get_cursor() as cursor:
                # Delete all but the most recent N versions
                cursor.execute("""
                    DELETE FROM model_metadata
                    WHERE id IN (
                        SELECT id FROM model_metadata
                        WHERE asset_key = %s
                        ORDER BY trained_at DESC
                        OFFSET %s
                    )
                """, (asset_key, keep_versions))
                
                deleted_count += cursor.rowcount
        
        logger.debug(f"Cleaned up {deleted_count} old model metadata records")
        return deleted_count


if __name__ == '__main__':
    # Test model training scheduler
    trainer = ModelTrainer()
    
    print("Retraining Schedule:")
    print("=" * 80)
    
    schedule = trainer.get_retraining_schedule()
    for asset_key, info in schedule.items():
        print(f"\n{asset_key} ({info['asset_type']}):")
        print(f"  Should retrain: {info['should_retrain']} (priority: {info['priority']})")
        print(f"  Reason: {info['reason']}")
        if info['last_trained']:
            print(f"  Last trained: {info['last_trained']}")
            print(f"  Model: {info['model_version']}")
    
    print("\n" + "=" * 80)
    print("\nPerformance Summary:")
    print("=" * 80)
    
    performance = trainer.get_model_performance_summary()
    for asset_key, info in performance.items():
        print(f"\n{asset_key}:")
        print(f"  Model: {info['model_type']}")
        print(f"  Trained: {info['trained_at']}")
        print(f"  Samples: {info['samples_count']}")
        if info['metrics']:
            print(f"  Metrics: {info['metrics']}")