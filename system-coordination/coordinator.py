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

File: coordinator.py
Description: # TODO: Add desc

Created: 1st July 2025
Last Modified: 30th October 2025
Version: v1.0.0
'''


from time_utils import calculate_time_for_execution
import json
import time
import logging
import threading
from datetime import datetime
import importlib
from modeOptimizer import OptimizerMode
import droopMode
import psycopg2
from contextlib import contextmanager

# Dotenv variables
from dotenv import load_dotenv
import os

load_dotenv('./../web-app/backend/.env')

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')

# Modbus reader
from fetchMeasurements import ModbusDataReader

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class DatabaseManager:
    """Handles database connections and operations"""
    
    def __init__(self):        
        self.logger = logging.getLogger('ems.database')
        
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = None
        try:
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD
            )
            yield conn
        except Exception as e:
            self.logger.error(f"Database connection error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def insert_measurements(self, data_to_insert):
        """Insert measurement data into database"""
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.executemany("""
                    INSERT INTO measurements (measurement_id, time, parameter, value, unit, quality)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, data_to_insert)
                conn.commit()
                cur.close()
                self.logger.debug(f"Inserted {len(data_to_insert)} measurements")
        except Exception as e:
            self.logger.error(f"Error inserting measurements: {e}")


class DataCollector:
    """Handles API data collection and database insertion"""
    
    def __init__(self, database_manager):
        self.database_manager = database_manager
        self.logger = logging.getLogger('ems.datacollector')
        self.running = False

    
    def collect_and_store_data(self):
        """Collect data via Modbus and store in database"""
        try:
            # Read config file (modbus.json)
            with open('../web-app/backend/modbus.json', 'r') as f:
                modbus_config = json.load(f)

            # Read Modbus data
            modbus_reader = ModbusDataReader('../web-app/backend/modbus.json')
            data = modbus_reader.read_data_as_json()
            if isinstance(data, str):
                data = json.loads(data)

            current_time = datetime.now()
            data_to_insert_to_db = []

            param_id = 1
            for device in modbus_config.get("devices", []):
                device_name = device.get("name", "unknown_device")
                
                for param in device.get("parameters", []):
                    name = param.get("name")
                    unit = param.get("unit", "")

                    # Create prefixed parameter name
                    prefixed_name = f"{device_name}_{name}"

                    # Get the raw value from data
                    value = data.get(prefixed_name, 0)

                    # Append tuple (id, timestamp, name, value, unit, status)
                    data_to_insert_to_db.append(
                        (param_id, current_time, prefixed_name, value, unit, 'ok')
                    )
                    param_id += 1

            # Insert into database
            self.database_manager.insert_measurements(data_to_insert_to_db)
            return True

        except Exception as e:
            self.logger.error(f"Error in data collection: {e}")
            return None
    
    def run_data_collection_loop(self, interval_seconds=2):
        """Run continuous data collection loop"""
        self.running = True
        self.logger.info(f"Starting data collection loop with {interval_seconds}s interval")
        
        while self.running:
            cycle_start = time.time()
            
            try:
                hmi_data = self.collect_and_store_data()
                if hmi_data:
                    self.logger.debug(f"Data collected: {json.dumps(hmi_data)}")
            except Exception as e:
                self.logger.error(f"Error in data collection cycle: {e}")
            
            # Calculate sleep time to maintain consistent interval
            execution_time = time.time() - cycle_start
            sleep_time = max(0, interval_seconds - execution_time)
            
            if sleep_time > 0:
                time.sleep(sleep_time)
            else:
                self.logger.warning(f"Data collection cycle took {execution_time:.2f}s, longer than {interval_seconds}s interval")
    
    def stop(self):
        """Stop the data collection loop"""
        self.running = False
        self.logger.info("Data collection loop stopped")


class Coordinator:
    def __init__(self, config):
        self.config = config
        self.current_mode = None
        self.modes = {
            'optimizer': OptimizerMode(config),
            # 'rulebased': ruleBasedMode(config),
        }
        self.logger = self._setup_logging()
        
        # Initialize database and data collection components
        self.database_manager = DatabaseManager()
        self.data_collector = DataCollector(self.database_manager)
        
        # Threading control
        self.data_collection_thread = None
        self.running = False

    def _setup_logging(self):
        logger = logging.getLogger('ems')
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        return logger

    def select_mode(self):
        """Evaluate conditions and select appropriate mode"""
        if self._should_use_optimizer():
            return 'optimizer'
        else:
            return 'rulebased'

    def _should_use_optimizer(self):
        """Logic to determine if optimizer mode should be used"""
        return True  # Placeholder

    def run_cycle(self):
        """Execute a single coordination cycle"""
        self.logger.info("Starting coordination cycle")

        # Select mode for this cycle
        selected_mode = self.select_mode()

        # If mode changed, log it
        if self.current_mode != selected_mode:
            self.logger.info(f"Switching from {self.current_mode} to {selected_mode} mode")
            self.current_mode = selected_mode

        # Execute the selected mode
        try:
            if selected_mode == 'optimizer':
                result = self.modes[selected_mode].execute()
                self.logger.info(f"Executed {selected_mode} mode: {result}")
        except Exception as e:
            self.logger.error(f"Error executing {selected_mode} mode: {e}")
            # Implement fallback behavior here if needed

    def start_data_collection(self, interval_seconds=2):
        """Start the data collection thread"""
        if self.data_collection_thread is None or not self.data_collection_thread.is_alive():
            self.data_collection_thread = threading.Thread(
                target=self.data_collector.run_data_collection_loop,
                args=(interval_seconds,),
                daemon=True,
                name="DataCollectionThread"
            )
            self.data_collection_thread.start()
            self.logger.info("Data collection thread started")
        else:
            self.logger.warning("Data collection thread is already running")

    def stop_data_collection(self):
        """Stop the data collection thread"""
        if self.data_collector:
            self.data_collector.stop()
        if self.data_collection_thread and self.data_collection_thread.is_alive():
            self.data_collection_thread.join(timeout=5)
            self.logger.info("Data collection thread stopped")

    def run(self, data_collection_interval=15):
        """Main coordination loop with data collection"""
        self.logger.info("EMS Starting")
        self.running = True
        
        try:
            # Start data collection in background thread
            self.start_data_collection(data_collection_interval)
            
            # Main coordination loop (15-minute cycles)
            while self.running:
                cycle_start = time.time()
                
                self.run_cycle()
                
                # Calculate sleep time to maintain consistent cycle time
                execution_time = time.time() - cycle_start
                sleep_time = calculate_time_for_execution(interval_minutes=15)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
        except KeyboardInterrupt:
            self.logger.info("Received keyboard interrupt, shutting down...")
        except Exception as e:
            self.logger.error(f"Unexpected error in main loop: {e}")
        finally:
            self.shutdown()

    def shutdown(self):
        """Clean shutdown of all components"""
        self.logger.info("Shutting down coordinator...")
        self.running = False
        self.stop_data_collection()
        self.logger.info("Coordinator shutdown complete")


if __name__ == "__main__":
    # Example configuration
    with open('./../web-app/backend/config.json', 'r') as file:
        config = json.load(file)
    
    coordinator = Coordinator(config)
    coordinator.run(data_collection_interval=10)  # 10-second data collection interval