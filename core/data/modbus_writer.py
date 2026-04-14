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

@File: modbus_writer.py
@Description: # TODO: Add desc

@Created: 3rd February 2026
@Last Modified: 17 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
'''


import logging
from typing import Dict, Any, Optional
from data.measurements_client import ModbusDataReader
from utils.logging_utils import setup_logging
setup_logging

logger = logging.getLogger(__name__)

class ModbusWriter:
    """
    High-level interface for writing setpoints to Modbus devices
    """
    
    def __init__(self, config_file='modbus.json'):
        """
        Initialize the Modbus writer
        
        Args:
            config_file: Path to modbus configuration file
        """
        self.reader = ModbusDataReader(config_file)
        self.logger = logging.getLogger('ems.modbuswriter')
    
    def write_setpoints(self, device_assetKey: str, setpoints: Dict[str, float]) -> Dict[str, bool]:
        """
        Write setpoints to a device
        
        Args:
            device_assetKey: Unique identifier of the device (e.g., 'afe1', 'bess1')
            setpoints: Dictionary mapping parameter names to values
                      e.g., {'FW_VOLT_OFST': 5.0, 'RE_VOLT_DELTA': 50.0}
        
        Returns:
            Dictionary mapping parameter names to success status
        """
        self.logger.debug(f"Writing {len(setpoints)} setpoints to {device_assetKey}")
        
        results = {}
        for param_name, value in setpoints.items():
            try:
                success = self.reader.write_single_register(device_assetKey, param_name, value)
                results[param_name] = success
                
                if success:
                    self.logger.debug(f"  ✓ {param_name}: {value}")
                else:
                    self.logger.warning(f"  ✗ {param_name}: {value} (failed)")
                    
            except Exception as e:
                self.logger.error(f"Error writing {param_name}: {e}")
                results[param_name] = False
        
        success_count = sum(1 for v in results.values() if v)
        self.logger.debug(f"Wrote {success_count}/{len(setpoints)} setpoints successfully")
        
        return results
    
    def write_device_setpoints_batch(self, device_setpoints: Dict[str, Dict[str, float]]) -> Dict[str, Dict[str, bool]]:
        """
        Write setpoints to multiple devices
        
        Args:
            device_setpoints: Dictionary mapping device names to their setpoints
                            e.g., {
                                'AFE': {'FW_VOLT_OFST': 5.0, ...},
                                'BESS': {'POWER_SETPOINT': 10.0, ...}
                            }
        
        Returns:
            Dictionary mapping device names to their write results
        """
        results = {}
        for device_assetKey, setpoints in device_setpoints.items():
            results[device_assetKey] = self.write_setpoints(device_assetKey, setpoints)
        return results
    
    def close(self):
        """Close all Modbus connections"""
        if self.reader:
            self.reader.close_connections()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()