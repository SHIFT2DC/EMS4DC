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

File: page-droop-curves.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import "chart.js/auto"
import { useEffect, useState } from "react"
import { Line } from "react-chartjs-2"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Save, Lock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
const API_URL = `${BASE_URL}/api`

// Color palette
const deviceColors = {
  pv: { border: "#3B82F6", background: "rgba(59, 130, 246, 0.1)" },
  bess: { border: "#10B981", background: "rgba(16, 185, 129, 0.1)" },
  evCharger1: { border: "#8B5CF6", background: "rgba(139, 92, 246, 0.1)" },
  evCharger2: { border: "#f65c5cff", background: "rgba(139, 92, 246, 0.1)" },
  loads: { border: "#F59E0B", background: "rgba(245, 158, 11, 0.1)" },
}

// Function to generate droop curve points from parameters
const generateDroopCurvePoints = (parameters) => {
  const { v_nom, p_supply, v_supply, p_consume, v_consume, p_opt = 0 } = parameters

  // Calculate the three key points for the droop curve
  const upperPoint = [-p_consume, v_nom + v_consume]
  const middlePoint = [p_opt, v_nom]
  const lowerPoint = [p_supply, v_nom - v_supply]

  return [
    { x: upperPoint[0], y: upperPoint[1] },
    { x: middlePoint[0], y: middlePoint[1] },
    { x: lowerPoint[0], y: lowerPoint[1] },
  ]
}

const DroopCurveChart = ({ device, parameters, colorSet }) => {
  const chartPoints = generateDroopCurvePoints(parameters)

  // Calculate appropriate axis limits based on parameters
  const margin = Math.max(parameters.p_consume, parameters.p_supply) * 1.1
  const v_margin = Math.max(parameters.v_supply, parameters.v_consume) * 0.1

  const axisLimits = {
    xMin: -Math.max(parameters.p_consume, margin),
    xMax: Math.max(parameters.p_supply, margin),
    yMin: parameters.v_nom - parameters.v_supply - v_margin,
    yMax: parameters.v_nom + parameters.v_consume + v_margin,
  }

  return (
    <div className="h-64 md:h-80 relative">
      <Line
        data={{
          datasets: [
            {
              label: `${device} Droop Curve`,
              data: chartPoints,
              borderColor: colorSet.border,
              backgroundColor: colorSet.background,
              pointBackgroundColor: colorSet.border,
              pointBorderColor: "#fff",
              pointBorderWidth: 1,
              pointRadius: 5,
              pointHoverRadius: 7,
              showLine: true,
              tension: 0
            },
            // Add annotations for v_nom horizontal line
            {
              label: "v_nom",
              data: [
                { x: axisLimits.xMin, y: parameters.v_nom },
                { x: axisLimits.xMax, y: parameters.v_nom },
              ],
              borderColor: "rgba(0,0,0,0.3)",
              borderWidth: 1,
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
            },
            // Add annotations for power=0 vertical line
            {
              label: "Power = 0",
              data: [
                { x: 0, y: axisLimits.yMin },
                { x: 0, y: axisLimits.yMax },
              ],
              borderColor: "rgba(0,0,0,0.3)",
              borderWidth: 1,
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: "linear",
              position: "bottom",
              title: { display: true, text: "Power (W)", font: { weight: "normal" } },
              grid: { color: "rgba(0,0,0,0.05)" },
              min: axisLimits.xMin,
              max: axisLimits.xMax,
              ticks: {
                callback: (value) => {
                  if (value === 0) return "0"
                  if (value === parameters.p_supply) return `p_supply`
                  if (value === -parameters.p_consume) return `p_consume`
                  return value
                },
              },
            },
            y: {
              type: "linear",
              title: { display: true, text: "Voltage (V)", font: { weight: "normal" } },
              grid: { color: "rgba(0,0,0,0.05)" },
              min: axisLimits.yMin,
              max: axisLimits.yMax,
              ticks: {
                callback: (value) => {
                  if (value === parameters.v_nom) return `v_nom`
                  if (value === parameters.v_nom + parameters.v_consume) return `v_nom+v_consume`
                  if (value === parameters.v_nom - parameters.v_supply) return `v_nom-v_supply`
                  return value
                },
              },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(0,0,0,0.7)",
              padding: 10,
              cornerRadius: 6,
              titleFont: { size: 14 },
              bodyFont: { size: 13 },
              callbacks: {
                label: (context) => {
                  const point = context.raw
                  return `P: ${point.x.toFixed(1)}, V: ${point.y.toFixed(1)}`
                },
              },
            },
          },
        }}
      />
    </div>
  )
}

