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

@File: page-metrics.jsx
@Description: TODO

@Created: 11 February 2026
@Last Modified: 14 April 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
*/


import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  Battery, Zap, Wind, Sun, Home, TrendingUp, TrendingDown,
  Activity, Circle, Calendar as CalendarIcon, ChartArea, ArrowDownToLine,
  ArrowUpFromLine, Gauge, Layers, BarChart2, Percent, Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format, subDays, subMonths, eachHourOfInterval, eachMonthOfInterval, startOfHour, startOfMonth } from 'date-fns';
import api from '@/lib/axios';
// import { time } from 'systeminformation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatEnergy = (wh) => {
  if (wh == null || isNaN(wh)) return 'N/A';
  if (Math.abs(wh) >= 1_000_000) return `${(wh / 1_000_000).toFixed(2)} MWh`;
  if (Math.abs(wh) >= 1_000) return `${(wh / 1_000).toFixed(1)} kWh`;
  return `${wh.toFixed(0)} Wh`;
};

const formatPower = (w) => {
  if (w == null || isNaN(w)) return 'N/A';
  if (Math.abs(w) >= 1_000_000) return `${(w / 1_000_000).toFixed(2)} MW`;
  if (Math.abs(w) >= 1_000) return `${(w / 1_000).toFixed(1)} kW`;
  return `${w.toFixed(0)} W`;
};

const fmt = (num, decimals = 1) => (num == null || isNaN(num) ? 'N/A' : Number(num).toFixed(decimals));

const buildTimeSlots = (from, to, mode) => {
  if (mode === 'monthly') {
    return eachMonthOfInterval({ start: from, end: to }).map(d => ({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM yyyy'),
    }));
  }
  return eachHourOfInterval({ start: startOfHour(from), end: startOfHour(to) }).map(d => ({
    key: format(d, "yyyy-MM-dd'T'HH"),
    label: format(d, 'HH:mm'),
    fullDate: format(d, 'MMM d'),
  }));
};

