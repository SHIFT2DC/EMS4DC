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

File: TurboLink.jsx
Description: # TODO: Add desc

Created: 1st January 2025
Last Modified: 30th October 2025
Version: v1.0.0
*/

import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'

function TurboLink({ to, children, ...props }) {
  const frameRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const frame = frameRef.current
    if (frame) {
      frame.addEventListener('turbo:click', (event) => {
        event.preventDefault()
        navigate(to)
      })
    }
  }, [to, navigate])

  return (
    <turbo-frame ref={frameRef}>
      <Link to={to} {...props}>
        {children}
      </Link>
    </turbo-frame>
  )
}

export default TurboLink

