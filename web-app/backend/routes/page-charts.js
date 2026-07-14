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
@Description: Charting API for profile, custom query and export workflows

@Created: 24th November 2025
@Last Modified: 14 July 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.3
*/


import { pool } from '../db/pool.js';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import XLSX from 'xlsx';

dotenv.config();

const TIMEZONE = process.env.TIMEZONE || 'UTC';
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const modbusConfigPath = path.join(__dirname, './../conf/modbus.json');

const PROFILE_INTERVALS = [300, 900, 1800, 3600];
const CUSTOM_INTERVALS = [10, 60, 300, 900, 1800, 3600];
const PROFILE_MAX_BUCKETS = 400;
const CUSTOM_MAX_BUCKETS = 5000;
const PROFILE_DEFAULT_PARAMETERS = ['POWER'];

const INTERVAL_LABELS = {
  10: '10 seconds',
  60: '1 minute',
  300: '5 minutes',
  900: '15 minutes',
  1800: '30 minutes',
  3600: '1 hour',
};

function parseDateOnly(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

  if (seconds % 3600 === 0) {
    return `${seconds / 3600} hour`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60} minutes`;
  }

  return `${seconds} seconds`;
}

function formatLocalBucketLabel(value) {
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

function roundValue(value, decimals = 3) {
  return Math.round(value * (10 ** decimals)) / (10 ** decimals);
}

function getEffectiveInterval(requestedSeconds, allowedSeconds, maxBuckets, rangeSeconds) {
  const normalizedRequested = parsePositiveInteger(requestedSeconds) || allowedSeconds[0];
  const minimumSecondsForRange = Math.max(normalizedRequested, Math.ceil(rangeSeconds / maxBuckets));
  const effective = allowedSeconds.find((seconds) => seconds >= minimumSecondsForRange);
  return effective || allowedSeconds[allowedSeconds.length - 1];
}

async function readModbusConfig() {
  try {
    const raw = await fs.readFile(modbusConfigPath, 'utf-8');
    const trimmed = raw.trim();

    if (!trimmed) {
      return { devices: [] };
    }

    return JSON.parse(trimmed);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return { devices: [] };
    }

    throw error;
  }
}

async function getActiveAssets(client) {
  const result = await client.query(
    `SELECT asset_key, name, type FROM assets WHERE is_active = true ORDER BY asset_key`
  );
  return result.rows;
}

async function buildParameterCatalog(client) {
  const [assets, modbusConfig] = await Promise.all([
    getActiveAssets(client),
    readModbusConfig(),
  ]);

  const assetMap = new Map(assets.map((asset) => [asset.asset_key, asset]));
  const catalog = [];

  (modbusConfig.devices || []).forEach((device) => {
    const asset = assetMap.get(device.assetKey);
    if (!asset) {
      return;
    }

    (device.parameters || []).forEach((parameter) => {
      const telemetryName = `${device.assetKey}_${parameter.name}`;
      const deviceName = device.name || asset.name;
      catalog.push({
        assetKey: device.assetKey,
        assetName: asset.name,
        deviceName,
        assetType: asset.type,
        parameterName: parameter.name,
        telemetryName,
        label: `${deviceName} - ${parameter.name}`,
        unit: parameter.unit || '',
        description: parameter.description || '',
        decimalPlaces: parameter.decimalPlaces ?? 2,
        mode: parameter.mode || 'read',
      });
    });
  });

  const seen = new Set();
  const deduped = catalog.filter((entry) => {
    if (seen.has(entry.telemetryName)) {
      return false;
    }

    seen.add(entry.telemetryName);
    return true;
  });

  deduped.sort((left, right) => left.label.localeCompare(right.label));

  return {
    assets,
    parameters: deduped,
  };
}

async function queryMeasurements(client, {
  parameters,
  start,
  end,
  intervalSeconds,
  timezone = TIMEZONE,
}) {
  if (!parameters.length) {
    return [];
  }

  const intervalLiteral = secondsToIntervalLiteral(intervalSeconds);
  const result = await client.query(
    `
      SELECT
        date_bin($4::interval, "time" AT TIME ZONE $5, TIMESTAMP '2001-01-01') AS bucket,
        "parameter",
        AVG("value") AS average_value,
        MIN("unit") AS unit
      FROM "measurements"
      WHERE "parameter" = ANY($1)
        AND "time" >= $2::timestamptz
        AND "time" < $3::timestamptz
        AND COALESCE("quality", 'ok') = 'ok'
      GROUP BY bucket, "parameter"
      ORDER BY bucket, "parameter";
    `,
    [parameters, start.toISOString(), end.toISOString(), intervalLiteral, timezone]
  );

  return result.rows.map((row) => ({
    bucket: row.bucket,
    bucketLabel: formatLocalBucketLabel(row.bucket),
    parameter: row.parameter,
    value: Number(row.average_value),
    unit: row.unit || '',
  }));
}

async function queryForecasts(client, {
  assetKeys,
  start,
  end,
  intervalSeconds,
  timezone = TIMEZONE,
}) {
  if (!assetKeys.length) {
    return [];
  }

  const intervalLiteral = secondsToIntervalLiteral(intervalSeconds);
  const result = await client.query(
    `
      SELECT
        asset_key,
        date_bin($4::interval, horizon_timestamp AT TIME ZONE $5, TIMESTAMP '2001-01-01') AS bucket,
        AVG(predicted_power) AS average_value
      FROM forecasts
      WHERE asset_key = ANY($1)
        AND horizon_timestamp >= $2::timestamptz
        AND horizon_timestamp < $3::timestamptz
      GROUP BY asset_key, bucket
      ORDER BY asset_key, bucket;
    `,
    [assetKeys, start.toISOString(), end.toISOString(), intervalLiteral, timezone]
  );

  return result.rows.map((row) => ({
    assetKey: row.asset_key,
    bucket: row.bucket,
    bucketLabel: formatLocalBucketLabel(row.bucket),
    value: Number(row.average_value),
  }));
}

function buildProfileResponse({
  assets,
  measurements,
  forecasts,
  intervalSeconds,
}) {
  const parameterToAsset = new Map();
  const assetKeyToName = new Map();

  assets.forEach((asset) => {
    PROFILE_DEFAULT_PARAMETERS.forEach((parameterName) => {
      parameterToAsset.set(`${asset.asset_key}_${parameterName}`, asset);
    });
    assetKeyToName.set(asset.asset_key, asset.name);
  });

  const chartData = new Map();

  measurements.forEach((row) => {
    const asset = parameterToAsset.get(row.parameter);
    if (!asset) {
      return;
    }

    const current = chartData.get(row.bucketLabel) || {
      bucket: row.bucketLabel,
      label: row.bucketLabel.slice(11, 16),
    };

    current[asset.name] = roundValue(row.value / 1000, 2);
    chartData.set(row.bucketLabel, current);
  });

  forecasts.forEach((row) => {
    const assetName = assetKeyToName.get(row.assetKey);
    if (!assetName) {
      return;
    }

    const current = chartData.get(row.bucketLabel) || {
      bucket: row.bucketLabel,
      label: row.bucketLabel.slice(11, 16),
    };

    current[`${assetName} (Forecast)`] = roundValue(row.value / 1000, 2);
    chartData.set(row.bucketLabel, current);
  });

  return {
    chartData: Array.from(chartData.values()).sort((left, right) => left.bucket.localeCompare(right.bucket)),
    assets,
    granularitySeconds: intervalSeconds,
    granularityLabel: INTERVAL_LABELS[intervalSeconds],
  };
}

function buildCustomResponse({
  chartDefinitions,
  parameterCatalog,
  measurements,
  intervalSeconds,
  start,
  end,
}) {
  const parameterMap = new Map(parameterCatalog.map((entry) => [entry.telemetryName, entry]));
  const buckets = new Map();

  measurements.forEach((row) => {
    const metadata = parameterMap.get(row.parameter);
    if (!metadata) {
      return;
    }

    const current = buckets.get(row.bucketLabel) || {
      bucket: row.bucketLabel,
      label: row.bucketLabel,
      values: {},
    };

    current.values[row.parameter] = roundValue(row.value, metadata.decimalPlaces ?? 3);
    buckets.set(row.bucketLabel, current);
  });

  const sortedRows = Array.from(buckets.values()).sort((left, right) => left.bucket.localeCompare(right.bucket));
  const chartSeries = chartDefinitions.map((chartDefinition, index) => {
    const parameters = chartDefinition.parameters
      .map((telemetryName) => parameterMap.get(telemetryName))
      .filter(Boolean);

    return {
      id: chartDefinition.id || `chart-${index + 1}`,
      title: chartDefinition.title || `Chart ${index + 1}`,
      parameters,
      data: sortedRows.map((row) => {
        const nextRow = {
          bucket: row.bucket,
          label: row.label,
        };

        parameters.forEach((parameter) => {
          nextRow[parameter.telemetryName] = row.values[parameter.telemetryName] ?? null;
        });

        return nextRow;
      }),
    };
  });

  const exportRows = sortedRows.map((row) => {
    const exportRow = {
      timestamp: row.bucket,
    };

    parameterCatalog.forEach((parameter) => {
      if (row.values[parameter.telemetryName] !== undefined) {
        exportRow[parameter.label] = row.values[parameter.telemetryName];
      }
    });

    return exportRow;
  });

  return {
    charts: chartSeries,
    selectedParameters: parameterCatalog,
    exportRows,
    granularitySeconds: intervalSeconds,
    granularityLabel: INTERVAL_LABELS[intervalSeconds],
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function validateCustomRequest(body) {
  const start = parseIsoDateTime(body?.start);
  const end = parseIsoDateTime(body?.end);

  if (!start || !end) {
    return { error: 'Valid start and end date-times are required.' };
  }

  if (end <= start) {
    return { error: 'End date-time must be greater than start date-time.' };
  }

  const charts = Array.isArray(body?.charts) ? body.charts : [];
  const normalizedCharts = charts
    .map((chart, index) => ({
      id: chart?.id || `chart-${index + 1}`,
      title: String(chart?.title || `Chart ${index + 1}`).trim(),
      parameters: Array.isArray(chart?.parameters)
        ? chart.parameters.filter((value) => typeof value === 'string' && value.trim())
        : [],
    }))
    .filter((chart) => chart.parameters.length > 0);

  if (!normalizedCharts.length) {
    return { error: 'At least one chart with at least one parameter is required.' };
  }

  return { start, end, charts: normalizedCharts };
}

router.get('/metadata', async (req, res) => {
  const client = await pool.connect();

  try {
    const metadata = await buildParameterCatalog(client);
    res.status(200).json(metadata);
  } catch (error) {
    console.error('Error loading chart metadata:', error);
    res.status(500).json({ error: 'Failed to load chart metadata.' });
  } finally {
    client.release();
  }
});

router.get('/profile', async (req, res) => {
  const selectedDate = parseDateOnly(req.query.date);
  if (!selectedDate) {
    return res.status(400).json({ error: 'Date parameter is required in yyyy-MM-dd format.' });
  }

  const requestedGranularity = parsePositiveInteger(req.query.granularity) || 3600;
  if (!PROFILE_INTERVALS.includes(requestedGranularity)) {
    return res.status(400).json({ error: 'Unsupported daily profile granularity.' });
  }

  const start = new Date(selectedDate);
  const end = new Date(selectedDate);
  end.setDate(end.getDate() + 1);

  const rangeSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
  const effectiveInterval = getEffectiveInterval(requestedGranularity, PROFILE_INTERVALS, PROFILE_MAX_BUCKETS, rangeSeconds);

  const client = await pool.connect();
  try {
    const assets = await getActiveAssets(client);

    if (!assets.length) {
      return res.status(200).json({ chartData: [], assets: [] });
    }

    const parameters = assets.flatMap((asset) => PROFILE_DEFAULT_PARAMETERS.map((parameter) => `${asset.asset_key}_${parameter}`));
    const assetKeys = assets.map((asset) => asset.asset_key);

    const [measurements, forecasts] = await Promise.all([
      queryMeasurements(client, { parameters, start, end, intervalSeconds: effectiveInterval }),
      queryForecasts(client, { assetKeys, start, end, intervalSeconds: effectiveInterval }),
    ]);

    res.status(200).json({
      ...buildProfileResponse({ assets, measurements, forecasts, intervalSeconds: effectiveInterval }),
      requestedGranularitySeconds: requestedGranularity,
    });
  } catch (error) {
    console.error('Error loading daily profile charts:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/custom/query', async (req, res) => {
  const requestState = validateCustomRequest(req.body);
  if (requestState.error) {
    return res.status(400).json({ error: requestState.error });
  }

  const { start, end, charts } = requestState;
  const requestedGranularity = parsePositiveInteger(req.body?.granularity) || 60;
  if (!CUSTOM_INTERVALS.includes(requestedGranularity)) {
    return res.status(400).json({ error: 'Unsupported custom viewer granularity.' });
  }

  const rangeSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
  const effectiveInterval = getEffectiveInterval(requestedGranularity, CUSTOM_INTERVALS, CUSTOM_MAX_BUCKETS, rangeSeconds);

  const client = await pool.connect();
  try {
    const metadata = await buildParameterCatalog(client);
    const parameterMap = new Map(metadata.parameters.map((entry) => [entry.telemetryName, entry]));
    const uniqueParameters = Array.from(new Set(charts.flatMap((chart) => chart.parameters)));
    const selectedParameters = uniqueParameters.map((name) => parameterMap.get(name)).filter(Boolean);

    if (!selectedParameters.length) {
      return res.status(400).json({ error: 'No valid parameters were selected.' });
    }

    const measurements = await queryMeasurements(client, {
      parameters: selectedParameters.map((entry) => entry.telemetryName),
      start,
      end,
      intervalSeconds: effectiveInterval,
    });

    res.status(200).json({
      ...buildCustomResponse({
        chartDefinitions: charts,
        parameterCatalog: selectedParameters,
        measurements,
        intervalSeconds: effectiveInterval,
        start,
        end,
      }),
      requestedGranularitySeconds: requestedGranularity,
    });
  } catch (error) {
    console.error('Error loading custom chart data:', error);
    res.status(500).json({ error: 'Failed to load custom chart data.' });
  } finally {
    client.release();
  }
});

router.post('/custom/export', async (req, res) => {
  const requestState = validateCustomRequest(req.body);
  if (requestState.error) {
    return res.status(400).json({ error: requestState.error });
  }

  const exportFormat = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
  const { start, end, charts } = requestState;
  const requestedGranularity = parsePositiveInteger(req.body?.granularity) || 60;
  const rangeSeconds = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
  const effectiveInterval = getEffectiveInterval(requestedGranularity, CUSTOM_INTERVALS, CUSTOM_MAX_BUCKETS, rangeSeconds);

  const client = await pool.connect();
  try {
    const metadata = await buildParameterCatalog(client);
    const parameterMap = new Map(metadata.parameters.map((entry) => [entry.telemetryName, entry]));
    const uniqueParameters = Array.from(new Set(charts.flatMap((chart) => chart.parameters)));
    const selectedParameters = uniqueParameters.map((name) => parameterMap.get(name)).filter(Boolean);

    const measurements = await queryMeasurements(client, {
      parameters: selectedParameters.map((entry) => entry.telemetryName),
      start,
      end,
      intervalSeconds: effectiveInterval,
    });

    const response = buildCustomResponse({
      chartDefinitions: charts,
      parameterCatalog: selectedParameters,
      measurements,
      intervalSeconds: effectiveInterval,
      start,
      end,
    });

    if (exportFormat === 'xlsx') {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(response.exportRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Measurements');
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="chart-export-${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    const worksheet = XLSX.utils.json_to_sheet(response.exportRows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="chart-export-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting custom chart data:', error);
    res.status(500).json({ error: 'Failed to export chart data.' });
  } finally {
    client.release();
  }
});

export default router;