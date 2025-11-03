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

File: server.js
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/


import express from '../frontend/node_modules/express/index.js';
import { exec } from 'child_process';
import { execFile } from 'child_process';
import cors from '../frontend/node_modules/cors/lib/index.js';
import pg from "../frontend/node_modules/pg/lib/index.js";
import dotenv from "../frontend/node_modules/dotenv/lib/main.js";
import { promisify } from "util";
import { getSystemDetails } from "./systeminfo.js";
import path from "path"
import { promises as fs } from 'fs';

// Needed for configuration json-file path
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const execAsync = promisify(exec);
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

// Endpoint to receive data for home page
app.get('/api/data', (req, res) => {
  const modbusReaderPath = path.join(__dirname, '../../system-coordination/fetchMeasurements.py');
  const configPath = path.join(__dirname, 'modbus.json');
  execFile('python', [modbusReaderPath, configPath], (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'An error occurred while executing the Python script' });
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return res.status(500).json({ error: 'The Python script encountered an error' });
    }
    if (!stdout.trim()) {
      console.error('The Python script returned empty output');
      return res.status(500).json({ error: 'No data received from the Python script' });
    }
    try {
      const jsonData = JSON.parse(stdout);
      res.json(jsonData);
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError}`);
      console.error(`Raw output: ${stdout}`);
      res.status(500).json({ error: 'Failed to parse JSON from Python script output' });
    }
  });
});

// Endpoint to get data for charts page
app.get("/api/chart-data", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  try {
    const client = await pool.connect();

    // Query for hourly averages for multiple key tags
    const result = await client.query(
      `
      SELECT 
        EXTRACT(HOUR FROM "time") AS hour,
        "measurement_id",
        AVG("value") AS average_value
      FROM "measurements"
      WHERE "measurement_id" = ANY($2)
        AND "time" >= $1::date
        AND "time" < ($1::date + INTERVAL '1 day')
        AND "quality" = 'ok'
      GROUP BY EXTRACT(HOUR FROM "time"), "measurement_id"
      ORDER BY hour, "measurement_id";
      `,
      [date, [1, 2, 3, 4, 14, 25]]
    );

    client.release();

    // Map data into a structure suitable for the frontend
    const keyTagRules = {
      1: { title: "PV Power" },
      2: { title: "Battery Power" },
      3: { title: "Active Front End Power" },
      4: { title: "Unidirectional Charger"},
      14: { title: "Load Power" },
      25: { title: "Bidirectional EV Charger"}
    };

    const chartData = {};

    result.rows.forEach((row) => {
      const hour = `${row.hour}:00`;
      const title = keyTagRules[row.measurement_id]?.title;

      if (!chartData[hour]) {
        chartData[hour] = { hour };
      }
      // Convert to kilowatts and round to one decimal
      chartData[hour][title] = Math.round((row.average_value / 1000) * 10) / 10;
    });

    // Convert chartData object to array
    const responseData = Object.values(chartData);

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error querying database:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to get data about system
app.get('/api/system-info', async (req, res) => {
  try {
    const systemInfo = await getSystemDetails();
    res.json(systemInfo);
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
});

// Definitions to resolve problems with __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, 'config.json');
const configModbusPath = path.join(__dirname, 'modbus.json');

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

app.get("/api/config", async (req, res) => {
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

app.post("/api/config", async (req, res) => {
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

// Endpoint for droop curve configuration
app.get("/api/droop-curve", async (req, res) => {
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
app.post("/api/droop-curve", async (req, res) => {
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

// API endpoint to read Modbus configuration
app.get('/api/modbus-config', async (req, res) => {
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
app.post('/api/save-modbus-config', async (req, res) => {
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

// Helper function to format date for SQL query
const formatDateForSQL = (date) => {
  return date.toISOString().split('T')[0];
};

// Endpoint to get EMS data for a specific date with time bucketing
app.get('/api/ems-data/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { interval = '15' } = req.query; // Default to 15-minute intervals
    
    // Helper function to round time to nearest interval
    const roundToInterval = (timestamp, intervalMinutes) => {
      const date = new Date(timestamp);
      const minutes = date.getMinutes();
      const roundedMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
      date.setMinutes(roundedMinutes, 0, 0); // Set seconds and milliseconds to 0
      return date;
    };
    
    // Get inputs data for the specified date
    const inputsQuery = `
      SELECT time, parameter, value, unit
      FROM "ems-inputs"
      WHERE DATE(time) = $1
      AND parameter IN ('pv_fct', 'ld_fct')
      ORDER BY time ASC
    `;
    
    // Get outputs data for the specified date
    const outputsQuery = `
      SELECT time, parameter, value, unit
      FROM "ems-outputs"
      WHERE DATE(time) = $1
      AND parameter IN ('pv', 'ld', 'bl', 'bc', 'bd', 'import_AC_to_DC', 'export_DC_to_AC', 'export_DC_to_AC_ngs', 'exp2', 'c1_ch', 'c2_ch', 'c2_dis', 'v1_soc', 'v2_soc')
      AND quality='ok'
      ORDER BY time ASC
    `;
    
    // Get measurements data for the specified date
    const measurementsQuery = `
      SELECT time, parameter, value, unit
      FROM "measurements"
      WHERE DATE(time) = $1
      AND parameter IN ('EV1_POWER', 'EV2_POWER', 'EV1_SoC', 'EV2_SoC')
      ORDER BY time ASC
    `;
    
    const [inputsResult, outputsResult, measurementsResult] = await Promise.all([
      pool.query(inputsQuery, [date]),
      pool.query(outputsQuery, [date]),
      pool.query(measurementsQuery, [date])
    ]);
    
    // Group data by rounded timestamp buckets
    const bucketedData = {};
    const intervalMinutes = parseInt(interval);
    
    // Helper function to process data with time bucketing
    const processDataWithBucketing = (rows, tolerance = 2 * 60 * 1000) => {
      rows.forEach(row => {
        const roundedTime = roundToInterval(row.time, intervalMinutes);
        let bucketKey = roundedTime.toISOString();
        
        // If exact bucket doesn't exist, try to find nearest bucket within tolerance
        if (!bucketedData[bucketKey]) {
          const nearestBucket = Object.keys(bucketedData).find(key => {
            const bucketTime = new Date(key);
            const timeDiff = Math.abs(bucketTime.getTime() - roundedTime.getTime());
            return timeDiff <= tolerance;
          });
          
          if (nearestBucket) {
            bucketKey = nearestBucket;
          } else {
            // Create new bucket if no nearby bucket found
            bucketedData[bucketKey] = { 
              time: bucketKey, 
              originalTime: roundedTime,
              dataPoints: 0 
            };
          }
        }
        
        // Use the latest value in the bucket or average if multiple values
        if (!bucketedData[bucketKey][row.parameter]) {
          bucketedData[bucketKey][row.parameter] = row.value;
        } else {
          // Average the values if multiple exist in same bucket
          bucketedData[bucketKey][row.parameter] = 
            (bucketedData[bucketKey][row.parameter] + row.value) / 2;
        }
        bucketedData[bucketKey].dataPoints++;
      });
    };
    
    // Process all data sources
    processDataWithBucketing(inputsResult.rows);
    processDataWithBucketing(outputsResult.rows);
    processDataWithBucketing(measurementsResult.rows);
    
    // Convert to array, sort by time, and filter out incomplete data points
    const data = Object.values(bucketedData)
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .filter(item => item.dataPoints > 0) // Only include buckets with actual data
      .map(item => ({
        ...item,
        // Convert EV power measurements from watts to kilowatts for consistency
        EV1_POWER: item.EV1_POWER ? item.EV1_POWER / 1000 : item.EV1_POWER,
        EV2_POWER: item.EV2_POWER ? item.EV2_POWER / 1000 : item.EV2_POWER
      }));
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      interval: intervalMinutes,
      info: `Data grouped into ${intervalMinutes}-minute intervals`
    });
    
  } catch (error) {
    console.error('Error fetching EMS data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EMS data'
    });
  }
});

// Endpoint to get available dates
app.get('/api/available-dates', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT DATE(time) as date
      FROM "ems-outputs"
      ORDER BY date DESC
      LIMIT 30
    `;
    
    const result = await pool.query(query);
    const dates = result.rows.map(row => row.date.toISOString().split('T')[0]);
    
    res.json({
      success: true,
      dates: dates
    });
    
  } catch (error) {
    console.error('Error fetching available dates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available dates'
    });
  }
});

// GET /api/ems-inputs - Fetch all EMS inputs
app.get('/api/ems-inputs', async (req, res) => {
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
app.get('/api/ems-outputs', async (req, res) => {
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
app.get('/api/ems-inputs/recent', async (req, res) => {
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
app.get('/api/ems-outputs/recent', async (req, res) => {
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});