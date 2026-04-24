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

@File: asset_validator.py
@Description: Validates that configuration has required assets for each objective

@Created: 6th February 2026
@Last Modified: 01 March 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.2
'''


from typing import Dict, List, Set, Any
import logging


class AssetValidator:
    """Validates configuration assets against objective function requirements"""
    
    # Define minimum required assets for each objective
    OBJECTIVE_REQUIREMENTS = {
        'maxWeightPowerFlow': {
            'required': {'AFE'},  # At least one AFE is required
            'optional': {'PV', 'BESS', 'LOAD', 'UNI_EV', 'BI_EV'},
            'min_one_of': [{'PV', 'WIND'}],  # At least one renewable source
        },
        'maxSelfConsumption': {
            'required': {'AFE'},  # At least one AFE is required
            'optional': {'PV', 'BESS', 'LOAD', 'UNI_EV', 'BI_EV', 'WIND'},
            'min_one_of': [{'PV', 'WIND'}],  # At least one renewable source
        },
        'maxEVSatisfaction': {
            'required': {'AFE'},
            'optional': {'PV', 'BESS', 'LOAD', 'WIND'},
            'min_one_of': [{'UNI_EV', 'BI_EV'}],  # At least one EV charger
        },
        'minFossilEmissions': {
            'required': {'AFE'},
            'optional': {'BESS', 'LOAD', 'CRITICAL_LOAD', 'UNI_EV', 'BI_EV'},
            'min_one_of': [{'PV', 'WIND'}],  # At least one renewable source
        },
        'maxReliability': {
            'required': {'AFE', 'BESS'},  # BESS required for backup
            'optional': {'PV', 'LOAD', 'CRITICAL_LOAD', 'UNI_EV', 'BI_EV', 'WIND'},
            'min_one_of': [],
        },
        'lifeExtentBESS': {
            'required': {'AFE', 'BESS'},  # BESS is obviously required
            'optional': {'PV', 'LOAD', 'CRITICAL_LOAD', 'UNI_EV', 'BI_EV', 'WIND'},
            'min_one_of': [],
        },
        'peakShaving': {
            'required': {'AFE', 'BESS'},  # BESS required for peak shaving
            'optional': {'PV', 'LOAD', 'CRITICAL_LOAD', 'UNI_EV', 'BI_EV', 'WIND'},
            'min_one_of': [],
        }
    }
    
    def __init__(self):
        self.logger = logging.getLogger('ems.asset_validator')
    
    def validate_configuration(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate that configuration has required assets for the specified objective
        
        Args:
            config: Configuration dictionary with 'devices' and 'generalSiteConfig'
            
        Returns:
            Dictionary with:
                - 'valid': bool
                - 'errors': List[str] - validation errors
                - 'warnings': List[str] - validation warnings
                - 'asset_summary': Dict - summary of assets by type
        """
        errors = []
        warnings = []
        
        # Extract objective function
        objective = config.get('generalSiteConfig', {}).get('objectiveFunction')
        if not objective:
            errors.append("No objective function specified in generalSiteConfig")
            return {'valid': False, 'errors': errors, 'warnings': warnings, 'asset_summary': {}}
        
        # Check if objective is supported
        if objective not in self.OBJECTIVE_REQUIREMENTS:
            errors.append(f"Unsupported objective function: {objective}. "
                         f"Supported objectives: {list(self.OBJECTIVE_REQUIREMENTS.keys())}")
            return {'valid': False, 'errors': errors, 'warnings': warnings, 'asset_summary': {}}
        
        # Get asset summary
        asset_summary = self._get_asset_summary(config.get('devices', []))
        
        # Validate against requirements
        requirements = self.OBJECTIVE_REQUIREMENTS[objective]
        
        # Check required assets
        missing_required = requirements['required'] - asset_summary['types']
        if missing_required:
            errors.append(f"Missing required asset types for '{objective}': {missing_required}")
        
        # Check min_one_of requirements
        for group in requirements['min_one_of']:
            if not any(asset_type in asset_summary['types'] for asset_type in group):
                errors.append(f"At least one of these asset types is required for '{objective}': {group}")
        
        # Generate warnings for unusual configurations
        warnings.extend(self._generate_warnings(objective, asset_summary))
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'asset_summary': asset_summary
        }
    
    def _get_asset_summary(self, devices: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze devices and create summary
        
        Returns:
            Dictionary with:
                - 'types': Set of asset types present
                - 'by_type': Dict mapping type to list of device IDs
                - 'total_count': Total number of devices
        """
        by_type = {}
        types = set()
        
        for device in devices:
            device_type = device.get('type')
            device_id = device.get('id')
            
            if device_type:
                types.add(device_type)
                if device_type not in by_type:
                    by_type[device_type] = []
                by_type[device_type].append(device_id)
        
        return {
            'types': types,
            'by_type': by_type,
            'total_count': len(devices)
        }
    
    def _generate_warnings(self, objective: str, asset_summary: Dict[str, Any]) -> List[str]:
        """Generate warnings for unusual but valid configurations"""
        warnings = []
        
        # Warning if no load defined
        if 'LOAD' not in asset_summary['types'] and 'CRITICAL_LOAD' not in asset_summary['types']:
            if objective not in ['lifeExtentBESS']:
                warnings.append("No load defined. Optimization may produce unexpected results.")
        
        # Warning for maxWeightPowerFlow
        if objective == 'maxWeightPowerFlow':
            if ('PV' not in asset_summary['types'] and 'WIND' not in asset_summary['types']) and ('UNI_EV' not in asset_summary['types'] and 'BI_EV' not in asset_summary['types']) :
                warnings.append("maxWeightPowerFlow objective works best with renewable sources (PV/WIND) and EV Chargers")

        # Warning for maxSelfConsumption without renewable sources
        if objective == 'maxSelfConsumption':
            if 'PV' not in asset_summary['types'] and 'WIND' not in asset_summary['types']:
                warnings.append("maxSelfConsumption objective works best with renewable sources (PV/WIND)")
        
        # Warning for maxEVSatisfaction without renewable sources
        if objective == 'maxEVSatisfaction':
            if 'PV' not in asset_summary['types'] and 'WIND' not in asset_summary['types']:
                warnings.append("maxEVSatisfaction without renewable sources may rely heavily on grid import")
        
        # Warning for multiple AFEs (unusual configuration)
        if 'AFE' in asset_summary['by_type'] and len(asset_summary['by_type']['AFE']) > 1:
            warnings.append(f"Multiple AFEs detected: {asset_summary['by_type']['AFE']}. "
                          "Ensure this is intentional.")
        
        # Warning for multiple BESS (ensure proper aggregation)
        if 'BESS' in asset_summary['by_type'] and len(asset_summary['by_type']['BESS']) > 1:
            warnings.append(f"Multiple BESS detected: {asset_summary['by_type']['BESS']}. "
                          "Current implementation may need adaptation for multiple BESS.")
        
        return warnings
    
    def get_devices_by_type(self, config: Dict[str, Any], asset_type: str) -> List[Dict[str, Any]]:
        """
        Get all devices of a specific type from configuration
        
        Args:
            config: Configuration dictionary
            asset_type: Type of asset (e.g., 'PV', 'BESS', 'AFE')
            
        Returns:
            List of device dictionaries matching the type
        """
        devices = config.get('devices', [])
        return [d for d in devices if d.get('type') == asset_type]
    
    def get_device_by_id(self, config: Dict[str, Any], device_id: str) -> Dict[str, Any]:
        """
        Get a specific device by its ID
        
        Args:
            config: Configuration dictionary
            device_id: Device ID (e.g., 'pv1', 'bess1')
            
        Returns:
            Device dictionary or None if not found
        """
        devices = config.get('devices', [])
        for device in devices:
            if device.get('id') == device_id:
                return device
        return None