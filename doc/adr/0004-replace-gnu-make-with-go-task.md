# 4. replace gnu make with go-task

Date: 2025-08-07

## Status

Accepted

## Context

We currenly use GNU Make for building the project and its submodules.

### Motivation for using a command runner / build system

- Avoid copy-pasting commands from documentation/README to the terminal
- Provide the same interface for interacting with the project locally and in CI
- Provide a higher-level, more general task management system than those tied to the primary language ecosystem of the project (NodeJS package.json, Maven pom.xml)

### Motivation for switching from GNU Make to go-task

- Multi-module projects: `go-task` builds dependencies in parallel by default, and supports grouping, prefixing and colorization of output. This makes building multi-module projects more pleasant, as we are better able to correlate log and error messages to the modules and targets from which they originate. `GNU Make` on the other hand provides no output customization, which leds to time and effort being spent not only to fix the problem at hand, but figuring out where the error occurred.
- Presumed knowledge: `GNU Make` assumes some arcane knowledge, such as how each line in a target is executed in its own process and how most targets should be marked with a `.PHONY` directive
- Referencing and templating: `go-task` supports including other Taskfiles, which enables reuse of template taskfiles like [terraform.yml](https://github.com/capralifecycle/liflig-aws-user-admin/blob/master/taskfiles/terraform.yml), as well as referencing other individual tasks (GNU Make doesn't allow this, other than as a target dependency)

## Decision

After discussing this within the team, we have decided to assess `go-task` in suitable projects, and later evaluate our experience.

## Consequences

This project will migrate its build system from GNU Make to go-task, which will in turn shorten build times and improve the human readability of informational and erroneous build output.
