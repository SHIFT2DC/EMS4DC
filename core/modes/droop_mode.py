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

@File: droop_mode.py
@Description: # TODO: Add desc

@Created: 3rd February 2026
@Last Modified: 27 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


import logging
from typing import Dict, Any, Type
from dotenv import load_dotenv
import os

# ── Import your droop driver classes here ────────────────────────────────────
# Create one driver file + class per device (any naming convention you like)
# and import them here. Only devices listed in _ASSIGN_DRIVERS_ below will
# receive droop-curve setpoints.
#
# Example imports:
from drivers.afe_driver import ActiveFrontEndDriver
from drivers.bess_driver import BESSDriver
# from drivers.ev1_driver import DriverEV1
# from drivers.ev2_driver import DriverEV2

from data.modbus_writer import ModbusWriter
from utils.database_utils import DatabaseOperations
from optimization.optimizer import OptimizerRunner

load_dotenv('./conf/.env')


# ── USER CONFIGURATION ────────────────────────────────────────────────────────
# Map each asset key (must match the device 'id' in config.json) to the droop
# driver class that should handle it.  Add one entry per physical device.
#
# Example:
#   _ASSIGN_DRIVERS_ = {
#       'afe1':  ActiveFrontEndDriver,
#       'bess1': DriverBESS1,
#       'bess2': DriverBESS2,
#       'ev1':   DriverEV1,
#   }
_ASSIGN_DRIVERS_: Dict[str, Type] = {
    'afe1':  ActiveFrontEndDriver,
    'bess1': BESSDriver,
}
# ─────────────────────────────────────────────────────────────────────────────


