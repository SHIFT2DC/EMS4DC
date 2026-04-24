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

@File: page-ems.js
@Description: # TODO: Add desc

@Created: 24th November 2025
@Last Modified: 24 April 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/


import { pool } from '../db/pool.js';
import express from 'express';
import fs      from 'fs';
import path    from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ── Load config once at startup ───────────────────────────────────────────────
const configPath = path.join(__dirname, './../conf/config.json');
let siteConfig = { devices: [] };
try {
  siteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.warn('Could not load config.json:', err.message);
}

/** Returns capacity in kWh for a given asset_key (= device id in config) */
const getBessCapacity = (assetKey) => {
  const device = siteConfig.devices?.find(d => d.id === assetKey && d.type === 'BESS');
  // config stores capacity in Wh → convert to kWh
  return device?.parameters?.capacity != null
    ? device.parameters.capacity / 1000
    : null;
};

// ── Active assets ─────────────────────────────────────────────────────────────
router.get('/active-assets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT asset_key, name, type, is_active
      FROM assets
      WHERE is_active = true
      ORDER BY type, name
    `);

    const assetsByType = result.rows.reduce((acc, asset) => {
      if (!acc[asset.type]) acc[asset.type] = [];
      acc[asset.type].push(asset);
      return acc;
    }, {});

    res.json({ success: true, assets: result.rows, assetsByType });
  } catch (error) {
    console.error('Error fetching active assets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active assets' });
  }
});

// ── Available dates ───────────────────────────────────────────────────────────
router.get('/available-dates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT DATE(time) as date
      FROM "ems-outputs"
      ORDER BY date DESC
      LIMIT 30
    `);
    res.json({
      success: true,
      dates: result.rows.map(r => r.date.toISOString().split('T')[0])
    });
  } catch (error) {
    console.error('Error fetching available dates:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch available dates' });
  }
});

