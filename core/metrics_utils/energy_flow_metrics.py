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

@File: energy_flow_metrics.py
@Description: Energy flow and totals metrics calculator. Handles grid, renewable generation, loads, EVs, and BESS energy flows.

@Created: 11 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from metrics_utils.data_loader import MeasurementLoader
from metrics_utils.config_loader import ConfigLoader


class EnergyFlowMetrics:
    """Calculate energy flow and totals metrics."""
    
    def __init__(self, data_loader: MeasurementLoader, config_loader: ConfigLoader):
        self.data_loader = data_loader
        self.config_loader = config_loader
    
    def calculate_period_metrics(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, any]:
        """
        Calculate all energy flow metrics for a time period.
        
        Returns:
            Dictionary with all calculated metrics
        """
        metrics = {}
        
        # Get active assets
        assets_df = self.data_loader.get_active_assets()
        
        # Calculate metrics for each device type
        metrics['grid'] = self._calculate_grid_metrics(start_time, end_time, assets_df)
        metrics['renewable'] = self._calculate_renewable_metrics(start_time, end_time, assets_df)
        metrics['load'] = self._calculate_load_metrics(start_time, end_time, assets_df)
        metrics['ev'] = self._calculate_ev_metrics(start_time, end_time, assets_df)
        metrics['bess'] = self._calculate_bess_metrics(start_time, end_time, assets_df)
        metrics['peaks'] = self._calculate_peak_powers(start_time, end_time, assets_df)
        
        # Calculate system-level metrics
        metrics['system'] = self._calculate_system_metrics(metrics, start_time, end_time)
        
        metrics['period_start'] = start_time
        metrics['period_end'] = end_time
        metrics['calculation_time'] = datetime.now()
        
        return metrics
    
    def _calculate_grid_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """Calculate grid import/export metrics."""
        # AFE (Active Front End) represents grid connection
        afe_assets = assets_df[assets_df['type'] == 'AFE']['asset_key'].tolist()
        
        if not afe_assets:
            return {
                'total_import_wh': 0.0,
                'total_export_wh': 0.0,
                'net_import_wh': 0.0,
                'import_count': 0,
                'export_count': 0
            }
        
        # Get power measurements
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', afe_assets
        )
        
        if power_df.empty:
            return {
                'total_import_wh': 0.0,
                'total_export_wh': 0.0,
                'net_import_wh': 0.0,
                'import_count': 0,
                'export_count': 0
            }
        
        # Sum all AFE devices
        total_power = power_df.sum(axis=1)
        
        # Integrate to energy (Wh)
        energy_df = self._integrate_power_series(total_power)
        
        # Positive = import, Negative = export
        import_energy = energy_df[energy_df > 0].sum()
        export_energy = abs(energy_df[energy_df < 0].sum())
        
        return {
            'total_import_wh': float(import_energy),
            'total_export_wh': float(export_energy),
            'net_import_wh': float(import_energy - export_energy),
            'import_count': int((total_power > 0).sum()),
            'export_count': int((total_power < 0).sum())
        }
    
    def _calculate_renewable_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """Calculate renewable generation metrics (PV + Wind)."""
        pv_assets = assets_df[assets_df['type'] == 'PV']['asset_key'].tolist()
        wind_assets = assets_df[assets_df['type'] == 'WIND']['asset_key'].tolist()
        
        metrics = {
            'pv_generation_wh': 0.0,
            'wind_generation_wh': 0.0,
            'total_renewable_wh': 0.0,
            'pv_peak_w': 0.0,
            'wind_peak_w': 0.0
        }
        
        # PV generation
        if pv_assets:
            pv_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', pv_assets
            )
            if not pv_power_df.empty:
                pv_total = pv_power_df.sum(axis=1)
                metrics['pv_generation_wh'] = float(self._integrate_power_series(pv_total).sum())
                metrics['pv_peak_w'] = float(pv_total.max())
        
        # Wind generation
        if wind_assets:
            wind_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', wind_assets
            )
            if not wind_power_df.empty:
                wind_total = wind_power_df.sum(axis=1)
                metrics['wind_generation_wh'] = float(self._integrate_power_series(wind_total).sum())
                metrics['wind_peak_w'] = float(wind_total.max())
        
        metrics['total_renewable_wh'] = metrics['pv_generation_wh'] + metrics['wind_generation_wh']
        
        return metrics
    
    def _calculate_load_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """Calculate load consumption metrics."""
        load_assets = assets_df[assets_df['type'] == 'LOAD']['asset_key'].tolist()
        critical_assets = assets_df[assets_df['type'] == 'CRITICAL_LOAD']['asset_key'].tolist()
        
        metrics = {
            'total_load_wh': 0.0,
            'critical_load_wh': 0.0,
            'non_critical_load_wh': 0.0,
            'peak_load_w': 0.0,
            'peak_critical_w': 0.0
        }
        
        # General loads
        if load_assets:
            load_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', load_assets
            )
            if not load_power_df.empty:
                load_total = load_power_df.sum(axis=1).abs()  # Loads are positive consumption
                metrics['total_load_wh'] = float(self._integrate_power_series(load_total).sum())
                metrics['peak_load_w'] = float(load_total.max())
        
        # Critical loads
        if critical_assets:
            critical_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', critical_assets
            )
            if not critical_power_df.empty:
                critical_total = critical_power_df.sum(axis=1).abs()
                metrics['critical_load_wh'] = float(self._integrate_power_series(critical_total).sum())
                metrics['peak_critical_w'] = float(critical_total.max())
        
        metrics['non_critical_load_wh'] = metrics['total_load_wh']  # All loads counted as general
        
        return metrics
    
    def _calculate_ev_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """Calculate EV charging/discharging metrics."""
        uni_ev_assets = assets_df[assets_df['type'] == 'UNI_EV']['asset_key'].tolist()
        bi_ev_assets = assets_df[assets_df['type'] == 'BI_EV']['asset_key'].tolist()
        
        metrics = {
            'total_charging_wh': 0.0,
            'total_discharging_wh': 0.0,
            'uni_ev_charging_wh': 0.0,
            'bi_ev_charging_wh': 0.0,
            'bi_ev_discharging_wh': 0.0,
            'peak_charging_w': 0.0,
            'peak_discharging_w': 0.0
        }
        
        # Unidirectional EVs (only charge)
        if uni_ev_assets:
            uni_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', uni_ev_assets
            )
            if not uni_power_df.empty:
                uni_total = uni_power_df.sum(axis=1)
                charging = uni_total[uni_total > 0]
                if not charging.empty:
                    metrics['uni_ev_charging_wh'] = float(self._integrate_power_series(charging).sum())
                    metrics['peak_charging_w'] = max(metrics['peak_charging_w'], float(charging.max()))
        
        # Bidirectional EVs (charge and discharge)
        if bi_ev_assets:
            bi_power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', bi_ev_assets
            )
            if not bi_power_df.empty:
                bi_total = bi_power_df.sum(axis=1)
                charging = bi_total[bi_total > 0]
                discharging = bi_total[bi_total < 0].abs()
                
                if not charging.empty:
                    metrics['bi_ev_charging_wh'] = float(self._integrate_power_series(charging).sum())
                    metrics['peak_charging_w'] = max(metrics['peak_charging_w'], float(charging.max()))
                
                if not discharging.empty:
                    metrics['bi_ev_discharging_wh'] = float(self._integrate_power_series(discharging).sum())
                    metrics['peak_discharging_w'] = float(discharging.max())
        
        metrics['total_charging_wh'] = metrics['uni_ev_charging_wh'] + metrics['bi_ev_charging_wh']
        metrics['total_discharging_wh'] = metrics['bi_ev_discharging_wh']
        
        return metrics
    
    def _calculate_bess_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """Calculate BESS charge/discharge metrics."""
        bess_assets = assets_df[assets_df['type'] == 'BESS']['asset_key'].tolist()
        
        metrics = {
            'total_charging_wh': 0.0,
            'total_discharging_wh': 0.0,
            'peak_charging_w': 0.0,
            'peak_discharging_w': 0.0,
            'avg_soc_percent': 0.0,
            'cycles_count': 0.0
        }
        
        if not bess_assets:
            return metrics
        
        # Get power measurements
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', bess_assets
        )
        
        if not power_df.empty:
            total_power = power_df.sum(axis=1)
            
            # Positive = charging, Negative = discharging
            charging = total_power[total_power > 0]
            discharging = total_power[total_power < 0].abs()
            
            if not charging.empty:
                metrics['total_charging_wh'] = float(self._integrate_power_series(charging).sum())
                metrics['peak_charging_w'] = float(charging.max())
            
            if not discharging.empty:
                metrics['total_discharging_wh'] = float(self._integrate_power_series(discharging).sum())
                metrics['peak_discharging_w'] = float(discharging.max())
        
        # Get SoC measurements
        soc_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'SoC', bess_assets
        )
        
        if not soc_df.empty:
            avg_soc = soc_df.mean(axis=1)
            metrics['avg_soc_percent'] = float(avg_soc.mean())
            
            # Estimate cycles (simplified: each time SoC crosses 50% counts as 0.5 cycle)
            for col in soc_df.columns:
                soc_series = soc_df[col].dropna()
                if len(soc_series) > 1:
                    crossings = ((soc_series > 50).astype(int).diff().abs().sum())
                    metrics['cycles_count'] += crossings / 2.0
        
        return metrics
    
    def _calculate_peak_powers(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, float]:
        """Calculate peak power values for all device types."""
        all_assets = assets_df['asset_key'].tolist()
        
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', all_assets
        )
        
        peaks = {}
        
        if power_df.empty:
            return peaks
        
        # Calculate peaks by device type
        for _, asset in assets_df.iterrows():
            asset_key = asset['asset_key']
            asset_type = asset['type']
            
            if asset_key in power_df.columns:
                power_series = power_df[asset_key].dropna()
                if not power_series.empty:
                    peak_key = f"{asset_type}_{asset_key}_peak_w"
                    peaks[peak_key] = float(power_series.abs().max())
        
        return peaks
    
    def _calculate_system_metrics(
        self,
        metrics: Dict,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, float]:
        """Calculate system-level derived metrics."""
        renewable_wh = metrics['renewable']['total_renewable_wh']
        load_wh = metrics['load']['total_load_wh']
        grid_import_wh = metrics['grid']['total_import_wh']
        
        system = {
            'total_generation_wh': renewable_wh,
            'total_consumption_wh': load_wh,
            'self_consumption_wh': min(renewable_wh, load_wh),
            'self_consumption_rate': 0.0,
            'self_sufficiency_rate': 0.0,
            'renewable_share': 0.0
        }
        
        # Self-consumption rate: fraction of generation used locally
        if renewable_wh > 0:
            system['self_consumption_rate'] = min(1.0, load_wh / renewable_wh)
        
        # Self-sufficiency rate: fraction of load met by local generation
        if load_wh > 0:
            system['self_sufficiency_rate'] = min(1.0, renewable_wh / load_wh)
            system['renewable_share'] = (renewable_wh / load_wh) * 100.0
        
        return system
    
    def _integrate_power_series(self, power_series: pd.Series) -> pd.Series:
        """
        Integrate power (W) to energy (Wh) using trapezoidal rule.
        
        Args:
            power_series: Time-indexed series of power values
        
        Returns:
            Series of energy increments
        """
        if power_series.empty or not isinstance(power_series.index, pd.DatetimeIndex):
            return pd.Series(dtype=float)
        
        # Calculate time differences in hours
        time_diff_hours = power_series.index.to_series().diff().dt.total_seconds() / 3600.0
        
        # Trapezoidal integration
        avg_power = (power_series + power_series.shift(1)) / 2
        energy_increment = avg_power * time_diff_hours
        
        return energy_increment.fillna(0)