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

File: server.js
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import express from '../frontend/node_modules/express/index.js';
import cors from '../frontend/node_modules/cors/lib/index.js';

// Import route modules
import homePageRoutes from './routes/page-home.js';
import chartsPageRoutes from './routes/page-charts.js'
import sysInfoPageRoutes from './routes/page-sys-info.js';
import configPageRoutes from './routes/page-config.js';
import modbusConfigPageRoutes from './routes/page-modbus.js';
import emsPageRoutes from './routes/page-ems.js';
import debugEMSPageRoutes from './routes/page-debug-optim.js';
import droopCurvesPageRoutes from './routes/page-droop.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Mount the endpoint routes
app.use('/api/data', homePageRoutes);
app.use('/api/chart-data', chartsPageRoutes);
app.use('/api/system-info', sysInfoPageRoutes);
app.use('/api/config', configPageRoutes);
app.use('/api/modbus-config', modbusConfigPageRoutes);
app.use('/api/ems-data', emsPageRoutes);
app.use('/api/ems-debug', debugEMSPageRoutes);
app.use('/api/droop-curve', droopCurvesPageRoutes);

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