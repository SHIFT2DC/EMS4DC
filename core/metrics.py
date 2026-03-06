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

@File: metrics.py
@Description: Main entry point for EMS metrics calculation.
    # Run once for the last hour
    python metrics.py --once

    # Run on schedule (hourly)
    python metrics.py --schedule

    # Run for specific period
    python metrics.py --once --start "2026-02-10 00:00:00" --end "2026-02-10 23:59:59"

    # Backfill historical data
    python metrics.py --backfill --start "2026-02-01 00:00:00" --end "2026-02-10 00:00:00" --period-hours 1

@Created: 11 February 2026
@Last Modified: 05 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

import logging
from metrics_utils.orchestrator import MetricsOrchestrator
from utils.time_utils import floor_to_hour, current_time
from utils.logging_utils import setup_logging
setup_logging()
logger = logging.getLogger('metrics')

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


def parse_datetime(date_string: str) -> datetime:
    """Parse datetime string in various formats."""
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_string, fmt)
        except ValueError:
            continue
    
    raise ValueError(f"Could not parse datetime: {date_string}")


def main():
    parser = argparse.ArgumentParser(
        description="EMS Metrics Calculation System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    # Execution mode
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        '--once',
        action='store_true',
        help='Run metrics calculation once and exit'
    )
    mode_group.add_argument(
        '--schedule',
        action='store_true',
        help='Run metrics calculation on schedule (continuous)'
    )
    mode_group.add_argument(
        '--backfill',
        action='store_true',
        help='Backfill historical metrics'
    )
    
    # Time period arguments
    parser.add_argument(
        '--start',
        type=str,
        help='Start datetime (YYYY-MM-DD HH:MM:SS)'
    )
    parser.add_argument(
        '--end',
        type=str,
        help='End datetime (YYYY-MM-DD HH:MM:SS)'
    )
    parser.add_argument(
        '--period-hours',
        type=int,
        default=1,
        help='Period duration in hours (default: 1)'
    )
    
    # Schedule configuration
    parser.add_argument(
        '--hourly',
        action='store_true',
        default=True,
        help='Enable hourly metrics (default: enabled)'
    )
    parser.add_argument(
        '--no-hourly',
        action='store_true',
        help='Disable hourly metrics'
    )
    parser.add_argument(
        '--hourly-minute',
        type=int,
        default=1,
        help='Minute of hour for hourly calculations (default: 1)'
    )
    
    
    # Configuration
    parser.add_argument(
        '--config-dir',
        type=str,
        default='./conf/',
        help='Directory containing config.json and modbus.json (default: ./conf/)'
    )
    
    args = parser.parse_args()
    
    # Handle hourly/daily flags
    enable_hourly = args.hourly and not args.no_hourly
    
    # Parse datetime arguments
    start_time = parse_datetime(args.start) if args.start else None
    end_time = parse_datetime(args.end) if args.end else None

    # For --once and --schedule, default end to the most recently completed whole
    # hour and start to one period before that, so database timestamps are always
    # aligned to clean hour boundaries regardless of when the command is run.
    if (args.once or args.schedule) and end_time is None:
        end_time = floor_to_hour(current_time())
        if start_time is None:
            start_time = end_time - timedelta(hours=args.period_hours)
    
    # Initialize orchestrator
    logger.info("Initializing EMS Metrics Orchestrator")
    orchestrator = MetricsOrchestrator(config_dir=args.config_dir)
    
    # Execute based on mode
    if args.once:
        logger.info("Running metrics calculation once")
        orchestrator.run_once(
            start_time=start_time,
            end_time=end_time,
            period_hours=args.period_hours
        )
        logger.info("Running metrics calculation once: Done.")
    
    elif args.schedule:
        logger.info("Starting scheduled metrics calculation")
        orchestrator.run_scheduled(
            hourly=enable_hourly,
            hourly_minute=args.hourly_minute
        )
    
    elif args.backfill:
        if not args.start or not args.end:
            logger.error("Error: --backfill requires --start and --end arguments")
            sys.exit(1)
        
        logger.info("Starting metrics backfill...")
        orchestrator.backfill_metrics(
            start_date=start_time,
            end_date=end_time,
            period_hours=args.period_hours
        )
        logger.info("Backfill complete!")


if __name__ == '__main__':
    main()