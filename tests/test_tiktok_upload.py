import importlib.util, io, json, pathlib, urllib.error, unittest
PATH = pathlib.Path(__file__).parents[1] / "scripts" / "tiktok-upload-video.py"
SPEC = importlib.util.spec_from_file_location("tiktok_upload", PATH)
MODULE = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(MODULE)
class Response(io.BytesIO):
    status = 200
    def __enter__(self): return self
    def __exit__(self, *args): self.close()
class Tests(unittest.TestCase):
    def test_draft_endpoint_and_payload(self):
        seen = {}
        def opener(request, timeout=0):
            seen.update(url=request.full_url, body=json.loads(request.data)); return Response(json.dumps({"data": {}, "error": {"code": "ok"}}).encode())
        MODULE.draft_init("token", {"source": "FILE_UPLOAD"}, opener)
        self.assertTrue(seen["url"].endswith("/inbox/video/init/")); self.assertNotIn("post_info", seen["body"])
    def test_403_preserves_error_and_log_id(self):
        body = {"error": {"code": "unaudited_client_can_only_post_to_private_accounts", "message": "blocked", "log_id": "abc"}}
        def opener(request, timeout=0): raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, io.BytesIO(json.dumps(body).encode()))
        with self.assertRaises(MODULE.TikTokError) as raised: MODULE.request_json("https://example.invalid", "token", {}, "direct_init", opener)
        self.assertEqual(raised.exception.code, body["error"]["code"]); self.assertEqual(raised.exception.log_id, "abc"); self.assertTrue(MODULE.should_fallback(raised.exception))
if __name__ == "__main__": unittest.main()
