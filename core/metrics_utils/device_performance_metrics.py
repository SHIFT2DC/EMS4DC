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

@File: device_performance_metrics.py
@Description: Device-specific performance metrics calculator. Handles PV efficiency, wind capacity factor, battery efficiency, charger utilization.

@Created: 11 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from metrics_utils.data_loader import MeasurementLoader
from metrics_utils.config_loader import ConfigLoader


class DevicePerformanceMetrics:
    """Calculate device-specific performance metrics."""
    
    def __init__(self, data_loader: MeasurementLoader, config_loader: ConfigLoader):
        self.data_loader = data_loader
        self.config_loader = config_loader
    
    def calculate_period_metrics(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, any]:
        """Calculate all device performance metrics for a time period."""
        metrics = {}
        
        assets_df = self.data_loader.get_active_assets()
        
        # Calculate metrics by device type
        metrics['pv'] = self._calculate_pv_metrics(start_time, end_time, assets_df)
        metrics['wind'] = self._calculate_wind_metrics(start_time, end_time, assets_df)
        metrics['bess'] = self._calculate_bess_performance(start_time, end_time, assets_df)
        metrics['ev_chargers'] = self._calculate_ev_charger_metrics(start_time, end_time, assets_df)
        
        metrics['period_start'] = start_time
        metrics['period_end'] = end_time
        
        return metrics
    
    def _calculate_pv_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, any]:
        """
        Calculate PV system efficiency metrics.
        - Specific yield (kWh/kWp)
        - Performance ratio (PR)
        - Capacity factor
        """
        pv_assets = assets_df[assets_df['type'] == 'PV']['asset_key'].tolist()
        
        metrics = {}
        
        for asset_key in pv_assets:
            device_config = self.config_loader.get_device_config(asset_key)
            
            # Get power measurements
            power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', [asset_key]
            )
            
            if power_df.empty or asset_key not in power_df.columns:
                metrics[asset_key] = self._empty_pv_metrics()
                continue
            
            power_series = power_df[asset_key].dropna()
            
            # Calculate energy generated
            energy_wh = self._integrate_power_series(power_series).sum()
            energy_kwh = energy_wh / 1000.0
            
            # Get rated power
            rated_power_w = device_config.parameters.maxPower if device_config else 10000
            rated_power_kw = rated_power_w / 1000.0
            
            # Calculate period duration in hours
            period_hours = (end_time - start_time).total_seconds() / 3600.0
            
            # Specific yield (kWh/kWp)
            specific_yield = energy_kwh / rated_power_kw if rated_power_kw > 0 else 0
            
            # Theoretical maximum energy (if operating at rated power entire period)
            theoretical_kwh = rated_power_kw * period_hours
            
            # Performance ratio (actual / theoretical)
            performance_ratio = (energy_kwh / theoretical_kwh * 100) if theoretical_kwh > 0 else 0
            
            # Capacity factor (average power / rated power)
            avg_power = power_series.mean()
            capacity_factor = (avg_power / rated_power_w * 100) if rated_power_w > 0 else 0
            
            # Get efficiency if available
            efficiency_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'SYS_EFF', [asset_key]
            )
            avg_efficiency = 0
            if not efficiency_df.empty and asset_key in efficiency_df.columns:
                avg_efficiency = efficiency_df[asset_key].mean()
            
            metrics[asset_key] = {
                'energy_generated_kwh': float(energy_kwh),
                'specific_yield_kwh_per_kwp': float(specific_yield),
                'performance_ratio_percent': float(performance_ratio),
                'capacity_factor_percent': float(capacity_factor),
                'avg_efficiency_percent': float(avg_efficiency),
                'peak_power_w': float(power_series.max()),
                'avg_power_w': float(avg_power),
                'rated_power_kw': float(rated_power_kw),
                'operating_hours': float((power_series > 0).sum() * (period_hours / len(power_series)))
            }
        
        return metrics
    
    def _calculate_wind_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, any]:
        """Calculate wind turbine capacity factor and performance."""
        wind_assets = assets_df[assets_df['type'] == 'WIND']['asset_key'].tolist()
        
        metrics = {}
        
        for asset_key in wind_assets:
            device_config = self.config_loader.get_device_config(asset_key)
            
            power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', [asset_key]
            )
            
            if power_df.empty or asset_key not in power_df.columns:
                metrics[asset_key] = self._empty_wind_metrics()
                continue
            
            power_series = power_df[asset_key].dropna()
            
            # Calculate energy
            energy_wh = self._integrate_power_series(power_series).sum()
            energy_kwh = energy_wh / 1000.0
            
            # Get rated power
            rated_power_w = device_config.parameters.maxPower if device_config else 10000
            rated_power_kw = rated_power_w / 1000.0
            
            period_hours = (end_time - start_time).total_seconds() / 3600.0
            
            # Capacity factor
            theoretical_kwh = rated_power_kw * period_hours
            capacity_factor = (energy_kwh / theoretical_kwh * 100) if theoretical_kwh > 0 else 0
            
            metrics[asset_key] = {
                'energy_generated_kwh': float(energy_kwh),
                'capacity_factor_percent': float(capacity_factor),
                'peak_power_w': float(power_series.max()),
                'avg_power_w': float(power_series.mean()),
                'rated_power_kw': float(rated_power_kw)
            }
        
        return metrics
    
    def _calculate_bess_performance(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, any]:
        """Calculate BESS efficiency and performance."""
        bess_assets = assets_df[assets_df['type'] == 'BESS']['asset_key'].tolist()
        
        metrics = {}
        
        for asset_key in bess_assets:
            device_config = self.config_loader.get_device_config(asset_key)
            
            power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', [asset_key]
            )
            
            soc_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'SoC', [asset_key]
            )
            
            if power_df.empty or asset_key not in power_df.columns:
                metrics[asset_key] = self._empty_bess_metrics()
                continue
            
            power_series = power_df[asset_key].dropna()
            
            # Separate charging and discharging
            charging = power_series[power_series > 0]
            discharging = power_series[power_series < 0].abs()
            
            charging_wh = self._integrate_power_series(charging).sum()
            discharging_wh = self._integrate_power_series(discharging).sum()
            
            # Round-trip efficiency
            round_trip_efficiency = (discharging_wh / charging_wh * 100) if charging_wh > 0 else 0
            
            # SoC statistics
            soc_stats = {}
            if not soc_df.empty and asset_key in soc_df.columns:
                soc_series = soc_df[asset_key].dropna()
                soc_stats = {
                    'avg_soc_percent': float(soc_series.mean()),
                    'min_soc_percent': float(soc_series.min()),
                    'max_soc_percent': float(soc_series.max()),
                    'soc_range_percent': float(soc_series.max() - soc_series.min())
                }
            
            # Capacity info
            capacity_wh = device_config.parameters.capacity if device_config else 40000
            usable_capacity = capacity_wh * 0.7  # Assuming 70% usable
            
            # Cycle counting (simplified)
            cycles = 0
            if not soc_df.empty and asset_key in soc_df.columns:
                soc_series = soc_df[asset_key].dropna()
                # Count full charge-discharge cycles
                soc_change = soc_series.diff().abs()
                cycles = soc_change.sum() / 200.0  # 200% change = 1 full cycle
            
            metrics[asset_key] = {
                'charging_wh': float(charging_wh),
                'discharging_wh': float(discharging_wh),
                'round_trip_efficiency_percent': float(round_trip_efficiency),
                'cycles_count': float(cycles),
                'peak_charge_power_w': float(charging.max()) if not charging.empty else 0,
                'peak_discharge_power_w': float(discharging.max()) if not discharging.empty else 0,
                'nameplate_capacity_wh': float(capacity_wh),
                'usable_capacity_wh': float(usable_capacity),
                **soc_stats
            }
        
        return metrics
    
    def _calculate_ev_charger_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        assets_df: pd.DataFrame
    ) -> Dict[str, any]:
        """Calculate EV charger utilization metrics."""
        uni_ev = assets_df[assets_df['type'] == 'UNI_EV']['asset_key'].tolist()
        bi_ev = assets_df[assets_df['type'] == 'BI_EV']['asset_key'].tolist()
        all_ev = uni_ev + bi_ev
        
        metrics = {}
        
        for asset_key in all_ev:
            is_bidirectional = asset_key in bi_ev
            
            power_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'POWER', [asset_key]
            )
            
            soc_df = self.data_loader.get_parameter_by_asset(
                start_time, end_time, 'SoC', [asset_key]
            )
            
            if power_df.empty or asset_key not in power_df.columns:
                metrics[asset_key] = self._empty_ev_metrics(is_bidirectional)
                continue
            
            power_series = power_df[asset_key].dropna()
            
            period_hours = (end_time - start_time).total_seconds() / 3600.0
            
            # Charging sessions (power > threshold for consecutive periods)
            charging_threshold = 100  # W
            is_charging = power_series > charging_threshold
            charging_sessions = (is_charging.astype(int).diff() > 0).sum()
            
            # Total charging time
            charging_hours = (is_charging.sum() / len(power_series)) * period_hours
            
            # Utilization
            utilization = (charging_hours / period_hours * 100) if period_hours > 0 else 0
            
            # Energy delivered
            charging_power = power_series[power_series > 0]
            charging_wh = self._integrate_power_series(charging_power).sum()
            
            ev_metrics = {
                'charging_sessions': int(charging_sessions),
                'charging_hours': float(charging_hours),
                'utilization_percent': float(utilization),
                'energy_delivered_wh': float(charging_wh),
                'avg_charging_power_w': float(charging_power.mean()) if not charging_power.empty else 0,
                'peak_charging_power_w': float(charging_power.max()) if not charging_power.empty else 0,
                'is_bidirectional': is_bidirectional
            }
            
            # Bidirectional specific metrics
            if is_bidirectional:
                discharging_power = power_series[power_series < 0].abs()
                discharging_wh = self._integrate_power_series(discharging_power).sum()
                
                ev_metrics['energy_injected_wh'] = float(discharging_wh)
                ev_metrics['avg_discharging_power_w'] = float(discharging_power.mean()) if not discharging_power.empty else 0
                ev_metrics['peak_discharging_power_w'] = float(discharging_power.max()) if not discharging_power.empty else 0
            
            # SoC statistics
            if not soc_df.empty and asset_key in soc_df.columns:
                soc_series = soc_df[asset_key].dropna()
                ev_metrics['avg_soc_percent'] = float(soc_series.mean())
                ev_metrics['final_soc_percent'] = float(soc_series.iloc[-1])
            
            metrics[asset_key] = ev_metrics
        
        return metrics
    
    def _integrate_power_series(self, power_series: pd.Series) -> pd.Series:
        """Integrate power to energy using trapezoidal rule."""
        if power_series.empty or not isinstance(power_series.index, pd.DatetimeIndex):
            return pd.Series(dtype=float)
        
        time_diff_hours = power_series.index.to_series().diff().dt.total_seconds() / 3600.0
        avg_power = (power_series + power_series.shift(1)) / 2
        energy_increment = avg_power * time_diff_hours
        
        return energy_increment.fillna(0)
    
    def _empty_pv_metrics(self) -> Dict:
        return {
            'energy_generated_kwh': 0.0,
            'specific_yield_kwh_per_kwp': 0.0,
            'performance_ratio_percent': 0.0,
            'capacity_factor_percent': 0.0,
            'avg_efficiency_percent': 0.0,
            'peak_power_w': 0.0,
            'avg_power_w': 0.0,
            'rated_power_kw': 0.0,
            'operating_hours': 0.0
        }
    
    def _empty_wind_metrics(self) -> Dict:
        return {
            'energy_generated_kwh': 0.0,
            'capacity_factor_percent': 0.0,
            'peak_power_w': 0.0,
            'avg_power_w': 0.0,
            'rated_power_kw': 0.0
        }
    
    def _empty_bess_metrics(self) -> Dict:
        return {
            'charging_wh': 0.0,
            'discharging_wh': 0.0,
            'round_trip_efficiency_percent': 0.0,
            'cycles_count': 0.0,
            'peak_charge_power_w': 0.0,
            'peak_discharge_power_w': 0.0,
            'nameplate_capacity_wh': 0.0,
            'usable_capacity_wh': 0.0
        }
    
    def _empty_ev_metrics(self, is_bidirectional: bool) -> Dict:
        metrics = {
            'charging_sessions': 0,
            'charging_hours': 0.0,
            'utilization_percent': 0.0,
            'energy_delivered_wh': 0.0,
            'avg_charging_power_w': 0.0,
            'peak_charging_power_w': 0.0,
            'is_bidirectional': is_bidirectional
        }
        if is_bidirectional:
            metrics.update({
                'energy_injected_wh': 0.0,
                'avg_discharging_power_w': 0.0,
                'peak_discharging_power_w': 0.0
            })
        return metrics