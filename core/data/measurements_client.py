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

@File: measurements_client.py
@Description: # TODO: Add desc

@Created: 31st July 2025
@Last Modified: 01 April 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
'''


import json
import time
import sys
import os
from datetime import datetime
from pymodbus.client import ModbusTcpClient
import logging
import struct
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict
import argparse

from utils.logging_utils import setup_logging
from utils.time_utils import current_time
setup_logging
logger = logging.getLogger(__name__)

class ModbusDataReader:
    def __init__(self, config_file='modbus.json', max_batch_size=120):
        self.config = self.load_config(config_file)
        self.clients = {}
        self.max_batch_size = max_batch_size
        self.connection_timeouts = {'timeout': 3, 'retries': 1}

    def load_config(self, config_file):
        with open(config_file, 'r') as f:
            return json.load(f)

    def get_client(self, ip_address, port):
        """
        Get or create a persistent Modbus TCP client for the given address.
        Reuses an existing healthy connection; reconnects if the socket is closed or broken.
        """
        client_key = f"{ip_address}:{port}"
        existing = self.clients.get(client_key)

        # Reuse the connection if it is still alive
        if existing is not None and existing.is_socket_open():
            return existing

        # Close stale client before reconnecting
        if existing is not None:
            logger.warning(f"Connection to {client_key} lost, reconnecting...")
            try:
                existing.close()
            except Exception:
                pass
            del self.clients[client_key]

        client = ModbusTcpClient(
            ip_address,
            port=port,
            timeout=self.connection_timeouts['timeout'],
            retries=self.connection_timeouts['retries']
        )
        if client.connect():
            self.clients[client_key] = client
            logger.info(f"Connected to {client_key}")
        else:
            logger.error(f"Failed to connect to {ip_address}:{port}")
            return None

        return self.clients[client_key]

    def group_parameters(self, parameters):
        groups = defaultdict(list)
        for param in parameters:
            key = f"{param['registerType'].lower()}_{param['modbusId']}"
            groups[key].append(param)
        return groups

    def create_batches_with_gaps(self, parameters, step=1):
        if not parameters:
            return []
        sorted_params = sorted(parameters, key=lambda x: x['address'])
        batches = []
        current_batch = [sorted_params[0]]

        for param in sorted_params[1:]:
            span = (param['address'] - current_batch[0]['address']) + 1
            if span <= self.max_batch_size:
                current_batch.append(param)
            else:
                batches.append(current_batch)
                current_batch = [param]
        batches.append(current_batch)
        return batches

    def read_batch(self, client, batch, words_per_value=1):
        if not batch:
            return {}
        register_type = batch[0]['registerType'].lower()
        modbus_id = batch[0]['modbusId']

        start_address = batch[0]['address']
        end_address = batch[-1]['address'] + (words_per_value - 1)
        count = (end_address - start_address) + 1

        try:
            if register_type == 'holding':
                result = client.read_holding_registers(start_address, count=count, device_id=modbus_id)
            elif register_type == 'input':
                result = client.read_input_registers(start_address, count=count, device_id=modbus_id)
            else:
                logger.error(f"Unsupported register type: {register_type}")
                return {}
            if result.isError():
                logger.error(f"Error reading batch at {start_address}: {result}")
                return {}

            values = {}
            for param in batch:
                idx = (param['address'] - start_address) // words_per_value
                if param['dataType'].lower() == 'float32':
                    raw_hi = result.registers[idx * 2]
                    raw_lo = result.registers[idx * 2 + 1]
                    if param.get('wordOrder', 'big') == 'big':
                        raw_bytes = int.to_bytes(raw_hi, 2, 'big') + int.to_bytes(raw_lo, 2, 'big')
                    else:
                        raw_bytes = int.to_bytes(raw_lo, 2, 'big') + int.to_bytes(raw_hi, 2, 'big')
                    val = struct.unpack(">f", raw_bytes)[0]
                elif param['dataType'].lower() == 'int16':
                    raw = result.registers[idx]
                    # Re-interpret the unsigned 16-bit word as a signed int16
                    val = raw if raw < 0x8000 else raw - 0x10000
                else:
                    val = result.registers[idx]   # uint16 / coil / etc. — stays unsigned
                values[param['name']] = self.apply_scaling(val, param)
            return values
        except Exception as e:
            logger.error(f"Exception reading batch: {e}")
            logger.error(f"Register Type: {register_type} | Start Address: {start_address} | End Address: {end_address}")
            return {}

    def apply_scaling(self, raw_value, parameter):
        try:
            scale_factor = float(parameter.get('scaleFactor', 1.0))
            offset = float(parameter.get('offset', 0.0))
            decimal_places = parameter.get('decimalPlaces')
            scaled_value = (raw_value * scale_factor) + offset
            if decimal_places is not None:
                scaled_value = round(scaled_value, decimal_places)
            return scaled_value
        except Exception as e:
            logger.error(f"Scaling error for {parameter['name']}: {e}")
            return raw_value

    def read_device_data(self, device, use_asset_key=False):
        """
        Read data from a single device.

        Args:
            device: Device configuration dict
            use_asset_key: If True, use assetKey instead of name for prefixing

        Returns:
            dict: Device data with appropriate prefix
        """
        client = self.get_client(device['ipAddress'], device['port'])
        if not client:
            return {}

        device_data = {}
        try:
            groups = self.group_parameters(device['parameters'])
            for group_key, params in groups.items():
                if not params:
                    continue
                words_per_val = 2 if params[0]['dataType'].lower() == 'float32' else 1
                batches = self.create_batches_with_gaps(params, step=words_per_val)
                for batch in batches:
                    result = self.read_batch(client, batch, words_per_value=words_per_val)
                    device_data.update(result)
        except Exception as e:
            logger.error(f"Device read error {device.get('name', device.get('assetKey', 'unknown'))}: {e}")
        return device_data

    def read_single_device_by_asset_key(self, asset_key):
        """
        Read data from a single device identified by assetKey.

        Args:
            asset_key: The assetKey to identify the device

        Returns:
            dict: Measurement data with assetKey prefix and metadata
        """
        device = next((d for d in self.config['devices'] if d.get('assetKey') == asset_key), None)

        if not device:
            logger.error(f"Device with assetKey {asset_key} not found in config")
            return {
                "timestamp": current_time().strftime('%H-%M-%S'),
                "assetKey": asset_key,
                "error": "Device not found in configuration",
                "success": False
            }

        device_data = self.read_device_data(device, use_asset_key=True)

        result = {
            "timestamp": current_time().strftime('%H-%M-%S'),
            "assetKey": asset_key,
            "success": len(device_data) > 0
        }

        for key, value in device_data.items():
            result[f"{asset_key}_{key}"] = value

        power_key = f"{asset_key}_POWER"
        if power_key in result:
            result["power"] = result[power_key]
        else:
            if "POWER" in device_data:
                result["power"] = device_data["POWER"]
                result[power_key] = device_data["POWER"]

        if not result["success"]:
            result["error"] = "No data retrieved from device"

        return result

    def read_all_data_parallel(self):
        """
        Read all devices in parallel using the persistent client pool.
        """
        data = {"timestamp": current_time().strftime('%H-%M-%S')}
        with ThreadPoolExecutor(max_workers=min(len(self.config['devices']), 10)) as executor:
            futures = {executor.submit(self.read_device_data, d): d.get('assetKey', d['name']) for d in self.config['devices']}
            for future in as_completed(futures):
                identifier = futures[future]
                try:
                    device_data = future.result(timeout=10)
                    for k, v in device_data.items():
                        data[f"{identifier}_{k}"] = v
                except Exception as e:
                    logger.error(f"Error reading device {identifier}: {e}")
        return data

    def write_single_register(self, assetKey, parameter_name, value):
        """
        Write a single register value to a device.

        Args:
            assetKey: Unique identifier of the asset (e.g. 'afe1')
            parameter_name: Name of the parameter to write
            value: Raw value to write (after scaling applied)

        Returns:
            bool: Success status
        """
        device = next((d for d in self.config['devices'] if d['assetKey'] == assetKey), None)
        if not device:
            logger.error(f"Device {assetKey} not found in config")
            return False

        param = next((p for p in device['parameters']
                    if p['name'] == parameter_name and p.get('mode') == 'write'), None)
        if not param:
            logger.error(f"Write parameter {parameter_name} not found for device {assetKey}")
            return False

        client = self.get_client(device['ipAddress'], device['port'])
        if not client:
            return False

        try:
            raw_value = self.reverse_scaling(value, param)

            register_type = param['registerType'].lower()
            address = param['address']
            modbus_id = param['modbusId']

            if param['dataType'].lower() == 'float32':
                raw_bytes = struct.pack(">f", raw_value)
                if param.get('wordOrder', 'big') == 'big':
                    raw_hi = int.from_bytes(raw_bytes[0:2], 'big')
                    raw_lo = int.from_bytes(raw_bytes[2:4], 'big')
                else:
                    raw_lo = int.from_bytes(raw_bytes[0:2], 'big')
                    raw_hi = int.from_bytes(raw_bytes[2:4], 'big')

                if register_type == 'holding':
                    result = client.write_registers(address, [raw_hi, raw_lo], device_id=modbus_id)
                else:
                    logger.error(f"Cannot write to {register_type} registers")
                    return False
            else:
                raw_value_int = int(raw_value)
                if param['dataType'].lower() == 'int16':
                    # Modbus write_register expects an unsigned 16-bit word.
                    # Mask negative signed values into their two's-complement representation.
                    raw_value_int = raw_value_int & 0xFFFF
                if register_type == 'holding':
                    result = client.write_register(address, raw_value_int, device_id=modbus_id)
                else:
                    logger.error(f"Cannot write to {register_type} registers")
                    return False

            if result.isError():
                logger.error(f"Error writing to {parameter_name}: {result}")
                return False

            logger.debug(f"Successfully wrote {value} to {assetKey}.{parameter_name}")
            return True

        except Exception as e:
            logger.error(f"Exception writing register: {e}")
            return False

    def reverse_scaling(self, scaled_value, parameter):
        """Reverse the scaling to get raw register value"""
        try:
            scale_factor = float(parameter.get('scaleFactor', 1.0))
            offset = float(parameter.get('offset', 0.0))
            raw_value = (scaled_value - offset) / scale_factor
            return raw_value
        except Exception as e:
            logger.error(f"Reverse scaling error for {parameter['name']}: {e}")
            return scaled_value

    def write_multiple_registers(self, device_name, setpoints):
        """
        Write multiple register values to a device.

        Args:
            device_name: Name of the device in config
            setpoints: Dict mapping parameter names to values

        Returns:
            dict: Results for each parameter {param_name: success_bool}
        """
        results = {}
        for param_name, value in setpoints.items():
            results[param_name] = self.write_single_register(device_name, param_name, value)
        return results

    def read_data_as_json(self, asset_key=None):
        """
        Read data and return as JSON string.

        Args:
            asset_key: If provided, read only this device. Otherwise read all.

        Returns:
            str: JSON string of measurement data
        """
        if asset_key:
            data = self.read_single_device_by_asset_key(asset_key)
        else:
            data = self.read_all_data_parallel()
        return json.dumps(data, indent=2)

    def close_connections(self):
        """Explicitly close all open Modbus TCP connections."""
        for client_key, client in list(self.clients.items()):
            try:
                client.close()
                logger.info(f"Closed connection to {client_key}")
            except Exception:
                pass
        self.clients.clear()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close_connections()


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description='Modbus Data Reader')
        parser.add_argument('config_file', nargs='?', default='./conf/modbus.json',
                          help='Path to modbus configuration file')
        parser.add_argument('--asset-key', type=str, default=None,
                          help='Read only the device with this assetKey')

        args = parser.parse_args()

        if not os.path.exists(args.config_file):
            logger.error(f"Configuration file {args.config_file} not found")
            sys.exit(1)

        with ModbusDataReader(args.config_file) as reader:
            json_data = reader.read_data_as_json(asset_key=args.asset_key)
            print(json_data)

    except Exception as e:
        logger.error(f"Application error: {e}")
        sys.exit(1)