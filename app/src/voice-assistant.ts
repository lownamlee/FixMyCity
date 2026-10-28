import {LiveVoice,type VoicePhase,type VoiceLanguage} from './lib/live-voice';
import {ElevenLabsVoice} from './lib/elevenlabs-voice';
import {VoiceOrb} from './ui/voice-orb';
import {buildAssessment,locationClaim,type IncidentFacts} from './ai/domain';
import {matchesSchema,INCIDENT_SCHEMA} from './ai/schema';
import type {Assessment} from './lib/report-ai';
import {saveIncident,submitIncident,newIncident} from './lib/local-reports';

const svg=(path:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
const mic=svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>');
const dialog=document.createElement('dialog');dialog.className='voice-dialog';dialog.setAttribute('aria-labelledby','voice-title');
dialog.innerHTML=`<header class="voice-header"><div class="voice-brand"><i></i>FixMyCity AI</div><button class="voice-close" aria-label="Close voice assistant">${svg('<path d="m6 6 12 12M18 6 6 18"/>')}</button></header><div class="voice-orb" aria-hidden="true"></div><h2 class="voice-status" id="voice-title">Connecting</h2><p class="voice-detail" role="status"></p><div class="voice-transcript" aria-label="Conversation"></div><div class="voice-controls"><button class="voice-control voice-mute" aria-label="Mute microphone" aria-pressed="false" disabled><span class="control-circle">${mic}</span><span class="voice-mute-label">Mute</span></button><button class="voice-control voice-end" aria-label="End voice call"><span class="control-circle">${svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.4a2 2 0 0 1-.5 2.1l-1.3 1.3a16 16 0 0 0 4.7 4.7l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.4.6a2 2 0 0 1 1.7 1.9Z"/>')}</span><span>End call</span></button></div><button class="voice-action voice-retry" hidden>Try again</button><button class="voice-action voice-play" hidden>Play audio</button><button class="voice-action voice-use" hidden>Add to report</button><p class="voice-footnote">Live voice · AI-generated audio · <a href="privacy?from=home">Privacy policy</a></p>`;
document.body.append(dialog);
const draftPreview=document.createElement('div');draftPreview.className='voice-draft-preview';draftPreview.hidden=true;dialog.querySelector('.voice-transcript')!.after(draftPreview);
const el=<T extends HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
let orb:VoiceOrb|null=null,call:LiveVoice|ElevenLabsVoice|null=null,phase:VoicePhase='connecting',previousFocus:HTMLElement|null=null;
let language:VoiceLanguage='en';
let selectedProvider:'openai'|'elevenlabs'='openai';
const providerPanel=document.createElement('div');providerPanel.className='voice-provider-choice';providerPanel.hidden=true;
providerPanel.innerHTML='<label for="voice-provider">Voice provider</label><select id="voice-provider"><option value="openai">OpenAI</option><option value="elevenlabs">ElevenLabs</option></select><label class="voice-provider-consent" hidden><input type="checkbox"> I agree to send my voice to ElevenLabs for this conversation.</label><button type="button" class="voice-action voice-provider-start">Start voice</button>';
dialog.querySelector('.voice-header')!.after(providerPanel);
const providerSelect=providerPanel.querySelector<HTMLSelectElement>('#voice-provider')!;
const providerConsent=providerPanel.querySelector<HTMLInputElement>('.voice-provider-consent input')!;
providerSelect.addEventListener('change',()=>{providerPanel.querySelector<HTMLElement>('.voice-provider-consent')!.hidden=providerSelect.value!=='elevenlabs';});
providerPanel.querySelector<HTMLButtonElement>('.voice-provider-start')!.addEventListener('click',()=>{
  selectedProvider=providerSelect.value==='elevenlabs'?'elevenlabs':'openai';
  if(selectedProvider==='elevenlabs'&&!providerConsent.checked){el('.voice-detail').textContent='Please agree before starting the ElevenLabs conversation.';return;}
  providerPanel.hidden=true;start();
});
let incidentDraft:Assessment|null=null;
let initialText='',voiceEpoch=0;
const messages=new Map<string,HTMLElement>(),userText=new Map<string,string>();
const phaseCopy:Record<VoicePhase,[string,string]>={permission:['Enable your microphone','Allow microphone access to speak with FixMyCity.'],connecting:['Connecting','Starting your voice conversation…'],listening:['Listening','Tell me what happened.'],thinking:['Thinking','Putting the details together…'],speaking:['Speaking','You can interrupt to add a detail.'],error:['Unable to connect','Please try again.'],ended:['Call ended','Start another call to continue.']};
function setState(next:VoicePhase,message?:string){
  phase=next;dialog.dataset.state=next;
  el('#voice-title').textContent=phaseCopy[next][0];el('.voice-detail').textContent=message||phaseCopy[next][1];
  orb?.setState(next==='permission'?'idle':next==='ended'?'idle':next);
  el<HTMLButtonElement>('.voice-mute').disabled=!call?.connected;
  el('.voice-retry').hidden=!['error','ended'].includes(next);
  if(call?.muted&&next==='listening')el('#voice-title').textContent='Microphone muted';
}
function draftContext(){const context=window.FMCReportBridge?.context();return JSON.stringify({draft:initialText.slice(0,1800),location:context?.location||null}).slice(0,2500);}
function start(){
  call?.stop();el('.voice-play').hidden=true;el('.voice-retry').hidden=true;
  el('.voice-mute').setAttribute('aria-pressed','false');el('.voice-mute').setAttribute('aria-label','Mute microphone');el('.voice-mute-label').textContent='Mute';
  const hooks={state:setState,levels:(input:number,output:number)=>{if(orb)orb.level=phase==='speaking'?output:input;},playbackBlocked:()=>el('.voice-play').hidden=false,
    tool:async(name,args:any)=>{
      const epoch=voiceEpoch;
      if(!dialog.open)throw Error('Voice session closed');
      if(name==='create_incident_report'){
        if(args?.confirmedByUser!==true||!incidentDraft)return{saved:false,message:'Confirm the report facts first.'};
        incidentDraft.originalText=[initialText,...userText.values()].filter(Boolean).join('\n').slice(0,8000);
        try{await saveIncident(incidentDraft,window.FMCReportBridge?.context());if(epoch!==voiceEpoch)return{saved:false,message:'Session closed before submission.'};const receipt=await submitIncident();
          if(epoch===voiceEpoch){const link=document.createElement('a');link.href='cases#'+receipt.id;link.textContent='View report '+receipt.id;draftPreview.append(link);}
          return{saved:true,reportId:receipt.id,status:'created_in_local_fixmycity',dispatchAcknowledged:false,message:'Report created in FixMyCity locally. No real agency has been notified.'};
        }catch(error){return{saved:false,message:(error as Error).message};}
      }
      if(!dialog.open||!matchesSchema(args,INCIDENT_SCHEMA))throw Error('Invalid incident draft');
      const context=window.FMCReportBridge?.context();
      incidentDraft=buildAssessment(args as IncidentFacts,[initialText,...userText.values()].filter(Boolean).join('\n').slice(0,8000),locationClaim(context?.location));
      draftPreview.replaceChildren();draftPreview.hidden=false;
      const label=document.createElement('small');label.textContent='Report draft · check before submitting';
      const title=document.createElement('strong');title.textContent=incidentDraft.facts.title;
      const place=document.createElement('span');place.textContent=(incidentDraft.location.text||incidentDraft.facts.locationText||'Location needed')+(incidentDraft.facts.accessPoint?' · '+incidentDraft.facts.accessPoint:'');
      draftPreview.append(label,title,place);
      if(incidentDraft.emergency.required){const emergency=document.createElement('a');emergency.href='tel:999';emergency.textContent='Urgent help: call 999';draftPreview.append(emergency);}
      el('.voice-use').hidden=false;
      const activeDraft=incidentDraft;let stored=false;try{const saved=await saveIncident(activeDraft,context);stored=true;if(epoch===voiceEpoch)incidentDraft=saved.assessment;}catch{}
      return{saved:stored,status:stored?'draft_saved_locally':'draft_in_memory',submitted:false,emergency:activeDraft.emergency,locationConfirmed:activeDraft.location.confirmed,nextQuestion:language==='ms'?activeDraft.facts.nextQuestionMs:activeDraft.facts.nextQuestionEn};
    },
    transcript:(role:'user'|'assistant',id:string,text:string,final:boolean)=>{
      if(!dialog.open||!text)return;
      let message=messages.get(id);if(!message){message=document.createElement('div');message.className='voice-message';message.dataset.role=role;message.innerHTML='<small></small><span></span>';message.querySelector('small')!.textContent=role==='user'?'You':'FixMyCity AI';messages.set(id,message);el('.voice-transcript').append(message);}
      message.querySelector('span')!.textContent=text;const log=el('.voice-transcript');log.scrollTop=log.scrollHeight;
      if(role==='user'&&final){userText.set(id,text);el('.voice-use').hidden=false;}
    }};
  call=selectedProvider==='elevenlabs'?new ElevenLabsVoice(hooks):new LiveVoice(hooks);
  void call.start(draftContext(),language);
}
function open(event:Event){
  if(dialog.open)return;
  const selected=(event as CustomEvent<{language?:string}>).detail?.language;
  if(selected==='en'||selected==='ms')language=selected;
  el('.voice-brand').innerHTML=`<i></i>FixMyCity AI <span class="voice-language-label">${language==='ms'?'Malay':'English'}</span>`;
  previousFocus=document.activeElement as HTMLElement;
  voiceEpoch++;initialText=window.FMCReportBridge?.context().transcript||'';newIncident();
  messages.clear();userText.clear();incidentDraft=null;draftPreview.hidden=true;draftPreview.replaceChildren();el('.voice-transcript').replaceChildren();el('.voice-use').hidden=true;
  history.pushState({...history.state,fmcVoice:true},'',location.href);
  dialog.showModal();orb=new VoiceOrb(el('.voice-orb'));el('.voice-close').focus();
  selectedProvider='openai';providerSelect.value='openai';providerConsent.checked=false;providerPanel.hidden=true;
  providerPanel.querySelector<HTMLElement>('.voice-provider-consent')!.hidden=true;
  const epoch=voiceEpoch;
  void fetch('/api/voice/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null).then(info=>{
    if(epoch!==voiceEpoch||!dialog.open)return;
    if(info?.elevenLabsConfigured===true){providerPanel.hidden=false;setState('connecting','Choose a voice provider to continue.');}
    else start();
  });
}
function close(back=true){
  if(!dialog.open)return;voiceEpoch++;call?.stop();call=null;orb?.destroy();orb=null;dialog.close();
  if(back&&history.state?.fmcVoice)history.back();
  previousFocus?.focus({preventScroll:true});
}
el('.voice-close').addEventListener('click',()=>close());el('.voice-end').addEventListener('click',()=>close());
el('.voice-retry').addEventListener('click',start);
el('.voice-play').addEventListener('click',()=>{el('.voice-play').hidden=true;call?.play();});
el('.voice-mute').addEventListener('click',()=>{if(!call?.connected)return;const muted=call.mute();el('.voice-mute').setAttribute('aria-pressed',String(muted));el('.voice-mute').setAttribute('aria-label',muted?'Unmute microphone':'Mute microphone');el('.voice-mute-label').textContent=muted?'Unmute':'Mute';setState(phase);});
el('.voice-use').addEventListener('click',()=>{const text=[initialText,...userText.values()].filter(Boolean).join('\n').trim();if(incidentDraft){incidentDraft.originalText=text;window.FMCReportBridge?.apply(incidentDraft);}else if(text)window.dispatchEvent(new CustomEvent('fixmycity:voice-draft',{detail:{text:[...userText.values()].join('\n').slice(0,2000)}}));close();});
dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
window.addEventListener('fixmycity:open-voice',open);
window.addEventListener('popstate',()=>{close(false);if(history.state?.fmcVoice){const state={...history.state};delete state.fmcVoice;history.replaceState(state,'',location.href);}});
window.addEventListener('hashchange',()=>close(false));
window.addEventListener('pagehide',()=>close(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
