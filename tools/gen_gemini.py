"""Generate a raw image with the Google AI Studio (Gemini) API.

    python tools/gen_gemini.py <prompt.txt> art_source/raw/<name>_raw.png [--ref ref.png ...] [--model M]
The key is read from the GEMINI_API_KEY environment variable (never stored in files).
"""
import argparse
import base64
import json
import os
import sys
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("prompt")
    p.add_argument("dst")
    p.add_argument("--ref", action="append", default=[])
    p.add_argument("--model", default="gemini-3-pro-image")
    a = p.parse_args(argv)
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY is not set")
    parts = [{"text": open(a.prompt, encoding="utf-8").read()}]
    for r in a.ref:
        parts.append({"inline_data": {"mime_type": "image/png", "data": base64.b64encode(open(r, "rb").read()).decode()}})
    body = {"contents": [{"parts": parts}], "generationConfig": {"responseModalities": ["IMAGE"]}}
    req = urllib.request.Request(API.format(a.model), json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "x-goog-api-key": key})
    res = json.load(urllib.request.urlopen(req, timeout=300))
    for part in res["candidates"][0]["content"]["parts"]:
        data = part.get("inlineData") or part.get("inline_data")
        if data:
            os.makedirs(os.path.dirname(a.dst) or ".", exist_ok=True)
            open(a.dst, "wb").write(base64.b64decode(data["data"]))
            print("saved", a.dst)
            return
    sys.exit("no image in response: " + json.dumps(res)[:500])


if __name__ == "__main__":
    main()
