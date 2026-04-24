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

@File: page-ems-dashboard.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 24 April 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/


import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
  ReferenceArea, ReferenceLine
} from 'recharts';
import {
  RefreshCw, Activity, Zap, Battery, Wind,
  AlertTriangle, CalendarIcon, ChevronLeft, ChevronRight, Sun
} from 'lucide-react';
import { Skeleton }                               from '@/components/ui/skeleton';
import { Calendar }                               from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button }                                  from '@/components/ui/button';
import { format }                                  from 'date-fns';
import { cn }                                      from '@/lib/utils';
import api                                          from '@/lib/axios';

// ── Palette helpers ──────────────────────────────────────────────────────────
const DEVICE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
];
const deviceColor = (index) => DEVICE_COLORS[index % DEVICE_COLORS.length];

// ── Shared chart tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-3 border rounded shadow-lg text-sm">
      <p className="font-semibold mb-1">{`Time: ${label}`}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {`${entry.name}: ${entry.value?.toFixed(2)} ${
            entry.name.toLowerCase().includes('soc') ? '%' : 'kW'
          }`}
        </p>
      ))}
    </div>
  );
};

// ── Skeleton card ────────────────────────────────────────────────────────────
const ChartSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
    <Skeleton className="h-6 w-64" />
    <Skeleton className="h-[300px] w-full" />
  </div>
);

// ── Generic single-axis line chart ───────────────────────────────────────────
const SimpleLineChart = ({ data, lines, yLabel = 'Power (kW)' }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="time" />
      <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
      <Tooltip content={<CustomTooltip />} />
      <Legend />
      {lines.map(({ key, name, color, dashed }) => (
        <Line
          key={key}
          type="monotone"
          dataKey={key}
          stroke={color}
          strokeWidth={2}
          name={name}
          dot={{ r: 3 }}
          strokeDasharray={dashed ? '5 5' : undefined}
        />
      ))}
    </LineChart>
  </ResponsiveContainer>
);

