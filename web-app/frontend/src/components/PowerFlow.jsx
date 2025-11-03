/*
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

File: PowerFlow.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import React from 'react';

const PowerFlow = ({ x1, y1, x2, y2, direction }) => {
  const animationDuration = "2s";
  
  return (
    <>
      <defs>
        <marker id="flowCircle" markerWidth="4" markerHeight="4" refX="2" refY="2">
          <circle cx="2" cy="2" r="1" fill="#3B82F6" />
        </marker>
      </defs>
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        stroke="#93C5FD"
        strokeWidth="0.3"
        strokeDasharray="1 1"
        strokeOpacity="0.6"
      />
      <circle r="1" fill="#3B82F6">
        <animateMotion
          dur={animationDuration}
          repeatCount="indefinite"
          path={`M${direction === 'inward' ? x1 : x2} ${direction === 'inward' ? y1 : y2} L${direction === 'inward' ? x2 : x1} ${direction === 'inward' ? y2 : y1}`}
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="spline"
          keySplines="0.5 0 0.5 1;"
        />
        <animate
          attributeName="r"
          values="0.1;1;0.1"
          dur={animationDuration}
          repeatCount="indefinite"
          keyTimes="0;0.5;1"
          calcMode="spline"
          keySplines="0.5 0 0.5 1; 0.5 0 0.5 1"
        />
      </circle>
    </>
  );
};

export default PowerFlow