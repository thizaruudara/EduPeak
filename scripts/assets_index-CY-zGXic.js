import{r as l,j as e,m as f}from"./index-Cpu3CUE2.js";import{u as w}from"./use-scroll-Cb3Gbdrw.js";import{u as b}from"./use-motion-template-amv-RbC3.js";import{u as a}from"./use-transform-ClPd1M5e.js";import"./index-B1x_LoqU.js";import"./use-motion-value-BdoVfRuj.js";import"./transform-D8tMhbW4.js";function M(){const n=l.useRef(null),s=l.useRef(null),[r,d]=l.useState(.35);l.useLayoutEffect(()=>{const o=s.current;if(!o)return;const t=()=>{const y=o.offsetHeight,u=window.innerHeight||1;d(Math.min(.95,Math.max(.05,y/u)))};t();const c=new ResizeObserver(t);return c.observe(o),window.addEventListener("resize",t),()=>{c.disconnect(),window.removeEventListener("resize",t)}},[]);const{scrollYProgress:i}=w({target:n,offset:["end end","end start"]}),p=a(i,[0,r],[0,1]),v=a(i,[0,r],[.9,1]),x=a(i,[0,r],[6,0]),h=b`blur(${x}px)`,m=a(i,o=>o>1e-4&&o<r?"opacity":"auto"),g=a(i,o=>o>1e-4&&o<r?"transform, filter":"auto");return e.jsxs("div",{id:"example",className:"velocity-footer-reveal",children:[e.jsx("main",{ref:n,className:"content",children:e.jsx("div",{className:"dossier",children:e.jsxs("div",{className:"dossier-inner",children:[e.jsx("p",{className:"kicker",children:"Footer reveal"}),e.jsx("p",{className:"prompt",children:"Scroll down"})]})})}),e.jsx("footer",{ref:s,className:"reveal-footer",children:e.jsx(f.div,{className:"footer-fade",style:{opacity:p,willChange:m},children:e.jsx(f.div,{className:"footer-scale",style:{scale:v,filter:h,transformOrigin:"50% 100%",willChange:g},children:e.jsxs("div",{className:"footer-inner",children:[e.jsxs("div",{className:"footer-brand",children:[e.jsx("span",{className:"velocity-wordmark",children:"Velocity"}),e.jsx("p",{children:"Trace each session to the step that breaks, without another dashboard nobody opens."})]}),e.jsx("div",{className:"footer-cols",children:k.map(o=>e.jsxs("div",{className:"footer-col",children:[e.jsx("h3",{children:o.title}),e.jsx("ul",{children:o.links.map(t=>e.jsx("li",{children:e.jsx("a",{href:"#",children:t})},t))})]},o.title))}),e.jsxs("div",{className:"footer-legal",children:[e.jsx("span",{children:"© 2026 Velocity Analytics, Inc. All rights reserved."}),e.jsx("ul",{children:j.map(o=>e.jsx("li",{children:e.jsx("a",{href:"#",children:o})},o))})]})]})})})}),e.jsx(z,{})]})}const k=[{title:"Product",links:["Funnels","Retention alerts","Cohorts","Session replay"]},{title:"Developers",links:["Docs","API reference","SDKs","Changelog"]},{title:"Company",links:["About","Careers","Customers","Blog"]}],j=["Privacy","Terms","Security"];function z(){return e.jsx("style",{children:`
            /* Classic / stable scrollbar gutters paint the page background beside
               the footer. Against a light footer that reads as a side gap, so
               hide the gutter for this full-bleed reveal. Scroll still works. */
            html:has(#example.velocity-footer-reveal) {
                scrollbar-width: none;
            }

            html:has(#example.velocity-footer-reveal)::-webkit-scrollbar {
                display: none;
                width: 0;
                height: 0;
            }

            #example.velocity-footer-reveal {
                --footer-field: oklch(0.68 0.18 255);
                --footer-ink: oklch(0.145 0.01 148);
                --footer-ink-feint: color-mix(in srgb, var(--footer-ink) 62%, transparent);
                --footer-rule: color-mix(in srgb, var(--footer-ink) 18%, transparent);

                position: relative;
                isolation: isolate;
                width: 100%;
                max-width: 100%;
                height: auto;
                overflow-x: clip;
                overflow-y: visible;
                color: var(--white);
                background: var(--background);
            }

            .velocity-footer-reveal .content {
                position: relative;
                z-index: 1;
                min-height: 100dvh;
                width: 100%;
                max-width: 100%;
                overflow-x: clip;
                background: var(--background);
            }

            .velocity-footer-reveal .dossier {
                box-sizing: border-box;
                min-height: 100dvh;
                width: 100%;
                max-width: 100%;
                padding: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: repeating-linear-gradient(
                    119deg,
                    color-mix(in srgb, var(--white) 12%, transparent) 0 1px,
                    transparent 1px 7px
                );
            }

            /* Layout only: no panel. Labels carry the page bg as tape over
               the dossier stripes. */
            .velocity-footer-reveal .dossier-inner {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                text-align: center;
            }

            .velocity-footer-reveal .kicker {
                margin: 0;
                padding: 6px 10px;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 560;
                letter-spacing: 0.11em;
                text-transform: uppercase;
                color: var(--footer-field);
                background: var(--background);
            }

            .velocity-footer-reveal .prompt {
                margin: 0;
                padding: 8px 14px;
                font-size: clamp(36px, 5.5vw, 56px);
                font-variation-settings: "wght" 720, "opsz" 60;
                letter-spacing: -0.045em;
                line-height: 1;
                text-wrap: balance;
                color: var(--white);
                background: var(--background);
            }

            .velocity-footer-reveal .reveal-footer {
                position: sticky;
                bottom: 0;
                z-index: -1;
                width: 100%;
                max-width: 100%;
                margin: 0;
                padding: 0;
                overflow-x: clip;
                background: none;
            }

            .velocity-footer-reveal .footer-fade {
                width: 100%;
                max-width: 100%;
                overflow-x: clip;
                background: var(--footer-field);
                color: var(--footer-ink);
            }

            .velocity-footer-reveal .footer-scale {
                width: 100%;
                max-width: 100%;
            }

            .velocity-footer-reveal .footer-inner {
                box-sizing: border-box;
                width: 100%;
                max-width: 1080px;
                margin: 0 auto;
                padding: 72px 28px 48px;
                display: flex;
                flex-direction: column;
                gap: 48px;
            }

            .velocity-footer-reveal .footer-brand {
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-width: 28ch;
                padding-bottom: 40px;
                border-bottom: 1px solid var(--footer-rule);
            }

            /* Match house .logo-text / .velocity-wordmark header recipe. */
            .velocity-footer-reveal .velocity-wordmark {
                font-family: var(--font-sans);
                font-size: 16px;
                font-variation-settings: "wght" 650, "opsz" 80;
                letter-spacing: -0.03em;
                line-height: 1;
                color: var(--footer-ink);
            }

            .velocity-footer-reveal .footer-brand p {
                margin: 0;
                text-wrap: pretty;
                color: var(--footer-ink-feint);
                line-height: 1.45;
                font-size: 16px;
                font-weight: 500;
            }

            .velocity-footer-reveal .footer-cols {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 32px;
                width: 100%;
                padding-bottom: 40px;
                border-bottom: 1px solid var(--footer-rule);
            }

            .velocity-footer-reveal .footer-col {
                display: flex;
                flex-direction: column;
                gap: 14px;
                min-width: 0;
            }

            .velocity-footer-reveal .footer-col h3 {
                margin: 0;
                font-family: var(--font-mono);
                font-size: 11px;
                font-weight: 560;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--footer-ink-feint);
            }

            .velocity-footer-reveal .footer-col ul,
            .velocity-footer-reveal .footer-legal ul {
                margin: 0;
                padding: 0;
                list-style: none;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .velocity-footer-reveal .footer-col a,
            .velocity-footer-reveal .footer-legal a {
                color: var(--footer-ink);
                text-decoration: none;
                font-size: 15px;
                font-weight: 560;
            }

            .velocity-footer-reveal .footer-col a:hover,
            .velocity-footer-reveal .footer-legal a:hover {
                color: color-mix(in srgb, var(--footer-ink) 70%, white);
            }

            .velocity-footer-reveal .footer-legal {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 12px 24px;
                font-family: var(--font-mono);
                font-size: 11px;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                color: var(--footer-ink-feint);
            }

            .velocity-footer-reveal .footer-legal a {
                font-family: var(--font-mono);
                font-size: 11px;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                font-weight: 560;
            }

            .velocity-footer-reveal .footer-legal ul {
                flex-direction: row;
                flex-wrap: wrap;
                gap: 8px 24px;
            }

            @media (max-width: 640px) {
                .velocity-footer-reveal .footer-cols {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .velocity-footer-reveal .dossier-inner {
                    padding: 40px 28px;
                }

                .velocity-footer-reveal .footer-inner {
                    padding: 56px 20px 40px;
                    gap: 36px;
                }
            }
        `})}export{M as default};
