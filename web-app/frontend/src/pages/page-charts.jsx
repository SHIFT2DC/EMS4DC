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
@Description: Interactive charting page with daily profiles and custom viewer tabs

@Created: 1st January 2025
@Last Modified: 14 July 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.3
*/


import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import api from '@/lib/axios'

const PROFILE_GRANULARITY_OPTIONS = [
  { value: '300', label: '5 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: '3600', label: '1 hour' },
]

const CUSTOM_GRANULARITY_OPTIONS = [
  { value: '10', label: '10 seconds' },
  { value: '60', label: '1 minute' },
  { value: '300', label: '5 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: '3600', label: '1 hour' },
]

const ASSET_COLORS = {
  PV: '#b45309',
  WIND: '#0f766e',
  BESS: '#ea580c',
  AFE: '#2563eb',
  GRID: '#1d4ed8',
  LOAD: '#7c3aed',
  CRITICAL_LOAD: '#dc2626',
  UNI_EV: '#0891b2',
  BI_EV: '#db2777',
}

const LINE_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#db2777',
]

const DEFAULT_CUSTOM_CHARTS = [
  { id: 'chart-1', title: 'Chart 1', parameters: [] },
  { id: 'chart-2', title: 'Chart 2', parameters: [] },
]

function ChartSkeleton({ height = 420 }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="w-full" style={{ height: `${height}px` }} />
        </div>
      </CardContent>
    </Card>
  )
}

