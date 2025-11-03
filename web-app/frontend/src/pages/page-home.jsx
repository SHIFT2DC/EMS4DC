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

File: page-home.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { Battery, Car, Gauge, Plug, Sun, Zap } from "lucide-react"
import PowerFlow from "../components/PowerFlow"
import { Skeleton } from "@/components/ui/skeleton"

function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    solarPanels: "-",
    loads: "-",
    evChargersUni: "-",
    evChargersBi: "-",
    storageSystem: "-",
    activeFrontEnd: "-",
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
        const response = await fetch(`${API_BASE_URL}/api/data`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
        }
        const jsonData = await response.json()
        setData({
          solarPanels: (Math.abs(jsonData.PV_POWER) / 1000).toFixed(1) || "-",
          loads: (jsonData.LOAD_POWER / 1000).toFixed(1) || "-",
          evChargersUni: (jsonData.EV1_POWER / 1000).toFixed(1) || "-",
          evChargersBi: (jsonData.EV2_POWER / 1000).toFixed(1) || "-",
          storageSystem: (jsonData.BESS_POWER / 1000).toFixed(1) || "-",
          activeFrontEnd: (jsonData.AFE_POWER / 1000).toFixed(1) || "-",
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

  const dataPoints = [
    {
      icon: <Sun className="w-8 h-8" />,
      label: "Solar Panels",
      value: `${data.solarPanels} kW`,
      link: "/devices/solarpanels",
      x: 20,
      y: 20,
      flowDirection: "inward",
      hasPower: !isLoading && data.solarPanels !== "-" && Number.parseFloat(data.solarPanels) > 0,
    },
    {
      icon: <Plug className="w-8 h-8" />,
      label: "Loads",
      value: `${data.loads} kW`,
      link: "/devices/otherloads",
      x: 80,
      y: 20,
      flowDirection: "outward",
      hasPower: !isLoading && data.loads !== "-" && Number.parseFloat(data.loads) > 0,
    },
    {
      icon: <Car className="w-8 h-8" />,
      label: "Unidirectional Charger",
      value: `${data.evChargersUni} kW`,
      link: "/devices/unidirev",
      x: 90,
      y: 40,
      flowDirection: "outward",
      hasPower: !isLoading && data.evChargersUni !== "-" && Number.parseFloat(data.evChargersUni) > 0,
    },
    {
      icon: <Zap className="w-8 h-8" />,
      label: "Bidirectional Charger",
      value: `${data.evChargersBi} kW`,
      link: "/devices/bidirev",
      x: 90,
      y: 70,
      flowDirection: Number.parseFloat(data.evChargersBi) > 0 ? "outward" : "inward",
      hasPower: !isLoading && data.evChargersBi !== "-" && Math.abs(Number.parseFloat(data.evChargersBi)) > 0,
    },
    {
      icon: <Battery className="w-8 h-8" />,
      label: "Storage Systems",
      value: `${data.storageSystem} kW`,
      link: "/devices/storagesystems",
      x: 50,
      y: 90,
      flowDirection: Number.parseFloat(data.storageSystem) > 0 ? "outward" : "inward",
      hasPower: !isLoading && data.storageSystem !== "-" && Math.abs(Number.parseFloat(data.storageSystem)) > 0,
    },
    {
      icon: <Gauge className="w-8 h-8" />,
      label: "Active Front End",
      value: `${data.activeFrontEnd} kW`,
      link: "/devices/activefrontend",
      x: 10,
      y: 50,
      flowDirection: Number.parseFloat(data.activeFrontEnd) > 0 ? "inward" : "outward",
      hasPower: !isLoading && data.activeFrontEnd !== "-" && Math.abs(Number.parseFloat(data.activeFrontEnd)) > 0,
    },
  ]

  return (
    <div className="relative min-h-[600px] w-full max-w-4xl mx-auto p-8">
      {/* Connection Lines and Power Flow */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
      >
        {dataPoints.map((point, index) => (
          <PowerFlow
            key={index}
            x1={point.x}
            y1={point.y}
            x2={50}
            y2={50}
            direction={point.flowDirection}
            animate={point.hasPower}
          />
        ))}
      </svg>

      {/* Central Circle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-40 h-40 bg-blue-600 rounded-full flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-lg font-semibold">{isLoading ? "FETCHING" : "SYSTEM"}</div>
            <div className="text-sm">{isLoading ? "DATA..." : "OVERVIEW"}</div>
          </div>
        </div>
      </div>

      {/* Radial Items */}
      <div className="absolute inset-0">
        {dataPoints.map((point, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <DataPoint
              icon={point.icon}
              label={point.label}
              value={point.value}
              link={point.link}
              isLoading={isLoading}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function DataPoint({ icon, label, value, link, isLoading }) {
  return (
    <Link to={link} className="relative flex flex-col items-center group">
      <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 relative group-hover:bg-blue-100 transition-colors">
        {icon}
      </div>
      <div className="mt-2 text-center">
        <div className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">{label}</div>
        {isLoading ? (
          <Skeleton className="h-6 w-20 mt-1" />
        ) : (
          <div className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{value}</div>
        )}
      </div>
    </Link>
  )
}

export default Home