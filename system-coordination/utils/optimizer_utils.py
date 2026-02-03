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

File: optimizer_utils.py
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


class OptimizerRunner:
    """Shared optimizer execution logic"""
    
    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger('ems.optimizer')
        
        # Extract configuration parameters
        self.afe_max = config['activeFrontEnd']['nominalPower'] / 1000
        self.be = config['bess']['efficiency'] / 100
        self.bl_min = config['bess']['capacity'] * (config['bess']['minSoC'] / 100) / 1000
        self.bl_max = config['bess']['capacity'] * (config['bess']['maxSoC'] / 100) / 1000
        self.bc_max = min(config['bess']['maxChargePower'], config['bess']['maxDischargePower'])
        self.bl_fault = 0
        self.c1_eff = config['evCharger1']['efficiency'] / 100
        self.c1_p = config['evCharger1']['maxPower'] / 1000
        self.c2_eff = config['evCharger2']['efficiency'] / 100
        self.c2_p = config['evCharger2']['maxPower'] / 1000
        self.v2_trg = 0.2
        
        # Optimizer weights
        self.w1 = 50
        self.w2 = 45
        self.w3 = 50
        self.w4 = 8
        self.w5 = 7
        self.w6 = -1
        self.w7 = -9
        self.w8 = -42
    
    def prepare_inputs(self, averaged_data: Dict, recent_data: Dict) -> Dict[str, float]:
        """Prepare optimizer inputs from database data"""
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

        return {
            "pv_fct": pv_fct, "ld_fct": ld_fct, "afe_max": self.afe_max, "afe_abl": afe_abl,
            "grid_svc": grid_svc, "be": self.be, "bl_min": self.bl_min, "bl_max": self.bl_max,
            "bc_max": self.bc_max, "bl_init": bl_init, "bl_fault": self.bl_fault,
            "v1_p": v1_p, "v1_c": v1_c, "v1_init": v1_init, "v2_p": v2_p, "v2_c": v2_c,
            "v2_init": v2_init, "v2_arr": v2_arr, "v2_trg": self.v2_trg, "v2_abl": v2_abl,
            "c1_eff": self.c1_eff, "c1_p": self.c1_p, "c2_eff": self.c2_eff, "c2_p": self.c2_p
        }
    
    def run_optimization(self, inputs: Dict[str, float]) -> Dict[str, Any]:
        """
        Run the optimization model
        
        Returns:
            Dictionary with 'status' ('success' or 'error') and 'output' (optimizer results)
        """
        import pyomo.environ as pyo
        
        # Extract inputs
        v2_init = inputs["v2_init"]
        v1_init = inputs["v1_init"]
        pv_fct = inputs["pv_fct"]
        ld_fct = inputs["ld_fct"]
        afe_abl = inputs["afe_abl"]
        grid_svc = inputs["grid_svc"]
        bl_init = inputs["bl_init"]
        v1_c = inputs["v1_c"]
        v2_c = inputs["v2_c"]
        v1_p = inputs["v1_p"]
        v2_p = inputs["v2_p"]
        v2_arr = inputs["v2_arr"]
        v2_abl = inputs["v2_abl"]
        
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
        try:
            solver = pyo.SolverFactory('highs')
            result = solver.solve(m)
            
            if result.solver.status == pyo.SolverStatus.ok and result.solver.termination_condition == pyo.TerminationCondition.optimal:
                output = {
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
                return {'status': 'success', 'output': output}
            else:
                self.logger.error("Optimizer failed to find solution")
                return {'status': 'error', 'message': 'Solver did not find optimal solution'}
                
        except Exception as e:
            self.logger.error(f"Error running optimization: {e}")
            return {'status': 'error', 'message': str(e)}