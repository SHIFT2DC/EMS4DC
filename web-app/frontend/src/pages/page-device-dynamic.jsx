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

@File: page-device-dynamic.jsx
@Description: # TODO: Add desc

@Created: 1st February 2026
@Last Modified: 20 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
*/


import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft, RefreshCw, AlertCircle, Battery, Sun, Plug,
  Car, Zap, Wind, Grid3x3, Activity
} from "lucide-react"
import api from "@/lib/axios"

const ASSET_TYPE_CONFIG = {
  PV: {
    label: "Solar PV",
    icon: Sun,
    color: "bg-yellow-100 text-yellow-800",
    gradientFrom: "from-yellow-400",
    gradientTo: "to-yellow-600"
  },
  BESS: {
    label: "Battery Storage",
    icon: Battery,
    color: "bg-green-100 text-green-800",
    gradientFrom: "from-green-400",
    gradientTo: "to-green-600"
  },
  LOAD: {
    label: "Load",
    icon: Plug,
    color: "bg-gray-100 text-gray-800",
    gradientFrom: "from-gray-400",
    gradientTo: "to-gray-600"
  },
  CRITICAL_LOAD: {
    label: "Critical Load",
    icon: AlertCircle,
    color: "bg-red-100 text-red-800",
    gradientFrom: "from-red-400",
    gradientTo: "to-red-600"
  },
  UNI_EV: {
    label: "Unidirectional EV",
    icon: Car,
    color: "bg-blue-100 text-blue-800",
    gradientFrom: "from-blue-400",
    gradientTo: "to-blue-600"
  },
  BI_EV: {
    label: "Bidirectional EV",
    icon: Zap,
    color: "bg-purple-100 text-purple-800",
    gradientFrom: "from-purple-400",
    gradientTo: "to-purple-600"
  },
  WIND: {
    label: "Wind Generator",
    icon: Wind,
    color: "bg-teal-100 text-teal-800",
    gradientFrom: "from-teal-400",
    gradientTo: "to-teal-600"
  },
  GRID: {
    label: "Grid Connection",
    icon: Grid3x3,
    color: "bg-orange-100 text-orange-800",
    gradientFrom: "from-orange-400",
    gradientTo: "to-orange-600"
  },
  AFE: {
    label: "Active Front End",
    icon: Activity,
    color: "bg-indigo-100 text-indigo-800",
    gradientFrom: "from-indigo-400",
    gradientTo: "to-indigo-600"
  }
}

