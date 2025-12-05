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

File: page-droop.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 24th November 2025
Version: v1.2.0
*/

import express from '../../frontend/node_modules/express/index.js';
import path from "path";
import { promises as fs } from 'fs';

// Needed for configuration json-file path
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Definitions to resolve problems with __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, './../config.json');

const router = express.Router();

// Endpoint for droop curve configuration
router.get("/", async (req, res) => {
  try {
    const configData = await fs.readFile(configPath, "utf-8");
    const parsedConfig = JSON.parse(configData);

    // Extract droop curve parameters for each device
    const droopCurveData = {
      pv: {
        minVoltage: parsedConfig.pv.minVoltage,
        maxVoltage: parsedConfig.pv.maxVoltage,
        maxPower: parsedConfig.pv.maxPower,
        v_nom: parsedConfig.pv.v_nom || defaultConfig.pv.v_nom,
        p_supply: parsedConfig.pv.p_supply || defaultConfig.pv.p_supply,
        v_supply: parsedConfig.pv.v_supply || defaultConfig.pv.v_supply,
        p_consume: parsedConfig.pv.p_consume || defaultConfig.pv.p_consume,
        v_consume: parsedConfig.pv.v_consume || defaultConfig.pv.v_consume,
        p_opt: parsedConfig.pv.p_opt || defaultConfig.pv.p_opt
      },
      bess: {
        minVoltage: parsedConfig.bess.minVoltage,
        maxVoltage: parsedConfig.bess.maxVoltage,
        maxPower: parsedConfig.bess.capacity,
        v_nom: parsedConfig.bess.v_nom || defaultConfig.bess.v_nom,
        p_supply: parsedConfig.bess.p_supply || defaultConfig.bess.p_supply,
        v_supply: parsedConfig.bess.v_supply || defaultConfig.bess.v_supply,
        p_consume: parsedConfig.bess.p_consume || defaultConfig.bess.p_consume,
        v_consume: parsedConfig.bess.v_consume || defaultConfig.bess.v_consume,
        p_opt: parsedConfig.bess.p_opt || defaultConfig.bess.p_opt
      },
      evCharger1: {
        minVoltage: parsedConfig.evCharger.minVoltage,
        maxVoltage: parsedConfig.evCharger.maxVoltage,
        maxPower: parsedConfig.evCharger.maxPower,
        v_nom: parsedConfig.evCharger.v_nom || defaultConfig.evCharger.v_nom,
        p_supply: parsedConfig.evCharger.p_supply || defaultConfig.evCharger.p_supply,
        v_supply: parsedConfig.evCharger.v_supply || defaultConfig.evCharger.v_supply,
        p_consume: parsedConfig.evCharger.p_consume || defaultConfig.evCharger.p_consume,
        v_consume: parsedConfig.evCharger.v_consume || defaultConfig.evCharger.v_consume,
        p_opt: parsedConfig.evCharger.p_opt || defaultConfig.evCharger.p_opt
      },
      evCharger2: {
        minVoltage: parsedConfig.evCharger.minVoltage,
        maxVoltage: parsedConfig.evCharger.maxVoltage,
        maxPower: parsedConfig.evCharger.maxPower,
        v_nom: parsedConfig.evCharger.v_nom || defaultConfig.evCharger.v_nom,
        p_supply: parsedConfig.evCharger.p_supply || defaultConfig.evCharger.p_supply,
        v_supply: parsedConfig.evCharger.v_supply || defaultConfig.evCharger.v_supply,
        p_consume: parsedConfig.evCharger.p_consume || defaultConfig.evCharger.p_consume,
        v_consume: parsedConfig.evCharger.v_consume || defaultConfig.evCharger.v_consume,
        p_opt: parsedConfig.evCharger.p_opt || defaultConfig.evCharger.p_opt
      },
      loads: {
        minVoltage: parsedConfig.loads.minVoltage,
        maxVoltage: parsedConfig.loads.maxVoltage,
        maxPower: parsedConfig.loads.maxPower,
        v_nom: parsedConfig.loads.v_nom || defaultConfig.loads.v_nom,
        p_supply: parsedConfig.loads.p_supply || defaultConfig.loads.p_supply,
        v_supply: parsedConfig.loads.v_supply || defaultConfig.loads.v_supply,
        p_consume: parsedConfig.loads.p_consume || defaultConfig.loads.p_consume,
        v_consume: parsedConfig.loads.v_consume || defaultConfig.loads.v_consume,
        p_opt: parsedConfig.loads.p_opt || defaultConfig.loads.p_opt
      }
    };

    res.json(droopCurveData);
  } catch (error) {
    console.error("Error reading config file:", error);
    res.status(500).json({ error: "Error reading config file" });
  }
});

// POST Endpoint to configure droop curves
router.post("/", async (req, res) => {
  try {
    const { device, parameters } = req.body;
    
    if (!device || !parameters) {
      return res.status(400).json({ error: "Invalid request format. Expected 'device' and 'parameters' object." });
    }
    
    // Validate the device name
    if (!['pv', 'bess', 'evCharger', 'loads'].includes(device)) {
      return res.status(400).json({ error: "Invalid device name. Must be one of: pv, bess, evCharger, loads" });
    }
    
    // Validate that parameters have the required properties
    const requiredParams = ['v_nom', 'p_supply', 'v_supply', 'p_consume', 'v_consume', 'p_opt'];
    for (const param of requiredParams) {
      if (typeof parameters[param] !== 'number') {
        return res.status(400).json({ 
          error: `Parameter '${param}' must be a number` 
        });
      }
    }
    
    // Read existing config.json
    const configData = await fs.readFile(configPath, "utf-8");
    let config = JSON.parse(configData);
    
    // Update droop curve parameters for the specific device
    if (config[device]) {
      config[device].v_nom = parameters.v_nom;
      config[device].p_supply = parameters.p_supply;
      config[device].v_supply = parameters.v_supply;
      config[device].p_consume = parameters.p_consume;
      config[device].v_consume = parameters.v_consume;
      config[device].p_opt = parameters.p_opt;
    }
    
    // Save updated config.json
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    res.json({ message: `Droop curve parameters for ${device} saved successfully` });
  } catch (error) {
    console.error("Error saving droop curve parameters:", error);
    res.status(500).json({ error: "Error saving droop curve parameters" });
  }
});

export default router;