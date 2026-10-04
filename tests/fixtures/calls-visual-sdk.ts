// Visual-only SDK double. No network, device acquisition or encrypted media.
const scene=new URLSearchParams(location.search).get('scene')
export const trace:string[]=[]
export const RoomEvent={TrackSubscribed:'track',TrackUnsubscribed:'untrack',ParticipantConnected:'join',ParticipantDisconnected:'leave',Disconnected:'disconnect',EncryptionError:'encryption'}
export const ParticipantEvent={TrackMuted:'muted',TrackUnmuted:'unmuted'}
export const isE2EESupported=()=>true
export class ExternalE2EEKeyProvider {async setKey(){trace.push('synthetic key')}}
function track(local=false){const elements:HTMLVideoElement[]=[];return {attach(){const el=document.createElement('video');el.poster='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="${local?'#38313c':'#29242e'}"/><text x="400" y="250" text-anchor="middle" fill="#e8e0e8" font-family="sans-serif" font-size="24">Synthetic ${local?'local':'remote'} video</text></svg>`);elements.push(el);return el},detach(){return elements}}}
const names=['Alexandra Morgan-Sutherland','Alex Chen','Jamie Patel']
export class Room {
 handlers=new Map<string,Function>()
 remoteParticipants=new Map(scene==='waiting'||scene==='error'?[]:names.slice(0,scene==='group'?3:scene==='voice'?2:1).map((name,i)=>['peer'+i,{identity:'peer'+i,name,isMicrophoneEnabled:i!==1,isCameraEnabled:scene==='video',on(){}}]))
 localParticipant={identity:'me',videoTrackPublications:new Map(scene==='video'?[['local',{track:track(true)}]]:[]),async setMicrophoneEnabled(v:boolean){trace.push('microphone '+v)},async setCameraEnabled(v:boolean){trace.push('camera '+v);document.querySelectorAll<HTMLVideoElement>('.call-video-local').forEach(el=>el.hidden=!v)}}
 on(event:string,handler:Function){this.handlers.set(event,handler);return this}
 async connect(){trace.push('synthetic connect');if(scene==='video')for(const p of this.remoteParticipants.values())this.handlers.get('track')?.(track(),{},p)}
 async disconnect(){trace.push('disconnect')}
 async setE2EEEnabled(v:boolean){trace.push('synthetic e2ee '+v)}
}
