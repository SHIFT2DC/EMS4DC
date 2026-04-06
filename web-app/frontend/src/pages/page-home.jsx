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

@File: page-home.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 23 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
*/


import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Battery, Car, Plug, Sun, Zap, Wind, Grid3x3, RefreshCw } from "lucide-react"
import PowerFlow from "../components/PowerFlow"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import api from "@/lib/axios"

const DEVICE_TYPE_ICONS = {
  PV: Sun,
  BESS: Battery,
  LOAD: Plug,
  CRITICAL_LOAD: Plug,
  UNI_EV: Car,
  BI_EV: Zap,
  WIND: Wind,
  AFE: Grid3x3
}

const getFlowLabels = (type) => {
  if (type === "AFE")                        return { supply: "Importing", consume: "Exporting" }
  if (type === "BI_EV" || type === "BESS")   return { supply: "Discharging", consume: "Charging" }
  return                                            { supply: "Supplying", consume: "Consuming" }
}

const DEVICE_TYPE_COLORS = {
  PV: "bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100",
  BESS: "bg-green-50 border-green-300 text-green-700 hover:bg-green-100",
  LOAD: "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100",
  CRITICAL_LOAD: "bg-red-50 border-red-300 text-red-700 hover:bg-red-100",
  UNI_EV: "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100",
  BI_EV: "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100",
  WIND: "bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100",
  AFE: "bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
}

function DeviceCardSkeleton() {
  return (
    <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 shadow-lg min-w-[140px]">
      <div className="flex justify-center mb-3">
        <Skeleton className="w-16 h-16 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-24 mx-auto mb-2" />
      <Skeleton className="h-8 w-16 mx-auto mb-1" />
      <Skeleton className="h-3 w-20 mx-auto" />
    </div>
  )
}

