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

@File: auth.js
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
*/


import express from 'express';
import passport from '../auth/passport.js';
const router = express.Router();

// Returns the current logged-in user (used by frontend on load)
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const { id, username, role } = req.user;
    return res.json({ id, username, role });
  }
  res.status(401).json({ message: 'Not authenticated.' });
});

// Login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message ?? 'Login failed.' });

    req.logIn(user, (err) => {
      if (err) return next(err);
      const { id, username, role } = user;
      res.json({ id, username, role });
    });
  })(req, res, next);
});

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out.' });
    });
  });
});

export default router