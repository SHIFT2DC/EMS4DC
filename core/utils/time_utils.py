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

@File: time_utils.py
@Description: # TODO: Add desc

@Created: 1st July 2025
@Last Modified: 16 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.0
'''


from utils.logging_utils import setup_logging
import logging

# time related utility functions
from datetime import datetime, timedelta

logger = logging.getLogger('time_utils')

def calculate_time_for_execution(
    interval_minutes: float = 15, start_time: datetime = None, current_time: datetime = None
):
    """Function returns time in seconds needed to wait until next exec of python script.
    So that the execution time is something like this: 10:00, 10:15, 10:30 and so on.
    Supports sub-minute intervals, e.g. interval_minutes=15/60 for every 15 seconds.

    Args:
        interval_minutes (float): frequency in minutes. Defaults to 15.
        start_time (datetime): the time from when the next execution time is calculated
        current_time (datetime, optional): current time for running this function, which will decide the real sleeping
        time for the system until the next execution. Defaults to None.
    """

    if interval_minutes <= 0:
        logger.error(
            f"Time interval not invalid: {interval_minutes}; Set sleep time to 0 to trigger the next execution"
        )
        return 0  # no need to wait if interval <=0

    now = start_time if start_time is not None else datetime.now()
    logger.debug(f"Reference start time for calculating the next execution time: {now}")

    interval_seconds = interval_minutes * 60

    # Compute elapsed seconds since the start of the current hour
    start_of_hour = now.replace(minute=0, second=0, microsecond=0)
    elapsed_seconds = (now - start_of_hour).total_seconds()

    # Find how many full intervals have passed, then add one to get the next
    intervals_passed = elapsed_seconds // interval_seconds
    next_execution = start_of_hour + timedelta(seconds=(intervals_passed + 1) * interval_seconds)

    logger.debug(f"Next execution time: {next_execution}")

    current_time = current_time if current_time else datetime.now()
    logger.debug(f"Current system time is {current_time}")

    sleep_time = (next_execution - current_time).total_seconds()
    if sleep_time < 0:
        sleep_time = 0
    logger.debug(f"Sleep time: {sleep_time}")
    return sleep_time

def floor_to_hour(dt: datetime) -> datetime:
    """Round a datetime down to the nearest whole hour."""
    return dt.replace(minute=0, second=0, microsecond=0)