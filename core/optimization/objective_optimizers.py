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

@File: objective_optimizers.py
@Description: Specific optimizer implementations for each objective function

@Created: 6th February 2026
@Last Modified: 16 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
'''


from typing import Dict, List, Any
from optimization.base_optimizer import BaseOptimizer


class MaxWeightedPowerFlow(BaseOptimizer):
    """
    Maximize weighted power flows, prioritizing: PV -> Loads -> EVs -> GridService -> BESS -> Grid Import -> V2G
    
    Strategy:
    - Prioritize renewable energy usage
    - Serve loads efficiently
    - Optimize EV charging
    - Support grid services when requested
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 50,                      # High priority for using PV
            'wind': 50,                    # High priority for using wind
            'load': 45,                    # Serve load with renewables
            'critical_load': 50,           # Always serve critical loads
            'chargers': 50,                # Charge EVs with renewables
            'grid_service_export': 8,      # Low priority for grid service
            'bess_charge': 7,              # Store excess renewable energy
            'bess_discharge': -1,          # Small penalty for discharge
            'grid_import': -9,             # Strong penalty for grid import
            'bidir_discharge': -42,        # Penalty for V2G discharge
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """No additional constraints for max weighted power flow"""
        return []


class MaxSelfConsumptionOptimizer(BaseOptimizer):
    """
    Maximize self-consumption of renewable energy
    
    Strategy:
    - Maximize use of PV and wind
    - Minimize grid import
    - Use BESS to store excess renewable energy
    - Prefer local consumption over export
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 50,                      # High priority for using PV
            'wind': 50,                    # High priority for using wind
            'load': 45,                    # Serve load with renewables
            'critical_load': 50,           # Always serve critical loads
            'chargers': 40,                # Charge EVs with renewables
            'grid_service_export': 5,      # Low priority for grid service
            'bess_charge': 7,              # Store excess renewable energy
            'bess_discharge': -1,          # Small penalty for discharge
            'grid_import': -10,            # Strong penalty for grid import
            'grid_export': -5,             # Penalty for exporting (prefer storage)
            'bidir_discharge': -2,         # Small penalty for V2G discharge
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """No additional constraints for max self-consumption"""
        return []


class MaxEVSatisfactionOptimizer(BaseOptimizer):
    """
    Maximize EV charging satisfaction
    
    Strategy:
    - Prioritize EV charging to meet departure SoC targets
    - Use all available energy sources
    - Minimize V2G discharge unless necessary
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 30,                      # Use renewables when available
            'wind': 30,                    # Use wind when available
            'load': 20,                    # Lower priority for other loads
            'critical_load': 50,           # Always serve critical loads
            'chargers': 80,                # Very high priority for EV charging
            'grid_service_export': 3,      # Low priority for grid service
            'bess_charge': 2,              # Low priority for BESS charging
            'bess_discharge': 5,           # Use BESS to charge EVs
            'grid_import': -3,             # Allow grid import for EV charging
            'grid_export': -8,             # Avoid export, use for EVs
            'bidir_discharge': -50,        # Strong penalty for V2G discharge
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """
        Add constraints to ensure EV targets are met
        """
        constraints = []
        
        # Ensure V1G charges toward high SoC for all unidirectional chargers
        for charger_id, data in inputs.get('unidir', {}).items():
            if data.get('car_capacity_kWh', 0) > 0.2:
                # Target at least 80% SoC
                if hasattr(model, 'unidir_soc'):
                    constraints.append(model.unidir_soc[charger_id] >= 0.8)
        
        # Ensure V2G maintains buffer above arrival SoC + target for all bidirectional chargers
        for charger_id, data in inputs.get('bidir', {}).items():
            if data.get('car_capacity_kWh', 0) > 0.2:
                arrival_soc = data.get('arrival_soc', 0)
                target_soc = data.get('target_soc', 0.2)
                if hasattr(model, 'bidir_soc'):
                    constraints.append(model.bidir_soc[charger_id] >= arrival_soc + target_soc)
        
        return constraints


class MinFossilEmissionsOptimizer(BaseOptimizer):
    """
    Minimize fossil fuel emissions (minimize grid import from non-renewable sources)
    
    Strategy:
    - Maximize renewable energy usage
    - Minimize grid import (assumed to be fossil-based)
    - Optimize BESS to store renewables
    - Allow controlled load shedding if necessary
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 60,                      # Maximum priority for PV
            'wind': 60,                    # Maximum priority for wind
            'load': 30,                    # Moderate priority for loads
            'critical_load': 50,           # Always serve critical loads
            'chargers': 35,                # Moderate priority for EV charging
            'grid_service_export': 4,      # Low priority for grid service
            'bess_charge': 10,             # High priority to store renewables
            'bess_discharge': 8,           # Use stored renewable energy
            'grid_import': -50,            # Very strong penalty (emissions)
            'grid_export': 2,              # Small reward for exporting renewables
            'bidir_discharge': 5,          # Use V2G to avoid grid import
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """
        Add constraints to minimize emissions
        """
        constraints = []
        
        # If renewables + storage can cover critical loads, zero grid import
        renewable_available = inputs.get('pv_fct', 0) + inputs.get('wind_fct', 0)
        
        # Sum available BESS energy
        bess_available = 0
        for bess_id, bess_data in inputs.get('bess', {}).items():
            bess_available += bess_data.get('level_init_kWh', 0) - bess_data.get('level_min_kWh', 0)
        
        critical_load = inputs.get('cld_fct', 0)
        
        if renewable_available + bess_available >= critical_load:
            # Soft constraint through objective weights already handles this
            pass
        
        return constraints


class MaxReliabilityOptimizer(BaseOptimizer):
    """
    Maximize system reliability
    
    Strategy:
    - Maintain high BESS SoC for backup
    - Prioritize critical loads
    - Keep reserve capacity
    - Minimize dependence on grid
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 35,                      # Use renewables
            'wind': 35,                    # Use wind
            'load': 25,                    # Lower priority for non-critical loads
            'critical_load': 100,          # Maximum priority for critical loads
            'chargers': 15,                # Low priority for EV charging
            'grid_service_export': 2,      # Very low priority for grid service
            'bess_charge': 15,             # High priority to maintain charge
            'bess_discharge': -8,          # Penalty for discharge (preserve backup)
            'grid_import': -6,             # Moderate penalty for grid import
            'grid_export': -10,            # Strong penalty for export (preserve energy)
            'bidir_discharge': -5,         # Penalty for V2G (preserve backup)
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """
        Add constraints to ensure reliability
        """
        constraints = []
        
        # Maintain each BESS at least 60% of max capacity for backup
        for bess_id, bess_data in inputs.get('bess', {}).items():
            level_max = bess_data.get('level_max_kWh', 0)
            if level_max > 0 and hasattr(model, 'bess_level'):
                constraints.append(model.bess_level[bess_id] >= 0.6 * level_max)
        
        # Critical loads must always be fully served
        cld_fct = inputs.get('cld_fct', 0)
        if cld_fct > 0:
            constraints.append(model.cld >= cld_fct)
        
        return constraints


class LifeExtentBESSOptimizer(BaseOptimizer):
    """
    Extend BESS lifetime by minimizing cycling and avoiding extreme SoC
    
    Strategy:
    - Minimize charge/discharge cycles
    - Keep SoC in optimal range (40-70%)
    - Avoid deep discharge
    - Reduce power throughput
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 40,                      # Use renewables directly
            'wind': 40,                    # Use wind directly
            'load': 35,                    # Serve loads without BESS
            'critical_load': 50,           # Always serve critical loads
            'chargers': 30,                # Charge EVs directly from renewables/grid
            'grid_service_export': 3,      # Low priority for grid service
            'bess_charge': -10,            # Penalty for BESS charging (cycling)
            'bess_discharge': -10,         # Penalty for BESS discharge (cycling)
            'grid_import': -2,             # Allow grid to reduce BESS usage
            'grid_export': -4,             # Moderate penalty for export
            'bidir_discharge': 2,          # Small reward for using V2G instead of BESS
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """
        Add constraints to protect BESS
        """
        constraints = []
        
        # Keep each BESS in optimal SoC range (40-70% of max capacity)
        for bess_id, bess_data in inputs.get('bess', {}).items():
            level_max = bess_data.get('level_max_kWh', 0)
            power_max = bess_data.get('power_max_kW', 0)
            
            if level_max > 0 and hasattr(model, 'bess_level'):
                constraints.append(model.bess_level[bess_id] >= 0.4 * level_max)
                constraints.append(model.bess_level[bess_id] <= 0.7 * level_max)
            
            # Limit power throughput to reduce stress
            if power_max > 0 and hasattr(model, 'bess_charge'):
                constraints.append(model.bess_charge[bess_id] <= 0.5 * power_max)
                constraints.append(model.bess_discharge[bess_id] <= 0.5 * power_max)
        
        return constraints


class PeakShavingOptimizer(BaseOptimizer):
    """
    Peak shaving and grid support
    
    Strategy:
    - Reduce peak grid import
    - Provide grid services when requested
    - Use BESS to flatten load profile
    - Export excess renewable energy
    """
    
    def get_objective_weights(self) -> Dict[str, float]:
        return {
            'pv': 35,                      # Use renewables
            'wind': 35,                    # Use wind
            'load': 40,                    # Serve loads
            'critical_load': 50,           # Always serve critical loads
            'chargers': 30,                # Moderate priority for EVs
            'grid_service_export': 50,     # Very high priority for grid services
            'bess_charge': 12,             # Charge during low demand
            'bess_discharge': 15,          # Discharge to shave peaks
            'grid_import': -15,            # Strong penalty for grid import (peak shaving)
            'grid_export': 8,              # Reward for exporting (grid support)
            'bidir_discharge': 10,         # Use V2G for peak shaving
        }
    
    def get_additional_constraints(self, model, inputs: Dict[str, float]) -> List:
        """
        Add constraints for peak shaving
        """
        constraints = []
        
        # If grid service is requested, prioritize it
        grid_svc = inputs.get('grid_svc', 0)
        if grid_svc > 0:
            # Ensure grid service need is met
            constraints.append(model.exp2 >= 0.9 * grid_svc)
        
        # Limit grid import to reduce peak demand
        afe_max = inputs.get('afe_max', 0)
        if afe_max > 0:
            # Limit import to 50% of AFE capacity (peak shaving threshold)
            constraints.append(model.imp <= 0.5 * afe_max)
        
        return constraints


# Optimizer factory
def create_optimizer(config: Dict[str, Any]) -> BaseOptimizer:
    """
    Factory function to create the appropriate optimizer based on configuration
    
    Args:
        config: Configuration dictionary containing 'generalSiteConfig' with 'objectiveFunction'
        
    Returns:
        Appropriate optimizer instance
        
    Raises:
        ValueError: If objective function is not supported
    """
    objective = config.get('generalSiteConfig', {}).get('objectiveFunction', 'maxSelfConsumption')
    
    optimizers = {
        'maxWeightPowerFlow': MaxWeightedPowerFlow,
        'maxSelfConsumption': MaxSelfConsumptionOptimizer,
        'maxEVSatisfaction': MaxEVSatisfactionOptimizer,
        'minFossilEmissions': MinFossilEmissionsOptimizer,
        'maxReliability': MaxReliabilityOptimizer,
        'lifeExtentBESS': LifeExtentBESSOptimizer,
        'peakShaving': PeakShavingOptimizer,
    }
    
    if objective not in optimizers:
        raise ValueError(
            f"Unsupported objective function: {objective}. "
            f"Supported objectives: {list(optimizers.keys())}"
        )
    
    return optimizers[objective](config)