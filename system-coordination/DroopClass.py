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

File: DroopClass.py
Description: # TODO: Add desc

Created: 1st July 2025
Last Modified: 30th October 2025
Version: v1.0.0
'''

import matplotlib.pyplot as plt
import numpy as np
from click import style


class DroopCurve:
    def __init__(self, v_nom, p_supply, v_supply, p_consume, v_consume):
        self.v_nom = v_nom
        self.p_supply = p_supply
        self.u_supply = v_supply
        self.p_consume = p_consume
        self.u_consume = v_consume

        # Calculate key points for the line
        self.upper_point = (-p_consume, v_nom + v_consume)
        self.middle_point = (0, v_nom)
        self.lower_point = (p_supply, v_nom - v_supply)


    def adjust_droop_curve(self, p_opt):
        '''
        This function is responsible for adjusting droop curve based on optimal power point, which is being received from optimizer.
        This function sets the middle_point of the droop curve at (p_opt, v_nom)
        '''
        self.middle_point = (p_opt, self.v_nom)


    def display_graph(self):
        # Create figure and axes
        fig, ax = plt.subplots(figsize=(10, 8))

        # Draw the horizontal line at v_nom
        ax.axhline(y=self.v_nom, color='black', linestyle='-', linewidth=1.5)

        # Draw the vertical line at p=0
        ax.axvline(x=0, color='black', linestyle='-', linewidth=1.5)

        # Draw the orange line connecting the three points
        x_points = [self.upper_point[0], self.middle_point[0], self.lower_point[0]]
        y_points = [self.upper_point[1], self.middle_point[1],
                    self.lower_point[1]]
        ax.plot(x_points, y_points, color='orange', linewidth=4)

        # Plot middle point
        ax.plot(self.middle_point[0], self.middle_point[1], 'ro')

        # Draw dashed line for p_consume
        ax.plot([self.upper_point[0], 0], [self.upper_point[1], self.upper_point[1]], color='red', linestyle='--')

        # Draw dashed line for p_supply
        ax.plot([0, self.lower_point[0]], [self.lower_point[1], self.lower_point[1]], color='green', linestyle='--')

        # Draw lines for u_consume
        ax.plot([self.upper_point[0], 0], [self.v_nom, self.v_nom], color='black',
                linestyle='--')
        ax.plot([self.upper_point[0], self.upper_point[0]], [self.upper_point[1], self.v_nom],
                color='blue', linestyle='--')

        # Draw lines for u_supply
        ax.plot([self.upper_point[0], 0], [self.v_nom, self.v_nom], color='black',
                linestyle='--')
        ax.plot([self.upper_point[0], self.upper_point[0]], [self.v_nom, self.lower_point[1]],
                color='purple', linestyle='--')
        ax.plot([self.upper_point[0], 0], [self.lower_point[1], self.lower_point[1]], color='black', linestyle='--')

        # Add labels and arrows
        ax.text(-self.p_consume / 2, self.v_nom + self.u_consume + 0.05, f'p_consume={self.p_consume}',
                ha='center', color='red')
        ax.text(self.p_supply / 2, self.v_nom - self.u_supply - 0.05, f'p_supply={self.p_supply}',
                ha='center', color='green')
        #
        # ax.text(-0.1, self.v_nom, 'v_nom', ha='right', va='center')
        ax.text(-0.95 * self.p_consume, self.v_nom + self.u_consume / 2, 'v_consume', va='center',
                color='blue')
        ax.text(-0.95 * self.p_consume, self.v_nom - self.u_supply / 2, 'v_supply', va='center',
                color='purple')

        # Set axis labels
        ax.set_xlabel('Power (W)')
        ax.set_ylabel('Voltage (V)')
        ax.set_title('Droop Configuration')

        # Adjust limits to make the graph more readable
        margin = max(abs(self.p_consume), abs(self.p_supply)) * 1.1
        v_margin = (self.u_supply + self.u_consume) * 0.1
        ax.set_xlim(min(self.p_consume, -margin), max(self.p_supply, margin))
        ax.set_ylim(self.v_nom - self.u_supply - v_margin,
                    self.v_nom + self.u_consume + v_margin)

        plt.grid(True, linestyle='--', alpha=0.7)
        plt.tight_layout()
        plt.show()

    def get_power_at_voltage(self, voltage):
        """Calculate the power at a given voltage point on the line"""
        if voltage > (self.v_nom) and voltage <= self.upper_point[1]:
            # Upper segment of the line (voltage above v_band)
            slope = -self.p_consume / (self.upper_point[1] - (self.v_nom))
            return slope * (voltage - (self.v_nom))
        elif voltage < (self.v_nom) and voltage >= self.lower_point[1]:
            # Lower segment of the line (voltage below v_band)
            slope = self.p_supply / ((self.v_nom) - self.lower_point[1])
            return slope * ((self.v_nom) - voltage)
        elif voltage <= (self.v_nom) and voltage >= (self.v_nom):
            return 0
        else:
            raise ValueError("Voltage value is outside the defined range")

    def is_power_in_range(self, power):
        """Check if a power value is within the valid range"""
        return -self.p_consume <= power <= self.p_supply

    def __str__(self):
        return (f"DroopConfig(v_nom={self.v_nom},"
                f"p_supply={self.p_supply}, u_supply={self.u_supply}, "
                f"p_consume={self.p_consume}, u_consume={self.u_consume})")


# Initialize a droop curve
droop = DroopCurve(
    v_nom=700, v_supply=35, v_consume=35, p_consume=40000, p_supply=40000
)
# Display the initialization parameters
print(droop.__str__())
# Display the current droop curve
droop.display_graph()

# Adjust the middle point of the droop curve according to p_opt
droop.adjust_droop_curve(p_opt=10000)
droop.display_graph()
print(droop.__str__())