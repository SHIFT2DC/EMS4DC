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

@File: config_loader.py
@Description: Configuration loader for EMS system.

@Created: 11 February 2026
@Last Modified: 27 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.2
'''


import json
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class DeviceParameters(BaseModel):
    """Device hardware parameters."""
    maxVoltage: Optional[float] = None
    minVoltage: Optional[float] = None
    maxCurrent: Optional[float] = None
    maxPower: Optional[float] = None
    maxChargePower: Optional[float] = None
    maxDischargePower: Optional[float] = None
    maxChargeCurrent: Optional[float] = None
    maxDischargeCurrent: Optional[float] = None
    capacity: Optional[float] = None  # For BESS in Wh
    minSoC: Optional[float] = None
    maxSoC: Optional[float] = None
    efficiency: Optional[float] = None
    nominalPower: Optional[float] = None
    nominalVoltageDCBus: Optional[float] = None
    droopVoltageUpperLimit: Optional[float] = None
    droopVoltageLowerLimit: Optional[float] = None
    droopPowerSupplyLimit: Optional[float] = None
    droopPowerConsumeLimit: Optional[float] = None
    droopVoltageDeadband: Optional[float] = None
    operatingFrequency: Optional[float] = None


class DeviceConfig(BaseModel):
    """Device configuration."""
    id: str
    name: str
    type: str
    parameters: DeviceParameters


class GeneralSiteConfig(BaseModel):
    """General site configuration."""
    selectedOperationMode: str
    objectiveFunction: str


class SystemConfig(BaseModel):
    """Complete system configuration."""
    devices: List[DeviceConfig]
    generalSiteConfig: GeneralSiteConfig


class ModbusParameter(BaseModel):
    """Modbus parameter configuration."""
    id: str
    name: str
    registerType: str
    address: int
    modbusId: int
    dataType: str
    scaleFactor: float
    offset: float
    decimalPlaces: int
    unit: str
    description: str
    wordOrder: str
    mode: str


class ModbusDevice(BaseModel):
    """Modbus device configuration."""
    id: str
    name: str
    type: str
    assetKey: str
    ipAddress: str
    port: int
    parameters: List[ModbusParameter]


class ModbusConfig(BaseModel):
    """Complete modbus configuration."""
    devices: List[ModbusDevice]


class ConfigLoader:
    """Load and manage EMS configuration files."""
    
    def __init__(self, config_dir: str = "./conf/"):
        self.config_dir = Path(config_dir)
        self._system_config: Optional[SystemConfig] = None
        self._modbus_config: Optional[ModbusConfig] = None
    
    def load_system_config(self, filename: str = "config.json") -> SystemConfig:
        """Load system configuration from JSON file."""
        config_path = self.config_dir / filename
        with open(config_path, 'r') as f:
            data = json.load(f)
        self._system_config = SystemConfig(**data)
        return self._system_config
    
    def load_modbus_config(self, filename: str = "modbus.json") -> ModbusConfig:
        """Load modbus configuration from JSON file."""
        config_path = self.config_dir / filename
        with open(config_path, 'r') as f:
            data = json.load(f)
        self._modbus_config = ModbusConfig(**data)
        return self._modbus_config
    
    @property
    def system_config(self) -> SystemConfig:
        """Get system configuration (load if not loaded)."""
        if self._system_config is None:
            self.load_system_config()
        return self._system_config
    
    @property
    def modbus_config(self) -> ModbusConfig:
        """Get modbus configuration (load if not loaded)."""
        if self._modbus_config is None:
            self.load_modbus_config()
        return self._modbus_config
    
    def get_device_config(self, asset_key: str) -> Optional[DeviceConfig]:
        """Get configuration for specific device by asset key."""
        for device in self.system_config.devices:
            if device.id == asset_key:
                return device
        return None
    
    def get_modbus_device(self, asset_key: str) -> Optional[ModbusDevice]:
        """Get modbus configuration for specific device."""
        for device in self.modbus_config.devices:
            if device.assetKey == asset_key:
                return device
        return None
    
    def get_devices_by_type(self, device_type: str) -> List[DeviceConfig]:
        """Get all devices of a specific type."""
        return [d for d in self.system_config.devices if d.type == device_type]