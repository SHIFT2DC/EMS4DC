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

@File: page-optimization-debug.jsx
@Description: Optimization debug data explorer with time-range query and export

@Created: 1st January 2025
@Last Modified: 21 July 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.3
*/

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  CalendarIcon,
  Clock,
  Database,
  Download,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import api from '@/lib/axios'

const GRANULARITY_OPTIONS = [
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
  { value: '3600', label: '1 hour' },
  { value: '7200', label: '2 hours' },
  { value: '14400', label: '4 hours' },
  { value: '21600', label: '6 hours' },
  { value: '43200', label: '12 hours' },
  { value: '86400', label: '1 day' },
]

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

function getDownloadName(contentDisposition, fallbackExt) {
  const fallbackName = `optimization-export-${Date.now()}.${fallbackExt}`
  if (!contentDisposition) {
    return fallbackName
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  if (!fileNameMatch?.[1]) {
    return fallbackName
  }

  return fileNameMatch[1]
}

export default function EMSDebugPage() {
  const [inputs, setInputs] = useState([])
  const [outputs, setOutputs] = useState([])
  const [start, setStart] = useState(() => {
    const now = new Date()
    return new Date(now.getTime() - 24 * 60 * 60 * 1000)
  })
  const [end, setEnd] = useState(new Date())
  const [granularity, setGranularity] = useState('900')
  const [resultMeta, setResultMeta] = useState({
    requestedGranularitySeconds: 900,
    granularitySeconds: 900,
    granularityLabel: '15 minutes',
    totalRows: 0,
  })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = async (options = {}) => {
    const overrideStart = options.start || start
    const overrideEnd = options.end || end
    const overrideGranularity = options.granularity || granularity

    if (overrideEnd <= overrideStart) {
      setError('End date-time must be greater than start date-time.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const payload = {
        start: overrideStart.toISOString(),
        end: overrideEnd.toISOString(),
        granularity: overrideGranularity,
      }
      const { data } = await api.post('/api/ems-debug/query', payload)

      setInputs(Array.isArray(data.inputs) ? data.inputs : [])
      setOutputs(Array.isArray(data.outputs) ? data.outputs : [])
      setResultMeta({
        requestedGranularitySeconds: Number(data.requestedGranularitySeconds || overrideGranularity),
        granularitySeconds: Number(data.granularitySeconds || overrideGranularity),
        granularityLabel: data.granularityLabel || 'Unknown',
        totalRows: Number(data.totalRows || 0),
      })
      setLastRefresh(new Date())
    } catch (fetchError) {
      console.error('Error fetching optimization debug data:', fetchError)
      setError(fetchError.response?.data?.error || 'Failed to fetch optimization debug data.')
      setInputs([])
      setOutputs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData({ start, end, granularity })
  }, [])

  useEffect(() => {
    if (end <= start) {
      return
    }

    fetchData({ start, end, granularity })
  }, [start, end, granularity])

  useEffect(() => {
    if (!autoRefresh) {
      return undefined
    }

    const intervalId = setInterval(() => {
      fetchData({ start, end, granularity })
    }, 30000)

    return () => clearInterval(intervalId)
  }, [autoRefresh, start, end, granularity])

  const exportData = async (formatValue) => {
    if (end <= start) {
      setError('End date-time must be greater than start date-time.')
      return
    }

    setExporting(true)
    setError(null)
    try {
      const response = await api.post(
        `/api/ems-debug/export?format=${formatValue}`,
        {
          start: start.toISOString(),
          end: end.toISOString(),
          granularity,
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
    } catch (exportError) {
      console.error(`Error exporting ${formatValue}:`, exportError)
      setError(exportError.response?.data?.error || `Failed to export ${formatValue.toUpperCase()} file.`)
    } finally {
      setExporting(false)
    }
  }

  const formatTimestamp = (timeValue) => {
    const parsed = new Date(timeValue)
    if (Number.isNaN(parsed.getTime())) {
      return String(timeValue || '')
    }

    return parsed.toLocaleString()
  }

  const hasUpscaledGranularity = resultMeta.granularitySeconds > resultMeta.requestedGranularitySeconds
  const totalRows = useMemo(() => inputs.length + outputs.length, [inputs, outputs])

  const displayInputs = useMemo(
    () => [...inputs].sort((left, right) => new Date(right.bucket).getTime() - new Date(left.bucket).getTime()),
    [inputs]
  )

  const displayOutputs = useMemo(
    () => [...outputs].sort((left, right) => new Date(right.bucket).getTime() - new Date(left.bucket).getTime()),
    [outputs]
  )

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">Optimization Debug Workspace</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Query and export optimization input/output telemetry from EMS tables across any time range with adaptive resampling.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query Controls</CardTitle>
          <CardDescription>
            Choose a start/end window and preferred granularity. Ranges longer than 2 days are automatically upsampled to at least hourly buckets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DateTimePicker label="Start" value={start} onChange={setStart} />
            <DateTimePicker label="End" value={end} onChange={setEnd} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Granularity</p>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose granularity" />
                </SelectTrigger>
                <SelectContent>
                  {GRANULARITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => fetchData({ start, end, granularity })} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Run Query
            </Button>
            <Button variant="outline" onClick={() => exportData('csv')} disabled={loading || exporting}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportData('xlsx')} disabled={loading || exporting}>
              <Download className="mr-2 h-4 w-4" />
              Export XLSX
            </Button>
            <Button variant={autoRefresh ? 'default' : 'outline'} onClick={() => setAutoRefresh((current) => !current)}>
              <Clock className="mr-2 h-4 w-4" />
              Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Query failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-white">
              Requested: {GRANULARITY_OPTIONS.find((item) => item.value === String(resultMeta.requestedGranularitySeconds))?.label || `${resultMeta.requestedGranularitySeconds}s`}
            </Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              Effective: {resultMeta.granularityLabel}
            </Badge>
            {hasUpscaledGranularity ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                Auto-upscaled for range
              </Badge>
            ) : null}
            <Badge variant="outline" className="bg-white">
              Rows: {resultMeta.totalRows || totalRows}
            </Badge>
            {lastRefresh ? (
              <Badge variant="outline" className="bg-white">
                Last updated {lastRefresh.toLocaleTimeString()}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Input Buckets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inputs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Output Buckets</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outputs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Buckets</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRows}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              EMS Inputs ({inputs.length})
            </CardTitle>
            <CardDescription>Resampled averages by timestamp bucket and parameter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Avg Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayInputs.map((row) => (
                    <TableRow key={`${row.source}-${row.bucket}-${row.parameter}`}>
                      <TableCell className="font-mono text-xs">{formatTimestamp(row.bucket)}</TableCell>
                      <TableCell className="font-medium">{row.parameter}</TableCell>
                      <TableCell className="font-mono">{Number(row.value).toFixed(3)}</TableCell>
                      <TableCell>{row.unit || '—'}</TableCell>
                      <TableCell>{row.sampleCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {displayInputs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No input data found for the selected range.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              EMS Outputs ({outputs.length})
            </CardTitle>
            <CardDescription>Resampled averages by timestamp bucket and parameter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Avg Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Samples</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayOutputs.map((row) => (
                    <TableRow key={`${row.source}-${row.bucket}-${row.parameter}`}>
                      <TableCell className="font-mono text-xs">{formatTimestamp(row.bucket)}</TableCell>
                      <TableCell className="font-medium">{row.parameter}</TableCell>
                      <TableCell className="font-mono">{Number(row.value).toFixed(3)}</TableCell>
                      <TableCell>{row.unit || '—'}</TableCell>
                      <TableCell>{row.sampleCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {displayOutputs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No output data found for the selected range.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}