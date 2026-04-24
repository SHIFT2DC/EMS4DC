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

@File: page-settings.js
@Description: # TODO: Add desc

@Created: 1st February 2026
@Last Modified: 22 April 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/


import express from 'express';
import { pool } from '../db/pool.js';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, './../conf/config.json');
const modbusConfigPath = path.join(__dirname, './../conf/modbus.json');

const router = express.Router();

// ==================== ASSET TEMPLATES ====================

const ASSET_CONFIG_TEMPLATES = {
  PV: {
    config: {
      maxVoltage: 1000,
      minVoltage: 100,
      maxCurrent: 10,
      maxPower: 10000,
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: Power of the PV in Watts",
        wordOrder: "big",
        mode: "read"
      }
    ]
  },
  BESS: {
    config: {
      maxVoltage: 800,
      minVoltage: 600,
      maxChargeCurrent: 100,
      maxDischargeCurrent: 100,
      maxChargePower: 10000,
      maxDischargePower: 10000,
      maxPower: 50000,
      capacity: 100,
      minSoC: 10,
      maxSoC: 80,
      efficiency: 95,
      nominalVoltageDCBus: 700,
      droopVoltageUpperLimit: 760,
      droopVoltageLowerLimit: 640,
      droopPowerSupplyLimit: 40000,
      droopPowerConsumeLimit: 40000,
      droopVoltageDeadband: 10
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: Battery power (positive=discharging, negative=charging)",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "SoC",
        registerType: "holding",
        address: 3,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "%",
        description: "REQUIRED: State of Charge in percent",
        wordOrder: "big",
        mode: "read"
      }
    ]
  },
  LOAD: {
    config: {
      maxVoltage: 800,
      minVoltage: 600,
      maxCurrent: 50,
      maxPower: 30000,
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: Load power consumption",
        wordOrder: "big",
        mode: "read"
      }
    ]
  },
  CRITICAL_LOAD: {
    config: {
      maxVoltage: 800,
      minVoltage: 600,
      maxCurrent: 50,
      maxPower: 30000,
      priority: "high",
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: Critical load power consumption",
        wordOrder: "big",
        mode: "read"
      }
    ]
  },
  UNI_EV: {
    config: {
      maxVoltage: 800,
      minVoltage: 200,
      maxChargeCurrent: 32,
      maxPower: 22000,
      efficiency: 98,
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: EV charging power",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "SoC",
        registerType: "holding",
        address: 3,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "%",
        description: "REQUIRED: EV Battery State of Charge",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "CAR_CAP",
        registerType: "holding",
        address: 5,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "Wh",
        description: "REQUIRED: Capacity of the car connected to the unidirectional EV charger",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "CAR_MAX_P",
        registerType: "holding",
        address: 7,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "W",
        description: "REQUIRED: The maximum power the car can accept",
        wordOrder: "big",
        mode: "read"
      },
    ]
  },
  BI_EV: {
    config: {
      maxVoltage: 800,
      minVoltage: 200,
      maxChargeCurrent: 32,
      maxDischargeCurrent: 32,
      maxPower: 22000,
      efficiency: 97
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: EV power (negative=charging, positive=V2G discharging)",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "SoC",
        registerType: "holding",
        address: 3,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "%",
        description: "REQUIRED: EV Battery State of Charge",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "CAR_CAP",
        registerType: "holding",
        address: 5,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "Wh",
        description: "REQUIRED: Capacity of the battery of the car connected to the bidirectional EV charger",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "CAR_MAX_P",
        registerType: "holding",
        address: 7,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "W",
        description: "REQUIRED: Maximum power the car connected to the bidirectional EV charger can provide/accept",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "CAR_AVBL",
        registerType: "holding",
        address: 9,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "-",
        description: "REQUIRED: Parameter which indicates if the car can discharge at the moment: 1 if the car can provide power, 0 if not",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "CAR_ARRIVAL",
        registerType: "holding",
        address: 11,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 1,
        unit: "%",
        description: "REQUIRED: SoC of the car at the moment of arrival",
        wordOrder: "big",
        mode: "read"
      }       
    ]
  },
  WIND: {
    config: {
      maxVoltage: 1000,
      minVoltage: 100,
      maxCurrent: 15,
      maxPower: 15000,
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: Wind generator power",
        wordOrder: "big",
        mode: "read"
      }
    ]
  },
  AFE: {
    config: {
        maxVoltage: 800,
        minVoltage: 400,
        maxCurrent: 100,
        nominalPower: 50000,
        operatingFrequency: 50,
        nominalVoltageDCBus: 700,
        droopVoltageUpperLimit: 760,
        droopVoltageLowerLimit: 640,
        droopPowerSupplyLimit: 40000,
        droopPowerConsumeLimit: 40000
    },
    modbus: [
      {
        name: "POWER",
        registerType: "holding",
        address: 1,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: AFE power",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "AVBL",
        registerType: "holding",
        address: 3,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "-",
        description: "REQUIRED: Availability of the AFE: 1 for available, 0 for not active",
        wordOrder: "big",
        mode: "read"
      },
      {
        name: "GRIDSRVC",
        registerType: "holding",
        address: 5,
        modbusId: 1,
        dataType: "float32",
        scaleFactor: 1,
        offset: 0,
        decimalPlaces: 0,
        unit: "W",
        description: "REQUIRED: Grid service amount of the AC/DC point",
        wordOrder: "big",
        mode: "read"
      }
    ]
  }
};

