/*
SPDX-License-Identifier: Apache-2.0

Copyright 2025 Eaton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

@File: server.js
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 23 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
*/

import express from 'express';
import session from 'express-session';
import connectPgSession from 'connect-pg-simple';
const PgSession = connectPgSession(session);
import passport from './auth/passport.js';
import { pool } from './db/pool.js';
import authRouter from './routes/auth.js';
import { requireAuth, requireMaintainer } from './auth/middleware.js';
import cors from 'cors';

// Import route modules
import homePageRoutes from './routes/page-home.js';
import chartsPageRoutes from './routes/page-charts.js';
import emsPageRoutes from './routes/page-ems.js';
import debugEMSPageRoutes from './routes/page-debug-optim.js';
import droopCurvesPageRoutes from './routes/page-droop.js';
import settingsRoutes from './routes/page-settings.js';
import deviceRoutes from './routes/page-device.js';
import metricsRoutes from './routes/page-metrics.js';
import usersRoutes from './routes/users.js';
import profileRoutes from './routes/profile.js';

const app = express();
const port = 3001;

app.use(cors({
  origin: process.env.FRONTEND_IP,  // frontend origin exactly
  credentials: true,                // allows cookies/session to be sent
}));
app.use(express.json());

// ── Session store in PostgreSQL ───────────────────────────────────────────────
app.use(
  session({
    store: new PgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET,   // add SESSION_SECRET to .env
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days
    },
  })
);

// ── Passport ──────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ── Auth routes (public) ──────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Protected API routes ──────────────────────────────────────────────────────
// All pages require login
app.use('/api', requireAuth);

// Settings and sys-info require maintainer role
app.use('/api/settings', requireMaintainer);

// Mount the endpoint routes
app.use('/api/home', homePageRoutes);
app.use('/api/chart-data', chartsPageRoutes);
app.use('/api/ems-data', emsPageRoutes);
app.use('/api/ems-debug', debugEMSPageRoutes);
app.use('/api/droop-curve', droopCurvesPageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', deviceRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/users',   usersRoutes);
app.use('/api/profile', profileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});