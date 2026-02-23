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

@File: page-metrics.js
@Description: Provides RESTful endpoints to access calculated metrics from PostgreSQL

@Created: 11 February 2026
@Last Modified: 20 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
*/


import express from 'express';
import { pool } from '../db/pool.js';

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const floorToHour = (isoString) =>
  isoString.replace(/(\d{2}):\d{2}:\d{2}(\.\d+)?/, '$1:00:00.000');

/** Parse & validate ISO date query params, return defaults if missing */
const parseDateRange = (req, defaultHours = 24) => {
  const end   = floorToHour(
    req.query.end
      ? req.query.end.replace(' ', '+')
      : new Date().toISOString()
  );
  const start = floorToHour(
    req.query.start
      ? req.query.start.replace(' ', '+')
      : new Date(Date.now() - defaultHours * 3_600_000).toISOString()
  );
  return { start, end };
};

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/metrics/current
 * Returns the most recent calculation of every metric category, regardless of time range.
 * Useful as a "live snapshot".
 */
router.get('/current', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ON (metric_category)
        period_start,
        period_end,
        metric_category,
        metrics_json,
        calculation_time
      FROM metrics_summary
      ORDER BY metric_category, period_start DESC
    `;

    const result = await pool.query(query);

    const metrics = {};
    result.rows.forEach(row => {
      metrics[row.metric_category] = {
        ...row.metrics_json,
        period_start:     row.period_start,
        period_end:       row.period_end,
        calculation_time: row.calculation_time,
      };
    });

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching current metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/summary?start=&end=&category=
 * Returns all metric_category rows whose period falls within the requested range.
 * The React client uses this to derive "period-aware" aggregated metrics.
 */
router.get('/summary', async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const { category }   = req.query;

    let query = `
      SELECT
        period_start,
        period_end,
        metric_category,
        metrics_json,
        calculation_time
      FROM metrics_summary
      WHERE period_end >= $1
        AND period_end   <= $2
    `;
    const params = [start, end];

    if (category) {
      query += ' AND metric_category = $3';
      params.push(category);
    }

    query += ' ORDER BY period_start ASC, metric_category';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/latest
 * Metrics from the last 24 hours, all categories.
 */
router.get('/latest', async (req, res) => {
  try {
    const query = `
      SELECT
        period_start,
        period_end,
        metric_category,
        metrics_json,
        calculation_time
      FROM metrics_summary
      WHERE period_start >= NOW() - INTERVAL '24 hours'
      ORDER BY period_start DESC, metric_category
      LIMIT 50
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching latest metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/assets
 * All active assets.
 */
router.get('/assets', async (req, res) => {
  try {
    const query = `
      SELECT id, asset_key, name, type, is_active, created_at
      FROM assets
      WHERE is_active = true
      ORDER BY type, name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/assets/:assetKey?start=&end=
 * Per-asset time-series metrics.
 */
router.get('/assets/:assetKey', async (req, res) => {
  try {
    const { assetKey }   = req.params;
    const { start, end } = parseDateRange(req);

    const query = `
      SELECT
        period_start,
        period_end,
        asset_key,
        asset_type,
        metric_name,
        metric_value,
        metric_unit,
        calculation_time
      FROM asset_metrics
      WHERE asset_key   = $1
        AND period_end >= $2
        AND period_end   <= $3
      ORDER BY period_start DESC, metric_name
    `;

    const result = await pool.query(query, [assetKey, start, end]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching asset metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/timeseries/:metricName?start=&end=&assetKey=
 * Generic time-series for a named metric from asset_metrics.
 */
router.get('/timeseries/:metricName', async (req, res) => {
  try {
    const { metricName } = req.params;
    const { start, end } = parseDateRange(req, 7 * 24);
    const { assetKey }   = req.query;

    let query = `
      SELECT
        period_start AS timestamp,
        asset_key,
        metric_value AS value,
        metric_unit  AS unit
      FROM asset_metrics
      WHERE metric_name  = $1
        AND period_end   >= $2
        AND period_end   <= $3
    `;
    const params = [metricName, start, end];

    if (assetKey) {
      query += ' AND asset_key = $4';
      params.push(assetKey);
    }

    query += ' ORDER BY period_start ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching timeseries:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/hourly?start=&end=
 * Hourly (or sub-daily) energy_flow rows for the Energy Flow Timeline chart.
 * Returns rows whose bucket is ≤ 2 hours, ordered by period_end so the
 * client can use period_end as the canonical x-axis marker.
 */
router.get('/hourly', async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const query = `
      SELECT
        period_start,
        period_end,
        metric_category,
        metrics_json
      FROM metrics_summary
      WHERE metric_category = 'energy_flow'
        AND period_end   >= $1
        AND period_end   <= $2
      ORDER BY period_end ASC
    `;

    const result = await pool.query(query, [start, end]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching hourly data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/monthly?start=&end=
 * Monthly energy_flow rows for the Energy Flow Timeline chart when in monthly view.
 * A "monthly" bucket is defined as > 20 days long.
 */
router.get('/monthly', async (req, res) => {
  try {
    const { start, end } = parseDateRange(req, 90 * 24); // default 90 days

    const query = `
      SELECT
        period_start,
        period_end,
        metric_category,
        metrics_json
      FROM metrics_summary
      WHERE metric_category = 'energy_flow'
        AND period_end >= $1
        AND period_end   <= $2
        AND (period_end - period_start) > INTERVAL '20 days'
      ORDER BY period_end ASC
    `;

    const result = await pool.query(query, [start, end]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching monthly data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/energy-balance?start=&end=
 * Aggregates energy_flow metrics over the selected range into a single balance object.
 * This is used for the Pie chart and the Grid Import/Export metric cards.
 */
router.get('/energy-balance', async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);
    const query = `
      SELECT
        period_start,
        period_end,
        metrics_json
      FROM metrics_summary
      WHERE metric_category = 'energy_flow'
        AND period_end >= $1
        AND period_end   <= $2
      ORDER BY period_start ASC
    `;

    const result = await pool.query(query, [start, end]);

    const aggregated = result.rows.reduce((acc, row) => {
      const d = row.metrics_json;
      return {
        grid_import:      (acc.grid_import      || 0) + (d.grid?.total_import_wh       || 0),
        grid_export:      (acc.grid_export      || 0) + (d.grid?.total_export_wh       || 0),
        renewable:        (acc.renewable        || 0) + (d.renewable?.total_renewable_wh || 0),
        load:             (acc.load             || 0) + (d.load?.total_load_wh          || 0),
        bess_charging:    (acc.bess_charging    || 0) + (d.bess?.total_charging_wh      || 0),
        bess_discharging: (acc.bess_discharging || 0) + (d.bess?.total_discharging_wh  || 0),
        ev_charging:      (acc.ev_charging      || 0) + (d.ev?.total_charging_wh        || 0),
        ev_discharging:   (acc.ev_discharging   || 0) + (d.ev?.total_discharging_wh    || 0),
      };
    }, {});

    res.json(aggregated);
  } catch (error) {
    console.error('Error fetching energy balance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/efficiency?start=&end=
 * Returns efficiency_utilization metrics aggregated for the selected period.
 * Uses the most recent row within the range (efficiency rates are ratios, not sums).
 */
router.get('/efficiency', async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    const query = `
      SELECT metrics_json
      FROM metrics_summary
      WHERE metric_category = 'efficiency_utilization'
        AND period_end >= $1
        AND period_end   <= $2
      ORDER BY period_start DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [start, end]);
    res.json(result.rows.length > 0 ? result.rows[0].metrics_json : {});
  } catch (error) {
    console.error('Error fetching efficiency metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/metrics/device-performance?start=&end=
 * Returns the most recent device_performance row within the range.
 */
router.get('/device-performance', async (req, res) => {
  try {
    const { start, end } = parseDateRange(req);

    const query = `
      SELECT metrics_json
      FROM metrics_summary
      WHERE metric_category = 'device_performance'
        AND period_end >= $1
        AND period_end   <= $2
      ORDER BY period_start DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [start, end]);
    res.json(result.rows.length > 0 ? result.rows[0].metrics_json : {});
  } catch (error) {
    console.error('Error fetching device performance:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;