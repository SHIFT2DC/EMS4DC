'''
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

File: modeOptimizer.py
Description: # TODO: Add desc

Created: 1st July 2025
Last Modified: 30th October 2025
Version: v1.0.0
'''

import requests

import fetchDatabase
import psycopg2
from datetime import datetime
from POptApplier import ConfigPOptUpdater
import pyomo.environ as pyo

import json

# Dotenv variables
from dotenv import load_dotenv
import os

load_dotenv('./../web-app/backend/.env')

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')

class OptimizerMode():
    def __init__(self, config):
        self.afe_max = config['activeFrontEnd']['nominalPower'] / 1000
        self.be = config['bess']['efficiency'] / 100
        self.bl_min = config['bess']['capacity'] * (config['bess']['minSoC'] / 100) / 1000
        self.bl_max = config['bess']['capacity'] * (config['bess']['maxSoC'] / 100) / 1000
        self.bc_max = min(config['bess']['p_opt'], config['bess']['p_consume'])
        self.bl_fault = 0 # TODO: Add fault level in the config page
        self.c1_eff = config['evCharger1']['efficiency'] / 100
        self.c1_p = config['evCharger1']['maxPower'] / 1000
        self.c2_eff = config['evCharger2']['efficiency'] / 100
        self.c2_p = config['evCharger2']['maxPower'] / 1000
        self.v2_trg = 0.2 # TODO: Add handler for target SoC
        self.w1 = 50
        self.w2 = 45
        self.w3 = 50
        self.w4 = 8
        self.w5 = 7
        self.w6 = -1
        self.w7 = -9
        self.w8 = -42

        # Init module which applies optimization outputs to the droop curves' middlepoints
        self.config_updater = ConfigPOptUpdater(config_path='./../web-app/backend/config.json')


    def get_latest_15_min_interval(self):
        '''This function queries the last 15 minute averaged data from the database'''
        data = fetchDatabase.get_last_15min_data(host=DB_HOST,
                                                 database=DB_NAME,
                                                 user=DB_USER,
                                                 password=DB_PASSWORD)
        return data

    def get_most_recent_data(self):
        '''This function queries the most recent data from the database'''
        data = fetchDatabase.get_most_recent_data(host=DB_HOST,
                                                    database=DB_NAME,
                                                    user=DB_USER,
                                                    password=DB_PASSWORD)
        return data

    def insert_outputs_to_db(self, data, quality='ok'):
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
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

        # Commit and close
        conn.commit()
        cur.close()
        conn.close()

    def insert_inputs_to_db(self, data):
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
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

        # Commit and close
        conn.commit()
        cur.close()
        conn.close()

    def execute(self):
        # Receive the latest average 15-min data from the database
        averaged_data = self.get_latest_15_min_interval()
        recent_data = self.get_most_recent_data()

        # Extract inputs
        v2_init = recent_data["EV2_SoC"] / 100
        v1_init = recent_data["EV1_SoC"] / 100
        pv_fct = abs(averaged_data["PV_POWER"]) / 1000
        ld_fct = averaged_data["LOAD_POWER"] / 1000
        afe_abl = recent_data["AFE_AVBL"]
        grid_svc = recent_data["AFE_GRIDSRVC"] / 1000
        bl_init = recent_data["BESS_SoC"]
        v1_c = recent_data["EV1_CAR_CAP"] / 1000
        v2_c = recent_data["EV2_CAR_CAP"] / 1000
        v1_p = recent_data["EV1_CAR_MAX_POWER"] / 1000
        v2_p = recent_data["EV2_CAR_MAX_POWER"] / 1000
        v2_arr = recent_data["EV2_CAR_ARRIVAL"] / 100
        v2_abl = recent_data["EV2_CAR_AVBL"]

        # Store inputs
        ems_input = {
            "pv_fct": pv_fct, "ld_fct": ld_fct, "afe_max": self.afe_max, "afe_abl": afe_abl,
            "grid_svc": grid_svc, "be": self.be, "bl_min": self.bl_min, "bl_max": self.bl_max,
            "bc_max": self.bc_max, "bl_init": bl_init, "bl_fault": self.bl_fault,
            "v1_p": v1_p, "v1_c": v1_c, "v1_init": v1_init, "v2_p": v2_p, "v2_c": v2_c,
            "v2_init": v2_init, "v2_arr": v2_arr, "v2_trg": self.v2_trg, "v2_abl": v2_abl,
            "c1_eff": self.c1_eff, "c1_p": self.c1_p, "c2_eff": self.c2_eff, "c2_p": self.c2_p
        }
        self.insert_inputs_to_db(ems_input)

        # Build Pyomo model
        m = pyo.ConcreteModel()

        # Decision variables
        m.imp = pyo.Var(domain=pyo.NonNegativeReals)
        m.exp = pyo.Var(domain=pyo.NonNegativeReals)
        m.exp1 = pyo.Var(domain=pyo.NonNegativeReals)
        m.exp2 = pyo.Var(domain=pyo.NonNegativeReals)
        m.pv = pyo.Var(domain=pyo.NonNegativeReals)
        m.ld = pyo.Var(domain=pyo.NonNegativeReals)
        m.bc = pyo.Var(domain=pyo.NonNegativeReals)
        m.bd = pyo.Var(domain=pyo.NonNegativeReals)
        m.bl = pyo.Var(bounds=(0, self.bl_max))
        m.c1_ch = pyo.Var(domain=pyo.NonNegativeReals)
        m.c2_ch = pyo.Var(domain=pyo.NonNegativeReals)
        m.c2_dis = pyo.Var(domain=pyo.NonNegativeReals)
        m.v1_soc = pyo.Var(bounds=(0, 1))
        m.v2_soc = pyo.Var(bounds=(0, 1))
        m.c2_mod = pyo.Var(domain=pyo.Binary)
        m.afe_mod = pyo.Var(domain=pyo.Binary)
        m.bm = pyo.Var(domain=pyo.Binary)

        # Objective
        m.obj = pyo.Objective(
            expr=self.w1 * m.pv +
                self.w2 * m.ld +
                self.w3 * min(0.8, max(0.2, v2_init)) * m.c1_ch +
                self.w3 * min(0.8, max(0.2, v1_init)) * m.c2_ch +
                self.w4 * m.exp2 +
                self.w5 * m.bc +
                self.w6 * m.bd +
                self.w7 * m.imp +
                self.w8 * m.c2_dis,
            sense=pyo.maximize
        )

        # Constraints
        m.constraints = pyo.ConstraintList()
        m.constraints.add(m.pv <= pv_fct)
        m.constraints.add(m.ld <= ld_fct)
        m.constraints.add(m.imp <= m.afe_mod * self.afe_max * afe_abl if grid_svc == 0 else m.imp <= 0)
        m.constraints.add(m.exp <= (1 - m.afe_mod) * self.afe_max * afe_abl)
        m.constraints.add(m.exp == m.exp1 + m.exp2)
        m.constraints.add(m.exp2 <= grid_svc)
        m.constraints.add(m.bl == bl_init + self.be * m.bc - m.bd / self.be)
        m.constraints.add(m.bc <= m.bm * self.bc_max)
        m.constraints.add(m.bd <= (1 - m.bm) * self.bc_max)
        m.constraints.add(m.bl >= self.bl_min if afe_abl == 1 else m.bl >= self.bl_fault)
        m.constraints.add(m.imp + m.pv + m.bd + m.c2_dis == m.exp + m.ld + m.bc + m.c1_ch + m.c2_ch)
        m.constraints.add(m.v1_soc == v1_init + self.c1_eff * m.c1_ch / (v1_c if v1_c > 0.2 else 1))
        m.constraints.add(m.v2_soc == v2_init + self.c2_eff * m.c2_ch / (v2_c if v2_c > 0.2 else 1) -
                        m.c2_dis / (self.c2_eff * (v2_c if v2_c > 0.2 else 1)))
        m.constraints.add(m.c1_ch <= min(v1_p, self.c1_p))
        m.constraints.add(m.c2_ch <= m.c2_mod * min(v2_p, self.c2_p))
        if v2_init >= v2_arr + self.v2_trg and v2_abl == 1 and afe_abl != 1:
            m.constraints.add(m.c2_dis <= (1 - m.c2_mod) * min(
                v2_p, self.c2_p, (v2_init - v2_arr - self.v2_trg) * self.c2_eff * v2_c))
        else:
            m.constraints.add(m.c2_dis <= 0)

        # Solve with HiGHS
        solver = pyo.SolverFactory('highs')
        result = solver.solve(m)

        # Output handling
        if result.solver.status == pyo.SolverStatus.ok and result.solver.termination_condition == pyo.TerminationCondition.optimal:
            ems_output = {
                "obj": round(pyo.value(m.obj), 4),
                "imp": round(pyo.value(m.imp), 4),
                "exp": round(pyo.value(m.exp), 4),
                "exp1": round(pyo.value(m.exp1), 4),
                "exp2": round(pyo.value(m.exp2), 4),
                "pv": round(pyo.value(m.pv), 4),
                "ld": round(pyo.value(m.ld), 4),
                "bc": round(pyo.value(m.bc), 4),
                "bd": round(pyo.value(m.bd), 4),
                "bl": round(pyo.value(m.bl), 4),
                "c1_ch": round(pyo.value(m.c1_ch), 4),
                "c2_ch": round(pyo.value(m.c2_ch), 4),
                "c2_dis": round(pyo.value(m.c2_dis), 4),
                "v1_soc": round(pyo.value(m.v1_soc), 4),
                "v2_soc": round(pyo.value(m.v2_soc), 4)
            }
            self.insert_outputs_to_db(ems_output, quality='ok')
            try:
                updated = self.config_updater.update_p_opt_values(ems_output)
                print("Config updated" if updated else "Warning: update failed")
            except Exception as e:
                print(f"Update error: {e}")
        else:
            ems_output = {k: -1 for k in [
                "obj", "imp", "exp", "exp1", "exp2", "pv", "ld", "bc", "bd",
                "bl", "c1_ch", "c2_ch", "c2_dis", "v1_soc", "v2_soc"
            ]}
            self.insert_outputs_to_db(ems_output, quality='error')

        return ems_output

    def validate(self):
        """Check if optimizer is available"""
        try:
            response = requests.head(self.endpoint, timeout=self.timeout / 2)
            return response.status_code == 200
        except:
            return False

    def _apply_setpoints(self, setpoints):
        """Apply the setpoints to the system"""
        # Implement setpoint application logic here
        pass


with open('./../web-app/backend/config.json', 'r') as file:
    config = json.load(file)

# opt = OptimizerMode(config)
# opt.execute()