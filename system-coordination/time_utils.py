'''
SPDX-License-Identifier: Apache-2.0

Copyright 2025 Eaton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and

File: time_utils.py
Description: # TODO: Add desc

Created: 1st July 2025
Last Modified: 30th October 2025
Version: v1.0.0
'''

# time related utility functions
from datetime import datetime, timedelta


def calculate_time_for_execution(
    interval_minutes: int, start_time: datetime = None, current_time: datetime = None
):
    """Function returns time in seconds needed to wait until next exec of our python script.
    So that the execution time is something like this: 10:00, 10:15, 10:30 and so on.

    Args:
        interval_minutes (int): frequency in minutes.  Defaults to 5.
        start_time (datetime): the time from when the next execution time is claculated
        current_time (datetime, optional): current time for running this function, which will decide the real sleeping
        time for the system until the next execution. Defaults to None.
    """

    if interval_minutes <= 0:
        print(
            f"Time interval not invalid: {interval_minutes}; Set sleep time to 0 to trigger the next execution"
        )
        return 0  # no need to wait if interval <=0

    now = start_time if start_time is not None else datetime.now()
    print(f"Reference start time for calcuting the next execution time: {start_time}")

    # Calculate the next execution time
    next_execution = (now + timedelta(minutes=interval_minutes)).replace(
        second=0, microsecond=0
    )
    next_execution = next_execution - timedelta(
        minutes=next_execution.minute % interval_minutes
    )
    print(f"Next execution time: {next_execution}")

    current_time = current_time if current_time else datetime.now()
    print(f"Current system time is {current_time}")
    # Wait until the next execution time
    sleep_time = (next_execution - current_time).total_seconds()
    if sleep_time < 0:
        sleep_time = 0
    print(f"Sleep time: {sleep_time}")
    return sleep_time