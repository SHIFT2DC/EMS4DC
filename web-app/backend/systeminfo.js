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

File: systeminfo.js
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/


module.paths.push(require('path').resolve(__dirname, '../frontend/node_modules'));
const si = require('systeminformation');

async function getSystemDetails() {
  // It is needed to add powershell start so that the CPU usage on windows is not 100%
  si.powerShellStart();

  const [cpu, mem, osInfo, currentLoad, temp, battery] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.currentLoad(),
    si.cpuTemperature(),
    si.battery()
  ]);

  // Also it is needed to release powershell when the thing is done
  si.powerShellRelease();

  return {
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

  
}

module.exports = { getSystemDetails };