# Permanent read-only policy

FANUC Pro Suite is a monitoring and diagnostics product. It must never send a
state-changing command to a CNC, PMC, adapter, controller or machine tool.

Prohibited capabilities include program activation/deletion/upload, parameter
or offset writes, tool-data writes, PMC/keep-relay writes and cycle/reset/start/
stop commands. There is no feature flag, administrator override or hidden mode
that may enable these capabilities.

Pull requests introducing a mutation endpoint, write command or CNC-control UI
must be rejected. Automated tests scan the application source for prohibited
endpoint and command patterns.
