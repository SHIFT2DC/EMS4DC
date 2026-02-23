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

@File: optimizer.py
@Description: TODO

@Created: 11 February 2026
@Last Modified: 23 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''

from utils.time_utils import calculate_time_for_execution
from utils.logging_utils import setup_logging
import json
import time
import logging

# Operating modes for the system
from modes.optimizer_mode import OptimizerMode
from modes.droop_mode import DroopMode


class Coordinator:
    def __init__(self, config):
        """
        Initialize optimizer class.
        
        Args:
            config = `config.json` file which contains hardware parameters and general configuration parameters
        """
        
        self.config = config
        self.current_mode = None
        self.modes = {
            'optimizer': OptimizerMode(config),
            'droop': DroopMode(config),
        }
        self.logger = logging.getLogger('optimizer')
        
        self.running = False


    def select_mode(self):
        """Evaluate conditions and select appropriate mode"""
        if self._should_use_optimizer():
            return 'optimizer'
        else:
            return 'droop'

    def _should_use_optimizer(self):
        """Logic to determine if optimizer mode should be used"""
        if self.config['generalSiteConfig']['selectedOperationMode'] == "droopMode":
            return False 
        else:
            return True

    def run_cycle(self):
        """Execute a single cycle"""
        self.logger.debug("Starting optimization cycle")

        # Select mode for this cycle
        selected_mode = self.select_mode()

        # If mode changed, log it
        if self.current_mode != selected_mode:
            self.logger.debug(f"Switching from {self.current_mode} to {selected_mode} mode")
            self.current_mode = selected_mode

        # Execute the selected mode
        try:
            if selected_mode == 'optimizer' or selected_mode == 'droop':
                result = self.modes[selected_mode].execute()
                self.logger.debug(f"Executed {selected_mode} mode.")
        except Exception as e:
            self.logger.error(f"Error executing {selected_mode} mode: {e}")
            # Implement fallback behavior here if needed


    def run(self, optimization_interval=15):
        self.logger.info("Optimizer Starting")
        self.running = True
        
        try:            
            # Main coordination loop (15-minute cycles)
            while self.running:

                self.run_cycle()
                
                sleep_time = calculate_time_for_execution(interval_minutes=optimization_interval)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                    
        except KeyboardInterrupt:
            self.logger.info("Received keyboard interrupt, shutting down...")
        except Exception as e:
            self.logger.error(f"Unexpected error in main loop: {e}")
        finally:
            self.shutdown()

    def shutdown(self):
        """Clean shutdown of all components"""
        self.logger.info("Shutting down optimizer...")
        self.running = False
        
        # Clean up modes
        for mode_name, mode in self.modes.items():
            if hasattr(mode, 'cleanup'):
                try:
                    mode.cleanup()
                    self.logger.info(f"Cleaned up {mode_name} mode")
                except Exception as e:
                    self.logger.error(f"Error cleaning up {mode_name} mode: {e}")
        
        self.logger.info("Optimizer shutdown complete")


if __name__ == "__main__":
    
    setup_logging()

    # Example configuration
    with open('./../web-app/backend/config.json', 'r') as file:
        config = json.load(file)
    
    coordinator = Coordinator(config)
    coordinator.run(optimization_interval=15)