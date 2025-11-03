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

File: device-energy-storage-system.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Battery, Zap, Activity, Thermometer, Power, Gauge, Shield, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

export default function StorageSystems() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    batteryLevel: 0,
    voltage: 0,
    current: 0,
    power: 0,
    temperature: 0,
    cycleCount: 0,
    health: 0,
    timeRemaining: 0,
    chargingState: "Idle",
    capacity: 0,
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
          batteryLevel: jsonData.SOC || 75,
          voltage: (jsonData.BESS_Voltage || 48.2).toFixed(1),
          current: (jsonData.BESS_Current || 12.5).toFixed(1),
          power: (jsonData.BESS_Power / 1000 || 0.6).toFixed(2),
          temperature: (jsonData.BESS_Temperature || 25).toFixed(1),
          cycleCount: jsonData.BESS_Cycles || 1247,
          health: jsonData.BESS_Health || 98.5,
          timeRemaining: jsonData.BESS_TimeRemaining || 8.2,
          chargingState: jsonData.BESS_State || "Charging",
          capacity: (jsonData.BESS_Capacity || 10).toFixed(1),
        })
        setError("S.D.")
      } catch (error) {
        console.error("Error fetching BESS data:", error)
        // Use mock data for demonstration
        setData({
          batteryLevel: 75,
          voltage: "48.2",
          current: "12.5",
          power: "0.60",
          temperature: "25.0",
          cycleCount: 1247,
          health: 98.5,
          timeRemaining: 8.2,
          chargingState: "Charging",
          capacity: "10.0",
        })
        setError("Using demo data - API not available")
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
      <h1 className="text-3xl font-bold mb-6">Battery Energy Storage System</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BatteryLevelCard data={data} isLoading={isLoading} />
        <VoltageCurrentCard data={data} isLoading={isLoading} />
        <PowerCard data={data} isLoading={isLoading} />
        <TemperatureCard data={data} isLoading={isLoading} />
        <HealthCard data={data} isLoading={isLoading} />
        <CycleCountCard data={data} isLoading={isLoading} />
        <TimeRemainingCard data={data} isLoading={isLoading} />
        <ChargingStateCard data={data} isLoading={isLoading} />
        <CapacityCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-yellow-600">Notice: {error}</div>}
    </div>
  )
}

function BatteryLevelCard({ data, isLoading }) {
  const getColorClass = (level) => {
    if (level > 80) return "text-green-600"
    if (level > 40) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Battery Level</CardTitle>
        <Battery className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className={`text-2xl font-bold ${getColorClass(data.batteryLevel)}`}>
            {data.batteryLevel}%
          </div>
        )}
        <Progress value={isLoading ? 0 : data.batteryLevel} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">State of Charge (SOC)</p>
      </CardContent>
    </Card>
  )
}

function VoltageCurrentCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Voltage & Current</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-xl font-bold">{data.voltage} V</div>
            )}
            <p className="text-xs text-muted-foreground">Voltage</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-xl font-bold">{data.current} A</div>
            )}
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PowerCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Power</CardTitle>
        <Power className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.power} kW</div>
        )}
        <Progress 
          value={isLoading ? 0 : Math.abs(Number.parseFloat(data.power) / 10) * 100} 
          className="mt-2" 
        />
        <p className="text-xs text-muted-foreground mt-2">
          {Number.parseFloat(data.power) > 0 ? "Discharging" : "Charging"}
        </p>
      </CardContent>
    </Card>
  )
}

function TemperatureCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Temperature</CardTitle>
        <Thermometer className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.temperature}°C</div>
        )}
        <Progress
          value={isLoading ? 0 : ((Number.parseFloat(data.temperature) - 10) / (50 - 10)) * 100}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-2">Optimal: 15-35°C</p>
      </CardContent>
    </Card>
  )
}

function HealthCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Battery Health</CardTitle>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.health}%</div>
        )}
        <Progress value={isLoading ? 0 : data.health} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">State of Health (SOH)</p>
      </CardContent>
    </Card>
  )
}

function CycleCountCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Cycle Count</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.cycleCount}</div>
        )}
        <Progress value={isLoading ? 0 : (data.cycleCount / 5000) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Rated: 5000 cycles</p>
      </CardContent>
    </Card>
  )
}

function TimeRemainingCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.timeRemaining}h</div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {Number.parseFloat(data.power) > 0 ? "Until empty" : "Until full"}
        </p>
      </CardContent>
    </Card>
  )
}

function ChargingStateCard({ data, isLoading }) {
  const getStateColor = (state) => {
    switch (state) {
      case "Charging": return "text-green-600"
      case "Discharging": return "text-blue-600"
      case "Idle": return "text-gray-600"
      default: return "text-gray-600"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Charging State</CardTitle>
        <Gauge className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className={`text-2xl font-bold ${getStateColor(data.chargingState)}`}>
            {data.chargingState}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Current operation mode</p>
      </CardContent>
    </Card>
  )
}

function CapacityCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
        <Battery className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.capacity} kWh</div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Usable energy capacity</p>
      </CardContent>
    </Card>
  )
}