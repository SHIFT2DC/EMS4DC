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

File: page-home.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 3rd February 2026
Version: v1.2.0
*/

import express from '../../frontend/node_modules/express/index.js';
import path from "path";
import { dirname } from 'path';
import { exec } from 'child_process';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Endpoint to receive data for home page
router.get('/', (req, res) => {
  // System coordination path:
  const systemCoordPath = path.join(__dirname, '../../../system-coordination');
  const modbusConfigPath = path.join(__dirname, '../modbus.json');
  
  // Path to the Python interpreter in the virtual environment (Windows)
  const venvPythonPath = path.join(__dirname, '../../../system-coordination/sys-coord/Scripts/python.exe');
  
  execFile(venvPythonPath, ['-m', 'data.measurements_client', modbusConfigPath], {cwd: systemCoordPath}, 
    (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'An error occurred while executing the Python script' });
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return res.status(500).json({ error: 'The Python script encountered an error' });
    }
    if (!stdout.trim()) {
      console.error('The Python script returned empty output');
      return res.status(500).json({ error: 'No data received from the Python script' });
    }
    try {
      const jsonData = JSON.parse(stdout);
      res.json(jsonData);
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError}`);
      console.error(`Raw output: ${stdout}`);
      res.status(500).json({ error: 'Failed to parse JSON from Python script output' });
    }
  });
});

export default router;