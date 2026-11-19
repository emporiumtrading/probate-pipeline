#!/usr/bin/env python3
"""Regression check for dashboard/index.html.

Each <script> on the dashboard runs in its own scope, so a top-level const/let/function
defined in one script is invisible to the others. This flags any identifier defined at the
top level of one script and used in another, checks syntax with node, and checks every
data-draw element has a dash.draw and vice versa.
Usage: python3 scripts/check_page.py [path/to/index.html]
"""
import os, re, subprocess, sys, tempfile

p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dashboard", "index.html")
html = open(p).read()
scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
fails = []
defs = []
for i, s in enumerate(scripts):
    names = set(re.findall(r"^(?:const|let|var)\s+([A-Za-z_$][\w$]*)", s, re.M)) | set(re.findall(r"^function\s+([A-Za-z_$][\w$]*)", s, re.M))
    defs.append(names)
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(s)
    r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
    if r.returncode:
        fails.append(f"script {i}: syntax error: {r.stderr.strip().splitlines()[-1] if r.stderr else ''}")
for i, s in enumerate(scripts):
    body = re.sub(r"window\.[\w$]+", "", s)
    for j, names in enumerate(defs):
        if i == j:
            continue
        for n in names:
            if n in defs[i]:
                continue
            if re.search(rf"(?<![\w$.]){re.escape(n)}(?![\w$])", body):
                fails.append(f"script {i} uses '{n}' defined only in script {j} (put it on window)")
draw_el = set(re.findall(r'data-draw="(\w+)"', html))
draw_fn = set(re.findall(r"dash\.draw\('(\w+)'", html)) | set(re.findall(r"\['(\w+)', '\w+', '\w+', (?!')", html))
for n in sorted(draw_el - draw_fn):
    fails.append(f"element data-draw='{n}' has no dash.draw")
for n in sorted(draw_fn - draw_el):
    fails.append(f"dash.draw('{n}') has no element")
for f in fails:
    print("FAIL ", f)
print(f"page check: {len(scripts)} scripts, {len(fails)} failures")
sys.exit(1 if fails else 0)
