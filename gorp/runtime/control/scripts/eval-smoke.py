#!/usr/bin/env python3
"""GOS-75-lite: smoke eval — does lean (minimal-tools) preserve deterministic
task success vs baseline across capability categories? Verifies write / read /
edit / bash / multi-tool, and records the resolved tool set."""
import subprocess, os, tempfile, json, shutil

OMP_MINIMAL = "/Users/sebroot/dev/guava-os/gorp/runtime/control/omp-minimal.yml"
LEAN_TOOLS = "read,grep,glob,bash,edit,write"

TASKS = [
    ("write", "Create the file eval-out.txt in the current directory containing exactly the text 'GOS-EVAL-OK'.",
     "eval-out.txt", "GOS-EVAL-OK"),
    ("read", "Create a file seed.txt containing 'marker-42', then run grep to confirm it contains 'marker-42', and write 'found' to eval-find.txt.",
     "eval-find.txt", "found"),
    ("edit", "Create eval-edit.txt with the text 'v1', then modify that file to contain 'v2'.",
     "eval-edit.txt", "v2"),
    ("bash", "Run the bash command `printf 'bash-ok' > eval-bash.txt`.",
     "eval-bash.txt", "bash-ok"),
    ("multi", "Create eval-multi.txt, then edit it to contain the text 'read,grep,glob'.",
     "eval-multi.txt", "read,grep,glob"),
]

def run(config_arg, prompt, workdir):
    args = ["omp", "-p", "--mode", "json", "--model", "smol", "--no-skills", "--no-rules", "--no-extensions"]
    if config_arg:
        args += ["--config", config_arg]
    args += [prompt]
    try:
        p = subprocess.run(args, cwd=workdir, capture_output=True, text=True, timeout=240)
    except subprocess.TimeoutExpired:
        return None, "timeout"
    for line in (p.stdout or "").splitlines():
        try:
            d = json.loads(line)
        except Exception:
            continue
        if d.get("type") == "agent_end":
            u = d["messages"][-1].get("usage", {})
            return u.get("cost", {}).get("total"), None
    return None, "no-agent_end"

def verify(workdir, expect_file, expect_substr):
    path = os.path.join(workdir, expect_file)
    if not os.path.exists(path):
        return False, f"{expect_file} missing"
    return expect_substr in open(path).read(), None

rows = []
for name, prompt, ef, es in TASKS:
    for cfg_label, cfg, tools in (("baseline", None, "default"), ("lean", OMP_MINIMAL, LEAN_TOOLS)):
        wd = tempfile.mkdtemp(prefix=f"eval-{name}-{cfg_label}-")
        cost, err = run(cfg, prompt, wd)
        ok, verr = verify(wd, ef, es)
        rows.append((name, cfg_label, "pass" if ok else "fail", cost if cost is not None else None, tools, err or verr or ""))
        shutil.rmtree(wd, ignore_errors=True)

print(f"{'task':<7} {'config':<9} {'result':<6} {'cost_usd':<11} {'resolved_tools':<30} note")
for name, cfg, result, cost, tools, note in rows:
    print(f"{name:<7} {cfg:<9} {result:<6} {str(cost):<11} {tools:<30} {note}")

base_passes = sum(1 for r in rows if r[1] == "baseline" and r[2] == "pass")
lean_passes = sum(1 for r in rows if r[1] == "lean" and r[2] == "pass")
print(f"\nbaseline passes: {base_passes}/{len(TASKS)}   lean passes: {lean_passes}/{len(TASKS)}")
print("REGRESSION" if lean_passes < base_passes else "NO REGRESSION")