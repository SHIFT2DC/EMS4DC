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

File: page-sys-info.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Battery, Cpu, HardDrive, Thermometer } from 'lucide-react';

export default function SystemInfo() {
  const [systemInfo, setSystemInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3001"
        const response = await fetch(`${API_BASE_URL}/api/system-info`);
        if (!response.ok) {
          throw new Error('Failed to fetch system information');
        }
        const data = await response.json();
        setSystemInfo(data);
      } catch (err) {
        console.error('Error fetching system info:', err);
        setError(err.message);
      }
    };

    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const InfoItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-center space-x-2">
      <Icon className="w-5 h-5 text-primary" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );

  const SkeletonInfoItem = () => (
    <div className="flex items-center space-x-2">
      <Skeleton className="w-5 h-5 rounded-full" />
      <Skeleton className="w-24 h-4" />
      <Skeleton className="w-16 h-4" />
    </div>
  );

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center p-4 text-red-500">
          <AlertCircle className="w-6 h-6 mr-2" />
          <span>Error: {error}</span>
        </div>
      );
    }

    if (!systemInfo) {
      return (
        <CardContent className="space-y-4">
          {[...Array(8)].map((_, i) => <SkeletonInfoItem key={i} />)}
          <Skeleton className="w-full h-4 mt-4" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-full h-2" />
            </div>
          ))}
        </CardContent>
      );
    }

    return (
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <InfoItem icon={HardDrive} label="OS" value={`${systemInfo.os.distro} ${systemInfo.os.release}`} />
          <InfoItem icon={Cpu} label="CPU" value={systemInfo.cpu.brand} />
          <InfoItem icon={Cpu} label="Cores" value={`${systemInfo.cpu.physicalCores} (${systemInfo.cpu.cores})`} />
          <InfoItem 
            icon={Thermometer} 
            label="CPU Temp" 
            value={systemInfo.cpuTemp !== null ? `${systemInfo.cpuTemp.toFixed(1)}°C` : 'N/A'} 
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">CPU Usage</h3>
          <div className="grid grid-cols-2 gap-2">
            {systemInfo.cpuUsage.map((usage, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Core {index}</span>
                  <span>{usage}%</span>
                </div>
                <Progress value={parseFloat(usage)} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Memory Usage</h3>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Used</span>
            <span>
              {systemInfo.memoryUsage.used} / {systemInfo.memoryUsage.total} GB
            </span>
          </div>
          <Progress
            value={(systemInfo.memoryUsage.used / systemInfo.memoryUsage.total) * 100}
            className="h-2"
          />
        </div>

        {systemInfo.battery.hasBattery && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Battery</h3>
            <div className="flex items-center space-x-2">
              <Battery className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">
                {systemInfo.battery.percent}% {systemInfo.battery.isCharging ? '(Charging)' : ''}
              </span>
              <Progress value={systemInfo.battery.percent} className="h-2 flex-grow" />
            </div>
          </div>
        )}
      </CardContent>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">System Information</CardTitle>
      </CardHeader>
      {renderContent()}
    </Card>
  );
}