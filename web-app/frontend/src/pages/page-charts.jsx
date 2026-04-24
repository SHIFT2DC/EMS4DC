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
limitations under the License.

@File: page-charts.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 18 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/


import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area } from "recharts"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"

// Color palette for different asset types
const ASSET_COLORS = {
  'PV': '#b9b726',
  'ActiveFrontEnd': '#10b981',
  'BESS': '#f97316',
  'Load': '#3b82f6',
  'Critical Load': '#ef4444',
  'V1G EV Charger': '#8b5cf6',
  'V2G EV Charger': '#ec4899',
  'Wind Generator': '#06b6d4'
}

function ChartSkeleton({ height = 400 }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className={`w-full`} style={{ height: `${height}px` }} />
          <div className="flex gap-4 justify-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Charts() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [chartData, setChartData] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDataForDate(selectedDate)
  }, [selectedDate])

  const fetchDataForDate = async (date) => {
    setLoading(true)
    try {
      const formattedDate = format(date, "yyyy-MM-dd")
      const { data } = await api.get(`/api/chart-data?date=${formattedDate}`)
      setChartData(data.chartData || [])
      setAssets(data.assets || [])
    } catch (error) {
      console.error("Error fetching chart data:", error)
      setChartData([])
      setAssets([])
    } finally {
      setLoading(false)
    }
  }

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  // Group assets by category for different charts
  const energyGenerationAssets = assets.filter(a =>
    a.type === 'PV' || a.type === 'WIND'
  )

  const storageAssets = assets.filter(a => a.type === 'BESS')

  const gridAssets = assets.filter(a => a.type === 'AFE')

  const loadAssets = assets.filter(a =>
    a.type === 'LOAD' || a.type === 'CRITICAL_LOAD'
  )

  const evChargerAssets = assets.filter(a =>
    a.type === 'UNI_EV' || a.type === 'BI_EV'
  )

  // All assets for combined chart
  const allAssets = assets

  const renderChart = (title, assetsList, height = 400) => {
    if (assetsList.length === 0) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title} - {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis label={{ value: "Power (kW)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />

              {/* Render historical data lines */}
              {assetsList.map((asset, index) => {
                const color = ASSET_COLORS[asset.type] || `hsl(${index * 60}, 70%, 50%)`

                return (
                  <Line
                    key={asset.asset_key}
                    type="monotone"
                    dataKey={asset.name}
                    stroke={color}
                    strokeWidth={2}
                    name={asset.name}
                    dot={{ r: 3 }}
                  />
                )
              })}

              {/* Render forecast lines */}
              {assetsList.map((asset, index) => {
                const color = ASSET_COLORS[asset.type] || `hsl(${index * 60}, 70%, 50%)`
                const forecastKey = `${asset.name} (Forecast)`

                return (
                  <Line
                    key={`${asset.asset_key}-forecast`}
                    type="monotone"
                    dataKey={forecastKey}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name={`${asset.name} (Forecast)`}
                    dot={{ r: 2 }}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 space-y-6">
      <h1 className="text-4xl font-bold mt-8">Power Flow Charts</h1>

      <div className="flex items-center space-x-4">
        <Button onClick={handlePreviousDay} variant="outline" size="icon">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button onClick={handleNextDay} variant="outline" size="icon">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <ChartSkeleton height={500} />
          <ChartSkeleton height={400} />
          <ChartSkeleton height={400} />
          <ChartSkeleton height={400} />
          <ChartSkeleton height={400} />
          <ChartSkeleton height={400} />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-10">No active assets found</div>
      ) : (
        <>
          {/* Combined Overview Chart */}
          {renderChart("Combined Power Flow", allAssets, 500)}

          {/* Individual Category Charts */}
          {renderChart("Energy Generation", energyGenerationAssets)}
          {renderChart("Battery Storage", storageAssets)}
          {renderChart("Grid Connection", gridAssets)}
          {renderChart("Loads", loadAssets)}
          {renderChart("EV Chargers", evChargerAssets)}
        </>
      )}
    </div>
  )
}

export default Charts