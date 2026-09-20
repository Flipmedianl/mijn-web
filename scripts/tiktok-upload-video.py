import os,sys,json,urllib.request

access=os.environ["TIKTOK_ACCESS_TOKEN"].strip()
video=os.environ["TIKTOK_VIDEO_FILE"].strip()
size=os.path.getsize(video)
headers={"Authorization":"Bearer "+access,"Content-Type":"application/json; charset=UTF-8"}

req=urllib.request.Request("https://open.tiktokapis.com/v2/post/publish/creator_info/query/",data=b"{}",headers=headers)
with urllib.request.urlopen(req,timeout=60) as r: info=json.load(r)
data=info.get("data",{})
privacy="SELF_ONLY" if "SELF_ONLY" in data.get("privacy_level_options",[]) else data.get("privacy_level_options",["SELF_ONLY"])[-1]

payload={"post_info":{"title":"FLIPMEDIA test","privacy_level":privacy,"disable_duet":False,"disable_comment":False,"disable_stitch":False},"source_info":{"source":"FILE_UPLOAD","video_size":size,"chunk_size":size,"total_chunk_count":1}}
req=urllib.request.Request("https://open.tiktokapis.com/v2/post/publish/video/init/",data=json.dumps(payload).encode(),headers=headers)
with urllib.request.urlopen(req,timeout=60) as r: init=json.load(r)
if init.get("error",{}).get("code")!="ok": print(json.dumps(init)); sys.exit(1)
upload_url=init["data"]["upload_url"]; publish_id=init["data"]["publish_id"]
with open(video,"rb") as f: raw=f.read()
req=urllib.request.Request(upload_url,data=raw,method="PUT",headers={"Content-Type":"video/mp4","Content-Length":str(size),"Content-Range":f"bytes 0-{size-1}/{size}"})
with urllib.request.urlopen(req,timeout=180) as r: r.read()
print("TIKTOK_VIDEO_UPLOAD_OK")
print("Publish ID:",publish_id)
