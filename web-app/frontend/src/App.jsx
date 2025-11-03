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

File: App.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import React from "react"
import Layout from './components/Layout'
import Home from './pages/page-home'
import Charts from './pages/page-charts'
import DevicesLayout from "./components/DevicesLayout"
import SolarPanels from "./pages/device-solar-panels"
import OtherLoads from "./pages/device-load"
import UnidirectionalChargerDashboard from './pages/device-unidir-ev-charger'
import BidirectionalChargerDashboard from './pages/device-bidir-ev-charger'
import StorageSystems from "./pages/device-energy-storage-system"
import ActiveFrontend from "./pages/device-active-front-end"
import DroopCurves from "./pages/page-droop-curves"
import SystemInfo from './pages/page-sys-info'
import ConfigPage from './pages/page-config'
import ModbusConfigPage from './pages/page-modbus-config'
import EMSDashboard from './pages/page-ems-dashboard'
import EMSDebugPage from './pages/page-optimization-debug'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="charts" element={<Charts />} />
          <Route path="emsdashboard" element={<EMSDashboard />} />
          <Route path="droopcurves" element={<DroopCurves />}/>
          <Route path="/devices" element={<DevicesLayout />}>
            <Route path="solarpanels" element={<SolarPanels />} />
            <Route path="otherloads" element={<OtherLoads />} />
            <Route path="unidirev" element={<UnidirectionalChargerDashboard />} />
            <Route path="bidirev" element={<BidirectionalChargerDashboard />} />
            <Route path="storagesystems" element={<StorageSystems />} />
            <Route path="activefrontend" element={<ActiveFrontend />} />
          </Route>
          <Route path="systeminfo" element={<SystemInfo />} />
          <Route path="siteconfig" element={<ConfigPage />} />
          <Route path="modbus" element={<ModbusConfigPage />} />
          <Route path="debug/optimization" element={<EMSDebugPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App

