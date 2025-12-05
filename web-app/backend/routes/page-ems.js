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

File: page-ems.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 24th November 2025
Version: v1.2.0
*/

import { pool } from '../db/pool.js';
import express from '../../frontend/node_modules/express/index.js';

const router = express.Router();

// Endpoint to get available dates
router.get('/available-dates', async (req, res) => {
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

// Endpoint to get EMS data for a specific date with time bucketing
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { interval = '15' } = req.query; // Default to 15-minute intervals
    2
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

export default router;