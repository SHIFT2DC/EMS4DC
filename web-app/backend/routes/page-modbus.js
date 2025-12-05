/*
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

File: page-modbus.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 24th November 2025
Version: v1.2.0
*/

import express from '../../frontend/node_modules/express/index.js';
import path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

// Definitions to resolve problems with __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configModbusPath = path.join(__dirname, './../modbus.json');

const router = express.Router();

// API endpoint to read Modbus configuration
router.get('/', async (req, res) => {
  try {
    // Check if the config file exists
    const fileExists = await fs.access(configModbusPath).then(() => true).catch(() => false);
    
    if (!fileExists) {
      // Return default configuration if file doesn't exist
      const defaultConfig = {
        devices: [
          {
            id: "device-" + Date.now(),
            name: "Device 1",
            ipAddress: "192.168.1.100",
            port: 502,
            parameters: [
              {
                id: "param-" + Date.now(),
                name: "Parameter 1",
                registerType: "holding",
                address: 1,
                modbusId: 1,
                dataType: "uint16",
                scaleFactor: 1,
                offset: 0,
                decimalPlaces: 0,
                unit: "",
                description: "",
                wordOrder: "big",
              },
            ],
          },
        ],
      };
      return res.json(defaultConfig);
    }

    // Read the existing config file
    const configData = await fs.readFile(configModbusPath, 'utf8');
    const config = JSON.parse(configData);

    // Validate the config structure
    if (!config.devices || !Array.isArray(config.devices)) {
      throw new Error('Invalid configuration format');
    }

    return res.json(config);
  } catch (error) {
    console.error('Error reading Modbus configuration:', error);
    
    // Return default configuration on error
    const defaultConfig = {
      devices: [
        {
          id: "device-" + Date.now(),
          name: "Device 1",
          ipAddress: "192.168.1.100",
          port: 502,
          parameters: [
          {
            id: "param-" + Date.now(),
            name: "Parameter 1",
            registerType: "holding",
            address: 1,
            modbusId: 1,
            dataType: "uint16",
            scaleFactor: 1,
            offset: 0,
            decimalPlaces: 0,
            unit: "",
            description: "",
            wordOrder: "big",
          },
        ],
        },
      ],
    };
    return res.json(defaultConfig);
  }
});

// API endpoint to save Modbus configuration
router.post('/save', async (req, res) => {
  try {
    const config = req.body;

    // Validate the config
    if (!Array.isArray(config.devices)) {
      return res.status(400).json({ error: 'Invalid configuration format' });
    }

    // Write the config to modbus.json
    await fs.writeFile(configModbusPath, JSON.stringify(config, null, 2), 'utf8');

    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving Modbus configuration:', error);
    return res.status(500).json({ error: 'Failed to save configuration' });
  }
});

export default router;