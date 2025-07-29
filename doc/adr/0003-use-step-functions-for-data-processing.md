# 3. use step functions for data processing

Date: 2025-07-29

## Status

Accepted

## Context

Remote data is collected and processed using separate AWS Lambda functions. These functions run on their own individual schedules with no coordination. Aggregation should ideally only happen after collection of new data, so the aggregation function has been configured to run 1 hour after the collection function.

Since these lambda functions are in practice temporally coupled, it makes sense to arrange them into an AWS StepFunctions state machine, to ensure they run in order, and that any failed execution of collection aborts the following aggregation.

## Decision

We agreed to combine the collector and aggregator function into a state machine.

## Consequences

Updating remote data is now just a matter of triggering an execution of the state machine, instead of invoking the individual lambdas in order.
