#!/usr/bin/env python3
"""pick_models.py: choose the free models to use from NVIDIA or OpenRouter at run time.

NVIDIA and OpenRouter add and retire free models often, so nothing is pinned: each time
an engine is needed this asks the provider which models it offers right now, keeps the
chat models that can use tools (the pipeline's work is all tool use), ranks them for this
job, and, for NVIDIA, test-calls the top ones with a tiny tool request, so a model that
is retired, failing or unable to use tools is never chosen. OpenRouter's list says which
models use tools and when a model is due to be retired (expiration_date), so it isn't
test-called (its free allowance is small).

  python3 runner/pick_models.py nvidia|openrouter [--n 4] [--prefer id,id,...]

Prints the chosen model ids, one per line, the quickest first and the strongest last
(the runner climbs that ladder when an attempt fails). Prints nothing and exits 1 when
no usable model is found. --prefer (the owner's own picks, if any) puts those first,
if they are offered and pass the test.
"""
import concurrent.futures as cf
import datetime as dt
import json
import os
import re
import sys
import urllib.request

PROVIDERS = {
    'nvidia': {'base': os.environ.get('NVIDIA_BASE_URL', 'https://integrate.api.nvidia.com/v1'), 'key': 'NVIDIA_API_KEY', 'probe': True},
    'openrouter': {'base': 'https://openrouter.ai/api/v1', 'key': 'OPENROUTER_API_KEY', 'probe': False},
}

# Not chat models, or not ones that can run the pipeline's tool-using work.
NOT_CHAT = re.compile(
    r'embed|rerank|retriev|guard|safety|reward|parse|ocr|asr|tts|whisper|speech|audio|translat|'
    r'clip|vision|-vl\b|-vl-|vlm|image|video|kosmos|fuyu|neva|vila|deplot|paligemma|cosmos|'
    r'sdxl|stable-diffusion|flux|bge|e5-|detector|pii|\bbase\b|-base$|starcoder|codegemma|'
    r'recurrentgemma|riva|nv-?embed|nemoretriever|usdcode|genmol|molmim|esm|diffdock|'
    r'proteinmpnn|rfdiffusion|evo2|chemistry|cuopt', re.I)

# How well each family handles long tool-using jobs (higher is better). Unknown families
# still qualify, ranked by size.
FAMILY = [
    (r'qwen3-coder', 10), (r'qwen3', 9), (r'deepseek-v3', 9), (r'kimi-k2', 9), (r'glm-4\.[5-9]|glm-[5-9]', 9),
    (r'gpt-oss', 8), (r'minimax-m', 8), (r'llama-?4', 7), (r'nemotron.*(ultra|super)', 7),
    (r'llama-3\.3', 7), (r'mistral-(large|medium)|magistral|devstral', 6), (r'qwen2\.5', 5),
    (r'llama-3\.1-405b', 6), (r'llama-3\.1', 4), (r'deepseek-r1', 3),
]
MIN_SIZE_B = 30          # smaller models lose the thread on long jobs


def size_b(mid):
    """Parameter count in billions from the id (480b, 70b, 8x22b, a35b), or None."""
    m = re.search(r'(\d+)x(\d+)b', mid, re.I)
    if m:
        return int(m.group(1)) * int(m.group(2))
    sizes = [float(x) for x in re.findall(r'(?<![a-z])(\d+(?:\.\d+)?)b(?![a-z])', mid, re.I)]
    return max(sizes) if sizes else None


def score(mid):
    fam = next((s for pat, s in FAMILY if re.search(pat, mid, re.I)), 3)
    sz = size_b(mid)
    return fam + (min(sz, 700) / 140 if sz else 1.5)


def get(url, key, timeout=30, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or '{}')


def probe(base, key, mid):
    """True if the model answers a tiny request by calling the tool it was given."""
    try:
        j = get(f'{base}/chat/completions', key, timeout=45, body={
            'model': mid, 'max_tokens': 200, 'temperature': 0,
            'messages': [{'role': 'user', 'content': 'Call the ping tool with text "ok". Do not answer in words.'}],
            'tools': [{'type': 'function', 'function': {'name': 'ping', 'description': 'Health check.',
                       'parameters': {'type': 'object', 'properties': {'text': {'type': 'string'}}, 'required': ['text']}}}],
            'tool_choice': 'auto'})
        msg = ((j.get('choices') or [{}])[0]).get('message') or {}
        return bool(msg.get('tool_calls'))
    except Exception:
        return False


def main():
    args = sys.argv[1:]
    if not args or args[0] not in PROVIDERS:
        print(__doc__, file=sys.stderr)
        return 2
    prov = PROVIDERS[args[0]]
    n = int(args[args.index('--n') + 1]) if '--n' in args else 4
    prefer = [p for p in (args[args.index('--prefer') + 1].split(',') if '--prefer' in args else []) if p]
    key = os.environ.get(prov['key'], '')
    if not key:
        return 1
    try:
        listed = get(f'{prov["base"]}/models', key).get('data') or []
    except Exception as e:
        print(f'pick_models: could not list {args[0]} models ({e.__class__.__name__})', file=sys.stderr)
        return 1

    soon = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=14)
    cands = []
    for m in listed:
        mid = m.get('id') or ''
        if not mid or NOT_CHAT.search(mid):
            continue
        if args[0] == 'openrouter':
            free = mid.endswith(':free') or all(str((m.get('pricing') or {}).get(k, '1')) in ('0', '0.0') for k in ('prompt', 'completion'))
            if not free or 'tools' not in (m.get('supported_parameters') or []):
                continue
            exp = m.get('expiration_date')
            if exp:
                try:
                    if dt.datetime.fromisoformat(str(exp).replace('Z', '+00:00')).replace(tzinfo=dt.timezone.utc) < soon:
                        continue   # being retired within two weeks
                except ValueError:
                    continue
        sz = size_b(mid)
        if sz is not None and sz < MIN_SIZE_B:
            continue
        cands.append(mid)
    if not cands:
        return 1

    ranked = sorted(set(cands), key=score, reverse=True)
    ranked = [p for p in prefer if p in ranked] + [m for m in ranked if m not in prefer]
    if prov['probe']:
        tried = ranked[:max(n * 2, 8)]
        with cf.ThreadPoolExecutor(max_workers=8) as ex:
            ok = dict(zip(tried, ex.map(lambda mid: probe(prov['base'], key, mid), tried)))
        chosen = [m for m in tried if ok[m]][:n]
    else:
        chosen = ranked[:n]
    if not chosen:
        return 1
    # Quickest first, strongest last; the owner's picks lead.
    lead = [m for m in chosen if m in prefer]
    rest = sorted([m for m in chosen if m not in prefer], key=score)
    print('\n'.join(lead + rest))
    return 0


if __name__ == '__main__':
    sys.exit(main())
