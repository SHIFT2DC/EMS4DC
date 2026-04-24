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

@File: optimizer.py
@Description: Multi-objective optimizer utilities with asset validation

@Created: 3rd February 2026
@Last Modified: 22 April 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
'''


import logging
from typing import Dict, Any
from optimization.asset_validator import AssetValidator
from optimization.objective_optimizers import create_optimizer


class OptimizerRunner:
    """
    Multi-objective optimizer execution with configuration validation
    
    This class provides a unified interface for running different optimization
    objectives on DC microgrid configurations with multiple assets.
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize optimizer with configuration validation
        
        Args:
            config: Configuration dictionary with 'devices' and 'generalSiteConfig'
            
        Raises:
            ValueError: If configuration is invalid for the specified objective
        """
        self.logger = logging.getLogger('ems.optimizer')
        self.config = config
        
        # Validate configuration
        validator = AssetValidator()
        validation_result = validator.validate_configuration(config)
        
        if not validation_result['valid']:
            error_msg = "Configuration validation failed:\n" + "\n".join(validation_result['errors'])
            self.logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Log warnings if any
        for warning in validation_result['warnings']:
            self.logger.warning(warning)
        
        # Log asset summary
        asset_summary = validation_result['asset_summary']
        self.logger.debug(f"Configuration validated. Assets: {asset_summary['by_type']}")
        
        # Create appropriate optimizer based on objective function
        try:
            self.optimizer = create_optimizer(config)
            objective = config.get('generalSiteConfig', {}).get('objectiveFunction')
            self.logger.debug(f"Initialized optimizer for objective: {objective}")
        except ValueError as e:
            self.logger.error(f"Failed to create optimizer: {e}")
            raise
    
    def prepare_inputs(self, averaged_data: Dict, recent_data: Dict) -> Dict[str, float]:
        """
        Prepare optimizer inputs from database data
        
        Args:
            averaged_data: Averaged/forecasted data from database
            recent_data: Most recent real-time data from database
            
        Returns:
            Dictionary of inputs for optimization
        """
        return self.optimizer.prepare_inputs(averaged_data, recent_data)
    
    def run_optimization(self, inputs: Dict[str, float]) -> Dict[str, Any]:
        """
        Run the optimization model
        
        Args:
            inputs: Dictionary of input parameters prepared by prepare_inputs()
            
        Returns:
            Dictionary with:
                - 'status': 'success' or 'error'
                - 'output': optimizer results (if success)
                - 'message': error message (if error)
        """
        return self.optimizer.run_optimization(inputs)
    
    def get_optimizer_info(self) -> Dict[str, Any]:
        """
        Get information about the current optimizer configuration
        
        Returns:
            Dictionary with optimizer metadata
        """
        objective = self.config.get('generalSiteConfig', {}).get('objectiveFunction')
        weights = self.optimizer.get_objective_weights()
        
        return {
            'objective': objective,
            'optimizer_class': self.optimizer.__class__.__name__,
            'weights': weights,
            'asset_types': list(set(d['type'] for d in self.config['devices'])),
            'device_count': len(self.config['devices'])
        }


# Backward compatibility: Legacy OptimizerRunner for maxSelfConsumption only
class LegacyOptimizerRunner:
    """
    Legacy optimizer implementation (backward compatible with old code)
    
    This is kept for backward compatibility but should be replaced with
    the new OptimizerRunner for better multi-objective support.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger('ems.optimizer')
        
        objective_function = config.get('generalSiteConfig', {}).get('objectiveFunction', 'maxSelfConsumption')
        
        if objective_function != 'maxSelfConsumption':
            self.logger.warning(
                f"LegacyOptimizerRunner only supports 'maxSelfConsumption'. "
                f"Got '{objective_function}'. Use new OptimizerRunner instead."
            )

        # Create lookup dictionary
        devices = {device['id']: device for device in config['devices']}

        # Extract configuration parameters (original implementation)
        self.afe_max_kW = devices['afe1']['parameters']['nominalPower'] / 1000
        self.bess_efficiency = devices['bess1']['parameters']['efficiency'] / 100
        self.bess_capacity_kWh = devices['bess1']['parameters']['capacity'] / 1000
        self.bess_level_min_kWh = self.bess_capacity_kWh * (devices['bess1']['parameters']['minSoC'] / 100)
        self.bess_level_max_kWh = self.bess_capacity_kWh * (devices['bess1']['parameters']['maxSoC'] / 100)
        self.bess_power_max_kW = min(
            devices['bess1']['parameters']['maxChargePower'],
            devices['bess1']['parameters']['maxDischargePower']
        ) / 1000
        self.bess_level_fault_kWh = 0
        self.unidir_charger_efficiency = devices['uniev1']['parameters']['efficiency'] / 100
        self.unidir_charger_power_max_kW = devices['uniev1']['parameters']['maxPower'] / 1000
        self.bidir_charger_efficiency = devices['biev1']['parameters']['efficiency'] / 100
        self.bidir_charger_power_max_kW = devices['biev1']['parameters']['maxPower'] / 1000
        self.bidir_car_target_soc = 0.2
        
        # Optimizer weights (original maxSelfConsumption weights)
        self.weight_pv = 50
        self.weight_load = 45
        self.weight_chargers = 50
        self.weight_grid_service_export = 8
        self.weight_bess_charge = 7
        self.weight_bess_discharge = -1
        self.weight_grid_import = -9
        self.weight_bidir_discharge = -42
    
    def prepare_inputs(self, averaged_data: Dict, recent_data: Dict) -> Dict[str, float]:
        """Prepare optimizer inputs from database data (original implementation)"""
        bidir_car_initial_soc = recent_data["biev1_SoC"] / 100
        unidir_car_initial_soc = recent_data["uniev1_SoC"] / 100
        pv_forecast_kW = abs(averaged_data["pv1_POWER"]) / 1000
        load_forecast_kW = abs(averaged_data["load1_POWER"]) / 1000
        afe_is_available = recent_data["afe1_AVBL"]
        afe_grid_service_need_kW = recent_data["afe1_GRIDSRVC"] / 1000
        bess_level_kWh = recent_data["bess1_SoC"] / 100 * self.bess_capacity_kWh
        unidir_car_capacity_kWh = recent_data["uniev1_CAR_CAP"] / 1000
        bidir_car_capacity_kWh = recent_data["biev1_CAR_CAP"] / 1000
        unidir_car_power_max_kW = recent_data["uniev1_CAR_MAX_P"] / 1000
        bidir_car_power_max_kW = recent_data["biev1_CAR_MAX_P"] / 1000
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
        """Run the optimization model (original implementation)"""
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
        m.constraints.add(m.pv <= pv_fct)
        m.constraints.add(m.ld <= ld_fct)
        m.constraints.add(m.imp <= m.afe_mod * self.afe_max_kW * afe_abl if grid_svc == 0 else m.imp <= 0)
        m.constraints.add(m.exp <= (1 - m.afe_mod) * self.afe_max_kW * afe_abl)
        m.constraints.add(m.exp == m.exp1 + m.exp2)
        m.constraints.add(m.exp2 <= grid_svc)
        m.constraints.add(m.bl == bl_init + self.bess_efficiency * m.bc - m.bd / self.bess_efficiency)
        m.constraints.add(m.bc <= m.bm * self.bess_power_max_kW)
        m.constraints.add(m.bd <= (1 - m.bm) * self.bess_power_max_kW)
        m.constraints.add(m.bl >= self.bess_level_min_kWh if afe_abl == 1 else m.bl >= self.bess_level_fault_kWh)
        m.constraints.add(m.imp + m.pv + m.bd + m.c2_dis == m.exp + m.ld + m.bc + m.c1_ch + m.c2_ch)
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