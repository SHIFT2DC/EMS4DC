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

File: page-droop-curves.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 3rd February 2026
Version: v1.2.0
*/

import { useEffect, useState } from "react"
import { Line } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, RefreshCw, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
const API_URL = `${BASE_URL}/api/droop-curve`

// LUT DEFINITIONS - Define how to build LUT tables for each device
const LUT_DEFINITIONS = {
  AFE: {
    axes: {
      x: { label: "Power", unit: "W" },
      y: { label: "Voltage", unit: "V" }
    },
    // Function that takes modbus data and returns LUT points
    buildLUT: (modbusData) => {
      const FW_VOLT_OFST = modbusData.AFE_FW_VOLT_OFST || 0
      const FW_VOLT_DELTA = modbusData.AFE_FW_VOLT_DELTA || 0
      const FW_P_MAX = modbusData.AFE_FW_P_MAX || 0
      const RE_VOLT_OFST = modbusData.AFE_RE_VOLT_OFST || 0
      const RE_VOLT_DELTA = modbusData.AFE_RE_VOLT_DELTA || 0
      const RE_P_MAX = modbusData.AFE_RE_P_MAX || 0
      const VOLT_OFST = modbusData.AFE_VOLT_OFST || 0
      
      return [
        {
          index: 0,
          x: -FW_P_MAX,
          y: 700 + VOLT_OFST - FW_VOLT_OFST - FW_VOLT_DELTA,
          x_param: "-1 * FW_P_MAX",
          y_param: "700 + VOLT_OFST - FW_VOLT_OFST - FW_VOLT_DELTA"
        },
        {
          index: 1,
          x: 0,
          y: 700 + VOLT_OFST - FW_VOLT_OFST,
          x_param: "0",
          y_param: "700 + VOLT_OFST - FW_VOLT_OFST"
        },
        {
          index: 2,
          x: 0,
          y: 700 + VOLT_OFST + RE_VOLT_OFST,
          x_param: "0",
          y_param: "700 + VOLT_OFST + RE_VOLT_OFST"
        },
        {
          index: 3,
          x: RE_P_MAX,
          y: 700 + VOLT_OFST + RE_VOLT_OFST + RE_VOLT_DELTA,
          x_param: "RE_P_MAX",
          y_param: "700 + VOLT_OFST + RE_VOLT_OFST + RE_VOLT_DELTA"
        }
      ]
    },
    // Parameters needed from modbus
    requiredParams: ["FW_VOLT_OFST", "FW_VOLT_DELTA", "FW_P_MAX", "RE_VOLT_OFST", "RE_VOLT_DELTA", "RE_P_MAX", "VOLT_OFST"]
  },
  
  PV: {
    axes: {
      x: { label: "Power", unit: "W" },
      y: { label: "Voltage", unit: "V" }
    },
    buildLUT: (modbusData) => {
      const V_NOM = modbusData.PV_V_NOM || 700
      const P_MAX = modbusData.PV_P_MAX || 40000
      const V_DROOP = modbusData.PV_V_DROOP || 35
      
      return [
        {
          index: 0,
          x: -P_MAX,
          y: V_NOM + V_DROOP,
          x_param: "PV_P_MAX (negated)",
          y_param: "PV_V_NOM + PV_V_DROOP"
        },
        {
          index: 1,
          x: 0,
          y: V_NOM,
          x_param: "0",
          y_param: "PV_V_NOM"
        },
        {
          index: 2,
          x: P_MAX,
          y: V_NOM - V_DROOP,
          x_param: "PV_P_MAX",
          y_param: "PV_V_NOM - PV_V_DROOP"
        }
      ]
    },
    requiredParams: ["V_NOM", "P_MAX", "V_DROOP"]
  },
  
  BESS: {
    axes: {
      x: { label: "Power", unit: "W" },
      y: { label: "Voltage", unit: "V" }
    },
    buildLUT: (modbusData) => {
      const CHARGE_P = modbusData.BESS_CHARGE_P || 0
      const DISCHARGE_P = modbusData.BESS_DISCHARGE_P || 0
      const SOC_0_CHAR_V = modbusData.BESS_SOC_0_CHAR_V || 0
      const SOC_0_DISCH_V = modbusData.BESS_SOC_0_DISCH_V || 0
      const SOC_100_CHAR_V = modbusData.BESS_SOC_100_CHAR_V || 0
      const SOC_100_DISCH_V = modbusData.BESS_SOC_100_DISCH_V || 0
      const CONV_OFST = modbusData.BESS_CONV_OFST || 0
      
      return [
        {
          index: 0,
          x: CHARGE_P,
          y: SOC_0_CHAR_V + 25,
          x_param: "BESS_CHARGE_P",
          y_param: "BESS_SOC_0_CHAR_V + 25"
        },
        {
          index: 1,
          x: 0,
          y: SOC_0_CHAR_V,
          x_param: "0",
          y_param: "BESS_SOC_0_CHAR_V"
        },
        {
          index: 2,
          x: 0,
          y: SOC_0_DISCH_V,
          x_param: "0",
          y_param: "BESS_SOC_0_DISCH_V"
        },
        {
          index: 3,
          x: -DISCHARGE_P,
          y: SOC_0_DISCH_V - 25,
          x_param: "-BESS_DISCHARGE_P (negated)",
          y_param: "BESS_SOC_0_DISCH_V - 25"
        },
      ]
    },
    requiredParams: ["CHARGE_P", "DISCHARGE_P", "SOC_0_CHAR_V", "SOC_0_DISCH_V", "SOC_100_CHAR_V", "SOC_100_DISCH_V", "CONV_OFST"]
  }
}

