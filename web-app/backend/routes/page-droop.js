/*
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

@File: page-droop.js
@Description: # TODO: Add desc

@Created: 24th November 2025
@Last Modified: 19 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
*/

import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

// Needed for configuration json-file path
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execFilePromise = promisify(execFile);

// Definitions to resolve problems with __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, './../config.json');
const modbusConfigPath = path.join(__dirname, './../modbus.json');

// Path to Python reader script
const systemCoordPath = path.join(__dirname, '../../../core');
const venvPythonPath = path.join(__dirname, '../../../core/core-venv/Scripts/python.exe');

const router = express.Router();

// Helper function to read all Modbus data using Python script
async function readAllModbusData() {
  try {
    const { stdout, stderr } = await execFilePromise(venvPythonPath, ['-m', 'data.measurements_client', modbusConfigPath], {cwd: systemCoordPath});
    
    if (stderr) {
      console.error(`Python stderr: ${stderr}`);
    }
    
    if (!stdout.trim()) {
      throw new Error('No data received from Python script');
    }
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Error reading Modbus data:', error);
    throw error;
  }
}

// GET /api/droop-curve/modbus-data - Get all Modbus data for LUT calculation
router.get("/modbus-data", async (req, res) => {
  try {
    const modbusData = await readAllModbusData();
    res.json(modbusData);
  } catch (error) {
    console.error("Error reading Modbus data:", error);
    res.status(500).json({ error: "Error reading Modbus data from devices" });
  }
});

// Legacy endpoint for backward compatibility (if needed)
// GET /api/droop-curve - Get droop curve configuration (old format)
router.get("/", async (req, res) => {
  try {
    const configData = await fs.readFile(configPath, "utf-8");
    const parsedConfig = JSON.parse(configData);

    // Extract droop curve parameters for each device (legacy format)
    const droopCurveData = {
      pv: {
        minVoltage: parsedConfig.pv?.minVoltage,
        maxVoltage: parsedConfig.pv?.maxVoltage,
        maxPower: parsedConfig.pv?.maxPower,
        v_nom: parsedConfig.pv?.v_nom,
        p_supply: parsedConfig.pv?.p_supply,
        v_supply: parsedConfig.pv?.v_supply,
        p_consume: parsedConfig.pv?.p_consume,
        v_consume: parsedConfig.pv?.v_consume,
        p_opt: parsedConfig.pv?.p_opt
      },
      bess: {
        minVoltage: parsedConfig.bess?.minVoltage,
        maxVoltage: parsedConfig.bess?.maxVoltage,
        maxPower: parsedConfig.bess?.capacity,
        v_nom: parsedConfig.bess?.v_nom,
        p_supply: parsedConfig.bess?.p_supply,
        v_supply: parsedConfig.bess?.v_supply,
        p_consume: parsedConfig.bess?.p_consume,
        v_consume: parsedConfig.bess?.v_consume,
        p_opt: parsedConfig.bess?.p_opt
      },
      evCharger1: {
        minVoltage: parsedConfig.evCharger?.minVoltage,
        maxVoltage: parsedConfig.evCharger?.maxVoltage,
        maxPower: parsedConfig.evCharger?.maxPower,
        v_nom: parsedConfig.evCharger?.v_nom,
        p_supply: parsedConfig.evCharger?.p_supply,
        v_supply: parsedConfig.evCharger?.v_supply,
        p_consume: parsedConfig.evCharger?.p_consume,
        v_consume: parsedConfig.evCharger?.v_consume,
        p_opt: parsedConfig.evCharger?.p_opt
      },
      evCharger2: {
        minVoltage: parsedConfig.evCharger?.minVoltage,
        maxVoltage: parsedConfig.evCharger?.maxVoltage,
        maxPower: parsedConfig.evCharger?.maxPower,
        v_nom: parsedConfig.evCharger?.v_nom,
        p_supply: parsedConfig.evCharger?.p_supply,
        v_supply: parsedConfig.evCharger?.v_supply,
        p_consume: parsedConfig.evCharger?.p_consume,
        v_consume: parsedConfig.evCharger?.v_consume,
        p_opt: parsedConfig.evCharger?.p_opt
      },
      loads: {
        minVoltage: parsedConfig.loads?.minVoltage,
        maxVoltage: parsedConfig.loads?.maxVoltage,
        maxPower: parsedConfig.loads?.maxPower,
        v_nom: parsedConfig.loads?.v_nom,
        p_supply: parsedConfig.loads?.p_supply,
        v_supply: parsedConfig.loads?.v_supply,
        p_consume: parsedConfig.loads?.p_consume,
        v_consume: parsedConfig.loads?.v_consume,
        p_opt: parsedConfig.loads?.p_opt
      }
    };

    res.json(droopCurveData);
  } catch (error) {
    console.error("Error reading config file:", error);
    res.status(500).json({ error: "Error reading config file" });
  }
});

export default router;