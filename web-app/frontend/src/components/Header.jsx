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

@File: Header.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 20 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
*/

import { useState, useEffect, useRef } from "react"
import TurboLink from "./TurboLink"
import { NavLink, useNavigate } from "react-router-dom"
import {
  Home, Cpu, Cog, BookA, ChartArea, ChartNetwork, ChartSpline,
  ChartColumnIncreasing, Menu, X, User, LogOut, Users, KeyRound,
  ChevronDown, Shield
} from 'lucide-react'
import DynamicDeviceNavigation from "./DeviceDynamicNavigation"
import { useAuth } from "@/context/AuthContext"

function Header() {
  const [isMenuOpen, setIsMenuOpen]       = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNarrow, setIsNarrow]           = useState(window.innerWidth < 1300)
  const menuRef     = useRef(null)
  const userMenuRef = useRef(null)
  const navigate    = useNavigate()
  const { user, logout } = useAuth()

  const isMaintainer = user?.role === 'maintainer'

  const navItems = [
    { to: "/",             icon: Home,                  label: "Home" },
    { to: "/charts",       icon: ChartSpline,           label: "Charts" },
    { to: "/metrics",      icon: ChartArea,             label: "Metrics" },
    { to: "/emsdashboard", icon: ChartColumnIncreasing, label: "Optimization" },
    { to: "/droopcurves",  icon: ChartNetwork,          label: "Droop" },
    { to: "/settings",     icon: Cog,                   label: "Settings",    maintainerOnly: true },
    { to: "https://shift2dc.github.io/docs.ems/", icon: BookA, label: "Docs" },
  ]
  const visibleNavItems = navItems.filter(item => !item.maintainerOnly || isMaintainer)

  useEffect(() => {
    const handleResize = () => {
      const narrow = window.innerWidth < 1550
      setIsNarrow(narrow)
      if (!narrow) setIsMenuOpen(false)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Close nav menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isMenuOpen])

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false)
      }
    }
    if (isUserMenuOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isUserMenuOpen])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }) =>
    `flex items-center space-x-2 px-3 py-2 rounded transition ${
      isActive
        ? "bg-white bg-opacity-20 text-white"
        : "hover:bg-white hover:bg-opacity-10 hover:text-blue-200"
    }`

  // Shared user dropdown content
  const UserDropdown = () => (
    <div className="absolute right-0 top-full mt-2 w-52 bg-indigo-900 rounded-lg shadow-xl border border-white border-opacity-10 overflow-hidden z-50">
      {/* User info header */}
      <div className="px-4 py-3 border-b border-white border-opacity-10">
        <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
        <p className="text-xs text-blue-300 flex items-center gap-1 mt-0.5">
          <Shield className="h-3 w-3" />
          {isMaintainer ? 'Maintainer' : 'Guest'}
        </p>
      </div>

      <ul className="py-1">
        {/* Maintainer: manage users */}
        {isMaintainer && (
          <li>
            <button
              onClick={() => { navigate('/users'); setIsUserMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white hover:bg-opacity-10 transition"
            >
              <Users className="h-4 w-4" />
              Manage Users
            </button>
          </li>
        )}

        {/* Guest: own profile */}
        {!isMaintainer && (
          <li>
            <button
              onClick={() => { navigate('/profile'); setIsUserMenuOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white hover:bg-opacity-10 transition"
            >
              <KeyRound className="h-4 w-4" />
              My Profile
            </button>
          </li>
        )}

        {/* Logout — both roles */}
        <li className="border-t border-white border-opacity-10 mt-1 pt-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-300 hover:bg-white hover:bg-opacity-10 transition"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  )

  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg sticky top-0 z-10 h-[var(--header-height)]">
      <div className="container mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          <TurboLink to="/" className="text-2xl font-bold tracking-tight hover:text-blue-200 transition-colors">
            EMS4DC
          </TurboLink>

          {/* Wide layout */}
          {!isNarrow && (
            <div className="flex items-center gap-2">
              <nav>
                <ul className="flex space-x-2 items-center">
                  {visibleNavItems.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} className={navLinkClass}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                  <li>
                    <DynamicDeviceNavigation />
                  </li>
                </ul>
              </nav>

              {/* User menu button */}
              <div className="relative ml-2" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white hover:bg-opacity-10 transition"
                >
                  <User className="h-5 w-5" />
                  <span className="text-sm font-medium">{user?.username}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserMenuOpen && <UserDropdown />}
              </div>
            </div>
          )}

          {/* Narrow layout — hamburger */}
          {isNarrow && (
            <div className="flex items-center gap-2">
              {/* User menu (narrow) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2 py-2 rounded hover:bg-white hover:bg-opacity-10 transition"
                >
                  <User className="h-5 w-5" />
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserMenuOpen && <UserDropdown />}
              </div>

              {/* Hamburger */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="p-2 rounded hover:bg-white hover:bg-opacity-10 transition"
                  aria-label="Toggle navigation menu"
                >
                  {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-indigo-800 rounded-lg shadow-xl border border-white border-opacity-10 overflow-hidden">
                    <ul className="py-1">
                      {visibleNavItems.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `flex items-center space-x-2 px-4 py-2.5 transition ${
                                isActive
                                  ? "bg-white bg-opacity-20 text-white"
                                  : "hover:bg-white hover:bg-opacity-10 hover:text-blue-200"
                              }`
                            }
                            onClick={() => setIsMenuOpen(false)}
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span>{item.label}</span>
                          </NavLink>
                        </li>
                      ))}
                      <li className="px-2 py-1.5">
                        <DynamicDeviceNavigation />
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header