function TopologyDiagramSkeleton() {
  return (
    <div className="flex gap-4 w-full">
      <div className="flex-1 bg-white rounded-xl shadow-xl p-4 md:p-6 border-2 border-gray-200">
        <div className="flex justify-evenly mb-8">
          {[1, 2, 3, 4].map((i) => <DeviceCardSkeleton key={`top-${i}`} />)}
        </div>
        <div className="relative my-16">
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
        <div className="flex justify-evenly mt-8">
          {[1, 2, 3, 4].map((i) => <DeviceCardSkeleton key={`bottom-${i}`} />)}
        </div>
      </div>
      {/* Stats sidebar skeleton */}
      <div className="w-52 flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-lg p-5 border-2 border-gray-200">
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const containerRef = useRef(null)
  const busRef = useRef(null)
  const deviceRefs = useRef({})
  const [connectors, setConnectors] = useState([])

  const loadDevices = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/api/home')
      const transformedDevices = data.assets.map(asset => ({
        id: asset.id,
        type: asset.type,
        name: asset.name,
        power: asset.power || 0,
        asset_key: asset.asset_key
      }))
      setDevices(transformedDevices)
      setLastUpdate(new Date(data.timestamp))
    } catch (err) {
      console.error("Error loading devices:", err)
      setError(err.response?.data?.message ?? err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 5000)
    return () => clearInterval(interval)
  }, [])

  const topDevices = devices.slice(0, Math.ceil(devices.length / 2))
  const bottomDevices = devices.slice(Math.ceil(devices.length / 2))

  const computeConnectors = () => {
    const container = containerRef.current
    const bus = busRef.current
    if (!container || !bus) return

    const cRect = container.getBoundingClientRect()
    const busRect = bus.getBoundingClientRect()

    const busTop = busRect.top - cRect.top
    const busBottom = busRect.bottom - cRect.top

    const results = []

    const computeFor = (list, isTopRow) => {
      list.forEach((dev) => {
        const node = deviceRefs.current[dev.id]
        if (!node) return
        const dRect = node.getBoundingClientRect()
        const devCenterX = dRect.left + dRect.width / 2 - cRect.left
        const devTop = dRect.top - cRect.top
        const devBottom = dRect.bottom - cRect.top

        const startX = devCenterX
        const startY = isTopRow ? devBottom : devTop
        const endX = devCenterX
        const endY = isTopRow ? busTop : busBottom

        const direction = dev.power > 0 ? "inward" : dev.power < 0 ? "outward" : "idle"

        results.push({ id: dev.id, x1: startX, y1: startY, x2: endX, y2: endY, direction })
      })
    }

    computeFor(topDevices, true)
    computeFor(bottomDevices, false)

    setConnectors(results)
  }

  useEffect(() => {
    computeConnectors()
    const ro = new ResizeObserver(() => computeConnectors())
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener("scroll", computeConnectors, true)
    window.addEventListener("resize", computeConnectors)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", computeConnectors, true)
      window.removeEventListener("resize", computeConnectors)
    }
  }, [devices])

  const setDeviceRef = (id, node) => {
    if (!node) {
      delete deviceRefs.current[id]
    } else {
      deviceRefs.current[id] = node
    }
  }

  const handleDeviceClick = (assetKey) => {
    navigate(`/device/${assetKey}`)
  }

  if (isLoading && devices.length === 0) {
    return (
      <div className="relative min-h-screen p-4 md:p-6">
        <div className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-80 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="max-w-7xl mx-auto">
          <TopologyDiagramSkeleton />
        </div>
      </div>
    )
  }

  const totalGeneration = devices
    .filter((d) => d.power > 0)
    .reduce((sum, d) => sum + d.power / 1000, 0)
    .toFixed(1)

  const totalConsumption = Math.abs(
    devices.filter((d) => d.power < 0).reduce((sum, d) => sum + d.power / 1000, 0)
  ).toFixed(1)

  const netPower = devices.reduce((sum, d) => sum + d.power / 1000, 0).toFixed(1)

  return (
    <div className="relative p-4 md:p-6">
      {/* Header */}
      <div className="max-w-[1600px] mx-auto mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">EMS | Building Demo Installation</h1>
          {lastUpdate && (
            <p className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={loadDevices} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-[1600px] mx-auto mb-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* No devices */}
      {!isLoading && devices.length === 0 && (
        <div className="max-w-[1600px] mx-auto">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No assets configured. Please go to Settings to add devices to your site.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main content: diagram + sidebar stats side by side */}
      {devices.length > 0 && (
        <div className="max-w-[1600px] mx-auto flex gap-4 items-stretch">

          {/* Topology Diagram — grows to fill available space */}
          <div
            ref={containerRef}
            className="flex-1 min-w-0 bg-white rounded-xl shadow-xl p-4 md:p-6 border-2 border-gray-200 relative"
          >
            {/* Top Row */}
            <div className="flex justify-evenly mb-8">
              {topDevices.map((device) => (
                <div key={device.id} ref={(el) => setDeviceRef(device.id, el)}>
                  <DeviceCard device={device} onClick={() => handleDeviceClick(device.asset_key)} />
                </div>
              ))}
            </div>

            {/* DC Bus */}
            <div className="relative my-16">
              <div
                ref={busRef}
                className="h-12 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 rounded-lg shadow-lg flex items-center justify-center"
              >
                <span className="text-white font-bold text-xl tracking-wider">DC BUS</span>
              </div>
            </div>

            {/* SVG connectors */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height="100%"
              style={{ overflow: "visible" }}
            >
              {connectors.map((c) => (
                <PowerFlow key={c.id} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} direction={c.direction} />
              ))}
            </svg>

            {/* Bottom Row */}
            <div className="flex justify-evenly mt-8">
              {bottomDevices.map((device) => (
                <div key={device.id} ref={(el) => setDeviceRef(device.id, el)}>
                  <DeviceCard device={device} onClick={() => handleDeviceClick(device.asset_key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Statistics Sidebar */}
          <div className="w-52 shrink-0 flex flex-col gap-4">
            <div className="bg-white rounded-xl shadow-lg p-5 border-2 border-gray-200 flex flex-col gap-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total Generation
              </h3>
              <p className="text-3xl font-bold text-green-600">{totalGeneration}</p>
              <p className="text-sm text-gray-400 font-medium">kW</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-5 border-2 border-gray-200 flex flex-col gap-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Total Consumption
              </h3>
              <p className="text-3xl font-bold text-red-600">{totalConsumption}</p>
              <p className="text-sm text-gray-400 font-medium">kW</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-5 border-2 border-gray-200 flex flex-col gap-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Net Power
              </h3>
              <p className="text-3xl font-bold text-blue-600">{netPower}</p>
              <p className="text-sm text-gray-400 font-medium">kW</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DeviceCard({ device, onClick }) {
  const Icon = DEVICE_TYPE_ICONS[device.type] || Plug
  const colorClass = DEVICE_TYPE_COLORS[device.type] || "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"

  return (
    <div
      onClick={onClick}
      className={`relative ${colorClass} border-2 rounded-2xl p-4 shadow-lg min-w-[140px] transition-all hover:shadow-xl cursor-pointer hover:scale-105`}
    >
      <div className="flex justify-center mb-3">
        <div className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center">
          <Icon className="w-10 h-10" />
        </div>
      </div>

      <div className="text-center text-sm font-bold mb-2">{device.name}</div>

      <div className="text-center">
        <div className="text-2xl font-bold">{Math.abs(device.power / 1000).toFixed(1)} kW</div>
        <div
          className={`text-xs font-semibold mt-1 ${
            device.power > 0 ? "text-green-600" : device.power < 0 ? "text-red-600" : "text-gray-400"
          }`}
        >
          {(() => {
            const { supply, consume } = getFlowLabels(device.type)
            return device.power > 10 ? `↓ ${supply}` : device.power < -10 ? `↑ ${consume}` : "Idle"
          })()}
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-xs bg-black bg-opacity-70 text-white px-2 py-1 rounded">
          Click for details
        </div>
      </div>
    </div>
  )
}

export default Home