import{j as v}from"./index-BVA5IrkT.js";import{M as U,m as I}from"./index-BieARX3d.js";import{u as Q}from"./use-dom-ref-D5VyW2Sw.js";import{g as Y}from"./style-CzERqD9f.js";import{z as J,o as H,x as K,aw as D,b5 as N,aU as Z,aL as ee,aQ as W,aB as b,bv as A,az as k,aG as $,bu as te,bF as oe,aW as z,aA as x,aF as ne,aD as L,ax as O,ay as V,bA as ae,bB as re}from"./index-Cpu3CUE2.js";import{u as le}from"./use-transform-C2lGASqX.js";import{L as ie}from"./LayoutGroup-NDOGlQn4.js";import"./index-BlYpciK2.js";import"./transform-D8tMhbW4.js";import"./group-D6w-MeuU.js";var se=function(){};const[ue,de]=Y("ReorderContext");function ce(t,e){return t.layout.min-e.layout.min}function pe(t){return t.value}function fe(t,e,n,a){const o=t.findIndex(u=>u.value===e);if(o===-1)return t;const d=a!==0?a:n;if(!d)return t;const l=d>0?1:-1,s=t[o+l];if(!s)return t;const i=t[o],r=s.layout,c=K(r.min,r.max,.5);return l===1&&i.layout.max+n>c||l===-1&&i.layout.min+n<c?ge(t,o,o+l):t}function ge([...t],e,n){const a=e<0?t.length+e:e;if(a>=0&&a<t.length){const o=n<0?t.length+n:n,[d]=t.splice(e,1);t.splice(o,0,d)}return t}function j(t,e=0){return J(t)?t:H(e)}var me=D({name:"ReorderGroup",inheritAttrs:!1,__name:"Group",props:{axis:{default:"y"},"onUpdate:values":{},values:{},as:{default:"ul"},asChild:{type:Boolean},whileDrag:{},whileHover:{},whilePress:{},whileInView:{},whileFocus:{},forwardMotionProps:{type:Boolean},ignoreStrict:{type:Boolean},custom:{},initial:{type:[String,Array,Object,Boolean]},animate:{},exit:{},variants:{},inherit:{type:Boolean},style:{},transformTemplate:{},transition:{},onAnimationComplete:{},onUpdate:{},onAnimationStart:{},layout:{type:[Boolean,String]},layoutId:{},layoutScroll:{type:Boolean},layoutRoot:{type:Boolean},"data-framer-portal-id":{},crossfade:{type:Boolean},layoutDependency:{},onBeforeLayoutMeasure:{},onLayoutMeasure:{},onLayoutAnimationStart:{},onLayoutAnimationComplete:{},globalPressTarget:{type:Boolean},onPressStart:{},onPress:{},onPressCancel:{},onHoverStart:{},onHoverEnd:{},inViewOptions:{},inView:{},onViewportEnter:{},onViewportLeave:{},drag:{type:[Boolean,String]},dragSnapToOrigin:{type:Boolean},dragDirectionLock:{type:Boolean},dragPropagation:{type:Boolean},dragConstraints:{type:[Boolean,Object]},dragElastic:{type:[Boolean,Number,Object]},dragMomentum:{type:Boolean},dragTransition:{},dragListener:{type:Boolean},dragControls:{},onDragStart:{},onDragEnd:{},onDrag:{},onDirectionLock:{},onDragTransitionEnd:{},onMeasureDragConstraints:{},onPanSessionStart:{},onPanStart:{},onPan:{},onPanEnd:{},onFocus:{},onBlur:{}},setup(t){const e=t,{axis:n}=N(e);let a=[],o=!1;function d(){se(!!e.values)}Z(()=>{o=!1}),ee(()=>e.values,()=>{o||(a=[])},{flush:"pre"});const l=Q();de({groupRef:l,axis:n,registerItem:(r,c)=>{if(!e.values.includes(r))return;const u=a.findIndex(m=>r===m.value);u!==-1?a[u].layout=c[n.value]:a.push({value:r,layout:c[n.value]}),a.sort(ce)},updateOrder:(r,c,u)=>{var y;if(o)return;const m=fe(a,r,c,u);a!==m&&(o=!0,a=m,(y=e["onUpdate:values"])==null||y.call(e,m.map(pe).filter(_=>e.values.includes(_))))}});const s=W();function i(){const{axis:r,values:c,"onUpdate:values":u,...m}=e;return{...s,...m,style:{overflowAnchor:"none",...m.style}}}return(r,c)=>(b(),A(x(U),z(i(),{ref_key:"groupRef",ref:l}),{default:k(()=>[$(r.$slots,"default"),te(" "+oe(d()),1)]),_:3},16))}}),ye=me,B=50,F=25,ve=new Set(["auto","scroll"]),w=new WeakMap,S=new WeakMap,h=null;function xe(){if(h){const t=P(h,"y");t&&(S.delete(t),w.delete(t));const e=P(h,"x");e&&e!==t&&(S.delete(e),w.delete(e)),h=null}}function he(t,e){const n=getComputedStyle(t),a=e==="x"?n.overflowX:n.overflowY;return ve.has(a)}function P(t,e){let n=t==null?void 0:t.parentElement;for(;n;){if(he(n,e))return n;n=n.parentElement}return null}function be(t,e,n){const a=e.getBoundingClientRect(),o=n==="x"?a.left:a.top,d=n==="x"?a.right:a.bottom,l=t-o,s=d-t;if(l<B){const i=1-l/B;return{amount:-F*i*i,edge:"start"}}else if(s<B){const i=1-s/B;return{amount:F*i*i,edge:"end"}}return{amount:0,edge:null}}function we(t,e,n,a){if(!t)return;h=t;const o=P(t,n);if(!o)return;const{amount:d,edge:l}=be(e,o,n);if(l===null){S.delete(o),w.delete(o);return}if(S.get(o)!==l){if(!(l==="start"&&a<0||l==="end"&&a>0))return;S.set(o,l);const s=n==="x"?o.scrollWidth-o.clientWidth:o.scrollHeight-o.clientHeight;w.set(o,s)}if(d>0){const s=w.get(o);if((n==="x"?o.scrollLeft:o.scrollTop)>=s)return}n==="x"?o.scrollLeft+=d:o.scrollTop+=d}var Se=D({name:"ReorderItem",inheritAttrs:!1,__name:"Item",props:{value:{},layout:{type:[Boolean,String],default:!0},as:{default:"li"},asChild:{type:Boolean},whileDrag:{default:void 0},whileHover:{},whilePress:{},whileInView:{},whileFocus:{},forwardMotionProps:{type:Boolean},ignoreStrict:{type:Boolean},custom:{},initial:{type:[String,Array,Object,Boolean],default:void 0},animate:{default:void 0},exit:{},variants:{},inherit:{type:Boolean},style:{},transformTemplate:{},transition:{},onAnimationComplete:{},onUpdate:{},onAnimationStart:{},layoutId:{default:void 0},layoutScroll:{type:Boolean,default:!1},layoutRoot:{type:Boolean,default:!1},"data-framer-portal-id":{},crossfade:{type:Boolean,default:!0},layoutDependency:{},onBeforeLayoutMeasure:{},onLayoutMeasure:{},onLayoutAnimationStart:{},onLayoutAnimationComplete:{},globalPressTarget:{type:Boolean},onPressStart:{},onPress:{},onPressCancel:{},onHoverStart:{},onHoverEnd:{},inViewOptions:{},inView:{default:void 0},onViewportEnter:{},onViewportLeave:{},drag:{type:[Boolean,String]},dragSnapToOrigin:{type:Boolean},dragDirectionLock:{type:Boolean},dragPropagation:{type:Boolean},dragConstraints:{type:[Boolean,Object]},dragElastic:{type:[Boolean,Number,Object],default:.5},dragMomentum:{type:Boolean,default:!0},dragTransition:{},dragListener:{type:Boolean,default:!0},dragControls:{},onDragStart:{},onDragEnd:{},onDrag:{},onDirectionLock:{},onDragTransitionEnd:{},onMeasureDragConstraints:{},onPanSessionStart:{},onPanStart:{},onPan:{},onPanEnd:{},onFocus:{},onBlur:{}},setup(t){var E,T;const e=t,{style:n}=N(e),a=ue(),o={x:j((E=n.value)==null?void 0:E.x),y:j((T=n.value)==null?void 0:T.y)},d=le([o.x,o.y],([f,p])=>f||p?1:"unset"),{axis:l,registerItem:s,updateOrder:i,groupRef:r}=a,c=W();function u(){const{value:f,onDragStart:p,onDragEnd:g,onDrag:M,...C}=e;return{...c,...C,style:{...n.value,x:o.x,y:o.y,zIndex:d}}}const m=ne(()=>e.drag?e.drag:l.value),y=L(!1);function _(f,p){var R;const{velocity:g,point:M}=p,C=o[l.value].get();i(e.value,C,g[l.value]),we(r.value,M[l.value],l.value,g[l.value]),y.value||(y.value=!0),(R=e.onDrag)==null||R.call(e,f,p)}function X(f,p){var g;y.value=!1,xe(),(g=e.onDragEnd)==null||g.call(e,f,p)}function q(f,p){var g;(g=e.onDragStart)==null||g.call(e,f,p)}return(f,p)=>(b(),A(x(U),z(u(),{drag:m.value,"drag-snap-to-origin":!0,onDrag:_,onDragEnd:X,onDragStart:q,onLayoutMeasure:p[0]||(p[0]=g=>{x(s)(f.value,g)})}),{default:k(()=>[$(f.$slots,"default",{isDragging:y.value})]),_:3},16,["drag"]))}}),Be=Se;const G={Group:ye,Item:Be},De={class:"todo-container"},Ie=D({beforeCreate(){const t=document.createElement("style");t.id="todo-list-style",t.textContent=`
.todo-container {
    width: 100%;
    max-width: 340px;
    height: 280px;
    overflow: auto;
    padding: 24px;
    background-color: #ffffff;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    scrollbar-width: thin;
    scrollbar-color: #d1d5db transparent;
}
.todo-container::-webkit-scrollbar {
    width: 6px;
}
.todo-container::-webkit-scrollbar-track {
    background: transparent;
}
.todo-container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}
.todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.todo-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background-color: #f9fafb;
    border-radius: 10px;
    cursor: grab;
}
.todo-checkbox {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.2s;
}
.todo-text-wrapper {
    position: relative;
    display: inline;
}
.todo-text {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
}
.todo-strikethrough {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1.5px;
    transform-origin: left center;
    border-radius: 1px;
    pointer-events: none;
}
  `,document.head.appendChild(t)},unmounted(){const t=document.getElementById("todo-list-style");t&&t.remove()},setup(t){const e=["#ff0088","#dd00ee","#9911ff","#1e75f7","#0cdcf7","#8df0cc"],n=[{id:0,text:"Review project proposal",completed:!1,color:e[0]},{id:1,text:"Update documentation",completed:!1,color:e[1]},{id:2,text:"Schedule team meeting",completed:!1,color:e[2]},{id:3,text:"Test new features",completed:!1,color:e[3]},{id:4,text:"Deploy to staging",completed:!1,color:e[4]},{id:5,text:"Send weekly report",completed:!1,color:e[5]},{id:6,text:"Prepare presentation slides",completed:!1,color:e[0]},{id:7,text:"Review pull requests",completed:!1,color:e[1]}],a=L(n);function o(l){const s=a.value.map(r=>r.id===l?{...r,completed:!r.completed}:r),i=s.find(r=>r.id===l);a.value=s,i!=null&&i.completed&&setTimeout(()=>{const r=a.value.filter(u=>u.completed),c=a.value.filter(u=>!u.completed);a.value=[...c,...r]},600)}const d=D({props:{value:{type:Object,required:!0},onToggle:{type:Function,required:!0}},setup(l){const s=H("0 1px 2px rgba(0,0,0,0.1)"),i=L(null);return()=>{const r=l.value,{onToggle:c}=l;return v(G.Item,{value:l.value,class:"todo-item",style:{boxShadow:s},children:[v("button",{ref:i,class:"todo-checkbox",style:{borderColor:r.color,backgroundColor:r.completed?r.color:"transparent"},onClick:u=>{u.stopPropagation(),c()},onGotpointercapture:u=>{u.stopPropagation()},children:r.completed?v("svg",{width:"10",height:"8",viewBox:"0 0 12 10",fill:"none",style:{display:"block"},children:v("path",{d:"M1 5L4.5 8.5L11 1",stroke:"white","stroke-width":"2.5","stroke-linecap":"round","stroke-linejoin":"round"})}):null}),v("span",{class:"todo-text-wrapper",children:[v(I.span,{animate:{opacity:r.completed?.45:1},transition:{duration:.4},class:"todo-text",children:r.text}),v(I.span,{initial:{scaleX:0},animate:{scaleX:r.completed?1:0},transition:{duration:.4,ease:"easeOut"},class:"todo-strikethrough",style:{backgroundColor:r.color}})]})]})}}});return(l,s)=>(b(),O("div",De,[V(x(ie),null,{default:k(()=>[V(x(G).Group,{values:a.value,"onUpdate:values":s[0]||(s[0]=i=>a.value=i),axis:"y",class:"todo-list",as:"ul"},{default:k(()=>[(b(!0),O(ae,null,re(a.value,i=>(b(),A(x(d),{key:i.id,value:i,onToggle:r=>o(i.id)},null,8,["value","onToggle"]))),128))]),_:1},8,["values"])]),_:1})]))}});export{Ie as default};
