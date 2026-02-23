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

File: optimizer_utils.py
Description: # TODO: Add desc

@Created: 3rd February 2026
@Last Modified: 16 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
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
        
        objective_function = config['obejctiveFunction'] # Returns "maxSelfConsumption"

        # Create lookup dictionary
        devices = {device['id']: device for device in config['devices']}

        # Extract configuration parameters
        self.afe_max_kW = devices['afe1']['parameters']['nominalPower'] / 1000
        self.bess_efficiency = devices['bess1']['parameters']['efficiency'] / 100
        self.bess_capacity_kWh = devices['bess1']['parameters']['capacity'] / 1000
        self.bess_level_min_kWh = self.bess_capacity_kWh * (devices['bess1']['parameters']['minSoC'] / 100) / 1000
        self.bess_level_max_kWh = self.bess_capacity_kWh * (devices['bess1']['parameters']['maxSoC'] / 100) / 1000
        self.bess_power_max_kW = min(devices['bess1']['parameters']['maxChargePower'], devices['bess1']['parameters']['maxDischargePower']) / 1000
        self.bess_level_fault_kWh = 0
        self.unidir_charger_efficiency = devices['uniev1']['parameters']['efficiency'] / 100
        self.unidir_charger_power_max_kW = devices['uniev1']['parameters']['maxPower'] / 1000
        self.bidir_charger_efficiency = devices['biev1']['parameters']['efficiency'] / 100
        self.bidir_charger_power_max_kW = devices['biev1']['parameters']['maxPower'] / 1000
        self.bidir_car_target_soc = 0.2
        
        # Optimizer weights
        self.weight_pv = 50
        self.weight_load = 45
        self.weight_chargers = 50
        self.weight_grid_service_export = 8
        self.weight_bess_charge = 7
        self.weight_bess_discharge = -1
        self.weight_grid_import = -9
        self.weight_bidir_discharge = -42
    
    def prepare_inputs(self, averaged_data: Dict, recent_data: Dict) -> Dict[str, float]:
        """Prepare optimizer inputs from database data"""
        bidir_car_initial_soc = recent_data["biev1_SoC"] / 100
        unidir_car_initial_soc = recent_data["uniev1_SoC"] / 100
        pv_forecast_kW = abs(averaged_data["pv1_POWER"]) / 1000
        load_forecast_kW = abs(averaged_data["load1_POWER"]) / 1000
        afe_is_available = recent_data["afe1_AVBL"]
        afe_grid_service_need_kW = recent_data["afe1_GRIDSRVC"] / 1000
        bess_level_kWh = recent_data["bess1_SoC"] / 100 * self.bess_capacity_kWh
        unidir_car_capacity_kWh = recent_data["uniev1_CAR_CAP"] / 1000
        bidir_car_capacity_kWh = recent_data["biev1_CAR_CAP"] / 1000
        unidir_car_power_max_kW = recent_data["uniev1_CAR_MAX_POWER"] / 1000
        bidir_car_power_max_kW = recent_data["biev1_CAR_MAX_POWER"] / 1000
        bidir_car_arrival_soc = recent_data["biev1_CAR_ARRIVAL"] / 100
        bidir_car_is_dischargable = recent_data["biev1_CAR_AVBL"]

        return {
            "pv_fct": pv_forecast_kW,
            "ld_fct": load_forecast_kW,
            "afe_max": self.afe_max_kW,
            "afe_abl": afe_is_available,
            "grid_svc": afe_grid_service_need_kW,
            "be": self.bess_efficiency,
            "bl_min": self.bess_level_min_kWh,
            "bl_max": self.bess_level_max_kWh,
            "bc_max": self.bess_power_max_kW,
            "bl_init": bess_level_kWh,
            "bl_fault": self.bess_level_fault_kWh,
            "v1_p": unidir_car_power_max_kW,
            "v1_c": unidir_car_capacity_kWh,
            "v1_init": unidir_car_initial_soc,
            "v2_p": bidir_car_power_max_kW,
            "v2_c": bidir_car_capacity_kWh,
            "v2_init": bidir_car_initial_soc,
            "v2_arr": bidir_car_arrival_soc,
            "v2_trg": self.bidir_car_target_soc,
            "v2_abl": bidir_car_is_dischargable,
            "c1_eff": self.unidir_charger_efficiency,
            "c1_p": self.unidir_charger_power_max_kW,
            "c2_eff": self.bidir_charger_efficiency,
            "c2_p": self.bidir_charger_power_max_kW
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
        m.bl = pyo.Var(bounds=(0, self.bess_level_max_kWh))
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
            expr=self.weight_pv * m.pv +
                self.weight_load * m.ld +
                self.weight_chargers * min(0.8, max(0.2, v2_init)) * m.c1_ch +
                self.weight_chargers * min(0.8, max(0.2, v1_init)) * m.c2_ch +
                self.weight_grid_service_export * m.exp2 +
                self.weight_bess_charge * m.bc +
                self.weight_bess_discharge * m.bd +
                self.weight_grid_import * m.imp +
                self.weight_bidir_discharge * m.c2_dis,
            sense=pyo.maximize
        )

        # Constraints
        m.constraints = pyo.ConstraintList()

        # Resource limits
        m.constraints.add(m.pv <= pv_fct)
        m.constraints.add(m.ld <= ld_fct)

        # AFE constraints
        m.constraints.add(m.imp <= m.afe_mod * self.afe_max_kW * afe_abl if grid_svc == 0 else m.imp <= 0)
        m.constraints.add(m.exp <= (1 - m.afe_mod) * self.afe_max_kW * afe_abl)
        m.constraints.add(m.exp == m.exp1 + m.exp2)
        m.constraints.add(m.exp2 <= grid_svc)

        # BESS constraints
        m.constraints.add(m.bl == bl_init + self.bess_efficiency * m.bc - m.bd / self.bess_efficiency)
        m.constraints.add(m.bc <= m.bm * self.bess_power_max_kW)
        m.constraints.add(m.bd <= (1 - m.bm) * self.bess_power_max_kW)
        m.constraints.add(m.bl >= self.bess_level_min_kWh if afe_abl == 1 else m.bl >= self.bess_level_fault_kWh)

        # Power balance
        m.constraints.add(m.imp + m.pv + m.bd + m.c2_dis == m.exp + m.ld + m.bc + m.c1_ch + m.c2_ch)

        # EV constraints
        m.constraints.add(m.v1_soc == v1_init + self.unidir_charger_efficiency * m.c1_ch / (v1_c if v1_c > 0.2 else 1))
        m.constraints.add(m.v2_soc == v2_init + self.bidir_charger_efficiency * m.c2_ch / (v2_c if v2_c > 0.2 else 1) -
                        m.c2_dis / (self.bidir_charger_efficiency * (v2_c if v2_c > 0.2 else 1)))
        m.constraints.add(m.c1_ch <= min(v1_p, self.unidir_charger_power_max_kW))
        m.constraints.add(m.c2_ch <= m.c2_mod * min(v2_p, self.bidir_charger_power_max_kW))
        if v2_init >= v2_arr + self.bidir_car_target_soc and v2_abl == 1 and afe_abl != 1:
            m.constraints.add(m.c2_dis <= (1 - m.c2_mod) * min(
                v2_p, self.bidir_charger_power_max_kW, (v2_init - v2_arr - self.bidir_car_target_soc) * self.bidir_charger_efficiency * v2_c))
        else:
            m.constraints.add(m.c2_dis <= 0)

        # Solve with HiGHS
        try:
            solver = pyo.SolverFactory('highs')
            result = solver.solve(m)
            
            if result.solver.status == pyo.SolverStatus.ok and result.solver.termination_condition == pyo.TerminationCondition.optimal:
                output = {
                    "obj": round(pyo.value(m.obj), 4),          # Objective function value
                    "imp": round(pyo.value(m.imp), 4),          # Imported power from AC to DC [kW]
                    "exp": round(pyo.value(m.exp), 4),          # Total exported power from DC to AC [kW]
                    "exp1": round(pyo.value(m.exp1), 4),        # Exported power from DC to AC (non-grid service) [kW] 
                    "exp2": round(pyo.value(m.exp2), 4),        # Exported power from DC to AC (grid service) [kW]
                    "pv": round(pyo.value(m.pv), 4),            # PV power provided [kW]
                    "ld": round(pyo.value(m.ld), 4),            # Load power provided [kW]
                    "bc": round(pyo.value(m.bc), 4),            # Battery charging power [kW]
                    "bd": round(pyo.value(m.bd), 4),            # Battery discharging power [kW]
                    "bl": round(pyo.value(m.bl), 4),            # Battery level setpoint [kWh]
                    "c1_ch": round(pyo.value(m.c1_ch), 4),      # V1G charger charging power [kW]
                    "c2_ch": round(pyo.value(m.c2_ch), 4),      # V2G charger charging power [kW]
                    "c2_dis": round(pyo.value(m.c2_dis), 4),    # V2G charger discharging power [kW]
                    "v1_soc": round(pyo.value(m.v1_soc), 4),    # SoC setpoint for car connected to the V1G charger [-]
                    "v2_soc": round(pyo.value(m.v2_soc), 4)     # SoC setpoint for car connected to the V2G charger [-]
                }
                return {'status': 'success', 'output': output}
            else:
                self.logger.error("Optimizer failed to find solution")
                return {'status': 'error', 'message': 'Solver did not find optimal solution'}
                
        except Exception as e:
            self.logger.error(f"Error running optimization: {e}")
            return {'status': 'error', 'message': str(e)}