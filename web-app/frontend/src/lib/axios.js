/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * Copyright 2026 Eaton
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @File: axios.js
 * @Description: TODO
 *
 * @Created: 18 February 2026
 * @Last Modified: 10 February 2026
 * @Author: Leon Gritsyuk
 *
 * @Version: v2.0.1
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL ?? 'http://localhost:3001',
  withCredentials: true,   // sends the session cookie cross-origin
});

export default api;