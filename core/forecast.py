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

@File: forecast.py
@Description: Scheduler module for orchestrating periodic forecast generation and model retraining.

@Created: 08 February 2026
@Last Modified: 17 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


import time
import schedule
import logging
from datetime import datetime
from typing import Optional
import signal
import sys

from forecast_utils.db_config import get_db
from forecast_utils.data_validator import DataValidator
from forecast_utils.forecast_generator import ForecastGenerator
from forecast_utils.model_trainer import ModelTrainer

from utils.logging_utils import setup_logging
setup_logging()
logger = logging.getLogger('forecast')


class ForecastScheduler:
    """
    Scheduler for automated forecast generation and model retraining.
    """
    
    def __init__(
        self,
        forecast_interval_hours: int = 2,
        retrain_interval_days: int = 1,
        validation_interval_hours: int = 6
    ):
        """
        Initialize scheduler.
        
        Args:
            forecast_interval_hours: Hours between forecast generations (default: 2)
            retrain_interval_days: Days between retraining checks (default: 1)
            validation_interval_hours: Hours between data validation checks (default: 6)
        """
        self.forecast_interval_hours = forecast_interval_hours
        self.retrain_interval_days = retrain_interval_days
        self.validation_interval_hours = validation_interval_hours
        
        self.db = get_db()
        self.validator = DataValidator()
        self.generator = ForecastGenerator(model_type='auto')
        self.trainer = ModelTrainer()
        
        self.is_running = False
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self):
        """Setup graceful shutdown on SIGINT/SIGTERM."""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.stop()
        sys.exit(0)
    
    def run_forecast_generation(self):
        """Job: Generate forecasts for all ready assets."""
        try:
            logger.debug("=" * 80)
            logger.debug("Starting scheduled forecast generation")
            logger.debug("=" * 80)
            
            start_time = datetime.now()
            
            results = self.generator.generate_all_forecasts(
                horizon_hours=12,
                interval_minutes=60  # Hourly forecasts
            )
            
            duration = (datetime.now() - start_time).total_seconds()
            success_count = sum(results.values())
            
            logger.debug(f"Forecast generation completed in {duration:.1f}s")
            logger.debug(f"Success: {success_count}/{len(results)} assets")
            
            # Get summary
            summary = self.generator.get_forecast_summary()
            logger.debug(f"Total predictions in database: {summary.get('total_predictions', 0)}")
            
        except Exception as e:
            logger.error(f"Error in forecast generation job: {str(e)}", exc_info=True)
    
    def run_data_validation(self):
        """Job: Validate data readiness for all assets."""
        try:
            logger.debug("=" * 80)
            logger.debug("Starting scheduled data validation")
            logger.debug("=" * 80)
            
            readiness = self.validator.check_all_assets_readiness()
            
            ready_count = sum(readiness.values())
            logger.debug(f"Data validation complete: {ready_count}/{len(readiness)} assets ready")
            
        except Exception as e:
            logger.error(f"Error in data validation job: {str(e)}", exc_info=True)
    
    def run_model_retraining(self):
        """Job: Check and retrain models as needed."""
        try:
            logger.debug("=" * 80)
            logger.debug("Starting scheduled model retraining check")
            logger.debug("=" * 80)
            
            start_time = datetime.now()
            
            results = self.trainer.retrain_all_models(force=False)
            
            duration = (datetime.now() - start_time).total_seconds()
            trained = sum(1 for v in results.values() if v is True)
            failed = sum(1 for v in results.values() if v is False)
            skipped = sum(1 for v in results.values() if v is None)
            
            logger.debug(f"Retraining check completed in {duration:.1f}s")
            logger.debug(f"Results: {trained} trained, {failed} failed, {skipped} skipped")
            
        except Exception as e:
            logger.error(f"Error in retraining job: {str(e)}", exc_info=True)
    
    def run_cleanup(self):
        """Job: Cleanup old model metadata."""
        try:
            logger.debug("Running cleanup of old model metadata...")
            deleted = self.trainer.cleanup_old_metadata(keep_versions=5)
            logger.debug(f"Cleanup complete: {deleted} records removed")
            
        except Exception as e:
            logger.error(f"Error in cleanup job: {str(e)}", exc_info=True)
    
    def start(self):
        """Start the scheduler."""
        logger.info("Starting EMS Forecast Scheduler")
        logger.info(f"Forecast generation: every {self.forecast_interval_hours} hours")
        logger.info(f"Model retraining check: every {self.retrain_interval_days} days")
        logger.info(f"Data validation: every {self.validation_interval_hours} hours")
                
        # Run initial jobs
        logger.debug("Running initial data validation...")
        self.run_data_validation()
        
        logger.debug("Running initial forecast generation...")
        self.run_forecast_generation()
        
        # Schedule recurring jobs
        schedule.every(self.forecast_interval_hours).hours.do(
            self.run_forecast_generation
        )
        
        schedule.every(self.validation_interval_hours).hours.do(
            self.run_data_validation
        )
        
        schedule.every(self.retrain_interval_days).days.do(
            self.run_model_retraining
        )
        
        # Daily cleanup at 2 AM
        schedule.every().day.at("02:00").do(
            self.run_cleanup
        )
        
        # Main loop
        self.is_running = True
        logger.info("Scheduler started. Press Ctrl+C to stop.")
        
        try:
            while self.is_running:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
                
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
            self.stop()
    
    def stop(self):
        """Stop the scheduler."""
        logger.info("Stopping scheduler...")
        self.is_running = False
        
        # Close database connections
        try:
            self.db.close_pool()
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error closing database: {str(e)}")
        
        logger.info("Scheduler stopped")


