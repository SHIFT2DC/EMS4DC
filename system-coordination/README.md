# Coordination module
This is a coordination module which will decide which mode and which configuration to choose for operation based on specific validations. Moreover this module handles data fetching and database interactions.

```
system-coordination/
├── coordinator.py          <- Core coordinator module
├── DroopClass.py           <- Test class for building droop curves
├── droopMode.py            <- Logic for controlling site in droop mode
├── fetchDatabase.py        <- Functions for interacting with database
├── fetchMeasurements.py    <- Fetches data via ModbusTCP
├── modeOptimizer.py        <- Logic for controlling site in optimizer mode
├── POptApplier.py          <- Logic which applies optimizer outputs to optimal power point of the droop curve
├── README.md
├── requirements.txt        <- List of needed Python packages
└── time_utils.py           <- Time related functions (e.g. calculating period for checks execution)
```