class DroopMode:
    """
    Droop control mode - runs the optimizer and applies results as droop curve
    parameters to each device via its dedicated driver.

    Driver assignment is intentionally manual: the user imports their own
    per-device driver classes and registers them against the matching asset key
    in _ASSIGN_DRIVERS_ above.  DroopMode instantiates each class at startup
    and dispatches transform_droop_curve() / apply_setpoints() at runtime.
    """

    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger('ems.droopmode')
        self.config = config
        self.mode_name = "Droop Mode"

        db_config = {
            'host':     os.getenv('DB_HOST'),
            'port':     os.getenv('DB_PORT'),
            'database': os.getenv('DB_NAME'),
            'user':     os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
        }

        self.db_ops = DatabaseOperations(db_config, site_config=config)
        self.optimizer = OptimizerRunner(config)
        self.modbus_writer = ModbusWriter(config_file='./conf/modbus.json')

        # Instantiated driver objects keyed by asset_key
        self.drivers: Dict[str, Any] = self._initialize_drivers()

    # ── Driver setup ──────────────────────────────────────────────────────────

    def _initialize_drivers(self) -> Dict[str, Any]:
        """
        Instantiate every driver class declared in _ASSIGN_DRIVERS_.
        Each class is called with (device_id=<asset_key>, config=<full config>).
        """
        drivers: Dict[str, Any] = {}
        for asset_key, driver_cls in _ASSIGN_DRIVERS_.items():
            try:
                drivers[asset_key] = driver_cls(device_id=asset_key, config=self.config)
                self.logger.debug(
                    f"Initialized droop driver '{driver_cls.__name__}' for '{asset_key}'"
                )
            except Exception as e:
                self.logger.error(
                    f"Failed to initialize droop driver '{driver_cls.__name__}' "
                    f"for '{asset_key}': {e}"
                )
        return drivers

    # ── Error output ──────────────────────────────────────────────────────────

    def _create_error_output(self) -> Dict[str, Any]:
        """
        Build an error output dict mirroring the full multi-device optimizer
        output structure, with -1 for every value, derived from config.
        """
        error: Dict[str, Any] = {
            'obj': -1, 'imp': -1, 'exp': -1, 'exp1': -1, 'exp2': -1,
            'afe': {}, 'pv': {}, 'wind': {}, 'load': {}, 'cload': {},
            'bess': {}, 'unidir': {}, 'bidir': {},
        }

        _template = {
            'AFE':           ('afe',    {'imp': -1, 'exp': -1, 'exp1': -1, 'exp2': -1}),
            'PV':            ('pv',     {'power': -1}),
            'WIND':          ('wind',   {'power': -1}),
            'LOAD':          ('load',   {'power': -1}),
            'CRITICAL_LOAD': ('cload',  {'power': -1}),
            'BESS':          ('bess',   {'charge': -1, 'discharge': -1, 'level': -1}),
            'UNI_EV':        ('unidir', {'charge': -1, 'soc': -1}),
            'BI_EV':         ('bidir',  {'charge': -1, 'discharge': -1, 'soc': -1}),
        }

        for device in self.config.get('devices', []):
            dtype = device.get('type', '')
            if dtype in _template:
                group, template = _template[dtype]
                error[group][device['id']] = dict(template)

        return error

    # ── Droop-curve application ───────────────────────────────────────────────

    def apply_droop_curves(self, optimizer_output: Dict[str, Any]) -> Dict[str, Any]:
        """
        For each asset key in _ASSIGN_DRIVERS_, extract the relevant slice from
        the optimizer output, pass it to the driver's transform_droop_curve(),
        and write the resulting registers via apply_setpoints().

        The optimizer output contains per-device dicts nested by type group
        ('afe', 'bess', 'unidir', etc.).  A flat {asset_key -> device_data}
        lookup is built first for convenient dispatching.
        """
        results: Dict[str, Any] = {}

        # Flatten all per-device output dicts into a single lookup
        device_slices: Dict[str, Any] = {}
        for group in ('afe', 'pv', 'wind', 'load', 'cload', 'bess', 'unidir', 'bidir'):
            for asset_key, device_data in optimizer_output.get(group, {}).items():
                device_slices[asset_key] = device_data

        for asset_key, driver in self.drivers.items():
            device_data = device_slices.get(asset_key)
            if device_data is None:
                self.logger.warning(
                    f"[{asset_key}] No optimizer output found — "
                    f"verify the asset key matches the device id in config.json"
                )
                results[asset_key] = {'success': False, 'error': 'No optimizer output'}
                continue

            try:
                droop_registers = driver.transform_droop_curve(device_data)
                self.logger.debug(f"[{asset_key}] Droop registers: {droop_registers}")

                write_results = driver.apply_setpoints(droop_registers, self.modbus_writer)
                total = len(write_results)
                success_count = sum(1 for v in write_results.values() if v)
                success = success_count == total

                results[asset_key] = {'success': success, 'details': write_results}

                if success:
                    self.logger.debug(f"[{asset_key}] Droop curve applied successfully")
                else:
                    self.logger.warning(
                        f"[{asset_key}] Droop curve partially applied: "
                        f"{success_count}/{total} registers written"
                    )

            except Exception as e:
                self.logger.error(f"[{asset_key}] Error applying droop curve: {e}")
                results[asset_key] = {'success': False, 'error': str(e)}

        return results

    # ── Main execute loop ─────────────────────────────────────────────────────

    def execute(self) -> Dict[str, Any]:
        """
        Execute droop mode:
          1. Fetch averaged + recent data from database
          2. Prepare and store optimizer inputs
          3. Run optimizer
          4. Store optimizer outputs
          5. Apply droop curves to all assigned devices
        """
        self.logger.debug("Executing Droop Mode")

        try:
            averaged_data = self.db_ops.get_latest_15_min_interval()
            recent_data   = self.db_ops.get_most_recent_data()

            inputs = self.optimizer.prepare_inputs(averaged_data, recent_data)
            self.db_ops.insert_inputs_to_db(inputs)

            result = self.optimizer.run_optimization(inputs)

            if result['status'] == 'success':
                optimizer_output = result['output']
                self.db_ops.insert_outputs_to_db(optimizer_output, quality='ok')
                application_results = self.apply_droop_curves(optimizer_output)

                return {
                    'status': 'success',
                    'mode': self.mode_name,
                    'optimizer_output': optimizer_output,
                    'application_results': application_results,
                }

            else:
                self.logger.error(f"Optimizer failed: {result.get('message', 'Unknown error')}")
                error_output = self._create_error_output()
                self.db_ops.insert_outputs_to_db(error_output, quality='error')

                return {
                    'status': 'error',
                    'mode': self.mode_name,
                    'message': result.get('message', 'Optimizer failed'),
                    'optimizer_output': error_output,
                }

        except Exception as e:
            self.logger.error(f"Error in droop mode execution: {e}")
            return {'status': 'error', 'mode': self.mode_name, 'message': str(e)}

    # ── Lifecycle helpers ─────────────────────────────────────────────────────

    def validate(self) -> bool:
        """Check that all assigned drivers initialised and optimizer is ready."""
        for asset_key, driver in self.drivers.items():
            if driver is None:
                self.logger.error(f"Driver for '{asset_key}' not initialized")
                return False
        if not self.optimizer:
            self.logger.error("Optimizer not initialized")
            return False
        return True

    def cleanup(self):
        """Release resources."""
        if self.modbus_writer:
            self.modbus_writer.close()
            self.logger.info("Modbus writer closed")