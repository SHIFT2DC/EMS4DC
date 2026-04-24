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

@File: page-charts.js
@Description: # TODO: Add desc

@Created: 24th November 2025
@Last Modified: 05 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/


import { pool } from '../db/pool.js';
import express from 'express';
import dotenv from "dotenv";

dotenv.config();
const TIMEZONE = process.env.TIMEZONE;
const router = express.Router();

// Endpoint to get data for charts page
router.get("/", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  try {
    const client = await pool.connect();

    // First, get all active assets
    const assetsResult = await client.query(
      `SELECT asset_key, name, type FROM assets WHERE is_active = true ORDER BY asset_key`
    );

    const activeAssets = assetsResult.rows;

    if (activeAssets.length === 0) {
      client.release();
      return res.status(200).json({ chartData: [], assets: [] });
    }

    // Build parameter names for the query
    const parameterNames = activeAssets.map(asset => `${asset.asset_key}_POWER`);
    const assetKeys = activeAssets.map(asset => asset.asset_key);

    // Query for hourly averages for all active assets (historical data)
    const measurementsResult = await client.query(
      `
      SELECT 
        EXTRACT(HOUR FROM "time" AT TIME ZONE $3) AS hour,
        "parameter",
        AVG("value") AS average_value
      FROM "measurements"
      WHERE "parameter" = ANY($2)
        AND "time" >= $1::date AT TIME ZONE $3
        AND "time" < ($1::date + INTERVAL '1 day') AT TIME ZONE $3
        AND "quality" = 'ok'
      GROUP BY EXTRACT(HOUR FROM "time" AT TIME ZONE $3), "parameter"
      ORDER BY hour, "parameter";
      `,
      [date, parameterNames, TIMEZONE]
    );

    // Query for forecasts for all active assets
    const forecastsResult = await client.query(
      `
      SELECT 
        asset_key,
        EXTRACT(HOUR FROM horizon_timestamp AT TIME ZONE $3) AS hour,
        predicted_power
      FROM forecasts
      WHERE asset_key = ANY($2)
        AND horizon_timestamp >= $1::date AT TIME ZONE $3
        AND horizon_timestamp < ($1::date + INTERVAL '1 day') AT TIME ZONE $3
      ORDER BY asset_key, hour;
      `,
      [date, assetKeys, TIMEZONE]
    );

    client.release();

    // Create a mapping from parameter to asset name and asset_key
    const parameterToAssetName = {};
    const assetKeyToName = {};
    activeAssets.forEach(asset => {
      parameterToAssetName[`${asset.asset_key}_POWER`] = asset.name;
      assetKeyToName[asset.asset_key] = asset.name;
    });

    const chartData = {};

    // Process historical measurements
    measurementsResult.rows.forEach((row) => {
      const hour = `${row.hour}:00`;
      const assetName = parameterToAssetName[row.parameter];

      if (!chartData[hour]) {
        chartData[hour] = { hour };
      }
      // Convert to kilowatts and round to one decimal
      chartData[hour][assetName] = Math.round((row.average_value / 1000) * 10) / 10;
    });

    // Process forecasts
    forecastsResult.rows.forEach((row) => {
      const hour = `${row.hour}:00`;
      const assetName = assetKeyToName[row.asset_key];
      const forecastKey = `${assetName} (Forecast)`;

      if (!chartData[hour]) {
        chartData[hour] = { hour };
      }
      
      // Convert to kilowatts and round to one decimal
      chartData[hour][forecastKey] = Math.round((row.predicted_power / 1000) * 10) / 10;
    });

    // Convert chartData object to array and sort by hour
    const responseData = Object.values(chartData).sort((a, b) => {
      const hourA = parseInt(a.hour.split(':')[0]);
      const hourB = parseInt(b.hour.split(':')[0]);
      return hourA - hourB;
    });

    res.status(200).json({
      chartData: responseData,
      assets: activeAssets
    });
  } catch (error) {
    console.error("Error querying database:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;