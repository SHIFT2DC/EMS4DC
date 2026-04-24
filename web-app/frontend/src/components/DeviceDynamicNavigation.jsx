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

@File: DeviceDynamicNavigation.jsx
@Description: # TODO: Add desc

@Created: 1st February 2026
@Last Modified: 18 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/


import React, { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import { 
  ChevronDown, Battery, Sun, Plug, Car, Zap, 
  Wind, Grid3x3, Activity, AlertCircle 
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import api from "@/lib/axios"

const ASSET_TYPE_ICONS = {
  PV: Sun,
  BESS: Battery,
  LOAD: Plug,
  CRITICAL_LOAD: AlertCircle,
  UNI_EV: Car,
  BI_EV: Zap,
  WIND: Wind,
  GRID: Grid3x3,
  AFE: Activity
}

function DynamicDeviceNavigation() {
  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)


  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const response = await api.get(`/api/devices/list`)
      
      setDevices(response.data.devices)

    } catch (error) {
      console.error("Error loading devices:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Group devices by type
  const groupedDevices = devices.reduce((acc, device) => {
    if (!acc[device.type]) {
      acc[device.type] = []
    }
    acc[device.type].push(device)
    return acc
  }, {})

  if (devices.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center space-x-1 px-3 py-2 rounded transition hover:bg-white hover:bg-opacity-10 hover:text-blue-200"
        >
          <Plug className="h-5 w-5" />
          <span>Devices</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>All Devices</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {Object.entries(groupedDevices).map(([type, deviceList]) => {
          const Icon = ASSET_TYPE_ICONS[type] || Plug
          
          return (
            <div key={type}>
              {deviceList.length > 1 ? (
                // If multiple devices of same type, show as submenu
                <>
                  <DropdownMenuLabel className="text-xs text-gray-500 flex items-center gap-2">
                    <Icon className="h-3 w-3" />
                    {type}
                  </DropdownMenuLabel>
                  {deviceList.map(device => (
                    <DropdownMenuItem key={device.asset_key} asChild>
                      <NavLink
                        to={`/device/${device.asset_key}`}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer"
                      >
                        <span className="ml-4">{device.name}</span>
                        <span className="text-xs text-gray-500 font-mono ml-auto">
                          {device.asset_key}
                        </span>
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : (
                // Single device of this type
                <DropdownMenuItem key={deviceList[0].asset_key} asChild>
                  <NavLink
                    to={`/device/${deviceList[0].asset_key}`}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{deviceList[0].name}</span>
                    <span className="text-xs text-gray-500 font-mono ml-auto">
                      {deviceList[0].asset_key}
                    </span>
                  </NavLink>
                </DropdownMenuItem>
              )}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default DynamicDeviceNavigation