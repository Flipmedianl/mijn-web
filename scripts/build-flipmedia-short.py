#!/usr/bin/env python3
import json, os, subprocess, sys, urllib.parse, urllib.request, wave, math, struct, random

KEY=os.environ["PEXELS_API_KEY"]
OUT="content/short"
os.makedirs(OUT,exist_ok=True)

# First FLIPMEDIA format: one coherent topic, with a separate visual search for every beat.
content_sets=[
 [("3 signalen dat je homepage niet werkt","website analytics screen"),("1. Niemand snapt direct wat je aanbiedt","website interface close up"),("Maak je belofte zichtbaar bovenaan","laptop website screen"),("2. Je belangrijkste knop valt niet op","smartphone website interface"),("Geef elke pagina één duidelijke actie","computer mouse website"),("3. Mobiel voelt onrustig","mobile website scrolling"),("Schrap afleiding en maak ruimte","minimal digital interface"),("Meer praktische webtips? Volg FLIPMEDIA","abstract technology screen")],
 [("Je website kan sneller zonder redesign","website speed technology"),("Begin met zware afbeeldingen","image compression computer"),("Gebruik moderne formaten en kleinere bestanden","computer files interface"),("Laad alleen wat bezoekers echt nodig hebben","loading website screen"),("Controleer vooral je mobiele versie","smartphone website close up"),("Elke seconde telt voor aandacht","digital timer technology"),("Test. Verbeter. Meet opnieuw.","website analytics dashboard"),("Meer slimme webtips? Volg FLIPMEDIA","futuristic digital interface")],
 [("Waarom klikken bezoekers niet?","website cursor screen"),("Je knop zegt misschien te weinig","website button interface"),("Vervang vaag door een duidelijke actie","computer website close up"),("Laat zien wat er na de klik gebeurt","smartphone app interface"),("Zet de belangrijkste actie in beeld","website interface macro"),("Gebruik minder concurrerende knoppen","minimal website screen"),("Duidelijkheid wint van drukte","abstract digital interface"),("Meer conversietips? Volg FLIPMEDIA","technology screen close up")],
 [("3 snelle verbeteringen voor je mobiele site","smartphone website screen"),("1. Maak tekst direct scanbaar","mobile reading screen"),("2. Geef knoppen genoeg ruimte","smartphone interface close up"),("3. Haal onnodige elementen weg","minimal mobile interface"),("Test met één hand op je telefoon","hand holding smartphone back view"),("Controleer snelheid én duidelijkheid","website speed mobile"),("Kleine verbeteringen tellen op","digital analytics interface"),("Meer webtips? Volg FLIPMEDIA","abstract technology interface")]
]
# Rotate content automatically so consecutive runs do not reuse the same script.
state_path=f"{OUT}/../last-content.txt"
last=-1
try:
    with open(state_path) as sh: last=int(sh.read().strip())
except Exception: pass
choice=(last+1)%len(content_sets)
scenes=content_sets[choice]
with open(state_path,"w") as sh: sh.write(str(choice))
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

# Generate an original simple instrumental bed locally (no third-party track).
sr=44100; scene_dur=1.75; dur=len(scenes)*scene_dur
with wave.open(f"{OUT}/music.wav","w") as w:
    w.setparams((2,2,sr,int(sr*dur),"NONE","not compressed"))
    notes=random.choice([[110,138.59,164.81,146.83],[98,123.47,146.83,130.81],[130.81,164.81,196,174.61],[82.41,110,123.47,98]])
    for n in range(int(sr*dur)):
        t=n/sr; beat=int(t*2); f=notes[(beat//2)%len(notes)] * random.choice([1.0,1.0,1.0,2.0])
        env=random.choice([.075,.085,.095,.105])*(0.35+0.65*math.exp(-5*((t*2)%1)))
        s=env*(math.sin(2*math.pi*f*t)+.35*math.sin(2*math.pi*2*f*t))
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
    json.dump({"title":"3 redenen waarom bezoekers je website verlaten","scenes":[{"text":s[1],"source":s[2]} for s in clips],"music":"originally synthesized for FLIPMEDIA"},h,indent=2,ensure_ascii=False)
print(f"READY {OUT}/flipmedia-short.mp4")
