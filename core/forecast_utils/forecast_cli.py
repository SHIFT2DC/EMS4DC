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

@File: forecast_cli.py
@Description: Command-line interface for EMS Forecasting System

@Created: 08 February 2026
@Last Modified: 05 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
'''


import argparse
import sys
from datetime import datetime
from tabulate import tabulate
import pandas as pd 

from forecast_utils.db_config import get_db, initialize_database
from forecast_utils.data_validator import DataValidator
from forecast_utils.forecast_generator import ForecastGenerator
from forecast_utils.model_trainer import ModelTrainer
from utils.time_utils import current_time


def cmd_status(args):
    """Show system status."""
    print("EMS Forecasting System Status")
    print("=" * 80)
    
    # Data readiness
    validator = DataValidator()
    ready_assets = validator.get_ready_assets()
    
    print(f"\nData Readiness:")
    print(f"  Ready assets: {len(ready_assets)}")
    
    # Forecast summary
    generator = ForecastGenerator()
    summary = generator.get_forecast_summary()
    
    print(f"\nCurrent Forecasts:")
    print(f"  Assets with forecasts: {summary.get('num_assets', 0)}")
    print(f"  Total predictions: {summary.get('total_predictions', 0)}")
    if summary.get('newest_forecast'):
        print(f"  Last generated: {summary['newest_forecast']}")
    if summary.get('last_horizon'):
        print(f"  Forecast until: {summary['last_horizon']}")
    
    # Model performance
    trainer = ModelTrainer()
    performance = trainer.get_model_performance_summary()
    
    print(f"\nTrained Models: {len(performance)}")


def cmd_validate(args):
    """Validate data readiness for all assets."""
    print("Checking data readiness for all assets...")
    print("=" * 80)
    
    validator = DataValidator()
    readiness = validator.check_all_assets_readiness()
    
    # Prepare table data
    table_data = []
    for asset_key, is_ready in readiness.items():
        status = "✓ Ready" if is_ready else "✗ Not Ready"
        table_data.append([asset_key, status])
    
    print(tabulate(table_data, headers=['Asset', 'Status'], tablefmt='grid'))
    
    ready_count = sum(readiness.values())
    print(f"\nSummary: {ready_count}/{len(readiness)} assets ready for forecasting")


def cmd_forecast(args):
    """Generate forecasts."""
    print("Generating forecasts...")
    print("=" * 80)
    
    generator = ForecastGenerator(model_type=args.model_type)
    
    start_time = current_time()
    results = generator.generate_all_forecasts(
        horizon_hours=args.horizon,
        interval_minutes=args.interval,
        force=args.force
    )
    duration = (current_time() - start_time).total_seconds()
    
    # Prepare results table
    table_data = []
    for asset_key, success in results.items():
        status = "✓ Success" if success else "✗ Failed"
        table_data.append([asset_key, status])
    
    print(tabulate(table_data, headers=['Asset', 'Status'], tablefmt='grid'))
    
    success_count = sum(results.values())
    print(f"\nCompleted in {duration:.1f}s: {success_count}/{len(results)} successful")


def cmd_retrain(args):
    """Check retraining schedule or retrain models."""
    trainer = ModelTrainer()
    
    if args.execute:
        print("Retraining models...")
        print("=" * 80)
        
        results = trainer.retrain_all_models(force=args.force)
        
        # Prepare results table
        table_data = []
        for asset_key, result in results.items():
            if result is True:
                status = "✓ Trained"
            elif result is False:
                status = "✗ Failed"
            else:
                status = "○ Skipped"
            table_data.append([asset_key, status])
        
        print(tabulate(table_data, headers=['Asset', 'Status'], tablefmt='grid'))
        
        trained = sum(1 for v in results.values() if v is True)
        print(f"\nCompleted: {trained} models trained")
        
    else:
        print("Retraining Schedule")
        print("=" * 80)
        
        schedule = trainer.get_retraining_schedule()
        
        # Prepare schedule table
        table_data = []
        for asset_key, info in schedule.items():
            should_retrain = "Yes" if info['should_retrain'] else "No"
            last_trained = info['last_trained'].strftime('%Y-%m-%d %H:%M') if info['last_trained'] else 'Never'
            table_data.append([
                asset_key,
                info['asset_type'],
                should_retrain,
                info['priority'],
                last_trained,
                info['reason']
            ])
        
        print(tabulate(
            table_data,
            headers=['Asset', 'Type', 'Should Retrain', 'Priority', 'Last Trained', 'Reason'],
            tablefmt='grid'
        ))


def cmd_show(args):
    """Show forecasts for an asset."""
    generator = ForecastGenerator()
    forecasts = generator.get_latest_forecasts(asset_key=args.asset)
    
    if forecasts.empty:
        print(f"No forecasts found for asset: {args.asset}")
        return
    
    print(f"Forecasts for {args.asset}")
    print("=" * 80)
    
    # Show first few and last few rows
    if len(forecasts) > 20:
        display_df = pd.concat([forecasts.head(10), forecasts.tail(10)])
    else:
        display_df = forecasts
    
    # Format for display
    table_data = []
    for _, row in display_df.iterrows():
        table_data.append([
            row['horizon_timestamp'].strftime('%Y-%m-%d %H:%M'),
            f"{row['predicted_power']:.1f}",
            f"{row['confidence_lower']:.1f}" if row['confidence_lower'] else '-',
            f"{row['confidence_upper']:.1f}" if row['confidence_upper'] else '-',
            row['model_version']
        ])
    
    print(tabulate(
        table_data,
        headers=['Time', 'Power (W)', 'Lower (W)', 'Upper (W)', 'Model'],
        tablefmt='grid'
    ))
    
    print(f"\nTotal forecast points: {len(forecasts)}")
    print(f"Forecast generated: {forecasts['forecast_timestamp'].iloc[0]}")


def cmd_gaps(args):
    """Show data gaps for an asset."""
    validator = DataValidator()
    gap_report = validator.get_data_gap_report(args.asset, days=args.days)
    
    print(f"Data Gap Analysis for {args.asset} (last {args.days} days)")
    print("=" * 80)
    
    if not gap_report['has_data']:
        print("No data found for this asset")
        return
    
    print(f"Total samples: {gap_report['total_samples']}")
    print(f"Time range: {gap_report['start_time']} to {gap_report['end_time']}")
    print(f"\nGaps detected: {gap_report['total_gaps']}")
    print(f"Largest gap: {gap_report['largest_gap_hours']:.1f} hours")
    print(f"Average gap: {gap_report['avg_gap_hours']:.1f} hours")


def cmd_init(args):
    """Initialize database schema."""
    print("Initializing database schema...")
    
    db = get_db()
    try:
        initialize_database(db)
        print("✓ Database schema initialized successfully")
    except Exception as e:
        print(f"✗ Error initializing database: {str(e)}")
        sys.exit(1)
    finally:
        db.close_pool()


def main():
    parser = argparse.ArgumentParser(description='EMS Forecasting CLI')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Status command
    subparsers.add_parser('status', help='Show system status')
    
    # Validate command
    subparsers.add_parser('validate', help='Validate data readiness')
    
    # Forecast command
    forecast_parser = subparsers.add_parser('forecast', help='Generate forecasts')
    forecast_parser.add_argument('--horizon', type=int, default=12, help='Forecast horizon in hours')
    forecast_parser.add_argument('--interval', type=int, default=60, help='Interval in minutes (default: 60 for hourly)')
    forecast_parser.add_argument('--model-type', default='auto', help='Model type (auto, prophet, moving_average)')
    forecast_parser.add_argument('--force', action='store_true', help='Force forecast for all assets')
    
    # Retrain command
    retrain_parser = subparsers.add_parser('retrain', help='Manage model retraining')
    retrain_parser.add_argument('--execute', action='store_true', help='Execute retraining (default: show schedule)')
    retrain_parser.add_argument('--force', action='store_true', help='Force retrain all models')
    
    # Show command
    show_parser = subparsers.add_parser('show', help='Show forecasts for an asset')
    show_parser.add_argument('asset', help='Asset key')
    
    # Gaps command
    gaps_parser = subparsers.add_parser('gaps', help='Show data gaps for an asset')
    gaps_parser.add_argument('asset', help='Asset key')
    gaps_parser.add_argument('--days', type=int, default=7, help='Number of days to analyze')
    
    # Init command
    subparsers.add_parser('init', help='Initialize database schema')
    
    args = parser.parse_args()
    
    if args.command == 'status':
        cmd_status(args)
    elif args.command == 'validate':
        cmd_validate(args)
    elif args.command == 'forecast':
        cmd_forecast(args)
    elif args.command == 'retrain':
        cmd_retrain(args)
    elif args.command == 'show':
        cmd_show(args)
    elif args.command == 'gaps':
        cmd_gaps(args)
    elif args.command == 'init':
        cmd_init(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()