const DroopCurveLUT = () => {
  const [devices, setDevices] = useState([])
  const [activeDevice, setActiveDevice] = useState(null)
  const [modbusData, setModbusData] = useState(null)
  const [curveData, setCurveData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Get available devices from LUT definitions
    const availableDevices = Object.keys(LUT_DEFINITIONS)
    setDevices(availableDevices)
    if (availableDevices.length > 0) {
      setActiveDevice(availableDevices[0])
    }
  }, [])

  useEffect(() => {
    if (activeDevice) {
      fetchDroopLUT(activeDevice)
    }
  }, [activeDevice])

  const fetchDroopLUT = async (deviceName) => {
    setLoading(true)
    setError(null)
    try {
      // Fetch all modbus data
      const response = await fetch(`${API_URL}/modbus-data`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      
      setModbusData(data)
      
      // Build LUT using the device's definition
      const lutDef = LUT_DEFINITIONS[deviceName]
      if (!lutDef) {
        throw new Error(`No LUT definition for device ${deviceName}`)
      }
      
      const points = lutDef.buildLUT(data)
      
      setCurveData({
        device: deviceName,
        axes: lutDef.axes,
        points: points,
        requiredParams: lutDef.requiredParams
      })
    } catch (err) {
      setError(`Failed to load LUT for ${deviceName}: ${err.message}`)
      console.error("Error fetching droop LUT:", err)
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!curveData) {
    return (
      <div className="p-8 text-center">
        <div className="animate-pulse text-gray-500">Loading droop curves...</div>
      </div>
    )
  }

  const chartData = {
    datasets: [{
      label: `${activeDevice} Droop Curve`,
      data: curveData.points.map(p => ({ x: p.x, y: p.y })),
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      showLine: true,
      tension: 0,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBackgroundColor: '#3B82F6',
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    }]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: `${curveData.axes.x.label} (${curveData.axes.x.unit})`,
          font: { size: 14, weight: 'bold' }
        },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: `${curveData.axes.y.label} (${curveData.axes.y.unit})`,
          font: { size: 14, weight: 'bold' }
        },
        grid: { color: 'rgba(0,0,0,0.05)' }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 12,
        callbacks: {
          title: (items) => `Point ${items[0].dataIndex + 1}`,
          label: (context) => {
            const point = context.raw
            const pointData = curveData.points[context.dataIndex]
            return [
              `${curveData.axes.x.label}: ${point.x.toFixed(2)} ${curveData.axes.x.unit}`,
              `${curveData.axes.y.label}: ${point.y.toFixed(2)} ${curveData.axes.y.unit}`,
              `Formula X: ${pointData.x_param}`,
              `Formula Y: ${pointData.y_param}`
            ]
          }
        }
      }
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Droop Curve Configuration</h1>
          <p className="text-gray-500 mt-1">View device droop curves calculated from Modbus parameters</p>
        </div>
        <Button 
          onClick={() => fetchDroopLUT(activeDevice)}
          variant="outline"
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeDevice} onValueChange={setActiveDevice}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          {devices.map(device => (
            <TabsTrigger key={device} value={device}>
              {device}
            </TabsTrigger>
          ))}
        </TabsList>

        {devices.map(device => (
          <TabsContent key={device} value={device}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{device} Droop Curve</span>
                  <span className="text-sm font-normal text-gray-500">
                    {curveData.points.length} points
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Chart */}
                <div className="h-96 bg-gray-50 rounded-lg p-4">
                  <Line data={chartData} options={chartOptions} />
                </div>

                {/* LUT Table */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Calculated Points</h3>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="p-3 text-left font-semibold">#</th>
                          <th className="p-3 text-left font-semibold">
                            {curveData.axes.x.label} ({curveData.axes.x.unit})
                          </th>
                          <th className="p-3 text-left font-semibold">Formula</th>
                          <th className="p-3 text-left font-semibold">
                            {curveData.axes.y.label} ({curveData.axes.y.unit})
                          </th>
                          <th className="p-3 text-left font-semibold">Formula</th>
                        </tr>
                      </thead>
                      <tbody>
                        {curveData.points.map((point, idx) => (
                          <tr 
                            key={idx} 
                            className={`border-b last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                          >
                            <td className="p-3 font-medium text-gray-600">{idx + 1}</td>
                            <td className="p-3">
                              <span className="font-mono text-lg font-semibold text-blue-600">
                                {point.x.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3">
                              <code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {point.x_param}
                              </code>
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-lg font-semibold text-green-600">
                                {point.y.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3">
                              <code className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                {point.y_param}
                              </code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Show required Modbus parameters */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Required Modbus Parameters</h4>
                    <div className="flex flex-wrap gap-2">
                      {curveData.requiredParams.map(param => (
                        <code key={param} className="text-sm bg-white text-blue-700 px-3 py-1 rounded border border-blue-300">
                          {activeDevice}_{param}
                        </code>
                      ))}
                    </div>
                    <p className="text-sm text-blue-800 mt-3">
                      <strong>Note:</strong> These parameters are read from Modbus and used to calculate the droop curve points above.
                    </p>
                  </div>

                  {/* Show raw modbus values */}
                  {modbusData && (
                    <details className="bg-gray-50 border rounded-lg p-4">
                      <summary className="cursor-pointer font-semibold text-gray-700">
                        Show Raw Modbus Values
                      </summary>
                      <div className="mt-3 space-y-1">
                        {curveData.requiredParams.map(param => {
                          const key = `${activeDevice}_${param}`
                          const value = modbusData[key]
                          return (
                            <div key={param} className="flex justify-between font-mono text-sm">
                              <span className="text-gray-600">{key}:</span>
                              <span className="text-gray-900 font-semibold">
                                {value !== undefined ? value : 'N/A'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default DroopCurveLUT