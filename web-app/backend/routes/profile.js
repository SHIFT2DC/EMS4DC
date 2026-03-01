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

@File: profile.js
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
*/


import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { requireAuth } from '../auth/middleware.js';
const router = express.Router();

// Change own password
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const match = await bcrypt.compare(currentPassword, rows[0].password);
  if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ message: 'Password updated.' });
});

// Change own username
router.patch('/username', requireAuth, async (req, res) => {
  const { username } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, role',
    [username, req.user.id]
  );
  res.json(rows[0]);
});

export default router;