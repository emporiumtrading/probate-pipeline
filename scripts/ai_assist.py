#!/usr/bin/env python3
"""Free-model text helper for the scripted runner (no paid AI).

Tries NVIDIA's API (build.nvidia.com, OpenAI-compatible), then OpenRouter's free
models. Used only to WRITE plain-English summaries from facts the scripts already
computed; it never decides anything, never sends anything, and its output is
always shown next to the script's own numbers. If no key is set or every call
fails, callers fall back to template text, so a run never depends on it.

Env: NVIDIA_API_KEY, NVIDIA_MODEL (default meta/llama-3.3-70b-instruct),
     OPENROUTER_API_KEY, OPENROUTER_MODEL (default meta-llama/llama-3.3-70b-instruct:free)
"""
import json, os, sys, urllib.error, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runner"))

PROVIDERS = [
    ("NVIDIA_API_KEY", "https://integrate.api.nvidia.com/v1/chat/completions",
     lambda: os.environ.get("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")),
    ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions",
     lambda: os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")),
]
SYSTEM = ("You write short, plain-English status notes for a small real-estate business owner. "
          "Use only the facts given. Never invent numbers, names or events. No legal or tax advice. "
          "Be respectful: these are estates of people who died. 2-4 sentences, no headings, no lists.")


def summarize(facts, max_tokens=220):
    """Return (text, provider) or (None, None)."""
    for key_env, url, model in PROVIDERS:
        key = os.environ.get(key_env)
        if not key:
            continue
        prov = key_env.split("_")[0].lower()
        models = [model()]
        for attempt in range(3):
            if attempt >= len(models):
                break
            body = json.dumps({"model": models[attempt], "max_tokens": max_tokens, "temperature": 0.2,
                               "messages": [{"role": "system", "content": SYSTEM},
                                            {"role": "user", "content": "Facts:\n" + facts + "\n\nWrite the note."}]}).encode()
            req = urllib.request.Request(url, data=body, headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                                                                  "User-Agent": "probate-pipeline-runner"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    out = json.load(r)["choices"][0]["message"]["content"].strip()
                if out:
                    return out, prov
            except urllib.error.HTTPError as e:
                print(f"ai_assist: {prov} {models[attempt]} failed: HTTP {e.code}")
                if e.code in (400, 404, 410) and attempt == 0:   # model retired or renamed: use what's offered now
                    try:
                        import pick_models
                        models += [m for m in pick_models.ranked_models(prov, key) if m not in models][:2]
                    except Exception as e2:
                        print(f"ai_assist: couldn't list {prov} models: {str(e2)[:80]}")
                elif e.code == 429:
                    break   # out of free requests: next provider
            except Exception as e:  # outage: next provider
                print(f"ai_assist: {prov} failed: {str(e)[:120]}")
                break
    return None, None


if __name__ == "__main__":
    import sys
    t, p = summarize(sys.stdin.read() or "Test: 2 new leads found today in Tampa.")
    print(p, "->", t)
