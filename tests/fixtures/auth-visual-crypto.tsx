// Verification-only key boundary. Never generates, stores or decrypts a key.
import React from 'react'
let unlocked=false
export const isKeyBundleUnlocked=()=>unlocked
export const createKeyBundle=async()=>{unlocked=true;return {keyBundle:{fixture:true}}}
export const unlockKeyBundle=async()=>{unlocked=new URLSearchParams(location.search).get('scene')!=='unlock-error';return unlocked}
// Stop restored sessions at a fixture marker rather than loading the real workspace.
export function WorkspacePage(){return <output hidden>Fixture workspace boundary</output>}
