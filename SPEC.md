# Project specification

What the project must do and the boundaries it stays inside. This document holds
requirements rather than implementation: a change to how something is built does
not belong here, and a change to what counts as correct does. Delete a section
this project does not have instead of leaving it empty.

## Problem

The problem being solved and who has it. State what happens today without the
project, so the rest of this document has something to be checked against.

## Users

The intended users and the constraints they bring: environment, expertise,
permissions, and whatever they cannot change.

## Required behavior

- Observable behavior, described from outside the system.
- The error, empty, loading, and recovery cases. These are the ones most often
  left undefined until they ship wrong.

## User experience

The primary workflows, the accessibility requirements, and the layouts or
interfaces that are supported.

## Architecture and data flow

The major components, which one owns which state, where data is stored, and
every external service or interface crossed.

## Security and privacy

Trust boundaries, permissions, sensitive data, and the required security checks.
Name what is trusted, not only what is protected.

## Performance and compatibility

The supported environments, and budgets written as numbers a check can measure.

## Non-goals

- Adjacent work deliberately left out, recorded so it is not reintroduced later
  as scope.

## Acceptance criteria

- Outcomes that are observable and testable, not intentions.
- The automated and manual validation each outcome requires.

## Unresolved questions

- Questions that must be answered before implementation, each with who or what
  answers it. Move an answered question into the section it constrains.
