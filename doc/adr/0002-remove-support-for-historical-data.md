# 2. Remove support for historical data

Date: 2024-10-18

## Status

Accepted

## Context

This project was initially built as a Proof-of-concept, leaving concerns such as long term data storage unaddressed. Support for historical data was built in for collection and presentation purposes, but no steps to handle data rollover, cutoff or retention was made.

As a result of this lack of implementation detail, the amount of data being processed continues to increase, along with the increased demands for procesing time and resources.

## Decision

As of October 18th 2024, after polling consuming teams about their usage and discussing internally in the Tech Lead forum, we have concluded that the features relating to historical data in the application aren't significantly in use, and the few who report using it report it as being nice to have.

We considered building in support for data archival and retention, but seeing as the features are not being used all that much, we have decided to simplify the application instead.

## Consequences

- Lower resource demands: Collection and aggregation will be faster and lighter, and only operate on the latest data set
- Lower storage costs: As we shift to storing only the latest data set, the storage requirements move from ~7 GB to ~4 MB
- Simpler architecture: Collection, aggregation, storage and reporting will be easier to maintain and reason about