function DeviceDynamicPage() {
  const { assetKey } = useParams()
  const navigate = useNavigate()

  const [asset, setAsset] = useState(null)
  const [readings, setReadings] = useState({})
  const [readParameters, setReadParameters] = useState([])
  const [writeParameters, setWriteParameters] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const loadDeviceData = async () => {
    try {
      setError(null)
      const { data } = await api.get(`/api/device/${assetKey}`)
      setAsset(data.asset)
      setReadParameters(data.readParameters)
      setWriteParameters(data.writeParameters)
      setReadings(data.readings)
      setLastUpdate(new Date(data.timestamp))
    } catch (err) {
      console.error("Error loading device data:", err)
      if (err.response?.status === 404) {
        setError("Device not found")
      } else {
        setError(`Failed to load device data: ${err.response?.status ?? err.message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDeviceData()

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadDeviceData, 5000)
    return () => clearInterval(interval)
  }, [assetKey])

  if (isLoading) {
    return <DevicePageSkeleton />
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="py-10">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate("/")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!asset) {
    return null
  }

  const typeConfig = ASSET_TYPE_CONFIG[asset.type] || ASSET_TYPE_CONFIG.LOAD
  const Icon = typeConfig.icon

  // Group read parameters by category
  const groupedReadParams = groupParametersByCategory(readParameters)
  // Group write parameters by category
  const groupedWriteParams = groupParametersByCategory(writeParameters)

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <div className={`p-3 rounded-xl bg-gradient-to-br ${typeConfig.gradientFrom} ${typeConfig.gradientTo} text-white`}>
                <Icon className="h-8 w-8" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{asset.name}</CardTitle>
                  <Badge className={typeConfig.color}>
                    {typeConfig.label}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    {asset.asset_key}
                  </Badge>
                </div>
                <CardDescription>
                  {lastUpdate && `Last updated: ${lastUpdate.toLocaleTimeString()}`}
                </CardDescription>
              </div>
            </div>

            <Button onClick={loadDeviceData} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics - Highlighted */}
      {readings.POWER !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Power Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">
                {formatValue(readings.POWER, findParameter(readParameters, 'POWER'))}
              </div>
              <div className={`text-sm font-semibold ${
                readings.POWER > 10 ? 'text-green-600' :
                readings.POWER < -10 ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {readings.POWER > 10 ? '↓ Supplying Power' :
                 readings.POWER < -10 ? '↑ Consuming Power' :
                 'Idle'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Read Parameters */}
      {readParameters.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-700">Read Parameters</h2>
            <div className="flex-1 h-px bg-gray-200" />
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
              {readParameters.length} parameters
            </Badge>
          </div>

          {Object.keys(groupedReadParams).map(category => (
            <Card key={category} className="border-l-4 border-l-blue-400">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-600">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedReadParams[category].map(param => (
                    <ParameterCard
                      key={param.id}
                      parameter={param}
                      value={readings[param.name]}
                      mode="read"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Write Parameters */}
      {writeParameters.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-700">Write Parameters</h2>
            <div className="flex-1 h-px bg-gray-200" />
            <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
              {writeParameters.length} parameters
            </Badge>
          </div>

          {Object.keys(groupedWriteParams).map(category => (
            <Card key={category} className="border-l-4 border-l-orange-400">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-600">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedWriteParams[category].map(param => (
                    <ParameterCard
                      key={param.id}
                      parameter={param}
                      value={readings[param.name]}
                      mode="write"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Parameters Message */}
      {readParameters.length === 0 && writeParameters.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No parameters configured for this device. Configure Modbus parameters in Settings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ParameterCard({ parameter, value, mode }) {
  const isActive = value !== undefined && value !== null
  const isWrite = mode === 'write'

  return (
    <div className={`p-4 rounded-lg border-2 ${
      isWrite
        ? 'bg-orange-50 border-orange-200'
        : isActive
          ? 'bg-white border-blue-200'
          : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="text-sm text-gray-600 mb-1 font-mono">
        {parameter.name}
      </div>
      <div className="text-2xl font-bold mb-1">
        {isActive ? formatValue(value, parameter) : '—'}
      </div>
      {parameter.description && (
        <div className="text-xs text-gray-500 mt-1">
          {parameter.description}
        </div>
      )}
    </div>
  )
}

function DevicePageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-14 w-14 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper functions
function formatValue(value, parameter) {
  if (value === undefined || value === null) return '—'

  const numValue = Number(value)
  if (isNaN(numValue)) return value

  const decimals = parameter?.decimalPlaces ?? 2
  const formatted = numValue.toFixed(decimals)
  const unit = parameter?.unit || ''

  return `${formatted} ${unit}`.trim()
}

function findParameter(parameters, name) {
  return parameters.find(p => p.name === name)
}

function groupParametersByCategory(parameters) {
  const categories = {
    'Electrical Measurements': [],
    'Status & State': [],
    'Environmental': [],
    'Other': []
  }

  parameters.forEach(param => {
    const name = param.name.toUpperCase()

    if (name.includes('VOLTAGE') || name.includes('CURRENT') ||
        name.includes('POWER') || name.includes('FREQUENCY')) {
      categories['Electrical Measurements'].push(param)
    } else if (name.includes('SOC') || name.includes('STATE') ||
               name.includes('STATUS') || name.includes('MODE')) {
      categories['Status & State'].push(param)
    } else if (name.includes('TEMP') || name.includes('WIND') ||
               name.includes('IRRAD')) {
      categories['Environmental'].push(param)
    } else {
      categories['Other'].push(param)
    }
  })

  // Remove empty categories
  return Object.fromEntries(
    Object.entries(categories).filter(([_, params]) => params.length > 0)
  )
}

export default DeviceDynamicPage