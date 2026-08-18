#!/usr/bin/env python3
"""Parse the agent_end usage from an OMP NDJSON stream on stdin."""
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        d = json.loads(line)
    except Exception:
        continue
    if d.get("type") == "agent_end":
        u = d["messages"][-1].get("usage", {})
        c = u.get("cost", {})
        print("input=%s total=%s cost=%s" % (u.get("input", "?"), u.get("totalTokens", "?"), c.get("total", "?")))
        break
