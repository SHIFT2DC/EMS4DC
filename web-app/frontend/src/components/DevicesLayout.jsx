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

File: DevicesLayout.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import React from 'react'
import { Link, Outlet, useLocation } from "react-router-dom"
import { ChevronLeft, Sun, Zap, Car, Battery, Grid, Home } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

function DevicesLayout() {
  const location = useLocation()

  const navItems = [
    { to: "/devices/solarpanels", icon: Sun, label: "Solar Panels" },
    { to: "/devices/otherloads", icon: Zap, label: "Loads" },
    { to: "/devices/unidirev", icon: Car, label: "Uni-Dir EV Charger" },
    { to: "/devices/bidirev", icon: Car, label: "Bi-Dir EV Charger" },
    { to: "/devices/storagesystems", icon: Battery, label: "Storage Systems" },
    { to: "/devices/activefrontend", icon: Grid, label: "Active Front End" },
  ]

  return (
    <div className="flex flex-1 w-full">
      <Sidebar className="h-[calc(100vh-var(--header-height))] top-[var(--header-height)]">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Devices</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.to}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 mt-[var(--header-height)]">
        <div className="max-w-[1400px] mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

export default DevicesLayout