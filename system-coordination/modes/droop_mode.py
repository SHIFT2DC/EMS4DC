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

File: droop_mode.py
Description: # TODO: Add desc

Created: 3rd February 2026
Last Modified: 3rd February 2026
Version: v1.2.0
'''


import logging
import json
from typing import Dict, Any
from dotenv import load_dotenv
import os

from drivers.afe_driver import ActiveFrontEndDriver
from drivers.bess_driver import BESSDriver
from data.modbus_writer import ModbusWriter
from utils.database_utils import DatabaseOperations
from utils.optimizer_utils import OptimizerRunner

load_dotenv('./../web-app/backend/.env')

class DroopMode:
    """
    Droop control mode - runs optimizer and applies results as droop curve parameters
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger('ems.droopmode')
        self.config = config
        self.mode_name = "Droop Mode"
        
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
            'BESS': BESSDriver(device_id='BESS', config=config),
            # Add more drivers as needed:
        }
        
        # Initialize Modbus writer
        self.modbus_writer = ModbusWriter(config_file='./../web-app/backend/modbus.json')
    
    def apply_droop_curves(self, optimizer_output: Dict[str, float]) -> Dict[str, Any]:
        """
        Calculate and apply droop curves to devices based on optimizer output
        
        Args:
            optimizer_output: Dictionary containing optimizer results
        
        Returns:
            Dictionary with application results for each device
        """
        results = {}
        
        # Process AFE droop curve
        try:
            afe_driver = self.drivers['AFE']
            
            # Calculate droop curve parameters
            droop_registers = afe_driver.transform_droop_curve(optimizer_output)
            
            self.logger.info(f"AFE Droop curve registers: {droop_registers}")
            
            # Apply setpoints via Modbus
            write_results = afe_driver.apply_setpoints(droop_registers, self.modbus_writer)
            
            success_count = sum(1 for v in write_results.values() if v)
            results['AFE'] = {
                'success': success_count == len(write_results),
                'details': write_results
            }
            
            if results['AFE']['success']:
                self.logger.info("AFE droop curve applied successfully")
            else:
                self.logger.warning(f"AFE droop curve partially applied: {success_count}/{len(write_results)}")
                
        except Exception as e:
            self.logger.error(f"Error applying AFE droop curve: {e}")
            results['AFE'] = {'success': False, 'error': str(e)}
        
        # Add more devices as needed
        try:
            bess_driver = self.drivers['BESS']
            bess_setpoints = bess_driver.transform_droop_curve(optimizer_output)
            write_results = bess_driver.apply_setpoints(bess_setpoints, self.modbus_writer)
            results['BESS'] = {'success': all(write_results.values()), 'details': write_results}
            self.logger.info("BESS droop curve applied successfully")
        except Exception as e:
            results['BESS'] = {'success': False, 'error': str(e)}
            self.logger.error(f"Error applying BESS droop curve: {e}")

        # Add more devices as needed
        # try:
        #     bess_driver = self.drivers['BESS']
        #     bess_setpoints = bess_driver.calculate_droop_parameters(optimizer_output)
        #     write_results = bess_driver.apply_setpoints(bess_setpoints, self.modbus_writer)
        #     results['BESS'] = {'success': all(write_results.values()), 'details': write_results}
        # except Exception as e:
        #     results['BESS'] = {'success': False, 'error': str(e)}
        
        return results
    
    def execute(self) -> Dict[str, Any]:
        """
        Execute droop mode:
        1. Get data from database
        2. Run optimizer
        3. Calculate droop curves
        4. Apply setpoints to devices
        
        Returns:
            Dictionary with execution results
        """
        self.logger.info("Executing Droop Mode")
        
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
                
                # Apply droop curves to devices
                application_results = self.apply_droop_curves(optimizer_output)
                
                
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
            self.logger.error(f"Error in droop mode execution: {e}")
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