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

File: chart-data.js
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/
 
import { Pool } from "pg"
import 'dotenv/config'

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  })

export default async function handler(req, res) {
  const { date } = req.query

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" })
  }

  try {
    const client = await pool.connect()
    const result = await client.query(
      "SELECT EXTRACT(HOUR FROM Timestamp) as hour, AVG(Value) as value FROM AnalogTransition WHERE KeyTag = 4280000 DATE(timestamp) = $1 GROUP BY EXTRACT(HOUR FROM timestamp) ORDER BY hour",
      [date],
    )
    client.release()

    const chartData = result.rows.map((row) => ({
      hour: `${row.hour}:00`,
      value: Number.parseFloat(row.value),
    }))

    res.status(200).json(chartData)
  } catch (error) {
    console.error("Error querying database:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

