'''
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

@File: database_utils.py
@Description: # TODO: Add desc

@Created: 3rd February 2026
@Last Modified: 23 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


import logging
import psycopg2
from datetime import datetime
from typing import Dict, Any
import data.database_client as db_client


class DatabaseOperations:
    """Shared database operations for all modes"""

    def __init__(self, db_config: Dict[str, str], site_config: Dict[str, str]):
        self.db_config = db_config
        self.site_config = site_config
        self.objective_function = site_config['generalSiteConfig']['objectiveFunction']
        self.logger = logging.getLogger('ems.database')

    def get_latest_15_min_interval(self):
        return db_client.get_last_15min_data(
            host=self.db_config['host'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )

    def get_most_recent_data(self):
        return db_client.get_most_recent_data(
            host=self.db_config['host'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Outputs
    # ─────────────────────────────────────────────────────────────────────────

    def insert_outputs_to_db(self, data: Dict[str, Any], quality: str = 'ok'):
        """
        Insert optimizer outputs to database.

        New multi-device structure expected:
          {
            'obj': float,
            'imp': float, 'exp': float, 'exp1': float, 'exp2': float,
            'afe':   { '<afe_id>':   { 'imp', 'exp', 'exp1', 'exp2' } },
            'pv':    { '<pv_id>':    { 'power' } },
            'wind':  { '<wind_id>':  { 'power' } },
            'load':  { '<load_id>':  { 'power' } },
            'cload': { '<cload_id>': { 'power' } },
            'bess':  { '<bess_id>':  { 'charge', 'discharge', 'level' } },
            'unidir':{ '<uid>':      { 'charge', 'soc' } },
            'bidir': { '<bid>':      { 'charge', 'discharge', 'soc' } },
          }

        Falls back to the old flat structure for backward compatibility.
        """
        conn = psycopg2.connect(
            host=self.db_config['host'],
            port=self.db_config['port'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
        cur = conn.cursor()
        rows = []
        output_id = 1

        def add(param, value, unit):
            nonlocal output_id
            rows.append((
                output_id, datetime.now(), param, value,
                unit, quality, self.objective_function
            ))
            output_id += 1

        # Detect structure: new format has at least one per-device dict key
        is_new_format = any(
            k in data and isinstance(data[k], dict)
            for k in ('afe', 'pv', 'wind', 'load', 'cload', 'bess', 'unidir', 'bidir')
        )

        if is_new_format:
            # ── Aggregate grid scalars ────────────────────────────────────────
            add('obj',  data.get('obj',  -1), '-')
            add('imp',  data.get('imp',  -1), 'kW')
            add('exp',  data.get('exp',  -1), 'kW')
            add('exp1', data.get('exp1', -1), 'kW')
            add('exp2', data.get('exp2', -1), 'kW')

            # ── Per-AFE ───────────────────────────────────────────────────────
            for afe_id, afe_data in data.get('afe', {}).items():
                add(f'{afe_id}_imp',  afe_data.get('imp',  -1), 'kW')
                add(f'{afe_id}_exp',  afe_data.get('exp',  -1), 'kW')
                add(f'{afe_id}_exp1', afe_data.get('exp1', -1), 'kW')
                add(f'{afe_id}_exp2', afe_data.get('exp2', -1), 'kW')

            # ── Per-PV ────────────────────────────────────────────────────────
            for pv_id, pv_data in data.get('pv', {}).items():
                add(f'{pv_id}_power', pv_data.get('power', -1), 'kW')

            # ── Per-Wind ──────────────────────────────────────────────────────
            for wind_id, wind_data in data.get('wind', {}).items():
                add(f'{wind_id}_power', wind_data.get('power', -1), 'kW')

            # ── Per-Load ──────────────────────────────────────────────────────
            for load_id, load_data in data.get('load', {}).items():
                add(f'{load_id}_power', load_data.get('power', -1), 'kW')

            # ── Per-Critical-Load ─────────────────────────────────────────────
            for cload_id, cload_data in data.get('cload', {}).items():
                add(f'{cload_id}_power', cload_data.get('power', -1), 'kW')

            # ── Per-BESS ──────────────────────────────────────────────────────
            for bess_id, bess_data in data.get('bess', {}).items():
                add(f'{bess_id}_charge',    bess_data.get('charge',    -1), 'kW')
                add(f'{bess_id}_discharge', bess_data.get('discharge', -1), 'kW')
                add(f'{bess_id}_level',     bess_data.get('level',     -1), 'kWh')

            # ── Per-Unidirectional-EV ─────────────────────────────────────────
            for uid, uid_data in data.get('unidir', {}).items():
                add(f'{uid}_charge', uid_data.get('charge', -1), 'kW')
                add(f'{uid}_soc',    uid_data.get('soc', -1) * 100 if uid_data.get('soc', -1) != -1 else -1, '%')

            # ── Per-Bidirectional-EV ──────────────────────────────────────────
            for bid, bid_data in data.get('bidir', {}).items():
                add(f'{bid}_charge',    bid_data.get('charge',    -1), 'kW')
                add(f'{bid}_discharge', bid_data.get('discharge', -1), 'kW')
                add(f'{bid}_soc',       bid_data.get('soc', -1) * 100 if bid_data.get('soc', -1) != -1 else -1, '%')

        else:
            # ── Legacy flat structure ──────────────────────────────────────────
            legacy = [
                ('obj',    data.get('obj',  -1), '-'),
                ('imp',    data.get('imp',  -1), 'kW'),
                ('exp',    data.get('exp',  -1), 'kW'),
                ('exp1',   data.get('exp1', -1), 'kW'),
                ('exp2',   data.get('exp2', -1), '%'),
                ('pv',     data.get('pv',   -1), 'kW'),
                ('ld',     data.get('ld',   -1), 'kW'),
                ('bc',     data.get('bc',   -1), 'kW'),
                ('bd',     data.get('bd',   -1), 'kW'),
                ('bl',     data.get('bl',   -1), 'kWh'),
                ('c1_ch',  data.get('c1_ch', -1), 'kW'),
                ('c2_ch',  data.get('c2_ch', -1), 'kW'),
                ('c2_dis', data.get('c2_dis', -1), 'kW'),
                ('v1_soc', data.get('v1_soc', -1) * 100 if data.get('v1_soc', -1) != -1 else -1, '%'),
                ('v2_soc', data.get('v2_soc', -1) * 100 if data.get('v2_soc', -1) != -1 else -1, '%'),
                ('wind',   data.get('wind', -1), 'kW'),
                ('cld',    data.get('cld',  -1), 'kW'),
            ]
            for param, value, unit in legacy:
                add(param, value, unit)

        cur.executemany("""
            INSERT INTO "ems-outputs" (output_id, time, parameter, value, unit, quality, objective)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, rows)
        conn.commit()
        cur.close()
        conn.close()
        self.logger.debug(f"Inserted {len(rows)} output records to database")

    # ─────────────────────────────────────────────────────────────────────────
    # Inputs
    # ─────────────────────────────────────────────────────────────────────────

    def insert_inputs_to_db(self, data: Dict[str, Any]):
        """
        Insert optimizer inputs to database.

        New multi-device structure expected:
          {
            'afe':   { '<afe_id>':   { 'max_kW', 'available', 'grid_svc_kW' } },
            'pv':    { '<pv_id>':    { 'power_fct_kW' } },
            'wind':  { '<wind_id>':  { 'power_fct_kW' } },
            'load':  { '<load_id>':  { 'power_fct_kW' } },
            'cload': { '<cload_id>': { 'power_fct_kW' } },
            'bess':  { '<bess_id>':  { 'efficiency', 'level_init_kWh', ... } },
            'unidir':{ '<uid>':      { 'soc_init', 'car_capacity_kWh', ... } },
            'bidir': { '<bid>':      { 'soc_init', 'car_capacity_kWh', ... } },
          }
        """
        conn = psycopg2.connect(
            host=self.db_config['host'],
            port=self.db_config['port'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
        cur = conn.cursor()
        rows = []
        input_id = 1

        def add(param, value, unit):
            nonlocal input_id
            rows.append((
                input_id, datetime.now(), param, value,
                unit, 'ok', self.objective_function
            ))
            input_id += 1

        is_new_format = any(
            k in data and isinstance(data[k], dict)
            for k in ('afe', 'pv', 'wind', 'load', 'cload', 'bess', 'unidir', 'bidir')
        )

        if is_new_format:
            # ── Per-AFE ───────────────────────────────────────────────────────
            for afe_id, afe_data in data.get('afe', {}).items():
                add(f'{afe_id}_max',      afe_data.get('max_kW',      -1), 'kW')
                add(f'{afe_id}_available', afe_data.get('available',   -1), '-')
                add(f'{afe_id}_grid_svc', afe_data.get('grid_svc_kW', -1), 'kW')

            # ── Per-PV ────────────────────────────────────────────────────────
            for pv_id, pv_data in data.get('pv', {}).items():
                add(f'{pv_id}_power_fct', pv_data.get('power_fct_kW', -1), 'kW')

            # ── Per-Wind ──────────────────────────────────────────────────────
            for wind_id, wind_data in data.get('wind', {}).items():
                add(f'{wind_id}_power_fct', wind_data.get('power_fct_kW', -1), 'kW')

            # ── Per-Load ──────────────────────────────────────────────────────
            for load_id, load_data in data.get('load', {}).items():
                add(f'{load_id}_power_fct', load_data.get('power_fct_kW', -1), 'kW')

            # ── Per-Critical-Load ─────────────────────────────────────────────
            for cload_id, cload_data in data.get('cload', {}).items():
                add(f'{cload_id}_power_fct', cload_data.get('power_fct_kW', -1), 'kW')

            # ── Per-BESS ──────────────────────────────────────────────────────
            for bess_id, bess_data in data.get('bess', {}).items():
                add(f'{bess_id}_efficiency',  bess_data.get('efficiency',     -1), '-')
                add(f'{bess_id}_level_init',  bess_data.get('level_init_kWh', -1), 'kWh')
                add(f'{bess_id}_level_min',   bess_data.get('level_min_kWh',  -1), 'kWh')
                add(f'{bess_id}_level_max',   bess_data.get('level_max_kWh',  -1), 'kWh')
                add(f'{bess_id}_power_max',   bess_data.get('power_max_kW',   -1), 'kW')
                add(f'{bess_id}_fault',       bess_data.get('level_fault_kWh',-1), 'kWh')

            # ── Per-Unidirectional-EV ─────────────────────────────────────────
            for uid, uid_data in data.get('unidir', {}).items():
                add(f'{uid}_soc_init',  uid_data.get('soc_init',          -1), '-')
                add(f'{uid}_capacity',  uid_data.get('car_capacity_kWh',  -1), 'kWh')
                add(f'{uid}_efficiency',uid_data.get('efficiency',         -1), '-')
                add(f'{uid}_power',     uid_data.get('charger_power_max_kW', -1), 'kW')

            # ── Per-Bidirectional-EV ──────────────────────────────────────────
            for bid, bid_data in data.get('bidir', {}).items():
                add(f'{bid}_soc_init',  bid_data.get('soc_init',             -1), '-')
                add(f'{bid}_capacity',  bid_data.get('car_capacity_kWh',     -1), 'kWh')
                add(f'{bid}_efficiency',bid_data.get('efficiency',            -1), '-')
                add(f'{bid}_power',     bid_data.get('charger_power_max_kW', -1), 'kW')
                add(f'{bid}_arrival',   bid_data.get('arrival_soc',          -1), '-')
                add(f'{bid}_target',    bid_data.get('target_soc',           -1), '-')
                add(f'{bid}_available', bid_data.get('is_available',         -1), '-')

        else:
            # ── Legacy flat structure ──────────────────────────────────────────
            legacy = [
                ('pv_fct',   data.get('pv_fct',   -1), 'kW'),
                ('ld_fct',   data.get('ld_fct',   -1), 'kW'),
                ('afe_max',  data.get('afe_max',  -1), 'kW'),
                ('afe_abl',  data.get('afe_abl',  -1), '-'),
                ('grid_svc', data.get('grid_svc', -1), 'kW'),
                ('be',       data.get('be',       -1), '-'),
                ('bl_min',   data.get('bl_min',   -1), 'kWh'),
                ('bl_max',   data.get('bl_max',   -1), 'kWh'),
                ('bc_max',   data.get('bc_max',   -1), 'kW'),
                ('bl_init',  data.get('bl_init',  -1), 'kWh'),
                ('bl_fault', data.get('bl_fault', -1), 'kWh'),
                ('v1_p',     data.get('v1_p',     -1), 'kW'),
                ('v1_c',     data.get('v1_c',     -1), 'kWh'),
                ('v1_init',  data.get('v1_init',  -1), '-'),
                ('v2_p',     data.get('v2_p',     -1), 'kW'),
                ('v2_c',     data.get('v2_c',     -1), 'kWh'),
                ('v2_init',  data.get('v2_init',  -1), '-'),
                ('v2_arr',   data.get('v2_arr',   -1), '-'),
                ('v2_trg',   data.get('v2_trg',   -1), '-'),
                ('v2_abl',   data.get('v2_abl',   -1), '-'),
                ('c1_eff',   data.get('c1_eff',   -1), '-'),
                ('c1_p',     data.get('c1_p',     -1), 'kW'),
                ('c2_eff',   data.get('c2_eff',   -1), '-'),
                ('c2_p',     data.get('c2_p',     -1), 'kW'),
                ('wind_fct', data.get('wind_fct', -1), 'kW'),
                ('cld_fct',  data.get('cld_fct',  -1), 'kW'),
            ]
            for param, value, unit in legacy:
                add(param, value, unit)

        cur.executemany("""
            INSERT INTO "ems-inputs" (input_id, time, parameter, value, unit, quality, objective)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, rows)
        conn.commit()
        cur.close()
        conn.close()
        self.logger.debug(f"Inserted {len(rows)} input records to database")