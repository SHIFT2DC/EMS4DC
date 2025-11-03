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

File: page-modbus-config.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Save, Server, RefreshCw, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"

export default function ModbusConfigPage() {
  // Initialize with default values
  const [config, setConfig] = useState({
    devices: [
      {
        id: "device-" + Date.now(),
        name: "Device 1",
        ipAddress: "192.168.1.100",
        port: 502,
        parameters: [
          {
            id: "param-" + Date.now(),
            name: "Parameter 1",
            registerType: "holding",
            address: 1,
            modbusId: 1,
            dataType: "uint16",
            scaleFactor: 1,
            offset: 0,
            decimalPlaces: 0,
            unit: "",
            description: "",
            wordOrder: "big",
          },
        ],
      },
    ],
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Load configuration on component mount
  useEffect(() => {
    loadConfig()
  }, [])

  // Load configuration from server
  const loadConfig = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const API_BASE_URL = import.meta.env.VITE_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/modbus-config`)

      if (response.ok) {
        const loadedConfig = await response.json()

        // Ensure all items have unique IDs and parameters with defaults
        const configWithIds = {
          ...loadedConfig,
          devices: loadedConfig.devices.map((device) => ({
            ...device,
            id: device.id || "device-" + Date.now() + Math.random(),
            parameters: device.parameters.map((param) => ({
              id: param.id || "param-" + Date.now() + Math.random(),
              name: param.name || "Parameter",
              registerType: param.registerType || "holding",
              address: param.address || 1,
              modbusId: param.modbusId || 1,
              dataType: param.dataType || "uint16",
              scaleFactor: param.scaleFactor !== undefined ? param.scaleFactor : 1,
              offset: param.offset !== undefined ? param.offset : 0,
              decimalPlaces: param.decimalPlaces !== undefined ? param.decimalPlaces : 0,
              unit: param.unit || "",
              description: param.description || "",
              wordOrder: param.wordOrder || "big",
            })),
          })),
        }

        setConfig(configWithIds)
        toast({
          title: "Configuration loaded",
          description: "Your Modbus configuration has been loaded successfully.",
        })
      } else {
        throw new Error(`Failed to load configuration: ${response.status}`)
      }
    } catch (error) {
      console.error("Error loading config:", error)
      setLoadError(error.message)
      toast({
        title: "Error loading configuration",
        description: "Using default configuration instead.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Add a new device
  const addDevice = () => {
    setConfig({
      ...config,
      devices: [
        ...config.devices,
        {
          id: "device-" + Date.now(),
          name: `Device ${config.devices.length + 1}`,
          ipAddress: "192.168.1.100",
          port: 502,
          parameters: [
            {
              id: "param-" + Date.now(),
              name: "Parameter 1",
              registerType: "holding",
              address: 1,
              modbusId: 1,
              dataType: "uint16",
              scaleFactor: 1,
              offset: 0,
              decimalPlaces: 0,
              unit: "",
              description: "",
              wordOrder: "big",
            },
          ],
        },
      ],
    })
  }

  // Remove a device
  const removeDevice = (deviceId) => {
    setConfig({
      ...config,
      devices: config.devices.filter((device) => device.id !== deviceId),
    })
  }

  // Update a device
  const updateDevice = (deviceId, field, value) => {
    setConfig({
      ...config,
      devices: config.devices.map((device) => (device.id === deviceId ? { ...device, [field]: value } : device)),
    })
  }

  // Add a parameter to a device
  const addParameter = (deviceId) => {
    setConfig({
      ...config,
      devices: config.devices.map((device) => {
        if (device.id === deviceId) {
          return {
            ...device,
            parameters: [
              ...device.parameters,
              {
                id: "param-" + Date.now(),
                name: `Parameter ${device.parameters.length + 1}`,
                registerType: "holding",
                address: 1,
                modbusId: 1,
                dataType: "uint16",
                scaleFactor: 1,
                offset: 0,
                decimalPlaces: 0,
                unit: "",
                description: "",
                wordOrder: "big",
              },
            ],
          }
        }
        return device
      }),
    })
  }

  // Remove a parameter from a device
  const removeParameter = (deviceId, paramId) => {
    setConfig({
      ...config,
      devices: config.devices.map((device) => {
        if (device.id === deviceId) {
          return {
            ...device,
            parameters: device.parameters.filter((param) => param.id !== paramId),
          }
        }
        return device
      }),
    })
  }

  // Update a parameter
  const updateParameter = (deviceId, paramId, field, value) => {
    setConfig({
      ...config,
      devices: config.devices.map((device) => {
        if (device.id === deviceId) {
          return {
            ...device,
            parameters: device.parameters.map((param) => {
              if (param.id === paramId) {
                // Handle numeric fields
                if (["address", "modbusId", "scaleFactor", "offset", "decimalPlaces"].includes(field)) {
                  return { ...param, [field]: Number(value) }
                }
                return { ...param, [field]: value }
              }
              return param
            }),
          }
        }
        return device
      }),
    })
  }

  // Save configuration to modbus.json
  const saveConfig = async () => {
    setIsSaving(true)

    try {
      const API_BASE_URL = import.meta.env.VITE_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/save-modbus-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      })
      if (response.ok) {
        toast({
          title: "Configuration saved",
          description: "Your Modbus configuration has been saved successfully.",
        })
      } else {
        throw new Error("Failed to save configuration")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save Modbus configuration.",
        variant: "destructive",
      })
      console.error("Error saving config:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <Card className="w-full">
          <CardContent className="flex items-center justify-center py-10">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      {loadError && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load saved configuration: {loadError}. Using default configuration.
          </AlertDescription>
        </Alert>
      )}
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Modbus Configuration</CardTitle>
          <CardDescription>Configure multiple Modbus devices and their parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Devices</h3>
            <div className="flex gap-2">
              <Button onClick={loadConfig} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Reload Config
              </Button>
              <Button onClick={addDevice} variant="outline" size="sm">
                <Server className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </div>
          </div>
          <Accordion type="multiple" className="w-full">
            {config.devices.map((device) => (
              <AccordionItem key={device.id} value={device.id}>
                <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span>
                      {device.name} ({device.ipAddress})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-4 pb-2">
                  <Card className="border border-muted">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="space-y-2">
                          <Label htmlFor={`device-name-${device.id}`}>Device Name</Label>
                          <Input
                            id={`device-name-${device.id}`}
                            value={device.name}
                            onChange={(e) => updateDevice(device.id, "name", e.target.value)}
                            placeholder="Device name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`device-ip-${device.id}`}>IP Address</Label>
                          <Input
                            id={`device-ip-${device.id}`}
                            value={device.ipAddress}
                            onChange={(e) => updateDevice(device.id, "ipAddress", e.target.value)}
                            placeholder="192.168.1.100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`device-port-${device.id}`}>Port</Label>
                          <Input
                            id={`device-port-${device.id}`}
                            type="number"
                            value={device.port}
                            onChange={(e) => updateDevice(device.id, "port", Number.parseInt(e.target.value))}
                            placeholder="502"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-medium">Parameters</h4>
                        <div className="flex gap-2">
                          <Button onClick={() => addParameter(device.id)} variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Parameter
                          </Button>
                          <Button
                            onClick={() => removeDevice(device.id)}
                            variant="destructive"
                            size="sm"
                            disabled={config.devices.length <= 1}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Device
                          </Button>
                        </div>
                      </div>
                      {device.parameters.map((param) => (
                        <Card key={param.id} className="border border-muted mb-4">
                          <CardContent className="pt-6">
                            <div className="space-y-6">
                              {/* Basic Configuration */}
                              <div>
                                <h5 className="text-sm font-medium mb-3 text-muted-foreground">Basic Configuration</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`name-${param.id}`}>Name</Label>
                                    <Input
                                      id={`name-${param.id}`}
                                      value={param.name}
                                      onChange={(e) => updateParameter(device.id, param.id, "name", e.target.value)}
                                      placeholder="Parameter name"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`type-${param.id}`}>Register Type</Label>
                                    <Select
                                      value={param.registerType}
                                      onValueChange={(value) =>
                                        updateParameter(device.id, param.id, "registerType", value)
                                      }
                                    >
                                      <SelectTrigger id={`type-${param.id}`}>
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="holding">Holding Register</SelectItem>
                                        <SelectItem value="input">Input Register</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`address-${param.id}`}>Modbus Address</Label>
                                    <Input
                                      id={`address-${param.id}`}
                                      type="number"
                                      value={param.address}
                                      onChange={(e) => updateParameter(device.id, param.id, "address", e.target.value)}
                                      placeholder="1"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`modbusId-${param.id}`}>Modbus ID</Label>
                                    <Input
                                      id={`modbusId-${param.id}`}
                                      type="number"
                                      value={param.modbusId}
                                      onChange={(e) => updateParameter(device.id, param.id, "modbusId", e.target.value)}
                                      placeholder="1"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Data Processing */}
                              <div>
                                <h5 className="text-sm font-medium mb-3 text-muted-foreground">Data Processing</h5>
                                <div
                                  className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${param.dataType === "float32" ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}
                                >
                                  <div className="space-y-2">
                                    <Label htmlFor={`dataType-${param.id}`}>Data Type</Label>
                                    <Select
                                      value={param.dataType}
                                      onValueChange={(value) => updateParameter(device.id, param.id, "dataType", value)}
                                    >
                                      <SelectTrigger id={`dataType-${param.id}`}>
                                        <SelectValue placeholder="Select data type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="uint16">uint16</SelectItem>
                                        <SelectItem value="int16">int16</SelectItem>
                                        <SelectItem value="float32">float32</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {param.dataType === "float32" && (
                                    <>
                                      <div className="space-y-2">
                                        <Label htmlFor={`wordOrder-${param.id}`}>Word Order</Label>
                                        <Select
                                          value={param.wordOrder}
                                          onValueChange={(value) =>
                                            updateParameter(device.id, param.id, "wordOrder", value)
                                          }
                                        >
                                          <SelectTrigger id={`wordOrder-${param.id}`}>
                                            <SelectValue placeholder="Select word order" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="big">Big Endian</SelectItem>
                                            <SelectItem value="little">Little Endian</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </>
                                  )}

                                  <div className="space-y-2">
                                    <Label htmlFor={`scaleFactor-${param.id}`}>Scale Factor</Label>
                                    <Input
                                      id={`scaleFactor-${param.id}`}
                                      type="number"
                                      step="any"
                                      value={param.scaleFactor}
                                      onChange={(e) =>
                                        updateParameter(device.id, param.id, "scaleFactor", e.target.value)
                                      }
                                      placeholder="1"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`offset-${param.id}`}>Offset</Label>
                                    <Input
                                      id={`offset-${param.id}`}
                                      type="number"
                                      step="any"
                                      value={param.offset}
                                      onChange={(e) => updateParameter(device.id, param.id, "offset", e.target.value)}
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`decimalPlaces-${param.id}`}>Decimal Places</Label>
                                    <Input
                                      id={`decimalPlaces-${param.id}`}
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={param.decimalPlaces}
                                      onChange={(e) =>
                                        updateParameter(device.id, param.id, "decimalPlaces", e.target.value)
                                      }
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Display Configuration */}
                              <div>
                                <h5 className="text-sm font-medium mb-3 text-muted-foreground">
                                  Display Configuration
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`unit-${param.id}`}>Unit</Label>
                                    <Input
                                      id={`unit-${param.id}`}
                                      value={param.unit}
                                      onChange={(e) => updateParameter(device.id, param.id, "unit", e.target.value)}
                                      placeholder="e.g., kW, V, A"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`description-${param.id}`}>Description</Label>
                                    <Textarea
                                      id={`description-${param.id}`}
                                      value={param.description}
                                      onChange={(e) =>
                                        updateParameter(device.id, param.id, "description", e.target.value)
                                      }
                                      placeholder="e.g., PV Power in kW"
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Remove Parameter Button */}
                              <div className="flex justify-end pt-2 border-t">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeParameter(device.id, param.id)}
                                  disabled={device.parameters.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Parameter
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
        <CardFooter>
          <Button onClick={saveConfig} className="ml-auto" disabled={isSaving}>
            {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Configuration Preview</CardTitle>
          <CardDescription>Preview of the modbus.json file that will be generated</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">{JSON.stringify(config, null, 2)}</pre>
        </CardContent>
      </Card>
    </div>
  )
}
