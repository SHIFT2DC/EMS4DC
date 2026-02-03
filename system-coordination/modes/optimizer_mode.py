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

File: optimizer_mode.py
Description: # TODO: Add desc

Created: 1st July 2025
Last Modified: 3rd February 2026
Version: v1.2.0
'''


import logging
import json
from typing import Dict, Any
from dotenv import load_dotenv
import os

from drivers.afe_driver import ActiveFrontEndDriver
from data.modbus_writer import ModbusWriter
from utils.database_utils import DatabaseOperations
from utils.optimizer_utils import OptimizerRunner

load_dotenv('./../web-app/backend/.env')

class OptimizerMode:
    """
    Optimizer mode - runs optimizer and applies results as direct power setpoints
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger('ems.optimizermode')
        self.config = config
        self.mode_name = "Optimizer Mode"
        
        # Database configuration
        db_config = {
            'host': os.getenv('DB_HOST'),
            'port': os.getenv('DB_PORT'),
            'database': os.getenv('DB_NAME'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD')
        }
        
        # Initialize shared utilities
        self.db_ops = DatabaseOperations(db_config)
        self.optimizer = OptimizerRunner(config)
                
        # Initialize device drivers
        self.drivers = {
            'AFE': ActiveFrontEndDriver(device_id='AFE', config=config),
            # Add more drivers as needed:
            # 'BESS': BESSDriver(device_id='BESS', config=config),
            # 'EV_CHARGER_1': EVChargerDriver(device_id='EV_CHARGER_1', config=config),
            # 'EV_CHARGER_2': EVChargerDriver(device_id='EV_CHARGER_2', config=config),
        }
        
        # Initialize Modbus writer
        self.modbus_writer = ModbusWriter(config_file='./../web-app/backend/modbus.json')
    
    def map_optimizer_to_setpoints(self, optimizer_output: Dict[str, float]) -> Dict[str, Dict[str, float]]:
        """
        Map optimizer outputs to device power setpoints
        
        Args:
            optimizer_output: Dictionary containing optimizer results
        
        Returns:
            Dictionary mapping device names to their setpoints
            e.g., {
                'AFE': {'POWER_SETPOINT': 10.5},
                'BESS': {'POWER_SETPOINT': 5.2},
                'EV_CHARGER_1': {'POWER_SETPOINT': 7.0}
            }
        """
        device_setpoints = {}
        
        # Map AFE setpoint
        # Use exp for export, imp for import (with negative sign)
        if optimizer_output.get('exp', 0) > 0:
            afe_power = optimizer_output['exp']  # Positive for export
        elif optimizer_output.get('imp', 0) > 0:
            afe_power = -optimizer_output['imp']  # Negative for import
        else:
            afe_power = 0
        
        device_setpoints['AFE'] = {
            'POWER_SETPOINT': afe_power
        }
        
        # Map BESS setpoint
        # Use bc for charging, bd for discharging
        if optimizer_output.get('bc', 0) > 0:
            bess_power = optimizer_output['bc']  # Positive for charging
        elif optimizer_output.get('bd', 0) > 0:
            bess_power = -optimizer_output['bd']  # Negative for discharging
        else:
            bess_power = 0
        
        device_setpoints['BESS'] = {
            'POWER_SETPOINT': bess_power
        }
        
        # Map EV Charger 1 setpoint
        device_setpoints['EV_CHARGER_1'] = {
            'POWER_SETPOINT': optimizer_output.get('c1_ch', 0)
        }
        
        # Map EV Charger 2 setpoint
        # c2_ch for charging, c2_dis for discharging (V2G)
        if optimizer_output.get('c2_ch', 0) > 0:
            ev2_power = optimizer_output['c2_ch']
        elif optimizer_output.get('c2_dis', 0) > 0:
            ev2_power = -optimizer_output['c2_dis']  # Negative for V2G discharge
        else:
            ev2_power = 0
        
        device_setpoints['EV_CHARGER_2'] = {
            'POWER_SETPOINT': ev2_power
        }
        
        return device_setpoints
    
    def apply_power_setpoints(self, optimizer_output: Dict[str, float]) -> Dict[str, Any]:
        """
        Apply direct power setpoints to devices based on optimizer output
        
        Args:
            optimizer_output: Dictionary containing optimizer results
        
        Returns:
            Dictionary with application results for each device
        """
        results = {}
        
        # Map optimizer outputs to device setpoints
        device_setpoints = self.map_optimizer_to_setpoints(optimizer_output)
        
        self.logger.info(f"Applying power setpoints to {len(device_setpoints)} devices")
        
        # Write setpoints to all devices
        for device_name, setpoints in device_setpoints.items():
            try:
                if device_name not in self.drivers:
                    self.logger.warning(f"No driver for {device_name}, skipping")
                    results[device_name] = {
                        'success': False,
                        'error': 'Driver not found'
                    }
                    continue
                
                driver = self.drivers[device_name]
                
                # Validate setpoints
                if not driver.validate_setpoints(setpoints):
                    self.logger.error(f"Setpoint validation failed for {device_name}")
                    results[device_name] = {
                        'success': False,
                        'error': 'Validation failed'
                    }
                    continue
                
                # Write to Modbus
                write_results = self.modbus_writer.write_setpoints(device_name, setpoints)
                
                success = all(write_results.values())
                results[device_name] = {
                    'success': success,
                    'details': write_results,
                    'setpoints': setpoints
                }
                
                if success:
                    self.logger.info(f"{device_name}: Setpoints applied successfully - {setpoints}")
                else:
                    failed_params = [k for k, v in write_results.items() if not v]
                    self.logger.warning(f"{device_name}: Failed to write {failed_params}")
                    
            except Exception as e:
                self.logger.error(f"Error applying setpoints to {device_name}: {e}")
                results[device_name] = {
                    'success': False,
                    'error': str(e)
                }
        
        return results
    
    def execute(self) -> Dict[str, Any]:
        """
        Execute optimizer mode:
        1. Get data from database
        2. Run optimizer
        3. Apply direct power setpoints to devices
        
        Returns:
            Dictionary with execution results
        """
        self.logger.info("Executing Optimizer Mode")
        
        try:
            # Get data from database
            averaged_data = self.db_ops.get_latest_15_min_interval()
            recent_data = self.db_ops.get_most_recent_data()
            
            # Prepare optimizer inputs
            inputs = self.optimizer.prepare_inputs(averaged_data, recent_data)
            
            # Store inputs to database
            self.db_ops.insert_inputs_to_db(inputs)
            
            # Run optimization
            result = self.optimizer.run_optimization(inputs)
            
            if result['status'] == 'success':
                optimizer_output = result['output']
                
                # Insert outputs to database
                self.db_ops.insert_outputs_to_db(optimizer_output, quality='ok')
                
                # Apply direct power setpoints instead of droop curves
                application_results = self.apply_power_setpoints(optimizer_output)
                
                # Update config if needed
                try:
                    updated = self.config_updater.update_p_opt_values(optimizer_output)
                    self.logger.info("Config updated" if updated else "Warning: config update failed")
                except Exception as e:
                    self.logger.error(f"Config update error: {e}")
                
                # Return combined results
                return {
                    'optimizer_output': optimizer_output,
                    'application_results': application_results,
                    'status': 'success',
                    'mode': self.mode_name
                }
            else:
                # Optimizer failed
                self.logger.error(f"Optimizer failed: {result.get('message', 'Unknown error')}")
                
                error_output = {k: -1 for k in [
                    "obj", "imp", "exp", "exp1", "exp2", "pv", "ld", "bc", "bd",
                    "bl", "c1_ch", "c2_ch", "c2_dis", "v1_soc", "v2_soc"
                ]}
                
                self.db_ops.insert_outputs_to_db(error_output, quality='error')
                
                return {
                    'optimizer_output': error_output,
                    'status': 'error',
                    'message': result.get('message', 'Optimizer failed'),
                    'mode': self.mode_name
                }
                
        except Exception as e:
            self.logger.error(f"Error in optimizer mode execution: {e}")
            return {
                'status': 'error',
                'message': str(e),
                'mode': self.mode_name
            }
    
    def validate(self) -> bool:
        """Check if mode is ready to execute"""
        # Check if all required drivers are available
        for device_name, driver in self.drivers.items():
            if not driver:
                self.logger.error(f"Driver for {device_name} not initialized")
                return False
        return True
    
    def cleanup(self):
        """Clean up resources"""
        if self.modbus_writer:
            self.modbus_writer.close()
            self.logger.info("Modbus writer closed")


with open('./../web-app/backend/config.json', 'r') as file:
    config = json.load(file)

# opt = OptimizerMode(config)
# opt.execute()