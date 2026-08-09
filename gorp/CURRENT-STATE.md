# GOS Current State

## Implemented

The following capabilities are implemented and proven:

* deterministic sprint planning
* execution graphs
* transition authorization
* Git worktree isolation
* fixture and OMP worker adapters (OMP is the primary engineering runtime
  per ADR_001; the hermes adapter was retired 2026-07-31)
* scope gates
* command gates
* human review
* retry
* rejection
* fail-closed promotion
* hash-chained audit records
* persisted orchestrator outcomes
* crash detection
* browser Operator Shell
* project switching
* failure explanation
* real governed execution against project repositories

## Partial

The following exist but are incomplete:

### Project Model

Implemented:

* registered project identity
* project path resolution
* project-specific gates
* execution state keyed by project

Missing:

* explicit active, dormant, and archived lifecycle
* capability declarations
* local capability specialization
* project capability visibility

### Recovery

Implemented:

* failure classification
* persisted stop reasons
* crash detection
* retry
* cancel and close actions

Missing:

* resume
* rebase and rerun
* gate repair
* reliable worker-process ownership
* orphan recovery

### Multi-Project Operation

Implemented:

* project registry
* project switching

Missing:

* fleet overview
* queueing
* execution ownership
* registry hygiene automation
* active versus archived project state

### Runtime Confidence

Implemented:

* deterministic fixture worker
* persisted execution records
* crash visibility

Missing:

* supervisor
* heartbeat
* orphan detection
* deterministic environment capture
* automated recovery testing

## Missing

The following vision-critical systems do not yet exist:

* OMP worker adapter persona wiring (the `omp` adapter exists and dispatches
  OMP workers, but it does not read persona files — no `maps_to`/model/tools
  binding into the worker invocation yet)
* Global Capability Library
* capability schema
* capability versioning
* project capability declarations
* capability resolution
* global and local skill composition
* candidate capability improvements
* evidence attached to capability improvements
* capability review workflow
* capability validation workflow
* capability promotion
* capability rollback
* cross-project capability reuse measurement
* CI/CD

## Explicitly Deferred

The following are not current priorities:

* distributed execution
* multiple simultaneous operators
* autonomous global learning
* worker self-approval
* automatic capability promotion
* large marketplace architecture
* additional operator interfaces

## Current Definition

GOS is currently:

> An execution engine that drives the governed pipeline
> (gate → review → promote → audit), dispatching workers via fixture and OMP
> adapters through personas. Gorp lives under guava-os, the control plane
> where the human operator iterates and delegates approved plans.
GOS is not yet:

> Fully production-hardened OMP worker dispatch and the compounding
> Global Capability Library.
The next strategic systems are the OMP runtime integration and the governed
bridge between project experience and the Global Capability Library.

