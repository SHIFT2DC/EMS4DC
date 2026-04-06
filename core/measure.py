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

@File: measure.py
@Description: TODO

@Created: 11 February 2026
@Last Modified: 01 April 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


from utils.logging_utils import setup_logging
from utils.time_utils import calculate_time_for_execution, current_time
import json
import time
import logging
from datetime import datetime

import psycopg2
from contextlib import contextmanager

# Dotenv variables
from dotenv import load_dotenv
import os

load_dotenv('./conf/.env')

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')

# Modbus reader
from data.measurements_client import ModbusDataReader


class MeasurementsManager:
    def __init__(self, modbus_config_dir, data_collection_interval=10):
        """
        Initialize measurements' client class.

        Args:
            modbus_config_dir: Path to `modbus.json` file which contains modbus parameters configuration
            data_collection_interval: The regular interval (in seconds) which defines how often
                                      measurements will be taken. E.g. every 10 seconds.
        """
        self.logger = logging.getLogger('measurements')
        self.data_collection_interval = data_collection_interval
        self.modbus_config_dir = modbus_config_dir
        self.modbus_config = self._load_modbus_config(modbus_config_dir)
        self.running = False

        # Single persistent ModbusDataReader instance shared across all collection cycles.
        # Its internal client pool keeps TCP connections alive and reconnects automatically
        # if a connection drops (see ModbusDataReader.get_client).
        self.modbus_reader = ModbusDataReader(modbus_config_dir)

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

    def _load_modbus_config(self, modbus_config_dir):
        """Import Modbus parameters configuration - `modbus.json`"""
        with open(modbus_config_dir, 'r') as file:
            modbus_config = json.load(file)
        return modbus_config

    def insert_measurements(self, data_to_insert):
        """Insert measurement data into database"""
        try:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.executemany("""
                    INSERT INTO measurements (measurement_id, time, parameter, value, unit, quality, asset_key)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, data_to_insert)
                conn.commit()
                cur.close()
                self.logger.debug(f"Inserted {len(data_to_insert)} measurements")
        except Exception as e:
            self.logger.error(f"Error inserting measurements: {e}")

    def collect_and_store_data(self):
        """Collect data via the persistent Modbus reader and store in database"""
        try:
            # Reuse the long-lived reader; get_client() handles reconnection internally
            data = self.modbus_reader.read_data_as_json()
            if isinstance(data, str):
                data = json.loads(data)

            now = current_time()
            data_to_insert_to_db = []

            param_id = 1
            for device in self.modbus_config.get("devices", []):
                asset_key = device.get("assetKey", "unknown_device")

                for param in device.get("parameters", []):
                    name = param.get("name")
                    unit = param.get("unit", "")

                    prefixed_name = f"{asset_key}_{name}"
                    value = data.get(prefixed_name, 0)

                    data_to_insert_to_db.append(
                        (param_id, now, prefixed_name, value, unit, 'ok', asset_key)
                    )
                    param_id += 1

            self.insert_measurements(data_to_insert_to_db)
            return True

        except Exception as e:
            self.logger.error(f"Error in data collection: {e}")
            return None

    def run_data_collection_loop(self):
        """Run continuous data collection loop"""
        self.running = True
        self.logger.info(f"Starting data collection loop with {self.data_collection_interval}s interval")
        try:
            while self.running:
                cycle_start = time.time()
                try:
                    measured_data = self.collect_and_store_data()
                    if measured_data:
                        self.logger.debug("Data collected and stored successfully")
                except Exception as e:
                    self.logger.error(f"Error in data collection cycle: {e}")

                execution_time = time.time() - cycle_start
                sleep_time = calculate_time_for_execution(interval_minutes=self.data_collection_interval / 60)

                if sleep_time > 0:
                    time.sleep(sleep_time)
                else:
                    self.logger.warning(
                        f"Data collection cycle took {execution_time:.2f}s, "
                        f"longer than {self.data_collection_interval}s interval"
                    )
        except KeyboardInterrupt:
            self.logger.info("Received keyboard interrupt, shutting down...")
        except Exception as e:
            self.logger.error(f"Unexpected error in measurements loop: {e}")
        finally:
            self.stop()

    def stop(self):
        """Stop the data collection loop and cleanly close all Modbus connections"""
        self.running = False
        self.modbus_reader.close_connections()
        self.logger.info("Data collection loop stopped")


if __name__ == "__main__":

    setup_logging()

    modbus_config_dir = './conf/modbus.json'

    measurements_client = MeasurementsManager(
        modbus_config_dir=modbus_config_dir,
        data_collection_interval=10
    )

    measurements_client.run_data_collection_loop()