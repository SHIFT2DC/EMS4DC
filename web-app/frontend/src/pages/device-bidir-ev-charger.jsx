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

File: device-bidir-ev-charger.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Battery, Zap, Clock, Plug, Activity, Users, DollarSign, ArrowLeftRight, Home, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function BidirectionalChargerDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    chargerStatus: "Available",
    currentPower: 0,
    maxPower: 22,
    powerDirection: "Idle", // "Charging", "Discharging", "Idle"
    sessionTime: 0,
    energyTransferred: 0,
    chargingEfficiency: 0,
    queueLength: 0,
    dailyRevenue: 0,
    dailyEnergyCharged: 0,
    dailyEnergyDischarged: 0,
    averageSessionTime: 0,
    batteryLevel: 0,
    vehicleConnected: false,
    estimatedTimeRemaining: 0,
    gridDemand: 0,
    v2gRevenue: 0,
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

        // Generate mock data for bidirectional charger
        const isActive = Math.random() > 0.5
        const isAvailable = Math.random() > 0.3
        const status = isActive ? "Active" : isAvailable ? "Available" : "Offline"
        const directions = ["Charging", "Discharging", "Idle"]
        const powerDirection = status === "Active" ? directions[Math.floor(Math.random() * 2)] : "Idle"

        setData({
          chargerStatus: status,
          currentPower: status === "Active" ? 10 + Math.random() * 12 : 0,
          maxPower: 22,
          powerDirection: powerDirection,
          sessionTime: jsonData.SESSION_TIME || (status === "Active" ? Math.floor(Math.random() * 120) : 0),
          energyTransferred: jsonData.ENERGY_TRANSFERRED || (status === "Active" ? (Math.random() * 30).toFixed(1) : 0),
          chargingEfficiency: jsonData.EFFICIENCY || (status === "Active" ? (90 + Math.random() * 8).toFixed(1) : 0),
          queueLength: jsonData.QUEUE_LENGTH || Math.floor(Math.random() * 2),
          dailyRevenue: jsonData.DAILY_REVENUE || (Math.random() * 200).toFixed(2),
          dailyEnergyCharged: jsonData.DAILY_ENERGY_CHARGED || (Math.random() * 80).toFixed(1),
          dailyEnergyDischarged: jsonData.DAILY_ENERGY_DISCHARGED || (Math.random() * 40).toFixed(1),
          averageSessionTime: jsonData.AVG_SESSION_TIME || (60 + Math.random() * 90).toFixed(0),
          batteryLevel: status === "Active" ? 20 + Math.random() * 60 : 0,
          vehicleConnected: status === "Active",
          estimatedTimeRemaining: status === "Active" ? Math.floor(Math.random() * 120) : 0,
          gridDemand: (Math.random() * 100).toFixed(0),
          v2gRevenue: (Math.random() * 50).toFixed(2),
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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Plug className="h-8 w-8 text-blue-600" />
          <ArrowLeftRight className="h-6 w-6 text-purple-600" />
          <Battery className="h-8 w-8 text-green-600" />
          <Home className="h-8 w-8 text-orange-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Bidirectional Charger Dashboard</h1>
          <p className="text-muted-foreground">Vehicle-to-Grid (V2G) enabled charging</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ChargerStatusCard data={data} isLoading={isLoading} />
        <PowerFlowCard data={data} isLoading={isLoading} />
        <BatteryLevelCard data={data} isLoading={isLoading} />
        <SessionInfoCard data={data} isLoading={isLoading} />
        <EnergyTransferCard data={data} isLoading={isLoading} />
        <EfficiencyCard data={data} isLoading={isLoading} />
        <GridDemandCard data={data} isLoading={isLoading} />
        <RevenueCard data={data} isLoading={isLoading} />
        <V2GRevenueCard data={data} isLoading={isLoading} />
        <DailyEnergyStatsCard data={data} isLoading={isLoading} />
        <QueueStatusCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  )
}

function ChargerStatusCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-500"
      case "Available":
        return "bg-blue-500"
      case "Offline":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getDirectionColor = (direction) => {
    switch (direction) {
      case "Charging":
        return "bg-blue-500"
      case "Discharging":
        return "bg-orange-500"
      case "Idle":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Charger Status</CardTitle>
        <Plug className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getStatusColor(data.chargerStatus)} variant="secondary">
              {data.chargerStatus}
            </Badge>
            <Badge className={getDirectionColor(data.powerDirection)} variant="secondary">
              {data.powerDirection}
            </Badge>
            {data.vehicleConnected && <Badge variant="outline">Vehicle Connected</Badge>}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {data.powerDirection === "Charging"
            ? "Charging vehicle battery"
            : data.powerDirection === "Discharging"
              ? "Supplying power to grid"
              : "Ready for bidirectional operation"}
        </p>
      </CardContent>
    </Card>
  )
}

function PowerFlowCard({ data, isLoading }) {
  const isDischarging = data.powerDirection === "Discharging"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Power Flow</CardTitle>
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">
            {isDischarging ? "-" : ""}
            {data.currentPower.toFixed(1)} kW
          </div>
        )}
        <Progress
          value={isLoading ? 0 : (Math.abs(data.currentPower) / data.maxPower) * 100}
          className={`mt-2 ${isDischarging ? "[&>div]:bg-orange-500" : ""}`}
        />
        <p className="text-xs text-muted-foreground mt-2">
          {isDischarging ? "Discharging to grid" : "Charging from grid"} • Max: ±{data.maxPower} kW
        </p>
      </CardContent>
    </Card>
  )
}

function BatteryLevelCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Vehicle Battery</CardTitle>
        <Battery className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.batteryLevel.toFixed(0)}%</div>
        )}
        <Progress value={isLoading ? 0 : data.batteryLevel} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">
          {data.estimatedTimeRemaining > 0 ? `${data.estimatedTimeRemaining}m remaining` : "No active session"}
        </p>
      </CardContent>
    </Card>
  )
}

function SessionInfoCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Session Info</CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center">
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-xl font-bold">{data.sessionTime}m</div>
            )}
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <div className="text-xl font-bold">{data.averageSessionTime}m</div>
            )}
            <p className="text-xs text-muted-foreground">Average</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EnergyTransferCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Energy Transferred</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.energyTransferred} kWh</div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Energy transferred this session</p>
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
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.chargingEfficiency}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.chargingEfficiency)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Bidirectional conversion efficiency</p>
      </CardContent>
    </Card>
  )
}

function GridDemandCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Grid Demand</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.gridDemand}%</div>
        )}
        <Progress value={isLoading ? 0 : Number.parseFloat(data.gridDemand)} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Current grid demand level</p>
      </CardContent>
    </Card>
  )
}

function RevenueCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Daily Charging Revenue</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">${data.dailyRevenue}</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.dailyRevenue) / 250) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Target: $250/day</p>
      </CardContent>
    </Card>
  )
}

function V2GRevenueCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">V2G Revenue</CardTitle>
        <Home className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">${data.v2gRevenue}</div>
        )}
        <Progress value={isLoading ? 0 : (Number.parseFloat(data.v2gRevenue) / 75) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Grid services revenue today</p>
      </CardContent>
    </Card>
  )
}

function DailyEnergyStatsCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Daily Energy Flow</CardTitle>
        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Charged:</span>
            {isLoading ? (
              <Skeleton className="h-5 w-[60px]" />
            ) : (
              <span className="font-semibold text-blue-600">{data.dailyEnergyCharged} kWh</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Discharged:</span>
            {isLoading ? (
              <Skeleton className="h-5 w-[60px]" />
            ) : (
              <span className="font-semibold text-orange-600">{data.dailyEnergyDischarged} kWh</span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Net energy flow today</p>
      </CardContent>
    </Card>
  )
}

function QueueStatusCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[60px]" />
        ) : (
          <div className="text-2xl font-bold">{data.queueLength}</div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {data.queueLength === 0 ? "No vehicles waiting" : `${data.queueLength} vehicle(s) waiting`}
        </p>
      </CardContent>
    </Card>
  )
}
