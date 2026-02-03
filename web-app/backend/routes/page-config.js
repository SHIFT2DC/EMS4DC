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

File: page-config.js
Description: # TODO: Add desc

Created: 24th November 2025
Last Modified: 3rd February 2026
Version: v1.2.0
*/

import express from '../../frontend/node_modules/express/index.js';
import path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, './../config.json');

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const configData = await fs.readFile(configPath, "utf-8");
    const parsedConfig = JSON.parse(configData);
    res.json(parsedConfig);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.status(404).json({ error: "Configuration file not found" });
    } else {
      console.error("Error reading configuration file:", error);
      res.status(500).json({ error: "Error reading configuration file" });
    }
  }
});

router.post("/", async (req, res) => {
  try {
    const newConfig = req.body;
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
    res.json({ message: "Configuration saved successfully" });
  } catch (error) {
    console.error("Error writing configuration file:", error);
    res.status(500).json({ error: "Error writing configuration file" });
  }
});

export default router;