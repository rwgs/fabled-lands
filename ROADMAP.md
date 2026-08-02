# Project roadmap

Ordered outcomes, each one leaving the project in a working state. A phase is a
result rather than a batch of work: if finishing it does not change what the
project can do, it belongs inside another phase. Phases are also the unit that
gets reordered when priorities change, so keep them independent enough to
reorder.

## Phase 1: Foundation

### Outcome

The working thing this phase delivers, written as what exists afterwards that
did not before.

### Included work

- The scoped deliverables, and nothing that could be dropped without changing
  the outcome.

### Dependencies and risks

- Prerequisites, migrations, destructive actions, and the risks that could stop
  the phase. Name what would have to be true for each risk to bite.

### Exit criteria

- The observable result required to leave this phase, stated so that someone
  other than its author can check it.

### Validation

- The automated checks and the manual testing this phase requires.

## Phase 2: Core workflow

Repeat the outcome, included work, dependencies and risks, exit criteria, and
validation for the next ordered result.

## Phase 3: Release readiness

Where they apply, accessibility, security, performance, deployment, rollback,
independent review, and documented manual testing are scheduled here rather than
assumed.
