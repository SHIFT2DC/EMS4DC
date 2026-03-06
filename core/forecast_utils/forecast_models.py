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

@File: forecasting_models.py
@Description: Base forecasting models for different asset types. Supports multiple forecasting approaches: Prophet, SARIMA, and simple baseline models.

@Created: 08 February 2026
@Last Modified: 05 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np
import pandas as pd
import logging
from dataclasses import dataclass

from utils.logging_utils import setup_logging
from utils.time_utils import current_time
setup_logging()
logger = logging.getLogger(__name__)


@dataclass
class ForecastResult:
    """Container for forecast results."""
    timestamps: List[datetime]
    predictions: np.ndarray
    confidence_lower: Optional[np.ndarray] = None
    confidence_upper: Optional[np.ndarray] = None
    model_type: str = 'unknown'
    model_version: str = '1.0'
    metrics: Optional[Dict] = None


class BaseForecaster(ABC):
    """Abstract base class for all forecasting models."""
    
    def __init__(self, asset_key: str, asset_type: str):
        self.asset_key = asset_key
        self.asset_type = asset_type
        self.model = None
        self.model_version = '1.0'
        self.is_trained = False
    
    @abstractmethod
    def train(self, data: pd.DataFrame):
        """Train the forecasting model."""
        pass
    
    @abstractmethod
    def predict(self, horizon_hours: int = 12, interval_minutes: int = 15) -> ForecastResult:
        """Generate forecast for specified horizon."""
        pass
    
    @abstractmethod
    def get_model_params(self) -> Dict:
        """Get model parameters for storage."""
        pass
    
    def evaluate(self, test_data: pd.DataFrame) -> Dict[str, float]:
        """
        Evaluate model performance on test data.
        
        Args:
            test_data: DataFrame with 'timestamp' and 'power' columns
            
        Returns:
            Dictionary with performance metrics
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before evaluation")
        
        # Generate predictions for test period
        # This is a simplified version - actual implementation would be more sophisticated
        predictions = []
        actuals = []
        
        # For now, return placeholder metrics
        return {
            'mae': 0.0,
            'rmse': 0.0,
            'mape': 0.0,
            'r2': 0.0
        }


class ProphetForecaster(BaseForecaster):
    """Facebook Prophet-based forecaster for seasonal patterns."""
    
    def __init__(self, asset_key: str, asset_type: str):
        super().__init__(asset_key, asset_type)
        self.model_type = 'Prophet'
        
    def train(self, data: pd.DataFrame):
        """
        Train Prophet model.
        
        Args:
            data: DataFrame with 'timestamp' and 'power' columns
        """
        try:
            from prophet import Prophet
        except ImportError:
            raise ImportError("Prophet not installed. Install with: pip install prophet")
        
        # Prepare data for Prophet (requires 'ds' and 'y' columns)
        prophet_data = pd.DataFrame({
            'ds': data['timestamp'],
            'y': data['power']
        })
        
        # Configure Prophet based on asset type
        if self.asset_type in ['PV', 'WIND']:
            # Strong daily seasonality for renewable sources
            self.model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=True,
                seasonality_mode='multiplicative',
                interval_width=0.8
            )
        elif self.asset_type in ['LOAD', 'CRITICAL_LOAD']:
            # Strong weekly patterns for loads
            self.model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=False,
                seasonality_mode='additive',
                interval_width=0.8
            )
        else:
            # Default configuration
            self.model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                interval_width=0.8
            )
        
        # Add custom seasonalities if needed
        if self.asset_type == 'PV':
            # Add sunrise/sunset effects (simplified)
            self.model.add_seasonality(
                name='hourly',
                period=1,
                fourier_order=8
            )
        
        self.model.fit(prophet_data)
        self.is_trained = True
        logger.debug(f"Prophet model trained for {self.asset_key}")
    
    def predict(self, horizon_hours: int = 12, interval_minutes: int = 60) -> ForecastResult:
        """Generate forecast using Prophet, starting from the next rounded hour."""
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
        
        # Start forecast from the next rounded hour
        now = current_time()
        if now.minute == 0 and now.second == 0:
            start_time = now
        else:
            # Round up to next hour
            start_time = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        
        # Create future dataframe starting from rounded hour
        periods = horizon_hours * (60 // interval_minutes)
        
        # Generate timestamps
        future_timestamps = [start_time + timedelta(minutes=interval_minutes * i) 
                           for i in range(periods)]
        
        future = pd.DataFrame({'ds': future_timestamps})
        
        # Generate forecast
        forecast = self.model.predict(future)
        
        return ForecastResult(
            timestamps=forecast['ds'].tolist(),
            predictions=forecast['yhat'].values,
            confidence_lower=forecast['yhat_lower'].values,
            confidence_upper=forecast['yhat_upper'].values,
            model_type=self.model_type,
            model_version=self.model_version
        )
    
    def get_model_params(self) -> Dict:
        """Get Prophet model parameters."""
        if not self.is_trained:
            return {}
        
        return {
            'changepoint_prior_scale': self.model.changepoint_prior_scale,
            'seasonality_prior_scale': self.model.seasonality_prior_scale,
            'holidays_prior_scale': self.model.holidays_prior_scale,
            'seasonality_mode': self.model.seasonality_mode,
            'daily_seasonality': self.model.daily_seasonality,
            'weekly_seasonality': self.model.weekly_seasonality
        }


class SimpleMovingAverageForecaster(BaseForecaster):
    """
    Simple moving average forecaster for baseline comparison.
    Uses similar hour/day patterns from historical data.
    """
    
    def __init__(self, asset_key: str, asset_type: str):
        super().__init__(asset_key, asset_type)
        self.model_type = 'MovingAverage'
        self.hourly_patterns = None
        self.daily_patterns = None
        self.weekly_patterns = None
    
    def train(self, data: pd.DataFrame):
        """
        Extract patterns from historical data.
        
        Args:
            data: DataFrame with 'timestamp' and 'power' columns
        """
        data = data.copy()
        data['hour'] = data['timestamp'].dt.hour
        data['day_of_week'] = data['timestamp'].dt.dayofweek
        data['day_of_year'] = data['timestamp'].dt.dayofyear
        
        # Calculate hourly patterns (average power for each hour of day)
        self.hourly_patterns = data.groupby('hour')['power'].mean().to_dict()
        
        # Calculate daily patterns (average for each day of week)
        self.daily_patterns = data.groupby('day_of_week')['power'].mean().to_dict()
        
        # Calculate recent trend
        self.recent_avg = data.tail(96)['power'].mean()  # Last 24 hours (15-min intervals)
        self.recent_std = data.tail(96)['power'].std()
        
        self.is_trained = True
        logger.debug(f"Moving Average model trained for {self.asset_key}")
    
    def predict(self, horizon_hours: int = 12, interval_minutes: int = 60) -> ForecastResult:
        """Generate forecast using historical patterns, starting from next rounded hour."""
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
        
        # Start forecast from the next rounded hour
        now = current_time()
        if now.minute == 0 and now.second == 0:
            start_time = now
        else:
            # Round up to next hour
            start_time = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        
        # Generate future timestamps
        periods = horizon_hours * (60 // interval_minutes)
        timestamps = [start_time + timedelta(minutes=interval_minutes * i) 
                     for i in range(periods)]
        
        # Predict based on hourly patterns
        predictions = []
        for ts in timestamps:
            hour = ts.hour
            # Use hourly pattern with some randomness to avoid flat lines
            base_prediction = self.hourly_patterns.get(hour, self.recent_avg)
            predictions.append(base_prediction)
        
        predictions = np.array(predictions)
        
        # Simple confidence intervals (±1 std dev)
        confidence_lower = predictions - self.recent_std
        confidence_upper = predictions + self.recent_std
        
        # Ensure non-negative predictions for power
        predictions = np.maximum(predictions, 0)
        confidence_lower = np.maximum(confidence_lower, 0)
        
        return ForecastResult(
            timestamps=timestamps,
            predictions=predictions,
            confidence_lower=confidence_lower,
            confidence_upper=confidence_upper,
            model_type=self.model_type,
            model_version=self.model_version
        )
    
    def get_model_params(self) -> Dict:
        """Get model parameters."""
        return {
            'num_hourly_patterns': len(self.hourly_patterns) if self.hourly_patterns else 0,
            'recent_avg': float(self.recent_avg) if self.recent_avg else 0.0,
            'recent_std': float(self.recent_std) if self.recent_std else 0.0
        }


class PersistenceForecaster(BaseForecaster):
    """
    Naive persistence forecaster (last value repeated).
    Useful as a baseline for comparison.
    """
    
    def __init__(self, asset_key: str, asset_type: str):
        super().__init__(asset_key, asset_type)
        self.model_type = 'Persistence'
        self.last_value = None
        self.last_std = None
    
    def train(self, data: pd.DataFrame):
        """Store the most recent value."""
        self.last_value = data['power'].iloc[-1]
        self.last_std = data['power'].tail(96).std()  # Last 24 hours
        self.is_trained = True
        logger.debug(f"Persistence model 'trained' for {self.asset_key}")
    
    def predict(self, horizon_hours: int = 12, interval_minutes: int = 60) -> ForecastResult:
        """Repeat the last value, starting from next rounded hour."""
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
        
        # Start forecast from the next rounded hour
        now = current_time()
        if now.minute == 0 and now.second == 0:
            start_time = now
        else:
            # Round up to next hour
            start_time = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        
        periods = horizon_hours * (60 // interval_minutes)
        timestamps = [start_time + timedelta(minutes=interval_minutes * i) 
                     for i in range(periods)]
        
        predictions = np.full(periods, self.last_value)
        confidence_lower = predictions - self.last_std
        confidence_upper = predictions + self.last_std
        
        return ForecastResult(
            timestamps=timestamps,
            predictions=predictions,
            confidence_lower=np.maximum(confidence_lower, 0),
            confidence_upper=confidence_upper,
            model_type=self.model_type,
            model_version=self.model_version
        )
    
    def get_model_params(self) -> Dict:
        """Get model parameters."""
        return {
            'last_value': float(self.last_value) if self.last_value else 0.0,
            'last_std': float(self.last_std) if self.last_std else 0.0
        }


def create_forecaster(
    asset_key: str, 
    asset_type: str, 
    model_type: str = 'auto'
) -> BaseForecaster:
    """
    Factory function to create appropriate forecaster.
    
    Args:
        asset_key: Unique identifier for the asset
        asset_type: Type of asset
        model_type: Type of model ('auto', 'prophet', 'moving_average', 'persistence')
        
    Returns:
        Configured forecaster instance
    """
    if model_type == 'auto':
        # Automatically select best model type based on asset type
        if asset_type in ['PV', 'WIND']:
            # Strong seasonal patterns - use Prophet if available
            try:
                return ProphetForecaster(asset_key, asset_type)
            except ImportError:
                logger.warning("Prophet not available, using MovingAverage")
                return SimpleMovingAverageForecaster(asset_key, asset_type)
        else:
            # For loads and other assets, use moving average
            return SimpleMovingAverageForecaster(asset_key, asset_type)
    
    elif model_type == 'prophet':
        return ProphetForecaster(asset_key, asset_type)
    elif model_type == 'moving_average':
        return SimpleMovingAverageForecaster(asset_key, asset_type)
    elif model_type == 'persistence':
        return PersistenceForecaster(asset_key, asset_type)
    else:
        raise ValueError(f"Unknown model type: {model_type}")