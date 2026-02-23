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

@File: orchestrator.py
@Description: Main orchestrator for EMS metrics calculation. Coordinates all metric calculators and runs on schedule.

@Created: 11 February 2026
@Last Modified: 17 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


import schedule
import time
from datetime import datetime, timedelta
from typing import Optional
import traceback

from metrics_utils.database import DatabaseConnection, DatabaseConfig
from metrics_utils.config_loader import ConfigLoader
from metrics_utils.data_loader import MeasurementLoader
from metrics_utils.energy_flow_metrics import EnergyFlowMetrics
from metrics_utils.device_performance_metrics import DevicePerformanceMetrics
from metrics_utils.efficiency_utilization_metrics import EfficiencyUtilizationMetrics
from metrics_utils.statistical_metrics import StatisticalMetrics
from metrics_utils.metrics_storage import MetricsStorage

from utils.time_utils import floor_to_hour
from utils.logging_utils import setup_logging
import logging

setup_logging()
logger = logging.getLogger('orchestrator')

class MetricsOrchestrator:
    """Orchestrate metrics calculation and storage."""
    
    def __init__(
        self,
        config_dir: str = "./../../web-app/backend/",
        db_config: Optional[DatabaseConfig] = None
    ):
        """
        Initialize the metrics orchestrator.
        
        Args:
            config_dir: Directory containing config.json and modbus.json
            db_config: Database configuration (uses environment if None)
        """
        self.db = DatabaseConnection(db_config)
        self.config_loader = ConfigLoader(config_dir)
        self.data_loader = MeasurementLoader(self.db)
        self.storage = MetricsStorage(self.db)
        
        # Initialize metric calculators
        self.energy_flow = EnergyFlowMetrics(self.data_loader, self.config_loader)
        self.device_performance = DevicePerformanceMetrics(self.data_loader, self.config_loader)
        self.efficiency = EfficiencyUtilizationMetrics(self.data_loader, self.config_loader)
        self.statistical = StatisticalMetrics(self.data_loader)
        
        logger.info("MetricsOrchestrator initialized successfully")
    
    def calculate_and_store_metrics(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        period_hours: int = 1
    ):
        """
        Calculate and store all metrics for a time period.
        
        Args:
            start_time: Start of period (defaults to period_hours ago)
            end_time: End of period (defaults to now)
            period_hours: Hours to look back if start_time not provided
        """
        if end_time is None:
            end_time = datetime.now()
        
        if start_time is None:
            start_time = end_time - timedelta(hours=period_hours)
        
        logger.info(f"Calculating metrics for period: Start: {start_time} End:   {end_time}")
        
        try:
            # Calculate energy flow metrics
            logger.debug("Calculating energy flow metrics...")
            energy_metrics = self.energy_flow.calculate_period_metrics(
                start_time, end_time
            )
            self.storage.store_energy_flow_metrics(
                energy_metrics, start_time, end_time
            )
            logger.debug("✓ Energy flow metrics calculated and stored")
            
            # Calculate device performance metrics
            logger.debug("Calculating device performance metrics...")
            device_metrics = self.device_performance.calculate_period_metrics(
                start_time, end_time
            )
            self.storage.store_device_performance_metrics(
                device_metrics, start_time, end_time
            )
            logger.debug("✓ Device performance metrics calculated and stored")
            
            # Calculate efficiency metrics
            logger.debug("Calculating efficiency and utilization metrics...")
            efficiency_metrics = self.efficiency.calculate_period_metrics(
                start_time, end_time
            )
            self.storage.store_efficiency_metrics(
                efficiency_metrics, start_time, end_time
            )
            logger.debug("✓ Efficiency metrics calculated and stored")
            
            # Calculate statistical metrics
            logger.debug("Calculating statistical metrics...")
            stat_metrics = self.statistical.calculate_period_metrics(
                start_time, end_time, aggregation_freq='1H'
            )
            self.storage.store_statistical_metrics(
                stat_metrics, start_time, end_time
            )
            logger.debug("✓ Statistical metrics calculated and stored")
            
            logger.debug(f"Metrics calculation completed successfully!")
            
            return {
                'energy_flow': energy_metrics,
                'device_performance': device_metrics,
                'efficiency': efficiency_metrics,
                'statistical': stat_metrics
            }
            
        except Exception as e:
            logger.error(f"{'!'*60}")
            logger.error(f"ERROR: Metrics calculation failed!")
            logger.error(f"Error: {str(e)}")
            logger.error(f"{'!'*60}")
            traceback.print_exc()
            raise
    
    def calculate_hourly_metrics(self):
        """Calculate metrics for the last hour."""
        end_time = floor_to_hour(datetime.now())
        start_time = end_time - timedelta(hours=1)
        logger.debug(f"Running hourly metrics calculation for period: [{start_time}]-[{end_time}]")
        self.calculate_and_store_metrics(period_hours=1, start_time=start_time, end_time=end_time)
    
    def calculate_daily_metrics(self):
        """Calculate metrics for the last 24 hours."""
        end_time = floor_to_hour(datetime.now())
        start_time = end_time - timedelta(days=1)
        logger.debug(f"Running daily metrics calculation for period: [{start_time}]-[{end_time}]")
        self.calculate_and_store_metrics(period_hours=24)
    
    def run_scheduled(
        self,
        hourly: bool = True,
        hourly_minute: int = 1,
    ):
        """
        Run metrics calculation on a schedule.
        
        Args:
            hourly: Enable hourly calculations
            daily: Enable daily calculations
            hourly_minute: Minute of the hour for hourly calculations (0-59)
            daily_hour: Time for daily calculations (HH:MM format)
        """
        logger.info("Setting up scheduled metrics calculation")
        
        if hourly:
            # Run every hour at specified minute
            schedule.every().hour.at(f":{hourly_minute:02d}").do(
                self.calculate_hourly_metrics
            )
            logger.info(f"Hourly metrics: Every hour at minute {hourly_minute}")
                
        logger.info("Metrics calculation scheduler started.")
        logger.info("Press Ctrl+C to stop.")
        
        # Run initial calculation for the most recently completed whole 
        # hour and start to one period before that.
        logger.debug("Running initial metrics calculation...")
        if hourly:
            end_time = floor_to_hour(datetime.now())
            start_time = end_time - timedelta(hours=1)
            self.calculate_and_store_metrics(start_time=start_time, end_time=end_time)
        
        # Keep running
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("Scheduler stopped by user.")
        finally:
            self.db.close()
    
    def run_once(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        period_hours: int = 1
    ):
        """
        Run metrics calculation once and exit.
        
        Args:
            start_time: Start of period
            end_time: End of period
            period_hours: Hours to look back if start_time not provided
        """
        try:
            metrics = self.calculate_and_store_metrics(
                start_time, end_time, period_hours
            )
            return metrics
        finally:
            self.db.close()
    
    def backfill_metrics(
        self,
        start_date: datetime,
        end_date: datetime,
        period_hours: int = 1
    ):
        """
        Backfill metrics for a historical period.
        
        Args:
            start_date: Beginning of backfill period
            end_date: End of backfill period
            period_hours: Size of each calculation window in hours
        """
        logger.info(f"Backfilling metrics from {start_date} to {end_date}")
        logger.info(f"Period size: {period_hours} hours")
        
        current = start_date
        period_delta = timedelta(hours=period_hours)
        
        total_periods = int((end_date - start_date).total_seconds() / 3600 / period_hours)
        completed = 0
        
        try:
            while current < end_date:
                period_end = min(current + period_delta, end_date)
                
                logger.info(f"[{completed+1}/{total_periods}] Processing {current} to {period_end}")
                
                try:
                    self.calculate_and_store_metrics(current, period_end)
                    completed += 1
                except Exception as e:
                    logger.error(f"  Error processing period: {e}")
                    # Continue with next period
                
                current = period_end
            
            logger.info(f"Backfill complete! Processed {completed}/{total_periods} periods.")
            
        finally:
            self.db.close()