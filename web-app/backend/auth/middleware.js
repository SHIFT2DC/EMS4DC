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

@File: middleware.js
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
*/


// Ensure the request comes from an authenticated session
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: 'Authentication required.' });
}

// Ensure the authenticated user has the maintainer role
function requireMaintainer(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'maintainer') return next();
  res.status(403).json({ message: 'Insufficient permissions.' });
}

export {requireAuth, requireMaintainer};