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

File: page-debug-optim.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 24th November 2025
Version: v1.2.0
*/

import { pool } from '../db/pool.js';
import express from '../../frontend/node_modules/express/index.js';

const router = express.Router();

// GET /api/ems-inputs - Fetch all EMS inputs
router.get('/ems-inputs', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        input_id,
        time,
        parameter,
        value,
        unit,
        quality
      FROM "ems-inputs"
      ORDER BY time DESC
    `;
    
    const result = await pool.query(query);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching EMS inputs:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch EMS inputs'
    });
  }
});

// GET /api/ems-outputs - Fetch all EMS outputs
router.get('/ems-outputs', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        output_id,
        time,
        parameter,
        value,
        unit,
        quality
      FROM "ems-outputs"
      ORDER BY time DESC
    `;
    
    const result = await pool.query(query);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching EMS outputs:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch EMS outputs'
    });
  }
});

// GET /api/ems-inputs/recent - Fetch recent EMS inputs (last 24 hours)
router.get('/ems-inputs/recent', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        input_id,
        time,
        parameter,
        value,
        unit,
        quality
      FROM "ems-inputs"
      WHERE time >= NOW() - INTERVAL '24 hours'
      ORDER BY time DESC
    `;
    
    const result = await pool.query(query);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent EMS inputs:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch recent EMS inputs'
    });
  }
});

// GET /api/ems-outputs/recent - Fetch recent EMS outputs (last 24 hours)
router.get('/ems-outputs/recent', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        output_id,
        time,
        parameter,
        value,
        unit,
        quality
      FROM "ems-outputs"
      WHERE time >= NOW() - INTERVAL '24 hours'
      ORDER BY time DESC
    `;
    
    const result = await pool.query(query);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent EMS outputs:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch recent EMS outputs'
    });
  }
});

export default router;