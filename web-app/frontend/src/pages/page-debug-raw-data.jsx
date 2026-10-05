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

@File: page-debug-raw-data.jsx
@Description: Raw data explorer and export for measurements, ems-inputs and ems-outputs tables

@Created: 05 October 2026
@Last Modified: 05 October 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.3
*/

import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, Download, Loader2, RefreshCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import api from '@/lib/axios'

const TABLE_OPTIONS = ['measurements', 'ems-inputs', 'ems-outputs']

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
  const fallbackName = `raw-data-export-${Date.now()}.${fallbackExt}`
  const fileNameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i)
  return fileNameMatch?.[1] || fallbackName
}

async function readBlobError(error, fallback) {
  const blob = error.response?.data
  if (blob instanceof Blob) {
    try {
      return JSON.parse(await blob.text()).error || fallback
    } catch {
      return fallback
    }
  }
  return error.response?.data?.error || fallback
}

function formatTimestamp(timeValue) {
  const parsed = new Date(timeValue)
  return Number.isNaN(parsed.getTime()) ? String(timeValue || '') : parsed.toLocaleString()
}

function PreviewTable({ tableName, data, previewLimit }) {
  const rows = data?.rows || []
  const showsAssetKey = tableName === 'measurements'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {tableName}
          <Badge variant="outline">{data?.count ?? 0} rows</Badge>
        </CardTitle>
        <CardDescription>
          Latest {Math.min(rows.length, previewLimit)} of {data?.count ?? 0} rows in the selected range
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>{showsAssetKey ? 'Asset' : 'Objective'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.source}-${row.id}`}>
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimestamp(row.time)}</TableCell>
                  <TableCell className="font-medium">{row.parameter}</TableCell>
                  <TableCell className="font-mono">{row.value}</TableCell>
                  <TableCell>{row.unit || '—'}</TableCell>
                  <TableCell>{row.quality || '—'}</TableCell>
                  <TableCell>{(showsAssetKey ? row.asset_key : row.objective) || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No data found for the selected range.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default function RawDataDebugPage() {
  const [start, setStart] = useState(() => new Date(Date.now() - 60 * 60 * 1000))
  const [end, setEnd] = useState(() => new Date())
  const [selectedTables, setSelectedTables] = useState(TABLE_OPTIONS)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const toggleTable = (tableName) => {
    setSelectedTables((current) =>
      current.includes(tableName) ? current.filter((name) => name !== tableName) : [...current, tableName]
    )
  }

  const validate = () => {
    if (end <= start) {
      setError('End date-time must be greater than start date-time.')
      return false
    }
    if (selectedTables.length === 0) {
      setError('Select at least one table.')
      return false
    }
    return true
  }

  const buildPayload = () => ({
    start: start.toISOString(),
    end: end.toISOString(),
    tables: selectedTables,
  })

  const runQuery = async () => {
    if (!validate()) return

    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post('/api/debug-raw-data/query', buildPayload())
      setResult(data)
    } catch (queryError) {
      console.error('Error fetching raw data:', queryError)
      setError(queryError.response?.data?.error || 'Failed to fetch raw data.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const exportData = async (formatValue) => {
    if (!validate()) return

    setExporting(true)
    setError(null)
    try {
      const response = await api.post(`/api/debug-raw-data/export?format=${formatValue}`, buildPayload(), {
        responseType: 'blob',
      })

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
      setError(await readBlobError(exportError, `Failed to export ${formatValue.toUpperCase()} file.`))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">Raw Data Export</h1>
        <p className="max-w-3xl text-sm text-gray-600">
          Preview and export unaggregated rows from the measurements, ems-inputs and ems-outputs tables for a given time range.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query Controls</CardTitle>
          <CardDescription>
            Select tables and a time range (start inclusive, end exclusive). XLSX creates one sheet per table; CSV combines all tables in one file with a source column.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DateTimePicker label="Start" value={start} onChange={setStart} />
            <DateTimePicker label="End" value={end} onChange={setEnd} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Tables</p>
            <div className="flex flex-wrap gap-2">
              {TABLE_OPTIONS.map((tableName) => (
                <Button
                  key={tableName}
                  type="button"
                  variant={selectedTables.includes(tableName) ? 'default' : 'outline'}
                  onClick={() => toggleTable(tableName)}
                >
                  {tableName}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runQuery} disabled={loading || exporting}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Preview
            </Button>
            <Button variant="outline" onClick={() => exportData('csv')} disabled={loading || exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => exportData('xlsx')} disabled={loading || exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export XLSX
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {result
        ? Object.entries(result.tables).map(([tableName, data]) => (
            <PreviewTable key={tableName} tableName={tableName} data={data} previewLimit={result.previewLimit} />
          ))
        : null}
    </div>
  )
}