function DateTimePicker({ label, value, onChange }) {
  const timeValue = format(value, 'HH:mm:ss')

  const updateTime = (nextTime) => {
    const [hours = '00', minutes = '00', seconds = '00'] = nextTime.split(':')
    const nextDate = new Date(value)
    nextDate.setHours(Number(hours), Number(minutes), Number(seconds), 0)
    onChange(nextDate)
  }

  const updateDate = (nextDay) => {
    if (!nextDay) return
    const nextDate = new Date(nextDay)
    nextDate.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), 0)
    onChange(nextDate)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(value, 'PPP HH:mm:ss')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto space-y-3 p-3" align="start">
          <Calendar mode="single" selected={value} onSelect={updateDate} initialFocus />
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">Time</p>
            <Input type="time" step="1" value={timeValue} onChange={(event) => updateTime(event.target.value)} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ParameterSelectionCard({ chart, parameters, searchTerm, onSearchChange, onToggleParameter, onTitleChange, onRemove }) {
  const groupedParameters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const filtered = parameters.filter((parameter) => {
      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        parameter.label,
        parameter.assetName,
        parameter.deviceName,
        parameter.assetKey,
        parameter.assetType,
        parameter.parameterName,
        parameter.telemetryName,
        parameter.description,
        parameter.unit,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })

    return filtered.reduce((accumulator, parameter) => {
      const groupKey = `${parameter.assetName} (${parameter.assetKey})`
      if (!accumulator[groupKey]) {
        accumulator[groupKey] = []
      }

      accumulator[groupKey].push(parameter)
      return accumulator
    }, {})
  }, [parameters, searchTerm])

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl">{chart.title || 'Untitled chart'}</CardTitle>
            <CardDescription>{chart.parameters.length} parameters selected</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              value={chart.title}
              onChange={(event) => onTitleChange(chart.id, event.target.value)}
              placeholder="Chart title"
              className="lg:w-56"
            />
            <Button variant="outline" size="icon" onClick={() => onRemove(chart.id)} disabled={false}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(event) => onSearchChange(chart.id, event.target.value)}
            placeholder="Filter by device, asset key, parameter, or telemetry name"
            className="pl-9"
          />
        </div>

        <div className="max-h-[24rem] space-y-4 overflow-y-auto rounded-lg border border-gray-200 p-4">
          {Object.entries(groupedParameters).length === 0 ? (
            <p className="text-sm text-gray-500">No parameters match the current filter.</p>
          ) : (
            Object.entries(groupedParameters).map(([groupName, groupParameters]) => (
              <div key={groupName} className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">{groupName}</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {groupParameters.map((parameter) => {
                    const checked = chart.parameters.includes(parameter.telemetryName)
                    return (
                      <label
                        key={parameter.telemetryName}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors',
                          checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                          checked={checked}
                          onChange={() => onToggleParameter(chart.id, parameter.telemetryName)}
                        />
                        <span className="space-y-1">
                          <span className="block font-medium text-gray-900">{parameter.parameterName}</span>
                          <span className="block text-xs text-gray-500">
                            {[parameter.deviceName || parameter.assetName, parameter.assetKey].filter(Boolean).join(' • ')}
                          </span>
                          <span className="block text-xs text-gray-500">{parameter.telemetryName} • {parameter.unit || 'No unit'} • {parameter.assetType}</span>
                          {parameter.description ? (
                            <span className="block text-xs text-gray-500">{parameter.description}</span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MeasurementChart({ title, description, data, lines, yAxisLabel = 'Value' }) {
  if (!lines.length) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" minTickGap={32} />
            <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            {lines.map((line, index) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color || LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={2}
                name={line.name}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function Charts() {
  const [activeTab, setActiveTab] = useState('profiles')

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [profileGranularity, setProfileGranularity] = useState('3600')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [profileResult, setProfileResult] = useState({ chartData: [], assets: [] })

  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState(null)
  const [metadata, setMetadata] = useState({ assets: [], parameters: [] })

  const [customGranularity, setCustomGranularity] = useState('60')
  const [customLoading, setCustomLoading] = useState(false)
  const [customError, setCustomError] = useState(null)
  const [customStart, setCustomStart] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - 2 * 60 * 60 * 1000)
  })
  const [customEnd, setCustomEnd] = useState(new Date())
  const [customCharts, setCustomCharts] = useState(DEFAULT_CUSTOM_CHARTS)
  const [chartSearch, setChartSearch] = useState({ 'chart-1': '', 'chart-2': '' })
  const [customResult, setCustomResult] = useState(null)

  useEffect(() => {
    fetchProfileData(selectedDate, profileGranularity)
  }, [selectedDate, profileGranularity])

  useEffect(() => {
    fetchMetadata()
  }, [])

  useEffect(() => {
    if (activeTab !== 'custom' || metadataLoading) {
      return
    }

    const hasDeviceNames = (metadata.parameters || []).some((parameter) => (
      typeof parameter.deviceName === 'string' && parameter.deviceName.trim().length > 0
    ))

    if (!hasDeviceNames) {
      fetchMetadata()
    }
  }, [activeTab])

  const fetchProfileData = async (date, granularity) => {
    setProfileLoading(true)
    setProfileError(null)
    try {
      const formattedDate = format(date, 'yyyy-MM-dd')
      const { data } = await api.get(`/api/chart-data/profile?date=${formattedDate}&granularity=${granularity}`)
      setProfileResult(data)
    } catch (error) {
      console.error('Error fetching profile chart data:', error)
      setProfileError(error.response?.data?.error || 'Failed to fetch daily profile data.')
      setProfileResult({ chartData: [], assets: [] })
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchMetadata = async () => {
    setMetadataLoading(true)
    setMetadataError(null)
    try {
      const { data } = await api.get('/api/chart-data/metadata')
      setMetadata(data)
    } catch (error) {
      console.error('Error fetching chart metadata:', error)
      setMetadataError(error.response?.data?.error || 'Failed to load parameter catalog.')
    } finally {
      setMetadataLoading(false)
    }
  }

  const runCustomQuery = async () => {
    setCustomLoading(true)
    setCustomError(null)
    try {
      const payload = {
        start: customStart.toISOString(),
        end: customEnd.toISOString(),
        granularity: customGranularity,
        charts: customCharts,
      }
      const { data } = await api.post('/api/chart-data/custom/query', payload)
      setCustomResult(data)
    } catch (error) {
      console.error('Error fetching custom chart data:', error)
      setCustomError(error.response?.data?.error || 'Failed to run custom chart query.')
      setCustomResult(null)
    } finally {
      setCustomLoading(false)
    }
  }

  const exportCustomData = async (formatValue) => {
    try {
      const response = await api.post(
        `/api/chart-data/custom/export?format=${formatValue}`,
        {
          start: customStart.toISOString(),
          end: customEnd.toISOString(),
          granularity: customGranularity,
          charts: customCharts,
        },
        { responseType: 'blob' }
      )

      const fileName = getDownloadName(response.headers['content-disposition'], formatValue)
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error(`Error exporting ${formatValue}:`, error)
      setCustomError(error.response?.data?.error || `Failed to export ${formatValue.toUpperCase()} file.`)
    }
  }

  const handlePreviousDay = () => {
    const nextDate = new Date(selectedDate)
    nextDate.setDate(nextDate.getDate() - 1)
    setSelectedDate(nextDate)
  }

  const handleNextDay = () => {
    const nextDate = new Date(selectedDate)
    nextDate.setDate(nextDate.getDate() + 1)
    setSelectedDate(nextDate)
  }

  const toggleChartParameter = (chartId, telemetryName) => {
    setCustomCharts((currentCharts) => currentCharts.map((chart) => {
      if (chart.id !== chartId) return chart

      const hasParameter = chart.parameters.includes(telemetryName)
      return {
        ...chart,
        parameters: hasParameter
          ? chart.parameters.filter((item) => item !== telemetryName)
          : [...chart.parameters, telemetryName],
      }
    }))
  }

  const updateChartTitle = (chartId, title) => {
    setCustomCharts((currentCharts) => currentCharts.map((chart) => (
      chart.id === chartId ? { ...chart, title } : chart
    )))
  }

  const addChartDefinition = () => {
    const nextIndex = customCharts.length + 1
    const nextId = `chart-${Date.now()}`
    setCustomCharts((currentCharts) => ([
      ...currentCharts,
      { id: nextId, title: `Chart ${nextIndex}`, parameters: [] },
    ]))
    setChartSearch((current) => ({ ...current, [nextId]: '' }))
  }

  const removeChartDefinition = (chartId) => {
    if (customCharts.length === 1) {
      return
    }

    setCustomCharts((currentCharts) => currentCharts.filter((chart) => chart.id !== chartId))
    setChartSearch((current) => {
      const nextSearch = { ...current }
      delete nextSearch[chartId]
      return nextSearch
    })
  }

  const groupedProfileAssets = useMemo(() => {
    const assets = profileResult.assets || []
    return {
      generation: assets.filter((asset) => asset.type === 'PV' || asset.type === 'WIND'),
      storage: assets.filter((asset) => asset.type === 'BESS'),
      grid: assets.filter((asset) => asset.type === 'AFE' || asset.type === 'GRID'),
      loads: assets.filter((asset) => asset.type === 'LOAD' || asset.type === 'CRITICAL_LOAD'),
      ev: assets.filter((asset) => asset.type === 'UNI_EV' || asset.type === 'BI_EV'),
      all: assets,
    }
  }, [profileResult.assets])

  const requestedProfileGranularity = Number(profileResult.requestedGranularitySeconds || profileGranularity)
  const effectiveProfileGranularity = Number(profileResult.granularitySeconds || profileGranularity)
  const requestedCustomGranularity = Number(customResult?.requestedGranularitySeconds || customGranularity)
  const effectiveCustomGranularity = Number(customResult?.granularitySeconds || customGranularity)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">Charts Workspace</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Explore site measurements as daily profiles or build custom multi-chart views with fine-grained sampling and export support.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100">
          <TabsTrigger value="profiles">Daily Profiles</TabsTrigger>
          <TabsTrigger value="custom">Custom Viewer</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Profile Controls</CardTitle>
              <CardDescription>
                Compare measured asset power and forecast power over a single day using configurable aggregation.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex items-center gap-2">
                  <Button onClick={handlePreviousDay} variant="outline" size="icon">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <Button onClick={handleNextDay} variant="outline" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Sampling granularity</p>
                  <Select value={profileGranularity} onValueChange={setProfileGranularity}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select granularity" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFILE_GRANULARITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {effectiveProfileGranularity !== requestedProfileGranularity
                  ? `Server adjusted the requested granularity to ${profileResult.granularityLabel} to keep the profile responsive.`
                  : `Current aggregation: ${profileResult.granularityLabel || '1 hour'}.`}
              </div>
            </CardContent>
          </Card>

          {profileError ? (
            <Alert variant="destructive">
              <AlertTitle>Daily profile error</AlertTitle>
              <AlertDescription>{profileError}</AlertDescription>
            </Alert>
          ) : null}

          {profileLoading ? (
            <div className="space-y-6">
              <ChartSkeleton height={520} />
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : !profileResult.assets?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-600">No active assets were found for charting.</CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <ProfileChartBlock
                title="Combined Power Flow"
                selectedDate={selectedDate}
                chartData={profileResult.chartData}
                assets={groupedProfileAssets.all}
              />
              <ProfileChartBlock
                title="Energy Generation"
                selectedDate={selectedDate}
                chartData={profileResult.chartData}
                assets={groupedProfileAssets.generation}
              />
              <ProfileChartBlock
                title="Battery Storage"
                selectedDate={selectedDate}
                chartData={profileResult.chartData}
                assets={groupedProfileAssets.storage}
              />
              <ProfileChartBlock
                title="Grid Connection"
                selectedDate={selectedDate}
                chartData={profileResult.chartData}
                assets={groupedProfileAssets.grid}
              />
              <ProfileChartBlock
                title="Loads"
                selectedDate={selectedDate}
                chartData={profileResult.chartData}
                assets={groupedProfileAssets.loads}
              />
              <ProfileChartBlock
                title="EV Chargers"
                selectedDate={selectedDate}
                chartData={profileResult.chartData}
                assets={groupedProfileAssets.ev}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Viewer Controls</CardTitle>
              <CardDescription>
                Select a time range, assign telemetry parameters to one or more charts, and export the aggregated result set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <DateTimePicker label="Start" value={customStart} onChange={setCustomStart} />
                <DateTimePicker label="End" value={customEnd} onChange={setCustomEnd} />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Sampling granularity</p>
                  <Select value={customGranularity} onValueChange={setCustomGranularity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select granularity" />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_GRANULARITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  Use 10-second or 1-minute buckets for short windows. For larger windows the backend may move to a coarser bucket size automatically.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={addChartDefinition} className="gap-2">
                    <Plus className="h-4 w-4" /> Add chart
                  </Button>
                  <Button onClick={runCustomQuery} disabled={customLoading || metadataLoading} className="gap-2">
                    {customLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Run query
                  </Button>
                  <Button variant="outline" onClick={() => exportCustomData('csv')} disabled={!customResult || customLoading} className="gap-2">
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                  <Button variant="outline" onClick={() => exportCustomData('xlsx')} disabled={!customResult || customLoading} className="gap-2">
                    <Download className="h-4 w-4" /> Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {metadataError ? (
            <Alert variant="destructive">
              <AlertTitle>Parameter catalog error</AlertTitle>
              <AlertDescription>{metadataError}</AlertDescription>
            </Alert>
          ) : null}

          {customError ? (
            <Alert variant="destructive">
              <AlertTitle>Custom viewer error</AlertTitle>
              <AlertDescription>{customError}</AlertDescription>
            </Alert>
          ) : null}

          {metadataLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="space-y-6">
              {customCharts.map((chart) => (
                <ParameterSelectionCard
                  key={chart.id}
                  chart={chart}
                  parameters={metadata.parameters || []}
                  searchTerm={chartSearch[chart.id] || ''}
                  onSearchChange={(chartId, value) => setChartSearch((current) => ({ ...current, [chartId]: value }))}
                  onToggleParameter={toggleChartParameter}
                  onTitleChange={updateChartTitle}
                  onRemove={removeChartDefinition}
                />
              ))}
            </div>
          )}

          {customLoading ? (
            <ChartSkeleton height={480} />
          ) : customResult ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Query Summary</CardTitle>
                  <CardDescription>
                    {effectiveCustomGranularity !== requestedCustomGranularity
                      ? `Requested ${lookupGranularityLabel(requestedCustomGranularity)} but the server used ${customResult.granularityLabel} for performance.`
                      : `Current aggregation: ${customResult.granularityLabel}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chart</TableHead>
                        <TableHead>Parameters</TableHead>
                        <TableHead>Time range</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customResult.charts.map((chart) => (
                        <TableRow key={chart.id}>
                          <TableCell className="font-medium">{chart.title}</TableCell>
                          <TableCell>{chart.parameters.map((parameter) => parameter.parameterName).join(', ') || 'None'}</TableCell>
                          <TableCell>
                            {format(new Date(customResult.start), 'PPP HH:mm:ss')} to {format(new Date(customResult.end), 'PPP HH:mm:ss')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {customResult.charts.map((chart, chartIndex) => (
                <MeasurementChart
                  key={chart.id}
                  title={chart.title}
                  description={`${chart.parameters.length} selected telemetry series`}
                  data={chart.data}
                  lines={chart.parameters.map((parameter, lineIndex) => ({
                    key: parameter.telemetryName,
                    name: `${parameter.label}${parameter.unit ? ` (${parameter.unit})` : ''}`,
                    color: LINE_COLORS[(chartIndex + lineIndex) % LINE_COLORS.length],
                  }))}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-600">
                Configure one or more charts, then run the query to display custom telemetry traces.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileChartBlock({ title, selectedDate, chartData, assets }) {
  if (!assets.length) {
    return null
  }

  return (
    <MeasurementChart
      title={`${title} - ${format(selectedDate, 'MMMM d, yyyy')}`}
      description={`${assets.length} assets shown`}
      data={chartData}
      lines={assets.flatMap((asset, index) => {
        const color = ASSET_COLORS[asset.type] || LINE_COLORS[index % LINE_COLORS.length]
        return [
          {
            key: asset.name,
            name: asset.name,
            color,
          },
          {
            key: `${asset.name} (Forecast)`,
            name: `${asset.name} (Forecast)`,
            color,
          },
        ]
      })}
      yAxisLabel="Power (kW)"
    />
  )
}

function lookupGranularityLabel(seconds) {
  const allOptions = [...PROFILE_GRANULARITY_OPTIONS, ...CUSTOM_GRANULARITY_OPTIONS]
  return allOptions.find((option) => Number(option.value) === Number(seconds))?.label || `${seconds} seconds`
}

function getDownloadName(contentDisposition, extension) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i)
  if (match?.[1]) {
    return match[1]
  }

  return `chart-export.${extension}`
}

export default Charts