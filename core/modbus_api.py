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

@File: modbus_api.py
@Description: TODO

@Created: 01 March 2026
@Last Modified: 01 March 2026
@Author: Leon Gritsyuk

@Version: v2.0.0
'''


from flask import Flask, jsonify, request
import os

from data.measurements_client import ModbusDataReader

app = Flask(__name__)

CONFIG_FILE = os.environ.get("MODBUS_CONFIG", "/app/conf/modbus.json")


def get_reader():
    return ModbusDataReader(CONFIG_FILE)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/measurements", methods=["GET"])
def read_all():
    """Read all devices in parallel."""
    try:
        with get_reader() as reader:
            data = reader.read_all_data_parallel()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@app.route("/measurements/<asset_key>", methods=["GET"])
def read_single(asset_key):
    """Read a single device by assetKey."""
    try:
        with get_reader() as reader:
            data = reader.read_single_device_by_asset_key(asset_key)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


@app.route("/write", methods=["POST"])
def write_register():
    """
    Write a value to a single register.
    Body: { "asset_key": "afe1", "parameter": "SETPOINT", "value": 100.0 }
    """
    body = request.get_json(force=True)
    asset_key = body.get("asset_key")
    parameter = body.get("parameter")
    value = body.get("value")

    if not all([asset_key, parameter, value is not None]):
        return jsonify({"error": "asset_key, parameter, and value are required"}), 400

    try:
        with get_reader() as reader:
            success = reader.write_single_register(asset_key, parameter, value)
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500


if __name__ == "__main__":
    port = int(os.environ.get("MODBUS_API_PORT", 5051))
    app.run(host="0.0.0.0", port=port, debug=False)