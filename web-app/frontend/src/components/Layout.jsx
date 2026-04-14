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

@File: Layout.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 06 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
*/

import { Outlet, useLocation } from "react-router-dom"
import Header from "./Header"
import EULogo from "@/assets/eu_logo.png"
import SHIFT2DCLogo from "@/assets/Horizontal_LogoSHIFT2DC_Color.png"
import SwissLogo from "@/assets/WBF_SBFI_EU_Frameworkprogramme_E_RGB_pos_quer.jpg"

function Layout() {
  const location = useLocation()
  const isDevicesRoute = location.pathname.startsWith("/devices")

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ "--header-height": "4rem" }}>
      <Header />
      <div className="flex flex-1 w-full">
        <main className="container mx-auto px-4 py-8 flex-1">
          <Outlet />
        </main>
      </div>
      {!isDevicesRoute && (
        <footer className="bg-white border-t border-gray-200 py-6 px-8">
          <div className="grid grid-cols-3 items-center gap-8 max-w-4xl mx-auto">
            {/* Project Logo */}
            <div className="flex justify-center items-center">
              <img
                src={SHIFT2DCLogo}
                alt="SHIFT2DC Logo"
                className="h-12 object-contain"
              />
            </div>

            {/* EU Logo */}
            <div className="flex justify-center items-center">
              <img
                src={EULogo}
                alt="EU Logo"
                className="h-50 object-contain"
              />
            </div>

            {/* Confederation Logo */}
            <div className="flex justify-center items-center">
              <img
                src={SwissLogo}
                alt="Swiss Confederation Logo"
                className="h-50 object-contain"
              />
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}

export default Layout