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

@File: base_optimizer.py
@Description: Base class for all optimization objectives with multi-asset support

@Created: 6th February 2026
@Last Modified: 23 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''

import logging
from typing import Dict, Any, List
from abc import ABC, abstractmethod
import pyomo.environ as pyo


class BaseOptimizer(ABC):
    """Base class for all optimizer implementations with multi-device support"""

    def __init__(self, config: Dict[str, Any]):
        self.logger = logging.getLogger(f'ems.optimizer.{self.__class__.__name__}')
        self.config = config
        self.devices = {device['id']: device for device in config['devices']}
        self._parse_configuration()

    def _parse_configuration(self):
        """Parse and store configuration for all devices by type"""
        self.afes = self._get_devices_by_type('AFE')
        self.pvs = self._get_devices_by_type('PV')
        self.winds = self._get_devices_by_type('WIND')
        self.bess_units = self._get_devices_by_type('BESS')
        self.loads = self._get_devices_by_type('LOAD')
        self.critical_loads = self._get_devices_by_type('CRITICAL_LOAD')
        self.unidir_chargers = self._get_devices_by_type('UNI_EV')
        self.bidir_chargers = self._get_devices_by_type('BI_EV')

        # Parse AFE configs
        self.afe_configs = {}
        for afe in self.afes:
            afe_id = afe['id']
            self.afe_configs[afe_id] = {
                'max_kW': afe['parameters']['nominalPower'] / 1000
            }

        # Parse BESS configs
        self.bess_configs = {}
        for bess in self.bess_units:
            bess_id = bess['id']
            self.bess_configs[bess_id] = {
                'efficiency': bess['parameters']['efficiency'] / 100,
                'capacity_kWh': bess['parameters']['capacity'] / 1000,
                'level_min_kWh': (bess['parameters']['capacity'] / 1000) * (bess['parameters']['minSoC'] / 100),
                'level_max_kWh': (bess['parameters']['capacity'] / 1000) * (bess['parameters']['maxSoC'] / 100),
                'power_max_kW': min(
                    bess['parameters']['maxChargePower'],
                    bess['parameters']['maxDischargePower']
                ) / 1000,
                'level_fault_kWh': 0
            }

        # Parse unidirectional EV charger configs
        self.unidir_configs = {}
        for charger in self.unidir_chargers:
            charger_id = charger['id']
            self.unidir_configs[charger_id] = {
                'efficiency': charger['parameters']['efficiency'] / 100,
                'power_max_kW': charger['parameters']['maxPower'] / 1000
            }

        # Parse bidirectional EV charger configs
        self.bidir_configs = {}
        for charger in self.bidir_chargers:
            charger_id = charger['id']
            self.bidir_configs[charger_id] = {
                'efficiency': charger['parameters']['efficiency'] / 100,
                'power_max_kW': charger['parameters']['maxPower'] / 1000,
                'target_soc': 0.2
            }

    def _get_devices_by_type(self, device_type: str) -> List[Dict[str, Any]]:
        return [d for d in self.config['devices'] if d.get('type') == device_type]

    def prepare_inputs(self, averaged_data: Dict, recent_data: Dict) -> Dict[str, Any]:
        """
        Prepare optimizer inputs from database data.
        All device types are stored individually (no aggregation).
        """
        inputs = {}

        # AFE - per device
        inputs['afe'] = {}
        for afe in self.afes:
            afe_id = afe['id']
            inputs['afe'][afe_id] = {
                'max_kW': self.afe_configs[afe_id]['max_kW'],
                'available': recent_data.get(f"{afe_id}_AVBL", 1),
                'grid_svc_kW': recent_data.get(f"{afe_id}_GRIDSRVC", 0) / 1000
            }

        # PV - per device
        inputs['pv'] = {}
        for pv in self.pvs:
            pv_id = pv['id']
            inputs['pv'][pv_id] = {
                'power_fct_kW': abs(averaged_data.get(f"{pv_id}_POWER", 0)) / 1000
            }

        # Wind - per device
        inputs['wind'] = {}
        for wind in self.winds:
            wind_id = wind['id']
            inputs['wind'][wind_id] = {
                'power_fct_kW': abs(averaged_data.get(f"{wind_id}_POWER", 0)) / 1000
            }

        # Load - per device
        inputs['load'] = {}
        for load in self.loads:
            load_id = load['id']
            inputs['load'][load_id] = {
                'power_fct_kW': abs(averaged_data.get(f"{load_id}_POWER", 0)) / 1000
            }

        # Critical Load - per device
        inputs['cload'] = {}
        for cload in self.critical_loads:
            cload_id = cload['id']
            inputs['cload'][cload_id] = {
                'power_fct_kW': abs(averaged_data.get(f"{cload_id}_POWER", 0)) / 1000
            }

        # BESS - per device
        inputs['bess'] = {}
        for bess_id, config in self.bess_configs.items():
            inputs['bess'][bess_id] = {
                'efficiency': config['efficiency'],
                'level_min_kWh': config['level_min_kWh'],
                'level_max_kWh': config['level_max_kWh'],
                'power_max_kW': config['power_max_kW'],
                'level_init_kWh': recent_data.get(f"{bess_id}_SoC", 50) / 100 * config['capacity_kWh'],
                'level_fault_kWh': config['level_fault_kWh'],
                'capacity_kWh': config['capacity_kWh']
            }

        # Unidirectional EV chargers - per device
        inputs['unidir'] = {}
        for charger_id, config in self.unidir_configs.items():
            inputs['unidir'][charger_id] = {
                'soc_init': recent_data.get(f"{charger_id}_SoC", 0) / 100,
                'car_capacity_kWh': recent_data.get(f"{charger_id}_CAR_CAP", 0) / 1000,
                'car_power_max_kW': recent_data.get(f"{charger_id}_CAR_MAX_POWER", 0) / 1000,
                'efficiency': config['efficiency'],
                'charger_power_max_kW': config['power_max_kW']
            }

        # Bidirectional EV chargers - per device
        inputs['bidir'] = {}
        for charger_id, config in self.bidir_configs.items():
            inputs['bidir'][charger_id] = {
                'soc_init': recent_data.get(f"{charger_id}_SoC", 0) / 100,
                'car_capacity_kWh': recent_data.get(f"{charger_id}_CAR_CAP", 0) / 1000,
                'car_power_max_kW': recent_data.get(f"{charger_id}_CAR_MAX_POWER", 0) / 1000,
                'arrival_soc': recent_data.get(f"{charger_id}_CAR_ARRIVAL", 0) / 100,
                'target_soc': config['target_soc'],
                'is_available': recent_data.get(f"{charger_id}_CAR_AVBL", 0),
                'efficiency': config['efficiency'],
                'charger_power_max_kW': config['power_max_kW']
            }

        return inputs

    @abstractmethod
    def get_objective_weights(self) -> Dict[str, float]:
        pass

    @abstractmethod
    def get_additional_constraints(self, model, inputs: Dict[str, Any]) -> List:
        pass

    def run_optimization(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the optimization model.
        All device types use per-device Pyomo variables.
        Aggregate grid variables (imp, exp, exp1, exp2) are coupled to per-AFE vars via constraints.
        """
        afe_ids    = list(inputs.get('afe', {}).keys())
        pv_ids     = list(inputs.get('pv', {}).keys())
        wind_ids   = list(inputs.get('wind', {}).keys())
        load_ids   = list(inputs.get('load', {}).keys())
        cload_ids  = list(inputs.get('cload', {}).keys())
        bess_ids   = list(inputs.get('bess', {}).keys())
        unidir_ids = list(inputs.get('unidir', {}).keys())
        bidir_ids  = list(inputs.get('bidir', {}).keys())

        m = pyo.ConcreteModel()
        m.constraints = pyo.ConstraintList()

        # ── Aggregate grid variables (kept for objective / legacy subclasses) ─────
        m.imp  = pyo.Var(domain=pyo.NonNegativeReals)
        m.exp  = pyo.Var(domain=pyo.NonNegativeReals)
        m.exp1 = pyo.Var(domain=pyo.NonNegativeReals)
        m.exp2 = pyo.Var(domain=pyo.NonNegativeReals)

        # ── Per-AFE variables ─────────────────────────────────────────────────────
        if afe_ids:
            m.afe_id_set = pyo.Set(initialize=afe_ids)
            m.afe_imp  = pyo.Var(m.afe_id_set, domain=pyo.NonNegativeReals)
            m.afe_exp  = pyo.Var(m.afe_id_set, domain=pyo.NonNegativeReals)
            m.afe_exp1 = pyo.Var(m.afe_id_set, domain=pyo.NonNegativeReals)
            m.afe_exp2 = pyo.Var(m.afe_id_set, domain=pyo.NonNegativeReals)
            m.afe_mod  = pyo.Var(m.afe_id_set, domain=pyo.Binary)

            # Couple per-AFE to aggregate vars
            m.constraints.add(m.imp  == sum(m.afe_imp[aid]  for aid in afe_ids))
            m.constraints.add(m.exp  == sum(m.afe_exp[aid]  for aid in afe_ids))
            m.constraints.add(m.exp1 == sum(m.afe_exp1[aid] for aid in afe_ids))
            m.constraints.add(m.exp2 == sum(m.afe_exp2[aid] for aid in afe_ids))

            for afe_id in afe_ids:
                afe_data = inputs['afe'][afe_id]
                max_kW   = afe_data['max_kW']
                avbl     = afe_data['available']
                grid_svc = afe_data['grid_svc_kW']

                if grid_svc == 0:
                    m.constraints.add(m.afe_imp[afe_id] <= m.afe_mod[afe_id] * max_kW * avbl)
                else:
                    m.constraints.add(m.afe_imp[afe_id] <= 0)

                m.constraints.add(m.afe_exp[afe_id] <= (1 - m.afe_mod[afe_id]) * max_kW * avbl)
                m.constraints.add(m.afe_exp[afe_id] == m.afe_exp1[afe_id] + m.afe_exp2[afe_id])
                m.constraints.add(m.afe_exp2[afe_id] <= grid_svc)
        else:
            m.constraints.add(m.imp == 0)
            m.constraints.add(m.exp == 0)
            m.constraints.add(m.exp1 == 0)
            m.constraints.add(m.exp2 == 0)

        # Convenience: determine if any AFE is in grid-service mode
        any_grid_svc = any(
            inputs['afe'][aid]['grid_svc_kW'] > 0 for aid in afe_ids
        ) if afe_ids else False

        # afe_abl aggregate (used in BESS fault logic)
        afe_abl_aggregate = min(
            (inputs['afe'][aid]['available'] for aid in afe_ids), default=1
        )

        # ── Per-PV variables ─────────────────────────────────────────────────────
        if pv_ids:
            m.pv_id_set = pyo.Set(initialize=pv_ids)
            m.pv = pyo.Var(m.pv_id_set, domain=pyo.NonNegativeReals)
            for pv_id in pv_ids:
                m.constraints.add(m.pv[pv_id] <= inputs['pv'][pv_id]['power_fct_kW'])

        # ── Per-Wind variables ───────────────────────────────────────────────────
        if wind_ids:
            m.wind_id_set = pyo.Set(initialize=wind_ids)
            m.wind = pyo.Var(m.wind_id_set, domain=pyo.NonNegativeReals)
            for wind_id in wind_ids:
                m.constraints.add(m.wind[wind_id] <= inputs['wind'][wind_id]['power_fct_kW'])

        # ── Per-Load variables ───────────────────────────────────────────────────
        if load_ids:
            m.load_id_set = pyo.Set(initialize=load_ids)
            m.ld = pyo.Var(m.load_id_set, domain=pyo.NonNegativeReals)
            for load_id in load_ids:
                m.constraints.add(m.ld[load_id] <= inputs['load'][load_id]['power_fct_kW'])

        # ── Per-Critical-Load variables ──────────────────────────────────────────
        if cload_ids:
            m.cload_id_set = pyo.Set(initialize=cload_ids)
            m.cld = pyo.Var(m.cload_id_set, domain=pyo.NonNegativeReals)
            for cload_id in cload_ids:
                m.constraints.add(m.cld[cload_id] <= inputs['cload'][cload_id]['power_fct_kW'])

        # ── Per-BESS variables ───────────────────────────────────────────────────
        if bess_ids:
            m.bess_id_set = pyo.Set(initialize=bess_ids)
            m.bess_charge    = pyo.Var(m.bess_id_set, domain=pyo.NonNegativeReals)
            m.bess_discharge = pyo.Var(m.bess_id_set, domain=pyo.NonNegativeReals)
            m.bess_mode      = pyo.Var(m.bess_id_set, domain=pyo.Binary)

            def bess_level_bounds(model, bess_id):
                return (0, inputs['bess'][bess_id]['level_max_kWh'])
            m.bess_level = pyo.Var(m.bess_id_set, bounds=bess_level_bounds)

            for bess_id in bess_ids:
                bess_data   = inputs['bess'][bess_id]
                efficiency  = bess_data['efficiency']
                level_init  = bess_data['level_init_kWh']
                level_min   = bess_data['level_min_kWh']
                level_fault = bess_data['level_fault_kWh']
                power_max   = bess_data['power_max_kW']

                m.constraints.add(
                    m.bess_level[bess_id] == level_init
                    + efficiency * m.bess_charge[bess_id]
                    - m.bess_discharge[bess_id] / efficiency
                )
                m.constraints.add(m.bess_charge[bess_id]    <= m.bess_mode[bess_id] * power_max)
                m.constraints.add(m.bess_discharge[bess_id] <= (1 - m.bess_mode[bess_id]) * power_max)

                if afe_abl_aggregate == 1:
                    m.constraints.add(m.bess_level[bess_id] >= level_min)
                else:
                    m.constraints.add(m.bess_level[bess_id] >= level_fault)

        # ── Per-Unidirectional-EV variables ──────────────────────────────────────
        if unidir_ids:
            m.unidir_id_set = pyo.Set(initialize=unidir_ids)
            m.unidir_charge = pyo.Var(m.unidir_id_set, domain=pyo.NonNegativeReals)
            m.unidir_soc    = pyo.Var(m.unidir_id_set, bounds=(0, 1))

            for charger_id in unidir_ids:
                charger_data  = inputs['unidir'][charger_id]
                soc_init      = charger_data['soc_init']
                car_cap       = charger_data['car_capacity_kWh']
                car_power     = charger_data['car_power_max_kW']
                efficiency    = charger_data['efficiency']
                charger_power = charger_data['charger_power_max_kW']

                if car_cap > 0.2:
                    m.constraints.add(
                        m.unidir_soc[charger_id] == soc_init
                        + efficiency * m.unidir_charge[charger_id] / car_cap
                    )
                else:
                    m.constraints.add(m.unidir_soc[charger_id] == soc_init)

                m.constraints.add(m.unidir_charge[charger_id] <= min(car_power, charger_power))

        # ── Per-Bidirectional-EV variables ───────────────────────────────────────
        if bidir_ids:
            m.bidir_id_set   = pyo.Set(initialize=bidir_ids)
            m.bidir_charge   = pyo.Var(m.bidir_id_set, domain=pyo.NonNegativeReals)
            m.bidir_discharge = pyo.Var(m.bidir_id_set, domain=pyo.NonNegativeReals)
            m.bidir_soc      = pyo.Var(m.bidir_id_set, bounds=(0, 1))
            m.bidir_mode     = pyo.Var(m.bidir_id_set, domain=pyo.Binary)

            for charger_id in bidir_ids:
                charger_data  = inputs['bidir'][charger_id]
                soc_init      = charger_data['soc_init']
                car_cap       = charger_data['car_capacity_kWh']
                car_power     = charger_data['car_power_max_kW']
                arrival_soc   = charger_data['arrival_soc']
                target_soc    = charger_data['target_soc']
                is_available  = charger_data['is_available']
                efficiency    = charger_data['efficiency']
                charger_power = charger_data['charger_power_max_kW']

                if car_cap > 0.2:
                    m.constraints.add(
                        m.bidir_soc[charger_id] == soc_init
                        + efficiency * m.bidir_charge[charger_id] / car_cap
                        - m.bidir_discharge[charger_id] / (efficiency * car_cap)
                    )
                else:
                    m.constraints.add(m.bidir_soc[charger_id] == soc_init)

                m.constraints.add(
                    m.bidir_charge[charger_id] <= m.bidir_mode[charger_id] * min(car_power, charger_power)
                )

                if soc_init >= arrival_soc + target_soc and is_available == 1 and afe_abl_aggregate != 1:
                    max_discharge = min(
                        car_power,
                        charger_power,
                        (soc_init - arrival_soc - target_soc) * efficiency * car_cap
                    )
                    m.constraints.add(
                        m.bidir_discharge[charger_id] <= (1 - m.bidir_mode[charger_id]) * max_discharge
                    )
                else:
                    m.constraints.add(m.bidir_discharge[charger_id] <= 0)

        # ── Power balance ────────────────────────────────────────────────────────
        total_pv       = sum(m.pv[pid]   for pid in pv_ids)    if pv_ids    else 0
        total_wind     = sum(m.wind[wid] for wid in wind_ids)  if wind_ids  else 0
        total_ld       = sum(m.ld[lid]   for lid in load_ids)  if load_ids  else 0
        total_cld      = sum(m.cld[cid]  for cid in cload_ids) if cload_ids else 0
        total_bc       = sum(m.bess_charge[bid]     for bid in bess_ids)   if bess_ids   else 0
        total_bd       = sum(m.bess_discharge[bid]  for bid in bess_ids)   if bess_ids   else 0
        total_uni_ch   = sum(m.unidir_charge[cid]   for cid in unidir_ids) if unidir_ids else 0
        total_bi_ch    = sum(m.bidir_charge[cid]    for cid in bidir_ids)  if bidir_ids  else 0
        total_bi_dis   = sum(m.bidir_discharge[cid] for cid in bidir_ids)  if bidir_ids  else 0

        m.constraints.add(
            m.imp + total_pv + total_wind + total_bd + total_bi_dis
            == m.exp + total_ld + total_cld + total_bc + total_uni_ch + total_bi_ch
        )

        # ── Objective ────────────────────────────────────────────────────────────
        weights = self.get_objective_weights()

        obj_expr = (
            weights.get('grid_service_export', 0) * m.exp2
            + weights.get('grid_import', 0) * m.imp
            + weights.get('grid_export', 0) * m.exp1
        )

        for pv_id in pv_ids:
            obj_expr += weights.get('pv', 0) * m.pv[pv_id]

        for wind_id in wind_ids:
            obj_expr += weights.get('wind', 0) * m.wind[wind_id]

        for load_id in load_ids:
            obj_expr += weights.get('load', 0) * m.ld[load_id]

        for cload_id in cload_ids:
            obj_expr += weights.get('critical_load', 0) * m.cld[cload_id]

        for bess_id in bess_ids:
            obj_expr += weights.get('bess_charge', 0)    * m.bess_charge[bess_id]
            obj_expr += weights.get('bess_discharge', 0) * m.bess_discharge[bess_id]

        for charger_id in unidir_ids:
            soc_weight = min(0.8, max(0.2, inputs['unidir'][charger_id]['soc_init']))
            obj_expr += weights.get('chargers', 0) * soc_weight * m.unidir_charge[charger_id]

        for charger_id in bidir_ids:
            soc_weight = min(0.8, max(0.2, inputs['bidir'][charger_id]['soc_init']))
            obj_expr += weights.get('chargers', 0)         * soc_weight * m.bidir_charge[charger_id]
            obj_expr += weights.get('bidir_discharge', 0)  * m.bidir_discharge[charger_id]

        m.obj = pyo.Objective(expr=obj_expr, sense=pyo.maximize)

        # ── Objective-specific constraints ───────────────────────────────────────
        for constraint in self.get_additional_constraints(m, inputs):
            m.constraints.add(constraint)

        # ── Solve ────────────────────────────────────────────────────────────────
        try:
            solver = pyo.SolverFactory('highs')
            result = solver.solve(m)

            if (result.solver.status == pyo.SolverStatus.ok and
                    result.solver.termination_condition == pyo.TerminationCondition.optimal):

                output = {
                    "obj":  round(pyo.value(m.obj),  4),
                    "imp":  round(pyo.value(m.imp),  4),
                    "exp":  round(pyo.value(m.exp),  4),
                    "exp1": round(pyo.value(m.exp1), 4),
                    "exp2": round(pyo.value(m.exp2), 4),
                }

                # Per-AFE results
                if afe_ids:
                    output['afe'] = {}
                    for afe_id in afe_ids:
                        output['afe'][afe_id] = {
                            'imp':  round(pyo.value(m.afe_imp[afe_id]),  4),
                            'exp':  round(pyo.value(m.afe_exp[afe_id]),  4),
                            'exp1': round(pyo.value(m.afe_exp1[afe_id]), 4),
                            'exp2': round(pyo.value(m.afe_exp2[afe_id]), 4),
                        }

                # Per-PV results
                if pv_ids:
                    output['pv'] = {
                        pv_id: {'power': round(pyo.value(m.pv[pv_id]), 4)}
                        for pv_id in pv_ids
                    }

                # Per-Wind results
                if wind_ids:
                    output['wind'] = {
                        wind_id: {'power': round(pyo.value(m.wind[wind_id]), 4)}
                        for wind_id in wind_ids
                    }

                # Per-Load results
                if load_ids:
                    output['load'] = {
                        load_id: {'power': round(pyo.value(m.ld[load_id]), 4)}
                        for load_id in load_ids
                    }

                # Per-Critical-Load results
                if cload_ids:
                    output['cload'] = {
                        cload_id: {'power': round(pyo.value(m.cld[cload_id]), 4)}
                        for cload_id in cload_ids
                    }

                # Per-BESS results
                if bess_ids:
                    output['bess'] = {
                        bess_id: {
                            'charge':    round(pyo.value(m.bess_charge[bess_id]),    4),
                            'discharge': round(pyo.value(m.bess_discharge[bess_id]), 4),
                            'level':     round(pyo.value(m.bess_level[bess_id]),     4),
                        }
                        for bess_id in bess_ids
                    }

                # Per-Unidirectional-EV results
                if unidir_ids:
                    output['unidir'] = {
                        charger_id: {
                            'charge': round(pyo.value(m.unidir_charge[charger_id]), 4),
                            'soc':    round(pyo.value(m.unidir_soc[charger_id]),    4),
                        }
                        for charger_id in unidir_ids
                    }

                # Per-Bidirectional-EV results
                if bidir_ids:
                    output['bidir'] = {
                        charger_id: {
                            'charge':    round(pyo.value(m.bidir_charge[charger_id]),    4),
                            'discharge': round(pyo.value(m.bidir_discharge[charger_id]), 4),
                            'soc':       round(pyo.value(m.bidir_soc[charger_id]),       4),
                        }
                        for charger_id in bidir_ids
                    }

                return {'status': 'success', 'output': output}

            else:
                self.logger.error("Optimizer failed to find solution")
                return {'status': 'error', 'message': 'Solver did not find optimal solution'}

        except Exception as e:
            self.logger.error(f"Error running optimization: {e}")
            return {'status': 'error', 'message': str(e)}