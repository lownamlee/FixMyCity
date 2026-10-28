export type VoicePhase='permission'|'connecting'|'listening'|'thinking'|'speaking'|'error'|'ended';
export type VoiceLanguage='en'|'ms';
type Hooks={state:(phase:VoicePhase,message?:string)=>void;transcript:(role:'user'|'assistant',id:string,text:string,final:boolean)=>void;levels:(input:number,output:number)=>void;playbackBlocked:()=>void;tool?:(name:string,args:unknown)=>unknown|Promise<unknown>};
type VoiceAnswer={sdp:string;token:string;maxSeconds:number};

/** One WebRTC call. Every exit closes tracks, audio nodes, data channel and peer. */
export class LiveVoice {
  private peer:RTCPeerConnection|null=null;
  private channel:RTCDataChannel|null=null;
  private stream:MediaStream|null=null;
  private audio=document.createElement('audio');
  private context:AudioContext|null=null;
  private analysers:AnalyserNode[]=[];
  private sources:MediaStreamAudioSourceNode[]=[];
  private raf=0;
  private timeout=0;
  private duration=0;
  private disconnected=0;
  private epoch=0;
  private token='';
  private texts=new Map<string,string>();
  private completedTools=new Set<string>();
  muted=false;
  connected=false;
  constructor(private hooks:Hooks){this.audio.autoplay=true;this.audio.setAttribute('playsinline','');}
  async start(draft:string,language:VoiceLanguage='en') {
    this.stop();const epoch=++this.epoch;
    const current=()=>this.epoch===epoch;
    this.hooks.state('permission');
    try {
      if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('Live voice needs a browser with microphone access. You can type your report instead.');
      this.context=new AudioContext();void this.context.resume().catch(()=>{});
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.meter(stream,0);
      for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(current())this.fail('Microphone access ended. Check your browser settings and try again.');});
      const peer=new RTCPeerConnection();this.peer=peer;
      for(const track of stream.getAudioTracks())peer.addTrack(track,stream);
      peer.ontrack=event=>{
        if(!current())return;
        const remote=event.streams[0]||new MediaStream([event.track]);this.audio.srcObject=remote;this.meter(remote,1);
        void this.audio.play().catch(()=>{if(current())this.hooks.playbackBlocked();});
      };
      peer.onconnectionstatechange=()=>{
        if(!current())return;
        if(peer.connectionState==='failed')this.fail('The voice connection was interrupted. Please reconnect.');
        if(peer.connectionState==='disconnected')this.disconnected=window.setTimeout(()=>{if(current()&&peer.connectionState==='disconnected')this.fail('The voice connection was interrupted. Please reconnect.');},5000);
        if(peer.connectionState==='connected')clearTimeout(this.disconnected);
      };
      const channel=peer.createDataChannel('oai-events');this.channel=channel;
      channel.onopen=()=>{
        if(!current())return;
        clearTimeout(this.timeout);this.connected=true;this.hooks.state('listening');
        const greeting=language==='ms'?'Hai, apa yang boleh saya bantu hari ini?':'Hi, how can I help you today?';
        this.send({type:'response.create',response:{instructions:`Say exactly this greeting and nothing else: "${greeting}". Do not introduce yourself, add examples, mention a draft, or ask a second question.`}});
      };
      channel.onclose=()=>{if(current())this.fail('The voice call ended. Reconnect to continue.');};
      channel.onmessage=event=>{if(current())this.onEvent(event.data);};
      this.hooks.state('connecting');
      this.timeout=window.setTimeout(()=>{if(current())this.fail('The voice connection timed out. Please try again.');},35000);
      const offer=await peer.createOffer();if(!current())return;
      await peer.setLocalDescription(offer);if(!current())return;
      // Keep this request alive on close so a late-created call can be explicitly ended.
      const response=await fetch('/api/voice/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:offer.sdp,context:draft.slice(0,2500),language})});
      const answer=await response.json() as VoiceAnswer&{message?:string};
      if(!current()){if(answer.token)this.endServer(answer.token);return;}
      if(!response.ok)throw Error(answer.message||'Live voice is unavailable. Please try again.');
      this.token=answer.token;
      await peer.setRemoteDescription({type:'answer',sdp:answer.sdp});if(!current())return;
      this.duration=window.setTimeout(()=>{if(current()){this.stop();this.hooks.state('ended','This voice session has ended. Start another call to continue.');}},Math.max(1,answer.maxSeconds-2)*1000);
    } catch(error) {
      if(!current())return;
      const name=(error as Error).name;
      this.fail(name==='NotAllowedError'?'Microphone access is blocked. Allow Microphone in your browser’s site settings, then try again.':name==='NotFoundError'?'No microphone was found. Connect one or type your report.':name==='NotReadableError'?'Your microphone is in use or unavailable. Check it and try again.':(error as Error).message||'Live voice could not connect. Please try again.');
    }
  }
  private onEvent(raw:string) {
    let e:Record<string,any>;try{e=JSON.parse(raw);}catch{return;}
    switch(e.type){
      case 'input_audio_buffer.speech_started':this.hooks.state('listening');break;
      case 'input_audio_buffer.speech_stopped':this.hooks.state('thinking');break;
      case 'response.created':this.hooks.state('thinking');break;
      case 'output_audio_buffer.started':this.hooks.state('speaking');break;
      case 'output_audio_buffer.stopped':case 'output_audio_buffer.cleared':this.hooks.state('listening');break;
      case 'conversation.item.input_audio_transcription.completed':if(typeof e.transcript==='string')this.hooks.transcript('user',e.item_id,e.transcript,true);break;
      case 'conversation.item.created':case 'conversation.item.added':if(e.item?.role==='user'){const text=(e.item.content||[]).filter((c:any)=>c.type==='input_text').map((c:any)=>c.text||'').join('\n');if(text)this.hooks.transcript('user',e.item.id,text,true);}break;
      case 'response.output_audio_transcript.delta':{
        const id=e.item_id||e.response_id;const text=(this.texts.get(id)||'')+(e.delta||'');this.texts.set(id,text);this.hooks.transcript('assistant',id,text,false);break;
      }
      case 'response.output_audio_transcript.done':this.texts.delete(e.item_id||e.response_id);this.hooks.transcript('assistant',e.item_id||e.response_id,e.transcript||'',true);break;
      case 'response.done':if(e.response?.status==='failed')this.fail('The assistant could not reply. Please reconnect.');else void this.runTools(e.response?.output);break;
      case 'error':if(!['response_cancel_not_active','conversation_already_has_active_response'].includes(e.error?.code))this.fail('The voice service encountered a problem. Please reconnect.');break;
    }
  }
  private async runTools(output:unknown){
    if(!Array.isArray(output))return;const epoch=this.epoch;let responded=false;
    for(const item of output){
      if(item?.type!=='function_call'||typeof item.call_id!=='string'||this.completedTools.has(item.call_id))continue;
      this.completedTools.add(item.call_id);let result:unknown;
      try{if(!['update_incident_draft','create_incident_report'].includes(item.name)||!this.hooks.tool)throw Error('Unavailable tool');if(typeof item.arguments!=='string'||item.arguments.length>16000)throw Error('Invalid draft');result=await this.hooks.tool(item.name,JSON.parse(item.arguments));}
      catch{result={saved:false,message:'The draft was not updated. Continue collecting facts; do not claim it was submitted.'};}
      if(this.epoch!==epoch)return;
      this.send({type:'conversation.item.create',item:{type:'function_call_output',call_id:item.call_id,output:JSON.stringify(result)}});responded=true;
    }
    if(responded&&this.epoch===epoch)this.send({type:'response.create'});
  }
  private send(value:unknown){if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(value));}
  private meter(stream:MediaStream,index:number){
    const context=this.context;if(!context||context.state==='closed')return;
    const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=256;
    source.connect(analyser);this.sources.push(source);this.analysers[index]=analyser;
    if(this.raf)return;
    const data=new Uint8Array(256);
    const level=(analyser?:AnalyserNode)=>{if(!analyser)return 0;analyser.getByteTimeDomainData(data);return Math.min(1,Math.sqrt(data.reduce((n,v)=>n+((v-128)/128)**2,0)/data.length)*5);};
    const tick=()=>{this.hooks.levels(this.muted?0:level(this.analysers[0]),level(this.analysers[1]));this.raf=requestAnimationFrame(tick);};tick();
  }
  mute(){this.muted=!this.muted;this.stream?.getAudioTracks().forEach(t=>t.enabled=!this.muted);return this.muted;}
  play(){void this.audio.play().catch(()=>this.hooks.playbackBlocked());void this.context?.resume().catch(()=>{});}
  private fail(message:string){this.stop();this.hooks.state('error',message);}
  private endServer(token:string){void fetch('/api/voice/end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),keepalive:true}).catch(()=>{});}
  stop(){
    ++this.epoch;this.connected=false;this.muted=false;
    clearTimeout(this.timeout);clearTimeout(this.duration);clearTimeout(this.disconnected);cancelAnimationFrame(this.raf);this.raf=0;
    if(this.channel){this.channel.onclose=null;this.channel.onmessage=null;this.channel.onopen=null;this.channel.close();this.channel=null;}
    if(this.peer){this.peer.onconnectionstatechange=null;this.peer.ontrack=null;this.peer.close();this.peer=null;}
    this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
    this.audio.pause();this.audio.srcObject=null;
    this.sources.forEach(s=>s.disconnect());this.sources=[];this.analysers=[];
    if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});this.context=null;
    if(this.token)this.endServer(this.token);this.token='';this.texts.clear();this.completedTools.clear();this.hooks.levels(0,0);
  }
}
