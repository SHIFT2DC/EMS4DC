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

File: database_utils.py
Description: # TODO: Add desc

Created: 3rd February 2026
Last Modified: 3rd February 2026
Version: v1.2.0
'''


import logging
import psycopg2
from datetime import datetime
from typing import Dict, Any
import data.database_client as db_client

class DatabaseOperations:
    """Shared database operations for all modes"""
    
    def __init__(self, db_config: Dict[str, str]):
        self.db_config = db_config
        self.logger = logging.getLogger('ems.database')
    
    def get_latest_15_min_interval(self):
        """Query the last 15 minute averaged data from the database"""
        data = db_client.get_last_15min_data(
            host=self.db_config['host'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
        return data

    def get_most_recent_data(self):
        """Query the most recent data from the database"""
        data = db_client.get_most_recent_data(
            host=self.db_config['host'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
        return data

    def insert_outputs_to_db(self, data: Dict[str, float], quality: str = 'ok'):
        """Insert optimizer outputs to database"""
        conn = psycopg2.connect(
            host=self.db_config['host'],
            port=self.db_config['port'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
        cur = conn.cursor()

        data_to_insert_to_db = [
            (1, datetime.now(), 'obj', data["obj"], '-', quality),
            (2, datetime.now(), 'import_AC_to_DC', data["imp"], 'kW', quality),
            (3, datetime.now(), 'export_DC_to_AC', data["exp"], 'kW', quality),
            (4, datetime.now(), 'export_DC_to_AC_ngs', data["exp1"], 'kW', quality),
            (5, datetime.now(), 'exp2', data["exp2"], '%', quality),
            (6, datetime.now(), 'pv', data["pv"], 'kW', quality),
            (7, datetime.now(), 'ld', data["ld"], 'kW', quality),
            (8, datetime.now(), 'bc', data["bc"], 'kW', quality),
            (9, datetime.now(), 'bd', data["bd"], 'kW', quality),
            (10, datetime.now(), 'bl', data["bl"], 'kWh', quality),
            (11, datetime.now(), 'c1_ch', data["c1_ch"], 'kW', quality),
            (12, datetime.now(), 'c2_ch', data["c2_ch"], 'kW', quality),
            (13, datetime.now(), 'c2_dis', data["c2_dis"], 'kW', quality),
            (14, datetime.now(), 'v1_soc', data["v1_soc"] * 100, '%', quality),
            (15, datetime.now(), 'v2_soc', data["v2_soc"] * 100, '%', quality)
        ]

        cur.executemany("""
            INSERT INTO "ems-outputs" (output_id, time, parameter, value, unit, quality)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, data_to_insert_to_db)

        conn.commit()
        cur.close()
        conn.close()

    def insert_inputs_to_db(self, data: Dict[str, float]):
        """Insert optimizer inputs to database"""
        conn = psycopg2.connect(
            host=self.db_config['host'],
            port=self.db_config['port'],
            database=self.db_config['database'],
            user=self.db_config['user'],
            password=self.db_config['password']
        )
        cur = conn.cursor()

        data_to_insert_to_db = [
            (1, datetime.now(), 'pv_fct', data["pv_fct"], 'kW', 'ok'),
            (2, datetime.now(), 'ld_fct', data["ld_fct"], 'kW', 'ok'),
            (3, datetime.now(), 'afe_max', data["afe_max"], 'kW', 'ok'),
            (4, datetime.now(), 'afe_abl', data["afe_abl"], '-', 'ok'),
            (5, datetime.now(), 'grid_svc', data["grid_svc"], 'kW', 'ok'),
            (6, datetime.now(), 'be', data["be"], '-', 'ok'),
            (7, datetime.now(), 'bl_min', data["bl_min"], 'kWh', 'ok'),
            (8, datetime.now(), 'bl_max', data["bl_max"], 'kWh', 'ok'),
            (9, datetime.now(), 'bc_max', data["bc_max"], 'kW', 'ok'),
            (10, datetime.now(), 'bl_init', data["bl_init"], 'kWh', 'ok'),
            (11, datetime.now(), 'bl_fault', data["bl_fault"], 'kWh', 'ok'),
            (12, datetime.now(), 'v1_p', data["v1_p"], 'kW', 'ok'),
            (13, datetime.now(), 'v1_c', data["v1_c"], 'kWh', 'ok'),
            (14, datetime.now(), 'v1_init', data["v1_init"], '-', 'ok'),
            (15, datetime.now(), 'v2_p', data["v2_p"], 'kW', 'ok'),
            (16, datetime.now(), 'v2_c', data["v2_c"], 'kWh', 'ok'),
            (17, datetime.now(), 'v2_init', data["v2_init"], '-', 'ok'),
            (18, datetime.now(), 'v2_arr', data["v2_arr"], '-', 'ok'),
            (19, datetime.now(), 'v2_trg', data["v2_trg"], '-', 'ok'),
            (20, datetime.now(), 'v2_abl', data["v2_abl"], '-', 'ok'),
            (21, datetime.now(), 'c1_eff', data["c1_eff"], '-', 'ok'),
            (22, datetime.now(), 'c1_p', data["c1_p"], 'kW', 'ok'),
            (23, datetime.now(), 'c2_eff', data["c2_eff"], '-', 'ok'),
            (24, datetime.now(), 'c2_p', data["c2_p"], 'kW', 'ok')
        ]

        cur.executemany("""
            INSERT INTO "ems-inputs" (input_id, time, parameter, value, unit, quality)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, data_to_insert_to_db)

        conn.commit()
        cur.close()
        conn.close()
