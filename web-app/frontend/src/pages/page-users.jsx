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

@File: page-users.jsx
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
*/


import { useState, useEffect } from "react"
import api from "@/lib/axios"
import {
  Users, UserPlus, Trash2, KeyRound, Pencil, X, Check,
  Shield, User, Eye, EyeOff, AlertCircle, CheckCircle2, Search
} from "lucide-react"

// ── Small reusable components ─────────────────────────────────────────────────

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
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      role === "maintainer"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-600"
    }`}>
      <Shield className="h-3 w-3" />
      {role === "maintainer" ? "Maintainer" : "Guest"}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PageUsers() {
  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState("")
  const [toast, setToast]           = useState(null)

  // Modal states
  const [addModal, setAddModal]         = useState(false)
  const [pwModal, setPwModal]           = useState(null)   // user object
  const [unModal, setUnModal]           = useState(null)   // user object
  const [deleteModal, setDeleteModal]   = useState(null)   // user object

  // Form state
  const [newUser, setNewUser]   = useState({ username: "", password: "", role: "guest" })
  const [newPw, setNewPw]       = useState("")
  const [newUn, setNewUn]       = useState("")
  const [busy, setBusy]         = useState(false)

  const showToast = (message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/api/users")
      setUsers(data)
    } catch {
      showToast("Failed to load users.", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAddUser = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post("/api/users", newUser)
      showToast(`User "${newUser.username}" created.`)
      setAddModal(false)
      setNewUser({ username: "", password: "", role: "guest" })
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.message ?? "Failed to create user.", "error")
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch(`/api/users/${pwModal.id}/password`, { password: newPw })
      showToast(`Password updated for "${pwModal.username}".`)
      setPwModal(null)
      setNewPw("")
    } catch (err) {
      showToast(err.response?.data?.message ?? "Failed to update password.", "error")
    } finally {
      setBusy(false)
    }
  }

  const handleChangeUsername = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch(`/api/users/${unModal.id}/username`, { username: newUn })
      showToast(`Username updated to "${newUn}".`)
      setUnModal(null)
      setNewUn("")
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.message ?? "Failed to update username.", "error")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await api.delete(`/api/users/${deleteModal.id}`)
      showToast(`User "${deleteModal.username}" deleted.`)
      setDeleteModal(null)
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.message ?? "Failed to delete user.", "error")
    } finally {
      setBusy(false)
    }
  }

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">User Management</h1>
            <p className="text-sm text-slate-500">{users.length} account{users.length !== 1 ? "s" : ""} registered</p>
          </div>
        </div>
        <button
          onClick={() => setAddModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:from-blue-700 hover:to-indigo-800 transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <User className="h-8 w-8 opacity-40" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Created</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold uppercase">
                        {u.username[0]}
                      </div>
                      <span className="font-medium text-slate-800">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        title="Change username"
                        onClick={() => { setUnModal(u); setNewUn(u.username) }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Change password"
                        onClick={() => { setPwModal(u); setNewPw("") }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        title="Delete user"
                        onClick={() => setDeleteModal(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add user modal ── */}
      {addModal && (
        <Modal title="Add New User" onClose={() => setAddModal(false)}>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <input
                type="text"
                required
                value={newUser.username}
                onChange={e => setNewUser(v => ({ ...v, username: e.target.value }))}
                placeholder="e.g. john_doe"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <PasswordInput
                value={newUser.password}
                onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}
                placeholder="Set a password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
              <div className="grid grid-cols-2 gap-2">
                {["guest", "maintainer"].map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setNewUser(v => ({ ...v, role }))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      newUser.role === role
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                    {newUser.role === role && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAddModal(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all"
              >
                {busy ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Change password modal ── */}
      {pwModal && (
        <Modal title={`Change Password — ${pwModal.username}`} onClose={() => setPwModal(null)}>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">New Password</label>
              <PasswordInput
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPwModal(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !newPw}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all"
              >
                {busy ? "Saving…" : "Update Password"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Change username modal ── */}
      {unModal && (
        <Modal title={`Change Username — ${unModal.username}`} onClose={() => setUnModal(null)}>
          <form onSubmit={handleChangeUsername} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">New Username</label>
              <input
                type="text"
                required
                value={newUn}
                onChange={e => setNewUn(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnModal(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-700 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 transition-all"
              >
                {busy ? "Saving…" : "Update Username"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteModal && (
        <Modal title="Delete User" onClose={() => setDeleteModal(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Are you sure you want to delete <strong>{deleteModal.username}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {busy ? "Deleting…" : "Delete User"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}