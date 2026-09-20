#!/usr/bin/env python3
"""Upload a video with Direct Post and fall back to TikTok's draft inbox flow."""
import json, os, sys, time, urllib.error, urllib.request

API = "https://open.tiktokapis.com/v2/post/publish"
DIRECT_FALLBACK_CODES = {"scope_not_authorized", "reached_active_user_cap", "unaudited_client_can_only_post_to_private_accounts", "privacy_level_option_mismatch"}

class TikTokError(RuntimeError):
    def __init__(self, stage, status, body):
        self.stage, self.status, self.body = stage, status, body
        error = body.get("error", {}) if isinstance(body, dict) else {}
        self.code = error.get("code", "http_error")
        self.log_id = error.get("log_id") or error.get("logid") or ""
        message = error.get("message") or str(body)
        super().__init__(f"{stage}: HTTP {status}; code={self.code}; message={message}; log_id={self.log_id or '-'}")

def request_json(url, token, payload, stage, opener=urllib.request.urlopen):
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json; charset=UTF-8"})
    try:
        with opener(request, timeout=60) as response:
            body, status = json.load(response), getattr(response, "status", 200)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        try: body = json.loads(raw)
        except json.JSONDecodeError: body = {"error": {"code": "http_error", "message": raw or exc.reason}}
        raise TikTokError(stage, exc.code, body) from exc
    if body.get("error", {}).get("code", "ok") != "ok": raise TikTokError(stage, status, body)
    return body

def direct_init(token, source_info, title, opener=urllib.request.urlopen):
    creator = request_json(f"{API}/creator_info/query/", token, {}, "creator_info", opener)
    options = creator.get("data", {}).get("privacy_level_options", [])
    if "SELF_ONLY" not in options:
        raise TikTokError("creator_info", 403, {"error": {"code": "unaudited_client_can_only_post_to_private_accounts", "message": "SELF_ONLY is unavailable for this creator"}})
    payload = {"post_info": {"title": title, "privacy_level": "SELF_ONLY", "disable_duet": True, "disable_comment": False, "disable_stitch": True, "brand_content_toggle": False, "brand_organic_toggle": True}, "source_info": source_info}
    return request_json(f"{API}/video/init/", token, payload, "direct_init", opener)

def draft_init(token, source_info, opener=urllib.request.urlopen):
    return request_json(f"{API}/inbox/video/init/", token, {"source_info": source_info}, "draft_init", opener)

def should_fallback(error): return error.code in DIRECT_FALLBACK_CODES or error.status == 403

def upload_file(upload_url, video, size, opener=urllib.request.urlopen):
    with open(video, "rb") as handle:
        request = urllib.request.Request(upload_url, data=handle.read(), method="PUT", headers={"Content-Type": "video/mp4", "Content-Length": str(size), "Content-Range": f"bytes 0-{size-1}/{size}"})
    try:
        with opener(request, timeout=180) as response: response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"video_upload: HTTP {exc.code}; body={body or exc.reason}") from exc

def fetch_status(token, publish_id, opener=urllib.request.urlopen):
    return request_json(f"{API}/status/fetch/", token, {"publish_id": publish_id}, "status", opener)

def main():
    token, video = os.environ["TIKTOK_ACCESS_TOKEN"].strip(), os.environ["TIKTOK_VIDEO_FILE"].strip()
    mode, title = os.environ.get("TIKTOK_POST_MODE", "auto").strip().lower(), os.environ.get("TIKTOK_TITLE", "FLIPMEDIA test").strip()
    if mode not in {"auto", "direct", "draft"}: raise SystemExit("TIKTOK_POST_MODE must be auto, direct, or draft")
    size = os.path.getsize(video)
    source_info = {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1}
    selected = mode
    if mode == "draft": initialized = draft_init(token, source_info)
    else:
        try:
            initialized, selected = direct_init(token, source_info, title), "direct"
        except TikTokError as error:
            print(f"TIKTOK_DIRECT_POST_REJECTED {error}", file=sys.stderr)
            if mode == "direct" or not should_fallback(error): raise
            print("TIKTOK_FALLBACK_TO_DRAFT")
            initialized, selected = draft_init(token, source_info), "draft"
    data = initialized.get("data", {})
    upload_url, publish_id = data.get("upload_url"), data.get("publish_id")
    if not upload_url or not publish_id: raise RuntimeError(f"TikTok init response missing upload_url/publish_id: {json.dumps(initialized)}")
    upload_file(upload_url, video, size)
    print("TIKTOK_VIDEO_UPLOAD_OK\nMode:", selected, "\nPublish ID:", publish_id)
    for _ in range(6):
        time.sleep(5)
        state = fetch_status(token, publish_id).get("data", {}).get("status", "UNKNOWN")
        print("Status:", state)
        if state not in {"PROCESSING_UPLOAD", "PROCESSING_DOWNLOAD", "SENDING_TO_USER_INBOX"}: break
    if selected == "draft": print("ACTION_REQUIRED: open the TikTok inbox notification, review the draft, and tap Post.")

if __name__ == "__main__":
    try: main()
    except (TikTokError, RuntimeError) as error:
        print(f"TIKTOK_UPLOAD_FAILED {error}", file=sys.stderr); raise SystemExit(1)
