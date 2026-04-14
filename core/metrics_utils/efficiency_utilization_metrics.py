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

@File: efficiency_utilization_metrics.py
@Description: Efficiency and utilization metrics calculator. Handles load factor, self-consumption, system efficiency, etc.

@Created: 11 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
'''


import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from metrics_utils.data_loader import MeasurementLoader
from metrics_utils.config_loader import ConfigLoader


class EfficiencyUtilizationMetrics:
    """Calculate system efficiency and utilization metrics."""
    
    def __init__(self, data_loader: MeasurementLoader, config_loader: ConfigLoader):
        self.data_loader = data_loader
        self.config_loader = config_loader
    
    def calculate_period_metrics(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, any]:
        """Calculate all efficiency and utilization metrics."""
        metrics = {}
        
        assets_df = self.data_loader.get_active_assets()
        
        # Load factor
        metrics['load_factor'] = self._calculate_load_factor(
            start_time, end_time, assets_df
        )
        
        # Self-consumption and self-sufficiency
        metrics['self_consumption'] = self._calculate_self_consumption(
            start_time, end_time, assets_df
        )
        
        # Renewable energy share
        metrics['renewable_share'] = self._calculate_renewable_share(
            start_time, end_time, assets_df
        )
        
        # System efficiency
        metrics['system_efficiency'] = self._calculate_system_efficiency(
            start_time, end_time, assets_df
        )
        
        # Operational counts
        metrics['operational_counts'] = self._calculate_operational_counts(
            start_time, end_time, assets_df
        )
        
        metrics['period_start'] = start_time
        metrics['period_end'] = end_time
        
        return metrics
    
    def _calculate_load_factor(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """
        Calculate load factor (average load / peak load).
        Higher load factor indicates more consistent demand.
        """
        load_assets = assets_df[assets_df['type'].isin(['LOAD', 'CRITICAL_LOAD'])]['asset_key'].tolist()
        
        if not load_assets:
            return {
                'overall_load_factor': 0.0,
                'avg_load_w': 0.0,
                'peak_load_w': 0.0
            }
        
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', load_assets
        )
        
        if power_df.empty:
            return {
                'overall_load_factor': 0.0,
                'avg_load_w': 0.0,
                'peak_load_w': 0.0
            }
        
        # Total load across all assets
        total_load = power_df.sum(axis=1).abs()
        
        avg_load = total_load.mean()
        peak_load = total_load.max()
        
        load_factor = (avg_load / peak_load) if peak_load > 0 else 0
        
        return {
            'overall_load_factor': float(load_factor),
            'avg_load_w': float(avg_load),
            'peak_load_w': float(peak_load),
            'min_load_w': float(total_load.min())
        }
    
    def _calculate_self_consumption(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """
        Calculate self-consumption and self-sufficiency rates.
        - Self-consumption: fraction of generated energy used locally
        - Self-sufficiency: fraction of load met by local generation
        """
        # Get renewable generation
        renewable_assets = assets_df[
            assets_df['type'].isin(['PV', 'WIND'])
        ]['asset_key'].tolist()
        
        load_assets = assets_df[
            assets_df['type'].isin(['LOAD', 'CRITICAL_LOAD'])
        ]['asset_key'].tolist()
        
        grid_assets = assets_df[assets_df['type'] == 'AFE']['asset_key'].tolist()
        
        renewable_wh = 0.0
        load_wh = 0.0
        grid_import_wh = 0.0
        grid_export_wh = 0.0
        
        # Calculate renewable generation
        if renewable_assets:
            renewable_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', renewable_assets
            )
            if not renewable_power_df.empty:
                renewable_total = renewable_power_df.sum(axis=1)
                renewable_wh = self._integrate_power_series(renewable_total).sum()
        
        # Calculate load consumption
        if load_assets:
            load_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', load_assets
            )
            if not load_power_df.empty:
                load_total = load_power_df.sum(axis=1).abs()
                load_wh = self._integrate_power_series(load_total).sum()
        
        # Calculate grid import/export
        if grid_assets:
            grid_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', grid_assets
            )
            if not grid_power_df.empty:
                grid_total = grid_power_df.sum(axis=1)
                grid_import = grid_total[grid_total > 0]
                grid_export = grid_total[grid_total < 0].abs()
                
                if not grid_import.empty:
                    grid_import_wh = self._integrate_power_series(grid_import).sum()
                if not grid_export.empty:
                    grid_export_wh = self._integrate_power_series(grid_export).sum()
        
        # Calculate metrics
        # Self-consumption: how much of generated energy is used locally (not exported)
        self_consumed_wh = renewable_wh - grid_export_wh
        self_consumption_rate = (self_consumed_wh / renewable_wh) if renewable_wh > 0 else 0
        
        # Self-sufficiency: how much of load is met by local generation
        locally_supplied_wh = load_wh - grid_import_wh
        self_sufficiency_rate = (locally_supplied_wh / load_wh) if load_wh > 0 else 0
        
        return {
            'self_consumption_rate': float(min(1.0, max(0.0, self_consumption_rate))),
            'self_sufficiency_rate': float(min(1.0, max(0.0, self_sufficiency_rate))),
            'self_consumed_wh': float(max(0, self_consumed_wh)),
            'locally_supplied_wh': float(max(0, locally_supplied_wh)),
            'renewable_generated_wh': float(renewable_wh),
            'total_load_wh': float(load_wh),
            'grid_import_wh': float(grid_import_wh),
            'grid_export_wh': float(grid_export_wh)
        }
    
    def _calculate_renewable_share(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """
        Calculate renewable energy share.
        Percentage of load met by renewable sources.
        """
        renewable_assets = assets_df[
            assets_df['type'].isin(['PV', 'WIND'])
        ]['asset_key'].tolist()
        
        load_assets = assets_df[
            assets_df['type'].isin(['LOAD', 'CRITICAL_LOAD'])
        ]['asset_key'].tolist()
        
        renewable_wh = 0.0
        load_wh = 0.0
        
        if renewable_assets:
            renewable_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', renewable_assets
            )
            if not renewable_power_df.empty:
                renewable_total = renewable_power_df.sum(axis=1)
                renewable_wh = self._integrate_power_series(renewable_total).sum()
        
        if load_assets:
            load_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', load_assets
            )
            if not load_power_df.empty:
                load_total = load_power_df.sum(axis=1).abs()
                load_wh = self._integrate_power_series(load_total).sum()
        
        renewable_share = (renewable_wh / load_wh * 100) if load_wh > 0 else 0
        
        return {
            'renewable_share_percent': float(renewable_share),
            'renewable_generation_wh': float(renewable_wh),
            'total_consumption_wh': float(load_wh)
        }
    
    def _calculate_system_efficiency(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """
        Calculate overall system efficiency.
        Ratio of useful energy output to total energy input.
        """
        # Input: Grid + Renewables
        grid_assets = assets_df[assets_df['type'] == 'AFE']['asset_key'].tolist()
        renewable_assets = assets_df[
            assets_df['type'].isin(['PV', 'WIND'])
        ]['asset_key'].tolist()
        
        # Output: Load
        load_assets = assets_df[
            assets_df['type'].isin(['LOAD', 'CRITICAL_LOAD'])
        ]['asset_key'].tolist()
        
        total_input_wh = 0.0
        total_output_wh = 0.0
        
        # Calculate inputs
        if grid_assets:
            grid_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', grid_assets
            )
            if not grid_power_df.empty:
                grid_import = grid_power_df.sum(axis=1)
                grid_import = grid_import[grid_import > 0]  # Only imports
                if not grid_import.empty:
                    total_input_wh += self._integrate_power_series(grid_import).sum()
        
        if renewable_assets:
            renewable_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', renewable_assets
            )
            if not renewable_power_df.empty:
                renewable_total = renewable_power_df.sum(axis=1)
                total_input_wh += self._integrate_power_series(renewable_total).sum()
        
        # Calculate output
        if load_assets:
            load_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', load_assets
            )
            if not load_power_df.empty:
                load_total = load_power_df.sum(axis=1).abs()
                total_output_wh = self._integrate_power_series(load_total).sum()
        
        # System efficiency
        system_efficiency = (total_output_wh / total_input_wh) if total_input_wh > 0 else 0
        
        # Losses
        losses_wh = total_input_wh - total_output_wh
        loss_percentage = (losses_wh / total_input_wh * 100) if total_input_wh > 0 else 0
        
        return {
            'system_efficiency': float(min(1.0, system_efficiency)),
            'total_input_wh': float(total_input_wh),
            'total_output_wh': float(total_output_wh),
            'losses_wh': float(max(0, losses_wh)),
            'loss_percentage': float(max(0, loss_percentage))
        }
    
    def _calculate_operational_counts(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, any]:
        """
        Calculate operational event counts.
        - BESS deep discharge events
        - Mode switches
        - Operational state changes
        """
        counts = {
            'bess_deep_discharge_events': 0,
            'bess_full_charge_events': 0,
            'mode_switches': 0
        }
        
        # BESS events
        bess_assets = assets_df[assets_df['type'] == 'BESS']['asset_key'].tolist()
        
        for asset_key in bess_assets:
            device_config = self.config_loader.get_device_config(asset_key)
            min_soc = device_config.parameters.minSoC if device_config else 10
            max_soc = device_config.parameters.maxSoC if device_config else 90
            
            soc_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'SoC', [asset_key]
            )
            
            if not soc_df.empty and asset_key in soc_df.columns:
                soc_series = soc_df[asset_key].dropna()
                
                # Deep discharge events (SoC drops below minSoC)
                deep_discharge = (soc_series < min_soc).astype(int)
                counts['bess_deep_discharge_events'] += (deep_discharge.diff() > 0).sum()
                
                # Full charge events (SoC reaches maxSoC)
                full_charge = (soc_series >= max_soc).astype(int)
                counts['bess_full_charge_events'] += (full_charge.diff() > 0).sum()
        
        return counts
    
    def _integrate_power_series(self, power_series: pd.Series) -> pd.Series:
        """Integrate power to energy using trapezoidal rule."""
        if power_series.empty or not isinstance(power_series.index, pd.DatetimeIndex):
            return pd.Series(dtype=float)
        
        time_diff_hours = power_series.index.to_series().diff().dt.total_seconds() / 3600.0
        avg_power = (power_series + power_series.shift(1)) / 2
        energy_increment = avg_power * time_diff_hours
        
        return energy_increment.fillna(0)