const DroopCurveForm = ({ device, parameters, setParameters, onSave }) => {
  const [formValues, setFormValues] = useState({ ...parameters })

  useEffect(() => {
    setFormValues({ ...parameters })
  }, [parameters])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormValues({
      ...formValues,
      [name]: Number.parseFloat(value) || 0,
    })
  }

  const handleSubmit = () => {
    // Keep the existing p_opt value from parameters (set by Python module)
    const updatedParams = {
      ...formValues,
      p_opt: parameters.p_opt, // Preserve p_opt from Python module
    }
    setParameters(updatedParams)
    onSave(updatedParams)
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div>
          <Label htmlFor={`${device}-v_nom`} className="text-sm font-medium">
            v_nom
          </Label>
          <Input
            id={`${device}-v_nom`}
            name="v_nom"
            type="number"
            value={formValues.v_nom}
            onChange={handleChange}
            className="mt-1"
            min="0"
            step="1"
          />
        </div>
        <div>
          <Label htmlFor={`${device}-p_supply`} className="text-sm font-medium">
            p_supply
          </Label>
          <Input
            id={`${device}-p_supply`}
            name="p_supply"
            type="number"
            value={formValues.p_supply}
            onChange={handleChange}
            className="mt-1"
            min="0"
            step="1000"
          />
        </div>
        <div>
          <Label htmlFor={`${device}-v_supply`} className="text-sm font-medium">
            v_supply
          </Label>
          <Input
            id={`${device}-v_supply`}
            name="v_supply"
            type="number"
            value={formValues.v_supply}
            onChange={handleChange}
            className="mt-1"
            min="0"
            step="1"
          />
        </div>
        <div>
          <Label htmlFor={`${device}-p_consume`} className="text-sm font-medium">
            p_consume
          </Label>
          <Input
            id={`${device}-p_consume`}
            name="p_consume"
            type="number"
            value={formValues.p_consume}
            onChange={handleChange}
            className="mt-1"
            min="0"
            step="1000"
          />
        </div>
        <div>
          <Label htmlFor={`${device}-v_consume`} className="text-sm font-medium">
            v_consume
          </Label>
          <Input
            id={`${device}-v_consume`}
            name="v_consume"
            type="number"
            value={formValues.v_consume}
            onChange={handleChange}
            className="mt-1"
            min="0"
            step="1"
          />
        </div>
      </div>

      {/* Display p_opt as read-only information */}
      <div className="bg-gray-50 p-3 rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-gray-500" />
          <Label className="text-sm font-medium text-gray-700">
            p_opt (Set by EMS Optimization)
          </Label>
        </div>
        <div className="text-lg font-mono text-gray-800">
          {parameters.p_opt !== undefined ? `${parameters.p_opt} W` : 'Not set'}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          This value is automatically updated by the EMS optimization module
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  )
}

