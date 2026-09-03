import{r as m,j as e,m as l,A as z}from"./index-Cpu3CUE2.js";import{S as L}from"./index-rMXZ8uW9.js";import{u as T}from"./use-motion-value-BdoVfRuj.js";import{u as w}from"./use-spring-DrIojgI_.js";import{u as G}from"./use-velocity-CCujPUHM.js";import{u as M}from"./use-motion-value-event-BbPoJYuS.js";import{u as O}from"./use-transform-ClPd1M5e.js";import{w as N}from"./wrap-CoT40OZP.js";import{s as I}from"./stagger-D3vWwuJr.js";import"./index-BzYMeYP3.js";import"./GroupAnimation-C01Jrkt9.js";import"./index-CUms08jJ.js";import"./get-next-text-DK-5w0f9.js";import"./index-B6qYsZmI.js";import"./follow-value-Z-kyrXkO.js";import"./transform-D8tMhbW4.js";const _=320,k=-80,P=26,y=Array.from({length:16},(t,a)=>`/photos/heritage/${a+1}.jpg`),E=["Afterglow","Drift Frame","Peripheral","Standstill","Threshold","Windowline","Reflection","Passerby","Insulation","Motion Blur","Backlight","Transit Light","Through Glass","Velocity","Crossing","Upward Light"],V="!@#$%^&*()_+-=[]{}|;:,.<>?/~`░▒▓█▀▄■□▪▫●○◆◇◈◊※†‡";function W({index:t,scrollX:a,scrollVelocity:f,isHovered:i,onHoverStart:h,onHoverEnd:c}){const o=w(0,{stiffness:400,damping:25}),n=_+k,s=n*P,p=t*n,b=w(0,{stiffness:300,damping:20,mass:.3});M(f,"change",d=>{const g=a.get(),x=p+g,r=N(-s/2,s/2,x)/(s/2),u=Math.sin(r*Math.PI*2),v=d/50*u*5;b.set(v)}),m.useEffect(()=>{o.set(i?-30:0)},[i,o]);const A=O(()=>{const d=a.get(),g=b.get(),x=o.get(),j=p+d,r=N(-s/2,s/2,j),u=r*-.35+g+x,v=r*-1.2;return`translate3d(${r}px, ${u}px, ${v}px) rotateY(-50deg)`}),S=E[t%E.length];return e.jsxs(l.div,{className:"plane",style:{transform:A,zIndex:i?100:1,filter:i?"brightness(1.15)":"brightness(1)"},onHoverStart:h,onHoverEnd:c,children:[e.jsx("div",{className:"plane-image-container",children:e.jsx("img",{src:y[t%y.length],alt:`Plane ${t}`,className:"plane-image",draggable:!1})}),e.jsx("div",{className:"plane-index",children:String(t).padStart(2,"0")}),e.jsx(z,{children:i&&e.jsxs(l.div,{className:"label-container",initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.15},children:[e.jsx(l.div,{className:"label-line",initial:{scaleX:0},animate:{scaleX:1},exit:{scaleX:0},transition:{duration:.3,ease:"easeOut"}}),e.jsx("div",{className:"label-text",children:e.jsx(L,{active:i,duration:I(.05),chars:V,children:S})})]})})]})}function ne(){const t=T(0),a=w(t,{stiffness:100,damping:30,mass:.5}),f=G(a),i=m.useRef(null),[h,c]=m.useState(null);return m.useEffect(()=>{const o=i.current;if(!o)return;const n=s=>{s.preventDefault();const p=s.deltaX!==0?s.deltaX:s.deltaY;t.set(t.get()-p)};return o.addEventListener("wheel",n,{passive:!1}),()=>o.removeEventListener("wheel",n)},[t]),e.jsxs(e.Fragment,{children:[e.jsxs(l.div,{ref:i,className:"container",onPan:(o,n)=>{t.set(t.get()+n.delta.x*2.5)},children:[e.jsxs("div",{className:"header",children:[e.jsx("div",{className:"title",children:"HERITAGE FW25/26"}),e.jsxs("div",{className:"title title-collection",children:["COLLECTION",e.jsxs("sup",{className:"title-count",children:["(",y.length,")"]})]})]}),e.jsx("div",{className:"hint",children:"scroll to surf"}),e.jsx(l.div,{className:"viewport",children:e.jsx("div",{className:"planes-container",children:Array.from({length:P},(o,n)=>e.jsx(W,{index:n,scrollX:a,scrollVelocity:f,isHovered:h===n,onHoverStart:()=>c(n),onHoverEnd:()=>c(null)},n))})})]}),e.jsx(X,{})]})}function X(){return e.jsx("style",{children:`
            @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&display=swap');

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
        `})}export{ne as default};
