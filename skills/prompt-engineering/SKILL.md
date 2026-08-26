---
name: prompt-engineering
description: "Design, optimize, and evaluate LLM prompts — chain-of-thought, few-shot, structured output, and evaluation. Use when writing prompts, refactoring for accuracy or token efficiency, or building a prompt test suite."
domain: ai-ml
role: task
order: 2
load_when: prompt design/eval is in scope
guidance: test against a small eval set | prefer structured output | version prompts

metadata:
  author: guava-os
  version: "0.1.0"
---

## Prompt Engineering

Write prompts like code: version them, test them against diverse inputs, and
change one thing at a time when debugging.

## Workflow

1. **Understand requirements** — task, success criteria, constraints, edge cases.
2. **Design** — pick a pattern (zero-shot, few-shot, CoT) and write clear instructions.
3. **Test** — run diverse cases, measure accuracy/consistency. If < 80% on the test set, find failure patterns before iterating.
4. **Iterate** — one change at a time; reduce tokens, improve reliability.
5. **Deploy** — version, document behavior, monitor for drift.

## Patterns

- **Zero-shot** — baseline; state task, format, and constraints explicitly.
- **Few-shot** — add examples that match the target distribution; never contradict instructions.
- **Chain-of-thought / ReAct** — for multi-step reasoning or tool use.
- **Structured output** — prefer JSON mode / function calling; validate against a schema.

## Optimization

- Replace vague instructions with explicit shape: count, format, verb constraints.
- Few-shot beats zero-shot for format reliability; keep examples consistent with the rubric.
- Cut tokens after correctness, not before.
- Test across model versions — prompts do not transfer perfectly.

## Evaluation

- Build a labeled test suite: diverse, realistic, including empty/malformed edge inputs.
- Measure quantitative metrics (accuracy, consistency); validate structured outputs against schemas.
- A/B compare against a baseline before deploying.

## Rules

DO:
- Version prompts and document known limitations.
- Consider token cost and latency in the design.
- Test edge cases (empty inputs, unusual formats).

DON'T:
- Deploy without systematic evaluation.
- Make multiple changes at once when debugging.
- Hardcode sensitive data in prompts or examples.

## Uses

- Designing or refactoring prompts for LLM apps, agents, or pipelines
- Building JSON/function-calling schemas and output validation
- Setting up prompt evaluation or regression test suites

## Source

Upstream: Jeffallan/claude-skills — `skills/prompt-engineer`