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

@File: pv_driver.py
@Description: TODO

@Created: 19 March 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''

import json
import os
from .base_driver import BaseDeviceDriver, RegisterMapping
from typing import Dict, Any, Optional

MODBUS_CONFIG_PATH = './../conf/modbus.json'
DEVICE_CONFIG_PATH = './../conf/config.json'

class PVDriver(BaseDeviceDriver):
    """Driver for PV"""
    
    def __init__(self, device_id: str, config: str):
        """Initialize the driver and load device configuration"""
        super().__init__(device_id, config)
        self._device_config = self._load_device_config()
        self.DEVICE_TYPE = "PV"
    
    def _load_device_config(self, asset_key: str = "pv1") -> Dict[str, Any]:
        """
        Load device configuration from config.json for a specific asset
        
        Args:
            asset_key: The device ID to extract configuration for (default: "assetUniqueID")
            
        Returns:
            Dictionary containing the device parameters, or empty dict if not found
        """
        config_path = os.path.join(os.path.dirname(__file__), DEVICE_CONFIG_PATH)
        
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
        except FileNotFoundError:
            print(f"Warning: Config file not found at {config_path}")
            return {}
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in config file at {config_path}")
            return {}
        
        # Extract device configuration by asset key
        devices = config.get('devices', [])
        
        # Find the device with matching ID
        for device in devices:
            if device.get('id') == asset_key:
                return device.get('parameters', {})
        
        # If device not found, print warning and return empty dict
        print(f"Warning: Device with ID '{asset_key}' not found in config")
        return {}
    
    def get_device_config(self) -> Dict[str, Any]:
        """Get the loaded device configuration"""
        return self._device_config.copy()
    
    def _load_write_parameters(self) -> Dict[str, RegisterMapping]:
        """Load write-mode parameters from modbus.json"""
        config_path = os.path.join(os.path.dirname(__file__), MODBUS_CONFIG_PATH)
        
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
        except FileNotFoundError:
            print(f"Warning: Config file not found at {config_path}")
            return {}
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in config file at {config_path}")
            return {}
        
        register_mappings = {}
        
        # Find the Device X in the config
        for device in config.get('devices', []):
            if device.get('assetKey') == 'pv1':
                # Extract write-mode parameters
                for param in device.get('parameters', []):
                    if param.get('mode') == 'write':
                        # Create a key from the parameter name
                        key = param['name']
                        
                        # Create RegisterMapping from parameter config
                        register_mappings[key] = RegisterMapping(
                            address=param['address'],
                            name=param['name'],
                            scale_factor=param.get('scaleFactor', 1),
                            unit=param.get('unit', ''),
                            # more fields can be added as needed based on RegisterMapping class
                        )
                break
        
        return register_mappings
    
    def _initialize_registers(self) -> None:
        """Initialize registers from modbus.json config"""
        # Load write-mode parameters from config file
        loaded_registers = self._load_write_parameters()
        
        # Initialize with loaded registers
        self._register_map = loaded_registers
        
    def get_available_registers(self) -> Dict[str, RegisterMapping]:
        """Get all available register mappings"""
        return self._register_map.copy()
    
    def transform_droop_curve(self, optimizer_data: Dict[str, float], config_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        This is droop curve transformation for PV converter
        
        Args:
            optimizer_data: Dictionary containing optimizer values
                - pv: Power allowed to provide by PV
            config_data: Optional override for device configuration. If None, uses loaded config
        
        Returns:
            Dictionary mapping register names (strings) to calculated values
        """
        NOMINAL_VOLTAGE_DC_BUS = 700
        v_nom = NOMINAL_VOLTAGE_DC_BUS

        # Use provided config_data or fall back to loaded configuration
        config = config_data if config_data is not None else self._device_config
        
        # Extract optimizer values
        pv_power = optimizer_data.get('power') * 1000
        
        # Extract config values
        v_upper = config.get('droopVoltageUpperLimit')
        
        current_limit = pv_power / v_nom
        charge_voltage = v_upper
        droop_control = 500

        # Create the return dictionary with register names as keys
        droop_curve_registers = {
            "CURRENT_LIMIT": current_limit,
            "CHARGE_VOLTAGE": charge_voltage,
            "DROOP_CONTROL": droop_control
        }
        
        return droop_curve_registers
        
    def validate_setpoints(self, setpoints: Dict[str, float]) -> bool:
        """Validate setpoints are within device limits"""
        # Add validation logic based on device config
        config = self._device_config
        
        if 'power' in setpoints:
            max_power = config.get('nominalPower', float('inf'))
            if not -max_power <= setpoints['power'] <= max_power:
                return False
        
        if 'voltage' in setpoints:
            min_voltage = config.get('minVoltage', 0)
            max_voltage = config.get('maxVoltage', float('inf'))
            if not min_voltage <= setpoints['voltage'] <= max_voltage:
                return False
        
        return True