const toLocalISOString = (date) => {
  const offset = -date.getTimezoneOffset();
  const sign   = offset >= 0 ? '+' : '-';
  const pad    = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return (
    format(date, "yyyy-MM-dd'T'HH:mm:ss") +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
};

// ─── Aggregation Field Classification ─────────────────────────────────────────

// Fields that should use MAX (peak power values) in energy_flow
const EF_PEAK_FIELDS = new Set([
  'peak_import_w', 'peak_export_w',
  'pv_peak_w', 'wind_peak_w',
  'peak_charging_w', 'peak_discharging_w',
  'peak_load_w', 'peak_critical_w',
]);

// Fields that should be AVERAGED in energy_flow
const EF_AVG_FIELDS = new Set(['avg_soc_percent']);

// Fields that should use MAX in device_performance
const DP_PEAK_FIELDS = new Set([
  'peak_power_w',
  'peak_charge_power_w', 'peak_discharge_power_w',
  'peak_charging_power_w', 'peak_discharging_power_w',
]);

// Fields that should be AVERAGED in device_performance
const DP_AVG_FIELDS = new Set([
  'capacity_factor_percent', 'performance_ratio_percent',
  'round_trip_efficiency_percent', 'avg_soc_percent', 'utilization_percent',
]);

// Fields that should keep LAST value (static properties) in device_performance
const DP_LAST_FIELDS = new Set(['usable_capacity_wh', 'is_bidirectional']);

// ─── Deep Merge for Energy Flow (sum / max / avg aware) ───────────────────────

/**
 * Recursively merges `src` into `acc`.
 * `counts` mirrors the structure of `acc` and tracks how many values have been
 * added for fields that need averaging – so we can finalise them afterwards.
 */
const mergeEnergyFlowDeep = (acc, src, counts) => {
  if (!src || typeof src !== 'object') return;
  Object.entries(src).forEach(([k, v]) => {
    if (k === 'period_start' || k === 'period_end' || k === 'calculation_time') return;
    if (typeof v === 'number') {
      if (EF_PEAK_FIELDS.has(k)) {
        acc[k] = Math.max(acc[k] ?? -Infinity, v);
      } else if (EF_AVG_FIELDS.has(k)) {
        acc[k]    = (acc[k]    || 0) + v;
        counts[k] = (counts[k] || 0) + 1;
      } else {
        acc[k] = (acc[k] || 0) + v;
      }
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      acc[k]    = acc[k]    || {};
      counts[k] = counts[k] || {};
      mergeEnergyFlowDeep(acc[k], v, counts[k]);
    }
  });
};

/** Divides averaged fields by their counts after all rows have been processed. */
const finaliseAvgs = (acc, counts) => {
  Object.entries(counts).forEach(([k, v]) => {
    if (typeof v === 'number' && v > 0 && acc[k] != null) {
      acc[k] = acc[k] / v;
    } else if (typeof v === 'object' && acc[k]) {
      finaliseAvgs(acc[k], v);
    }
  });
};

// ─── Device Performance Aggregation ───────────────────────────────────────────

const mergeDevPerfGroup = (acc, src) => {
  if (!src || typeof src !== 'object') return;
  ['pv', 'bess', 'wind', 'ev_chargers'].forEach(group => {
    if (!src[group]) return;
    acc[group] = acc[group] || {};
    Object.entries(src[group]).forEach(([assetKey, metrics]) => {
      if (!acc[group][assetKey]) {
        acc[group][assetKey] = { __avgCounts__: {} };
      }
      const assetAcc = acc[group][assetKey];
      Object.entries(metrics).forEach(([mk, mv]) => {
        if (DP_LAST_FIELDS.has(mk)) {
          assetAcc[mk] = mv; // always overwrite – static property
        } else if (DP_PEAK_FIELDS.has(mk)) {
          assetAcc[mk] = Math.max(assetAcc[mk] ?? -Infinity, typeof mv === 'number' ? mv : 0);
        } else if (DP_AVG_FIELDS.has(mk)) {
          assetAcc[mk]                   = (assetAcc[mk]                   || 0) + (typeof mv === 'number' ? mv : 0);
          assetAcc.__avgCounts__[mk]     = (assetAcc.__avgCounts__[mk]     || 0) + 1;
        } else if (typeof mv === 'number') {
          assetAcc[mk] = (assetAcc[mk] || 0) + mv;
        } else {
          assetAcc[mk] = mv;
        }
      });
    });
  });
};

const finaliseDevPerfGroup = (dp) => {
  ['pv', 'bess', 'wind', 'ev_chargers'].forEach(group => {
    if (!dp[group]) return;
    Object.values(dp[group]).forEach(assetAcc => {
      if (assetAcc.__avgCounts__) {
        Object.entries(assetAcc.__avgCounts__).forEach(([k, count]) => {
          if (count > 0 && assetAcc[k] != null) assetAcc[k] = assetAcc[k] / count;
        });
        delete assetAcc.__avgCounts__;
      }
    });
  });
};

// ─── Efficiency Aggregation ────────────────────────────────────────────────────

/**
 * Aggregates efficiency_utilization rows correctly:
 * - Sums total_input_wh and total_output_wh to recompute system efficiency / losses
 * - Averages rate/factor fields weighted by nothing (simple average) — these are
 *   dimensionless ratios that don't SUM meaningfully
 * - Takes MAX for peak power fields
 * - Takes AVERAGE for avg_load_w (weighted by count)
 * - Takes MAX for peak_load_w
 *
 * After summing, derived metrics are recomputed from the raw sums.
 */
const aggregateEfficiencyRows = (rows) => {
  if (!rows.length) return {};

  // Accumulators
  let totalInputWh  = 0;
  let totalOutputWh = 0;
  let lossesWh      = 0;
  // Self-consumption / self-sufficiency: accumulate numerator+denominator if present,
  // else average the rates
  let scRateSum = 0, ssRateSum = 0, rateCount = 0;
  let renewableShareSum = 0;
  let avgLoadWSum = 0, avgLoadCount = 0;
  let peakLoadW   = -Infinity;
  let loadFactorSum = 0;

  rows.forEach(row => {
    if (!row) return;

    // System efficiency inputs
    totalInputWh  += row.total_input_wh  || 0;
    totalOutputWh += row.total_output_wh || 0;

    // Self-consumption / sufficiency / renewable share
    const sc = row.self_consumption || {};
    const rs = row.renewable_share  || {};
    scRateSum       += sc.self_consumption_rate  || 0;
    ssRateSum       += sc.self_sufficiency_rate  || 0;
    renewableShareSum += rs.renewable_share_percent || 0;
    rateCount++;

    // Load factor
    const lf = row.load_factor || {};
    if (lf.avg_load_w != null) {
      avgLoadWSum  += lf.avg_load_w;
      avgLoadCount++;
    }
    if (lf.peak_load_w != null) {
      peakLoadW = Math.max(peakLoadW, lf.peak_load_w);
    }
  });

  // Recompute system efficiency from aggregated totals
  const systemEfficiency = totalInputWh > 0 ? totalOutputWh / totalInputWh : 0;
  lossesWh               = totalInputWh - totalOutputWh;
  const lossPercentage   = totalInputWh > 0 ? (lossesWh / totalInputWh) * 100 : 0;

  // Simple averages for dimensionless rates
  const n = rateCount || 1;
  const avgLoadW    = avgLoadCount > 0 ? avgLoadWSum / avgLoadCount : 0;
  const peakLoadWFinal = peakLoadW === -Infinity ? 0 : peakLoadW;
  const overallLoadFactor = peakLoadWFinal > 0 ? avgLoadW / peakLoadWFinal : 0;

  return {
    total_input_wh:  totalInputWh,
    total_output_wh: totalOutputWh,
    system_efficiency: {
      system_efficiency: systemEfficiency,
      losses_wh:         lossesWh,
      loss_percentage:   lossPercentage,
    },
    self_consumption: {
      self_consumption_rate: scRateSum / n,
      self_sufficiency_rate: ssRateSum / n,
    },
    renewable_share: {
      renewable_share_percent: renewableShareSum / n,
    },
    load_factor: {
      avg_load_w:          avgLoadW,
      peak_load_w:         peakLoadWFinal,
      overall_load_factor: overallLoadFactor,
    },
  };
};

// ─── Main Component ────────────────────────────────────────────────────────────

const MetricsDashboard = () => {
  const [periodMetrics, setPeriodMetrics]   = useState(null);
  const [hourlyData,    setHourlyData]      = useState([]);
  const [monthlyData,   setMonthlyData]     = useState([]);
  const [assets,        setAssets]          = useState([]);
  const [energyBalance, setEnergyBalance]   = useState(null);
  const [loading,       setLoading]         = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [viewMode,      setViewMode]        = useState('hourly');
  const [lastUpdate,    setLastUpdate]      = useState(null);

  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 1),
    to: new Date(),
  });

  // ── Calendar: pending selection (not yet confirmed) ──────────────────────────
  const [isCalendarOpen,  setIsCalendarOpen]  = useState(false);
  const [pendingRange,    setPendingRange]     = useState(null);

  const handleCalendarOpen = (open) => {
    if (open) {
      // Seed pending range from current confirmed range
      setPendingRange(dateRange);
    }
    setIsCalendarOpen(open);
  };

  const handlePendingSelect = (range) => {
    // shadcn Calendar mode="range" calls onSelect with { from, to } or { from }
    // We just update the pending range – don't close or fetch yet.
    setPendingRange(range || null);
  };

  const handleConfirmRange = () => {
    if (!pendingRange?.from || !pendingRange?.to) return;
    const to       = startOfHour(pendingRange.to);
    const from     = pendingRange.from;
    const daysDiff = Math.ceil((to - from) / 86_400_000);
    setViewMode(daysDiff > 60 ? 'monthly' : 'hourly');
    setDateRange({ from, to });
    setSelectedPeriod('custom');
    setIsCalendarOpen(false);
  };

  // ── Data Fetching ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [dateRange, viewMode]);

  const fetchData = async () => {
    try {
      const start = toLocalISOString(dateRange.from);
      const end   = toLocalISOString(dateRange.to);

      const [
        { data: assetsList },
        { data: balance },
        { data: summaryRows },
        { data: timeSeriesRows },
      ] = await Promise.all([
        api.get('/api/metrics/assets'),
        api.get(`/api/metrics/energy-balance?start=${start}&end=${end}`),
        api.get(`/api/metrics/summary?start=${start}&end=${end}`),
        viewMode === 'hourly'
          ? api.get(`/api/metrics/hourly?start=${start}&end=${end}`)
          : api.get(`/api/metrics/monthly?start=${start}&end=${end}`),
      ]);
      setAssets(assetsList);
      setEnergyBalance(balance);
      const aggregated = aggregateSummaryRows(summaryRows);
      setPeriodMetrics(aggregated);

      const slots = buildTimeSlots(dateRange.from, dateRange.to, viewMode);
      if (viewMode === 'hourly') {
        setHourlyData(mergeWithSlots(slots, processHourlyData(timeSeriesRows), 'hourly'));
      } else {
        setMonthlyData(mergeWithSlots(slots, processMonthlyData(timeSeriesRows), 'monthly'));
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  // ── Data Processing ──────────────────────────────────────────────────────────

  const aggregateSummaryRows = (rows) => {
    const efRows  = rows.filter(r => r.metric_category === 'energy_flow').map(r => r.metrics_json);
    const effRows = rows.filter(r => r.metric_category === 'efficiency_utilization').map(r => r.metrics_json);
    const dpRows  = rows.filter(r => r.metric_category === 'device_performance').map(r => r.metrics_json);
    const staRows = rows.filter(r => r.metric_category === 'statistical').map(r => r.metrics_json);

    // ── Energy Flow ──
    const efAcc    = {};
    const efCounts = {};
    efRows.forEach(d => mergeEnergyFlowDeep(efAcc, d, efCounts));
    finaliseAvgs(efAcc, efCounts);

    // ── Efficiency Utilization ──
    const effAcc = aggregateEfficiencyRows(effRows);

    // ── Device Performance ──
    const dpAcc = {};
    dpRows.forEach(d => mergeDevPerfGroup(dpAcc, d));
    finaliseDevPerfGroup(dpAcc);

    // ── Statistical – use last row (data quality is a snapshot) ──
    const staAcc = staRows[staRows.length - 1] || {};

    return {
      energy_flow:             efAcc,
      efficiency_utilization:  effAcc,
      device_performance:      dpAcc,
      statistical:             staAcc,
    };
  };

  const processHourlyData = (data) => data.map(item => {
    const e = item.metrics_json;
    const periodEnd = new Date((item.period_end || item.period_start).replace('Z', ''));
    return {
      slotKey:        format(periodEnd, "yyyy-MM-dd'T'HH"),
      time:           format(periodEnd, 'HH:mm'),
      fullDate:       format(periodEnd, 'MMM d'),
      timestamp:      item.period_end || item.period_start,
      grid_import:    (e.grid?.total_import_wh        || 0) / 1000,
      grid_export:    -((e.grid?.total_export_wh        || 0) / 1000),
      renewable:      (e.renewable?.total_renewable_wh || 0) / 1000,
      load:           -((e.load?.total_load_wh           || 0) / 1000),
      bess_soc:        e.bess?.avg_soc_percent          || 0,
      bess_charge:    -((e.bess?.total_charging_wh       || 0) / 1000),
      bess_discharge: (e.bess?.total_discharging_wh    || 0) / 1000,
      ev_charge:      -((e.ev?.total_charging_wh         || 0) / 1000),
      ev_discharge:   (e.ev?.total_discharging_wh      || 0) / 1000,
    };
  });

  const processMonthlyData = (data) => data.map(item => {
    const e = item.metrics_json;
    const periodEnd = new Date((item.period_end || item.period_start).replace('Z', ''));
    return {
      slotKey:        format(periodEnd, 'yyyy-MM'),
      month:          format(periodEnd, 'MMM yyyy'),
      timestamp:      item.period_end || item.period_start,
      grid_import:    (e.grid?.total_import_wh        || 0) / 1000,
      grid_export:    -((e.grid?.total_export_wh        || 0) / 1000),
      renewable:      (e.renewable?.total_renewable_wh || 0) / 1000,
      load:           -((e.load?.total_load_wh           || 0) / 1000),
      bess_soc:        e.bess?.avg_soc_percent          || 0,
      bess_charge:    -((e.bess?.total_charging_wh       || 0) / 1000),
      bess_discharge: (e.bess?.total_discharging_wh    || 0) / 1000,
      ev_charge:      -((e.ev?.total_charging_wh         || 0) / 1000),
      ev_discharge:   (e.ev?.total_discharging_wh      || 0) / 1000,
    };
  });

  const mergeWithSlots = (slots, dataRows, mode) => {
    const byKey = {};
    dataRows.forEach(row => { byKey[row.slotKey] = row; });

    return slots.map(slot => {
      const row = byKey[slot.key];
      if (row) return row;
      return {
        slotKey:        slot.key,
        time:           slot.label,
        fullDate:       slot.fullDate || '',
        month:          slot.label,
        grid_import:    null,
        grid_export:    null,
        renewable:      null,
        load:           null,
        bess_soc:       null,
        bess_charge:    null,
        bess_discharge: null,
        ev_charge:      null,
        ev_discharge:   null, 
      };
    });
  };

  // ── Range Controls ───────────────────────────────────────────────────────────

  const handleQuickRange = (range) => {
    const now  = startOfHour(new Date());
    let from;
    let mode = 'hourly';

    switch (range) {
      case '1h':  from = new Date(now - 3_600_000); mode = 'hourly';  break;
      case '24h': from = subDays(now, 1);            mode = 'hourly';  break;
      case '7d':  from = subDays(now, 7);            mode = 'hourly';  break;
      case '30d': from = subDays(now, 30);           mode = 'hourly';  break;
      case '3m':  from = subMonths(now, 3);          mode = 'monthly'; break;
      case '6m':  from = subMonths(now, 6);          mode = 'monthly'; break;
      case '1y':  from = subMonths(now, 12);         mode = 'monthly'; break;
      default:    from = subDays(now, 1);
    }

    setViewMode(mode);
    setDateRange({ from, to: now });
    setSelectedPeriod(range);
  };

  const getDateRangeLabel = () => {
    if (selectedPeriod !== 'custom') {
      const labels = {
        '1h': 'Last Hour', '24h': 'Last 24 Hours', '7d': 'Last 7 Days',
        '30d': 'Last 30 Days', '3m': 'Last 3 Months', '6m': 'Last 6 Months', '1y': 'Last Year',
      };
      return labels[selectedPeriod] || 'Custom Range';
    }
    const fromStr = format(dateRange.from, 'MMM d, yyyy');
    const toStr   = format(dateRange.to,   'MMM d, yyyy');
    return fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
  };

  // ── Derived Display Data ─────────────────────────────────────────────────────

  const displayData = viewMode === 'hourly' ? hourlyData : monthlyData;
  const xKey        = viewMode === 'hourly' ? 'time' : 'month';
  const xAngle      = viewMode === 'monthly' ? -45 : 0;
  const xHeight     = viewMode === 'monthly' ? 80  : 30;
  const xAnchor     = viewMode === 'monthly' ? 'end' : 'middle';

  const ef  = periodMetrics?.energy_flow            || {};
  const eff = periodMetrics?.efficiency_utilization || {};
  const dp  = periodMetrics?.device_performance     || {};
  const sta = periodMetrics?.statistical            || {};

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <Activity className="w-12 h-12 text-blue-600 animate-pulse mx-auto" />
        <p className="text-gray-600 text-lg">Loading metrics…</p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg">
              <ChartArea className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Metrics</h1>
            </div>
          </div>
          {lastUpdate && (
            <Badge variant="outline" className="bg-white border-gray-200 text-gray-700">
              <Circle className="w-2 h-2 mr-2 fill-green-500 text-green-500 animate-pulse" />
              Updated {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
        </div>

        {/* ── Date Range Controls ── */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Time Range:</span>
          </div>

          <Tabs value={selectedPeriod} onValueChange={handleQuickRange} className="flex-1">
            <TabsList className="bg-gray-100 border border-gray-200">
              {['1h','24h','7d','30d','3m','6m','1y'].map(r => (
                <TabsTrigger key={r} value={r}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  {r.toUpperCase()}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* ── Custom Date Range Picker with Confirm Button ── */}
          <Popover open={isCalendarOpen} onOpenChange={handleCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-white border-gray-300 hover:bg-gray-50">
                <CalendarIcon className="w-4 h-4 mr-2" />Custom Range
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white border-gray-200" align="end">
              {/* Calendar: click once = start, click again = end */}
              <Calendar
                mode="range"
                selected={pendingRange}
                onSelect={handlePendingSelect}
                numberOfMonths={2}
                className="rounded-md border-0"
              />

              {/* Preview + Confirm footer */}
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  {pendingRange?.from && pendingRange?.to
                    ? `${format(pendingRange.from, 'MMM d, yyyy')} – ${format(pendingRange.to, 'MMM d, yyyy')}`
                    : pendingRange?.from
                    ? `From ${format(pendingRange.from, 'MMM d, yyyy')} — pick end date`
                    : 'Select start date'}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCalendarOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!pendingRange?.from || !pendingRange?.to}
                    onClick={handleConfirmRange}
                  >
                    <Check className="w-3.5 h-3.5 mr-1.5" />Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 px-3 py-1">
              {getDateRangeLabel()}
            </Badge>
            <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700 px-3 py-1">
              {viewMode === 'hourly' ? 'Hourly' : 'Monthly'} View
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Energy Flow Timeline ── */}
      <Card className="xl:col-span-2 bg-white border-gray-200 mb-8">
        <CardHeader>
          <CardTitle className="text-gray-900">Energy Flow Timeline</CardTitle>
          <CardDescription>
            Generation, consumption and grid exchange · {viewMode === 'hourly' ? 'Hourly' : 'Monthly'} · {getDateRangeLabel()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={displayData}>
              <defs>
                <linearGradient id="renewableGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.1} />
                </linearGradient>
                {/* positive side */}
                <linearGradient id="importGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="dischargeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="evDischargeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1} />
                </linearGradient>
                {/* negative side — gradients grow downward, so flip y */}
                <linearGradient id="loadGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="exportGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="chargeGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="evGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey={xKey} stroke="#6b7280" angle={xAngle} textAnchor={xAnchor} height={xHeight} />
              <YAxis stroke="#6b7280" label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                labelFormatter={(label, payload) => {
                  if (payload?.[0] && viewMode === 'hourly') return `${payload[0].payload.fullDate} ${label}`;
                  return label;
                }}
                // FIX: format tooltip values to 2 decimal places
                formatter={(value, name) => [
                  value != null ? `${Number(value).toFixed(2)} kWh` : '—',
                  name,
                ]}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.5} />
              {/* ── positive series ── */}
              <Area type="monotone" dataKey="renewable"     stroke="#fbbf24" fill="url(#renewableGrad)" name="Generation (kWh)"       connectNulls={false} />
              <Area type="monotone" dataKey="grid_import"   stroke="#3b82f6" fill="url(#importGrad)"    name="Grid Import (kWh)"      connectNulls={false} />
              <Area type="monotone" dataKey="bess_discharge" stroke="#10b981" fill="url(#dischargeGrad)" name="BESS Discharge (kWh)"  connectNulls={false} />
              <Area type="monotone" dataKey="ev_discharge" stroke="#a855f7" fill="url(#evDischargeGrad)" name="EV V2G Discharge (kWh)" connectNulls={false} />

              {/* ── negative series ── */}
              <Area type="monotone" dataKey="load"        stroke="#ef4444" fill="url(#loadGrad)"   name="Load Consumption (kWh)" connectNulls={false} />
              <Area type="monotone" dataKey="grid_export" stroke="#06b6d4" fill="url(#exportGrad)" name="Grid Export (kWh)"      connectNulls={false} />
              <Area type="monotone" dataKey="bess_charge" stroke="#6366f1" fill="url(#chargeGrad)" name="BESS Charge (kWh)"      connectNulls={false} />
              <Area type="monotone" dataKey="ev_charge" stroke="#f97316" fill="url(#evGrad)" name="EV Charging (kWh)" connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Section: Energy Sources & Load ── */}
      <SectionTitle icon={<Sun className="w-5 h-5" />} title="Generation & Load" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={<Sun className="w-6 h-6 text-white" />} title="Solar Generation"
          value={formatEnergy(ef.renewable?.pv_generation_wh)}
          rows={[{ label: 'Peak Power:', value: formatPower(ef.renewable?.pv_peak_w) }]}
          iconColor="from-amber-500 to-orange-500" />
        <MetricCard icon={<Wind className="w-6 h-6 text-white" />} title="Wind Generation"
          value={formatEnergy(ef.renewable?.wind_generation_wh)}
          rows={[{ label: 'Peak Power:', value: formatPower(ef.renewable?.wind_peak_w) }]}
          iconColor="from-slate-500 to-slate-700" />
        <MetricCard icon={<Home className="w-6 h-6 text-white" />} title="Load Consumption"
          value={formatEnergy(ef.load?.total_load_wh)}
          rows={[
            { label: 'Peak Load Power:', value: formatPower(ef.load?.peak_load_w) },
            { label: 'Critical Load Peak Power:', value: formatPower(ef.load?.peak_critical_w) },
            { label: 'Critical Load Consumption:', value: formatEnergy(ef.load?.critical_load_wh) },
          ]}
          iconColor="from-red-500 to-rose-500" />
        <MetricCard icon={<Percent className="w-6 h-6 text-white" />} title="Renewable Share"
          value={`${fmt(eff.renewable_share?.renewable_share_percent)}%`}
          rows={[
            { label: 'Self-Sufficiency', value: `${fmt((eff.self_consumption?.self_sufficiency_rate || 0) * 100)}%` },
            { label: 'Self-Consumption', value: `${fmt((eff.self_consumption?.self_consumption_rate || 0) * 100)}%` },
          ]}
          iconColor="from-green-500 to-emerald-500" />
      </div>

      {/* ── Section: Grid ── */}
      <SectionTitle icon={<Activity className="w-5 h-5" />} title="Grid Exchange" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={<ArrowDownToLine className="w-6 h-6 text-white" />} title="Grid Import"
          value={formatEnergy(energyBalance?.grid_import)}
          rows={[{ label: 'Net Import:', value: formatEnergy(ef.grid?.net_import_wh) }]}
          iconColor="from-blue-500 to-blue-700" trend="down" />
        <MetricCard icon={<ArrowUpFromLine className="w-6 h-6 text-white" />} title="Grid Export"
          value={formatEnergy(energyBalance?.grid_export)}
          rows={[{ label: 'Net Export:', value: formatEnergy(energyBalance?.grid_export || 0) }]}
          iconColor="from-cyan-500 to-cyan-700" trend="up" />
        <MetricCard icon={<Gauge className="w-6 h-6 text-white" />} title="Load Factor"
          value={`${fmt((eff.load_factor?.overall_load_factor || 0) * 100)}%`}
          rows={[
            { label: 'Average Load Power:', value: formatPower(eff.load_factor?.avg_load_w) },
            { label: 'Peak Load Power:',    value: formatPower(eff.load_factor?.peak_load_w) },
          ]}
          iconColor="from-violet-500 to-purple-600" />
        <MetricCard icon={<BarChart2 className="w-6 h-6 text-white" />} title="System Efficiency"
          value={`${fmt((eff.system_efficiency?.system_efficiency || 0) * 100)}%`}
          rows={[
            { label: 'Losses',  value: formatEnergy(eff.system_efficiency?.losses_wh) },
            { label: 'Loss %',  value: `${fmt(eff.system_efficiency?.loss_percentage)}%` },
          ]}
          iconColor="from-indigo-500 to-indigo-700" />
      </div>

      {/* ── Section: Battery ── */}
      <SectionTitle icon={<Battery className="w-5 h-5" />} title="Battery Energy Storage (BESS)" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={<Battery className="w-6 h-6 text-white" />} title="Avg State of Charge"
          value={`${fmt(ef.bess?.avg_soc_percent)}%`}
          rows={[
            { label: 'Cycles',          value: fmt(ef.bess?.cycles_count, 2) },
            { label: 'Round-trip Eff.', value: '—' },
          ]}
          iconColor="from-green-500 to-emerald-500" />
        <MetricCard icon={<ArrowDownToLine className="w-6 h-6 text-white" />} title="BESS Charging"
          value={formatEnergy(ef.bess?.total_charging_wh)}
          rows={[{ label: 'Peak Charge Power', value: formatPower(ef.bess?.peak_charging_w) }]}
          iconColor="from-teal-500 to-green-600" trend="up" />
        <MetricCard icon={<ArrowUpFromLine className="w-6 h-6 text-white" />} title="BESS Discharging"
          value={formatEnergy(ef.bess?.total_discharging_wh)}
          rows={[{ label: 'Peak Discharge Power', value: formatPower(ef.bess?.peak_discharging_w) }]}
          iconColor="from-orange-500 to-amber-600" trend="down" />
        <MetricCard icon={<Layers className="w-6 h-6 text-white" />} title="BESS Net Energy"
          value={formatEnergy((ef.bess?.total_charging_wh || 0) - (ef.bess?.total_discharging_wh || 0))}
          rows={[
            { label: 'Charged',    value: formatEnergy(ef.bess?.total_charging_wh) },
            { label: 'Discharged', value: formatEnergy(ef.bess?.total_discharging_wh) },
          ]}
          iconColor="from-emerald-600 to-teal-700" />
      </div>

      {/* ── Section: EV Chargers ── */}
      <SectionTitle icon={<Zap className="w-5 h-5" />} title="EV Chargers" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={<Zap className="w-6 h-6 text-white" />} title="EV Total Charging"
          value={formatEnergy(energyBalance?.ev_charging ?? ef.ev?.total_charging_wh)}
          rows={[
            { label: 'Peak Charging Power:',    value: formatPower(ef.ev?.peak_charging_w) },
            { label: 'Peak Discharging Power:', value: formatPower(ef.ev?.peak_discharging_w) },
          ]}
          iconColor="from-blue-500 to-cyan-500" trend="up" />
        <MetricCard icon={<ArrowUpFromLine className="w-6 h-6 text-white" />} title="V2G Discharging"
          value={formatEnergy(ef.ev?.total_discharging_wh)}
          rows={[
            { label: 'V2G Charge Energy: ',    value: formatEnergy(ef.ev?.bi_ev_charging_wh) },
            { label: 'V2G Discharge Energy: ', value: formatEnergy(ef.ev?.bi_ev_discharging_wh) },
          ]}
          iconColor="from-sky-500 to-blue-600" />
        <MetricCard icon={<Activity className="w-6 h-6 text-white" />} title="V1G EV Charging"
          value={formatEnergy(ef.ev?.uni_ev_charging_wh)}
          rows={[{ label: 'V1G Charging', value: formatEnergy(ef.ev?.uni_ev_charging_wh) }]}
          iconColor="from-indigo-400 to-blue-500" />
        <MetricCard icon={<Layers className="w-6 h-6 text-white" />} title="EV Net Energy"
          value={formatEnergy((ef.ev?.total_charging_wh || 0) - (ef.ev?.total_discharging_wh || 0))}
          rows={[
            { label: 'Charged',    value: formatEnergy(ef.ev?.total_charging_wh) },
            { label: 'Discharged', value: formatEnergy(ef.ev?.total_discharging_wh) },
          ]}
          iconColor="from-blue-600 to-violet-600" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Energy Balance Pie */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Energy Balance</CardTitle>
            <CardDescription>Energy source distribution · {getDateRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Solar',          value: (energyBalance?.renewable         || 0) / 1000, color: '#fbbf24' },
                    { name: 'Grid Import',    value: (energyBalance?.grid_import       || 0) / 1000, color: '#3b82f6' },
                    { name: 'BESS Discharge', value: (energyBalance?.bess_discharging  || 0) / 1000, color: '#10b981' },
                    { name: 'EV V2G',         value: (ef.ev?.total_discharging_wh     || 0) / 1000, color: '#6366f1' },
                  ].filter(d => d.value > 0)}
                  cx="50%" cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {['#fbbf24','#3b82f6','#10b981','#6366f1'].map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={v => `${v.toFixed(2)} kWh`}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Battery SoC */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Battery State of Charge</CardTitle>
            <CardDescription>Average SoC over time · {getDateRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} stroke="#6b7280" angle={xAngle} textAnchor={xAnchor} height={xHeight} />
                <YAxis stroke="#6b7280" domain={[0, 100]}
                  label={{ value: '%', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  labelFormatter={(label, payload) => {
                    if (payload?.[0] && viewMode === 'hourly') return `${payload[0].payload.fullDate} ${label}`;
                    return label;
                  }}
                  formatter={(value, name) => [
                    value != null ? `${Number(value).toFixed(2)} %` : '—',
                    name,
                  ]}
                />
                <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Min SoC', fill: '#ef4444', fontSize: 11 }} />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Max SoC', fill: '#10b981', fontSize: 11 }} />
                <Line type="monotone" dataKey="bess_soc" stroke="#10b981" strokeWidth={3}
                  dot={false} name="Battery SoC (%)" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* BESS Charging vs Discharging */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">BESS Charge / Discharge</CardTitle>
            <CardDescription>Energy throughput over time · {getDateRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} stroke="#6b7280" angle={xAngle} textAnchor={xAnchor} height={xHeight} />
                <YAxis stroke="#6b7280"
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(v, name) => [v != null ? `${Number(v).toFixed(2)} kWh` : '—', name]}
                />
                <Legend />
                <Bar dataKey="bess_charge"    name="Charging (kWh)"    fill="#10b981" radius={[2,2,0,0]} />
                <Bar dataKey="bess_discharge" name="Discharging (kWh)" fill="#f59e0b" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Grid Import vs Export */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Grid Import / Export</CardTitle>
            <CardDescription>Grid energy flow over time · {getDateRangeLabel()}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xKey} stroke="#6b7280" angle={xAngle} textAnchor={xAnchor} height={xHeight} />
                <YAxis stroke="#6b7280"
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                  formatter={(v, name) => [v != null ? `${Number(v).toFixed(2)} kWh` : '—', name]}
                />
                <Legend />
                <Bar dataKey="grid_import" name="Import (kWh)" fill="#3b82f6" radius={[2,2,0,0]} />
                <Bar dataKey="grid_export" name="Export (kWh)" fill="#06b6d4" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Efficiency KPIs ── */}
      <Card className="mb-8 bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">System Efficiency — KPIs</CardTitle>
          <CardDescription>Key performance indicators · {getDateRangeLabel()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <EfficiencyCard title="Self-Consumption"  value={eff.self_consumption?.self_consumption_rate}
              description="Fraction of generated renewable energy consumed locally" color="from-green-500 to-emerald-500" />
            <EfficiencyCard title="Self-Sufficiency"  value={eff.self_consumption?.self_sufficiency_rate}
              description="Fraction of total load covered by local sources"         color="from-blue-500 to-cyan-500" />
            <EfficiencyCard title="Load Factor"       value={eff.load_factor?.overall_load_factor}
              description="Ratio of average to peak load demand"                    color="from-purple-500 to-pink-500" />
            <EfficiencyCard title="Renewable Share"   value={(eff.renewable_share?.renewable_share_percent || 0) / 100}
              description="Renewable generation as % of total consumption"          color="from-amber-500 to-orange-500" />
          </div>
        </CardContent>
      </Card>

      {/* ── Device Performance ── */}
      <Card className="mb-8 bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Device Performance</CardTitle>
          <CardDescription>Individual asset metrics · {getDateRangeLabel()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(dp.pv || {}).map(([key, m]) => (
              <DeviceCard key={key} icon={<Sun className="w-5 h-5" />} type="PV" name={key}
                metrics={[
                  { label: 'Energy',            value: formatEnergy((m.energy_generated_kwh || 0) * 1000) },
                  { label: 'Capacity Factor',   value: `${fmt(m.capacity_factor_percent)}%` },
                  { label: 'Performance Ratio', value: `${fmt(m.performance_ratio_percent)}%` },
                  { label: 'Peak Power',        value: formatPower(m.peak_power_w) },
                  { label: 'Operating Hours',   value: `${fmt(m.operating_hours)} h` },
                ]}
                color="from-amber-500 to-orange-500" />
            ))}

            {Object.entries(dp.bess || {}).map(([key, m]) => (
              <DeviceCard key={key} icon={<Battery className="w-5 h-5" />} type="BESS" name={key}
                metrics={[
                  { label: 'Charging',           value: formatEnergy(m.charging_wh) },
                  { label: 'Discharging',        value: formatEnergy(m.discharging_wh) },
                  { label: 'Peak Charge Power',  value: formatPower(m.peak_charge_power_w) },
                  { label: 'Peak Discharge',     value: formatPower(m.peak_discharge_power_w) },
                  { label: 'Round-trip Eff.',    value: `${fmt(m.round_trip_efficiency_percent)}%` },
                  { label: 'Cycles',             value: fmt(m.cycles_count, 2) },
                  { label: 'Avg SoC',            value: `${fmt(m.avg_soc_percent)}%` },
                  { label: 'Usable Capacity',    value: formatEnergy(m.usable_capacity_wh) },
                ]}
                color="from-green-500 to-emerald-500" />
            ))}

            {Object.entries(dp.ev_chargers || {}).map(([key, m]) => (
              <DeviceCard key={key} icon={<Zap className="w-5 h-5" />}
                type={m.is_bidirectional ? 'Bi-EV' : 'EV'} name={key}
                metrics={[
                  { label: 'Sessions',           value: m.charging_sessions },
                  { label: 'Utilization',        value: `${fmt(m.utilization_percent)}%` },
                  { label: 'Energy Delivered',   value: formatEnergy(m.energy_delivered_wh) },
                  { label: 'Peak Charge Power',  value: formatPower(m.peak_charging_power_w) },
                  ...(m.is_bidirectional ? [
                    { label: 'Energy Injected',  value: formatEnergy(m.energy_injected_wh) },
                    { label: 'Peak Discharge',   value: formatPower(m.peak_discharging_power_w) },
                  ] : []),
                  { label: 'Charging Hours',     value: `${fmt(m.charging_hours)} h` },
                ]}
                color="from-blue-500 to-cyan-500" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Data Quality ── */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Data Quality</CardTitle>
          <CardDescription>System telemetry statistics · {getDateRangeLabel()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <QualityStatBox label="Data Quality"      value={`${fmt(sta.data_quality?.quality_percentage || 0)}%`}
              sub="Valid readings"
              color="text-green-600" />
            <QualityStatBox label="Total Data Points" value={(sta.data_quality?.total_data_points || 0).toLocaleString()}
              sub={`${(sta.data_quality?.ok_data_points || 0).toLocaleString()} OK · ${(sta.data_quality?.error_data_points || 0).toLocaleString()} Errors`}
              color="text-blue-600" />
            <QualityStatBox label="Completeness"      value={`${fmt(sta.data_quality?.completeness_percentage || 0)}%`}
              sub={`${(sta.data_quality?.expected_samples || 0).toLocaleString()} expected samples`}
              color="text-purple-600" />
          </div>

          {sta.data_quality?.by_asset && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Per-Asset OK Readings</p>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {Object.entries(sta.data_quality.by_asset).map(([k, v]) => (
                  <div key={k} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 truncate mb-1">{k.replace('_ok', '')}</p>
                    <p className="text-lg font-bold text-gray-800">{v.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Sub-Components ────────────────────────────────────────────────────────────

const SectionTitle = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-4 mt-6">
    <div className="text-gray-500">{icon}</div>
    <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
    <div className="flex-1 h-px bg-gray-200 ml-2" />
  </div>
);

const MetricCard = ({ icon, title, value, rows = [], iconColor, trend }) => (
  <Card className="bg-white border-gray-200 hover:border-gray-300 transition-all">
    <CardContent className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-lg bg-gradient-to-br ${iconColor} shadow`}>
          {icon}
        </div>
      </div>
      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <span className="text-gray-500">{r.label}</span>
            <span className="font-semibold text-gray-700">{r.value}</span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const EfficiencyCard = ({ title, value, description, color }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      <span className="text-2xl font-bold text-gray-900">
        {value != null ? `${(value * 100).toFixed(1)}%` : 'N/A'}
      </span>
    </div>
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
        style={{ width: `${Math.min((value || 0) * 100, 100)}%` }} />
    </div>
    <p className="text-xs text-gray-500">{description}</p>
  </div>
);

const DeviceCard = ({ icon, type, name, metrics, color }) => (
  <Card className="bg-white border-gray-200 hover:border-gray-300 transition-all">
    <CardContent className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color} text-white`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <Badge variant="outline" className="mb-1 bg-gray-50 border-gray-300 text-gray-700 text-xs">{type}</Badge>
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-gray-100 pt-3">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between items-center text-xs">
            <span className="text-gray-500">{m.label}</span>
            <span className="font-semibold text-gray-800">{m.value}</span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

const QualityStatBox = ({ label, value, sub, color }) => (
  <div className="text-center p-6 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
    <div className={`text-4xl font-bold mb-1 ${color}`}>{value}</div>
    <div className="text-gray-700 text-sm font-medium mb-1">{label}</div>
    <div className="text-gray-400 text-xs">{sub}</div>
  </div>
);

export default MetricsDashboard;