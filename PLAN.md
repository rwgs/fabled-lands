# <Change name>

Approach for the change currently in flight. Replaced when the next non-trivial
change begins, so anything that must outlive this change is promoted first:
decisions that constrain future work to `DECISIONS.md`, and verified facts that
change how the project is understood to `AGENTS.md` or `SPEC.md`.

## Problem

What is wrong or missing today, and why it matters. State the current behavior,
not the desired behavior.

## Constraints discovered

Facts that limit the solution, each one verified rather than assumed. Record how
it was verified when the fact is surprising or expensive to rediscover.

## Approach

The chosen design, in enough detail to implement without rederiving it. Name the
files to change and the existing helpers to reuse.

## Trade-offs

What this approach gives up, alternatives rejected and why, and any risk that
survives into the merged change. Record approaches that were tried and abandoned
so they are not retried.

## Verification

The checks that prove the change works, including the specific failure each one
would catch. Distinguish automated checks from manual testing, and name anything
that cannot be verified in this environment.
