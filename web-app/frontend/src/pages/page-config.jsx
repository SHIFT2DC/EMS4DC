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

File: page-config.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 3rd February 2026
Version: v1.2.0
*/

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const defaultConfig = {
  generalSiteConfig: {
    selectedOperationMode: "droopMode"
  },
  evCharger1: {
    maxVoltage: 400,
    minVoltage: 200,
    maxCurrent: 32,
    minCurrent: 6,
    maxPower: 22000,
    v_nom: 300,
    p_supply: 22000,
    v_supply: 100,
    p_consume: 0,
    v_consume: 0,
    p_opt: 0,
    efficiency: 1
  },
  evCharger2: {
    maxVoltage: 400,
    minVoltage: 200,
    maxCurrent: 32,
    minCurrent: 6,
    maxPower: 22000,
    v_nom: 300,
    p_supply: 22000,
    v_supply: 100,
    p_consume: 0,
    v_consume: 0,
    p_opt: 0,
    efficiency: 1
  },
  pv: {
    maxVoltage: 1000,
    minVoltage: 100,
    maxCurrent: 10,
    maxPower: 10000,
    v_nom: 700,
    p_supply: 10000,
    v_supply: 600,
    p_consume: 5000,
    v_consume: 300,
    p_opt: 0
  },
  bess: {
    maxVoltage: 800,
    minVoltage: 400,
    maxChargeCurrent: 100,
    maxDischargeCurrent: 100,
    capacity: 100000,
    v_nom: 700,
    p_supply: 100000,
    v_supply: 100,
    p_consume: 100000,
    v_consume: 100,
    p_opt: 0,
    efficiency: 1,
    minSoC: 20,
    maxSoC: 80
  },
  loads: {
    maxVoltage: 240,
    minVoltage: 220,
    maxCurrent: 100,
    maxPower: 24000,
    v_nom: 230,
    p_supply: 0,
    v_supply: 0,
    p_consume: 24000,
    v_consume: 10,
    p_opt: 0
  },
  activeFrontEnd: {
    nominalPower: 50000,
    maxVoltage: 800,
    minVoltage: 400,
    maxCurrent: 100,
    efficiency: 95,
    operatingFrequency: 50,
    v_nom: 600,
    p_supply: 50000,
    v_supply: 50,
    p_consume: 50000,
    v_consume: 50,
    p_opt: 0
  }
}

const ConfigPage = () => {
  const [config, setConfig] = useState(defaultConfig)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
      const response = await fetch(`${API_BASE_URL}/api/config`)

      const data = await response.json()
      if (data && Object.keys(data).length > 0) {
        setConfig(data)
      } else {
        console.log("Loaded config is empty, using default config")
      }
    } catch (error) {
      console.error("Error loading config:", error)
      console.log("Error loading config, using default config")
    }
  }

  const saveConfig = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
      const response = await fetch(`${API_BASE_URL}/api/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      })
      if (response.ok) {
        alert("Configuration saved successfully!")
      } else {
        throw new Error("Failed to save configuration")
      }
    } catch (error) {
      console.error("Error saving config:", error)
      alert("Error saving configuration. Please try again.")
    }
  }

  const handleChange = (device, parameter, value) => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      [device]: {
        ...prevConfig[device],
        [parameter]: value,
      },
    }))
  }

  const getParameterUnit = (param) => {
    if (param.toLowerCase().includes("voltage") || param.toLowerCase().includes("v_")) {
      return "V"
    } else if (param.toLowerCase().includes("current")) {
      return "A"
    } else if (param.toLowerCase().includes("power") || param.toLowerCase().includes("p_")) {
      return "W"
    } else if (param.toLowerCase().includes("capacity")) {
      return "Wh"
    } else if (param.toLowerCase().includes("efficiency")) {
      return "%"
    } else if (param.toLowerCase().includes("soc")) {
      return "%"
    } else if (param.toLowerCase().includes("frequency")) {
      return "Hz"
    }
    return ""
  }

  const formatParameterName = (param) => {
    const specialCases = {
      nominalVoltageDCBus: "Nominal Voltage on the DC Bus",
      droopVoltageUpperLimit: "Droop: Voltage Upper Limit",
      droopVoltageLowerLimit: "Droop Voltage Lower Limit",
      droopPowerSupplyLimit: "Droop Power Supply Limit",
      droopPowerConsumeLimit: "Droop Power Consume Limit",
      nominalPower: "Nominal Power",
      maxVoltage: "Maximum Voltage",
      minVoltage: "Minimum Voltage",
      maxCurrent: "Maximum Current",
      minCurrent: "Minimum Current",
      maxPower: "Maximum Power",
      maxChargeCurrent: "Maximum Charge Current",
      maxDischargeCurrent: "Maximum Discharge Current",
      operatingFrequency: "Operating Frequency",
      efficiency: "Efficiency",
      minSoC: "Minimum State of Charge",
      maxSoC: "Maximum State of Charge",
      selectedOperationMode: "Selected mode of EMS Operation"
    }
    
    return specialCases[param] || param.replace(/([A-Z])/g, " $1").trim()
  }

  const formatOperationModeValue = (value) => {
    const modeLabels = {
      droopMode: "Droop Mode",
      optimizerMode: "Optimizer Mode"
    }
    return modeLabels[value] || value
  }

  const renderDeviceConfig = (device, params, displayName) => (
    <AccordionItem value={device}>
      <AccordionTrigger>{displayName || device.toUpperCase()}</AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4">
          {params && typeof params === "object" ? (
            Object.entries(params).map(([param, value]) => (
              <div key={param} className="space-y-2">
                <Label htmlFor={`${device}-${param}`}>{formatParameterName(param)}</Label>
                {param === "selectedOperationMode" ? (
                  <Select
                    value={value}
                    onValueChange={(newValue) => handleChange(device, param, newValue)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select operation mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="droopMode">Droop Mode</SelectItem>
                      <SelectItem value="optimizerMode">Optimizer Mode</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Input
                      id={`${device}-${param}`}
                      type="number"
                      value={value}
                      onChange={(e) => handleChange(device, param, Number(e.target.value))}
                      className="w-full"
                      step={param.toLowerCase().includes("efficiency") ? "0.1" : "1"}
                    />
                    <span className="text-sm text-muted-foreground min-w-[30px]">
                      {getParameterUnit(param)}
                    </span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p>No parameters available for this device.</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Device Configuration</CardTitle>
        <CardDescription>Manage parameters for site's assets</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {renderDeviceConfig("generalSiteConfig", config.generalSiteConfig, "General Site Configuration")}
          {renderDeviceConfig("evCharger1", config.evCharger1, "EV Charger 1")}
          {renderDeviceConfig("evCharger2", config.evCharger2, "EV Charger 2")}
          {renderDeviceConfig("pv", config.pv, "Solar PV")}
          {renderDeviceConfig("bess", config.bess, "Battery Storage")}
          {renderDeviceConfig("loads", config.loads, "Electrical Loads")}
          {renderDeviceConfig("activeFrontEnd", config.activeFrontEnd, "Active Front End")}
        </Accordion>
      </CardContent>
      <CardFooter>
        <Button onClick={saveConfig} className="w-full">
          Save Configuration
        </Button>
      </CardFooter>
    </Card>
  )
}

export default ConfigPage