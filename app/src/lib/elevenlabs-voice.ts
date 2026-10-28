import { Conversation } from '@elevenlabs/client';
import type { VoicePhase, VoiceLanguage } from './live-voice';

type Hooks = {
  state: (phase: VoicePhase, message?: string) => void;
  transcript: (role: 'user'|'assistant', id: string, text: string, final: boolean) => void;
  levels: (input: number, output: number) => void;
  playbackBlocked: () => void;
};

/** A private-agent WebSocket session. The server holds the ElevenLabs API key. */
export class ElevenLabsVoice {
  private session: Awaited<ReturnType<typeof Conversation.startSession>> | null = null;
  private epoch = 0;
  private duration = 0;
  private frame = 0;
  private messageId = 0;
  muted = false;
  connected = false;

  constructor(private hooks: Hooks) {}

  async start(_draft: string, _language: VoiceLanguage = 'en') {
    this.stop();
    const epoch = ++this.epoch;
    const current = () => this.epoch === epoch;
    this.hooks.state('permission', 'Allow microphone access to start your ElevenLabs conversation.');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Microphone access is unavailable in this browser.');
      const response = await fetch('/api/voice/elevenlabs/session', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({consent:true}), cache: 'no-store',
      });
      const result = await response.json() as {signedUrl?:string;message?:string};
      if (!current()) return;
      if (!response.ok || !result.signedUrl) throw Error(result.message || 'Voice is unavailable.');
      this.hooks.state('connecting');
      const session = await Conversation.startSession({
        signedUrl: result.signedUrl,
        connectionType: 'websocket',
        onConnect: () => { if(current()){this.connected=true;this.hooks.state('listening');} },
        onDisconnect: () => { if(current()){this.stop();this.hooks.state('ended');} },
        onError: () => { if(current()){this.stop();this.hooks.state('error','The voice connection was interrupted.');} },
        onModeChange: ({mode}: {mode:string}) => { if(current())this.hooks.state(mode==='speaking'?'speaking':'listening'); },
        onMessage: ({source,message}: {source:string;message:string}) => {
          if(current() && typeof message==='string' && (source==='user'||source==='ai'))
            this.hooks.transcript(source==='user'?'user':'assistant',`eleven-${++this.messageId}`,message,true);
        },
      });
      if(!current()){await session.endSession();return;}
      this.session=session;
      this.connected=true;
      this.hooks.state('listening');
      const tick=()=>{
        if(!current()||!this.session)return;
        const audio=this.session as unknown as {getInputVolume?:()=>number;getOutputVolume?:()=>number};
        this.hooks.levels(this.muted?0:(audio.getInputVolume?.()||0),audio.getOutputVolume?.()||0);
        this.frame=requestAnimationFrame(tick);
      };
      tick();
      this.duration=window.setTimeout(()=>{if(current()){this.stop();this.hooks.state('ended','This voice session has ended.');}},180_000);
    } catch(error) {
      if(!current())return;
      const name=(error as Error).name;
      this.stop();
      this.hooks.state('error',name==='NotAllowedError'?'Microphone access is blocked. Allow access and try again.':(error as Error).message||'Unable to connect.');
    }
  }

  mute(){this.muted=!this.muted;this.session?.setMicMuted(this.muted);return this.muted;}
  play(){/* The SDK manages audio playback for its session. */}
  stop(){
    ++this.epoch;this.connected=false;this.muted=false;
    clearTimeout(this.duration);cancelAnimationFrame(this.frame);this.frame=0;
    const session=this.session;this.session=null;
    if(session)void session.endSession().catch(()=>{});
    this.hooks.levels(0,0);
  }
}
