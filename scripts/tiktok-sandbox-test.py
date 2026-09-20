import os, sys, json, urllib.parse, urllib.request

code=os.environ["TIKTOK_AUTH_CODE"].strip()
client_key=os.environ["TIKTOK_CLIENT_KEY"].strip()
client_secret=os.environ["TIKTOK_CLIENT_SECRET"].strip()
redirect_uri="https://flipmedianl.github.io/mijn-web/tiktok-callback.html"

body=urllib.parse.urlencode({
 "client_key":client_key,
 "client_secret":client_secret,
 "code":code,
 "grant_type":"authorization_code",
 "redirect_uri":redirect_uri,
}).encode()
req=urllib.request.Request("https://open.tiktokapis.com/v2/oauth/token/",data=body,headers={"Content-Type":"application/x-www-form-urlencoded","Cache-Control":"no-cache"})
try:
    with urllib.request.urlopen(req) as r: token=json.load(r)
except Exception as e:
    print("Token exchange failed:", getattr(e,"read",lambda:b"")().decode() or str(e)); sys.exit(1)
access=token.get("access_token")
if not access:
    print("Token exchange failed:", json.dumps(token)); sys.exit(1)
print("::add-mask::"+access)
if token.get("refresh_token"): print("::add-mask::"+token["refresh_token"])
req=urllib.request.Request("https://open.tiktokapis.com/v2/post/publish/creator_info/query/",data=b"{}",headers={"Authorization":"Bearer "+access,"Content-Type":"application/json; charset=UTF-8"})
try:
    with urllib.request.urlopen(req) as r: info=json.load(r)
except Exception as e:
    print("Creator-info test failed:", getattr(e,"read",lambda:b"")().decode() or str(e)); sys.exit(1)
print("TIKTOK_SANDBOX_OK")
print("Scopes:", token.get("scope",""))
data=info.get("data",{})
print("Creator:", data.get("creator_nickname","authorized user"))
print("Privacy options:", ", ".join(data.get("privacy_level_options",[])))\nvideo=os.environ.get("TIKTOK_VIDEO_FILE","").strip()
if not video:
    print("READY_FOR_VIDEO_UPLOAD")
    sys.exit(0)
size=os.path.getsize(video)
payload={"post_info":{"title":"FLIPMEDIA test","privacy_level":"SELF_ONLY","disable_duet":False,"disable_comment":False,"disable_stitch":False},"source_info":{"source":"FILE_UPLOAD","video_size":size,"chunk_size":size,"total_chunk_count":1}}
req=urllib.request.Request("https://open.tiktokapis.com/v2/post/publish/video/init/",data=json.dumps(payload).encode(),headers={"Authorization":"Bearer "+access,"Content-Type":"application/json; charset=UTF-8"})
try:
    with urllib.request.urlopen(req) as r: init=json.load(r)
except Exception as e:
    print("Video init failed:",getattr(e,"read",lambda:b"")().decode() or str(e)); sys.exit(1)
upload_url=init.get("data",{}).get("upload_url")
publish_id=init.get("data",{}).get("publish_id")
if not upload_url or not publish_id:
    print("Video init failed:",json.dumps(init)); sys.exit(1)
with open(video,"rb") as h: raw=h.read()
req=urllib.request.Request(upload_url,data=raw,method="PUT",headers={"Content-Type":"video/mp4","Content-Length":str(size),"Content-Range":f"bytes 0-{size-1}/{size}"})
try:
    with urllib.request.urlopen(req,timeout=180) as r: r.read()
except Exception as e:
    print("Video upload failed:",getattr(e,"read",lambda:b"")().decode() or str(e)); sys.exit(1)
print("TIKTOK_VIDEO_UPLOAD_OK")
print("Publish ID:",publish_id)
