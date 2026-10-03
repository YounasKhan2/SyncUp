export const observeProof = () => {
  const root=document.documentElement,style=getComputedStyle(root)
  const variables=[...style].filter(key=>key.startsWith('--ds-')||key.startsWith('--color-')||key.startsWith('--type-')||key==='--font-sans'||key==='--font-scale').sort().map(key=>[key,style.getPropertyValue(key)])
  const chunks=[];for(let index=0;index<variables.length;index+=100)chunks.push(variables.slice(index,index+100))
  return {theme:root.dataset.theme,appearance:root.dataset.appearance,colorScheme:root.style.colorScheme,systemDark:root.dataset.visualSystemDark,systemLight:root.dataset.visualSystemLight,variables:chunks,utilities:[...document.querySelectorAll('[id^="probe-"]')].map(node=>{const s=getComputedStyle(node);return{id:node.id,class:node.className,background:s.backgroundColor,color:s.color,border:s.borderColor,ring:s.getPropertyValue('--tw-ring-color'),family:s.fontFamily,size:s.fontSize,lineHeight:s.lineHeight,weight:s.fontWeight,tracking:s.letterSpacing,transform:s.textTransform,padding:s.padding,gap:s.gap,radius:s.borderRadius,shadow:s.boxShadow,duration:s.transitionDuration,ease:s.transitionTimingFunction,z:s.zIndex}})}
}
