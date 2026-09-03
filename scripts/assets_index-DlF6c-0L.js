import{j as f,r as h,f as X,m as P,g as Y,h as C}from"./index-Cpu3CUE2.js";import{u as V}from"./use-pointer-position-DRoRnDHc.js";import"./index-rMXZ8uW9.js";import{u as m}from"./use-motion-value-BdoVfRuj.js";import{u as H}from"./use-transform-ClPd1M5e.js";import{a as T}from"./index-BzYMeYP3.js";import"./index-CUms08jJ.js";import"./get-next-text-DK-5w0f9.js";import"./index-B6qYsZmI.js";import"./transform-D8tMhbW4.js";import"./wrap-CoT40OZP.js";import"./GroupAnimation-C01Jrkt9.js";const $=["#ffe14d","#8df0cc","#ff5da8","#a98bff","#ff7a59","#c6f24e","#5fd8f0","#ffae4d","#88a8ff"];function _({index:n,hue:o,pointerX:i,pointerY:r,spring:e,offsetFactor:t,scaleFactor:c,stretchFactor:l,rotateFactor:g,maxSpeed:s,visualiseOrigin:v}){const u=h.useRef(null),p=m(0),a=m(0),x=m(0),y=m(1),w=m(1),d=m(.5),b=m(.5),R=H(d,j=>`${j*100}%`),D=H(b,j=>`${j*100}%`);function O(j,A,F){const E=C(-s,s,A),M=C(-s,s,F),U=Math.min(Math.hypot(E,M),s);d.set(.5+.5*E/s),b.set(.5+.5*M/s);const k=U*c,N=(Math.abs(E)-Math.abs(M))*l,L=-j/1e3;T(p,0,{...e,velocity:E*t,delay:L}),T(a,0,{...e,velocity:M*t,delay:L}),T(x,0,{...e,velocity:E*g,delay:L}),T(y,1,{...e,velocity:k+N,delay:L}),T(w,1,{...e,velocity:k-N,delay:L})}return z(u,i,r,O),f.jsxs(P.div,{ref:u,className:"tile",style:{x:p,y:a,rotate:x,scaleX:y,scaleY:w,originX:d,originY:b,background:o},children:[f.jsx("span",{className:"tile-index",children:String(n+1).padStart(2,"0")}),v&&f.jsx(P.div,{className:"origin-dot",style:{left:R,top:D}})]})}function ce({gridSize:n=3,offsetFactor:o=.8,scaleFactor:i=8e-4,stretchFactor:r=.0015,rotateFactor:e=.03,maxSpeed:t=4e3,stiffness:c=200,damping:l=7,visualiseOrigin:g=!1}){const s=V();G(s.x,s.y),I(s.x,s.y);const v={type:"spring",stiffness:c,damping:l},u=n*n;return f.jsxs(f.Fragment,{children:[f.jsx("div",{className:"stage",children:f.jsx("div",{className:"grid",style:{gridTemplateColumns:`repeat(${n}, 1fr)`},children:Array.from({length:u},(p,a)=>f.jsx(_,{index:a,hue:$[a%$.length],pointerX:s.x,pointerY:s.y,spring:v,offsetFactor:o,scaleFactor:i,stretchFactor:r,rotateFactor:e,maxSpeed:t,visualiseOrigin:g},a))})}),f.jsx(J,{})]})}function B(n,o,i,r,e){if(o===0)return n>=i&&n<=r;let t=(i-n)/o,c=(r-n)/o;if(t>c){const l=t;t=c,c=l}return t>e.t0&&(e.t0=t),c<e.t1&&(e.t1=c),e.t0<=e.t1}function q(n,o,i,r,e){const t={t0:0,t1:1};return!B(n,i-n,e.left,e.right,t)||!B(o,r-o,e.top,e.bottom,t)?null:t.t0}function z(n,o,i,r){const e=h.useRef(r);h.useLayoutEffect(()=>{e.current=r}),h.useEffect(()=>{let t=null,c=!1,l,g;function s(){const u=n.current;u&&(t=u.getBoundingClientRect(),Y.preRender(v))}function v({delta:u}){if(!t)return;const p=o.get(),a=i.get();if(p===l&&a===g)return;l=p,g=a;const x=o.getPrevious()??p,y=i.getPrevious()??a,w=q(x,y,p,a,t);if(w!==null){if(!c){const d=u/1e3,b=d>0?(p-x)/d:0,R=d>0?(a-y)/d:0;e.current(u*(1-w),b,R)}c=!0}else c=!1}return Y.read(s,!0),()=>{X(s),X(v)}},[n,o,i])}function G(n,o){h.useEffect(()=>{let i=0,r=0;const e=()=>{n.set(i),o.set(r)},t=l=>{l.pointerType!=="mouse"&&(i=l.clientX,r=l.clientY,Y.update(e))},c=l=>{l.pointerType!=="mouse"&&(n.jump(l.clientX),o.jump(l.clientY))};return window.addEventListener("pointerdown",c),window.addEventListener("pointermove",t),()=>{window.removeEventListener("pointerdown",c),window.removeEventListener("pointermove",t),X(e)}},[n,o])}function I(n,o){h.useEffect(()=>{let i=!0;const r=t=>{t.pointerType!=="mouse"||!i||(n.jump(t.clientX),o.jump(t.clientY),i=!1)},e=t=>{t.pointerType==="mouse"&&!t.relatedTarget&&(i=!0)};return window.addEventListener("pointermove",r),document.addEventListener("pointerout",e),()=>{window.removeEventListener("pointermove",r),document.removeEventListener("pointerout",e)}},[n,o])}function J(){return f.jsx("style",{children:`
            body {
                overflow: hidden;
            }

            .stage, .stage * {
                box-sizing: border-box;
            }

            .stage {
                position: relative;
                width: 100vw;
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 48px;
                background: var(--background);
                overflow: hidden;
                /* Claim touch gestures so a finger drag fires pointermove instead
                   of scrolling or panning the page. */
                touch-action: none;
            }

            .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 18px;
            }

            .tile {
                position: relative;
                width: clamp(96px, 13vw, 148px);
                aspect-ratio: 1;
                display: flex;
                align-items: flex-end;
                justify-content: flex-start;
                padding: 12px;
                cursor: pointer;
                will-change: transform;
            }

            .tile-index {
                font-family: var(--font-mono);
                font-size: 10px;
                letter-spacing: 0.05em;
                color: var(--background);
            }

            /* Debug-only origin marker (see visualiseOrigin). */
            .origin-dot {
                position: absolute;
                width: 8px;
                height: 8px;
                margin: -4px 0 0 -4px;
                border-radius: 50%;
                background: red;
                pointer-events: none;
            }
        `})}export{ce as default};
