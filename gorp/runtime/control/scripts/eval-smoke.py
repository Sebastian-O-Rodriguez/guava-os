#!/usr/bin/env python3
"""GOS-75-lite: smoke eval — does the lean (minimal-tools) config preserve
deterministic task success vs baseline? Verifies file-write/edit capability,
the critical thing an over-restricted tool set would break."""
import subprocess, os, tempfile, json, shutil, sys

OMP_MINIMAL = "/Users/sebroot/dev/guava-os/gorp/runtime/control/omp-minimal.yml"

TASKS = [
    # (name, prompt, expected file, expected substring)
    ("write", "Create the file eval-out.txt in the current directory containing exactly the text 'GOS-EVAL-OK'.",
     "eval-out.txt", "GOS-EVAL-OK"),
    ("python-fn", "Write a Python file eval-fn.py defining `def triple(x): return x * 3`.",
     "eval-fn.py", "def triple"),
    ("json", "Write a file eval-data.json containing exactly {\"ok\": true}.",
     "eval-data.json", '"ok"'),
]

def run(config_arg, prompt, workdir):
    args = ["omp", "-p", "--mode", "json", "--model", "smol", "--no-skills", "--no-rules", "--no-extensions"]
    if config_arg:
        args += ["--config", config_arg]
    args += [prompt]
    try:
        p = subprocess.run(args, cwd=workdir, capture_output=True, text=True, timeout=200)
    except subprocess.TimeoutExpired:
        return None, None, "timeout"
    # parse agent_end to get cost + output text
    cost = None
    out_text = ""
    for line in (p.stdout or "").splitlines():
        try:
            d = json.loads(line)
        except Exception:
            continue
        if d.get("type") == "agent_end":
            u = d["messages"][-1].get("usage", {})
            c = u.get("cost", {})
            cost = c.get("total")
            out_text = d["messages"][-1].get("content", [{}])[-1].get("text", "")
    return cost, out_text, None

def verify(workdir, expect_file, expect_substr):
    path = os.path.join(workdir, expect_file)
    if not os.path.exists(path):
        return False, f"{expect_file} missing"
    content = open(path).read()
    return expect_substr in content, None

rows = []
for name, prompt, ef, es in TASKS:
    for cfg_label, cfg in (("baseline", None), ("lean", OMP_MINIMAL)):
        wd = tempfile.mkdtemp(prefix=f"eval-{name}-{cfg_label}-")
        cost, out_text, err = run(cfg, prompt, wd)
        ok, verr = verify(wd, ef, es)
        # capture any file the worker wrote (best-effort) for evidence
        wrote = [f for f in os.listdir(wd) if os.path.isfile(os.path.join(wd, f))]
        rows.append((name, cfg_label, "pass" if ok else "fail", cost if cost is not None else None, err or verr or "", ",".join(wrote)))
        shutil.rmtree(wd, ignore_errors=True)

print(f"{'task':<10} {'config':<9} {'result':<6} {'cost_usd':<10} {'files':<20} {'note'}")
for name, cfg, result, cost, note, files in rows:
    print(f"{name:<10} {cfg:<9} {result:<6} {str(cost):<10} {files:<20} {note}")

# verdict: lean must not regress baseline passes
base_passes = sum(1 for r in rows if r[1] == "baseline" and r[2] == "pass")
lean_passes = sum(1 for r in rows if r[1] == "lean" and r[2] == "pass")
print(f"\nbaseline passes: {base_passes}/{len(TASKS)}   lean passes: {lean_passes}/{len(TASKS)}")
print("REGRESSION" if lean_passes < base_passes else "NO REGRESSION")