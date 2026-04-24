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

@File: users.js
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.2
*/


import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { requireMaintainer } from '../auth/middleware.js';
const router = express.Router();

// List all users
router.get('/', requireMaintainer, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, role, created_at FROM users ORDER BY id'
  );
  res.json(rows);
});

// Create user
router.post('/', requireMaintainer, async (req, res) => {
  const { username, password, role = 'guest' } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
    [username, hash, role]
  );
  res.status(201).json(rows[0]);
});

// Update user password (maintainer sets it for someone)
router.patch('/:id/password', requireMaintainer, async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.params.id]);
  res.json({ message: 'Password updated.' });
});

router.patch('/:id/username', requireMaintainer, async (req, res) => {
  const { username } = req.body;
  const { rows } = await pool.query(
    'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, role',
    [username, req.params.id]
  );
  res.json(rows[0]);
});

// Delete user
router.delete('/:id', requireMaintainer, async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ message: 'User deleted.' });
});

export default router;