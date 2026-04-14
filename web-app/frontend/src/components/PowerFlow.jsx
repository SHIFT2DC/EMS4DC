/*
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

@File: PowerFlow.jsx
@Description: # TODO: Add desc

@Created: 1st January 2025
@Last Modified: 16 February 2026
@Author: LeonGritsyuk-eaton

@Version: v2.0.1
*/

import React from 'react';

const PowerFlow = ({ x1, y1, x2, y2, direction }) => {
  const animationDuration = "2s";
  
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#93C5FD"
        strokeWidth="3"
        strokeDasharray="5 5"
        strokeOpacity="0.6"
      />
      {direction !== 'idle' && (
        <circle r="4" fill="#3B82F6">
          <animateMotion
            dur={animationDuration}
            repeatCount="indefinite"
            path={`M${direction === 'inward' ? x1 : x2} ${direction === 'inward' ? y1 : y2} L${direction === 'inward' ? x2 : x1} ${direction === 'inward' ? y2 : y1}`}
          />
          <animate
            attributeName="r"
            values="2;5;2"
            dur={animationDuration}
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  );
};

export default PowerFlow;