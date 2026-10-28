"""Package existing UI as a scoped, offline-capable multi-page app."""
from pathlib import Path
import base64, hashlib, json, re, shutil, subprocess, sys

ROOT=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(ROOT/'tools/build-mykad-references.py')],cwd=ROOT,check=True)
subprocess.run(['node',str(ROOT/'tools/build-typescript.mjs')],cwd=ROOT,check=True)
PROJECT=ROOT/'templates'
documents=json.loads(subprocess.check_output(['node',str(ROOT/'tools/render-pages.mjs')],cwd=ROOT,text=True,encoding='utf-8'))
MEDIA=ROOT/'assets/media'
MEDIA.mkdir(parents=True,exist_ok=True)
MIMES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg','font/woff2':'woff2','font/ttf':'ttf','application/font-woff':'woff','font/woff':'woff'}
ASSET_RE=re.compile(r'data:([\w.+/-]+);base64,([A-Za-z0-9+/=]+)')

def externalize(text):
    def convert(match):
        mime=match.group(1)
        if mime not in MIMES:return match.group(0)
        data=base64.b64decode(match.group(2));name=hashlib.sha256(data).hexdigest()[:20]+'.'+MIMES[mime]
        path=MEDIA/name
        if not path.exists():path.write_bytes(data)
        return 'assets/media/'+name
    return ASSET_RE.sub(convert,text)

home=documents['home.html']
original_navigation=(PROJECT/'navigation.js').read_text(encoding='utf-8').strip()
assert original_navigation in home,'Home navigation source changed; review integration'
home=home.replace(original_navigation,(ROOT/'tools/home-navigation.js').read_text(encoding='utf-8').strip(),1)
# Keep the fixed-venue map and GPS permission independent, retained on every build.
home,map_script_count=re.subn(r'function initMapPage\(\)\{.*?(?=let communityTabController)',
                             lambda _:(ROOT/'tools/home-map.js').read_text(encoding='utf-8')+'\n\n',home,count=1,flags=re.S)
assert map_script_count==1,'Map initialization changed; review map integration'
home=home.replace('</head>','<link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">\n<link rel="stylesheet" href="home-map.css">\n<script src="assets/vendor/leaflet/leaflet.js"></script>\n<script src="map-location.js"></script>\n</head>',1)
home=home.replace("initializeMainPages();\n})();",(ROOT/'tools/home-enhancements.js').read_text(encoding='utf-8')+'\n'+(ROOT/'tools/home-report-location.js').read_text(encoding='utf-8')+'\ninitializeMainPages();\n})();')
home=re.sub(r"  if\(action==='install'\)showSheet\([^\n]+", "  if(action==='install')installApp();",home)
home=re.sub(r"  if\(action==='signout'\)\{[^\n]+", "  if(action==='signout'){window.FMCFlow.logout();}",home)
home=re.sub(r"  if\(action==='privacy'\)showSheet\([^\n]+", "  if(action==='privacy')location.assign('privacy?from=home');",home)
home=home.replace('fixmycity-home-drafts-v1','fixmycity2-home-drafts-v1')
# New reports start empty; sample pothole evidence must not contaminate real AI intake.
home=home.replace("const flowState={report:{title:'Pothole on Jalan Ampang',description:'Pothole on the left lane near KLCC.',category:'Road damage',location:'Jalan Ampang, Kuala Lumpur',photos:[assets.pothole]}","const flowState={report:{title:'',description:'',category:'Other',location:'',photos:[]}")
home=home.replace("r.location||'Jalan Ampang, Kuala Lumpur'","r.location||'Location not confirmed'").replace("report.category||'Road damage'","report.category||'Not set'").replace("report.location?.split(',')[0]||'Jalan Ampang'","report.location?.split(',')[0]||'Location not confirmed'")
home=home.replace("toast('Language preference updated for this preview.');", "window.FMCLanguage?.set(value==='Bahasa Melayu'?'ms':'en');toast('Language updated.');")
home=home.replace("['English','Bahasa Melayu','中文']", "['English','Bahasa Melayu']")
home=home.replace('This saves a session preference. Full interface translations are not connected.', 'Choose the language used throughout the app.')

# Keep app copy descriptive and direct; omit promotional eyebrow slogans.
home=home.replace('<span class="community-eyebrow">MAKE A DIFFERENCE, TOGETHER</span>','')
home=home.replace('Meet your neighbours. Make your city a little better.','Find local clean-ups and community activities.')
home=home.replace('Camera capture is available through a photo chooser when supported by your device. This settings screen does not request camera access.','MyKad and face scanning require camera access. To change permission, open the site settings in your browser and choose Camera. This settings screen does not start the camera.')
home=home.replace('<html lang="en">','<html lang="en" data-flow-page="home">',1)
# Home-only illustrated shortcuts are an editable fragment, retained on rebuild.
home=home.replace('</head>','<link rel="stylesheet" href="home-actions.css">\n</head>',1)
home,input_count=re.subn(r'(<textarea id="description"[^>]*>.*?</textarea>)',
                        r'<div class="report-input-frame">\1</div>',home,count=1,flags=re.S)
