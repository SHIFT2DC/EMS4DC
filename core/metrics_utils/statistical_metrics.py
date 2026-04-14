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

@File: statistical_metrics.py
@Description: Statistical and data quality metrics calculator. Handles time-aggregated sums, descriptive stats, outlier detection.

@Created: 11 February 2026
@Last Modified: 10 February 2026
@Author: Leon Gritsyuk

@Version: v2.0.1
'''


import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from metrics_utils.data_loader import MeasurementLoader


class StatisticalMetrics:
    """Calculate statistical and data quality metrics."""
    
    def __init__(self, data_loader: MeasurementLoader):
        self.data_loader = data_loader
    
    def calculate_period_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        aggregation_freq: str = '1H'
    ) -> Dict[str, any]:
        """
        Calculate statistical metrics for a time period.
        
        Args:
            start_time: Start of period
            end_time: End of period
            aggregation_freq: Frequency for time aggregation ('1H', '1D', etc.)
        """
        metrics = {}
        
        # Data quality statistics
        metrics['data_quality'] = self._calculate_data_quality(start_time, end_time)
        
        # Time-aggregated statistics
        metrics['time_aggregated'] = self._calculate_time_aggregated_stats(
            start_time, end_time, aggregation_freq
        )
        
        # Descriptive statistics
        metrics['descriptive_stats'] = self._calculate_descriptive_stats(
            start_time, end_time
        )
        
        # Outlier detection
        metrics['outliers'] = self._detect_outliers(start_time, end_time)
        
        metrics['period_start'] = start_time
        metrics['period_end'] = end_time
        metrics['aggregation_frequency'] = aggregation_freq
        
        return metrics
    
    def _calculate_data_quality(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, any]:
        """Calculate data quality metrics."""
        quality_stats = self.data_loader.get_data_quality_stats(
            start_time, end_time
        )
        
        # Expected number of samples
        period_seconds = (end_time - start_time).total_seconds()
        sample_interval_seconds = 12.5  # Average of 10-15 seconds
        expected_samples_per_parameter = int(period_seconds / sample_interval_seconds)
        
        # Get active assets count
        assets_df = self.data_loader.get_active_assets()
        num_assets = len(assets_df)
        
        # Estimate parameters per asset (rough average)
        avg_params_per_asset = 5
        expected_total_samples = expected_samples_per_parameter * num_assets * avg_params_per_asset
        
        actual_samples = quality_stats['total_points']
        completeness = (actual_samples / expected_total_samples * 100) if expected_total_samples > 0 else 0
        
        return {
            'total_data_points': quality_stats['total_points'],
            'ok_data_points': quality_stats['ok_points'],
            'error_data_points': quality_stats['error_points'],
            'quality_percentage': quality_stats['quality_percentage'],
            'expected_samples': expected_total_samples,
            'completeness_percentage': float(min(100, completeness)),
            'by_asset': quality_stats.get('by_asset', {})
        }
    
    def _calculate_time_aggregated_stats(
        self,
        start_time: datetime,
        end_time: datetime,
        freq: str
    ) -> Dict[str, any]:
        """
        Calculate time-aggregated statistics.
        Sum power to energy in regular time buckets.
        """
        assets_df = self.data_loader.get_active_assets()
        all_assets = assets_df['asset_key'].tolist()
        
        # Get power measurements
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', all_assets
        )
        
        if power_df.empty:
            return {
                'aggregated_energy': {},
                'aggregation_frequency': freq,
                'num_intervals': 0
            }
        
        # Resample to regular intervals
        resampled = {}
        for asset_key in power_df.columns:
            power_series = power_df[asset_key].dropna()
            
            if power_series.empty:
                continue
            
            # Resample and calculate energy for each interval
            # Use mean power and multiply by interval duration
            power_resampled = power_series.resample(freq).mean()
            
            # Convert to energy (Wh)
            # Get interval duration in hours
            if freq.endswith('H'):
                hours = float(freq[:-1])
            elif freq.endswith('min'):
                hours = float(freq[:-3]) / 60.0
            elif freq.endswith('D'):
                hours = float(freq[:-1]) * 24
            else:
                hours = 1.0
            
            energy_wh = power_resampled * hours
            
            resampled[asset_key] = {
                'mean_energy_per_interval_wh': float(energy_wh.mean()),
                'total_energy_wh': float(energy_wh.sum()),
                'max_interval_energy_wh': float(energy_wh.max()),
                'min_interval_energy_wh': float(energy_wh.min()),
                'num_intervals': len(energy_wh)
            }
        
        return {
            'aggregated_energy': resampled,
            'aggregation_frequency': freq,
            'num_intervals': max([v['num_intervals'] for v in resampled.values()]) if resampled else 0
        }
    
    def _calculate_descriptive_stats(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, any]:
        """
        Calculate descriptive statistics for power measurements.
        Mean, median, std, min, max for each asset.
        """
        assets_df = self.data_loader.get_active_assets()
        all_assets = assets_df['asset_key'].tolist()
        
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', all_assets
        )
        
        if power_df.empty:
            return {}
        
        stats = {}
        
        for asset_key in power_df.columns:
            power_series = power_df[asset_key].dropna()
            
            if power_series.empty:
                continue
            
            stats[asset_key] = {
                'mean_w': float(power_series.mean()),
                'median_w': float(power_series.median()),
                'std_w': float(power_series.std()),
                'min_w': float(power_series.min()),
                'max_w': float(power_series.max()),
                'percentile_25_w': float(power_series.quantile(0.25)),
                'percentile_75_w': float(power_series.quantile(0.75)),
                'range_w': float(power_series.max() - power_series.min()),
                'coefficient_of_variation': float(power_series.std() / power_series.mean()) if power_series.mean() != 0 else 0,
                'sample_count': len(power_series)
            }
        
        # Calculate system-wide stats
        total_power = power_df.sum(axis=1)
        
        stats['system_total'] = {
            'mean_w': float(total_power.mean()),
            'median_w': float(total_power.median()),
            'std_w': float(total_power.std()),
            'min_w': float(total_power.min()),
            'max_w': float(total_power.max()),
            'range_w': float(total_power.max() - total_power.min())
        }
        
        return stats
    
    def _detect_outliers(
        self,
        start_time: datetime,
        end_time: datetime,
        z_threshold: float = 3.0
    ) -> Dict[str, any]:
        """
        Detect outliers in power measurements.
        Uses Z-score method (values beyond z_threshold standard deviations).
        """
        assets_df = self.data_loader.get_active_assets()
        all_assets = assets_df['asset_key'].tolist()
        
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', all_assets
        )
        
        if power_df.empty:
            return {
                'outliers_detected': 0,
                'by_asset': {}
            }
        
        outlier_summary = {}
        total_outliers = 0
        
        for asset_key in power_df.columns:
            power_series = power_df[asset_key].dropna()
            
            if len(power_series) < 10:  # Need enough data
                continue
            
            # Calculate Z-scores
            mean = power_series.mean()
            std = power_series.std()
            
            if std == 0:
                continue
            
            z_scores = np.abs((power_series - mean) / std)
            outliers = power_series[z_scores > z_threshold]
            
            if len(outliers) > 0:
                outlier_summary[asset_key] = {
                    'outlier_count': len(outliers),
                    'outlier_percentage': float(len(outliers) / len(power_series) * 100),
                    'outlier_values_w': outliers.tolist()[:10],  # First 10 outliers
                    'mean_w': float(mean),
                    'std_w': float(std)
                }
                total_outliers += len(outliers)
        
        return {
            'outliers_detected': total_outliers,
            'z_threshold': z_threshold,
            'by_asset': outlier_summary
        }
    
    def calculate_weekday_weekend_patterns(
        self,
        start_time: datetime,
        end_time: datetime
    ) -> Dict[str, any]:
        """
        Calculate patterns for weekday vs weekend.
        Useful for understanding load profiles.
        """
        assets_df = self.data_loader.get_active_assets()
        load_assets = assets_df[
            assets_df['type'].isin(['LOAD', 'CRITICAL_LOAD'])
        ]['asset_key'].tolist()
        
        if not load_assets:
            return {}
        
        power_df = self.data_loader.get_parameter_by_asset(
            start_time, end_time, 'POWER', load_assets
        )
        
        if power_df.empty:
            return {}
        
        total_load = power_df.sum(axis=1).abs()
        
        # Separate weekday and weekend
        weekday_mask = total_load.index.dayofweek < 5
        
        weekday_load = total_load[weekday_mask]
        weekend_load = total_load[~weekday_mask]
        
        patterns = {}
        
        if not weekday_load.empty:
            patterns['weekday'] = {
                'mean_w': float(weekday_load.mean()),
                'max_w': float(weekday_load.max()),
                'min_w': float(weekday_load.min()),
                'total_wh': float(self._integrate_power_series(weekday_load).sum())
            }
        
        if not weekend_load.empty:
            patterns['weekend'] = {
                'mean_w': float(weekend_load.mean()),
                'max_w': float(weekend_load.max()),
                'min_w': float(weekend_load.min()),
                'total_wh': float(self._integrate_power_series(weekend_load).sum())
            }
        
        return patterns
    
    def _integrate_power_series(self, power_series: pd.Series) -> pd.Series:
        """Integrate power to energy using trapezoidal rule."""
        if power_series.empty or not isinstance(power_series.index, pd.DatetimeIndex):
            return pd.Series(dtype=float)
        
        time_diff_hours = power_series.index.to_series().diff().dt.total_seconds() / 3600.0
        avg_power = (power_series + power_series.shift(1)) / 2
        energy_increment = avg_power * time_diff_hours
        
        return energy_increment.fillna(0)