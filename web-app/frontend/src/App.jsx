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

@File: App.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 23 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
*/


import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/page-login';
import React from "react"
import Layout from './components/Layout'
import Home from './pages/page-home'
import Charts from './pages/page-charts'
import DroopCurves from "./pages/page-droop-curves"
import EMSDashboard from './pages/page-ems-dashboard'
import EMSDebugPage from './pages/page-optimization-debug'
import SettingsPage from './pages/page-settings'
import DeviceDynamicPage from './pages/page-device-dynamic'
import MetricsDashboard from './pages/page-metrics'
import PageUsers   from '@/pages/page-users'
import PageProfile from '@/pages/page-profile'


export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* All authenticated users */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Home />} />
          <Route path="charts"   element={<Charts />} />
          <Route path="metrics"  element={<MetricsDashboard />} />
          <Route path="emsdashboard" element={<EMSDashboard />} />
          <Route path="droopcurves"  element={<DroopCurves />} />
          <Route path="device/:assetKey" element={<DeviceDynamicPage />} />
          <Route path="debug/optimization" element={<EMSDebugPage />} />

          <Route path="settings"   element={<ProtectedRoute role="maintainer"><SettingsPage /></ProtectedRoute>} />
          <Route path="users"      element={<ProtectedRoute role="maintainer"><PageUsers /></ProtectedRoute>} />
          <Route path="profile"    element={<ProtectedRoute><PageProfile /></ProtectedRoute>} />
        </Route>  {/* ← Layout wrapper closes here, after all children */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}