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

File: afe_driver.py
Description: # TODO: Add desc

Created: 3rd February 2026
Last Modified: 3rd February 2026
Version: v1.2.0
'''


import json
import os
from .base_driver import BaseDeviceDriver, RegisterMapping
from typing import Dict, Any, Optional

MODBUS_CONFIG_PATH = '../../web-app/backend/modbus.json'
DEVICE_CONFIG_PATH = '../../web-app/backend/config.json'

class ActiveFrontEndDriver(BaseDeviceDriver):
    """Driver for Active Front End"""
    
    DEVICE_TYPE = "active_front_end"
    
    def __init__(self, device_id: str, config: str):
        """Initialize the driver and load device configuration"""
        super().__init__(device_id, config)
        self._device_config = self._load_device_config()
    
    def _load_device_config(self) -> Dict[str, Any]:
        """Load device configuration from config.json"""
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
        
        # Extract activeFrontEnd configuration
        afe_config = config.get('activeFrontEnd', {})
        
        return afe_config
    
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
        
        # Find the AFE device in the config
        for device in config.get('devices', []):
            if device.get('name') == 'AFE':
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
        Transform droop curve for Active Front End
        
        Args:
            optimizer_data: Dictionary containing optimizer values
                - imp: Power imported from AC grid to DC grid
                - exp: Power exported from DC grid to AC grid
                - exp1: Power exported from DC grid to AC grid (Non-Grid Service)   !TODO!: Grid-Service not implemented yet
                - exp2: Exported power from DC to AC (grid service)                 !TODO!: Grid-Service not implemented yet
            config_data: Optional override for device configuration. If None, uses loaded config
        
        Returns:
            Dictionary mapping register names (strings) to calculated values
        """

        # Use provided config_data or fall back to loaded configuration
        config = config_data if config_data is not None else self._device_config
        
        # Extract optimizer values
        import_from_ac_to_dc = optimizer_data.get('imp') * 1000
        export_from_dc_to_ac = optimizer_data.get('exp') * 1000
        
        # Extract config values
        v_upper = config.get('droopVoltageUpperLimit')
        v_lower = config.get('droopVoltageLowerLimit')
        p_supply_limit = config.get('droopPowerSupplyLimit')
        p_consume_limit = config.get('droopPowerConsumeLimit')
        v_nom = config.get('nominalVoltageDCBus')
        
        fw_volt_ofst = 5 # 5 V Deadband
        re_volt_ofst = 5 # 5 V Deadband
        
        # Handle case when optimizer decides to import power from AC to DC
        if import_from_ac_to_dc > 0 and export_from_dc_to_ac == 0: 
            # Define a point of intersection of (-imp; v_nom)-(p_supply_limit; v_upper) line with y axis    
            y_intersect = v_nom + (v_upper - v_nom) * (0 - (-import_from_ac_to_dc)) / (p_supply_limit - (-import_from_ac_to_dc))

            # y_at_P_min - will be the point from (0; y_intersect) to (-p_consume_limit, y_at_P_min) so that the curve doesnt break and goes straight to DevicePowerLimit
            y_at_P_min = v_nom + ((y_intersect) - v_nom) * ((-import_from_ac_to_dc) - (-p_consume_limit)) / ((-import_from_ac_to_dc) - 0)
            
            # Find by what value the nominal voltage of the DC bus (v_nom) has to be shifted 
            volt_ofst = (y_intersect + re_volt_ofst) - v_nom
            
            fw_volt_delta = y_intersect - y_at_P_min
            re_volt_delta = v_upper - (y_intersect + re_volt_ofst + fw_volt_ofst) 
            fw_p_max = p_supply_limit
            re_p_max = p_consume_limit

        # Handle case when optimizer decides to export power from DC to AC
        elif export_from_dc_to_ac > 0 and import_from_ac_to_dc == 0:
            # Define a point of intersection of (exp; v_nom)-(-p_consume_limit; v_lower) line with y axis
            y_intersect = v_nom + (v_nom - v_lower) * (0 - export_from_dc_to_ac) / (export_from_dc_to_ac - (-p_consume_limit))

            # Define a point which will be the point from (0; y_intersect) to (p_supply_limit, y_at_P_max) so that the curve doesnt break and goes straight to p_supply_limit
            y_at_P_max = v_nom + (v_nom - (y_intersect)) * (p_supply_limit - export_from_dc_to_ac) / (export_from_dc_to_ac - 0)

            # Find by what value the nominal voltage of the DC bus (v_nom) has to be shifted 
            volt_ofst = (y_intersect - re_volt_ofst) - v_nom 

            fw_volt_delta = (y_intersect - re_volt_ofst - fw_volt_ofst) - v_lower
            re_volt_delta = y_at_P_max - y_intersect
            fw_p_max = p_supply_limit
            re_p_max = p_consume_limit

        # Handle case when optimizer decides to "disable" AFE
        elif export_from_dc_to_ac == 0 and import_from_ac_to_dc == 0:
            volt_ofst = 0
            fw_volt_delta = (v_nom - fw_volt_ofst) - v_lower
            re_volt_delta = v_upper - (v_nom + re_volt_ofst)
            fw_p_max = p_supply_limit
            re_p_max = p_consume_limit

        # Handle unexpected cases
        else:
            volt_ofst = 0
            fw_volt_delta = (v_nom - fw_volt_ofst) - v_lower
            re_volt_delta = v_upper - (v_nom + re_volt_ofst)
            fw_p_max = p_supply_limit
            re_p_max = p_consume_limit

        # Create the return dictionary with register names as keys
        droop_curve_registers = {
            "FW_VOLT_OFST": fw_volt_ofst,
            "FW_VOLT_DELTA": fw_volt_delta,
            "RE_VOLT_OFST": re_volt_ofst,
            "RE_VOLT_DELTA": re_volt_delta,
            "VOLT_OFST": volt_ofst,
            "FW_P_MAX": fw_p_max,
            "RE_P_MAX": re_p_max
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


# Test/Debug block
if __name__ == "__main__":
    print("Initializing Active Front End Driver...")
    
    # Initialize the driver
    try:
        driver = ActiveFrontEndDriver(
            device_id="1",
            config="1"
        )
        
        # Get available registers
        registers = driver.get_available_registers()
        print(f"\nFound {len(registers)} write-mode registers:")
        print("-" * 80)
        
        for key, mapping in registers.items():
            print(f"\nRegister Key: {key}")
            print(f"  Name: {mapping.name}")
            print(f"  Address: {mapping.address}")
            print(f"  Scale Factor: {mapping.scale_factor}")
            print(f"  Unit: {mapping.unit}")
        
        # Get device configuration
        print("\n" + "=" * 80)
        print("Device Configuration:")
        print("-" * 80)
        device_config = driver.get_device_config()
        print(f"Number of keys in config: {len(device_config)}")
        print(f"Keys: {list(device_config.keys())}")
        print()
        for key, value in device_config.items():
            print(f"  {key}: {value}")
        
        # Test droop curve transformation
        print("\n" + "=" * 80)
        print("Testing Droop Curve Transformation:")
        print("-" * 80)
        
        optimizer_data = {
            'imp': 10000,
            'exp': 0,
            'exp1': 0,
            'exp2': 0
        }
        
        print(f"\nOptimizer Data: {optimizer_data}")
        
        droop_registers = driver.transform_droop_curve(optimizer_data)
        
        print("\nCalculated Register Values:")
        for register_name, value in droop_registers.items():
            register_mapping = driver._register_map.get(register_name)
            if register_mapping:
                print(f"  {register_mapping.name} (addr: {register_mapping.address}): {value} {register_mapping.unit}")
            else:
                print(f"  {register_name}: {value}")
            
    except Exception as e:
        print(f"Error initializing driver: {e}")
        import traceback
        traceback.print_exc()