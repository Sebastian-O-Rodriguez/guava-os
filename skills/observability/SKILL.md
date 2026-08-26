---
name: observability
description: "Implement logging, metrics, tracing, alerting, and dashboards; use when instrumenting services, debugging with logs/metrics/traces, running load tests, or defining alert rules."
domain: devops
role: task
order: 3
load_when: metrics/logs/tracing is in scope
guidance: reuse existing instrumentation | one metric per decision | alert on symptoms not causes

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Give services observable production behavior: structured logs, RED/USE dashboards, correlated traces, and low-noise alerting.

## Workflow

1. **Assess** — SLIs, critical paths, business metrics to track
2. **Instrument** — logs + metrics + traces in code
3. **Collect** — Prometheus scrape, log shipper, OTLP endpoint; verify data arrives
4. **Visualize** — RED (Rate/Error/Duration) or USE (Utilization/Saturation/Errors) dashboards
5. **Alert** — thresholds/anomalies on critical paths; validate no false-positive flood

## Rules

- Structured JSON logging; fields, not string interpolation
- Correlation/request ID on every log entry and span
- Pick correct metric type: Counter (events), Gauge (level), Histogram (duration/percentiles)
- Alert on symptoms (error rate, latency), not on every error
- Monitor business metrics alongside technical ones
- Health-check endpoints for readiness/liveness

## Telemetry Stack

| Concern | Tool |
|---------|------|
| Logs | structured logger (Pino, zap, logrus) |
| Metrics | Prometheus + Grafana |
| Traces | OpenTelemetry OTLP → Jaeger/Tempo |
| Alerting | Prometheus Alertmanager, PagerDuty |
| Load test | k6, Artillery |

## MUST NOT

- Log sensitive data (passwords, tokens, PII)
- Alert on every error (fatigue)
- Skip correlation IDs in distributed systems
- Ship dashboards/alerts without confirming data lands and alerts don't flood

## Uses

- Adding structured logging pipelines and request IDs
- Defining Prometheus counters/histograms/gauges + scrape endpoints
- Instrumenting OpenTelemetry spans with status and error recording
- Writing Prometheus alert rules with `for:` debounce and severity labels
- Building k6 load tests with stages + thresholds

## Source

Distilled from https://github.com/Jeffallan/claude-skills — `skills/monitoring-expert`.