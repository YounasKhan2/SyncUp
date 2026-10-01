import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Send, Square, Trash2 } from 'lucide-react'

export type VoiceDraft={file:File;durationMs:number;waveform:number[];url:string}
function mimeType(){for(const type of ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'])if(MediaRecorder.isTypeSupported(type))return type;return ''}
function clock(ms:number){const total=Math.floor(ms/1000);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`}
export function VoiceRecorder({disabled,onReady}:{disabled:boolean;onReady:(draft:VoiceDraft)=>void}){
 const [recording,setRecording]=useState(false),[paused,setPaused]=useState(false),[elapsed,setElapsed]=useState(0),[levels,setLevels]=useState<number[]>([])
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),chunks=useRef<Blob[]>([]),levelsRef=useRef<number[]>([]),started=useRef(0),pausedAt=useRef(0),pausedTotal=useRef(0),timer=useRef<number|null>(null),audioContext=useRef<AudioContext|null>(null)
 const stopTracks=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;audioContext.current?.close().catch(()=>undefined);audioContext.current=null;if(timer.current)window.clearInterval(timer.current);timer.current=null}
 useEffect(()=>()=>stopTracks(),[])
 async function start(){if(disabled||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')return
  const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;chunks.current=[];levelsRef.current=[];pausedTotal.current=0;started.current=Date.now();setElapsed(0);setLevels([])
  const type=mimeType(),r=new MediaRecorder(media,type?{mimeType:type}:undefined);recorder.current=r
  r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)}
  r.onstop=()=>{const durationMs=Math.max(1,Date.now()-started.current-pausedTotal.current),blob=new Blob(chunks.current,{type:r.mimeType||'audio/webm'}),ext=blob.type.includes('ogg')?'ogg':blob.type.includes('mp4')?'m4a':'webm';const file=new File([blob],`voice-${Date.now()}.${ext}`,{type:blob.type});onReady({file,durationMs,waveform:levelsRef.current.slice(-48),url:URL.createObjectURL(blob)});stopTracks();setRecording(false);setPaused(false)}
  r.start(500);setRecording(true)
  const context=new AudioContext(),source=context.createMediaStreamSource(media),analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);audioContext.current=context;const data=new Uint8Array(analyser.frequencyBinCount)
  timer.current=window.setInterval(()=>{if(r.state==='recording'){setElapsed(Date.now()-started.current-pausedTotal.current);analyser.getByteTimeDomainData(data);let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value-128));const next=[...levelsRef.current.slice(-47),Math.max(.08,peak/128)];levelsRef.current=next;setLevels(next)}},120)
 }
 function toggle(){const r=recorder.current;if(!r)return;if(r.state==='recording'){r.pause();pausedAt.current=Date.now();setPaused(true)}else if(r.state==='paused'){pausedTotal.current+=Date.now()-pausedAt.current;r.resume();setPaused(false)}}
 if(!recording)return <button type="button" className="voice-record-button" onClick={()=>void start()} disabled={disabled} aria-label="Record voice note" title="Record voice message"><Mic size={17}/></button>
 return <div className="voice-recorder" role="group" aria-label="Voice recording controls" data-paused={paused}>
  <button type="button" className="voice-recorder-toggle" onClick={toggle} aria-label={paused?'Resume recording':'Pause recording'} title={paused?'Resume recording':'Pause recording'}>{paused?<Play size={14}/>:<Pause size={14}/>}</button>
  <span className="voice-record-indicator" aria-hidden="true"/>
  <span className="voice-recorder-state">{paused?'Paused':'Recording'}</span>
  <strong className="voice-recorder-time">{clock(elapsed)}</strong>
  <div className="voice-live-wave" aria-hidden="true">{levels.slice(-24).map((level,index)=><i key={index} style={{height:`${Math.max(3,level*18)}px`}}/>)}</div>
  <button type="button" className="voice-recorder-stop" onClick={()=>recorder.current?.stop()} aria-label="Finish recording and preview" title="Finish recording"><Square size={13}/></button>
 </div>
}
export function VoicePreview({draft,onDelete,onSend,disabled}:{draft:VoiceDraft;onDelete:()=>void;onSend:()=>void;disabled:boolean}){
 const audio=useRef<HTMLAudioElement>(null),[playing,setPlaying]=useState(false)
 useEffect(()=>()=>URL.revokeObjectURL(draft.url),[draft.url])
 return <div className="voice-preview" role="group" aria-label="Voice message preview">
  <button type="button" className="voice-preview-play" onClick={()=>{const a=audio.current;if(!a)return;if(a.paused)void a.play();else a.pause()}} aria-label={playing?'Pause voice preview':'Play voice preview'} title={playing?'Pause preview':'Play preview'}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
  <audio ref={audio} src={draft.url} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>
  <div className="voice-wave" aria-hidden="true">{draft.waveform.map((level,index)=><i key={index} style={{height:`${Math.max(3,level*18)}px`}}/>)}</div>
  <span className="voice-preview-time">{clock(draft.durationMs)}</span>
  <button type="button" className="voice-preview-delete" onClick={onDelete} aria-label="Delete voice note" title="Delete voice note"><Trash2 size={15}/></button>
  <button type="button" className="voice-preview-send" onClick={onSend} disabled={disabled} aria-label="Send voice note" title="Send voice note"><Send size={15}/></button>
 </div>
}