assert input_count==1,'Home report input changed; review animated border integration'
home=home.replace('</head>','<link rel="stylesheet" href="report-input.css">\n</head>',1)
voice_entry="if(type==='voice'){startReportFromHome();navigate('assistant');return;}"
assert voice_entry in home,'Home Voice entry changed; review live voice integration'
home=home.replace(voice_entry,"if(['voice','voice-en','voice-ms'].includes(type)){window.dispatchEvent(new CustomEvent('fixmycity:open-voice',{detail:{language:type==='voice-ms'?'ms':'en'}}));return;}",1)
voice_button='<button type="button" class="soft-button" data-open="voice"><svg class="icon" aria-hidden="true"><use href="#i-mic"/></svg>Voice</button>'
assert voice_button in home,'Home Voice button markup changed'
home=home.replace(voice_button,'<button type="button" class="soft-button voice-language voice-english" data-open="voice-en" data-voice-language="en"><svg class="icon" aria-hidden="true"><use href="#i-mic"/></svg>English</button><button type="button" class="soft-button voice-language voice-malay" data-open="voice-ms" data-voice-language="ms"><svg class="icon" aria-hidden="true"><use href="#i-mic"/></svg>Malay</button>',1)
home,voice_sheet_count=re.subn(r'^function rpVoiceSheet\(\)\{[^\n]*',"function rpVoiceSheet(){window.dispatchEvent(new Event('fixmycity:open-voice'));}",home,count=1,flags=re.M)
assert voice_sheet_count==1,'Report Voice entry changed; review live voice integration'
home=home.replace('Microphone access is requested only when you start a voice recording. You can stop recording or change access in your browser’s site settings.','Microphone access is requested when you open live voice. End the call or leave the app to stop audio, or change access in your browser’s site settings.')
home=home.replace('</head>','<link rel="stylesheet" href="voice-assistant.css">\n</head>',1)
home=home.replace('</body>','<script src="voice-assistant.js" defer></script>\n</body>',1)
home=home.replace('</head>','<link rel="stylesheet" href="report-assistant.css">\n</head>',1)
home=home.replace('</head>','<link rel="stylesheet" href="subpage-headers.css">\n</head>',1)
home=home.replace('</body>','<script src="report-assistant.js" defer></script>\n</body>',1)
# The assistant now uses real intake instead of a canned five-line conversation.
home,chat_seed_count=re.subn(r'const rpConversation=\[.*?\];',"const rpConversation=[];",home,count=1)
assert chat_seed_count==1,'Report conversation seed changed'
chat_start="  $('#rp-assistant-form').addEventListener('submit',event=>"
chat_line=next(line for line in home.splitlines() if line.startswith(chat_start))
home=home.replace(chat_line,"  $('#rp-assistant-form').addEventListener('submit',event=>{event.preventDefault();const field=$('#rp-assistant-message'),text=field.value.trim();if(!text)return;rpConversation.push({role:'user',text});rpGetReport().description=[rpGetReport().description,text].filter(Boolean).join(' ').slice(0,8000);$('#rp-description').value=rpGetReport().description;field.value='';rpRenderConversation();rpSetMode(rpMode);window.dispatchEvent(new CustomEvent('fixmycity:ai-chat',{detail:{text}}));});",1)
home=home.replace("['Road damage','Lighting','Cleanliness','Drainage','Other']","['Road accident','Road damage','Lighting','Cleanliness','Drainage','Flood','Fire','Crime','Fallen tree','Other']")
documents['home.html']=home

