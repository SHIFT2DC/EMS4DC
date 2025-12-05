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

File: page-sys-info.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 24th November 2025
Version: v1.2.0
*/

import express from '../../frontend/node_modules/express/index.js';
import si from '../../frontend/node_modules/systeminformation/lib/index.js';

const router = express.Router();

// Endpoint to get data about system
router.get('/', async (req, res) => {
  try {
    // Start PowerShell for Windows CPU usage optimization
    si.powerShellStart();

    const [cpu, mem, osInfo, currentLoad, temp, battery] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.currentLoad(),
      si.cpuTemperature(),
      si.battery()
    ]);

    // Release PowerShell when done
    si.powerShellRelease();

    const systemInfo = {
      os: {
        distro: osInfo.distro,
        platform: osInfo.platform,
        release: osInfo.release,
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
      },
      cpuTemp: temp.main,
      cpuUsage: currentLoad.cpus.map(cpu => cpu.load.toFixed(1)),
      memoryUsage: {
        total: (mem.total / (1024 * 1024 * 1024)).toFixed(2),
        used: (mem.used / (1024 * 1024 * 1024)).toFixed(2),
        free: (mem.free / (1024 * 1024 * 1024)).toFixed(2),
      },
      battery: {
        hasBattery: battery.hasbattery,
        percent: battery.percent,
        isCharging: battery.ischarging,
      }
    };

    res.json(systemInfo);
  } catch (error) {
    console.error('Error fetching system info:', error);
    // Make sure to release PowerShell even on error
    si.powerShellRelease();
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
});

export default router;