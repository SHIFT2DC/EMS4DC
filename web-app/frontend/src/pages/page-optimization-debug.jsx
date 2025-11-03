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

File: page-optimization-debug.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Database, Clock, TrendingUp, TrendingDown } from "lucide-react"

export default function EMSDebugPage() {
  const [inputs, setInputs] = useState([])
  const [outputs, setOutputs] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
        const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
        const [inputsRes, outputsRes] = await Promise.all([fetch(`${API_BASE_URL}/api/ems-inputs`), fetch(`${API_BASE_URL}/api/ems-outputs`)])

      if (inputsRes.ok && outputsRes.ok) {
        const inputsData = await inputsRes.json()
        const outputsData = await outputsRes.json()
        setInputs(inputsData)
        setOutputs(outputsData)
        setLastRefresh(new Date())
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    let interval
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleString()
  }

  const getQualityBadge = (quality) => {
    if (!quality) return <Badge variant="secondary">Unknown</Badge>

    const variant =
      quality.toLowerCase() === "good" ? "default" : quality.toLowerCase() === "bad" ? "destructive" : "secondary"

    return <Badge variant={variant}>{quality}</Badge>
  }

  const getRecentEntries = (data) => {
    return data.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 150)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">EMS Debug Dashboard</h1>
          <p className="text-muted-foreground">
            Compare EMS inputs and outputs side by side (Updates every 15 minutes)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            <Clock className="w-4 h-4 mr-2" />
            Auto Refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          <Button onClick={fetchData} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {lastRefresh && <div className="text-sm text-muted-foreground">Last updated: {lastRefresh.toLocaleString()}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inputs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inputs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outputs</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outputs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inputs.length + outputs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Side by Side Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EMS Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              EMS Inputs ({inputs.length})
            </CardTitle>
            <CardDescription>Recent input data (last 150 entries)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Input ID</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getRecentEntries(inputs).map((input) => (
                    <TableRow key={input.id}>
                      <TableCell className="font-mono text-xs">{input.id}</TableCell>
                      <TableCell className="font-medium">{input.input_id}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTime(input.time)}</TableCell>
                      <TableCell className="font-medium">{input.parameter}</TableCell>
                      <TableCell className="font-mono">{Number.parseFloat(input.value).toFixed(2)}</TableCell>
                      <TableCell>{input.unit}</TableCell>
                      <TableCell>{getQualityBadge(input.quality)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {inputs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No input data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* EMS Outputs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              EMS Outputs ({outputs.length})
            </CardTitle>
            <CardDescription>Recent output data (last 150 entries)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Output ID</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getRecentEntries(outputs).map((output) => (
                    <TableRow key={output.id}>
                      <TableCell className="font-mono text-xs">{output.id}</TableCell>
                      <TableCell className="font-medium">{output.output_id}</TableCell>
                      <TableCell className="font-mono text-xs">{formatTime(output.time)}</TableCell>
                      <TableCell className="font-medium">{output.parameter}</TableCell>
                      <TableCell className="font-mono">{Number.parseFloat(output.value).toFixed(2)}</TableCell>
                      <TableCell>{output.unit}</TableCell>
                      <TableCell>{getQualityBadge(output.quality)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {outputs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No output data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
