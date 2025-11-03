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

File: fetchMeasurements.py
Description: # TODO: Add desc

Created: 31st July 2025
Last Modified: 30th October 2025
Version: v1.0.0
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

logging.basicConfig(level=logging.INFO)
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
        client_key = f"{ip_address}:{port}"
        if client_key not in self.clients:
            client = ModbusTcpClient(
                ip_address,
                port=port,
                timeout=self.connection_timeouts['timeout'],
                retries=self.connection_timeouts['retries']
            )
            if client.connect():
                self.clients[client_key] = client
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
                else:
                    val = result.registers[idx]
                values[param['name']] = self.apply_scaling(val, param)
            return values
        except Exception as e:
            logger.error(f"Exception reading batch: {e}")
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

    def read_device_data(self, device):
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
            logger.error(f"Device read error {device['name']}: {e}")
        return device_data

    def read_all_data_parallel(self):
        data = {"timestamp": datetime.now().strftime('%H-%M-%S')}
        with ThreadPoolExecutor(max_workers=min(len(self.config['devices']), 10)) as executor:
            futures = {executor.submit(self.read_device_data, d): d['name'] for d in self.config['devices']}
            for future in as_completed(futures):
                name = futures[future]
                try:
                    device_data = future.result(timeout=10)
                    # Always add device name prefix for consistency
                    for k, v in device_data.items():
                        data[f"{name}_{k}"] = v
                except Exception as e:
                    logger.error(f"Error reading device {name}: {e}")
        return data

    def read_data_as_json(self):
        return json.dumps(self.read_all_data_parallel(), indent=2)

    def close_connections(self):
        for client in self.clients.values():
            try:
                client.close()
            except:
                pass
        self.clients.clear()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close_connections()


if __name__ == "__main__":
    try:
        # Check if config path is provided as command line argument
        if len(sys.argv) > 1:
            config_path = sys.argv[1]
        else:
            config_path = '../web-app/backend/modbus.json'
        
        if not os.path.exists(config_path):
            logger.error(f"Configuration file {config_path} not found")
            sys.exit(1)
        
        # Create reader instance
        with ModbusDataReader(config_path) as reader:
            json_data = reader.read_data_as_json()
            print(json_data)
        
    except Exception as e:
        logger.error(f"Application error: {e}")
        sys.exit(1)