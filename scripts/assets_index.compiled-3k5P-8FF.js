import{m as c}from"./index-BieARX3d.js";import{aw as d,ax as o,aC as i,bA as g,bB as u,aB as r,ay as f,az as h,bu as x,bF as y,aA as k,aD as w}from"./index-Cpu3CUE2.js";import"./style-CzERqD9f.js";import"./index-BlYpciK2.js";const v={class:"container"},_={class:"skills-list"},E=d({beforeCreate(){const e=document.createElement("style");e.id="scroll-highlight-style",e.textContent=`
.container {
  padding: 300px 20px 100vh;
  display: flex;
}
.skills-title {
  font-size: 48px;
  line-height: 1;
  font-weight: 700;
  margin: 0;
  padding: 0;
  text-align: center;
  position: sticky;
  top: 100px;
  text-transform: uppercase;
  flex: 1 1 fit-content;
  transform: rotate(-90deg) translate(-36%, 50%);
  height: fit-content;
}
.skills-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.skill-li {
  list-style: none;
}
.skill-item {
  padding: 0;
  will-change: opacity;
  font-size: clamp(2rem, 8vw, 6rem);
  font-weight: 700;
  margin: 0;
  line-height: 0.9;
  text-transform: uppercase;
  text-wrap: nowrap;
}
`,document.head.appendChild(e)},unmounted(){const e=document.getElementById("scroll-highlight-style");e&&e.remove()},setup(e){const m=[{name:"Branding"},{name:"Web Design"},{name:"Marketing"},{name:"UI/UX Design"},{name:"Development"},{name:"Motion Design"}],t=w(null),p=a=>{t.value=a};return(a,s)=>(r(),o("div",v,[s[0]||(s[0]=i("h1",{class:"skills-title"},"Skills",-1)),i("ul",_,[(r(),o(g,null,u(m,(l,n)=>i("li",{key:l.name,class:"skill-li"},[f(k(c).li,{class:"skill-item",initial:!1,animate:{opacity:t.value===n?1:.3,scale:t.value===n?1.02:1},transition:{duration:.1,ease:"linear"},onViewportEnter:B=>p(n),inViewOptions:{margin:"-28% 0px -68% 0px",amount:"some"}},{default:h(()=>[x(y(l.name),1)]),_:2},1032,["animate","onViewportEnter"])])),64))])]))}});export{E as default};
