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

File: Layout.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { Outlet, useLocation } from "react-router-dom"
import Header from "./Header"
import { SidebarProvider } from '@/components/ui/sidebar'

function Layout() {
  const location = useLocation()
  const isDevicesRoute = location.pathname.startsWith("/devices")

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ "--header-height": "4rem" }}>
      <Header />
      <SidebarProvider>
        <div className="flex flex-1 w-full">
          {isDevicesRoute ? (
            <Outlet />
          ) : (
            <main className="container mx-auto px-4 py-8 flex-1">
              <Outlet />
            </main>
          )}
        </div>
      </SidebarProvider>
      {!isDevicesRoute && (
        <footer className="bg-gray-100 text-center py-4 text-sm text-gray-600">
          © {new Date().getFullYear()} EMS for SHIFT2DC. Horizon Europe. Grant Agreement. No. 101136131.
        </footer>
      )}
    </div>
  )
}

export default Layout