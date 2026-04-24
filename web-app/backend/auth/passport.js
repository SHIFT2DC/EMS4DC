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

@File: passport.js
@Description: TODO

@Created: 18 February 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.2
*/


import passport from "passport";
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from "bcrypt";
import { pool } from '../db/pool.js';

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      const user = rows[0];

      if (!user) {
        return done(null, false, { message: 'Invalid username or password.' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return done(null, false, { message: 'Invalid username or password.' });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Only store the user id in the session cookie
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [id]
    );
    done(null, rows[0] || false);
  } catch (err) {
    done(err);
  }
});

export default passport