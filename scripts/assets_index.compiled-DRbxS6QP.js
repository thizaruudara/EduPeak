import{j as n}from"./index-BVA5IrkT.js";import{B as N}from"./ScrambleText.vue-DBY8w-h7.js";import{u as I}from"./use-dom-ref-D5VyW2Sw.js";import{m as d}from"./index-BieARX3d.js";import{A as $}from"./AnimatePresence-8Es77hry.js";import{u as D}from"./use-transform-C2lGASqX.js";import{u as W}from"./use-motion-value-event-l854vn1o.js";import{u as b}from"./use-spring-TZH-Ab_5.js";import{u as R}from"./use-velocity-PvW7fRi1.js";import{aw as A,o as q,aN as F,aS as Y,bv as U,az as k,aA as s,aB as z,aC as a,bu as J,bF as K,ay as B,ax as Q,bA as Z,bB as ee,aD as te}from"./index-Cpu3CUE2.js";import{w as L}from"./wrap-CoT40OZP.js";import{s as ne}from"./stagger-D3vWwuJr.js";import"./RowValue-DwddZF4R.js";import"./index-B6qYsZmI.js";import"./style-CzERqD9f.js";import"./index-BlYpciK2.js";import"./transform-D8tMhbW4.js";import"./follow-value-Z-kyrXkO.js";const oe={class:"header"},ie={class:"title title-collection"},se={class:"title-count"},ae={class:"planes-container"},re=320,le=-80,T=26,ce="!@#$%^&*()_+-=[]{}|;:,.<>?/~`░▒▓█▀▄■□▪▫●○◆◇◈◊※†‡",ke=A({beforeCreate(){const i=document.createElement("style");i.id="scroll-velocity-linked-offset-style",i.textContent=`
@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap");
body {
    overflow: hidden;
}
.container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: black;
    touch-action: none;
    font-family: "Geist", sans-serif;
}
.container * {
    font-family: inherit;
}
.header {
    position: absolute;
    z-index: 50;
    font-weight: 600;
    letter-spacing: -0.02em;
    top: max(90px, 3vw);
    left: 3vw;
}
.title {
    color: var(--white);
    font-size: clamp(32px, 5vw, 64px);
    line-height: 0.9;
    font-weight: normal;
    letter-spacing: -0.02em;
    margin-left: 4vw;
}
.title-collection {
    margin-left: 0;
}
.title-count {
    font-size: clamp(10px, 0.4em, 0.4em);
    font-weight: 600;
    letter-spacing: normal;
    font-variant-numeric: tabular-nums;
    margin-left: 4px;
    position: relative;
    top: 0.65em;
    vertical-align: top;
    line-height: 0;
}
.hint {
    position: absolute;
    z-index: 50;
    display: flex;
    align-items: center;
    font-family: "Geist Mono", monospace;
    text-transform: uppercase;
    bottom: 3vw;
    right: 3vw;
    font-size: 10px;
    letter-spacing: 0.05em;
    color: var(--white);
}
.viewport {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    perspective: 2000px;
    perspective-origin: 10% 10%;
}
.planes-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-style: preserve-3d;
    transform: translateY(100px);
}
.plane {
    width: 320px;
    height: 384px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    font-size: 48px;
    font-weight: bold;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    position: absolute;
    transform-style: preserve-3d;
    transition: filter 0.2s ease;
}
.plane-image-container {
    position: absolute;
    inset: 0;
    overflow: hidden;
}
.plane-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.plane-index {
    position: absolute;
    font-family: "Geist Mono", monospace;
    color: var(--white);
    top: -24px;
    left: 0;
    font-size: 10px;
    font-weight: normal;
    letter-spacing: 0.05em;
}
.label-container {
    position: absolute;
    display: flex;
    align-items: center;
    pointer-events: none;
    left: 100%;
    top: 50%;
    margin-left: 12px;
}
.label-line {
    width: 120px;
    height: 1px;
    background-color: var(--white);
    transform-origin: left;
}
.label-text {
    padding: 4px 8px;
    font-family: "Geist Mono", monospace;
    white-space: nowrap;
    text-transform: uppercase;
    background-color: transparent;
    color: var(--white);
    font-size: 10px;
    font-weight: normal;
    letter-spacing: 0.05em;
}
`,document.head.appendChild(i)},unmounted(){const i=document.getElementById("scroll-velocity-linked-offset-style");i&&i.remove()},setup(i){const m=Array.from({length:16},(e,t)=>`/photos/heritage/${t+1}.jpg`),P=["Afterglow","Drift Frame","Peripheral","Standstill","Threshold","Windowline","Reflection","Passerby","Insulation","Motion Blur","Backlight","Transit Light","Through Glass","Velocity","Crossing","Upward Light"],C=A({props:{index:{type:Number,required:!0},scrollX:{type:Object,required:!0},scrollVelocity:{type:Object,required:!0},isHovered:{type:Boolean,required:!0}},emits:["hoverStart","hoverEnd"],setup(e,{emit:t}){const o=b(0,{stiffness:400,damping:25}),p=re+le,l=p*T,S=e.index*p,X=b(0,{stiffness:300,damping:20,mass:.3});W(e.scrollVelocity,"change",u=>{const g=e.scrollX.get(),x=S+g,c=L(-l/2,l/2,x)/(l/2),w=Math.sin(c*Math.PI*2),y=u/50*w*5;X.set(y)}),(()=>{o.set(e.isHovered?-30:0)})();const G=D(()=>{const u=e.scrollX.get(),g=X.get(),x=o.get(),_=S+u,c=L(-l/2,l/2,_),w=c*-.35+g+x,y=c*-1.2;return`translate3d(${c}px, ${w}px, ${y}px) rotateY(-50deg)`}),M=P[e.index%P.length];return()=>(o.set(e.isHovered?-30:0),n(d.div,{class:"plane",style:{transform:G,zIndex:e.isHovered?100:1,filter:e.isHovered?"brightness(1.15)":"brightness(1)"},onHoverStart:()=>t("hoverStart"),onHoverEnd:()=>t("hoverEnd"),children:[n("div",{class:"plane-image-container",children:n("img",{src:m[e.index%m.length],alt:`Plane ${e.index}`,class:"plane-image",draggable:!1})}),n("div",{class:"plane-index",children:String(e.index).padStart(2,"0")}),n($,{children:e.isHovered&&n(d.div,{class:"label-container",initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.15},children:[n(d.div,{class:"label-line",initial:{scaleX:0},animate:{scaleX:1},exit:{scaleX:0},transition:{duration:.3,ease:"easeOut"}}),n("div",{class:"label-text",children:n(N,{text:M,active:e.isHovered,duration:ne(.05),chars:ce})})]})})]}))}}),r=q(0),E=b(r,{stiffness:100,damping:30,mass:.5}),O=R(E),f=I(),h=te(null);let v=0;const H=e=>{e.preventDefault();const t=e.deltaX!==0?e.deltaX:e.deltaY;r.set(r.get()-t)},V=e=>{v=e.clientX},j=e=>{const t=e.clientX-v;v=e.clientX,r.set(r.get()+t*2.5)};return F(()=>{const e=f.value;e&&e.addEventListener("wheel",H,{passive:!1})}),Y(()=>{const e=f.value;e&&e.removeEventListener("wheel",H)}),(e,t)=>(z(),U(s(d).div,{ref_key:"containerRef",ref:f,class:"container",onPressStart:V,onPan:j},{default:k(()=>[a("div",oe,[t[2]||(t[2]=a("div",{class:"title"},"HERITAGE FW25/26",-1)),a("div",ie,[t[1]||(t[1]=J(" COLLECTION ",-1)),a("sup",se,"("+K(s(m).length)+")",1)])]),t[3]||(t[3]=a("div",{class:"hint"},"scroll to surf",-1)),B(s(d).div,{class:"viewport"},{default:k(()=>[a("div",ae,[(z(),Q(Z,null,ee(T,o=>B(s(C),{key:o-1,index:o-1,"scroll-x":s(E),"scroll-velocity":s(O),"is-hovered":h.value===o-1,onHoverStart:p=>h.value=o-1,onHoverEnd:t[0]||(t[0]=p=>h.value=null)},null,8,["index","scroll-x","scroll-velocity","is-hovered","onHoverStart"])),64))])]),_:1})]),_:1},512))}});export{ke as default};
