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

@File: page-debug-raw-data.js
@Description: Raw data preview and export (CSV/XLSX) for "measurements", "ems-inputs" and "ems-outputs"

@Created: 05 October 2026
@Last Modified: 05 October 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.3
*/


import { pool } from '../db/pool.js';
import express from 'express';
import XLSX from 'xlsx';

const router = express.Router();

const PREVIEW_ROWS = 100;
const BATCH_SIZE = 10000;
const XLSX_MAX_ROWS_PER_TABLE = 500000;

// Table and column names are interpolated into SQL, so they must only come from this whitelist.
const TABLES = {
  measurements: { recordIdColumn: 'measurement_id', assetKey: 'asset_key', objective: 'NULL::text' },
  'ems-inputs': { recordIdColumn: 'input_id', assetKey: 'NULL::text', objective: 'objective' },
  'ems-outputs': { recordIdColumn: 'output_id', assetKey: 'NULL::text', objective: 'objective' },
};

const COLUMNS = ['source', 'id', 'record_id', 'time', 'parameter', 'value', 'unit', 'quality', 'asset_key', 'objective'];
const TEXT_COLUMNS = new Set(['parameter', 'unit', 'quality', 'asset_key', 'objective']);

function parseIsoDateTime(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateRequest(body) {
  const start = parseIsoDateTime(body?.start);
  const end = parseIsoDateTime(body?.end);

  if (!start || !end) {
    return { error: 'Valid start and end date-times are required.' };
  }

  if (end <= start) {
    return { error: 'End date-time must be greater than start date-time.' };
  }

  const requested = Array.isArray(body?.tables) ? body.tables : [];
  const tables = Object.keys(TABLES).filter((name) => requested.includes(name));
  if (tables.length === 0) {
    return { error: 'Select at least one table.' };
  }

  return { start, end, tables };
}

function selectColumns(table) {
  const cfg = TABLES[table];
  return `
      id,
      ${cfg.recordIdColumn} AS record_id,
      "time",
      parameter,
      value,
      unit,
      quality,
      ${cfg.assetKey} AS asset_key,
      ${cfg.objective} AS objective`;
}

function normalizeRow(table, row) {
  return {
    source: table,
    id: Number(row.id),
    record_id: row.record_id,
    time: row.time instanceof Date ? row.time.toISOString() : row.time,
    parameter: row.parameter,
    value: row.value,
    unit: row.unit,
    quality: row.quality,
    asset_key: row.asset_key,
    objective: row.objective,
  };
}

// Keyset pagination on id keeps memory flat for large exports.
async function fetchBatch(table, start, end, afterId, limit) {
  const columns = selectColumns(table);
  const result = await pool.query(
    `
      SELECT ${columns}
      FROM "${table}"
      WHERE "time" >= $1::timestamptz
        AND "time" < $2::timestamptz
        AND id > $3
      ORDER BY id ASC
      LIMIT $4
    `,
    [start.toISOString(), end.toISOString(), afterId, limit]
  );
  return result.rows.map((row) => normalizeRow(table, row));
}

async function* iterateRows(table, start, end) {
  let afterId = 0;
  while (true) {
    const batch = await fetchBatch(table, start, end, afterId, BATCH_SIZE);
    if (batch.length === 0) {
      return;
    }
    yield batch;
    afterId = batch[batch.length - 1].id;
    if (batch.length < BATCH_SIZE) {
      return;
    }
  }
}

function csvCell(column, value) {
  if (value === null || value === undefined) {
    return '';
  }

  let text = String(value);
  // Prevent spreadsheet formula injection from text fields.
  if (TEXT_COLUMNS.has(column) && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(row) {
  return COLUMNS.map((column) => csvCell(column, row[column])).join(',') + '\r\n';
}

async function writeChunk(res, chunk) {
  if (!res.write(chunk)) {
    await new Promise((resolve) => res.once('drain', resolve));
  }
}

router.post('/query', async (req, res) => {
  const requestState = validateRequest(req.body);
  if (requestState.error) {
    return res.status(400).json({ error: requestState.error });
  }

  const { start, end, tables } = requestState;

  try {
    const results = await Promise.all(
      tables.map(async (table) => {
        const columns = selectColumns(table);
        const params = [start.toISOString(), end.toISOString()];
        const [countResult, previewResult] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::bigint AS total
             FROM "${table}"
             WHERE "time" >= $1::timestamptz AND "time" < $2::timestamptz`,
            params
          ),
          pool.query(
            `SELECT ${columns}
             FROM "${table}"
             WHERE "time" >= $1::timestamptz AND "time" < $2::timestamptz
             ORDER BY "time" DESC, id DESC
             LIMIT ${PREVIEW_ROWS}`,
            params
          ),
        ]);

        return [
          table,
          {
            count: Number(countResult.rows[0].total),
            rows: previewResult.rows.map((row) => normalizeRow(table, row)),
          },
        ];
      })
    );

    res.status(200).json({
      start: start.toISOString(),
      end: end.toISOString(),
      previewLimit: PREVIEW_ROWS,
      tables: Object.fromEntries(results),
    });
  } catch (error) {
    console.error('Error loading raw data preview:', error);
    res.status(500).json({ error: 'Failed to load raw data.' });
  }
});

router.post('/export', async (req, res) => {
  const requestState = validateRequest(req.body);
  if (requestState.error) {
    return res.status(400).json({ error: requestState.error });
  }

  const exportFormat = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
  const { start, end, tables } = requestState;

  try {
    if (exportFormat === 'xlsx') {
      const workbook = XLSX.utils.book_new();

      for (const table of tables) {
        const rows = [];
        for await (const batch of iterateRows(table, start, end)) {
          rows.push(...batch);
          if (rows.length > XLSX_MAX_ROWS_PER_TABLE) {
            return res.status(413).json({
              error: `Table "${table}" exceeds ${XLSX_MAX_ROWS_PER_TABLE} rows for XLSX export. Narrow the time range or use CSV.`,
            });
          }
        }

        const sheet = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
        XLSX.utils.book_append_sheet(workbook, sheet, table);
      }

      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="raw-data-export-${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="raw-data-export-${Date.now()}.csv"`);
    await writeChunk(res, COLUMNS.join(',') + '\r\n');

    for (const table of tables) {
      for await (const batch of iterateRows(table, start, end)) {
        if (res.destroyed) {
          return undefined;
        }
        await writeChunk(res, batch.map(csvLine).join(''));
      }
    }

    return res.end();
  } catch (error) {
    console.error('Error exporting raw data:', error);
    if (res.headersSent) {
      return res.destroy();
    }
    return res.status(500).json({ error: 'Failed to export raw data.' });
  }
});

export default router;