#!/usr/bin/env python3
"""Fill the sender's details into held letter drafts from config.yaml → business.

Drafts written before the owner entered the Business identity carry placeholders such as
"[Your name / company / mailing address / phone / email]". Each run (after the owner's Setup
saves are applied to config.yaml) this replaces those sender placeholders in
leads/*/outreach-drafts.md with the real details. Only the sender's own lines change; the
recipients' details ("[Office address — look up ...]") are left for the workers. A detail the
owner hasn't entered stays as a placeholder, and a licence placeholder is kept as is.

  python3 scripts/fill_signature.py            # fill every draft
  python3 scripts/fill_signature.py --check    # count drafts still waiting for details
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def business():
    """config.yaml → business, read without a YAML library (the Render jobs' Python has none)."""
    txt = open(os.path.join(ROOT, "config.yaml")).read()
    m = re.search(r"(?m)^business:.*\n((?:[ \t]+.*\n|\n)*?)(?=^\S)", txt)
    out = {}
    for line in (m.group(1) if m else "").splitlines():
        mm = re.match(r'^  (\w+):[ \t]*(?:"((?:[^"\\]|\\.)*)"|([^#\n]*?))[ \t]*(?:#.*)?$', line)
        if mm:
            out[mm.group(1)] = (mm.group(2) if mm.group(2) is not None else mm.group(3) or "").replace('\\"', '"').strip()
    return out


def block(b, licence):
    lines = [b.get("signer") or "[Your name]", b.get("legal_name") or "[company]",
             b.get("mailing_address") or "[mailing address]",
             " · ".join(x for x in (b.get("phone"), b.get("email")) if x) or "[phone / email]"]
    if licence:
        lines.append("[" + licence + "]")
    return "\n".join(lines)


SENDER = re.compile(r"\[Your name / company[^\]]*\]")


def fill(text, b):
    def sender(m):
        lic = re.search(r"licen[cs]e #[^/\]]*(?:or licensed partner)?(?:, if any)?", m.group(0))
        return block(b, lic.group(0) if lic else "")
    out = SENDER.sub(sender, text)
    if b.get("signer"):
        out = out.replace("[Your name]", b["signer"])
    if b.get("signer") or b.get("legal_name"):
        out = out.replace("[Owner name / company]", ", ".join(x for x in (b.get("signer"), b.get("legal_name")) if x))
    return out


def main():
    b = business()
    files = sorted(glob.glob(os.path.join(ROOT, "leads", "*", "outreach-drafts.md")))
    if "--check" in sys.argv:
        waiting = [f for f in files if SENDER.search(open(f).read()) or "[Your name]" in open(f).read()]
        print(f"fill_signature: {len(waiting)} of {len(files)} drafts still have sender placeholders")
        return
    if not (b.get("legal_name") or b.get("signer")):
        print("fill_signature: no business details yet (Setup → Business identity); drafts left as they are")
        return
    changed = 0
    for f in files:
        t = open(f).read()
        n = fill(t, b)
        if n != t:
            open(f, "w").write(n)
            changed += 1
    print(f"fill_signature: sender details filled in {changed} of {len(files)} drafts")


if __name__ == "__main__":
    main()
