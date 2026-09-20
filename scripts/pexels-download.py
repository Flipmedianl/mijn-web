#!/usr/bin/env python3
import json, os, sys, urllib.parse, urllib.request

key=os.environ.get("PEXELS_API_KEY")
if not key: raise SystemExit("PEXELS_API_KEY ontbreekt")
query=" ".join(sys.argv[1:]).strip() or "web design technology"
url="https://api.pexels.com/videos/search?"+urllib.parse.urlencode({"query":query,"orientation":"portrait","per_page":15})
req=urllib.request.Request(url,headers={"Authorization":key,"User-Agent":"FLIPMEDIA-Content-Automation/1.0"})
with urllib.request.urlopen(req,timeout=30) as r: data=json.load(r)
videos=data.get("videos",[])
if not videos: raise SystemExit("Geen Pexels-video gevonden")
v=videos[0]
files=[f for f in v.get("video_files",[]) if f.get("file_type")=="video/mp4"]
portrait=[f for f in files if (f.get("height") or 0)>(f.get("width") or 0)]
choices=portrait or files
if not choices: raise SystemExit("Geen MP4 gevonden")
choices.sort(key=lambda f: abs((f.get("height") or 1920)-1920)+abs((f.get("width") or 1080)-1080))
f=choices[0]
os.makedirs("content/pexels",exist_ok=True)
out="content/pexels/source.mp4"
urllib.request.urlretrieve(f["link"],out)
meta={"query":query,"pexels_video_id":v.get("id"),"pexels_url":v.get("url"),"creator":v.get("user",{}).get("name"),"width":f.get("width"),"height":f.get("height"),"file":out}
with open("content/pexels/source.json","w",encoding="utf-8") as h: json.dump(meta,h,ensure_ascii=False,indent=2)
print(json.dumps(meta,ensure_ascii=False))