// ==================== HELPER FUNCTIONS ====================

async function generateAssetKey(type) {
  try {
    // Get the type prefix (lowercase first letters)
    const prefix = type.toLowerCase().replace(/_/g, '');
    
    // Find the highest numbered asset with this type
    const query = `
      SELECT asset_key FROM assets 
      WHERE type = $1 AND asset_key ~ $2
      ORDER BY 
        CAST(SUBSTRING(asset_key FROM '[0-9]+$') AS INTEGER) DESC
      LIMIT 1
    `;
    
    const pattern = `^${prefix}[0-9]+$`;
    const result = await pool.query(query, [type, pattern]);
    
    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastKey = result.rows[0].asset_key;
      const match = lastKey.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }
    
    return `${prefix}${nextNumber}`;
  } catch (error) {
    console.error('Error generating asset key:', error);
    throw error;
  }
}

async function updateConfigFile(assetKey, assetName, assetType) {
  try {
    // Read existing config
    let config;
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const trimmedData = configData.trim();
      
      // Handle empty file
      if (!trimmedData) {
        config = { devices: [] };
      } else {
        config = JSON.parse(trimmedData);
      }
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        config = { devices: [] };
      } else {
        throw error;
      }
    }
    
    // Ensure devices array exists
    if (!config.devices) {
      config.devices = [];
    }
    
    // Get template for this asset type
    const template = ASSET_CONFIG_TEMPLATES[assetType];
    if (!template) {
      console.warn(`No config template found for asset type: ${assetType}`);
      return;
    }
    
    // Add new device configuration
    config.devices.push({
      id: assetKey,
      name: assetName,
      type: assetType,
      parameters: template.config
    });
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`Updated config.json with ${assetKey}`);
  } catch (error) {
    console.error('Error updating config file:', error);
    throw error;
  }
}