class OneTimeForecastRunner:
    """Helper class for running one-time forecast generation (e.g., from cron)."""
    
    @staticmethod
    def run_once():
        """Run forecast generation once and exit."""
        logger.info("Running one-time forecast generation")
        
        db = get_db()
        try:
            # Validate data
            validator = DataValidator()
            validator.check_all_assets_readiness()
            
            # Generate forecasts
            generator = ForecastGenerator(model_type='auto')
            results = generator.generate_all_forecasts(
                horizon_hours=12,
                interval_minutes=60  # Hourly forecasts
            )
            
            success_count = sum(results.values())
            logger.debug(f"Forecast generation complete: {success_count}/{len(results)} successful")
            
            return success_count == len(results)
            
        except Exception as e:
            logger.error(f"Error in one-time forecast generation: {str(e)}", exc_info=True)
            return False
            
        finally:
            db.close_pool()
    
    @staticmethod
    def run_retraining():
        """Run model retraining once and exit."""
        logger.info("Running one-time model retraining")
        
        db = get_db()
        try:
            trainer = ModelTrainer()
            results = trainer.retrain_all_models(force=False)
            
            trained = sum(1 for v in results.values() if v is True)
            logger.info(f"Retraining complete: {trained} models trained")
            
            return True
            
        except Exception as e:
            logger.error(f"Error in one-time retraining: {str(e)}", exc_info=True)
            return False
            
        finally:
            db.close_pool()


def main():
    """Main entry point for the scheduler."""
    import argparse
    
    parser = argparse.ArgumentParser(description='EMS Forecast Scheduler')
    parser.add_argument(
        '--mode',
        choices=['daemon', 'once', 'retrain'],
        default='daemon',
        help='Run mode: daemon (continuous), once (single run), retrain (model retraining)'
    )
    parser.add_argument(
        '--forecast-interval',
        type=int,
        default=2,
        help='Hours between forecast generations (default: 2)'
    )
    parser.add_argument(
        '--retrain-interval',
        type=int,
        default=1,
        help='Days between retraining checks (default: 1)'
    )
    parser.add_argument(
        '--validation-interval',
        type=int,
        default=6,
        help='Hours between data validation checks (default: 6)'
    )
    
    args = parser.parse_args()
    
    if args.mode == 'once':
        # Run forecast generation once and exit
        success = OneTimeForecastRunner.run_once()
        sys.exit(0 if success else 1)
        
    elif args.mode == 'retrain':
        # Run retraining once and exit
        success = OneTimeForecastRunner.run_retraining()
        sys.exit(0 if success else 1)
        
    else:
        # Run as daemon
        scheduler = ForecastScheduler(
            forecast_interval_hours=args.forecast_interval,
            retrain_interval_days=args.retrain_interval,
            validation_interval_hours=args.validation_interval
        )
        scheduler.start()


if __name__ == '__main__':
    main()