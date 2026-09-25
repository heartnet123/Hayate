# Paper–code audit: `paper-code-audit` skill capability

## Scope and verdict
The target phrase, “สกิลนี้ทำไรได้” (“what can this skill do?”), was interpreted as asking about the installed `paper-code-audit` skill. No paper or paper-associated implementation repository was identified in the request or current project. **This is therefore a capability/documentation audit, not a paper-replication or claim-to-code audit.**

The skill is intended to compare a paper’s claims with its public codebase. Its installed instructions say to run `/audit`, name `researcher` and `verifier` as agents, and save an audit report under `outputs/` (`C:/Users/Admin/.pi/agent/npm/node_modules/@companion-ai/feynman/skills/paper-code-audit/SKILL.md`).

## Claim checks

| Claim | Evidence | Assessment |
|---|---|---|
| Audits paper/code consistency | Skill description says it compares a paper’s claims against its public codebase. | Supported as stated capability; not demonstrated on a supplied target. |
| Checks methods, defaults, metrics, and data handling | The expanded `/audit` workflow specifies these checks and requires reporting missing code, mismatches, ambiguous defaults, and reproduction risks (verified by the verifier subagent). | Present in the workflow prompt, not the installed skill stub; the exact procedural detail and source URLs are not established by the stub. |
| Uses researcher and verifier | `Agents used: researcher, verifier` appears in skill instructions. | Supported as a workflow requirement; these agents were invoked for this audit. |
| Produces a report in `outputs/` | Skill lists “audit report in `outputs/`.” | Supported, but filename, report schema, and citation conventions are unspecified. |
| Reproducibility assessment | Skill description mentions checking reproducibility of a specific paper. | Stated use case, not a defined procedure or guaranteed result. |

## Repository evidence and limits
The current project’s configured Git remote is `https://github.com/heartnet123/Hayate.git`. Its indexed project code is a SvelteKit web application and lint/format configuration; graph search found no paper identifier or paper-specific implementation in indexed app files. This repository is not established as the codebase for any named paper. Consequently, no paper methods, defaults, metrics, datasets, data handling, or reproduced results can be compared against it.

The key limitation is procedural: the skill stub says `/audit` expands workflow instructions in the active session and warns not to read a relative prompt-template path from the install directory. The expanded workflow describes the audit categories above, but the stub itself does not define their detailed tests, evidence threshold, or guarantees. Do not infer that the workflow alone proves a particular audit was correctly performed.

## Reproduction risks / next inputs needed
- Provide the paper title or DOI/arXiv URL and the exact public code repository URL (or commit/tag).
- Without those, results and implementation fidelity remain unassessable; auditing the unrelated current project risks false attribution.
- To validate the skill’s full workflow, inspect the expanded `/audit` instructions when invoked with a specific paper and repo.

## Sources
- Paper: **Not supplied / not identifiable from the request.** No paper URL available.
- Repository: [heartnet123/Hayate](https://github.com/heartnet123/Hayate) — configured Git remote for the current project; not confirmed as a paper implementation.
- Skill instructions: `C:/Users/Admin/.pi/agent/npm/node_modules/@companion-ai/feynman/skills/paper-code-audit/SKILL.md` (local installed file; no public URL established).