const DroopCurvePanel = ({ device, deviceConfig, onSave }) => {
  // Extract droop parameters from device config
  const [parameters, setParameters] = useState({
    v_nom: deviceConfig.v_nom || 700,
    p_supply: deviceConfig.p_supply || 40000,
    v_supply: deviceConfig.v_supply || 35,
    p_consume: deviceConfig.p_consume || 40000,
    v_consume: deviceConfig.v_consume || 35,
    p_opt: deviceConfig.p_opt || 0,
  })

  const colorSet = deviceColors[device] || {
    border: "#6B7280",
    background: "rgba(107, 114, 128, 0.1)",
  }

  useEffect(() => {
    // Update parameters when deviceConfig changes
    setParameters({
      v_nom: deviceConfig.v_nom || 700,
      p_supply: deviceConfig.p_supply || 40000,
      v_supply: deviceConfig.v_supply || 35,
      p_consume: deviceConfig.p_consume || 40000,
      v_consume: deviceConfig.v_consume || 35,
      p_opt: deviceConfig.p_opt || 0,
    })
  }, [deviceConfig])

  const handleSave = (newParameters) => {
    // Save the parameters directly to the config
    const updatedConfig = {
      ...deviceConfig,
      v_nom: newParameters.v_nom,
      p_supply: newParameters.p_supply,
      v_supply: newParameters.v_supply,
      p_consume: newParameters.p_consume,
      v_consume: newParameters.v_consume,
      p_opt: newParameters.p_opt, // This will be preserved from the Python module
    }
    onSave(updatedConfig)
  }

  return (
    <Card className="mb-6 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium capitalize">{device} Droop Curve</CardTitle>
      </CardHeader>
      <CardContent>
        <DroopCurveChart device={device} parameters={parameters} colorSet={colorSet} />
        <DroopCurveForm device={device} parameters={parameters} setParameters={setParameters} onSave={handleSave} />
      </CardContent>
    </Card>
  )
}

const DroopCurves = () => {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("pv")

  useEffect(() => {
    fetchConfig()
    // Set up polling to refresh config every 30 seconds to get updated p_opt values
    const interval = setInterval(fetchConfig, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/config`)
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }
      const data = await response.json()
      setConfig(data)
    } catch (err) {
      console.error("Error fetching config:", err)
      setError("Failed to load configuration. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (updatedConfig) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedConfig),
      })

      if (!response.ok) {
        throw new Error(`Failed to save config: ${response.status}`)
      }

      setConfig(updatedConfig)
    } catch (err) {
      console.error("Error saving config:", err)
      setError("Failed to save configuration. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeviceConfigSave = (device, updatedDeviceConfig) => {
    if (!config) return

    const updatedConfig = {
      ...config,
      [device]: updatedDeviceConfig,
    }

    saveConfig(updatedConfig)
  }

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading droop curves...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!config) {
    return (
      <Alert className="max-w-2xl mx-auto my-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Configuration</AlertTitle>
        <AlertDescription>No configuration data available.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-8 py-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Droop Curve Configuration</h2>
        <div className="text-right">
          <p className="text-sm text-gray-500">Configure droop parameters</p>
          <p className="text-xs text-gray-400">p_opt values are set by EMS optimization</p>
        </div>
      </div>

      <Tabs defaultValue="pv" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pv">PV</TabsTrigger>
          <TabsTrigger value="bess">BESS</TabsTrigger>
          <TabsTrigger value="evCharger1">Unidirectional EV Charger</TabsTrigger>
          <TabsTrigger value="evCharger2">V2B EV Charger</TabsTrigger>
          <TabsTrigger value="loads">Loads</TabsTrigger>
        </TabsList>

        <TabsContent value="pv">
          <DroopCurvePanel
            device="pv"
            deviceConfig={config.pv}
            onSave={(updatedConfig) => handleDeviceConfigSave("pv", updatedConfig)}
          />
        </TabsContent>

        <TabsContent value="bess">
          <DroopCurvePanel
            device="bess"
            deviceConfig={config.bess}
            onSave={(updatedConfig) => handleDeviceConfigSave("bess", updatedConfig)}
          />
        </TabsContent>

        <TabsContent value="evCharger1">
          <DroopCurvePanel
            device="evCharger1"
            deviceConfig={config.evCharger1}
            onSave={(updatedConfig) => handleDeviceConfigSave("evCharger1", updatedConfig)}
          />
        </TabsContent>

        <TabsContent value="evCharger2">
          <DroopCurvePanel
            device="evCharger2"
            deviceConfig={config.evCharger2}
            onSave={(updatedConfig) => handleDeviceConfigSave("evCharger2", updatedConfig)}
          />
        </TabsContent>

        <TabsContent value="loads">
          <DroopCurvePanel
            device="loads"
            deviceConfig={config.loads}
            onSave={(updatedConfig) => handleDeviceConfigSave("loads", updatedConfig)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DroopCurves