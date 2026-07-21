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

@File: page-debug-optim.js
@Description: # TODO: Add desc

@Created: 24th November 2025
@Last Modified: 21 July 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.3
*/


import { pool } from '../db/pool.js';
import express from 'express';
import XLSX from 'xlsx';

const router = express.Router();
const OPTIMIZATION_INTERVALS = [900, 1800, 3600, 7200, 14400, 21600, 43200, 86400];
const OPTIMIZATION_MAX_BUCKETS = 5000;

function parseIsoDateTime(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function secondsToIntervalLiteral(seconds) {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }

  if (seconds % 86400 === 0) {
    return `${seconds / 86400} day`;
  }

  if (seconds % 3600 === 0) {
    return `${seconds / 3600} hour`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60} minutes`;
  }

  return `${seconds} seconds`;
}

function formatBucketLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getEffectiveInterval(requestedSeconds, rangeSeconds) {
  const normalizedRequested = parsePositiveInteger(requestedSeconds) || OPTIMIZATION_INTERVALS[0];
  const twoDaysSeconds = 2 * 24 * 3600;
  const minimumWindowInterval = rangeSeconds > twoDaysSeconds ? 3600 : OPTIMIZATION_INTERVALS[0];
  const minimumSecondsForRange = Math.max(
    normalizedRequested,
    minimumWindowInterval,
    Math.ceil(rangeSeconds / OPTIMIZATION_MAX_BUCKETS)
  );

  const effective = OPTIMIZATION_INTERVALS.find((seconds) => seconds >= minimumSecondsForRange);
  return effective || OPTIMIZATION_INTERVALS[OPTIMIZATION_INTERVALS.length - 1];
}

function validateRangeRequest(body) {
  const start = parseIsoDateTime(body?.start);
  const end = parseIsoDateTime(body?.end);

  if (!start || !end) {
    return { error: 'Valid start and end date-times are required.' };
  }

  if (end <= start) {
    return { error: 'End date-time must be greater than start date-time.' };
  }

  return { start, end };
}

async function queryResampledData(client, { start, end, intervalSeconds }) {
  const intervalLiteral = secondsToIntervalLiteral(intervalSeconds);

  const [inputsResult, outputsResult] = await Promise.all([
    client.query(
      `
        SELECT
          date_bin($3::interval, "time", TIMESTAMPTZ '2001-01-01 00:00:00+00') AS bucket,
          parameter,
          AVG(value) AS average_value,
          MIN(unit) AS unit,
          COUNT(*)::int AS sample_count
        FROM "ems-inputs"
        WHERE "time" >= $1::timestamptz
          AND "time" < $2::timestamptz
        GROUP BY bucket, parameter
        ORDER BY bucket DESC, parameter;
      `,
      [start.toISOString(), end.toISOString(), intervalLiteral]
    ),
    client.query(
      `
        SELECT
          date_bin($3::interval, "time", TIMESTAMPTZ '2001-01-01 00:00:00+00') AS bucket,
          parameter,
          AVG(value) AS average_value,
          MIN(unit) AS unit,
          COUNT(*)::int AS sample_count
        FROM "ems-outputs"
        WHERE "time" >= $1::timestamptz
          AND "time" < $2::timestamptz
        GROUP BY bucket, parameter
        ORDER BY bucket DESC, parameter;
      `,
      [start.toISOString(), end.toISOString(), intervalLiteral]
    ),
  ]);

  const normalizeRow = (source) => (row) => ({
    source,
    bucket: row.bucket,
    bucketLabel: formatBucketLabel(row.bucket),
    parameter: row.parameter,
    value: Number(row.average_value),
    unit: row.unit || '',
    sampleCount: row.sample_count,
  });

  return {
    inputs: inputsResult.rows.map(normalizeRow('ems-inputs')),
    outputs: outputsResult.rows.map(normalizeRow('ems-outputs')),
  };
}

function buildExportRows(inputs, outputs) {
  return [...inputs, ...outputs]
    .sort((left, right) => {
      const leftTime = new Date(left.bucket).getTime();
      const rightTime = new Date(right.bucket).getTime();
      return rightTime - leftTime;
    })
    .map((row) => ({
      source: row.source,
      timestamp: row.bucketLabel,
      parameter: row.parameter,
      average_value: row.value,
      unit: row.unit,
      sample_count: row.sampleCount,
    }));
}

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

router.post('/query', async (req, res) => {
  const requestState = validateRangeRequest(req.body);
  if (requestState.error) {
    return res.status(400).json({ error: requestState.error });
  }

  const { start, end } = requestState;
  const requestedGranularity = parsePositiveInteger(req.body?.granularity) || 900;
  const rangeSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
  const effectiveInterval = getEffectiveInterval(requestedGranularity, rangeSeconds);

  const client = await pool.connect();
  try {
    const { inputs, outputs } = await queryResampledData(client, {
      start,
      end,
      intervalSeconds: effectiveInterval,
    });

    res.status(200).json({
      start: start.toISOString(),
      end: end.toISOString(),
      requestedGranularitySeconds: requestedGranularity,
      granularitySeconds: effectiveInterval,
      granularityLabel: secondsToIntervalLiteral(effectiveInterval),
      inputs,
      outputs,
      totalRows: inputs.length + outputs.length,
    });
  } catch (error) {
    console.error('Error loading optimization debug data:', error);
    res.status(500).json({ error: 'Failed to load optimization debug data.' });
  } finally {
    client.release();
  }
});

router.post('/export', async (req, res) => {
  const requestState = validateRangeRequest(req.body);
  if (requestState.error) {
    return res.status(400).json({ error: requestState.error });
  }

  const exportFormat = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
  const { start, end } = requestState;
  const requestedGranularity = parsePositiveInteger(req.body?.granularity) || 900;
  const rangeSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
  const effectiveInterval = getEffectiveInterval(requestedGranularity, rangeSeconds);

  const client = await pool.connect();
  try {
    const { inputs, outputs } = await queryResampledData(client, {
      start,
      end,
      intervalSeconds: effectiveInterval,
    });

    const exportRows = buildExportRows(inputs, outputs);

    if (exportFormat === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      const inputSheet = XLSX.utils.json_to_sheet(inputs.map((row) => ({
        timestamp: row.bucketLabel,
        parameter: row.parameter,
        average_value: row.value,
        unit: row.unit,
        sample_count: row.sampleCount,
      })));
      const outputSheet = XLSX.utils.json_to_sheet(outputs.map((row) => ({
        timestamp: row.bucketLabel,
        parameter: row.parameter,
        average_value: row.value,
        unit: row.unit,
        sample_count: row.sampleCount,
      })));
      const combinedSheet = XLSX.utils.json_to_sheet(exportRows);

      XLSX.utils.book_append_sheet(workbook, inputSheet, 'EMS Inputs');
      XLSX.utils.book_append_sheet(workbook, outputSheet, 'EMS Outputs');
      XLSX.utils.book_append_sheet(workbook, combinedSheet, 'Combined');

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="optimization-export-${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="optimization-export-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting optimization debug data:', error);
    res.status(500).json({ error: 'Failed to export optimization debug data.' });
  } finally {
    client.release();
  }
});

export default router;