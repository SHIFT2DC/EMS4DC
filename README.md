# EMS4DC
EMS4DC is an energy management system developed as part of the SHIFT2DC Project.

## Documentation
Documentation for the project can be found here:

- [EMS4DC Docs](https://shift2dc.github.io/docs.ems/)

## Architecture
The default high-level architecture for which this EMS is built is depicted on the following figure:
![](./docs/high-level-architecture.jpg)

However, the EMS4DC can be adjusted to include different combination of energy assets. See [Docs](https://shift2dc.github.io/docs.ems/)

## Project's Structure:
```
├── 📁 .githooks <--------------------------- Scripts dealing with files' metadata and headers
│   ├── 📁 scripts
│   │   ├── 🐍 license_templates.py
│   │   ├── 🐍 update_headers.py
│   │   ├── 🐍 update_version.py
│   │   └── 🐍 utils.py
│   ├── 📄 commit-msg
│   ├── 📄 post-commit
│   └── 📄 pre-commit
├── 📁 .github
│   └── 📝 CODE_OF_CONDUCT.md
├── 📁 conf <-------------------------------- Shared folder for containers
│   ├── ⚙️ .env.example
│   ├── ⚙️ config.json
│   └── ⚙️ modbus.json
├── 📁 core <-------------------------------- Core Python functionality of the EMS4DC
│   ├── 📁 data <---------------------------- Data related modules and utilities
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 database_client.py
│   │   ├── 🐍 measurements_client.py
│   │   └── 🐍 modbus_writer.py
│   ├── 📁 drivers <------------------------- Droop Drivers for individual devices for EMS Droop Operating Mode
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 afe_driver.py
│   │   ├── 🐍 base_driver.py
│   │   ├── 🐍 bess_driver.py
│   │   ├── 🐍 pv_driver.py
│   │   ├── 🐍 template_driver.py
│   │   └── 🐍 uniev_driver.py
│   ├── 📁 forecast_utils <------------------ Utilities which are used for forecast generation
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 data_validator.py
│   │   ├── 🐍 db_config.py
│   │   ├── 🐍 forecast_cli.py
│   │   ├── 🐍 forecast_generator.py
│   │   ├── 🐍 forecast_models.py
│   │   └── 🐍 model_trainer.py
│   ├── 📁 metrics_utils <------------------ Utilities which are used for metrics calculation
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 config_loader.py
│   │   ├── 🐍 data_loader.py
│   │   ├── 🐍 database.py
│   │   ├── 🐍 device_performance_metrics.py
│   │   ├── 🐍 efficiency_utilization_metrics.py
│   │   ├── 🐍 energy_flow_metrics.py
│   │   ├── 🐍 metrics_storage.py
│   │   ├── 🐍 orchestrator.py
│   │   └── 🐍 statistical_metrics.py
│   ├── 📁 modes <--------------------------- Implementation of EMS4DC operation in different modes
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 droop_mode.py
│   │   └── 🐍 optimizer_mode.py
│   ├── 📁 optimization <-------------------- Provides an adjustable optimization modules
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 asset_validator.py
│   │   ├── 🐍 base_optimizer.py
│   │   ├── 🐍 objective_optimizers.py
│   │   └── 🐍 optimizer.py
│   ├── 📁 utils <--------------------------- Miscellaneous functions and modules used in system
│   │   ├── 🐍 __init__.py
│   │   ├── 🐍 database_utils.py
│   │   ├── 🐍 logging_utils.py
│   │   ├── 🐍 optimizer_utils.py
│   │   └── 🐍 time_utils.py
│   ├── ⚙️ .dockerignore
│   ├── 🐳 Dockerfile
│   ├── 🐍 __init__.py
│   ├── 🐍 forecast.py
│   ├── 🐍 measure.py
│   ├── 🐍 metrics.py
│   ├── 🐍 modbus_api.py
│   ├── 🐍 optimizer.py
│   └── 📄 requirements.txt
├── 📁 db <---------------------------------- Initialization script for database
│   └── 📄 init.sql
├── 📁 docs
│   └── 🖼️ high-level-architecture.jpg
├── 📁 web-app
│   ├── 📁 backend <------------------------- Backend with Node.js/Express.js
│   │   ├── 📁 auth
│   │   │   ├── 📄 middleware.js
│   │   │   └── 📄 passport.js
│   │   ├── 📁 db <-------------------------- Database module for connection
│   │   │   └── 📄 pool.js
│   │   ├── 📁 routes <---------------------- Routes for handling requests for different pages
│   │   │   ├── 📄 auth.js
│   │   │   ├── 📄 page-charts.js
│   │   │   ├── 📄 page-debug-optim.js
│   │   │   ├── 📄 page-device.js
│   │   │   ├── 📄 page-droop.js
│   │   │   ├── 📄 page-ems.js
│   │   │   ├── 📄 page-home.js
│   │   │   ├── 📄 page-metrics.js
│   │   │   ├── 📄 page-settings.js
│   │   │   ├── 📄 profile.js
│   │   │   └── 📄 users.js
│   │   ├── ⚙️ .dockerignore
│   │   ├── 🐳 Dockerfile
│   │   ├── ⚙️ package-lock.json
│   │   ├── ⚙️ package.json
│   │   └── 📄 server.js
│   └── 📁 frontend <------------------------ Frontend Vite + React app
│       ├── 📁 public
│       │   └── 🖼️ 16x16.png
│       ├── 📁 src
│       │   ├── 📁 assets
│       │   ├── 📁 components <-------------- Frontend components used across HMI
│       │   │   ├── 📄 DeviceDynamicNavigation.jsx
│       │   │   ├── 📄 DevicesLayout.jsx
│       │   │   ├── 📄 Header.jsx
│       │   │   ├── 📄 Layout.jsx
│       │   │   ├── 📄 PowerFlow.jsx
│       │   │   ├── 📄 ProtectedRoute.jsx
│       │   │   └── 📄 TurboLink.jsx
│       │   ├── 📁 config
│       │   ├── 📁 context
│       │   │   └── 📄 AuthContext.jsx
│       │   ├── 📁 hooks
│       │   │   ├── 📄 use-mobile.jsx
│       │   │   └── 📄 use-toast.js
│       │   ├── 📁 lib
│       │   │   ├── 📄 axios.js
│       │   │   └── 📄 utils.js
│       │   ├── 📁 pages <------------------- Contains implementation of individual pages used in HMI
│       │   │   ├── 📄 page-charts.jsx
│       │   │   ├── 📄 page-device-dynamic.jsx
│       │   │   ├── 📄 page-droop-curves.jsx
│       │   │   ├── 📄 page-ems-dashboard.jsx
│       │   │   ├── 📄 page-home.jsx
│       │   │   ├── 📄 page-login.jsx
│       │   │   ├── 📄 page-metrics.jsx
│       │   │   ├── 📄 page-optimization-debug.jsx
│       │   │   ├── 📄 page-profile.jsx
│       │   │   ├── 📄 page-settings.jsx
│       │   │   └── 📄 page-users.jsx
│       │   ├── 🎨 App.css
│       │   ├── 📄 App.jsx
│       │   ├── 🎨 index.css
│       │   └── 📄 main.jsx
│       ├── ⚙️ .dockerignore
│       ├── 🐳 Dockerfile
│       ├── ⚙️ components.json
│       ├── 📄 eslint.config.js
│       ├── 🌐 index.html
│       ├── ⚙️ jsconfig.json
│       ├── ⚙️ package-lock.json
│       ├── ⚙️ package.json
│       ├── 📄 postcss.config.js
│       ├── 📄 tailwind.config.js
│       └── 📄 vite.config.js
├── ⚙️ .dockerignore
├── ⚙️ .gitignore
├── 📝 LICENSE.md
├── 📝 README.md
├── 📝 THIRD_PARTY_LICENSES.md
└── ⚙️ docker-compose.yml <----------------- Main docker compose file
```

## Scientific Research
If the EMS4DC is used in Your scientific research please cite using Zenodo Digital Object Identifier (DOI):
[![DOI](https://zenodo.org/badge/1088890532.svg)](https://doi.org/10.5281/zenodo.19442727)

## Funding Acknowledgment

This project has received funding from the European Union's Horizon Europe research and innovation programme under grant agreement No. 101136131.