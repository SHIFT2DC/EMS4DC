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

File: page-modbus-config.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 3rd February 2026
Version: v1.2.0
*/

import { useState, useEffect, memo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Save, Server, RefreshCw, AlertCircle, Eye, EyeOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ParameterRow = memo(({ deviceId, param, onUpdate, onRemove, canRemove }) => {
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b last:border-b-0">
      <div className="col-span-2">
        <Input
          value={param.name}
          onChange={(e) => onUpdate(deviceId, param.id, "name", e.target.value)}
          placeholder="Name"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1">
        <Select
          value={param.registerType}
          onValueChange={(value) => onUpdate(deviceId, param.id, "registerType", value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="holding">Holding</SelectItem>
            <SelectItem value="input">Input</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1">
        <Input
          type="number"
          value={param.address}
          onChange={(e) => onUpdate(deviceId, param.id, "address", e.target.value)}
          placeholder="Addr"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1">
        <Input
          type="number"
          value={param.modbusId}
          onChange={(e) => onUpdate(deviceId, param.id, "modbusId", e.target.value)}
          placeholder="ID"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1">
        <Select
          value={param.dataType}
          onValueChange={(value) => onUpdate(deviceId, param.id, "dataType", value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uint16">u16</SelectItem>
            <SelectItem value="int16">i16</SelectItem>
            <SelectItem value="float32">f32</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {param.dataType === "float32" && (
        <div className="col-span-1">
          <Select
            value={param.wordOrder}
            onValueChange={(value) => onUpdate(deviceId, param.id, "wordOrder", value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="big">BE</SelectItem>
              <SelectItem value="little">LE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className={param.dataType === "float32" ? "col-span-1" : "col-span-2"}>
        <Input
          type="number"
          step="any"
          value={param.scaleFactor}
          onChange={(e) => onUpdate(deviceId, param.id, "scaleFactor", e.target.value)}
          placeholder="Scale"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1">
        <Input
          type="number"
          step="any"
          value={param.offset}
          onChange={(e) => onUpdate(deviceId, param.id, "offset", e.target.value)}
          placeholder="Offset"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1">
        <Input
          type="number"
          min="0"
          max="10"
          value={param.decimalPlaces}
          onChange={(e) => onUpdate(deviceId, param.id, "decimalPlaces", e.target.value)}
          placeholder="Dec"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1">
        <Input
          value={param.unit}
          onChange={(e) => onUpdate(deviceId, param.id, "unit", e.target.value)}
          placeholder="Unit"
          className="h-8 text-sm"
        />
      </div>
      <div className="col-span-1 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(deviceId, param.id)}
          disabled={!canRemove}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})

ParameterRow.displayName = "ParameterRow"

export default function ModbusConfigPage() {
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
            mode: "read",
          },
        ],
      },
    ],
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const API_BASE_URL = import.meta.env.VITE_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/modbus-config`)

      if (response.ok) {
        const loadedConfig = await response.json()

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
              mode: param.mode || "read",
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
              mode: "read",
            },
          ],
        },
      ],
    })
  }

  const removeDevice = (deviceId) => {
    setConfig({
      ...config,
      devices: config.devices.filter((device) => device.id !== deviceId),
    })
  }

  const updateDevice = (deviceId, field, value) => {
    setConfig({
      ...config,
      devices: config.devices.map((device) => (device.id === deviceId ? { ...device, [field]: value } : device)),
    })
  }

  const addParameter = (deviceId, mode = "read") => {
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
                mode: mode,
              },
            ],
          }
        }
        return device
      }),
    })
  }

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

  const updateParameter = (deviceId, paramId, field, value) => {
    setConfig({
      ...config,
      devices: config.devices.map((device) => {
        if (device.id === deviceId) {
          return {
            ...device,
            parameters: device.parameters.map((param) => {
              if (param.id === paramId) {
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

  const saveConfig = async () => {
    setIsSaving(true)

    try {
      const API_BASE_URL = import.meta.env.VITE_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/modbus-config/save`, {
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
    <div className="container mx-auto py-6">
      {loadError && (
        <Alert className="mb-4" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load saved configuration: {loadError}. Using default configuration.
          </AlertDescription>
        </Alert>
      )}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Modbus Configuration</CardTitle>
              <CardDescription>Configure multiple Modbus devices and their parameters</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowPreview(!showPreview)} variant="outline" size="sm">
                {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
              <Button onClick={loadConfig} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Reload
              </Button>
              <Button onClick={addDevice} variant="outline" size="sm">
                <Server className="h-4 w-4 mr-2" />
                Add Device
              </Button>
              <Button onClick={saveConfig} disabled={isSaving}>
                {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="multiple" className="w-full">
            {config.devices.map((device) => {
              const readParams = device.parameters.filter((p) => p.mode === "read")
              const writeParams = device.parameters.filter((p) => p.mode === "write")

              return (
                <AccordionItem key={device.id} value={device.id}>
                  <AccordionTrigger className="hover:bg-muted/50 px-3 rounded-md">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium">
                        {device.name} ({device.ipAddress}:{device.port})
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {readParams.length} read / {writeParams.length} write
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pt-3 pb-2">
                    <div className="space-y-4">
                      {/* Device Info */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Device Name</Label>
                          <Input
                            value={device.name}
                            onChange={(e) => updateDevice(device.id, "name", e.target.value)}
                            placeholder="Device name"
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">IP Address</Label>
                          <Input
                            value={device.ipAddress}
                            onChange={(e) => updateDevice(device.id, "ipAddress", e.target.value)}
                            placeholder="192.168.1.100"
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Port</Label>
                          <Input
                            type="number"
                            value={device.port}
                            onChange={(e) => updateDevice(device.id, "port", Number.parseInt(e.target.value))}
                            placeholder="502"
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1 flex items-end">
                          <Button
                            onClick={() => removeDevice(device.id)}
                            variant="destructive"
                            size="sm"
                            disabled={config.devices.length <= 1}
                            className="h-8 w-full"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Remove Device
                          </Button>
                        </div>
                      </div>

                      {/* Parameters Tabs */}
                      <Tabs defaultValue="read" className="w-full">
                        <div className="flex items-center justify-between mb-2">
                          <TabsList className="h-8">
                            <TabsTrigger value="read" className="text-xs">
                              Read Parameters ({readParams.length})
                            </TabsTrigger>
                            <TabsTrigger value="write" className="text-xs">
                              Write Parameters ({writeParams.length})
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="read" className="mt-0">
                          <Card>
                            <CardContent className="p-3">
                              {/* Header */}
                              <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b font-medium text-xs text-muted-foreground">
                                <div className="col-span-2">Name</div>
                                <div className="col-span-1">Type</div>
                                <div className="col-span-1">Addr</div>
                                <div className="col-span-1">ID</div>
                                <div className="col-span-1">Data</div>
                                <div className="col-span-2">Scale</div>
                                <div className="col-span-1">Offset</div>
                                <div className="col-span-1">Dec</div>
                                <div className="col-span-1">Unit</div>
                                <div className="col-span-1"></div>
                              </div>
                              {/* Rows */}
                              {readParams.length > 0 ? (
                                readParams.map((param) => (
                                  <ParameterRow 
                                    key={param.id} 
                                    deviceId={device.id}
                                    param={param}
                                    onUpdate={updateParameter}
                                    onRemove={removeParameter}
                                    canRemove={readParams.length > 1 || writeParams.length > 0}
                                  />
                                ))
                              ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  No read parameters configured
                                </div>
                              )}
                              <div className="mt-3">
                                <Button onClick={() => addParameter(device.id, "read")} variant="outline" size="sm">
                                  <Plus className="h-3 w-3 mr-2" />
                                  Add Read Parameter
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        <TabsContent value="write" className="mt-0">
                          <Card>
                            <CardContent className="p-3">
                              {/* Header */}
                              <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b font-medium text-xs text-muted-foreground">
                                <div className="col-span-2">Name</div>
                                <div className="col-span-1">Type</div>
                                <div className="col-span-1">Addr</div>
                                <div className="col-span-1">ID</div>
                                <div className="col-span-1">Data</div>
                                <div className="col-span-2">Scale</div>
                                <div className="col-span-1">Offset</div>
                                <div className="col-span-1">Dec</div>
                                <div className="col-span-1">Unit</div>
                                <div className="col-span-1"></div>
                              </div>
                              {/* Rows */}
                              {writeParams.length > 0 ? (
                                writeParams.map((param) => (
                                  <ParameterRow 
                                    key={param.id} 
                                    deviceId={device.id}
                                    param={param}
                                    onUpdate={updateParameter}
                                    onRemove={removeParameter}
                                    canRemove={writeParams.length > 1 || readParams.length > 0}
                                  />
                                ))
                              ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground">
                                  No write parameters configured
                                </div>
                              )}
                              <div className="mt-3">
                                <Button onClick={() => addParameter(device.id, "write")} variant="outline" size="sm">
                                  <Plus className="h-3 w-3 mr-2" />
                                  Add Write Parameter
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </CardContent>
      </Card>

      {showPreview && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Configuration Preview</CardTitle>
            <CardDescription>Preview of the modbus.json file</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-3 rounded-md overflow-auto text-xs max-h-96">
              {JSON.stringify(config, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}