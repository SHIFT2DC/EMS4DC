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

File: device-solar-panels.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Sun, Battery, Zap, Activity, ToggleLeft, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

export default function SolarPanels() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    totalPower: 0,
    voltage: 0,
    current: 0,
    dcBusVoltage: 0,
    dcBusCurrent: 0,
    dailyEnergy: 0,
    efficiency: 0,
    temperature: 0,
    mode: "Normal",
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
          totalPower: (Math.abs(jsonData.PV_POWER) / 1000).toFixed(2),
          voltage: jsonData.PV_VOLTAGE_PV_SIDE.toFixed(1),
          current: jsonData.PV_CURRENT_PV_SIDE.toFixed(1),
          dcBusVoltage: jsonData.PV_VOLTAGE_BUS_SIDE.toFixed(1),
          dcBusCurrent: jsonData.PV_CURRENT_BUS_SIDE.toFixed(1),
          dailyEnergy: jsonData.PV_DAILY_ENERGY.toFixed(1),
          efficiency: ((Math.abs(jsonData.PV_CURRENT_BUS_SIDE) * jsonData.PV_VOLTAGE_BUS_SIDE) / (jsonData.PV_VOLTAGE_PV_SIDE * Math.abs(jsonData.PV_CURRENT_PV_SIDE)) * 100).toFixed(1),
          temperature: jsonData.PV_PCS_TEMP.toFixed(1),
          mode: jsonData.PV_OPER_MODE,
        })
        setError(null)
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
      <h1 className="text-3xl font-bold mb-6">Solar Panel Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PowerCard data={data} isLoading={isLoading} />
        <VoltageCurrentCard data={data} isLoading={isLoading} title="PV Side" type="pv" />
        <VoltageCurrentCard data={data} isLoading={isLoading} title="DC Bus Side" type="dcbus" />
        {/* <EnergyCard data={data} isLoading={isLoading} /> */}
        <EfficiencyCard data={data} isLoading={isLoading} />
        <TemperatureCard data={data} isLoading={isLoading} />
        <ModeCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  )
}

function PowerCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Power Output</CardTitle>
        <Sun className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.totalPower} kW</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.totalPower) / 17) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Max: 17 kW</p>
      </CardContent>
    </Card>
  )
}

function VoltageCurrentCard({ data, isLoading, title, type }) {
  const voltage = type === 'pv' ? data.voltage : data.dcBusVoltage
  const current = type === 'pv' ? data.current : data.dcBusCurrent
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title} - Voltage & Current</CardTitle>
        {type === 'pv' ? <Sun className="h-4 w-4 text-muted-foreground" /> : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-xl font-bold">{voltage} V</div>
            )}
            <p className="text-xs text-muted-foreground">Voltage</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-xl font-bold">{current} A</div>
            )}
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EnergyCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Daily Energy Production</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.dailyEnergy} kWh</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.dailyEnergy) / 50) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Goal: 50 kWh/day</p>
      </CardContent>
    </Card>
  )
}

function EfficiencyCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">System Efficiency</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.efficiency}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.efficiency)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Target: 95-100%</p>
      </CardContent>
    </Card>
  )
}

function TemperatureCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">PCS Temperature</CardTitle>
        <Sun className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.temperature}°C</div>
        )}
        <Progress
          value={isLoading ? 0 : ((Number.parseFloat(data.temperature) - 20) / (70 - 20)) * 100}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-2">Optimal: 20-70°C</p>
      </CardContent>
    </Card>
  )
}

function ModeCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Operating Mode</CardTitle>
        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-9 w-[100px]" /> : <div className="text-2xl font-bold">{data.mode}</div>}
        <p className="text-xs text-muted-foreground mt-2">Current system operating mode</p>
      </CardContent>
    </Card>
  )
}