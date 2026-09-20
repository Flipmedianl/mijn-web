#!/usr/bin/env python3
import json, os, subprocess, sys, urllib.parse, urllib.request, wave, math, struct, random

KEY=os.environ["PEXELS_API_KEY"]
OUT="content/short"
os.makedirs(OUT,exist_ok=True)

# Gemini writes a fresh FLIPMEDIA concept on every run.
GEMINI_KEY=os.environ.get("GEMINI_API_KEY","")
def gemini_content():
    if not GEMINI_KEY: raise RuntimeError("GEMINI_API_KEY ontbreekt")
    prompt="""Maak exact 8 korte scenes voor een Nederlandse verticale FLIPMEDIA Short over websites, online marketing, AI voor ondernemers, conversie, SEO of digitale groei. Kies elke run zelf een fris specifiek onderwerp. Geen hergebruik van voorbeeldteksten. Scene 1 is een sterke hook. Elke scene maximaal 52 tekens. Scene 8 is een korte FLIPMEDIA CTA. Geef per scene ook een Engelse Pexels videozoekterm gericht op schermen, apparaten, handen, abstracte technologie of interfaces; vermijd herkenbare gezichten. Antwoord ALLEEN als geldige JSON: {"title":"...","scenes":[{"text":"...","query":"..."}]}"""
    body=json.dumps({"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"responseMimeType":"application/json","temperature":1.15}}).encode()
    url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+urllib.parse.quote(GEMINI_KEY)
    req=urllib.request.Request(url,data=body,headers={"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=60) as r: data=json.load(r)
    raw=data["candidates"][0]["content"]["parts"][0]["text"]
    obj=json.loads(raw)
    rows=obj.get("scenes",[])
    if len(rows)!=8: raise RuntimeError("Gemini gaf niet exact 8 scenes")
    return obj.get("title","FLIPMEDIA Short"),[(str(x["text"])[:70],str(x["query"])[:100]) for x in rows]
title,scenes=gemini_content()
clips=[]
def get_json(url):
    req=urllib.request.Request(url,headers={"Authorization":KEY,"User-Agent":"FLIPMEDIA/1.0"})
    with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
def download(url,path):
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0","Accept":"video/mp4,video/*;q=0.9,*/*;q=0.8","Referer":"https://www.pexels.com/"})
    with urllib.request.urlopen(req,timeout=90) as src,open(path,"wb") as dst:
        while True:
            b=src.read(1024*1024)
            if not b:break
            dst.write(b)
for i,(text,q) in enumerate(scenes):
    api="https://api.pexels.com/videos/search?"+urllib.parse.urlencode({"query":q,"orientation":"portrait","per_page":10})
    vs=get_json(api).get("videos",[])
    if not vs: raise SystemExit("Geen video voor "+q)
    v=vs[i%len(vs)]
    fs=[x for x in v.get("video_files",[]) if x.get("file_type")=="video/mp4"]
    portrait=[x for x in fs if (x.get("height") or 0)>(x.get("width") or 0)]
    fs=portrait or fs
    fs.sort(key=lambda x:abs((x.get("height") or 1920)-1920)+abs((x.get("width") or 1080)-1080))
    p=f"{OUT}/raw-{i:02}.mp4"; download(fs[0]["link"],p)
    clips.append((p,text,v.get("url")))

# Generate a genuinely new instrumental bed for every render.
# Each render gets a fresh random seed, chord progression, tempo, rhythm and timbre.
sr=44100; scene_dur=1.75; dur=len(scenes)*scene_dur
seed=int.from_bytes(os.urandom(8),"big"); rng=random.Random(seed)
tempo=rng.choice([84,92,100,108,116,124,132])
roots=rng.sample([82.41,92.50,98.00,110.00,123.47,130.81,146.83,164.81,174.61,196.00],4)
waveform=rng.choice(["sine","softsquare","pluck"])
with wave.open(f"{OUT}/music.wav","w") as w:
    w.setparams((2,2,sr,int(sr*dur),"NONE","not compressed"))
    for n in range(int(sr*dur)):
        t=n/sr; beat=t*tempo/60.0; step=int(beat)%len(roots); f=roots[step]
        phase=2*math.pi*f*t
        if waveform=="sine": tone=math.sin(phase)+.22*math.sin(2*phase)
        elif waveform=="softsquare": tone=math.tanh(1.4*math.sin(phase))*.72+.12*math.sin(2*phase)
        else: tone=(math.sin(phase)+.3*math.sin(3*phase))*math.exp(-3*(beat%1))
        pulse=0.45+0.55*math.exp(-5*(beat%1))
        s=.075*pulse*tone
        val=max(-32767,min(32767,int(s*32767)))
        w.writeframesraw(struct.pack("<hh",val,val))
# Render each scene to consistent vertical format. drawtext is deliberately bold/readable.
parts=[]
font="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
for i,(p,text,url) in enumerate(clips):
    # Hard-wrap captions so no line can ever run outside the 1080px frame.
    words=text.split(); lines=[]; line=""
    for word in words:
        trial=(line+" "+word).strip()
        if len(trial) > 18 and line:
            lines.append(line); line=word
        else:
            line=trial
    if line: lines.append(line)
    wrapped="\n".join(lines[:3])
    textfile=f"{OUT}/caption-{i:02}.txt"
    with open(textfile,"w",encoding="utf-8") as th:
        th.write(wrapped)
    out=f"{OUT}/scene-{i:02}.mp4"
    vf=("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
        "drawbox=x=90:y=1160:w=900:h=430:color=black@0.78:t=fill,"
        f"drawtext=fontfile={font}:textfile='{textfile}':fontcolor=white:fontsize=42:line_spacing=14:"
        "x=(w-text_w)/2:y=(h-text_h)/2+360:box=0")
    subprocess.run(["ffmpeg","-y","-stream_loop","-1","-i",p,"-t",str(scene_dur),"-vf",vf,
                    "-an","-r","30","-c:v","libx264","-preset","veryfast","-crf","22",out],check=True)
    parts.append(out)
with open(f"{OUT}/list.txt","w") as h:
    for p in parts:h.write(f"file '{os.path.abspath(p)}'\n")
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",f"{OUT}/list.txt","-i",f"{OUT}/music.wav",
                "-map","0:v","-map","1:a","-c:v","copy","-c:a","aac","-b:a","160k","-shortest",
                "-movflags","+faststart",f"{OUT}/flipmedia-short.mp4"],check=True)
with open(f"{OUT}/manifest.json","w") as h:
    json.dump({"title":title,"scenes":[{"text":s[1],"source":s[2]} for s in clips],"music":"freshly synthesized for this FLIPMEDIA render"},h,indent=2,ensure_ascii=False)
print(f"READY {OUT}/flipmedia-short.mp4")
