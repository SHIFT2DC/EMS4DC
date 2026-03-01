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

@File: page-device.js
@Description: # TODO: Add desc

@Created: 1st February 2026
@Last Modified: 27 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
*/


import express from 'express';
import { pool } from '../db/pool.js';
import path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const modbusConfigPath = path.join(__dirname, './../conf/modbus.json');

const router = express.Router();

// Get device details and current readings by asset key
router.get('/device/:assetKey', async (req, res) => {
  try {
    const { assetKey } = req.params;
    
    // Get asset from database
    const assetQuery = `
      SELECT * FROM assets 
      WHERE asset_key = $1 AND is_active = true
      LIMIT 1
    `;
    
    const assetResult = await pool.query(assetQuery, [assetKey]);
    
    if (assetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const asset = assetResult.rows[0];
    
    // Load modbus configuration to get parameters
    let modbusConfig;
    try {
      const modbusData = await fs.readFile(modbusConfigPath, 'utf-8');
      const trimmedData = modbusData.trim();
      
      if (!trimmedData) {
        modbusConfig = { devices: [] };
      } else {
        modbusConfig = JSON.parse(trimmedData);
      }
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        modbusConfig = { devices: [] };
      } else {
        throw error;
      }
    }
    
    // Find the device's modbus configuration
    const deviceModbus = modbusConfig.devices?.find(d => d.assetKey === assetKey);
    
    // Get read parameters (exclude write-only parameters)
    const parameters = deviceModbus?.parameters?.filter(p => p.mode === 'read') || [];
    
    // Get current readings from the latest telemetry
    // Parameter names in telemetry table have format: {asset_key}_{PARAMETER_NAME}
    // For example: pv1_POWER, bess1_SOC, etc.
    const readingsQuery = `
      SELECT parameter, value, time
      FROM (
        SELECT 
          parameter, 
          value, 
          time,
          ROW_NUMBER() OVER (PARTITION BY parameter ORDER BY time DESC) as rn
        FROM measurements
        WHERE parameter LIKE $1
          AND time > NOW() - INTERVAL '1 minute'
      ) t
      WHERE rn = 1
    `;
    
    let readings = {};
    let latestTimestamp = new Date();
    
    try {
      // Search for parameters starting with asset_key prefix (e.g., "pv1_%")
      const parameterPrefix = `${assetKey}_%`;
      const readingsResult = await pool.query(readingsQuery, [parameterPrefix]);
      
      readingsResult.rows.forEach(row => {
        // Extract the parameter name without the asset_key prefix
        // e.g., "pv1_POWER" -> "POWER"
        const paramName = row.parameter.replace(`${assetKey}_`, '');
        readings[paramName] = row.value;
      });
      
      if (readingsResult.rows.length > 0) {
        latestTimestamp = new Date(readingsResult.rows[0].time);
      }
    } catch (error) {
      // If telemetry table doesn't exist or query fails, continue with empty readings
      console.warn('Could not fetch telemetry data:', error.message);
    }
    
    // Return device data
    res.json({
      asset: {
        id: asset.id,
        asset_key: asset.asset_key,
        name: asset.name,
        type: asset.type,
        created_at: asset.created_at
      },
      parameters: parameters.map(p => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        description: p.description,
        decimalPlaces: p.decimalPlaces,
        dataType: p.dataType
      })),
      readings: readings,
      timestamp: latestTimestamp.toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching device data:', error);
    res.status(500).json({ error: 'Failed to fetch device data' });
  }
});

// Get list of all active devices for navigation
router.get('/devices/list', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        asset_key,
        name,
        type,
        created_at
      FROM assets 
      WHERE is_active = true 
      ORDER BY created_at ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      devices: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching devices list:', error);
    res.status(500).json({ error: 'Failed to fetch devices list' });
  }
});

export default router;