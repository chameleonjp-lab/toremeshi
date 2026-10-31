"""Exercise the publish boundary without changing the game or calling Supabase."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_pages', Path(__file__).with_name('prepare-pages.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PublicationBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        (self.root / 'scripts/pages-files.json').write_text(json.dumps({'required':['index.html']}))
        (self.root / 'index.html').write_text('<!doctype html><title>Test</title><script>const x=1;</script>')
        module.ROOT = self.root
        module.OUT = self.root / '_site'
    def tearDown(self):
        self.temp.cleanup()
    def build(self):
        with patch.object(module.subprocess, 'check_output', return_value='a'*40):
            module.validate_and_stage()
    def test_only_explicit_runtime_files_are_published(self):
        (self.root / 'private.env').write_text('never publish')
        self.build()
        self.assertEqual({x.name for x in module.OUT.iterdir()}, {'index.html','.nojekyll','build-info.json'})
    def test_missing_linked_asset_prevents_publication(self):
        (self.root / 'index.html').write_text('<script src="missing.js"></script>')
        with self.assertRaises(ValueError): self.build()
        self.assertFalse(module.OUT.exists())
    def test_syntax_error_prevents_publication(self):
        (self.root / 'index.html').write_text('<script>const x = ;</script>')
        with self.assertRaises(module.subprocess.CalledProcessError): self.build()
        self.assertFalse(module.OUT.exists())
    def test_invalid_importmap_prevents_publication(self):
        (self.root / 'index.html').write_text('<script type="importmap">{oops}</script>')
        with self.assertRaises(json.JSONDecodeError): self.build()
        self.assertFalse(module.OUT.exists())
    def test_private_file_is_not_allowed_in_manifest(self):
        (self.root / 'scripts/pages-files.json').write_text(json.dumps({'required':['index.html','.env']}))
        (self.root / '.env').write_text('secret')
        with self.assertRaises(ValueError): self.build()
    def test_secret_marker_prevents_publication(self):
        (self.root / 'index.html').write_text('<script>const key="sb_secret_test";</script>')
        with self.assertRaises(ValueError): self.build()

if __name__ == '__main__':
    unittest.main()