// ── Power chart with charge/discharge zone background ────────────────────────
const PowerChartWithZones = ({
  data,
  lines,
  yLabel = 'Power (kW)',
  // Zone labels and colors — override for non-BESS/EV assets
  positiveLabel    = 'Discharge ↑',
  negativeLabel    = 'Charge ↓',
  positiveFill     = '#bbf7d0',   // green tint  – discharge / export
  negativeFill     = '#bfdbfe',   // blue tint   – charge / import
  positiveLabelColor = '#15803d',
  negativeLabelColor = '#1d4ed8',
}) => {
  const { yMin, yMax } = useMemo(() => {
    let lo = 0, hi = 0;
    data.forEach(d =>
      lines.forEach(l => {
        const v = d[l.key];
        if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      })
    );
    const pad = Math.max((hi - lo) * 0.08, 0.5);
    return { yMin: lo - pad, yMax: hi + pad };
  }, [data, lines]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis
          domain={[yMin, yMax]}
          tickFormatter={(v) => +v.toFixed(2)}
          label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        {/* Positive zone */}
        {yMax > 0 && (
          <ReferenceArea
            y1={0} y2={yMax}
            fill={positiveFill}
            fillOpacity={0.35}
            ifOverflow="hidden"
            label={{ value: positiveLabel, position: 'insideTopLeft', fontSize: 11, fill: positiveLabelColor }}
          />
        )}
        {/* Negative zone */}
        {yMin < 0 && (
          <ReferenceArea
            y1={yMin} y2={0}
            fill={negativeFill}
            fillOpacity={0.35}
            ifOverflow="hidden"
            label={{ value: negativeLabel, position: 'insideBottomLeft', fontSize: 11, fill: negativeLabelColor }}
          />
        )}

        <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1.5} />

        {lines.map(({ key, name, color, dashed }) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            name={name}
            dot={{ r: 3 }}
            strokeDasharray={dashed ? '5 5' : undefined}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
const EMSDashboard = () => {
  const [data,             setData]             = useState([]);
  const [selectedDate,     setSelectedDate]     = useState(new Date());
  const [selectedInterval, setSelectedInterval] = useState('15');
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState(null);
  const [dataInfo,         setDataInfo]         = useState('');

  // Per-type asset lists (populated from API response)
  const [afeAssets,      setAfeAssets]      = useState([]);
  const [pvAssets,       setPvAssets]       = useState([]);
  const [windAssets,     setWindAssets]     = useState([]);
  const [loadAssets,     setLoadAssets]     = useState([]);
  const [cloadAssets,    setCloadAssets]    = useState([]);
  const [bessAssets,     setBessAssets]     = useState([]);
  const [uniEvAssets,    setUniEvAssets]    = useState([]);
  const [biEvAssets,     setBiEvAssets]     = useState([]);
  const [bessCapacities, setBessCapacities] = useState({});

  // ── Data fetching ─────────────────────────────────────────────────────────
  const formatDateForAPI = (d) => {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const fetchEMSData = async (date, interval = '15') => {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get(
        `/api/ems-data/${formatDateForAPI(date)}?interval=${interval}`
      );

      if (result.success) {
        setData(result.data.map(item => ({
          ...item,
          time: new Date(item.time).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
          })
        })));
        setDataInfo(result.info || '');

        if (result.afeAssets)      setAfeAssets(result.afeAssets);
        if (result.pvAssets)       setPvAssets(result.pvAssets);
        if (result.windAssets)     setWindAssets(result.windAssets);
        if (result.loadAssets)     setLoadAssets(result.loadAssets);
        if (result.cloadAssets)    setCloadAssets(result.cloadAssets);
        if (result.bessAssets)     setBessAssets(result.bessAssets);
        if (result.uniEvAssets)    setUniEvAssets(result.uniEvAssets);
        if (result.biEvAssets)     setBiEvAssets(result.biEvAssets);
        if (result.bessCapacities) setBessCapacities(result.bessCapacities);
      } else {
        setError('Failed to fetch data');
      }
    } catch {
      setError('Network error: Unable to fetch data');
    }
    setLoading(false);
  };

  useEffect(() => { fetchEMSData(selectedDate, selectedInterval); }, [selectedDate, selectedInterval]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <Skeleton className="h-8 w-64" />
          </div>
          {[...Array(6)].map((_, i) => <ChartSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-gray-800">Optimization Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Date navigation */}
              <div className="flex items-center space-x-2">
                <Button onClick={() => shiftDate(-1)} variant="outline" size="icon">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-[240px] justify-start text-left font-normal',
                        !selectedDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => d && setSelectedDate(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={() => shiftDate(1)} variant="outline" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Interval selector */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 text-sm">Interval:</span>
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>

              <Button
                onClick={() => fetchEMSData(selectedDate, selectedInterval)}
                className="bg-blue-600 text-white hover:bg-blue-700 flex items-center space-x-2"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {dataInfo && !error && (
            <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex items-center space-x-2">
              <Activity size={16} />
              <span>{dataInfo} • {data.length} data points</span>
            </div>
          )}
        </div>

        {data.length > 0 ? (
          <div className="space-y-6">

            {/* ── Per-PV charts ───────────────────────────────────────────── */}
            {pvAssets.map((asset, idx) => (
              <div key={asset.asset_key} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Sun className="text-yellow-500" size={24} />
                  <h2 className="text-xl font-semibold text-gray-800">
                    {asset.name}: Measured Average vs Optimal
                  </h2>
                </div>
                <SimpleLineChart
                  data={data}
                  yLabel="Power (kW)"
                  lines={[
                    { key: `${asset.asset_key}_power_fct`, name: 'Measured Average', color: deviceColor(idx * 2) },
                    { key: `${asset.asset_key}_power`,     name: 'Optimal',          color: deviceColor(idx * 2 + 1), dashed: true },
                  ]}
                />
              </div>
            ))}

            {/* ── Per-Wind charts ──────────────────────────────────────────── */}
            {windAssets.map((asset, idx) => (
              <div key={asset.asset_key} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Wind className="text-cyan-600" size={24} />
                  <h2 className="text-xl font-semibold text-gray-800">
                    {asset.name}: Measured Avg vs EMS Optimal
                  </h2>
                </div>
                <SimpleLineChart
                  data={data}
                  yLabel="Power (kW)"
                  lines={[
                    { key: `${asset.asset_key}_power_fct`, name: 'Measured Average', color: deviceColor(idx * 2) },
                    { key: `${asset.asset_key}_power`,     name: 'Optimal',          color: deviceColor(idx * 2 + 1), dashed: true },
                  ]}
                />
              </div>
            ))}

            {/* ── Per-Load charts ──────────────────────────────────────────── */}
            {loadAssets.map((asset, idx) => (
              <div key={asset.asset_key} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  {asset.name}: Measured Avg vs EMS Optimal
                </h2>
                <SimpleLineChart
                  data={data}
                  yLabel="Power (kW)"
                  lines={[
                    { key: `${asset.asset_key}_power_fct`, name: 'Measured Average', color: deviceColor(idx * 2) },
                    { key: `${asset.asset_key}_power`,     name: 'Optimal',          color: deviceColor(idx * 2 + 1), dashed: true },
                  ]}
                />
              </div>
            ))}

            {/* ── Per-Critical-Load charts ─────────────────────────────────── */}
            {cloadAssets.map((asset, idx) => (
              <div key={asset.asset_key} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <AlertTriangle className="text-red-600" size={24} />
                  <h2 className="text-xl font-semibold text-gray-800">
                    {asset.name} (Critical): Measured Avg vs EMS Optimal
                  </h2>
                </div>
                <SimpleLineChart
                  data={data}
                  yLabel="Power (kW)"
                  lines={[
                    { key: `${asset.asset_key}_power_fct`, name: 'Measured Average', color: deviceColor(idx * 2) },
                    { key: `${asset.asset_key}_power`,     name: 'Optimal',          color: deviceColor(idx * 2 + 1), dashed: true },
                  ]}
                />
              </div>
            ))}

            {/* ── Per-BESS charts ──────────────────────────────────────────── */}
            {bessAssets.map((asset) => {
              const hasCapacity = bessCapacities[asset.asset_key] != null;
              return (
                <React.Fragment key={asset.asset_key}>
                  {/* Power chart */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center space-x-2 mb-1">
                      <Battery className="text-blue-600" size={24} />
                      <h2 className="text-xl font-semibold text-gray-800">
                        {asset.name}: Power — Measured vs Setpoint
                      </h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 ml-8">
                      Positive = discharging &nbsp;·&nbsp; Negative = charging
                    </p>
                    <PowerChartWithZones
                      data={data}
                      yLabel="Power (kW)"
                      lines={[
                        { key: `${asset.asset_key}_POWER`,    name: 'Measured Power',    color: '#1d4ed8' },
                        { key: `${asset.asset_key}_setpoint`, name: 'Target Power', color: '#dc2626', dashed: true },
                      ]}
                    />
                  </div>

                  {/* SoC chart */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center space-x-2 mb-4">
                      <Battery className="text-green-600" size={24} />
                      <h2 className="text-xl font-semibold text-gray-800">
                        {asset.name}: State of Charge — Measured vs Setpoint
                        {!hasCapacity && (
                          <span className="ml-2 text-sm font-normal text-amber-600">
                            (capacity not found in config – setpoint in kWh)
                          </span>
                        )}
                      </h2>
                    </div>
                    <SimpleLineChart
                      data={data}
                      yLabel={hasCapacity ? 'SoC (%)' : 'SoC / Level'}
                      lines={[
                        {
                          key:   `${asset.asset_key}_SoC`,
                          name:  'Measured SoC (%)',
                          color: '#059669',
                        },
                        {
                          key:   hasCapacity
                            ? `${asset.asset_key}_level_soc`
                            : `${asset.asset_key}_level`,
                          name:  hasCapacity ? 'Setpoint SoC (%)' : 'Setpoint Level (kWh)',
                          color: '#0891b2',
                          dashed: true,
                        },
                      ]}
                    />
                  </div>
                </React.Fragment>
              );
            })}

            {/* ── Per-AFE grid flow charts ─────────────────────────────────── */}
            {afeAssets.map((asset) => (
              <div key={asset.asset_key} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-2 mb-1">
                  <Zap className="text-orange-500" size={24} />
                  <h2 className="text-xl font-semibold text-gray-800">
                    {asset.name}: Grid Power — Measured vs Setpoint
                  </h2>
                </div>
                <p className="text-xs text-gray-400 mb-4 ml-8">
                  Positive = importing&nbsp;·&nbsp;Negative = exporting
                </p>
                <PowerChartWithZones
                  data={data}
                  yLabel="Power (kW)"
                  positiveLabel="Import ↑"
                  negativeLabel="Export ↓"
                  positiveFill="#fee2e2"
                  negativeFill="#bbf7d0"
                  positiveLabelColor="#b91c1c"
                  negativeLabelColor="#15803d"
                  lines={[
                    { key: `${asset.asset_key}_POWER`,    name: 'Measured Power',      color: '#dc2626' },
                    { key: `${asset.asset_key}_setpoint`, name: 'Target Power', color: '#6b7280', dashed: true },
                  ]}
                />
              </div>
            ))}

            {afeAssets.length > 1 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center space-x-2 mb-1">
                  <Zap className="text-orange-500" size={24} />
                  <h2 className="text-xl font-semibold text-gray-800">
                    Aggregate Grid Power — All AFEs
                  </h2>
                </div>
                <p className="text-xs text-gray-400 mb-4 ml-8">
                  Positive = importing&nbsp;·&nbsp;Negative = exporting
                </p>
                <PowerChartWithZones
                  data={data}
                  yLabel="Power (kW)"
                  positiveLabel="Import ↑"
                  negativeLabel="Export ↓"
                  positiveFill="#fee2e2"
                  negativeFill="#bbf7d0"
                  positiveLabelColor="#b91c1c"
                  negativeLabelColor="#15803d"
                  lines={[
                    { key: 'imp', name: 'Total Import Target (kW)', color: '#dc2626', dashed: true },
                    { key: 'exp', name: 'Total Export Target (kW)', color: '#16a34a', dashed: true },
                  ]}
                />
              </div>
            )}

            {/* ── Per-Unidirectional-EV charts ─────────────────────────────── */}
            {uniEvAssets.map((asset) => (
              <React.Fragment key={asset.asset_key}>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Zap className="text-purple-600" size={24} />
                    <h2 className="text-xl font-semibold text-gray-800">
                      {asset.name} (Unidirectional): Measured Power vs Setpoint
                    </h2>
                  </div>
                  <SimpleLineChart
                    data={data}
                    yLabel="Power (kW)"
                    lines={[
                      { key: `${asset.asset_key}_POWER`,  name: 'Measured Power',  color: '#9333ea' },
                      { key: `${asset.asset_key}_charge`, name: 'Target Power',  color: '#f97316', dashed: true },
                    ]}
                  />
                </div>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Battery className="text-green-600" size={24} />
                    <h2 className="text-xl font-semibold text-gray-800">
                      {asset.name} (Unidirectional): Measured SoC vs Setpoint
                    </h2>
                  </div>
                  <SimpleLineChart
                    data={data}
                    yLabel="State of Charge (%)"
                    lines={[
                      { key: `${asset.asset_key}_SoC`, name: 'Measured SoC',   color: '#059669' },
                      { key: `${asset.asset_key}_soc`, name: 'Target SoC',   color: '#0891b2', dashed: true },
                    ]}
                  />
                </div>
              </React.Fragment>
            ))}

            {/* ── Per-Bidirectional-EV charts ──────────────────────────────── */}
            {biEvAssets.map((asset) => (
              <React.Fragment key={asset.asset_key}>
                {/* Power chart with zone shading */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center space-x-2 mb-1">
                    <Zap className="text-blue-600" size={24} />
                    <h2 className="text-xl font-semibold text-gray-800">
                      {asset.name} (Bidirectional): Power — Measured vs Setpoint
                    </h2>
                  </div>
                  <p className="text-xs text-gray-400 mb-4 ml-8">
                    Positive = discharging &nbsp;·&nbsp; Negative = charging
                  </p>
                  <PowerChartWithZones
                    data={data}
                    yLabel="Power (kW)"
                    lines={[
                      { key: `${asset.asset_key}_POWER`,    name: 'Measured Power',      color: '#1d4ed8' },
                      { key: `${asset.asset_key}_setpoint`, name: 'Target Power',  color: '#dc2626', dashed: true },
                    ]}
                  />
                </div>

                {/* SoC chart */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Battery className="text-indigo-600" size={24} />
                    <h2 className="text-xl font-semibold text-gray-800">
                      {asset.name} (Bidirectional): Measured SoC vs Setpoint
                    </h2>
                  </div>
                  <SimpleLineChart
                    data={data}
                    yLabel="State of Charge (%)"
                    lines={[
                      { key: `${asset.asset_key}_SoC`, name: 'Measured SoC',  color: '#7c3aed' },
                      { key: `${asset.asset_key}_soc`, name: 'Target SoC',  color: '#0f766e', dashed: true },
                    ]}
                  />
                </div>
              </React.Fragment>
            ))}

          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Activity className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              No EMS data found for {selectedDate.toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EMSDashboard;