async function updateModbusFile(assetKey, assetName, assetType) {
  try {
    // Read existing modbus config
    let modbusConfig;
    try {
      const modbusData = await fs.readFile(modbusConfigPath, 'utf-8');
      const trimmedData = modbusData.trim();
      
      // Handle empty file
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
    
    // Ensure devices array exists
    if (!modbusConfig.devices) {
      modbusConfig.devices = [];
    }
    
    // Get template for this asset type
    const template = ASSET_CONFIG_TEMPLATES[assetType];
    if (!template) {
      console.warn(`No modbus template found for asset type: ${assetType}`);
      return;
    }
    
    // Generate unique IDs for parameters
    const timestamp = Date.now();
    const parameters = template.modbus.map((param, index) => ({
      id: `param-${timestamp}-${index}`,
      ...param
    }));
    
    // Add new device configuration
    modbusConfig.devices.push({
      id: `device-${timestamp}`,
      name: assetName,
      type: assetType,
      assetKey: assetKey,
      ipAddress: "192.168.1.100", // Default IP - user should update
      port: 502, // Default Modbus TCP port
      parameters: parameters
    });
    
    // Write updated modbus config
    await fs.writeFile(modbusConfigPath, JSON.stringify(modbusConfig, null, 2));
    console.log(`Updated modbus.json with ${assetKey}`);
  } catch (error) {
    console.error('Error updating modbus file:', error);
    throw error;
  }
}

async function removeFromConfigFile(assetKey) {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    const trimmedData = configData.trim();
    
    // Handle empty file
    if (!trimmedData) {
      return; // Nothing to remove from empty file
    }
    
    const config = JSON.parse(trimmedData);
    
    if (config.devices) {
      config.devices = config.devices.filter(device => device.id !== assetKey);
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      console.log(`Removed ${assetKey} from config.json`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return; // File doesn't exist, nothing to remove
    }
    console.error('Error removing from config file:', error);
    // Don't throw - this is cleanup, continue even if it fails
  }
}

async function removeFromModbusFile(assetKey) {
  try {
    const modbusData = await fs.readFile(modbusConfigPath, 'utf-8');
    const trimmedData = modbusData.trim();
    
    // Handle empty file
    if (!trimmedData) {
      return; // Nothing to remove from empty file
    }
    
    const modbusConfig = JSON.parse(trimmedData);
    
    if (modbusConfig.devices) {
      modbusConfig.devices = modbusConfig.devices.filter(device => device.assetKey !== assetKey);
      await fs.writeFile(modbusConfigPath, JSON.stringify(modbusConfig, null, 2));
      console.log(`Removed ${assetKey} from modbus.json`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      return; // File doesn't exist, nothing to remove
    }
    console.error('Error removing from modbus file:', error);
    // Don't throw - this is cleanup, continue even if it fails
  }
}

// ==================== ASSETS CRUD ====================

// Get all assets
router.get('/assets', async (req, res) => {
  try {
    const query = 'SELECT * FROM assets WHERE is_active = true ORDER BY created_at ASC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get single asset by ID or key
router.get('/assets/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const query = `
      SELECT * FROM assets 
      WHERE (id = $1 OR asset_key = $1) AND is_active = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [identifier]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Create new asset
router.post('/assets', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name, type } = req.body;
    
    if (!name || !type) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'name and type are required' });
    }
    
    const asset_key = await generateAssetKey(type);
    
    const insertAssetQuery = `
      INSERT INTO assets (asset_key, name, type)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const assetResult = await client.query(insertAssetQuery, [asset_key, name, type]);
    const newAsset = assetResult.rows[0];
    
    await client.query(
      `INSERT INTO asset_events (asset_id, event_type) VALUES ($1, 'created')`,
      [newAsset.id]
    );
    
    await client.query('COMMIT');
    
    try {
      await updateConfigFile(asset_key, name, type);
      await updateModbusFile(asset_key, name, type);
    } catch (fileError) {
      console.error('Warning: asset created in DB but file update failed:', fileError);
    }
    
    res.status(201).json(newAsset);
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    
    console.error('Error creating asset:', error);
    
    if (error.code === '23505') {
      res.status(409).json({ error: 'Asset with this key already exists' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to create asset' });
    }
  } finally {
    client.release();
  }
});

// Update asset
router.put('/assets/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, type } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    const updateQuery = `
      UPDATE assets 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND is_active=true
      RETURNING *
    `;
    
    const updateResult = await client.query(updateQuery, values);
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const updatedAsset = updateResult.rows[0];
    
    // Log event
    const eventQuery = `
      INSERT INTO asset_events (asset_id, event_type)
      VALUES ($1, 'updated')
    `;
    
    await client.query(eventQuery, [id]);
    
    await client.query('COMMIT');
    res.json(updatedAsset);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  } finally {
    client.release();
  }
});

// Delete asset
router.delete('/assets/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const assetResult = await client.query('SELECT * FROM assets WHERE id = $1', [req.params.id]);
    if (assetResult.rows.length === 0)
      return res.status(404).json({ error: 'Asset not found' });

    const asset = assetResult.rows[0];
    if (!asset.is_active)
      return res.status(400).json({ error: 'Asset already deleted' });

    // Log + soft delete inside transaction
    await client.query(
      `INSERT INTO asset_events (asset_id, event_type) VALUES ($1, 'deleted')`,
      [asset.id]
    );
    const result = await client.query(
      `UPDATE assets SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await client.query('COMMIT');

    try {
      await removeFromConfigFile(asset.asset_key);
      await removeFromModbusFile(asset.asset_key);
    } catch (fileError) {
      console.error('Warning: asset deleted in DB but file cleanup failed:', fileError);
    }

    res.json({ message: 'Asset deleted', asset: result.rows[0] });

  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { console.error('Rollback failed:', e); }
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: error.message || 'Failed to delete asset' });
  } finally {
    client.release();
  }
});

// ==================== ASSET EVENTS ====================

