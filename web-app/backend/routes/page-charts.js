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

File: page-charts.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 24th November 2025
Version: v1.2.0
*/

import { pool } from '../db/pool.js';
import express from '../../frontend/node_modules/express/index.js';

const router = express.Router();

// Endpoint to get data for charts page
router.get("/", async (req, res) => {
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

export default router;