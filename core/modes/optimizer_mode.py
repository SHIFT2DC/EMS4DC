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

@File: optimizer_mode.py
@Description: # TODO: Add desc

@Created: 1st July 2025
@Last Modified: 23 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


import logging
import json
from typing import Dict, Any
from dotenv import load_dotenv
import os

from data.modbus_writer import ModbusWriter
from utils.database_utils import DatabaseOperations
from optimization.optimizer import OptimizerRunner

load_dotenv('./../web-app/backend/.env')


class OptimizerMode:
    """
    Optimizer mode - runs the optimizer and writes direct power setpoints to
    devices via Modbus.

    No device drivers are used here.  The modbus_writer is responsible for
    knowing which register address corresponds to which (device, parameter)
    pair; this class only decides *what value* to write and under *which key*.

    Setpoint sign convention (consistent across all device types):
      Negative  → power flowing INTO the DC bus  (charging, consuming)
      Positive  → power flowing OUT OF the DC bus (discharging, generating)
    """

    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger('ems.optimizermode')
        self.config = config
        self.mode_name = "Optimizer Mode"

        db_config = {
            'host':     os.getenv('DB_HOST'),
            'port':     os.getenv('DB_PORT'),
            'database': os.getenv('DB_NAME'),
            'user':     os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
        }

        self.db_ops = DatabaseOperations(db_config, site_config=config)
        self.optimizer = OptimizerRunner(config)
        self.modbus_writer = ModbusWriter(config_file='./../web-app/backend/modbus.json')

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

    # ── Setpoint mapping ──────────────────────────────────────────────────────

    def map_optimizer_to_setpoints(
        self, optimizer_output: Dict[str, Any]
    ) -> Dict[str, Dict[str, float]]:
        """
        Convert per-device optimizer output into a flat dict of Modbus setpoints,
        keyed by asset_key.

        Optimizer output shape:
          {
            'imp': float, 'exp': float, ...                # aggregate scalars
            'afe':    { '<afe_id>':    { 'imp', 'exp', 'exp1', 'exp2' } },
            'pv':     { '<pv_id>':     { 'power' } },
            'wind':   { '<wind_id>':   { 'power' } },
            'load':   { '<load_id>':   { 'power' } },
            'cload':  { '<cload_id>':  { 'power' } },
            'bess':   { '<bess_id>':   { 'charge', 'discharge', 'level' } },
            'unidir': { '<uid>':       { 'charge', 'soc' } },
            'bidir':  { '<bid>':       { 'charge', 'discharge', 'soc' } },
          }

        Returned structure:
          {
            '<asset_key>': {
                'POWER_SETPOINT': float,   # signed kW, always present
                <extra keys depending on device type>
            },
            ...
          }

        Extra setpoint keys per device type:
          AFE   : EXPORT_SETPOINT, EXPORT_NON_SERVICE_SETPOINT, EXPORT_SERVICE_SETPOINT
          BESS  : LEVEL_SETPOINT (kWh)
          EV    : SOC_TARGET (%, converted from the optimizer's 0-1 fraction)
        """
        setpoints: Dict[str, Dict[str, float]] = {}

        # ── AFE ───────────────────────────────────────────────────────────────
        # Positive POWER_SETPOINT → import (draw from grid)
        # Negative POWER_SETPOINT → export (push to grid)
        for afe_id, d in optimizer_output.get('afe', {}).items():
            imp = d.get('imp', 0.0)
            exp = d.get('exp', 0.0)
            # Negative → drawing power from grid (import mode)
            # Positive → pushing power to grid (export mode)
            if imp != 0 and exp == 0:
                afe_power_setpoint = imp
            elif imp == 0 and exp != 0:
                afe_power_setpoint = -exp
            else:
                afe_power_setpoint = 0
            setpoints[afe_id] = {
                'POWER_SETPOINT':                round(afe_power_setpoint, 4),
            }

        # ── PV ────────────────────────────────────────────────────────────────
        # Negative → generation (power flows out of the panel)
        for pv_id, d in optimizer_output.get('pv', {}).items():
            setpoints[pv_id] = {
                'POWER_SETPOINT': round(d.get('power', 0.0), 4),
            }

        # ── Wind ──────────────────────────────────────────────────────────────
        for wind_id, d in optimizer_output.get('wind', {}).items():
            setpoints[wind_id] = {
                'POWER_SETPOINT': round(d.get('power', 0.0), 4),
            }

        # ── Load ──────────────────────────────────────────────────────────────
        # Load power consumed (setpoint = allowed consumption limit)
        for load_id, d in optimizer_output.get('load', {}).items():
            setpoints[load_id] = {
                'POWER_SETPOINT': round(d.get('power', 0.0), 4),
            }

        # ── Critical Load ─────────────────────────────────────────────────────
        for cload_id, d in optimizer_output.get('cload', {}).items():
            setpoints[cload_id] = {
                'POWER_SETPOINT': round(d.get('power', 0.0), 4),
            }

        # ── BESS ──────────────────────────────────────────────────────────────
        # Negative → charging, positive → discharging (the optimizer ensures
        # exactly one of charge/discharge is non-zero via the binary mode var)
        for bess_id, d in optimizer_output.get('bess', {}).items():
            charge    = d.get('charge',    0.0)
            discharge = d.get('discharge', 0.0)
            if charge != 0 and discharge == 0:
                bess_power_setpoint = -charge
            elif charge == 0 and discharge != 0:
                bess_power_setpoint = discharge
            else:
                bess_power_setpoint = 0 
            setpoints[bess_id] = {
                'POWER_SETPOINT': round(bess_power_setpoint, 4),
                'LEVEL_SETPOINT': round(d.get('level', 0.0), 4),
            }

        # ── Unidirectional EV chargers ────────────────────────────────────────
        # Always charging → positive setpoint
        for uid, d in optimizer_output.get('unidir', {}).items():
            setpoints[uid] = {
                'POWER_SETPOINT': round(d.get('charge', 0.0), 4),
                'SOC_TARGET':     round(d.get('soc', 0.0) * 100, 2),   # fraction → %
            }

        # ── Bidirectional EV chargers (V2G) ───────────────────────────────────
        # Positive → charging, negative → discharging (V2G)
        for bid, d in optimizer_output.get('bidir', {}).items():
            charge    = d.get('charge',    0.0)
            discharge = d.get('discharge', 0.0)
            if charge != 0 and discharge == 0:
                v2g_power_setpoint = -charge
            elif charge == 0 and discharge != 0:
                v2g_power_setpoint = discharge
            else:
                v2g_power_setpoint = 0 
            setpoints[bid] = {
                'POWER_SETPOINT': round(v2g_power_setpoint, 4),
                'SOC_TARGET':     round(d.get('soc', 0.0) * 100, 2),   # fraction → %
            }

        return setpoints

    # ── Setpoint application ──────────────────────────────────────────────────

    def apply_power_setpoints(self, optimizer_output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translate optimizer output to setpoints and write them directly to
        hardware via modbus_writer — no device drivers involved.

        Returns per-device application results:
          { '<asset_key>': { 'success': bool, 'setpoints': {...}, 'details': {...} } }
        """
        results: Dict[str, Any] = {}
        device_setpoints = self.map_optimizer_to_setpoints(optimizer_output)

        self.logger.debug(f"Writing setpoints for {len(device_setpoints)} devices")

        for asset_key, setpoints in device_setpoints.items():
            try:
                write_results = self.modbus_writer.write_setpoints(asset_key, setpoints)
                success = all(write_results.values())

                results[asset_key] = {
                    'success':   success,
                    'setpoints': setpoints,
                    'details':   write_results,
                }

                if success:
                    self.logger.debug(f"[{asset_key}] Setpoints written: {setpoints}")
                else:
                    failed = [k for k, v in write_results.items() if not v]
                    self.logger.warning(f"[{asset_key}] Failed to write registers: {failed}")

            except Exception as e:
                self.logger.error(f"[{asset_key}] Error writing setpoints: {e}")
                results[asset_key] = {'success': False, 'error': str(e)}

        return results

    # ── Main execute loop ─────────────────────────────────────────────────────

    def execute(self) -> Dict[str, Any]:
        """
        Execute optimizer mode:
          1. Fetch averaged + recent data from database
          2. Prepare and store optimizer inputs
          3. Run optimizer
          4. Store optimizer outputs
          5. Write direct power setpoints to all devices
        """
        self.logger.debug("Executing Optimizer Mode")

        try:
            averaged_data = self.db_ops.get_latest_15_min_interval()
            recent_data   = self.db_ops.get_most_recent_data()

            inputs = self.optimizer.prepare_inputs(averaged_data, recent_data)
            self.db_ops.insert_inputs_to_db(inputs)

            result = self.optimizer.run_optimization(inputs)

            if result['status'] == 'success':
                optimizer_output = result['output']
                self.db_ops.insert_outputs_to_db(optimizer_output, quality='ok')
                application_results = self.apply_power_setpoints(optimizer_output)

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
            self.logger.error(f"Error in optimizer mode execution: {e}")
            return {'status': 'error', 'mode': self.mode_name, 'message': str(e)}

    # ── Lifecycle helpers ─────────────────────────────────────────────────────

    def validate(self) -> bool:
        """Check optimizer is ready."""
        if not self.optimizer:
            self.logger.error("Optimizer not initialized")
            return False
        return True

    def cleanup(self):
        """Release resources."""
        if self.modbus_writer:
            self.modbus_writer.close()
            self.logger.info("Modbus writer closed")