// Get events for an asset
router.get('/events', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const query = `
      SELECT 
        ae.*,
        a.name as asset_name
      FROM asset_events ae
      LEFT JOIN assets a ON ae.asset_id = a.id
      ORDER BY ae.event_timestamp DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ==================== CONFIGURATION FILES ====================

// Get config.json
router.get('/config', async (req, res) => {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    const trimmedData = configData.trim();
    
    // Handle empty file
    if (!trimmedData) {
      const defaultConfig = {
        generalSiteConfig: {
          selectedOperationMode: "droopMode"
        },
        devices: []
      };
      return res.json(defaultConfig);
    }
    
    const parsedConfig = JSON.parse(trimmedData);
    res.json(parsedConfig);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      const defaultConfig = {
        generalSiteConfig: {
          selectedOperationMode: "droopMode"
        },
        devices: []
      };
      res.json(defaultConfig);
    } else {
      console.error('Error reading configuration file:', error);
      res.status(500).json({ error: 'Error reading configuration file' });
    }
  }
});

// Update config.json
router.post('/config', async (req, res) => {
  try {
    const newConfig = req.body;
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    res.json({ message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Error writing configuration file:', error);
    res.status(500).json({ error: 'Error writing configuration file' });
  }
});

// Get modbus.json
router.get('/modbus', async (req, res) => {
  try {
    const modbusData = await fs.readFile(modbusConfigPath, 'utf-8');
    const trimmedData = modbusData.trim();
    
    // Handle empty file
    if (!trimmedData) {
      const defaultModbus = { devices: [] };
      return res.json(defaultModbus);
    }
    
    const parsedModbus = JSON.parse(trimmedData);
    res.json(parsedModbus);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      const defaultModbus = { devices: [] };
      res.json(defaultModbus);
    } else {
      console.error('Error reading modbus configuration file:', error);
      res.status(500).json({ error: 'Error reading modbus configuration file' });
    }
  }
});

// Update modbus.json
router.post('/modbus', async (req, res) => {
  try {
    const newModbus = req.body;
    await fs.writeFile(modbusConfigPath, JSON.stringify(newModbus, null, 2));
    res.json({ message: 'Modbus configuration saved successfully' });
  } catch (error) {
    console.error('Error writing modbus configuration file:', error);
    res.status(500).json({ error: 'Error writing modbus configuration file' });
  }
});

// ==================== BULK OPERATIONS ====================

// Export all configuration
router.get('/export', async (req, res) => {
  try {
    const assetsQuery = 'SELECT * FROM assets ORDER BY created_at ASC';
    const assetsResult = await pool.query(assetsQuery);
    
    let globalConfig = { devices: [] };
    let modbusConfig = { devices: [] };
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const trimmedConfigData = configData.trim();
      if (trimmedConfigData) {
        globalConfig = JSON.parse(trimmedConfigData);
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        throw error;
      }
    }
    
    try {
      const modbusData = await fs.readFile(modbusConfigPath, 'utf-8');
      const trimmedModbusData = modbusData.trim();
      if (trimmedModbusData) {
        modbusConfig = JSON.parse(trimmedModbusData);
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
        throw error;
      }
    }
    
    const exportData = {
      exported_at: new Date().toISOString(),
      global_config: globalConfig,
      modbus_config: modbusConfig,
      assets: assetsResult.rows
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting configuration:', error);
    res.status(500).json({ error: 'Failed to export configuration' });
  }
});

// Import configuration
router.post('/import', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { assets, global_config, modbus_config, overwrite = false } = req.body;
    
    const results = {
      created: [],
      updated: [],
      errors: []
    };
    
    // Update config files if provided
    if (global_config) {
      await fs.writeFile(configPath, JSON.stringify(global_config, null, 2));
    }
    
    if (modbus_config) {
      await fs.writeFile(modbusConfigPath, JSON.stringify(modbus_config, null, 2));
    }
    
    // Process each asset
    if (assets && assets.length > 0) {
      for (const asset of assets) {
        try {
          const existingQuery = 'SELECT id FROM assets WHERE asset_key = $1';
          const existingResult = await client.query(existingQuery, [asset.asset_key]);
          
          if (existingResult.rows.length > 0) {
            if (overwrite) {
              const updateQuery = `
                UPDATE assets 
                SET name = $1, type = $2
                WHERE asset_key = $3
                RETURNING *
              `;
              
              const updateResult = await client.query(updateQuery, [
                asset.name,
                asset.type,
                asset.asset_key
              ]);
              
              results.updated.push(updateResult.rows[0]);
            } else {
              results.errors.push({
                asset_key: asset.asset_key,
                error: 'Asset already exists (use overwrite=true to update)'
              });
            }
          } else {
            const insertQuery = `
              INSERT INTO assets (asset_key, name, type)
              VALUES ($1, $2, $3)
              RETURNING *
            `;
            
            const insertResult = await client.query(insertQuery, [
              asset.asset_key,
              asset.name,
              asset.type
            ]);
            
            results.created.push(insertResult.rows[0]);
          }
        } catch (assetError) {
          results.errors.push({
            asset_key: asset.asset_key,
            error: assetError.message
          });
        }
      }
    }
    
    await client.query('COMMIT');
    res.json(results);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing configuration:', error);
    res.status(500).json({ error: 'Failed to import configuration' });
  } finally {
    client.release();
  }
});

export default router;