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

File: page-ems-dashboard.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Calendar, RefreshCw, Activity, Zap, Battery } from 'lucide-react';

const EMSDashboard = () => {
  const [data, setData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedInterval, setSelectedInterval] = useState('15');
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataInfo, setDataInfo] = useState('');

  const BASE_URL_ENV = import.meta.env.VITE_BASE_URL || "http://localhost:3001";
  const API_BASE_URL = `${BASE_URL_ENV}/api`;

  // Fetch available dates
  const fetchAvailableDates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/available-dates`);
      const result = await response.json();
      if (result.success) {
        setAvailableDates(result.dates);
      }
    } catch (err) {
      console.error('Error fetching available dates:', err);
    }
  };

  // Fetch EMS data for selected date with interval
  const fetchEMSData = async (date, interval = '15') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/ems-data/${date}?interval=${interval}`);
      const result = await response.json();
      
      if (result.success) {
        // Process data for charts with better time formatting
        const processedData = result.data.map(item => ({
          ...item,
          time: new Date(item.time).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          }),
          fullTime: new Date(item.time),
          // Combine bidirectional charger charging and discharging for total power
          c2_total: (item.c2_ch || 0) + (item.c2_dis || 0)
        }));
        setData(processedData);
        setDataInfo(result.info || `Data grouped into ${interval}-minute intervals`);
      } else {
        setError('Failed to fetch data');
      }
    } catch (err) {
      setError('Network error: Unable to fetch data');
      console.error('Error fetching EMS data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAvailableDates();
    fetchEMSData(selectedDate, selectedInterval);
  }, [selectedDate, selectedInterval]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleIntervalChange = (e) => {
    setSelectedInterval(e.target.value);
  };

  const handleRefresh = () => {
    fetchEMSData(selectedDate, selectedInterval);
  };

  // Custom tooltip formatter
  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-semibold">{`Time: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value?.toFixed(4)} ${entry.payload.unit || (entry.name.includes('SoC') ? '%' : 'kW')}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-lg text-gray-600">Loading EMS data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-gray-800">EMS Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="text-gray-500" size={20} />
                <select
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={new Date().toISOString().split('T')[0]}>Today</option>
                  {availableDates.map(date => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-gray-600 text-sm">Interval:</span>
                <select
                  value={selectedInterval}
                  onChange={handleIntervalChange}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>
              
              <button
                onClick={handleRefresh}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {dataInfo && !error && (
            <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
              <div className="flex items-center space-x-2">
                <Activity size={16} />
                <span>{dataInfo} • {data.length} data points</span>
              </div>
            </div>
          )}
        </div>

        {data.length > 0 ? (
          <div className="space-y-6">
            {/* PV Measured Average vs EMS Optimal */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                PV Generation: Measured Average vs EMS Optimal
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="pv_fct" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="PV Measured Average"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pv" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="PV EMS Optimal"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Load Measured Average vs EMS Optimal */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Load Demand: Measured Average vs EMS Optimal
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="ld_fct" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Load Measured Average"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ld" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Load EMS Optimal"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Battery Status */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Battery Status & Charge/Discharge
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Power (kW)', angle: 90, position: 'insideRight' }} 
                  />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="bl" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Battery Level (kWh)"
                    dot={{ r: 4 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="bc" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Battery Charge (kW)"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="bd" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="Battery Discharge (kW)"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Power Import/Export */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Grid Power Flow Analysis
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Bar 
                    dataKey="import_AC_to_DC" 
                    fill="#dc2626" 
                    name="Import AC to DC"
                  />
                  <Bar 
                    dataKey="export_DC_to_AC" 
                    fill="#16a34a" 
                    name="Export DC to AC (Total)"
                  />
                  <Bar 
                    dataKey="export_DC_to_AC_ngs" 
                    fill="#2563eb" 
                    name="Export DC to AC (Non-Grid)"
                  />
                  <Bar 
                    dataKey="exp2" 
                    fill="#ca8a04" 
                    name="Grid Service Export (%)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* NEW CHARTS - EV Charger Data */}

            {/* Unidirectional EV Charger Power Comparison */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="text-purple-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-800">
                  Unidirectional EV Charger: Measured Power vs Setpoint
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="EV1_POWER" 
                    stroke="#9333ea" 
                    strokeWidth={2}
                    name="Measured Power"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="c1_ch" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    name="Setpoint Power"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Unidirectional EV Charger SoC Comparison */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Battery className="text-green-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-800">
                  Unidirectional EV Charger: Measured SoC vs Setpoint
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis 
                    label={{ value: 'State of Charge (%)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="CAR_1_SoC" 
                    stroke="#059669" 
                    strokeWidth={2}
                    name="Measured SoC"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="v1_soc" 
                    stroke="#0891b2" 
                    strokeWidth={2}
                    name="Setpoint SoC"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bidirectional EV Charger Power Comparison */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="text-blue-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-800">
                  Bidirectional EV Charger: Measured Power vs Setpoint
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis label={{ value: 'Power (kW)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="EV2_POWER" 
                    stroke="#1d4ed8" 
                    strokeWidth={2}
                    name="Measured Power"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="c2_ch" 
                    stroke="#dc2626" 
                    strokeWidth={2}
                    name="Setpoint Charge Power"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="c2_dis" 
                    stroke="#ea580c" 
                    strokeWidth={2}
                    name="Setpoint Discharge Power"
                    dot={{ r: 3 }}
                    strokeDasharray="3 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bidirectional EV Charger SoC Comparison */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Battery className="text-indigo-600" size={24} />
                <h2 className="text-xl font-semibold text-gray-800">
                  Bidirectional EV Charger: Measured SoC vs Setpoint
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis 
                    label={{ value: 'State of Charge (%)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip content={customTooltip} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="CAR_2_SoC" 
                    stroke="#7c3aed" 
                    strokeWidth={2}
                    name="Measured SoC"
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="v2_soc" 
                    stroke="#0f766e" 
                    strokeWidth={2}
                    name="Setpoint SoC"
                    dot={{ r: 3 }}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Activity className="mx-auto mb-4 text-gray-400" size={64} />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Data Available</h3>
              <p className="text-gray-500">
                No EMS data found for {new Date(selectedDate).toLocaleDateString()}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default EMSDashboard;