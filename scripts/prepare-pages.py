#!/usr/bin/env python3
"""Validate first, then stage only the explicitly listed browser runtime files."""
import hashlib
import json
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts, self.links = [], []
        self.script = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and "src" not in attrs:
            self.script = [attrs.get("type", "text/javascript"), ""]
        if tag in ("script", "img", "source", "audio", "video") and attrs.get("src"):
            self.links.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.links.append(attrs.get("href", ""))
    def handle_data(self, data):
        if self.script is not None:
            self.script[1] += data
    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.scripts.append(self.script)
            self.script = None

def validate_and_stage():
    manifest = json.loads((ROOT / "scripts/pages-files.json").read_text())
    files = manifest["required"] + [f for f in manifest.get("optional", []) if (ROOT / f).is_file()]
    if "index.html" not in files or len(files) != len(set(files)):
        raise ValueError("manifest requires exactly one index.html")
    for name in files:
        path = ROOT / name
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(ROOT):
            raise ValueError(f"missing or unsafe runtime file: {name}")
        if any(part.startswith('.') for part in Path(name).parts) or Path(name).suffix.lower() not in {'.html','.js','.css','.csv','.json','.glb','.png','.svg','.webp','.jpg','.mp3','.ogg','.wav'}:
            raise ValueError(f"non-runtime file is not publishable: {name}")
        if path.suffix in {'.html','.js','.css','.json'}:
            text = path.read_text()
            if '-----BEGIN PRIVATE KEY-----' in text or 'sb_secret_' in text:
                raise ValueError(f"private credential marker in {name}")
    parser = PageParser()
    parser.feed((ROOT / "index.html").read_text())
    for link in parser.links:
        url = urlsplit(link)
        if url.scheme or url.netloc or not url.path:
            continue
        name = unquote(url.path).removeprefix('./')
        if name not in files:
            raise ValueError(f"HTML runtime resource is absent from manifest: {name}")
    with tempfile.TemporaryDirectory() as tmp:
        scripts = parser.scripts + [('module', (ROOT / f).read_text()) for f in files if f.endswith('.js')]
        for index, (kind, text) in enumerate(scripts):
            if kind in {'application/ld+json','importmap','application/json'}:
                json.loads(text)
                continue
            if kind not in {'module','text/javascript','application/javascript',''}:
                continue
            path = Path(tmp) / f'script-{index}.{ "mjs" if kind == "module" else "js"}'
            path.write_text(text)
            subprocess.run(['node','--check',str(path)],check=True)
    for name in files:
        if name.endswith('.json'):
            json.loads((ROOT / name).read_text())
    # Do not touch source files, settings, or browser localStorage.
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in files:
        dest = OUT / name
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT / name,dest)
    (OUT / '.nojekyll').write_text('')
    sha = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    (OUT / 'build-info.json').write_text(json.dumps({'commit':sha,'files':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files}},indent=2)+'\n')
    print(f'Validated and staged {len(files)} runtime files at {sha}')

if __name__ == '__main__':
    validate_and_stage()
