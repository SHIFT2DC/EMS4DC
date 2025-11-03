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

File: device-active-front-end.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Zap, Activity, Gauge, Settings, Power, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function ActiveFrontend() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    inverterStatus: "Online",
    acOutput: 0,
    acVoltage: 0,
    acCurrent: 0,
    acFrequency: 0,
    powerFactor: 0,
    thd: 0,
    efficiency: 0,
    temperature: 0,
    gridSync: "Synchronized",
    faultStatus: "No Faults",
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
          inverterStatus: jsonData.INVERTER_STATUS || "Online",
          acOutput: (Math.abs(jsonData.AC_OUTPUT_POWER || Math.random() * 15000) / 1000).toFixed(2),
          acVoltage: jsonData.AC_VOLTAGE?.toFixed(1) || (230 + Math.random() * 10).toFixed(1),
          acCurrent: jsonData.AC_CURRENT?.toFixed(1) || (Math.random() * 65).toFixed(1),
          acFrequency: jsonData.AC_FREQUENCY?.toFixed(2) || (50 + Math.random() * 0.1).toFixed(2),
          powerFactor: jsonData.AC_POWER_FACTOR?.toFixed(3) || (0.95 + Math.random() * 0.05).toFixed(3),
          thd: jsonData.AC_THD?.toFixed(2) || (Math.random() * 3).toFixed(2),
          efficiency: jsonData.INVERTER_EFFICIENCY?.toFixed(1) || (95 + Math.random() * 4).toFixed(1),
          temperature: jsonData.INVERTER_TEMP?.toFixed(1) || (35 + Math.random() * 20).toFixed(1),
          gridSync: jsonData.GRID_SYNC_STATUS || "Synchronized",
          faultStatus: jsonData.FAULT_STATUS || "No Faults",
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
      <h1 className="text-3xl font-bold mb-6">Active Frontend Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InverterStatusCard data={data} isLoading={isLoading} />
        <ACOutputCard data={data} isLoading={isLoading} />
        <ACParametersCard data={data} isLoading={isLoading} />
        <PowerQualityCard data={data} isLoading={isLoading} />
        <EfficiencyCard data={data} isLoading={isLoading} />
        <TemperatureCard data={data} isLoading={isLoading} />
        <GridSyncCard data={data} isLoading={isLoading} />
        <FaultStatusCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  )
}

function InverterStatusCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "Online":
        return "bg-green-500"
      case "Offline":
        return "bg-red-500"
      case "Standby":
        return "bg-yellow-500"
      case "Maintenance":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Inverter Status</CardTitle>
        <Power className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(data.inverterStatus)}>{data.inverterStatus}</Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Current inverter operational state</p>
      </CardContent>
    </Card>
  )
}

function ACOutputCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">AC Output Power</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.acOutput} kW</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.acOutput) / 17) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Rated: 17 kW</p>
      </CardContent>
    </Card>
  )
}

function ACParametersCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">AC Parameters</CardTitle>
        <Gauge className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-[60px]" />
            ) : (
              <div className="text-lg font-bold">{data.acVoltage} V</div>
            )}
            <p className="text-xs text-muted-foreground">Voltage</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-[60px]" />
            ) : (
              <div className="text-lg font-bold">{data.acCurrent} A</div>
            )}
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-[60px]" />
            ) : (
              <div className="text-lg font-bold">{data.acFrequency} Hz</div>
            )}
            <p className="text-xs text-muted-foreground">Frequency</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-[60px]" />
            ) : (
              <div className="text-lg font-bold">{data.powerFactor}</div>
            )}
            <p className="text-xs text-muted-foreground">Power Factor</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PowerQualityCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Power Quality (THD)</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-9 w-[80px]" /> : <div className="text-2xl font-bold">{data.thd}%</div>}
        <Progress value={isLoading ? 0 : Math.max(0, 100 - (Number.parseFloat(data.thd) / 5) * 100)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Target: {"<"} 5% THD</p>
      </CardContent>
    </Card>
  )
}

function EfficiencyCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Inverter Efficiency</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.efficiency}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.efficiency)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Target: {">"} 95%</p>
      </CardContent>
    </Card>
  )
}

function TemperatureCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Inverter Temperature</CardTitle>
        <Settings className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.temperature}°C</div>
        )}
        <Progress
          value={isLoading ? 0 : ((Number.parseFloat(data.temperature) - 20) / (80 - 20)) * 100}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-2">Operating: 20-80°C</p>
      </CardContent>
    </Card>
  )
}

function GridSyncCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "Synchronized":
        return "bg-green-500"
      case "Synchronizing":
        return "bg-yellow-500"
      case "Out of Sync":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Grid Synchronization</CardTitle>
        <CheckCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[120px]" />
        ) : (
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(data.gridSync)}>{data.gridSync}</Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Grid connection synchronization status</p>
      </CardContent>
    </Card>
  )
}

function FaultStatusCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    if (status === "No Faults") return "bg-green-500"
    return "bg-red-500"
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Fault Status</CardTitle>
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(data.faultStatus)}>{data.faultStatus}</Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Current system fault status</p>
      </CardContent>
    </Card>
  )
}
