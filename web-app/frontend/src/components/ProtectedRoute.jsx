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

@File: ProtectedRoute.jsx
@Description: TODO

@Created: 18 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.2
*/


import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/**
 * @param {string|null} role  - if provided, also checks user.role === role
 */
export default function ProtectedRoute({ children, role = null }) {
  const { user, loading } = useAuth();

  if (loading) return null; // or a full-page spinner

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}