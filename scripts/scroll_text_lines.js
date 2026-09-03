import{a as d}from"./index-kq-DtHSs.js";import{u as s}from"./use-transform-C2lGASqX.js";import{u as x}from"./use-scroll-Dvd3xWZS.js";import{aw as u,ax as n,aC as i,bA as f,bB as h,aB as c,ay as v,az as y,bF as l,bC as _,aA as w}from"./index-Cpu3CUE2.js";import"./index-BieARX3d.js";import"./style-CzERqD9f.js";import"./index-BlYpciK2.js";import"./use-animation-frame-DsfOAyGt.js";import"./use-dom-ref-D5VyW2Sw.js";import"./LayoutGroup-NDOGlQn4.js";import"./group-D6w-MeuU.js";import"./use-reduced-motion-rsVjQCtu.js";import"./wrap-CoT40OZP.js";import"./index-BzYMeYP3.js";import"./GroupAnimation-C01Jrkt9.js";import"./transform-D8tMhbW4.js";import"./index-B1x_LoqU.js";const g={id:"example"},k={class:"text-section"},C={class:"text-solid impact"},b={class:"text-outline impact"},J=u({beforeCreate(){const t=document.createElement("style");t.id="scroll-text-lines-style",t.textContent=`
#example {
    width: 100%;
    overflow: hidden;
}
.intro,
.outro {
    height: 50vh;
    display: flex;
    justify-content: center;
    align-items: center;
}
.intro p,
.outro p {
    font-size: 18px;
    color: var(--white);
    opacity: 0.5;
}
.text-section {
    padding: 20vh 0 200vh;
    display: flex;
    flex-direction: column;
    width: 100%;
}
.ticker-line span {
    font-size: clamp(48px, 12vw, 120px);
    text-transform: uppercase;
    padding: 0 20px;
}
.text-solid {
    color: var(--white);
}
.text-outline {
    color: transparent;
    -webkit-text-stroke: 2px var(--white);
    opacity: 0.4;
}
@media (max-width: 600px) {
.text-outline {
        -webkit-text-stroke: 1px var(--white);
}
}
@media (prefers-reduced-motion: reduce) {
.ticker-line {
        animation: none !important;
}
}
`,document.head.appendChild(t)},unmounted(){const t=document.getElementById("scroll-text-lines-style");t&&t.remove()},setup(t){const p=[{text:"Creative",reverse:!1},{text:"Design",reverse:!0},{text:"Motion",reverse:!1},{text:"Studio",reverse:!0}],e=[.5,-.7,.6,-.8],{scrollY:o}=x(),m=[s(()=>o.get()*e[0]),s(()=>o.get()*e[1]),s(()=>o.get()*e[2]),s(()=>o.get()*e[3])];return(B,z)=>(c(),n("div",g,[i("section",k,[(c(),n(f,null,h(p,(r,a)=>v(w(d),{key:r.text,class:_(["ticker-line",`ticker-${a}`]),offset:m[a]},{default:y(()=>[i("span",C,l(r.text),1),i("span",b,l(r.text),1)]),_:2},1032,["class","offset"])),64))])]))}});export{J as default};
