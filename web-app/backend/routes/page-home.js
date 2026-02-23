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

@File: page-home.js
@Description: # TODO: Add desc

@Created: 24th November 2025
@Last Modified: 19 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
*/

/*page-home.js - Updated Version*/
import express from 'express';
import { pool } from '../db/pool.js';
import path from 'path';
import { dirname } from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

/**
 * Helper function to read measurements for a single device
 */
async function readDeviceMeasurements(asset, modbusConfigPath, venvPythonPath, systemCoordPath) {
  return new Promise((resolve) => {
    execFile(
      venvPythonPath,
      ['-m', 'data.measurements_client', modbusConfigPath, '--asset-key', asset.asset_key],
      { cwd: systemCoordPath },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error reading ${asset.asset_key}:`, error.message);
          resolve({
            id: asset.id,
            asset_key: asset.asset_key,
            name: asset.name,
            type: asset.type,
            power: 0,
            error: error.message,
            config: asset.config_params,
            is_active: asset.is_active,
            success: false
          });
          return;
        }

        if (stderr) {
          console.error(`stderr for ${asset.asset_key}:`, stderr);
        }

        if (!stdout.trim()) {
          resolve({
            id: asset.id,
            asset_key: asset.asset_key,
            name: asset.name,
            type: asset.type,
            power: 0,
            error: 'No data received',
            config: asset.config_params,
            is_active: asset.is_active,
            success: false
          });
          return;
        }

        try {
          const measurementData = JSON.parse(stdout);
          
          // Extract power value
          const powerKey = `${asset.asset_key}_POWER`;
          const power = measurementData[powerKey] || measurementData.power || 0;

          resolve({
            id: asset.id,
            asset_key: asset.asset_key,
            name: asset.name,
            type: asset.type,
            power: power,
            measurements: measurementData,
            config: asset.config_params,
            is_active: asset.is_active,
            success: measurementData.success !== false
          });
        } catch (parseError) {
          console.error(`JSON parse error for ${asset.asset_key}:`, parseError);
          resolve({
            id: asset.id,
            asset_key: asset.asset_key,
            name: asset.name,
            type: asset.type,
            power: 0,
            error: 'Failed to parse measurement data',
            config: asset.config_params,
            is_active: asset.is_active,
            success: false
          });
        }
      }
    );
  });
}

// Endpoint to get assets and their current measurements
router.get('/', async (req, res) => {
  try {
    // Fetch active assets from database
    const assetsQuery = 'SELECT * FROM assets WHERE is_active = true ORDER BY created_at ASC';
    const assetsResult = await pool.query(assetsQuery);
    const assets = assetsResult.rows;

    // System coordination paths
    const systemCoordPath = path.join(__dirname, '../../../core');
    const venvPythonPath = path.join(__dirname, '../../../core/core-venv/Scripts/python.exe');
    const modbusConfigPath = path.join(__dirname, '../modbus.json');

    // Check if modbus config exists
    try {
      await fs.access(modbusConfigPath);
    } catch (err) {
      console.error('Modbus config not found:', modbusConfigPath);
      return res.status(500).json({ error: 'Modbus configuration file not found' });
    }

    // Read measurements for each device individually
    const measurementPromises = assets.map(asset => 
      readDeviceMeasurements(asset, modbusConfigPath, venvPythonPath, systemCoordPath)
    );

    // Wait for all measurements (each handles its own errors)
    const assetsWithMeasurements = await Promise.all(measurementPromises);

    res.json({
      timestamp: new Date().toISOString(),
      assets: assetsWithMeasurements
    });

  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ error: 'Failed to fetch site data' });
  }
});

// Endpoint to get real-time measurements using Modbus
router.post('/measurements', async (req, res) => {
  try {
    const { asset_ids } = req.body;
    
    // Fetch specified assets
    const assetsQuery = asset_ids && asset_ids.length > 0
      ? 'SELECT * FROM assets WHERE id = ANY($1) AND is_active = true'
      : 'SELECT * FROM assets WHERE is_active = true';
    
    const assetsResult = await pool.query(
      assetsQuery, 
      asset_ids && asset_ids.length > 0 ? [asset_ids] : []
    );
    const assets = assetsResult.rows;

    // System coordination paths
    const systemCoordPath = path.join(__dirname, '../../../core');
    const venvPythonPath = path.join(__dirname, '../../../core/core-venv/Scripts/python.exe');
    const modbusConfigPath = path.join(__dirname, '../modbus.json');

    // Read measurements for each device individually
    const measurementPromises = assets.map(asset => 
      readDeviceMeasurements(asset, modbusConfigPath, venvPythonPath, systemCoordPath)
    );

    // Wait for all measurements
    const results = await Promise.all(measurementPromises);

    // Combine all successful measurements
    const combinedData = {
      timestamp: new Date().toISOString(),
      devices: results
    };

    res.json(combinedData);

  } catch (error) {
    console.error('Error getting measurements:', error);
    res.status(500).json({ error: 'Failed to get measurements' });
  }
});

export default router;