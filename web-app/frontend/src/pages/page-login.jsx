/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * Copyright 2026 Eaton
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @File: page-login.jsx
 * @Description: TODO
 *
 * @Created: 18 February 2026
@Last Modified: 23 February 2026
 * @Author: Leon Gritsyuk
 *
 * @Version: v2.0.0
 */


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message ?? 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(60px, -40px) scale(1.08); }
          66%       { transform: translate(-30px, 50px) scale(0.95); }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40%       { transform: translate(-70px, 30px) scale(1.05); }
          70%       { transform: translate(40px, -60px) scale(0.97); }
        }
        @keyframes drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%       { transform: translate(30px, 70px) scale(1.1); }
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.6; }
        }
        .glow-a { animation: drift-a 18s ease-in-out infinite; }
        .glow-b { animation: drift-b 22s ease-in-out infinite; }
        .glow-c { animation: drift-c 26s ease-in-out infinite; }
        .ring   { animation: pulse-ring 6s ease-in-out infinite; }
      `}</style>

      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">

        {/* ── Background glow orbs ── */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Primary blue orb — top-left */}
          <div
            className="glow-a absolute"
            style={{
              width: 640,
              height: 640,
              top: '-12%',
              left: '-10%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.28) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
          {/* Cyan accent — bottom-right */}
          <div
            className="glow-b absolute"
            style={{
              width: 560,
              height: 560,
              bottom: '-14%',
              right: '-8%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(14,165,233,0.22) 0%, transparent 70%)',
              filter: 'blur(24px)',
            }}
          />
          {/* Indigo whisper — center */}
          <div
            className="glow-c absolute"
            style={{
              width: 480,
              height: 480,
              top: '30%',
              left: '35%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)',
              filter: 'blur(32px)',
            }}
          />

          {/* Subtle grid overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        {/* ── Login card ── */}
        <div className="relative z-10 w-full max-w-sm mx-4">
          <div
            className="rounded-2xl border border-white/[0.08] p-8 shadow-2xl space-y-6"
            style={{
              background: 'rgba(2, 8, 23, 0.72)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.5)',
            }}
          >
            {/* Logo mark */}
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                  />
                </svg>
              </div>
            </div>

            {/* Heading */}
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-white">
                Welcome back to EMS4DC
              </h1>
              <p className="text-sm text-slate-400">Sign in to your account to continue.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-xs font-medium text-slate-300 tracking-wide uppercase"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500
                             focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40
                             transition-all duration-200"
                  placeholder="your-username"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-300 tracking-wide uppercase"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500
                             focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40
                             transition-all duration-200"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white
                           hover:bg-blue-500 active:bg-blue-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-2 focus:ring-offset-transparent
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-200 shadow-lg shadow-blue-600/20"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-xs text-slate-500">
              Don't have an account?{' '}
              <span className="text-slate-400 font-medium">Contact your administrator.</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}