// ── EMS data for a specific date ──────────────────────────────────────────────
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const intervalMinutes = parseInt(req.query.interval || '15', 10);

    // Round a timestamp down to the nearest interval bucket
    const roundToInterval = (ts, mins) => {
      const d = new Date(ts);
      d.setMinutes(Math.floor(d.getMinutes() / mins) * mins, 0, 0);
      return d;
    };

    // ── Fetch active assets ───────────────────────────────────────────────────
    const assetsResult = await pool.query(`
      SELECT asset_key, type, name
      FROM assets
      WHERE is_active = true
    `);
    const activeAssets = assetsResult.rows;

    const byType = (type) => activeAssets.filter(a => a.type === type);
    const afeAssets   = byType('AFE');
    const pvAssets    = byType('PV');
    const windAssets  = byType('WIND');
    const loadAssets  = byType('LOAD');
    const cloadAssets = byType('CRITICAL_LOAD');
    const bessAssets  = byType('BESS');
    const uniEvAssets = byType('UNI_EV');
    const biEvAssets  = byType('BI_EV');

    // ── Build BESS capacity map ───────────────────────────────────────────────
    // { asset_key -> capacity_kWh }  (null if not found in config)
    const bessCapacities = Object.fromEntries(
      bessAssets.map(a => [a.asset_key, getBessCapacity(a.asset_key)])
    );

    // ── Build output parameter list ───────────────────────────────────────────
    const gridParams = ['imp', 'exp', 'exp1', 'exp2'];

    const afeOutputParams = afeAssets.flatMap(a => [
      `${a.asset_key}_imp`, `${a.asset_key}_exp`,
      `${a.asset_key}_exp1`, `${a.asset_key}_exp2`
    ]);

    const pvOutputParams    = pvAssets.map(a    => `${a.asset_key}_power`);
    const windOutputParams  = windAssets.map(a  => `${a.asset_key}_power`);
    const loadOutputParams  = loadAssets.map(a  => `${a.asset_key}_power`);
    const cloadOutputParams = cloadAssets.map(a => `${a.asset_key}_power`);

    const bessOutputParams = bessAssets.flatMap(a => [
      `${a.asset_key}_charge`, `${a.asset_key}_discharge`, `${a.asset_key}_level`
    ]);

    const uniEvOutputParams = uniEvAssets.flatMap(a => [
      `${a.asset_key}_charge`, `${a.asset_key}_soc`
    ]);
    const biEvOutputParams = biEvAssets.flatMap(a => [
      `${a.asset_key}_charge`, `${a.asset_key}_discharge`, `${a.asset_key}_soc`
    ]);

    const allOutputParams = [
      ...gridParams,
      ...afeOutputParams,
      ...pvOutputParams,
      ...windOutputParams,
      ...loadOutputParams,
      ...cloadOutputParams,
      ...bessOutputParams,
      ...uniEvOutputParams,
      ...biEvOutputParams
    ];

    // ── Build input parameter list ────────────────────────────────────────────
    const afeInputParams = afeAssets.flatMap(a => [
      `${a.asset_key}_max`, `${a.asset_key}_available`, `${a.asset_key}_grid_svc`
    ]);

    const pvInputParams    = pvAssets.map(a    => `${a.asset_key}_power_fct`);
    const windInputParams  = windAssets.map(a  => `${a.asset_key}_power_fct`);
    const loadInputParams  = loadAssets.map(a  => `${a.asset_key}_power_fct`);
    const cloadInputParams = cloadAssets.map(a => `${a.asset_key}_power_fct`);

    const allInputParams = [
      ...afeInputParams,
      ...pvInputParams,
      ...windInputParams,
      ...loadInputParams,
      ...cloadInputParams
    ];

    // ── Measurement params ────────────────────────────────────────────────────
    // EV chargers: power (W) + SoC (%)
    // BESS:        power (W) + SoC (%)
    // AFE:         power (W)
    const evAssets = [...uniEvAssets, ...biEvAssets];

    const measurementParams = [
      ...afeAssets.map(a => `${a.asset_key}_POWER`),
      ...[...evAssets, ...bessAssets].flatMap(a => [
        `${a.asset_key}_POWER`,
        `${a.asset_key}_SoC`
      ])
    ];

    // ── Query database ────────────────────────────────────────────────────────
    const [inputsResult, outputsResult, measurementsResult] = await Promise.all([
      pool.query(
        `SELECT time, parameter, value, unit
         FROM "ems-inputs"
         WHERE DATE(time) = $1 AND parameter = ANY($2::text[])
         ORDER BY time ASC`,
        [date, allInputParams]
      ),
      pool.query(
        `SELECT time, parameter, value, unit
         FROM "ems-outputs"
         WHERE DATE(time) = $1 AND parameter = ANY($2::text[]) AND quality = 'ok'
         ORDER BY time ASC`,
        [date, allOutputParams]
      ),
      measurementParams.length > 0
        ? pool.query(
            `SELECT time, parameter, value, unit
             FROM "measurements"
             WHERE DATE(time) = $1 AND parameter = ANY($2::text[])
             ORDER BY time ASC`,
            [date, measurementParams]
          )
        : Promise.resolve({ rows: [] })
    ]);

    // ── Time-bucket aggregation ───────────────────────────────────────────────
    const buckets = {};

    const addToBucket = (rows, toleranceMs = 2 * 60 * 1000) => {
      rows.forEach(row => {
        const rounded = roundToInterval(row.time, intervalMinutes);
        let key = rounded.toISOString();

        if (!buckets[key]) {
          const nearby = Object.keys(buckets).find(k =>
            Math.abs(new Date(k) - rounded) <= toleranceMs
          );
          key = nearby || key;
          if (!buckets[key]) {
            buckets[key] = { time: key, originalTime: rounded, _counts: {} };
          }
        }

        const param = row.parameter;
        if (buckets[key][param] === undefined) {
          buckets[key][param] = row.value;
          buckets[key]._counts[param] = 1;
        } else {
          const n = ++buckets[key]._counts[param];
          buckets[key][param] = buckets[key][param] + (row.value - buckets[key][param]) / n;
        }
      });
    };

    addToBucket(inputsResult.rows);
    addToBucket(outputsResult.rows);
    addToBucket(measurementsResult.rows);

    // ── Post-process buckets ──────────────────────────────────────────────────
    const data = Object.values(buckets)
      .sort((a, b) => new Date(a.time) - new Date(b.time))
      .map(bucket => {
        const item = { ...bucket };
        delete item._counts;

        // Convert AFE raw power readings from W → kW and derive combined setpoint
        afeAssets.forEach(a => {
          const powerKey = `${a.asset_key}_POWER`;
          if (item[powerKey] != null) item[powerKey] = item[powerKey] / 1000;

          // Setpoint: import is positive, export is negative
          const imp = item[`${a.asset_key}_imp`];
          const exp = item[`${a.asset_key}_exp`];
          if (imp != null || exp != null) {
            item[`${a.asset_key}_setpoint`] = (imp ?? 0) - (exp ?? 0);
          }
        });

        // Convert EV raw power readings from W → kW
        evAssets.forEach(a => {
          const key = `${a.asset_key}_POWER`;
          if (item[key] != null) item[key] = item[key] / 1000;
        });

        // Convert BESS raw power readings from W → kW
        bessAssets.forEach(a => {
          const powerKey = `${a.asset_key}_POWER`;
          if (item[powerKey] != null) item[powerKey] = item[powerKey] / 1000;

          // Derive combined setpoint: discharge is positive, charge is negative
          const ch  = item[`${a.asset_key}_charge`];
          const dis = item[`${a.asset_key}_discharge`];
          if (ch != null || dis != null) {
            item[`${a.asset_key}_setpoint`] = (dis ?? 0) - (ch ?? 0);
          }

          // Convert kWh level setpoint → SoC %  (if capacity is known)
          const capacity = bessCapacities[a.asset_key];
          const level    = item[`${a.asset_key}_level`];
          if (capacity && level != null) {
            item[`${a.asset_key}_level_soc`] = (level / capacity) * 100;
          }
        });

        // Derive combined setpoint for bidirectional EVs as well
        biEvAssets.forEach(a => {
          const ch  = item[`${a.asset_key}_charge`];
          const dis = item[`${a.asset_key}_discharge`];
          if (ch != null || dis != null) {
            item[`${a.asset_key}_setpoint`] = (dis ?? 0) - (ch ?? 0);
          }
        });

        return item;
      })
      .filter(item => Object.keys(item).length > 2);

    res.json({
      success: true,
      data,
      count: data.length,
      interval: intervalMinutes,
      info: `Data grouped into ${intervalMinutes}-minute intervals`,
      activeAssets,
      afeAssets,
      pvAssets,
      windAssets,
      loadAssets,
      cloadAssets,
      bessAssets,
      uniEvAssets,
      biEvAssets,
      bessCapacities   // { asset_key: capacity_kWh | null }
    });

  } catch (error) {
    console.error('Error fetching EMS data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch EMS data' });
  }
});

export default router;