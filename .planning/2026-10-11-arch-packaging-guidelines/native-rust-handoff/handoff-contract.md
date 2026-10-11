# Query-first handoff contract v1

This contract is the **only** document a fresh recipient may read before it explicitly agrees. The sponsor will send project paths only after agreement. Do not browse the repository, prior session messages, or other artifacts before that reply. If that restriction cannot be honored, say so and stop.

## Data contract

The eventual packet and compact YAML view have identical ordered top-level keys:

`schema_version`, `kind`, `context`, `state`, `sources`, `facts`, `known-unknowns`, `decision`, `constraints`, `next`.

`schema_version` is 1; `kind` and `context.tags` label variants, not extra top-level keys. Source entries use `{id,path,role}`. Fact entries use `{id,claim,evidence}` with evidence containing source IDs. Unknowns use `{id,question}`; actions use `{when,action,accept}`. Arrays have stable order; helper display numbers are 1-based, raw jq/yq indices are 0-based. Missing proof is unknown, not success. The exact machine-readable shape lives in `handoff.schema.json` and was derived from `queries.md`; both will be offered only after agreement.

## Conduct contract

Read only the handed-off paths after agreement. First answer the decision queries, then inspect primary evidence only where a fact needs verification. Report a short Wenyan summary: three independently checked facts, one open decision, authority limits, and a single next action. Do not edit source, run a build, set a persistent goal, spawn agents, or call completion based on notes alone. If sources conflict, stop and ask the sponsor; do not silently repair the history. The sponsor alone decides whether to authorize a later builder.

## Consent gate

Reply before any project read with an explicit JSON object containing `contract_version: 1`, `agree: true|false`, and a short `undertaking` covering read scope, no build/edit, provenance, and stop-on-conflict. A non-answer, partial assent, or project read before assent fails the handoff gate. Await the sponsor's next message after assent.
