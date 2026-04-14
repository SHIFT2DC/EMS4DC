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

@File: page-profile.jsx
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
*/


import { useState } from "react"
import api from "@/lib/axios"
import { useAuth } from "@/context/AuthContext"
import {
  User, KeyRound, Pencil, Eye, EyeOff, Shield,
  AlertCircle, CheckCircle2, X
} from "lucide-react"

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-medium transition-all duration-300 ${
        toast.type === "error" ? "bg-red-600" : "bg-emerald-600"
      }`}
    >
      {toast.type === "error"
        ? <AlertCircle className="h-4 w-4 shrink-0" />
        : <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {toast.message}
      <button onClick={onDismiss} className="ml-2 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Password input with show/hide ─────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder = "Password", id }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PageProfile() {
  const { user, login } = useAuth()

  const [toast, setToast]   = useState(null)
  const [busyUn, setBusyUn] = useState(false)
  const [busyPw, setBusyPw] = useState(false)

  // Username form
  const [newUsername, setNewUsername] = useState(user?.username ?? "")

  // Password form
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw]         = useState("")
  const [confirmPw, setConfirmPw] = useState("")

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUsernameSubmit = async (e) => {
    e.preventDefault()
    if (newUsername === user?.username) {
      showToast("That's already your username.", "error")
      return
    }
    setBusyUn(true)
    try {
      await api.patch("/api/profile/username", { username: newUsername })
      showToast("Username updated successfully.")
      // Re-fetch session so AuthContext reflects the new username
      window.location.reload()
    } catch (err) {
      showToast(err.response?.data?.message ?? "Failed to update username.", "error")
    } finally {
      setBusyUn(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      showToast("New passwords do not match.", "error")
      return
    }
    if (newPw.length < 6) {
      showToast("Password must be at least 6 characters.", "error")
      return
    }
    setBusyPw(true)
    try {
      await api.patch("/api/profile/password", { currentPassword: currentPw, newPassword: newPw })
      showToast("Password changed successfully.")
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
    } catch (err) {
      showToast(err.response?.data?.message ?? "Failed to change password.", "error")
    } finally {
      setBusyPw(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account credentials</p>
      </div>

      {/* Current account info card */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow text-white text-xl font-bold uppercase">
          {user?.username?.[0] ?? "?"}
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">{user?.username}</p>
          <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            user?.role === "maintainer"
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}>
            <Shield className="h-3 w-3" />
            {user?.role === "maintainer" ? "Maintainer" : "Guest"}
          </span>
        </div>
      </div>

      <div className="grid gap-5 max-w-xl">

        {/* ── Change username ── */}
        <SectionCard
          icon={Pencil}
          title="Change Username"
          description="Update the name you use to sign in."
        >
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                New Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busyUn || !newUsername || newUsername === user?.username}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all shadow"
            >
              {busyUn ? "Saving…" : "Update Username"}
            </button>
          </form>
        </SectionCard>

        {/* ── Change password ── */}
        <SectionCard
          icon={KeyRound}
          title="Change Password"
          description="Choose a strong password you don't use elsewhere."
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <PasswordInput
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Your current password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <PasswordInput
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <PasswordInput
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
              />
              {/* Live match indicator */}
              {confirmPw && (
                <p className={`mt-1.5 text-xs flex items-center gap-1 ${
                  newPw === confirmPw ? "text-emerald-600" : "text-red-500"
                }`}>
                  {newPw === confirmPw
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Passwords match</>
                    : <><AlertCircle className="h-3.5 w-3.5" /> Passwords do not match</>}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={busyPw || !currentPw || !newPw || !confirmPw}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all shadow"
            >
              {busyPw ? "Saving…" : "Change Password"}
            </button>
          </form>
        </SectionCard>

      </div>
    </div>
  )
}