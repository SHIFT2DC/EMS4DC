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

@File: base_driver.py
@Description: # TODO: Add desc

@Created: 3rd February 2026
@Last Modified: 16 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
'''


from abc import ABC, abstractmethod
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class RegisterMapping:
    """Defines mapping for device's registers"""
    address: int
    name: str
    scale_factor: float = 1.0
    offset: float = 0.0
    unit: str = ""

class BaseDeviceDriver(ABC):
    """Abstract base class for all device drivers"""
    
    def __init__(self, device_id: str, config: Dict[str, Any]):
        self.device_id = device_id
        self.config = config
        self._register_map: Dict[str, RegisterMapping] = {}
        self._initialize_registers()
    
    @abstractmethod
    def _initialize_registers(self) -> None:
        """Initialize device-specific register mappings"""
        pass
    
    @abstractmethod
    def transform_droop_curve(self, optimizer_data: Dict[str, float]) -> Dict[int, Any]:
        """
        Transforms droop curve based on the output from the optimizer
        
        Args:
            optimizer_data: Raw data from optimizer (e.g., {'pv': 1500, 'battery': -500})
        
        Returns:
            Dictionary of "Write" registers with asigned values to those registers so that those values can be written on the devices' registers.
        """
        pass
        
    @abstractmethod
    def validate_setpoints(self, setpoints: Dict[str, float]) -> bool:
        """Validate setpoints against device limits"""
        pass
    
    
    def apply_setpoints(self, setpoints: Dict[str, float], modbus_writer) -> Dict[str, bool]:
        """
        Apply calculated setpoints to the device via Modbus
        
        Args:
            setpoints: Dictionary mapping register names to values
            modbus_writer: ModbusWriter instance for writing to Modbus
        
        Returns:
            Dictionary with write results for each parameter
        """
        # Validate setpoints first
        if not self.validate_setpoints(setpoints):
            self.logger.error(f"Setpoint validation failed for {self.device_id}")
            return {k: False for k in setpoints.keys()}
        
        # Write to Modbus
        results = modbus_writer.write_setpoints(self.device_id, setpoints)
        
        return results