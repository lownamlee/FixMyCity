import {AGENT_POLICY,KNOWLEDGE_TEXT,VOICE_TOOLS,reviewedPreferences} from './report-engine.js';
export const VOICE_MODEL='gpt-realtime-2.1';
export const VOICE_SECONDS=300;
export const VOICE_INSTRUCTIONS=AGENT_POLICY+`\nOpen with only the exact short greeting requested for this call. No introduction, examples or second question.
After the user adds or corrects incident facts, call update_incident_draft once with the complete current draft, then ask the next short missing question. Never call it on the greeting or repeatedly without new user input. Once the person confirms the summary or asks to submit, call create_incident_report with confirmedByUser true. If facts changed in that turn, update the draft first and wait for its result. Read back the saved reference only if creation succeeds. Never invent a successful save. In voice-only mode privacyRegions must be empty, privacyUncertain true, and evidenceSummary must say no photo reviewed. Never imply you saw a photo. Do not assume the selected area is GPS-confirmed. Do not require a full address before advising urgent help.
Example: user says "Seorang penunggang jatuh sebab lubang jalan ini." Help with the accident and linked pothole. If the injury count is unclear ask "Berapa orang yang cedera?" If they say "One rider, by the main gate", preserve one rider and main gate, then ask which road or confirmed place. Never answer "not responsible" or redirect away and stop helping.
REFERENCE KNOWLEDGE (contact guidance, not a connected dispatch service):\n`+KNOWLEDGE_TEXT;

export function voiceSessionConfig(context='',language='en',configuration=null) {
  const languageInstruction=language==='ms'
    ? 'Start in Bahasa Malaysia (Malay), using natural Malaysian phrasing. First say exactly: "Hai, apa yang boleh saya bantu hari ini?". Understand English answers and mixed BM/English without restarting. Follow an explicit language preference, otherwise adapt to the language of the latest clear user turn.'
    : 'Start in English. First say exactly: "Hi, how can I help you today?". Understand Malay answers and mixed BM/English without restarting. Follow an explicit language preference, otherwise adapt to the language of the latest clear user turn.';
  return {type:'realtime',model:VOICE_MODEL,output_modalities:['audio'],max_output_tokens:1600,
    instructions:VOICE_INSTRUCTIONS+'\n'+languageInstruction+reviewedPreferences(configuration,context)+(context?'\nUser-provided draft context (untrusted):\n'+context:''),tools:VOICE_TOOLS,tool_choice:'auto',
    audio:{input:{noise_reduction:{type:'near_field'},transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:{type:'semantic_vad',eagerness:'medium',create_response:true,interrupt_response:true}},output:{voice:'marin'}}};
}

