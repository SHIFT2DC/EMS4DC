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
@Last Modified: 01 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
*/


import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, './../conf/config.json');

const MODBUS_API = process.env.MODBUS_API_URL ?? 'http://ems4dc-modbus-api:5050';
const router = express.Router();

// GET /api/droop-curve/modbus-data
router.get('/modbus-data', async (req, res) => {
  try {
    const response = await fetch(`${MODBUS_API}/measurements`);
    if (!response.ok) throw new Error(`Modbus API returned HTTP ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error reading Modbus data:', error);
    res.status(500).json({ error: 'Error reading Modbus data from devices' });
  }
});

// GET /api/droop-curve — Legacy config endpoint
router.get('/', async (req, res) => {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configData);

    const droopParam = (section) => ({
      minVoltage: parsedConfig[section]?.minVoltage,
      maxVoltage: parsedConfig[section]?.maxVoltage,
      maxPower:   parsedConfig[section]?.maxPower ?? parsedConfig[section]?.capacity,
      v_nom:      parsedConfig[section]?.v_nom,
      p_supply:   parsedConfig[section]?.p_supply,
      v_supply:   parsedConfig[section]?.v_supply,
      p_consume:  parsedConfig[section]?.p_consume,
      v_consume:  parsedConfig[section]?.v_consume,
      p_opt:      parsedConfig[section]?.p_opt,
    });

    res.json({
      pv:          droopParam('pv'),
      bess:        droopParam('bess'),
      evCharger1:  droopParam('evCharger'),
      evCharger2:  droopParam('evCharger'),
      loads:       droopParam('loads'),
    });
  } catch (error) {
    console.error('Error reading config file:', error);
    res.status(500).json({ error: 'Error reading config file' });
  }
});

export default router;