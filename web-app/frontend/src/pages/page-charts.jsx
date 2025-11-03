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

File: page-charts.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { format, addDays, subDays } from "date-fns"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

function Charts() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    fetchDataForDate(selectedDate)
  }, [selectedDate])

  const fetchDataForDate = async (date) => {
    try {
      const formattedDate = format(date, "yyyy-MM-dd")
      const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
      const response = await fetch(`${API_BASE_URL}/api/chart-data?date=${formattedDate}`)
      const data = await response.json()
      setChartData(data)
    } catch (error) {
      console.error("Error fetching chart data:", error)
    }
  }

  const handlePreviousDay = () => {
    setSelectedDate((prevDate) => subDays(prevDate, 1))
  }

  const handleNextDay = () => {
    setSelectedDate((prevDate) => addDays(prevDate, 1))
  }

  return (
    <div className="w-full mx-10 space-y-6">
      <h1 className="text-4xl font-bold mt-8">Charts</h1>
      <div className="flex items-center space-x-4">
        <Button onClick={handlePreviousDay}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          dateFormat="MMMM d, yyyy"
          className="border rounded p-2"
        />
        <Button onClick={handleNextDay}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Data for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={700}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis label={{ value: "Power (kW)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="PV Power" stroke="#3b82f6" name="PV Power" />
              <Line type="monotone" dataKey="Battery Power" stroke="#f97316" name="Battery Power" />
              <Line type="monotone" dataKey="Active Front End Power" stroke="#10b981" name="Active Front End Power" />
              <Line type="monotone" dataKey="Load Power" stroke="#b9b726ff" name="Load Power" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>EV Charger Power Flow for {format(selectedDate, "MMMM d, yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis label={{ value: "Power (kW)", angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Unidirectional Charger"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Unidirectional Charger"
              />
              <Line
                type="monotone"
                dataKey="Bidirectional EV Charger"
                stroke="#ec4899"
                strokeWidth={2}
                name="Bidirectional EV Charger"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

export default Charts
