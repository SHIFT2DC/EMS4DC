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

File: device-load.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Home, Lightbulb, Wind, Thermometer, Cpu, Activity, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function Loads() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    totalLoad: 0,
    lightingLoad: 0,
    hvacLoad: 0,
    equipmentLoad: 0,
    criticalLoad: 0,
    loadFactor: 0,
    peakLoad: 0,
    dailyConsumption: 0,
    loadDistribution: 0,
    systemStatus: "Normal",
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
          totalLoad: (Math.abs(jsonData.LOAD_POWER || Math.random() * 18000) / 1000).toFixed(2),
          lightingLoad: (Math.abs(jsonData.LIGHTING_LOAD || Math.random() * 3000) / 1000).toFixed(2),
          hvacLoad: (Math.abs(jsonData.HVAC_LOAD || Math.random() * 8000) / 1000).toFixed(2),
          equipmentLoad: (Math.abs(jsonData.EQUIPMENT_LOAD || Math.random() * 5000) / 1000).toFixed(2),
          criticalLoad: (Math.abs(jsonData.CRITICAL_LOAD || Math.random() * 2000) / 1000).toFixed(2),
          loadFactor: jsonData.LOAD_FACTOR?.toFixed(1) || (70 + Math.random() * 20).toFixed(1),
          peakLoad: (Math.abs(jsonData.PEAK_LOAD || Math.random() * 22000) / 1000).toFixed(2),
          dailyConsumption: jsonData.DAILY_CONSUMPTION?.toFixed(1) || (Math.random() * 200).toFixed(1),
          loadDistribution: jsonData.LOAD_DISTRIBUTION?.toFixed(1) || (80 + Math.random() * 15).toFixed(1),
          systemStatus: jsonData.LOAD_SYSTEM_STATUS || "Normal",
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
      <h1 className="text-3xl font-bold mb-6">Loads Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <TotalLoadCard data={data} isLoading={isLoading} />
        <CriticalLoadCard data={data} isLoading={isLoading} />
        <LoadFactorCard data={data} isLoading={isLoading} />
        <PeakLoadCard data={data} isLoading={isLoading} />
        <DailyConsumptionCard data={data} isLoading={isLoading} />
        <LoadDistributionCard data={data} isLoading={isLoading} />
        <SystemStatusCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  )
}

function TotalLoadCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Load</CardTitle>
        <Home className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.totalLoad} kW</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.totalLoad) / 20) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Capacity: 20 kW</p>
      </CardContent>
    </Card>
  )
}

function CriticalLoadCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Critical Load</CardTitle>
        <AlertCircle className="h-4 w-4 text-red-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.criticalLoad} kW</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.criticalLoad) / 5) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Priority loads requiring backup</p>
      </CardContent>
    </Card>
  )
}

function LoadFactorCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Load Factor</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.loadFactor}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.loadFactor)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Average vs Peak load ratio</p>
      </CardContent>
    </Card>
  )
}

function PeakLoadCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Peak Load Today</CardTitle>
        <Thermometer className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.peakLoad} kW</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.peakLoad) / 25) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Maximum demand recorded</p>
      </CardContent>
    </Card>
  )
}

function DailyConsumptionCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Daily Consumption</CardTitle>
        <Home className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.dailyConsumption} kWh</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.dailyConsumption) / 300) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Target: {"<"} 300 kWh/day</p>
      </CardContent>
    </Card>
  )
}

function LoadDistributionCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Load Distribution</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.loadDistribution}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.loadDistribution)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Load balance across phases</p>
      </CardContent>
    </Card>
  )
}

function SystemStatusCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "Normal":
        return "bg-green-500"
      case "Warning":
        return "bg-yellow-500"
      case "Critical":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">System Status</CardTitle>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(data.systemStatus)}>{data.systemStatus}</Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Overall load system health</p>
      </CardContent>
    </Card>
  )
}
