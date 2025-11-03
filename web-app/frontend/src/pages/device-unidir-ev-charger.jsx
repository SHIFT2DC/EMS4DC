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

File: device-unidir-ev-charger.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Battery, Zap, Clock, Plug, Activity, Users, DollarSign, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function UnidirectionalChargerDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    chargerStatus: "Available",
    currentPower: 0,
    maxPower: 22,
    sessionTime: 0,
    energyDelivered: 0,
    chargingEfficiency: 0,
    queueLength: 0,
    dailyRevenue: 0,
    dailyEnergyDelivered: 0,
    averageSessionTime: 0,
    chargingProgress: 0,
    vehicleConnected: false,
    estimatedTimeRemaining: 0,
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

        // Generate mock data for unidirectional charger
        const isCharging = (jsonData.EV1_POWER / 1000).toFixed(1) > 0
        const isAvailable = (jsonData.EV1_POWER / 1000).toFixed(1) == 0
        const status = isCharging ? "Charging" : isAvailable ? "Available" : "Offline"

        setData({
          chargerStatus: status,
          currentPower: jsonData.EV1_POWER / 1000,
          maxPower: (jsonData.EV1_CAR_MAX_POWER / 1000).toFixed(1),
          chargingProgress: status === "Charging" ? (jsonData.EV1_SoC) : 0,
          vehicleConnected: status === "Charging",
          estimatedTimeRemaining: status === "Charging" ? Math.floor(Math.random() * 90) : 0,
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
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Plug className="h-8 w-8 text-blue-600" />
          <ArrowRight className="h-6 w-6 text-gray-400" />
          <Battery className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Unidirectional Charger Dashboard</h1>
          <p className="text-muted-foreground">AC to DC charging only</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ChargerStatusCard data={data} isLoading={isLoading} />
        <CurrentPowerCard data={data} isLoading={isLoading} />
        <ChargingProgressCard data={data} isLoading={isLoading} />
      </div>
      {error && <div className="mt-4 text-red-500">Error: {error}</div>}
    </div>
  )
}

function ChargerStatusCard({ data, isLoading }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "Charging":
        return "bg-green-500"
      case "Available":
        return "bg-blue-500"
      case "Offline":
        return "bg-red-500"
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
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(data.chargerStatus)} variant="secondary">
              {data.chargerStatus}
            </Badge>
            {data.vehicleConnected && <Badge variant="outline">Vehicle Connected</Badge>}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {data.chargerStatus === "Charging"
            ? "Actively charging vehicle"
            : data.chargerStatus === "Available"
              ? "Ready for charging"
              : "Maintenance required"}
        </p>
      </CardContent>
    </Card>
  )
}

function CurrentPowerCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Current Power Output</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{data.currentPower.toFixed(1)} kW</div>
        )}
        <Progress value={isLoading ? 0 : (data.currentPower / data.maxPower) * 100} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">Max: {data.maxPower} kW</p>
      </CardContent>
    </Card>
  )
}

function ChargingProgressCard({ data, isLoading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Charging Progress</CardTitle>
        <Battery className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-[80px]" />
        ) : (
          <div className="text-2xl font-bold">{data.chargingProgress.toFixed(0)}%</div>
        )}
        <Progress value={isLoading ? 0 : data.chargingProgress} className="mt-2" />
        <p className="text-xs text-muted-foreground mt-2">
          {data.estimatedTimeRemaining > 0 ? `${data.estimatedTimeRemaining}m remaining` : "No active session"}
        </p>
      </CardContent>
    </Card>
  )
}



