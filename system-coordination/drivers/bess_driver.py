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

File: bess_driver.py
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

class BESSDriver(BaseDeviceDriver):
    """Driver for BESS"""
    
    DEVICE_TYPE = "device_bess"
    
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
        
        # Extract bess configuration from config.json file
        device_bess_config = config.get('bess', {})
        
        return device_bess_config
    
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
        
        # Find the BESS in the config
        for device in config.get('devices', []):
            if device.get('name') == 'BESS':
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
        This is the function which constructs a droop curve with given optimizer output and BESS registers according to datasheet.
                
        Args:
            optimizer_data: Dictionary containing optimizer values
                - bc: Battery charging power
                - bd: Battery discharging power
            config_data: Optional override for device configuration. If None, uses loaded config
        
        Returns:
            Dictionary mapping register names (strings) to calculated values
        """

        # Use provided config_data or fall back to loaded configuration
        config = config_data if config_data is not None else self._device_config
        
        # Extract optimizer values
        battery_charge = optimizer_data.get('bc') * 1000
        battery_discharge = optimizer_data.get('bd') * -1000
        
        # Extract config values
        v_nom = config.get('nominalVoltageDCBus')
        voltage_deadband = config.get('droopVoltageDeadband')
        charge_p_max = config.get('maxChargePower')
        discharge_p_max = config.get('maxDischargePower')
        
        # Define BESS max/min voltage according to the manual (V_NOM +/- DEADBAND/2 +/- 25):
        bess_max_voltage = v_nom + voltage_deadband/2 + 25
        bess_min_voltage = v_nom - voltage_deadband/2 - 25
        
        # Handle case when optimizer decides to charge the BESS (take power from AC to DC)
        if battery_charge > 0 and battery_discharge == 0: 
            # Define a new "nominal DC bus votlage" which was casued by shifting the droop curve
            v_nom_new = (v_nom + voltage_deadband / 2) + battery_charge / charge_p_max * (bess_max_voltage - v_nom - voltage_deadband/2)

            soc_0_char_volt = v_nom_new + voltage_deadband / 2
            soc_0_disch_volt = v_nom_new - voltage_deadband / 2
            soc_100_char_volt = v_nom_new + voltage_deadband / 2
            soc_100_disch_volt = v_nom_new - voltage_deadband / 2
            charge_p = charge_p_max
            discharge_p = discharge_p_max
            conv_ofst = 0

        # Handle case when optimizer decides to discharge the BESS (give power from DC to AC)
        elif battery_discharge > 0 and battery_charge == 0:
            # Define a new "nominal DC bus votlage" which was casued by shifting the droop curve
            v_nom_new = (v_nom + voltage_deadband / 2) - battery_discharge / discharge_p_max * (bess_min_voltage - v_nom - voltage_deadband / 2)

            soc_0_char_volt = v_nom_new + voltage_deadband / 2
            soc_0_disch_volt = v_nom_new - voltage_deadband / 2
            soc_100_char_volt = v_nom_new + voltage_deadband / 2
            soc_100_disch_volt = v_nom_new - voltage_deadband / 2
            charge_p = charge_p_max
            discharge_p = discharge_p_max
            conv_ofst = 0

        # Handle case when optimizer decides to "disable" BESS
        elif battery_discharge == 0 and battery_charge == 0:
            charge_p = charge_p_max
            discharge_p = discharge_p_max
            soc_0_char_volt = v_nom + voltage_deadband/2
            soc_0_disch_volt = v_nom - voltage_deadband/2
            soc_100_char_volt = v_nom + voltage_deadband/2
            soc_100_disch_volt = v_nom - voltage_deadband/2
            conv_ofst = 0

        # Handle unexpected cases
        else:
            charge_p = charge_p_max
            discharge_p = discharge_p_max
            soc_0_char_volt = v_nom + voltage_deadband/2
            soc_0_disch_volt = v_nom - voltage_deadband/2
            soc_100_char_volt = v_nom + voltage_deadband/2
            soc_100_disch_volt = v_nom - voltage_deadband/2
            conv_ofst = 0

        # Create the return dictionary with register names as keys
        droop_curve_registers = {
            "CHARGE_P": charge_p,
            "DISCHARGE_P": discharge_p,
            "SOC_0_CHAR_V": soc_0_char_volt,
            "SOC_0_DISCH_V": soc_0_disch_volt,
            "SOC_100_CHAR_V": soc_100_char_volt,
            "SOC_100_DISCH_V": soc_100_disch_volt,
            "CONV_OFST": conv_ofst
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
        driver = BESSDriver(
            device_id="2",
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
            'bc': 2,
            'bd': 0
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