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

File: device-electric-grid.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Zap, Power, Activity, Gauge, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function ElectricGrid() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    gridVoltage: 0,
    gridFrequency: 0,
    powerFactor: 0,
    importPower: 0,
    exportPower: 0,
    gridStatus: "Connected",
    dailyImport: 0,
    dailyExport: 0,
    peakDemand: 0,
    powerQuality: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
        const response = await fetch(`${API_BASE_URL}/api/data`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const jsonData = await response.json()
        setData({
          gridVoltage: jsonData.GRID_VOLTAGE?.toFixed(1) || (230 + Math.random() * 10).toFixed(1),
          gridFrequency: jsonData.GRID_FREQUENCY?.toFixed(2) || (50 + Math.random() * 0.1).toFixed(2),
          powerFactor: jsonData.GRID_POWER_FACTOR?.toFixed(3) || (0.95 + Math.random() * 0.05).toFixed(3),
          importPower: (Math.abs(jsonData.GRID_IMPORT_POWER || Math.random() * 15000) / 1000).toFixed(2),
          exportPower: (Math.abs(jsonData.GRID_EXPORT_POWER || Math.random() * 8000) / 1000).toFixed(2),
          gridStatus: jsonData.GRID_STATUS || "Connected",
          dailyImport: jsonData.GRID_DAILY_IMPORT?.toFixed(1) || (Math.random() * 100).toFixed(1),
          dailyExport: jsonData.GRID_DAILY_EXPORT?.toFixed(1) || (Math.random() * 60).toFixed(1),
          peakDemand: (Math.abs(jsonData.GRID_PEAK_DEMAND || Math.random() * 20000) / 1000).toFixed(2),
          powerQuality: jsonData.GRID_POWER_QUALITY?.toFixed(1) || (95 + Math.random() * 5).toFixed(1),
        })
        setError("S.D.")
      } catch (error) {
        console.error("Error fetching data:", error)
        setError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    const intervalId = setInterval(fetchData, 5000)
    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Electric Grid Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GridStatusCard data={data} isLoading={isLoading} />
        <VoltageFrequencyCard data={data} isLoading={isLoading} />
        <PowerFlowCard data={data} isLoading={isLoading} />
        <EnergyTradeCard data={data} isLoading={isLoading} />
        <PowerFactorCard data={data} isLoading={isLoading} />
        <PeakDemandCard data={data} isLoading={isLoading} />
        <PowerQualityCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  )
}

function GridStatusCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "Connected":
        return "bg-green-500"
      case "Disconnected":
        return "bg-red-500"
      case "Maintenance":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Grid Connection Status</CardTitle>
        <Power className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[120px]" />
        ) : (
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(data.gridStatus)}>{data.gridStatus}</Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Real-time grid connection status</p>
      </CardContent>
    </Card>
  )
}

function VoltageFrequencyCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Grid Parameters</CardTitle>
        <Gauge className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[70px]" />
            ) : (
              <div className="text-xl font-bold">{data.gridVoltage} V</div>
            )}
            <p className="text-xs text-muted-foreground">Voltage</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[70px]" />
            ) : (
              <div className="text-xl font-bold">{data.gridFrequency} Hz</div>
            )}
            <p className="text-xs text-muted-foreground">Frequency</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PowerFlowCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Power Flow</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-sm">Import</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-[80px]" />
            ) : (
              <span className="font-bold">{data.importPower} kW</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm">Export</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-[80px]" />
            ) : (
              <span className="font-bold">{data.exportPower} kW</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EnergyTradeCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Daily Energy Trade</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Imported</span>
            {isLoading ? (
              <Skeleton className="h-6 w-[80px]" />
            ) : (
              <span className="font-bold text-red-600">{data.dailyImport} kWh</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Exported</span>
            {isLoading ? (
              <Skeleton className="h-6 w-[80px]" />
            ) : (
              <span className="font-bold text-green-600">{data.dailyExport} kWh</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PowerFactorCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Power Factor</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.powerFactor}</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.powerFactor) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Target: {">"} 0.95</p>
      </CardContent>
    </Card>
  )
}

function PeakDemandCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Peak Demand</CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.peakDemand} kW</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.peakDemand) / 25) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Limit: 25 kW</p>
      </CardContent>
    </Card>
  )
}

function PowerQualityCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Power Quality</CardTitle>
        <Gauge className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.powerQuality}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.powerQuality)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Excellent: {">"} 95%</p>
      </CardContent>
    </Card>
  )
}