pages=['index','welcome','scan-card','scan-face','home','privacy']
for name in pages:
    html=externalize(documents[name+'.html'])
    # Share the manifest/install runtime across all documents, before their own scripts.
    if 'name="apple-mobile-web-app-capable"' not in html:
        html=html.replace('</head>','''  <link rel="manifest" href="manifest.webmanifest">
  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="FixMyCity">
  <meta name="mobile-web-app-capable" content="yes">
  <script src="app-flow.js"></script>
  <script src="pwa.js"></script>
</head>''')
    if 'href="app.css"' not in html:html=html.replace('</head>','<link rel="stylesheet" href="app.css">\n</head>')
    if 'src="press-feedback.js"' not in html:html=html.replace('</head>','<script src="press-feedback.js" defer></script>\n</head>')
    if 'src="app-language.js"' not in html:html=html.replace('</head>','<link rel="stylesheet" href="app-language.css">\n<script src="app-language.js" defer></script>\n</head>')
    styles=[]
    def extract_style(m):
        styles.append(m.group(1));return ''
    # Keep noscript styles in place; the main stylesheet is the first block.
    # A repeated build must never extract the noscript fallback over the real CSS.
    match=next((m for m in re.finditer(r'<style>(.*?)</style>',html,re.S)
                if html.rfind('<noscript',0,m.start()) <= html.rfind('</noscript>',0,m.start())),None)
    if match:
        (ROOT/(name+'.css')).write_text(match.group(1),encoding='utf-8')
        html=html[:match.start()]+f'<link rel="stylesheet" href="{name}.css">'+html[match.end():]
    scripts=list(re.finditer(r'<script>(.*?)</script>',html,re.S))
    if scripts:
        for i,match in reversed(list(enumerate(scripts))):
            scriptname=name+('-app' if len(scripts)==1 else f'-inline-{i}')+'.js'
            (ROOT/scriptname).write_text(match.group(1),encoding='utf-8')
            html=html[:match.start()]+f'<script src="{scriptname}"></script>'+html[match.end():]
    documents[name+'.html']=html

# Browser-local media is extracted byte-for-byte, never recompressed or sent to a service.
for path in [*ROOT.glob('*.js'),*ROOT.glob('*.css')]:
    content=path.read_text(encoding='utf-8');changed=externalize(content)
    if content!=changed:path.write_text(changed,encoding='utf-8')

runtime=[*ROOT.glob('*.css'),*ROOT.glob('*.js'),ROOT/'manifest.webmanifest',*ROOT.joinpath('assets').rglob('*')]
runtime=sorted({p for p in runtime if p.is_file() and p.name!='precache-manifest.js'})
for p in runtime:
    if p.suffix=='.js':
        check=subprocess.run(['node','--check',str(p)],capture_output=True,text=True,encoding='utf-8')
        assert check.returncode==0,check.stderr
    assert p.stat().st_size<25*1024*1024,f'Cloudflare asset too large: {p}'
document_bytes={name:html.encode('utf-8') for name,html in documents.items()}
version=hashlib.sha256(b''.join(hashlib.sha256(content).digest() for content in [*(p.read_bytes() for p in runtime),*(document_bytes[name] for name in sorted(documents))])).hexdigest()[:16]
(ROOT/'deploy/pages.js').write_text('// Generated from src/pages/*.ts.\nexport const pages = Object.freeze('+json.dumps(documents,ensure_ascii=False,separators=(',',':'))+');\n',encoding='utf-8')
precache={'version':version,'files':sorted([p.relative_to(ROOT).as_posix() for p in runtime if p.name not in ['service-worker.js','authority.css','authority.js']]+[name for name in documents if name!='authority.html'])}
# Installing the PWA must not download every original PNG and vision model while
# a first-time visitor is trying to load the welcome screen.
entry_shell={'index.html','index.css','intro.js','welcome.html','welcome.css','welcome-scenes.css','welcome.js',
             'privacy.html','privacy.css','privacy.js','phone-casing.css','phone-casing.js',
             'app.css','app-flow.js','app-language.css','app-language.js','press-feedback.js','pwa.js','manifest.webmanifest',
             'assets/fonts/roboto-latin.woff2','assets/fonts/roboto-latin-ext.woff2',
             'assets/icons/icon-192.png','assets/icons/icon-512.png','assets/icons/icon-maskable-512.png',
             'assets/icons/apple-touch-icon.png','assets/media/ac16c9ed522901498c47.svg'}
entry_shell.update(re.findall(r'assets/onboarding/city-[a-f0-9]{16}\.webp',documents['welcome.html']))
precache['precache']=sorted(entry_shell.intersection(precache['files']))
(ROOT/'precache-manifest.js').write_text('self.FMC_PRECACHE = '+json.dumps(precache,separators=(',',':'))+';\n',encoding='utf-8')
runtime.append(ROOT/'precache-manifest.js')
dist=ROOT/'deploy/dist';dist.mkdir(parents=True,exist_ok=True)
# Remove only previously generated files inside this exact deployment directory.
allowed={p.relative_to(ROOT).as_posix() for p in runtime}
for old in dist.rglob('*'):
    if old.is_file() and old.relative_to(dist).as_posix() not in allowed:old.unlink()
for p in runtime:
    target=dist/p.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
record={'version':version,'pages':sorted(documents),'files':len(runtime)+len(documents),'bytes':sum(p.stat().st_size for p in runtime)+sum(map(len,document_bytes.values())),'largestBytes':max(p.stat().st_size for p in runtime)}
(ROOT/'deploy/build-manifest.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps(record,indent=2))
