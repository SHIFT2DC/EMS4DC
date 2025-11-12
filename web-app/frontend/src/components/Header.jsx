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

File: Header.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import TurboLink from "./TurboLink"
import { NavLink } from "react-router-dom"
import { Home, BarChart2, Cpu, ChartLine, SquareMinus, Cog, MonitorCog, Radical} from 'lucide-react'

function Header() {
  const navItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/charts", icon: BarChart2, label: "Charts" },
    { to: "/emsdashboard", icon: BarChart2, label: "EMS" },
    { to: "/devices/solarpanels", icon: SquareMinus, label: "Devices" },
    { to: "/droopcurves", icon: ChartLine, label: "Droop"},
    { to: "/systeminfo", icon: Cpu, label: "Server Info"},
    { to: "/siteconfig", icon: Cog, label: "Site Config"},
    { to: "/modbus", icon: MonitorCog, label: "Modbus Config"},
  ]

  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg sticky top-0 z-10 h-[var(--header-height)]">
      <div className="container mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          <TurboLink to="/" className="text-2xl font-bold tracking-tight hover:text-blue-200 transition-colors">
          EMS4DC
          </TurboLink>
          <nav>
            <ul className="flex space-x-2">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center space-x-1 px-3 py-2 rounded transition ${
                        isActive
                          ? "bg-white bg-opacity-20 text-white"
                          : "hover:bg-white hover:bg-opacity-10 hover:text-blue-200"
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header