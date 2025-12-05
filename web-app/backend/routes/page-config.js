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

File: page-config.js
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
const configPath = path.join(__dirname, './../config.json');

const router = express.Router();

// Updated default config with droop curve parameters and Active Front End
const defaultConfig = {
  evCharger1: {
    maxVoltage: 400,
    minVoltage: 200,
    maxCurrent: 32,
    minCurrent: 6,
    maxPower: 22000,
    // Add default droop curve parameters
    v_nom: 300,
    p_supply: 22000,
    v_supply: 100,
    p_consume: 0,
    v_consume: 0,
    p_opt: 0,
    efficiency: 1
  },
  evCharger2: {
    maxVoltage: 400,
    minVoltage: 200,
    maxCurrent: 32,
    minCurrent: 6,
    maxPower: 22000,
    // Add default droop curve parameters
    v_nom: 300,
    p_supply: 22000,
    v_supply: 100,
    p_consume: 0,
    v_consume: 0,
    p_opt: 0,
    efficiency: 1
  },
  pv: {
    maxVoltage: 1000,
    minVoltage: 100,
    maxCurrent: 10,
    maxPower: 10000,
    // Add default droop curve parameters
    v_nom: 700,
    p_supply: 10000,
    v_supply: 600,
    p_consume: 5000,
    v_consume: 300,
    p_opt: 0
  },
  bess: {
    maxVoltage: 800,
    minVoltage: 400,
    maxChargeCurrent: 100,
    maxDischargeCurrent: 100,
    capacity: 100000,
    // Add default droop curve parameters
    v_nom: 700,
    p_supply: 100000,
    v_supply: 100,
    p_consume: 100000,
    v_consume: 100,
    p_opt: 0,
    efficiency: 1,
    minSoC: 20,
    maxSoC: 80
  },
  loads: {
    maxVoltage: 240,
    minVoltage: 220,
    maxCurrent: 100,
    maxPower: 24000,
    // Add default droop curve parameters
    v_nom: 230,
    p_supply: 0,
    v_supply: 0,
    p_consume: 24000,
    v_consume: 10,
    p_opt: 0
  },
  activeFrontEnd: {
    nominalPower: 50000,
    maxVoltage: 800,
    minVoltage: 400,
    maxCurrent: 100,
    efficiency: 95,
    operatingFrequency: 50,
    // Add default droop curve parameters
    v_nom: 600,
    p_supply: 50000,
    v_supply: 50,
    p_consume: 50000,
    v_consume: 50,
    p_opt: 0
  }
}

router.get("/", async (req, res) => {
  try {
    const configData = await fs.readFile(configPath, "utf-8")
    let parsedConfig

    try {
      parsedConfig = JSON.parse(configData)
    } catch (parseError) {
      console.warn("Invalid JSON in config file, using default config")
      parsedConfig = {}
    }

    // Check if the parsed config is empty or doesn't have the expected structure
    if (Object.keys(parsedConfig).length === 0 || !parsedConfig.evCharger1) {
      console.log("Empty or invalid config, using default config")
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
      res.json(defaultConfig)
    } else {
      // Ensure all devices have the required droop curve parameters
      const devices = ['pv', 'bess', 'evCharger1', 'evCharger2', 'loads', 'activeFrontEnd'];
      let configUpdated = false;
      
      for (const device of devices) {
        // If device doesn't exist in config, add it with defaults
        if (!parsedConfig[device]) {
          parsedConfig[device] = defaultConfig[device];
          configUpdated = true;
        } else {
          // Check if droop curve parameters exist, if not add defaults
          if (parsedConfig[device].v_nom === undefined) {
            parsedConfig[device].v_nom = defaultConfig[device].v_nom;
            configUpdated = true;
          }
          if (parsedConfig[device].p_supply === undefined) {
            parsedConfig[device].p_supply = defaultConfig[device].p_supply;
            configUpdated = true;
          }
          if (parsedConfig[device].v_supply === undefined) {
            parsedConfig[device].v_supply = defaultConfig[device].v_supply;
            configUpdated = true;
          }
          if (parsedConfig[device].p_consume === undefined) {
            parsedConfig[device].p_consume = defaultConfig[device].p_consume;
            configUpdated = true;
          }
          if (parsedConfig[device].v_consume === undefined) {
            parsedConfig[device].v_consume = defaultConfig[device].v_consume;
            configUpdated = true;
          }
          if (parsedConfig[device].p_opt === undefined) {
            parsedConfig[device].p_opt = defaultConfig[device].p_opt;
            configUpdated = true;
          }
        }
      }
      
      // If we added any missing parameters, save the updated config
      if (configUpdated) {
        await fs.writeFile(configPath, JSON.stringify(parsedConfig, null, 2));
      }
      
      res.json(parsedConfig);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      // If the file doesn't exist, create it with the default configuration
      console.log("Config file not found, creating with default config")
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2))
      res.json(defaultConfig)
    } else {
      console.error("Error reading configuration file:", error)
      res.status(500).json({ error: "Error reading configuration file" })
    }
  }
})

router.post("/", async (req, res) => {
  try {
    const newConfig = req.body

    // Validate the incoming config - Updated to include activeFrontEnd
    if (!newConfig.evCharger1 || !newConfig.evCharger2 || !newConfig.pv || !newConfig.bess || !newConfig.loads || !newConfig.activeFrontEnd) {
      throw new Error("Invalid configuration structure")
    }

    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2))
    res.json({ message: "Configuration saved successfully" })
  } catch (error) {
    console.error("Error writing configuration file:", error)
    res.status(500).json({ error: "Error writing configuration file" })
  }
})

export default router;