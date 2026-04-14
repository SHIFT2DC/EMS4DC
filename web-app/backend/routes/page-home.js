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
@Last Modified: 01 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
*/


import express from 'express';
import { pool } from '../db/pool.js';

const router = express.Router();
const MODBUS_API = process.env.MODBUS_API_URL ?? 'http://ems4dc-modbus-api:5050';

/**
 * Fetch measurements for a single asset from the Modbus API service.
 */
async function readDeviceMeasurements(asset) {
  try {
    const res = await fetch(`${MODBUS_API}/measurements/${asset.asset_key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const measurementData = await res.json();

    const powerKey = `${asset.asset_key}_POWER`;
    const power = measurementData[powerKey] ?? measurementData.power ?? 0;

    return {
      id: asset.id,
      asset_key: asset.asset_key,
      name: asset.name,
      type: asset.type,
      power,
      measurements: measurementData,
      config: asset.config_params,
      is_active: asset.is_active,
      success: measurementData.success !== false,
    };
  } catch (error) {
    console.error(`Error reading ${asset.asset_key}:`, error.message);
    return {
      id: asset.id,
      asset_key: asset.asset_key,
      name: asset.name,
      type: asset.type,
      power: 0,
      error: error.message,
      config: asset.config_params,
      is_active: asset.is_active,
      success: false,
    };
  }
}

// GET /api/home — Assets with current measurements
router.get('/', async (req, res) => {
  try {
    const { rows: assets } = await pool.query(
      'SELECT * FROM assets WHERE is_active = true ORDER BY created_at ASC'
    );

    const assetsWithMeasurements = await Promise.all(
      assets.map(asset => readDeviceMeasurements(asset))
    );

    res.json({ timestamp: new Date().toISOString(), assets: assetsWithMeasurements });
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ error: 'Failed to fetch site data' });
  }
});

// POST /api/home/measurements — On-demand measurements for specific asset IDs
router.post('/measurements', async (req, res) => {
  try {
    const { asset_ids } = req.body;

    const query = asset_ids?.length
      ? 'SELECT * FROM assets WHERE id = ANY($1) AND is_active = true'
      : 'SELECT * FROM assets WHERE is_active = true';
    const params = asset_ids?.length ? [asset_ids] : [];

    const { rows: assets } = await pool.query(query, params);

    const results = await Promise.all(assets.map(asset => readDeviceMeasurements(asset)));

    res.json({ timestamp: new Date().toISOString(), devices: results });
  } catch (error) {
    console.error('Error getting measurements:', error);
    res.status(500).json({ error: 'Failed to get measurements' });
  }
});

export default router;