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

File: POptApplier.py
Description: # TODO: Add desc

Created: 25th July 2025
Last Modified: 30th October 2025
Version: v1.0.0
'''

import json
import os
import logging
from typing import Dict, Optional
from datetime import datetime

class ConfigPOptUpdater:
    """
    Module to update p_opt values in config.json based on EMS optimization outputs
    """
    
    def __init__(self, config_path: str = './../web-app/backend/config.json'):
        """
        Initialize the ConfigPOptUpdater
        
        Args:
            config_path (str): Path to the config.json file
        """
        self.config_path = config_path
        self.logger = self._setup_logger()
        
    def _setup_logger(self) -> logging.Logger:
        """Setup logging for the module"""
        logger = logging.getLogger('ConfigPOptUpdater')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
        return logger
    
    def load_config(self) -> Optional[Dict]:
        """
        Load the current configuration from config.json
        
        Returns:
            Dict: Configuration dictionary or None if failed
        """
        try:
            if not os.path.exists(self.config_path):
                self.logger.error(f"Config file not found: {self.config_path}")
                return None
                
            with open(self.config_path, 'r') as file:
                config = json.load(file)
                self.logger.debug("Configuration loaded successfully")
                return config
                
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in config file: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error loading config: {e}")
            return None
    
    def save_config(self, config: Dict) -> bool:
        """
        Save the updated configuration to config.json
        
        Args:
            config (Dict): Configuration dictionary to save
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:         
            # Save updated config
            with open(self.config_path, 'w') as file:
                json.dump(config, file, indent=2)
                
            self.logger.info("Configuration saved successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving config: {e}")
            return False
    
    def update_p_opt_values(self, ems_output: Dict) -> bool:
        """
        Update p_opt values in config based on EMS optimization outputs
        
        Args:
            ems_output (Dict): Dictionary containing EMS optimization outputs
                Expected keys: 'pv', 'ld', 'bc', 'bd', 'c1_ch', 'c2_ch', 'c2_dis'
                
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            # Load current configuration
            config = self.load_config()
            if config is None:
                return False
            
            # Validate required keys in ems_output
            required_keys = ['pv', 'ld', 'bc', 'bd']
            missing_keys = [key for key in required_keys if key not in ems_output]
            if missing_keys:
                self.logger.warning(f"Missing keys in EMS output: {missing_keys}")
            
            # Track changes for logging
            changes = {}
            
            # Update PV p_opt with pv value (converted to watts if needed)
            if 'pv' in ems_output and 'pv' in config:
                old_value = config['pv'].get('p_opt', 0)
                new_value = round(ems_output['pv'] * 1000)  # Convert kW to W
                config['pv']['p_opt'] = new_value
                changes['pv'] = {'old': old_value, 'new': new_value}
            
            # Update Loads p_opt with ld value (converted to watts, made negative)
            if 'ld' in ems_output and 'loads' in config:
                old_value = config['loads'].get('p_opt', 0)
                new_value = -round(ems_output['ld'] * 1000)  # Convert kW to W and make negative
                config['loads']['p_opt'] = new_value
                changes['loads'] = {'old': old_value, 'new': new_value}
            
            # Update BESS p_opt based on bc and bd values
            if 'bess' in config:
                old_value = config['bess'].get('p_opt', 0)
                
                # Calculate net BESS power: charging (bc) is positive, discharging (bd) is negative
                bc_value = ems_output.get('bc', 0) * 1000  # Convert kW to W
                bd_value = -ems_output.get('bd', 0) * 1000  # Convert kW to W and make negative
                
                # Net power is charging minus discharging
                net_power = bc_value + bd_value
                new_value = round(net_power)
                
                config['bess']['p_opt'] = new_value
                changes['bess'] = {
                    'old': old_value, 
                    'new': new_value,
                    'bc': bc_value,
                    'bd': bd_value
                }
            
                # Update EV Charger 1 (Unidirectional) p_opt with c1_ch value
            if 'evCharger1' in config and 'c1_ch' in ems_output:
                old_value = config['evCharger1'].get('p_opt', 0)
                new_value = round(ems_output['c1_ch'] * -1000)  # Convert kW to W
                config['evCharger1']['p_opt'] = new_value
                changes['evCharger1'] = {
                    'old': old_value,
                    'new': new_value
                }
            
            # Update EV Charger 2 (Bidirectional) p_opt like BESS (c2_ch - c2_dis)
            if 'evCharger2' in config:
                old_value = config['evCharger2'].get('p_opt', 0)
                
                # Calculate net EV Charger 2 power: charging (c2_ch) is positive, discharging (c2_dis) is negative
                c2_ch_value = ems_output.get('c2_ch', 0) * 1000  # Convert kW to W
                c2_dis_value = -ems_output.get('c2_dis', 0) * 1000  # Convert kW to W and make negative
                
                # Net power is charging minus discharging
                net_power = c2_ch_value + c2_dis_value
                new_value = round(net_power)
                
                config['evCharger2']['p_opt'] = new_value
                changes['evCharger2'] = {
                    'old': old_value,
                    'new': new_value,
                    'c2_ch': c2_ch_value,
                    'c2_dis': c2_dis_value
                }
            
            # Log all changes
            if changes:
                self.logger.info("P_opt values updated:")
                for device, change_info in changes.items():
                    if 'note' in change_info:
                        self.logger.info(f"  {device}: {change_info['old']} -> {change_info['new']} ({change_info['note']})")
                    elif 'bc' in change_info:  # BESS specific logging
                        self.logger.info(f"  {device}: {change_info['old']} -> {change_info['new']} (bc: {change_info['bc']}, bd: {change_info['bd']})")
                    else:
                        self.logger.info(f"  {device}: {change_info['old']} -> {change_info['new']}")
            
            # Save updated configuration
            return self.save_config(config)
            
        except Exception as e:
            self.logger.error(f"Error updating p_opt values: {e}")
            return False
    
    def update_from_optimizer_output(self, optimizer_instance) -> bool:
        """
        Update p_opt values using output from OptimizerMode instance
        
        Args:
            optimizer_instance: Instance of OptimizerMode class
            
        Returns:
            bool: True if update successful, False otherwise
        """
        try:
            # Execute optimizer to get latest results
            ems_output = optimizer_instance.execute()
            
            if not ems_output or all(v == -1 for v in ems_output.values()):
                self.logger.error("Optimizer execution failed or returned error values")
                return False
            
            # Update p_opt values
            return self.update_p_opt_values(ems_output)
            
        except Exception as e:
            self.logger.error(f"Error updating from optimizer output: {e}")
            return False
    
    def get_current_p_opt_values(self) -> Optional[Dict]:
        """
        Get current p_opt values from all devices
        
        Returns:
            Dict: Current p_opt values or None if failed
        """
        try:
            config = self.load_config()
            if config is None:
                return None
            
            p_opt_values = {}
            for device in ['pv', 'bess', 'evCharger', 'loads', 'activeFrontEnd']:
                if device in config and 'p_opt' in config[device]:
                    p_opt_values[device] = config[device]['p_opt']
            
            return p_opt_values
            
        except Exception as e:
            self.logger.error(f"Error getting current p_opt values: {e}")
            return None


# Example usage function
def example_usage():
    """Example of how to use the ConfigPOptUpdater"""
    
    # Initialize the updater
    updater = ConfigPOptUpdater()
    
    # Example EMS output (typically from OptimizerMode.execute())
    example_ems_output = {
        "obj": 1234.5,
        "imp": 5.2,
        "exp": 3.1,
        "exp1": 2.0,
        "exp2": 1.1,
        "pv": 8.5,      # This will update PV p_opt
        "ld": 12.3,     # This will update loads p_opt (negative)
        "bc": 2.5,      # BESS charging
        "bd": 1.0,      # BESS discharging (will be made negative)
        "bl": 45.6,
        "c1_ch": 0.0,   # EV charger 1 charging
        "c2_ch": 3.2,   # EV charger 2 charging
        "c2_dis": 0.5,  # EV charger 2 discharging
        "v1_soc": 0.65,
        "v2_soc": 0.82
    }
    
    # Update p_opt values
    success = updater.update_p_opt_values(example_ems_output)
    
    if success:
        print("P_opt values updated successfully!")
        
        # Display current p_opt values
        current_values = updater.get_current_p_opt_values()
        if current_values:
            print("\nCurrent p_opt values:")
            for device, value in current_values.items():
                print(f"  {device}: {value} W")
    else:
        print("Failed to update p_opt values")


if __name__ == "__main__":
    example_usage()