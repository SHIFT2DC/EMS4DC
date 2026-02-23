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

@File: page-settings.jsx
@Description: # TODO: Add desc

@Created: 1st February 2026
@Last Modified: 18 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
*/


import { useState, useEffect, memo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Plus, Save, Trash2, RefreshCw, AlertCircle, Download, Settings, Database, CheckCircle, ChevronDown
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/axios"

const ASSET_TYPES = {
  PV:            { label: "Solar PV",            color: "bg-yellow-100 text-yellow-800", icon: "☀️" },
  BESS:          { label: "Battery Storage",      color: "bg-green-100 text-green-800",  icon: "🔋" },
  LOAD:          { label: "Load",                 color: "bg-gray-100 text-gray-800",    icon: "⚡" },
  CRITICAL_LOAD: { label: "Critical Load",        color: "bg-red-100 text-red-800",      icon: "🚨" },
  UNI_EV:        { label: "Unidirectional EV",    color: "bg-blue-100 text-blue-800",    icon: "🚗" },
  BI_EV:         { label: "Bidirectional EV",     color: "bg-purple-100 text-purple-800",icon: "🔄" },
  WIND:          { label: "Wind Generator",        color: "bg-teal-100 text-teal-800",    icon: "💨" },
  GRID:          { label: "Grid Connection",       color: "bg-orange-100 text-orange-800",icon: "🔌" },
  AFE:           { label: "Active Front End",      color: "bg-indigo-100 text-indigo-800",icon: "⚙️" }
}

export default function SettingsPage() {
  const [assets, setAssets] = useState([])
  const [globalConfig, setGlobalConfig] = useState(null)
  const [modbusConfig, setModbusConfig] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("general")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [
        { data: assetsData },
        { data: configData },
        { data: modbusData },
      ] = await Promise.all([
        api.get('/api/settings/assets'),
        api.get('/api/settings/config'),
        api.get('/api/settings/modbus'),
      ])

      setAssets(assetsData)
      setGlobalConfig(configData)
      setModbusConfig(modbusData)

      toast({ title: "Settings loaded", description: "All settings have been loaded successfully." })
    } catch (error) {
      console.error("Error loading settings:", error)
      toast({ title: "Error", description: "Failed to load settings.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAsset = async (newAsset) => {
    try {
      const { data: createdAsset } = await api.post('/api/settings/assets', newAsset)
      setAssets([...assets, createdAsset])
      setIsCreateDialogOpen(false)
      await loadData()
      toast({
        title: "Asset created successfully",
        description: `${newAsset.name} (${createdAsset.asset_key}) has been added and configured.`,
      })
    } catch (error) {
      console.error("Error creating asset:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create asset",
        variant: "destructive",
      })
    }
  }

  const handleUpdateAsset = async (id, updates) => {
    try {
      const { data: updatedAsset } = await api.put(`/api/settings/assets/${id}`, updates)
      setAssets(assets.map(a => a.id === id ? updatedAsset : a))
      toast({ title: "Asset updated", description: "Asset has been updated successfully." })
    } catch (error) {
      console.error("Error updating asset:", error)
      toast({ title: "Error", description: "Failed to update asset.", variant: "destructive" })
    }
  }

  const handleDeleteAsset = async (id) => {
    try {
      await api.delete(`/api/settings/assets/${id}`)
      setAssets(assets.filter(a => a.id !== id))
      await loadData()
      toast({ title: "Asset deleted", description: "Asset has been deleted from database and configuration files." })
    } catch (error) {
      console.error("Error deleting asset:", error)
      toast({ title: "Error", description: "Failed to delete asset.", variant: "destructive" })
    }
  }

  const handleSaveGlobalConfig = async () => {
    try {
      await api.post('/api/settings/config', globalConfig)
      toast({ title: "Configuration saved", description: "Global configuration has been saved successfully." })
    } catch (error) {
      console.error("Error saving config:", error)
      toast({ title: "Error", description: "Failed to save configuration.", variant: "destructive" })
    }
  }

  const handleSaveModbusConfig = async () => {
    try {
      await api.post('/api/settings/modbus', modbusConfig)
      toast({ title: "Modbus configuration saved", description: "Modbus configuration has been saved successfully." })
    } catch (error) {
      console.error("Error saving modbus config:", error)
      toast({ title: "Error", description: "Failed to save modbus configuration.", variant: "destructive" })
    }
  }

  const handleExport = async () => {
    try {
      const { data } = await api.get('/api/settings/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `site-config-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Export successful", description: "Configuration has been exported." })
    } catch (error) {
      console.error("Error exporting:", error)
      toast({ title: "Error", description: "Failed to export configuration.", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading settings...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Settings
              </CardTitle>
              <CardDescription>Manage site configuration and assets</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload
              </Button>
              <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General Site Config</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="events">Activity Log</TabsTrigger>
        </TabsList>

        {/* General Site Config Tab */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Site Configuration</CardTitle>
              <CardDescription>System-wide parameters and operation mode settings</CardDescription>
            </CardHeader>
            <CardContent>
              {globalConfig && <GeneralConfigEditor config={globalConfig} onChange={setGlobalConfig} />}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveGlobalConfig} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save General Configuration
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Site Assets</CardTitle>
                  <CardDescription>Manage devices and their configuration parameters</CardDescription>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Asset
                    </Button>
                  </DialogTrigger>
                  <CreateAssetDialog onSubmit={handleCreateAsset} />
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <AssetsList
                assets={assets}
                globalConfig={globalConfig}
                modbusConfig={modbusConfig}
                onUpdate={handleUpdateAsset}
                onDelete={handleDeleteAsset}
                onSaveConfig={handleSaveGlobalConfig}
                onSaveModbus={handleSaveModbusConfig}
                onConfigChange={setGlobalConfig}
                onModbusChange={setModbusConfig}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent asset changes</CardDescription>
            </CardHeader>
            <CardContent>
              <EventsLog assets={assets} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==================== CHILD COMPONENTS ====================

function GeneralConfigEditor({ config, onChange }) {
  const handleChange = (field, value) => {
    onChange({
      ...config,
      generalSiteConfig: {
        ...config.generalSiteConfig,
        [field]: value
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="operationMode">Operation Mode</Label>
          <Select
            value={config.generalSiteConfig?.selectedOperationMode || "droopMode"}
            onValueChange={(value) => handleChange("selectedOperationMode", value)}
          >
            <SelectTrigger id="operationMode">
              <SelectValue placeholder="Select operation mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="droopMode">Droop Mode</SelectItem>
              <SelectItem value="optimizerMode">Optimizer Mode</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="objectiveFunction">Objective Function</Label>
          <Select
            value={config.generalSiteConfig?.objectiveFunction || "maxSelfConsumption"}
            onValueChange={(value) => handleChange("objectiveFunction", value)}
          >
            <SelectTrigger id="objectiveFunction">
              <SelectValue placeholder="Select objective function" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maxWeightPowerFlow">Maximize Weighted Power Flow</SelectItem>
              <SelectItem value="maxSelfConsumption">Maximize Self Consumption</SelectItem>
              <SelectItem value="maxEVSatisfaction">Maximize EV Satisfaction</SelectItem>
              <SelectItem value="minFossilEmissions">Minimize Fossil Emissions</SelectItem>
              <SelectItem value="maxReliability">Maximize Reliability</SelectItem>
              <SelectItem value="lifeExtentBESS">BESS Life Extension</SelectItem>
              <SelectItem value="peakShaving">Peak Shaving</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

function AssetsList({ assets, globalConfig, modbusConfig, onUpdate, onDelete, onSaveConfig, onSaveModbus, onConfigChange, onModbusChange }) {
  return (
    <div className="space-y-2">
      {assets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No assets configured. Click "Add Asset" to get started.</p>
          <p className="text-sm mt-2">Asset keys will be auto-generated (e.g., pv1, bess1, load1)</p>
        </div>
      ) : (
        assets.map(asset => (
          <Card key={asset.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ASSET_TYPES[asset.type]?.icon}</span>
                  <Badge className={ASSET_TYPES[asset.type]?.color}>
                    {ASSET_TYPES[asset.type]?.label || asset.type}
                  </Badge>
                  <span className="font-medium">{asset.name}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {asset.asset_key}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Created: {new Date(asset.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <AssetEditor
                asset={asset}
                globalConfig={globalConfig}
                modbusConfig={modbusConfig}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onSaveConfig={onSaveConfig}
                onSaveModbus={onSaveModbus}
                onConfigChange={onConfigChange}
                onModbusChange={onModbusChange}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function AssetEditor({ asset, globalConfig, modbusConfig, onUpdate, onDelete, onSaveConfig, onSaveModbus, onConfigChange, onModbusChange }) {
  const [localAsset, setLocalAsset] = useState(asset)
  const [hasChanges, setHasChanges] = useState(false)
  const [expandedSection, setExpandedSection] = useState(null)

  useEffect(() => {
    setLocalAsset(asset)
    setHasChanges(false)
  }, [asset])

  const handleFieldChange = (field, value) => {
    setLocalAsset({ ...localAsset, [field]: value })
    setHasChanges(true)
  }

  const handleSave = () => {
    onUpdate(asset.id, { name: localAsset.name, type: localAsset.type })
    setHasChanges(false)
  }

  const deviceConfig = globalConfig?.devices?.find(d => d.id === asset.asset_key)
  const modbusDevice = modbusConfig?.devices?.find(d => d.assetKey === asset.asset_key)

  const handleConfigUpdate = (field, value) => {
    if (!globalConfig || !deviceConfig) return
    const updatedDevices = globalConfig.devices.map(d =>
      d.id === asset.asset_key
        ? { ...d, parameters: { ...d.parameters, [field]: value } }
        : d
    )
    onConfigChange({ ...globalConfig, devices: updatedDevices })
  }

  const handleModbusParamUpdate = (paramId, field, value) => {
    if (!modbusConfig || !modbusDevice) return
    const updatedDevices = modbusConfig.devices.map(d =>
      d.assetKey === asset.asset_key
        ? {
            ...d,
            parameters: d.parameters.map(p =>
              p.id === paramId
                ? { ...p, [field]: ["address", "modbusId", "scaleFactor", "offset", "decimalPlaces"].includes(field) ? Number(value) : value }
                : p
            )
          }
        : d
    )
    onModbusChange({ ...modbusConfig, devices: updatedDevices })
  }

  const handleModbusDeviceUpdate = (field, value) => {
    if (!modbusConfig || !modbusDevice) return
    const updatedDevices = modbusConfig.devices.map(d =>
      d.assetKey === asset.asset_key
        ? { ...d, [field]: field === "port" ? Number(value) : value }
        : d
    )
    onModbusChange({ ...modbusConfig, devices: updatedDevices })
  }

  const handleAddModbusParameter = (mode = "read") => {
    if (!modbusConfig || !modbusDevice) return
    const newParam = {
      id: `param-${Date.now()}`,
      name: `Parameter ${modbusDevice.parameters.length + 1}`,
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
      mode
    }
    const updatedDevices = modbusConfig.devices.map(d =>
      d.assetKey === asset.asset_key
        ? { ...d, parameters: [...d.parameters, newParam] }
        : d
    )
    onModbusChange({ ...modbusConfig, devices: updatedDevices })
  }

  const handleRemoveModbusParameter = (paramId) => {
    if (!modbusConfig || !modbusDevice) return
    const updatedDevices = modbusConfig.devices.map(d =>
      d.assetKey === asset.asset_key
        ? { ...d, parameters: d.parameters.filter(p => p.id !== paramId) }
        : d
    )
    onModbusChange({ ...modbusConfig, devices: updatedDevices })
  }

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Asset Name</Label>
          <Input value={localAsset.name} onChange={(e) => handleFieldChange("name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Asset Type</Label>
          <Select value={localAsset.type} onValueChange={(v) => handleFieldChange("type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ASSET_TYPES).map(([key, { label, icon }]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2"><span>{icon}</span><span>{label}</span></span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Configuration Sections */}
      <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection}>
        <AccordionItem value="device-config">
          <AccordionTrigger>Device Configuration Parameters</AccordionTrigger>
          <AccordionContent>
            {deviceConfig ? (
              <div className="space-y-4 pt-2">
                <DeviceConfigEditor parameters={deviceConfig.parameters} onChange={handleConfigUpdate} />
                <Button onClick={onSaveConfig} size="sm" className="w-full">
                  <Save className="h-4 w-4 mr-2" />Save Device Configuration
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No device configuration found for this asset.</AlertDescription>
              </Alert>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="modbus-config">
          <AccordionTrigger>Modbus Communication Settings</AccordionTrigger>
          <AccordionContent>
            {modbusDevice ? (
              <div className="space-y-4 pt-2">
                <ModbusDeviceEditor
                  device={modbusDevice}
                  onDeviceUpdate={handleModbusDeviceUpdate}
                  onParamUpdate={handleModbusParamUpdate}
                  onAddParam={handleAddModbusParameter}
                  onRemoveParam={handleRemoveModbusParameter}
                />
                <Button onClick={onSaveModbus} size="sm" className="w-full">
                  <Save className="h-4 w-4 mr-2" />Save Modbus Configuration
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No Modbus configuration found for this asset.</AlertDescription>
              </Alert>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button onClick={() => onDelete(asset.id)} variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4 mr-2" />Delete Asset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges} size="sm">
          <Save className="h-4 w-4 mr-2" />Save Asset Info
        </Button>
      </div>
    </div>
  )
}

function DeviceConfigEditor({ parameters, onChange }) {
  const getParameterUnit = (param) => {
    if (param.toLowerCase().includes("voltage") || param.toLowerCase().includes("v_")) return "V"
    if (param.toLowerCase().includes("current")) return "A"
    if (param.toLowerCase().includes("power") || param.toLowerCase().includes("p_")) return "W"
    if (param.toLowerCase().includes("capacity")) return "Wh"
    if (param.toLowerCase().includes("efficiency")) return "%"
    if (param.toLowerCase().includes("soc")) return "%"
    if (param.toLowerCase().includes("frequency")) return "Hz"
    return ""
  }

  const formatParameterName = (param) => {
    const specialCases = {
      maxVoltage: "Maximum Voltage", minVoltage: "Minimum Voltage",
      maxCurrent: "Maximum Current", minCurrent: "Minimum Current",
      maxPower: "Maximum Power", maxChargeCurrent: "Maximum Charge Current",
      maxDischargeCurrent: "Maximum Discharge Current", capacity: "Capacity",
      minSOC: "Minimum State of Charge", maxSOC: "Maximum State of Charge",
      priority: "Priority Level"
    }
    return specialCases[param] || param.replace(/([A-Z])/g, " $1").trim()
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(parameters).map(([param, value]) => (
        <div key={param} className="space-y-2">
          <Label htmlFor={`param-${param}`} className="text-sm">
            {formatParameterName(param)}
          </Label>
          <div className="flex items-center space-x-2">
            <Input
              id={`param-${param}`}
              type="number"
              value={value}
              onChange={(e) => onChange(param, Number(e.target.value))}
              className="h-9"
              step={param.toLowerCase().includes("efficiency") ? "0.1" : "1"}
            />
            <span className="text-sm text-muted-foreground min-w-[30px]">
              {getParameterUnit(param)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

const ModbusParameterRow = memo(({ param, onUpdate, onRemove, canRemove }) => {
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b last:border-b-0">
      <div className="col-span-2">
        <Input value={param.name} onChange={(e) => onUpdate(param.id, "name", e.target.value)} placeholder="Name" className="h-8 text-sm" />
      </div>
      <div className="col-span-1">
        <Select value={param.registerType} onValueChange={(value) => onUpdate(param.id, "registerType", value)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="holding">Holding</SelectItem>
            <SelectItem value="input">Input</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1">
        <Input type="number" value={param.address} onChange={(e) => onUpdate(param.id, "address", e.target.value)} placeholder="Addr" className="h-8 text-sm" />
      </div>
      <div className="col-span-1">
        <Input type="number" value={param.modbusId} onChange={(e) => onUpdate(param.id, "modbusId", e.target.value)} placeholder="ID" className="h-8 text-sm" />
      </div>
      <div className="col-span-1">
        <Select value={param.dataType} onValueChange={(value) => onUpdate(param.id, "dataType", value)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="uint16">u16</SelectItem>
            <SelectItem value="int16">i16</SelectItem>
            <SelectItem value="float32">f32</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {param.dataType === "float32" && (
        <div className="col-span-1">
          <Select value={param.wordOrder} onValueChange={(value) => onUpdate(param.id, "wordOrder", value)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="big">BE</SelectItem>
              <SelectItem value="little">LE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className={param.dataType === "float32" ? "col-span-1" : "col-span-2"}>
        <Input type="number" step="any" value={param.scaleFactor} onChange={(e) => onUpdate(param.id, "scaleFactor", e.target.value)} placeholder="Scale" className="h-8 text-sm" />
      </div>
      <div className="col-span-1">
        <Input type="number" step="any" value={param.offset} onChange={(e) => onUpdate(param.id, "offset", e.target.value)} placeholder="Offset" className="h-8 text-sm" />
      </div>
      <div className="col-span-1">
        <Input type="number" min="0" max="10" value={param.decimalPlaces} onChange={(e) => onUpdate(param.id, "decimalPlaces", e.target.value)} placeholder="Dec" className="h-8 text-sm" />
      </div>
      <div className="col-span-1">
        <Input value={param.unit} onChange={(e) => onUpdate(param.id, "unit", e.target.value)} placeholder="Unit" className="h-8 text-sm" />
      </div>
      <div className="col-span-1 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => onRemove(param.id)} disabled={!canRemove} className="h-8 w-8 p-0">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
})

ModbusParameterRow.displayName = "ModbusParameterRow"

function ModbusDeviceEditor({ device, onDeviceUpdate, onParamUpdate, onAddParam, onRemoveParam }) {
  const readParams  = device.parameters.filter(p => p.mode === "read")
  const writeParams = device.parameters.filter(p => p.mode === "write")

  const tableHeader = (
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
  )

  return (
    <div className="space-y-4">
      {/* Connection Settings */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">IP Address</Label>
          <Input value={device.ipAddress} onChange={(e) => onDeviceUpdate("ipAddress", e.target.value)} placeholder="192.168.1.100" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Port</Label>
          <Input type="number" value={device.port} onChange={(e) => onDeviceUpdate("port", e.target.value)} placeholder="502" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Device Name</Label>
          <Input value={device.name} onChange={(e) => onDeviceUpdate("name", e.target.value)} placeholder="Device name" className="h-8" />
        </div>
      </div>

      {/* Read Parameters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Read Parameters ({readParams.length})</Label>
          <Button onClick={() => onAddParam("read")} variant="outline" size="sm">
            <Plus className="h-3 w-3 mr-2" />Add Read Parameter
          </Button>
        </div>
        {readParams.length > 0 && (
          <Card>
            <CardContent className="p-3">
              {tableHeader}
              {readParams.map(param => (
                <ModbusParameterRow key={param.id} param={param} onUpdate={onParamUpdate} onRemove={onRemoveParam}
                  canRemove={readParams.length > 1 || writeParams.length > 0} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Write Parameters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Write Parameters ({writeParams.length})</Label>
          <Button onClick={() => onAddParam("write")} variant="outline" size="sm">
            <Plus className="h-3 w-3 mr-2" />Add Write Parameter
          </Button>
        </div>
        {writeParams.length > 0 && (
          <Card>
            <CardContent className="p-3">
              {tableHeader}
              {writeParams.map(param => (
                <ModbusParameterRow key={param.id} param={param} onUpdate={onParamUpdate} onRemove={onRemoveParam}
                  canRemove={writeParams.length > 1 || readParams.length > 0} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function CreateAssetDialog({ onSubmit }) {
  const [newAsset, setNewAsset] = useState({ name: "", type: "PV" })

  const handleSubmit = () => {
    if (!newAsset.name) {
      toast({ title: "Error", description: "Asset name is required.", variant: "destructive" })
      return
    }
    onSubmit(newAsset)
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New Asset</DialogTitle>
        <DialogDescription>Add a new device to your site.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Display Name *</Label>
          <Input value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="e.g., Solar PV 1" />
        </div>
        <div className="space-y-2">
          <Label>Asset Type *</Label>
          <Select value={newAsset.type} onValueChange={(v) => setNewAsset({ ...newAsset, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ASSET_TYPES).map(([key, { label, icon }]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2"><span>{icon}</span><span>{label}</span></span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Auto-configuration:</strong> Creating this asset will automatically add template
            configurations to both config.json and modbus.json files.
          </AlertDescription>
        </Alert>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit}>
          <Plus className="h-4 w-4 mr-2" />Create Asset
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function EventsLog({ assets }) {
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    setIsLoading(true)
    try {
      const { data: allEvents } = await api.get('/api/settings/events?limit=50')
      setEvents(allEvents)
    } catch (error) {
      console.error("Error loading events:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-4">Loading events...</div>
  }

  return (
    <div className="space-y-2">
      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No events recorded yet.</div>
      ) : (
        events.map(event => (
          <div key={event.id} className="p-3 border rounded-md bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{event.event_type}</Badge>
                <span className="text-sm font-medium">{event.asset_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(event.event_timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}