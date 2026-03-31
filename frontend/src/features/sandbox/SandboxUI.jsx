"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine, Cell, PieChart, Pie, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

const P = {
  bg:"#F5F6FA",surface:"#FFFFFF",surfaceAlt:"#EEF0F6",border:"#DFE2EC",borderLight:"#EAEDF5",
  text:"#161928",textMuted:"#555B70",textDim:"#8C93A8",
  accent:"#4361EE",accentSoft:"#4361EE14",
  success:"#0EA564",successSoft:"#0EA56412",
  warning:"#D97706",warningSoft:"#D9770612",
  danger:"#DC2626",dangerSoft:"#DC262612",
  purple:"#7C3AED",purpleSoft:"#7C3AED10",
  pink:"#DB2777",pinkSoft:"#DB277710",
  cyan:"#0891B2",cyanSoft:"#0891B210",
  orange:"#EA580C",orangeSoft:"#EA580C10",
  teal:"#0D9488",tealSoft:"#0D948810",
  slate:"#475569",
  indigo:"#4F46E5",indigoSoft:"#4F46E510",
  amber:"#D97706",
};
const Fn={d:"'Outfit','Inter',sans-serif",m:"'IBM Plex Mono',monospace",b:"'Inter',sans-serif"};
const tt={background:P.surface,border:`1px solid ${P.border}`,borderRadius:10,fontSize:11.5,boxShadow:"0 4px 20px rgba(0,0,0,0.07)"};

const ALL_CHAPTERS = [
  {id:1,title:"Baseline Capacity",sub:"Deterministic Demand",color:P.accent,icon:"📐",
    levers:["New-start allocation","Scheduling cadence","Priority rule"],
    concepts:["Little's Law","DES simulation","Queue theory","FCFS/Priority heuristics"],
    labs:["queue-flow"],
    analytics:{desc:"Waitlist size, utilization, session delivery",pred:"—",presc:"Allocation optimization"}},
  {id:2,title:"Demand Uncertainty",sub:"Stochastic & Surges",color:P.orange,icon:"🎲",
    levers:["Buffer/slack design","Demand regime selection"],
    concepts:["Poisson distribution","Moving average forecast","ARIMA (intro)","Monte Carlo"],
    labs:["poisson-sampler","buffer-sizing"],
    analytics:{desc:"Demand vs capacity gap, volatility",pred:"Short-term arrival forecast",presc:"Robust policy selection"}},
  {id:3,title:"Cancellations",sub:"Attendance & Overbooking",color:P.teal,icon:"📋",
    levers:["Overbooking level","Booking horizon","Backfill policy"],
    concepts:["Logistic regression","Multinomial outcomes","Lead-time dependence","Monte Carlo overbooking"],
    labs:["logistic-regression","overbook-monte-carlo"],
    analytics:{desc:"Cancel rates, fill rate, wasted slots",pred:"Cancel risk estimates",presc:"Overbook threshold optimization"}},
  {id:4,title:"Care Pathways",sub:"Frequency & Block Structure",color:P.purple,icon:"🛤️",
    levers:["Session frequency policy","Block structure design"],
    concepts:["Throughput modeling","Treatment intensity curves","Linear programming"],
    labs:["pathway-designer"],
    analytics:{desc:"Spacing distribution, intensity metrics",pred:"Throughput under pathway mix",presc:"Pathway optimization"}},
  {id:5,title:"Group Therapy",sub:"High-Ratio Care",color:P.pink,icon:"👥",
    levers:["Group size & frequency","Individual vs group mix","Eligibility rules"],
    concepts:["Capacity multiplier modeling","Group fill dynamics","Random forest (eligibility)"],
    labs:["group-fill-sim"],
    analytics:{desc:"Throughput gains, group fill rates",pred:"Expected sessions under fill assumptions",presc:"Robust group allocation"}},
  {id:6,title:"Clinical Notes",sub:"Clustering & Q* Policy",color:P.cyan,icon:"🧠",
    levers:["Uniform vs cluster-specific Q*","Confidence threshold","Reassessment frequency"],
    concepts:["NLP/text embeddings","K-means clustering","Trajectory modeling","LLM extraction"],
    labs:["cluster-explorer","trajectory-sim"],
    analytics:{desc:"Cluster distributions, throughput",pred:"Benefit under candidate policies",presc:"Cluster-aware vs baseline Q*"}},
  {id:7,title:"Policy Interactions",sub:"Combined Effects",color:P.amber,icon:"🔗",
    levers:["Full policy bundle configuration"],
    concepts:["Interaction effects","Monte Carlo policy comparison","Robustness analysis"],
    labs:["policy-bundle-mc"],
    analytics:{desc:"Cross-policy metrics",pred:"Performance distribution",presc:"Robust bundle selection"}},
  {id:8,title:"Equity & Aging Out",sub:"Fairness Constraints",color:P.danger,icon:"⚖️",
    levers:["Protected capacity","Min effective dose rules","Aging-out risk thresholds"],
    concepts:["Multi-objective optimization","Equity metrics","Pareto frontiers","Disparity analysis"],
    labs:["equity-frontier"],
    analytics:{desc:"Access & benefit equity dashboards",pred:"Aging-out risk projections",presc:"Multi-objective scoring"}},
];

const MOCK_STUDENTS = [
  {id:1,name:"Alex Chen",avatar:"AC",chapter:3,week:18,scores:{util:82,access:75,equity:68,retention:90},status:"playing",color:"#4361EE"},
  {id:2,name:"Maria Santos",avatar:"MS",chapter:2,week:24,scores:{util:91,access:88,equity:82,retention:95},status:"completed",color:"#0EA564"},
  {id:3,name:"James Park",avatar:"JP",chapter:3,week:12,scores:{util:65,access:55,equity:45,retention:70},status:"struggling",color:"#DC2626"},
  {id:4,name:"Priya Sharma",avatar:"PS",chapter:1,week:24,scores:{util:88,access:92,equity:85,retention:100},status:"completed",color:"#7C3AED"},
  {id:5,name:"Tom Wilson",avatar:"TW",chapter:3,week:8,scores:{util:72,access:60,equity:58,retention:85},status:"playing",color:"#D97706"},
  {id:6,name:"Aisha Okonkwo",avatar:"AO",chapter:2,week:16,scores:{util:78,access:70,equity:72,retention:80},status:"playing",color:"#0891B2"},
  {id:7,name:"Wei Zhang",avatar:"WZ",chapter:1,week:20,scores:{util:95,access:90,equity:88,retention:100},status:"completed",color:"#DB2777"},
  {id:8,name:"Sofia Lopez",avatar:"SL",chapter:2,week:6,scores:{util:55,access:40,equity:35,retention:60},status:"struggling",color:"#EA580C"},
];

const EPISODE=12,HORIZON=24;
const poisson=l=>{let L=Math.exp(-l),k=0,p=1;do{k++;p*=Math.random();}while(p>L);return k-1;};
const logisticP=(x,base,k=1.2,x0=2.5)=>base+(1-base)*(1/(1+Math.exp(-k*(x-x0))));
const ATT={good:{l:"Good",bc:.08,ns:.03,lc:.04},moderate:{l:"Moderate",bc:.14,ns:.06,lc:.08},poor:{l:"Poor",bc:.22,ns:.10,lc:.12}};
const SUB={engaged:{cm:.6,sh:.35},typical:{cm:1,sh:.4},atRisk:{cm:1.6,sh:.25}};

function mkCl(id,w,u="normal",sg="typical"){return{id,aw:w,u,sg,sc:0,st:EPISODE,s:"w",ws:w,sw:null,lw:null};}
function simWeek(st,d,ch){
  const s=JSON.parse(JSON.stringify(st));
  const{nsp,cad,pri,clin,hrs,arr:arrRate,buf=0,dem="normal",ob=0,bh=1,bf:bfOn=false,attR="moderate"}=d;
  const w=s.w+1;
  let ar;if(ch<=1)ar=arrRate;else{let lm=arrRate;if(dem==="surge"&&w>=8&&w<=14)lm*=2;if(dem==="drop"&&w>=10&&w<=16)lm=Math.max(1,lm*.4);if(dem==="volatile")lm+=Math.sin(w*.8)*2;ar=poisson(Math.max(.5,lm));}
  for(let i=0;i<ar;i++){const u=["high","normal","normal","low"][Math.floor(Math.random()*4)];const sg=ch>=3?(Math.random()<.35?"engaged":Math.random()<.72?"typical":"atRisk"):"typical";s.cl.push(mkCl(`W${w}-${i}`,w,u,sg));}
  const cap=clin*hrs,eff=Math.max(0,cap-buf);const cS=Math.floor(eff*(1-nsp)),nS=Math.floor(eff*nsp);
  const oC=ch>=3?cS+Math.floor(ob*.7):cS,oN=ch>=3?nS+Math.ceil(ob*.3):nS;
  const rg=ATT[attR]||ATT.moderate;
  function res(c){if(ch<3)return"a";const m=(SUB[c.sg]||SUB.typical).cm;const r=Math.random();if(r<rg.ns*m)return"ns";if(r<rg.ns*m+rg.lc*m)return"cl";if(r<logisticP(bh,rg.bc*m*.4))return"ce";return"a";}
  let del=0,att=0,ce=0,cl2=0,ns2=0,cs=0,nst=0;
  const act=s.cl.filter(c=>c.s==="a");const cadW=cad==="weekly"?1:2;
  for(const c of act){if(cs>=oC)break;const g=c.lw?w-c.lw:cadW;if(g>=cadW){cs++;const o=res(c);if(o==="a"){c.sc++;c.lw=w;del++;att++;if(c.sc>=c.st)c.s="c";}else if(o==="ns")ns2++;else if(o==="cl")cl2++;else ce++;}}
  let wl=s.cl.filter(c=>c.s==="w");if(pri==="urgency")wl.sort((a,b)=>({high:0,normal:1,low:2}[a.u])-({high:0,normal:1,low:2}[b.u]));else if(pri==="fairness")wl.sort((a,b)=>a.aw-b.aw);
  for(const c of wl){if(nst>=oN)break;const o=res(c);nst++;if(o==="a"){c.s="a";c.sw=w;c.lw=w;c.sc=1;del++;att++;}else{if(o==="ns")ns2++;else if(o==="cl")cl2++;else ce++;}}
  let bf=0;if(ch>=3&&bfOn){const rem=s.cl.filter(c=>c.s==="w");for(let i=0;i<Math.min(ce,rem.length);i++){rem[i].s="a";rem[i].sw=w;rem[i].lw=w;rem[i].sc=1;del++;att++;bf++;}}
  s.cl.forEach(c=>{if(c.s==="w"&&w-c.aw>12)c.s="d";});
  s.w=w;
  const sched=cs+nst,fr=sched>0?Math.round(att/sched*100):100;
  const waits=s.cl.filter(c=>c.s==="w").map(c=>w-c.ws);const aw2=waits.length?waits.reduce((a,b)=>a+b,0)/waits.length:0;
  const wbu={};["high","normal","low"].forEach(u=>{const ws=s.cl.filter(c=>c.s==="w"&&c.u===u).map(c=>w-c.ws);wbu[u]=ws.length?ws.reduce((a,b)=>a+b,0)/ws.length:0;});
  s.m.push({w,wl:s.cl.filter(c=>c.s==="w").length,ac:s.cl.filter(c=>c.s==="a").length,del,ns:nst,cs,wc:Math.max(0,cap-del),ut:cap>0?Math.round(del/cap*100):0,aw:Math.round(aw2*10)/10,mw:waits.length?Math.max(...waits):0,ct:s.cl.filter(c=>c.s==="c").length,dt:s.cl.filter(c=>c.s==="d").length,wbu,ts:cap,ar,buf,dg:ar-Math.floor(eff*nsp),att,ce,cl:cl2,nsh:ns2,fr,or:Math.max(0,del-eff),bf});
  return s;
}
const initS=()=>({cl:[],w:0,m:[]});

function Metric({label,value,unit,trend,icon}){const tc=trend>0?P.danger:trend<0?P.success:P.textDim;const ti=trend>0?"▲":trend<0?"▼":"";
  return(<div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:"12px 16px",minWidth:110}}><div style={{fontSize:9.5,color:P.textDim,textTransform:"uppercase",letterSpacing:".08em",marginBottom:5,fontFamily:Fn.m}}>{icon&&<span style={{marginRight:4}}>{icon}</span>}{label}</div><div style={{fontSize:22,fontWeight:700,color:P.text,fontFamily:Fn.d,lineHeight:1}}>{typeof value==="number"?value.toLocaleString():value}{unit&&<span style={{fontSize:10,color:P.textDim,marginLeft:2,fontWeight:400}}>{unit}</span>}</div>{trend!==undefined&&ti&&<div style={{fontSize:9,color:tc,marginTop:3,fontFamily:Fn.m}}>{ti} {Math.abs(Math.round(trend*10)/10)}</div>}</div>);}
function Slider({label,value,onChange,min,max,step=1,unit="",desc}){return(<div style={{marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:12,color:P.text,fontWeight:600}}>{label}</span><span style={{fontSize:12,fontWeight:700,color:P.accent,fontFamily:Fn.m,background:P.accentSoft,padding:"0 6px",borderRadius:4}}>{value}{unit}</span></div>{desc&&<div style={{fontSize:10,color:P.textDim,marginBottom:3}}>{desc}</div>}<input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:P.accent}}/></div>);}
function Chips({label,value,onChange,options,desc}){return(<div style={{marginBottom:14}}><span style={{fontSize:12,color:P.text,fontWeight:600,display:"block",marginBottom:2}}>{label}</span>{desc&&<div style={{fontSize:10,color:P.textDim,marginBottom:4}}>{desc}</div>}<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{options.map(o=>(<button key={o.value} onClick={()=>onChange(o.value)} style={{padding:"3px 11px",borderRadius:6,border:`1.5px solid ${value===o.value?P.accent:P.border}`,background:value===o.value?P.accentSoft:"transparent",color:value===o.value?P.accent:P.textMuted,fontSize:11,fontWeight:600,cursor:"pointer"}}>{o.label}</button>))}</div></div>);}
function Btn({children,onClick,variant="primary",disabled,small,style:sx={}}){const sz=small?{padding:"4px 12px",fontSize:11}:{padding:"7px 18px",fontSize:12};const b={...sz,fontWeight:700,borderRadius:7,cursor:disabled?"default":"pointer",border:"none",transition:"all .15s",...sx};const v={primary:{...b,background:disabled?P.border:P.accent,color:"#fff"},secondary:{...b,background:P.surfaceAlt,color:P.textMuted,border:`1px solid ${P.border}`},ghost:{...b,background:"transparent",color:P.textDim,border:`1px solid ${P.border}`},danger:{...b,background:P.dangerSoft,color:P.danger,border:`1px solid ${P.danger}30`},success:{...b,background:P.successSoft,color:P.success,border:`1px solid ${P.success}30`}};return<button onClick={onClick} disabled={disabled} style={v[variant]||v.primary}>{children}</button>;}
function Card({title,badge,children,style:sx={}}){return(<div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:14,padding:"16px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.03)",...sx}}>{(title||badge)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>{title&&<div style={{fontSize:10.5,color:P.textDim,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{title}</div>}{badge&&<span style={{fontSize:9,fontFamily:Fn.m,padding:"2px 8px",borderRadius:5,...badge}}>{badge.text}</span>}</div>}{children}</div>);}

function InstructorDashboard({config,setConfig}) {
  const [tab,setTab]=useState("chapters");

  return (
    <div>
      
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:`2px solid ${P.border}`,paddingBottom:8}}>
        {["chapters","scenarios","students","analytics"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"8px 20px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",
            background:tab===t?P.indigo:P.surfaceAlt,color:tab===t?"#fff":P.textMuted,
            fontSize:12,fontWeight:700,textTransform:"capitalize",transition:"all .15s",
          }}>{t==="chapters"?"📚 Chapters":t==="scenarios"?"🎛️ Scenarios":t==="students"?"👥 Students":"📊 Analytics"}</button>
        ))}
      </div>

      {tab==="chapters"&&<InstructorChapters config={config} setConfig={setConfig}/>}
      {tab==="scenarios"&&<InstructorScenarios config={config} setConfig={setConfig}/>}
      {tab==="students"&&<InstructorStudents config={config}/>}
      {tab==="analytics"&&<InstructorAnalytics config={config}/>}
    </div>
  );
}

function InstructorChapters({config,setConfig}) {
  const toggle=(id,field)=>{
    setConfig(c=>({...c,chapters:c.chapters.map(ch=>ch.id===id?{...ch,[field]:!ch[field]}:ch)}));
  };
  const toggleLab=(chId,lab)=>{
    setConfig(c=>({...c,chapters:c.chapters.map(ch=>ch.id===chId?{...ch,enabledLabs:ch.enabledLabs.includes(lab)?ch.enabledLabs.filter(l=>l!==lab):[...ch.enabledLabs,lab]}:ch)}));
  };

  return (
    <div>
      <div style={{fontSize:13,color:P.textMuted,marginBottom:16}}>Control which chapters, learning content, labs, and analytics are visible to students. Drag to reorder or toggle sections on/off.</div>
      <div style={{display:"grid",gap:12}}>
        {ALL_CHAPTERS.map(ch=>{
          const cfg=config.chapters.find(c=>c.id===ch.id);
          const unlocked=cfg?.unlocked;
          const showLearn=cfg?.showLearn;
          const showSim=cfg?.showSim;
          return (
            <div key={ch.id} style={{
              background:P.surface,border:`1.5px solid ${unlocked?ch.color+"40":P.border}`,borderRadius:14,padding:"16px 20px",
              opacity:unlocked?1:.55,transition:"all .2s",position:"relative",overflow:"hidden",
            }}>
              {unlocked&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:ch.color}}/>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{ch.icon}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:P.text,fontFamily:Fn.d}}>Ch {ch.id}: {ch.title}</div>
                    <div style={{fontSize:11,color:P.textDim}}>{ch.sub}</div>
                  </div>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                  <span style={{fontSize:11,fontWeight:600,color:unlocked?P.success:P.textDim}}>{unlocked?"Unlocked":"Locked"}</span>
                  <div onClick={()=>toggle(ch.id,"unlocked")} style={{width:40,height:22,borderRadius:11,background:unlocked?P.success:P.border,cursor:"pointer",position:"relative",transition:"all .2s"}}>
                    <div style={{width:18,height:18,borderRadius:9,background:"#fff",position:"absolute",top:2,left:unlocked?20:2,transition:"all .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </div>
                </label>
              </div>

              {unlocked&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:8}}>
                  
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:P.textDim,marginBottom:6,fontFamily:Fn.m}}>VISIBILITY</div>
                    {[{k:"showLearn",l:"📖 Learn Page"},{k:"showSim",l:"🎮 Simulation"},{k:"showAnalytics",l:"📊 Analytics"}].map(v=>(
                      <label key={v.k} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,cursor:"pointer",fontSize:11.5,color:P.text}}>
                        <input type="checkbox" checked={cfg?.[v.k]??true} onChange={()=>toggle(ch.id,v.k)} style={{accentColor:ch.color}}/>
                        {v.l}
                      </label>
                    ))}
                  </div>
                  
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:P.textDim,marginBottom:6,fontFamily:Fn.m}}>🧪 LABS</div>
                    {(ch.labs||[]).map(lab=>(
                      <label key={lab} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,cursor:"pointer",fontSize:11.5,color:P.text}}>
                        <input type="checkbox" checked={cfg?.enabledLabs?.includes(lab)} onChange={()=>toggleLab(ch.id,lab)} style={{accentColor:ch.color}}/>
                        {lab.replace(/-/g," ")}
                      </label>
                    ))}
                  </div>
                  
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:P.textDim,marginBottom:6,fontFamily:Fn.m}}>💡 CONCEPTS</div>
                    {ch.concepts.map(c=>(
                      <div key={c} style={{fontSize:10.5,color:P.textMuted,padding:"2px 0",display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:6,height:6,borderRadius:3,background:ch.color,opacity:.6}}/>{c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unlocked&&(
                <div style={{marginTop:10,padding:"8px 12px",background:P.surfaceAlt,borderRadius:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:P.textDim,marginBottom:4,fontFamily:Fn.m}}>ANALYTICS TIERS</div>
                  <div style={{display:"flex",gap:16,fontSize:10.5}}>
                    <span><strong style={{color:P.success}}>Desc:</strong> <span style={{color:P.textMuted}}>{ch.analytics.desc}</span></span>
                    <span><strong style={{color:P.warning}}>Pred:</strong> <span style={{color:P.textMuted}}>{ch.analytics.pred}</span></span>
                    <span><strong style={{color:P.purple}}>Presc:</strong> <span style={{color:P.textMuted}}>{ch.analytics.presc}</span></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InstructorScenarios({config,setConfig}) {
  const up=(k,v)=>setConfig(c=>({...c,scenario:{...c.scenario,[k]:v}}));
  const sc=config.scenario;
  const presets=[
    {name:"Easy Start",dem:"normal",att:"good",arr:3,desc:"Low demand, good attendance. Ideal for learning basics."},
    {name:"Stress Test",dem:"surge",att:"poor",arr:5,desc:"High demand + poor attendance. Tests resilience."},
    {name:"Real World",dem:"volatile",att:"moderate",arr:4,desc:"Unpredictable demand, typical attendance."},
    {name:"Capacity Crunch",dem:"normal",att:"moderate",arr:6,desc:"Demand exceeds comfortable capacity. Forces tradeoffs."},
  ];
  return(
    <div>
      <div style={{fontSize:13,color:P.textMuted,marginBottom:16}}>Configure the hidden parameters that drive the simulation. Students won't see these — they must discover the conditions through observation and analytics.</div>

      
      <Card title="⚡ Scenario Presets" style={{marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {presets.map(p=>(
            <button key={p.name} onClick={()=>{up("demand",p.dem);up("attendance",p.att);up("arrivals",p.arr);}} style={{
              padding:"12px",borderRadius:10,border:`1.5px solid ${sc.demand===p.dem&&sc.attendance===p.att?P.indigo:P.border}`,
              background:sc.demand===p.dem&&sc.attendance===p.att?P.indigoSoft:"transparent",
              cursor:"pointer",textAlign:"left",transition:"all .15s",
            }}>
              <div style={{fontSize:12,fontWeight:700,color:P.text}}>{p.name}</div>
              <div style={{fontSize:10,color:P.textDim,marginTop:2}}>{p.desc}</div>
              <div style={{display:"flex",gap:4,marginTop:6}}>
                <span style={{fontSize:9,fontFamily:Fn.m,padding:"1px 6px",borderRadius:4,background:P.surfaceAlt,color:P.textDim}}>{p.dem}</span>
                <span style={{fontSize:9,fontFamily:Fn.m,padding:"1px 6px",borderRadius:4,background:P.surfaceAlt,color:P.textDim}}>{p.att}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        
        <Card title="🎲 Demand Regime">
          <Chips label="Pattern" value={sc.demand} onChange={v=>up("demand",v)} options={[{value:"normal",label:"Normal"},{value:"surge",label:"Surge"},{value:"drop",label:"Drop"},{value:"volatile",label:"Volatile"}]}/>
          <Slider label="Base Arrivals/Wk" value={sc.arrivals} onChange={v=>up("arrivals",v)} min={1} max={10}/>
          <Slider label="Surge Multiplier" value={sc.surgeMult||2} onChange={v=>up("surgeMult",v)} min={1.5} max={3} step={.1} unit="×"/>
          <Slider label="Surge Window (start wk)" value={sc.surgeStart||8} onChange={v=>up("surgeStart",v)} min={4} max={16}/>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.text,fontWeight:600,cursor:"pointer"}}>
            <input type="checkbox" checked={sc.hideRegime??true} onChange={e=>up("hideRegime",e.target.checked)} style={{accentColor:P.indigo}}/>
            Hide regime from students
          </label>
        </Card>

        
        <Card title="📋 Attendance Regime">
          <Chips label="Baseline" value={sc.attendance} onChange={v=>up("attendance",v)} options={[{value:"good",label:"Good"},{value:"moderate",label:"Moderate"},{value:"poor",label:"Poor"}]}/>
          <Slider label="No-Show Override %" value={Math.round((sc.noShowRate||ATT[sc.attendance]?.ns||.06)*100)} onChange={v=>up("noShowRate",v/100)} min={1} max={15} unit="%"/>
          <Slider label="Late Cancel Override %" value={Math.round((sc.lateCancelRate||ATT[sc.attendance]?.lc||.08)*100)} onChange={v=>up("lateCancelRate",v/100)} min={2} max={20} unit="%"/>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.text,fontWeight:600,cursor:"pointer"}}>
            <input type="checkbox" checked={sc.hideAttendance??true} onChange={e=>up("hideAttendance",e.target.checked)} style={{accentColor:P.indigo}}/>
            Hide attendance regime from students
          </label>
        </Card>

        
        <Card title="🔄 Replayability">
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.text,fontWeight:600,cursor:"pointer",marginBottom:8}}>
            <input type="checkbox" checked={sc.allowReplay??true} onChange={e=>up("allowReplay",e.target.checked)} style={{accentColor:P.indigo}}/>
            Allow students to replay chapters
          </label>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.text,fontWeight:600,cursor:"pointer",marginBottom:8}}>
            <input type="checkbox" checked={sc.randomSeed??false} onChange={e=>up("randomSeed",e.target.checked)} style={{accentColor:P.indigo}}/>
            Randomize conditions each playthrough
          </label>
          <Slider label="Planning Horizon" value={sc.horizon||24} onChange={v=>up("horizon",v)} min={12} max={36} unit=" wks"/>
        </Card>

        
        <Card title="🎯 Student Guardrails">
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.text,fontWeight:600,cursor:"pointer",marginBottom:8}}>
            <input type="checkbox" checked={sc.lockParams??false} onChange={e=>up("lockParams",e.target.checked)} style={{accentColor:P.indigo}}/>
            Lock system parameters (clinicians, hours)
          </label>
          {sc.lockParams&&<>
            <Slider label="Fixed Clinicians" value={sc.fixedClin||3} onChange={v=>up("fixedClin",v)} min={1} max={8}/>
            <Slider label="Fixed Hrs/Clin" value={sc.fixedHrs||6} onChange={v=>up("fixedHrs",v)} min={2} max={10} unit="h"/>
          </>}
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:P.text,fontWeight:600,cursor:"pointer",marginBottom:8}}>
            <input type="checkbox" checked={sc.requireLearn??true} onChange={e=>up("requireLearn",e.target.checked)} style={{accentColor:P.indigo}}/>
            Require Learn page before Simulation
          </label>
        </Card>
      </div>
    </div>
  );
}

function InstructorStudents({config}) {
  const grade=v=>v>=85?"A":v>=70?"B":v>=55?"C":"D";
  const gc=g=>g==="A"?P.success:g==="B"?P.accent:g==="C"?P.warning:P.danger;
  const statusColor={playing:P.accent,completed:P.success,struggling:P.danger};

  return(
    <div>
      <div style={{fontSize:13,color:P.textMuted,marginBottom:16}}>Monitor student progress in real-time. Click a student for detailed view.</div>

      
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <Card style={{textAlign:"center"}}><div style={{fontSize:9,color:P.textDim,fontFamily:Fn.m,marginBottom:4}}>STUDENTS</div><div style={{fontSize:28,fontWeight:800,color:P.accent,fontFamily:Fn.d}}>{MOCK_STUDENTS.length}</div></Card>
        <Card style={{textAlign:"center"}}><div style={{fontSize:9,color:P.textDim,fontFamily:Fn.m,marginBottom:4}}>COMPLETED</div><div style={{fontSize:28,fontWeight:800,color:P.success,fontFamily:Fn.d}}>{MOCK_STUDENTS.filter(s=>s.status==="completed").length}</div></Card>
        <Card style={{textAlign:"center"}}><div style={{fontSize:9,color:P.textDim,fontFamily:Fn.m,marginBottom:4}}>IN PROGRESS</div><div style={{fontSize:28,fontWeight:800,color:P.accent,fontFamily:Fn.d}}>{MOCK_STUDENTS.filter(s=>s.status==="playing").length}</div></Card>
        <Card style={{textAlign:"center"}}><div style={{fontSize:9,color:P.textDim,fontFamily:Fn.m,marginBottom:4}}>STRUGGLING</div><div style={{fontSize:28,fontWeight:800,color:P.danger,fontFamily:Fn.d}}>{MOCK_STUDENTS.filter(s=>s.status==="struggling").length}</div></Card>
      </div>

      
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {MOCK_STUDENTS.map(st=>(
          <div key={st.id} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:14,padding:"14px 18px",display:"flex",gap:14,alignItems:"center"}}>
            <div style={{width:40,height:40,borderRadius:10,background:st.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:st.color,fontFamily:Fn.d,flexShrink:0}}>{st.avatar}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:P.text}}>{st.name}</div>
                <span style={{fontSize:9,fontFamily:Fn.m,padding:"2px 8px",borderRadius:5,background:statusColor[st.status]+"15",color:statusColor[st.status],fontWeight:700}}>{st.status}</span>
              </div>
              <div style={{fontSize:10.5,color:P.textDim,marginTop:2}}>Ch {st.chapter} · Week {st.week}/{HORIZON}</div>
              <div style={{display:"flex",gap:8,marginTop:6}}>
                {Object.entries(st.scores).map(([k,v])=>(
                  <div key={k} style={{textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:gc(grade(v)),fontFamily:Fn.d}}>{grade(v)}</div>
                    <div style={{fontSize:8,color:P.textDim,textTransform:"uppercase"}}>{k.slice(0,4)}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{width:50,height:50,position:"relative"}}>
              <svg width={50} height={50} viewBox="0 0 50 50">
                <circle cx={25} cy={25} r={20} fill="none" stroke={P.border} strokeWidth={4}/>
                <circle cx={25} cy={25} r={20} fill="none" stroke={st.color} strokeWidth={4} strokeDasharray={`${(st.week/HORIZON)*125.6} 125.6`} strokeLinecap="round" transform="rotate(-90 25 25)"/>
                <text x={25} y={28} textAnchor="middle" fontSize={11} fontWeight={700} fill={P.text} fontFamily={Fn.d}>{Math.round(st.week/HORIZON*100)}%</text>
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstructorAnalytics({config}) {
  const scoreData=MOCK_STUDENTS.map(s=>({name:s.avatar,...s.scores}));
  const chapterDist=[{ch:"Ch 1",count:MOCK_STUDENTS.filter(s=>s.chapter===1).length},{ch:"Ch 2",count:MOCK_STUDENTS.filter(s=>s.chapter===2).length},{ch:"Ch 3",count:MOCK_STUDENTS.filter(s=>s.chapter===3).length}];
  const avgScores={util:Math.round(MOCK_STUDENTS.reduce((a,s)=>a+s.scores.util,0)/MOCK_STUDENTS.length),access:Math.round(MOCK_STUDENTS.reduce((a,s)=>a+s.scores.access,0)/MOCK_STUDENTS.length),equity:Math.round(MOCK_STUDENTS.reduce((a,s)=>a+s.scores.equity,0)/MOCK_STUDENTS.length),retention:Math.round(MOCK_STUDENTS.reduce((a,s)=>a+s.scores.retention,0)/MOCK_STUDENTS.length)};
  const radarData=[{dim:"Utilization",avg:avgScores.util},{dim:"Access",avg:avgScores.access},{dim:"Equity",avg:avgScores.equity},{dim:"Retention",avg:avgScores.retention}];

  return(
    <div>
      <div style={{fontSize:13,color:P.textMuted,marginBottom:16}}>Class-wide performance analytics. Identify common misconceptions and areas where students struggle.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card title="📊 Class Score Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreData}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="name" stroke={P.textDim} fontSize={10}/><YAxis stroke={P.textDim} fontSize={10} domain={[0,100]}/><Tooltip contentStyle={tt}/>
              <Bar dataKey="util" name="Utilization" fill={P.accent} radius={[2,2,0,0]}/><Bar dataKey="access" name="Access" fill={P.success} radius={[2,2,0,0]}/><Bar dataKey="equity" name="Equity" fill={P.purple} radius={[2,2,0,0]}/><Bar dataKey="retention" name="Retention" fill={P.warning} radius={[2,2,0,0]}/>
              <Legend wrapperStyle={{fontSize:10}}/></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="🎯 Class Average (Radar)">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}><PolarGrid stroke={P.border}/><PolarAngleAxis dataKey="dim" fontSize={10} stroke={P.textDim}/><PolarRadiusAxis domain={[0,100]} fontSize={9} stroke={P.textDim}/>
              <Radar name="Class Avg" dataKey="avg" stroke={P.indigo} fill={P.indigo} fillOpacity={.15} strokeWidth={2}/></RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="📚 Chapter Progress Distribution">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chapterDist} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis type="number" stroke={P.textDim} fontSize={10}/><YAxis dataKey="ch" type="category" stroke={P.textDim} fontSize={10} width={40}/>
              <Tooltip contentStyle={tt}/><Bar dataKey="count" fill={P.indigo} radius={[0,4,4,0]}/></BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="⚠ Intervention Alerts">
          {MOCK_STUDENTS.filter(s=>s.status==="struggling").map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${P.borderLight}`}}>
              <div style={{width:28,height:28,borderRadius:7,background:P.dangerSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:P.danger}}>{s.avatar}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:P.text}}>{s.name}</div>
                <div style={{fontSize:10,color:P.danger}}>Low scores across all dimensions — may need guidance on Ch {s.chapter}</div>
              </div>
              <Btn small variant="danger">Message</Btn>
            </div>
          ))}
          {MOCK_STUDENTS.filter(s=>s.status==="struggling").length===0&&<div style={{fontSize:12,color:P.textDim,textAlign:"center",padding:20}}>No students flagged</div>}
        </Card>
      </div>
    </div>
  );
}

function StudentSide({config}) {
  const [page,setPage]=useState("ch1-learn");
  const chNum=+page.match(/ch(\d)/)?.[1]||1;
  const unlocked=config.chapters.filter(c=>c.unlocked).map(c=>c.id);

  return(
    <div>
      
      <div style={{display:"flex",gap:5,marginBottom:20}}>
        {ALL_CHAPTERS.map(ch=>{
          const ok=unlocked.includes(ch.id);const act=ch.id===chNum;
          return(<button key={ch.id} onClick={()=>ok&&setPage(`ch${ch.id}-learn`)} disabled={!ok} style={{
            flex:1,padding:"8px 10px",borderRadius:10,textAlign:"left",cursor:ok?"pointer":"default",
            background:act?P.surface:"transparent",border:`1.5px solid ${act?ch.color:ok?P.border:P.border+"50"}`,
            opacity:ok?1:.3,position:"relative",overflow:"hidden",boxShadow:act?`0 2px 10px ${ch.color}15`:"none",
          }}>
            {act&&<div style={{position:"absolute",top:0,left:0,right:0,height:2.5,background:ch.color}}/>}
            <div style={{fontSize:8.5,color:act?ch.color:P.textDim,textTransform:"uppercase",letterSpacing:".12em",fontFamily:Fn.m}}>{ch.icon} Ch {ch.id}</div>
            <div style={{fontSize:10.5,fontWeight:700,color:ok?P.text:P.textDim}}>{ch.title}</div>
          </button>);
        })}
      </div>

      
      {page.endsWith("-learn")&&<StudentLearn chapter={chNum} config={config} onStart={()=>setPage(`ch${chNum}-sim`)}/>}
      {page.endsWith("-sim")&&<StudentSim chapter={chNum} config={config} onBack={()=>setPage(`ch${chNum}-learn`)}/>}
    </div>
  );
}

function StudentLearn({chapter,config,onStart}) {
  const ch=ALL_CHAPTERS[chapter-1];const cfg=config.chapters.find(c=>c.id===chapter);
  if(!cfg?.showLearn)return(<div style={{textAlign:"center",padding:60}}><div style={{fontSize:28,marginBottom:8}}>🔒</div><div style={{fontSize:14,color:P.textMuted}}>Learn page is not yet available for this chapter.</div></div>);

  return(
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:10,color:ch.color,textTransform:"uppercase",letterSpacing:".2em",fontFamily:Fn.m,marginBottom:6}}>Chapter {chapter} — Learn</div>
        <h1 style={{fontSize:26,fontWeight:800,color:P.text,fontFamily:Fn.d,margin:"0 0 6px"}}>{ch.icon} {ch.title}</h1>
        <p style={{fontSize:13,color:P.textMuted,maxWidth:500,margin:"0 auto"}}>{ch.sub} — learn the concepts, play with the interactive labs, then enter the simulation.</p>
      </div>

      
      <Card title="🎮 Decisions You'll Make" style={{marginBottom:14}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ch.levers.map(l=>(<span key={l} style={{fontSize:11,padding:"4px 12px",borderRadius:7,background:ch.color+"12",color:ch.color,fontWeight:600,border:`1px solid ${ch.color}25`}}>{l}</span>))}
        </div>
      </Card>

      
      <Card title="💡 Key Concepts" style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {ch.concepts.map(c=>(<div key={c} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:P.surfaceAlt,borderRadius:7}}>
            <div style={{width:6,height:6,borderRadius:3,background:ch.color}}/><span style={{fontSize:11.5,color:P.text,fontWeight:500}}>{c}</span>
          </div>))}
        </div>
      </Card>

      
      <Card title="📊 Analytics You'll See" style={{marginBottom:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{t:"Descriptive",c:P.success,ico:"📋",d:ch.analytics.desc},{t:"Predictive",c:P.warning,ico:"🔮",d:ch.analytics.pred},{t:"Prescriptive",c:P.purple,ico:"💊",d:ch.analytics.presc}].map(a=>(
            <div key={a.t} style={{background:a.c+"08",border:`1px solid ${a.c}20`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:11,fontWeight:700,color:a.c,marginBottom:4}}>{a.ico} {a.t}</div>
              <div style={{fontSize:10.5,color:P.textMuted,lineHeight:1.5}}>{a.d}</div>
            </div>
          ))}
        </div>
      </Card>

      
      {(cfg?.enabledLabs?.length>0)&&(
        <Card title="🧪 Interactive Labs" style={{marginBottom:14}}>
          <div style={{fontSize:12,color:P.textMuted,marginBottom:12}}>Play with these sandboxes to build intuition before entering the simulation.</div>
          <div style={{display:"grid",gap:8}}>
            {cfg.enabledLabs.map(lab=>(
              <LabPreview key={lab} lab={lab} color={ch.color}/>
            ))}
          </div>
        </Card>
      )}

      
      <Card title="⚖️ Key Tradeoffs" style={{marginBottom:20}}>
        <div style={{fontSize:12.5,color:P.textMuted,lineHeight:1.7}}>
          {chapter===1&&"Over-allocating to new starts increases active caseload and destabilizes continuity. Over-allocating to continuation increases time-to-start and backlog growth."}
          {chapter===2&&"High utilization is fragile to demand surges. Conservative plans reduce risk but can underperform when demand remains normal."}
          {chapter===3&&"Overbooking recovers lost capacity but risks overruns. Shorter booking horizons reduce cancellations but limit planning flexibility."}
          {chapter>=4&&"Each policy lever interacts with others. Finding robust combinations requires experimentation across scenarios."}
        </div>
      </Card>

      <div style={{textAlign:"center",padding:"12px 0 32px"}}>
        {cfg?.showSim?
          <button onClick={onStart} style={{padding:"12px 44px",fontSize:14,fontWeight:700,fontFamily:Fn.d,background:ch.color,color:"#fff",border:"none",borderRadius:10,cursor:"pointer",boxShadow:`0 4px 18px ${ch.color}30`}}>Start Simulation →</button>
          :<div style={{fontSize:12,color:P.textDim}}>Simulation not yet available for this chapter.</div>
        }
      </div>
    </div>
  );
}

function LabPreview({lab,color}) {
  const [open,setOpen]=useState(false);
  const labInfo={
    "queue-flow":{title:"Queue Flow Simulator",desc:"Visualize how clients flow through waitlist → active → completed"},
    "poisson-sampler":{title:"Poisson Sampler",desc:"Draw random samples and watch the distribution build"},
    "buffer-sizing":{title:"Buffer Sizing Lab",desc:"Monte Carlo: find the resilience vs efficiency sweet spot"},
    "logistic-regression":{title:"Logistic Regression Lab",desc:"Build a cancellation prediction model interactively"},
    "overbook-monte-carlo":{title:"Overbooking Monte Carlo",desc:"Simulate 500 weeks to find optimal overbook level"},
    "pathway-designer":{title:"Pathway Designer",desc:"Design and compare treatment frequency policies"},
    "group-fill-sim":{title:"Group Fill Simulator",desc:"Model group therapy capacity and attendance dynamics"},
    "cluster-explorer":{title:"Cluster Explorer",desc:"Explore client trajectory archetypes and Q* policies"},
    "trajectory-sim":{title:"Trajectory Simulator",desc:"Simulate treatment outcomes under different policies"},
    "policy-bundle-mc":{title:"Policy Bundle Monte Carlo",desc:"Compare full policy bundles across scenarios"},
    "equity-frontier":{title:"Equity Frontier Explorer",desc:"Navigate Pareto frontiers of efficiency vs equity"},
  };
  const info=labInfo[lab]||{title:lab,desc:""};

  return(
    <div style={{background:color+"08",border:`1.5px solid ${color}20`,borderRadius:12,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer"}}>
        <div style={{textAlign:"left"}}>
          <div style={{fontSize:13,fontWeight:700,color:P.text}}>🧪 {info.title}</div>
          <div style={{fontSize:11,color:P.textMuted,marginTop:1}}>{info.desc}</div>
        </div>
        <span style={{fontSize:16,color,transform:open?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>
      </button>
      {open&&(
        <div style={{padding:"0 16px 16px"}}>
          {lab==="queue-flow"&&<QueueFlowMini color={color}/>}
          {lab==="poisson-sampler"&&<PoissonMini color={color}/>}
          {lab==="logistic-regression"&&<LogisticMini color={color}/>}
          {lab==="overbook-monte-carlo"&&<OverbookMini color={color}/>}
          {lab==="buffer-sizing"&&<BufferMini color={color}/>}
          {!["queue-flow","poisson-sampler","logistic-regression","overbook-monte-carlo","buffer-sizing"].includes(lab)&&
            <div style={{padding:20,textAlign:"center",color:P.textDim,fontSize:12}}>🔜 Lab coming in future chapter builds</div>}
        </div>
      )}
    </div>
  );
}

function QueueFlowMini({color}) {
  const [lam,setLam]=useState(4),[cap,setCap]=useState(18),[ns,setNs]=useState(30);
  const data=useMemo(()=>{let wl=0,ac=0,d=[];for(let w=1;w<=24;w++){wl+=lam;const n=Math.min(Math.floor(cap*ns/100),wl);wl-=n;ac+=n;const fin=w>12?Math.floor(n*.8):0;ac-=fin;d.push({w,wl:Math.max(0,wl),ac});}return d;},[lam,cap,ns]);
  return(<div>
    <div style={{display:"flex",gap:16,marginBottom:10,flexWrap:"wrap"}}>
      <div><span style={{fontSize:10.5,fontWeight:600,color:P.text}}>λ</span><input type="range" min={1} max={10} value={lam} onChange={e=>setLam(+e.target.value)} style={{width:80,accentColor:color,verticalAlign:"middle",marginLeft:6}}/><span style={{fontFamily:Fn.m,fontSize:11,color,fontWeight:700,marginLeft:4}}>{lam}</span></div>
      <div><span style={{fontSize:10.5,fontWeight:600,color:P.text}}>Cap</span><input type="range" min={6} max={30} value={cap} onChange={e=>setCap(+e.target.value)} style={{width:80,accentColor:P.purple,verticalAlign:"middle",marginLeft:6}}/><span style={{fontFamily:Fn.m,fontSize:11,color:P.purple,fontWeight:700,marginLeft:4}}>{cap}</span></div>
      <div><span style={{fontSize:10.5,fontWeight:600,color:P.text}}>New%</span><input type="range" min={10} max={60} value={ns} onChange={e=>setNs(+e.target.value)} style={{width:80,accentColor:P.teal,verticalAlign:"middle",marginLeft:6}}/><span style={{fontFamily:Fn.m,fontSize:11,color:P.teal,fontWeight:700,marginLeft:4}}>{ns}%</span></div>
      <div style={{background:P.surface,borderRadius:7,padding:"4px 10px",border:`1px solid ${P.border}`}}><span style={{fontSize:9,color:P.textDim}}>L=λW </span><span style={{fontSize:16,fontWeight:800,color,fontFamily:Fn.d}}>{lam*12}</span></div>
    </div>
    <ResponsiveContainer width="100%" height={160}><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="w" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9}/><Tooltip contentStyle={tt}/><Area type="monotone" dataKey="ac" name="Active" fill={color+"20"} stroke={color} strokeWidth={2}/><Area type="monotone" dataKey="wl" name="Waitlist" fill={P.warning+"20"} stroke={P.warning} strokeWidth={2}/><Legend wrapperStyle={{fontSize:9}}/></AreaChart></ResponsiveContainer>
    <div style={{fontSize:10,color:P.textMuted,marginTop:4,background:P.surfaceAlt,padding:"4px 8px",borderRadius:5}}>{lam*12>cap?<span style={{color:P.danger,fontWeight:700}}>⚠ L={lam*12} &gt; capacity={cap} — system unstable</span>:<span style={{color:P.success,fontWeight:700}}>✓ Stable: L={lam*12} ≤ {cap}</span>}</div>
  </div>);
}

function PoissonMini({color}) {
  const [lam,setLam]=useState(4),[samps,setSamps]=useState([]);
  const draw=()=>{const s=[];for(let i=0;i<20;i++)s.push(poisson(lam));setSamps(p=>[...p,...s]);};
  const hist=useMemo(()=>{const h={};for(let k=0;k<=12;k++)h[k]=0;samps.forEach(s=>{if(h[s]!==undefined)h[s]++;});const fac=n=>n<=1?1:n*fac(n-1);return Object.entries(h).map(([k,v])=>({k:+k,obs:samps.length?Math.round(v/samps.length*100*10)/10:0,theo:Math.round(Math.exp(-lam)*Math.pow(lam,+k)/fac(+k)*100*10)/10}));},[samps,lam]);
  return(<div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
      <span style={{fontSize:10.5,fontWeight:600,color:P.text}}>λ</span><input type="range" min={1} max={10} value={lam} onChange={e=>{setLam(+e.target.value);setSamps([]);}} style={{width:80,accentColor:color}}/><span style={{fontFamily:Fn.m,fontSize:11,color,fontWeight:700}}>{lam}</span>
      <button onClick={draw} style={{padding:"4px 12px",borderRadius:6,background:color,color:"#fff",border:"none",fontSize:11,fontWeight:700,cursor:"pointer"}}>Draw 20</button>
      <button onClick={()=>setSamps([])} style={{padding:"4px 10px",borderRadius:6,background:P.surfaceAlt,color:P.textDim,border:`1px solid ${P.border}`,fontSize:11,cursor:"pointer"}}>Clear</button>
      <span style={{fontSize:10,color:P.textDim,fontFamily:Fn.m,marginLeft:"auto"}}>n={samps.length}</span>
    </div>
    <ResponsiveContainer width="100%" height={140}><BarChart data={hist} barGap={0}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="k" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9}/><Tooltip contentStyle={tt}/><Bar dataKey="obs" name="Observed%" fill={color} radius={[2,2,0,0]} opacity={.7}/><Bar dataKey="theo" name="Theory%" fill={P.accent} radius={[2,2,0,0]} opacity={.3}/><Legend wrapperStyle={{fontSize:9}}/></BarChart></ResponsiveContainer>
    {samps.length>0&&<div style={{fontSize:10,color:P.textMuted,marginTop:4}}>Mean: <strong style={{color}}>{(samps.reduce((a,b)=>a+b,0)/samps.length).toFixed(1)}</strong> (expected {lam})</div>}
  </div>);
}

function LogisticMini({color}) {
  const [k,setK]=useState(1.2),[x0,setX0]=useState(2.5),[base,setBase]=useState(14);
  const data=useMemo(()=>{const d=[];for(let x=0;x<=5;x+=.3){d.push({x:Math.round(x*10)/10,typical:Math.round(logisticP(x,base/100)*100),atRisk:Math.round(logisticP(x,base/100*1.6)*100),engaged:Math.round(logisticP(x,base/100*.6)*100)});}return d;},[base,k,x0]);
  return(<div>
    <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap"}}>
      <div><span style={{fontSize:10,fontWeight:600,color:P.text}}>k</span><input type="range" min={.3} max={3} step={.1} value={k} onChange={e=>setK(+e.target.value)} style={{width:70,accentColor:color,verticalAlign:"middle",marginLeft:4}}/><span style={{fontFamily:Fn.m,fontSize:10,color,fontWeight:700,marginLeft:3}}>{k}</span></div>
      <div><span style={{fontSize:10,fontWeight:600,color:P.text}}>x₀</span><input type="range" min={.5} max={4.5} step={.1} value={x0} onChange={e=>setX0(+e.target.value)} style={{width:70,accentColor:P.purple,verticalAlign:"middle",marginLeft:4}}/><span style={{fontFamily:Fn.m,fontSize:10,color:P.purple,fontWeight:700,marginLeft:3}}>{x0}</span></div>
      <div><span style={{fontSize:10,fontWeight:600,color:P.text}}>Base%</span><input type="range" min={3} max={30} value={base} onChange={e=>setBase(+e.target.value)} style={{width:70,accentColor:P.danger,verticalAlign:"middle",marginLeft:4}}/><span style={{fontFamily:Fn.m,fontSize:10,color:P.danger,fontWeight:700,marginLeft:3}}>{base}%</span></div>
    </div>
    <ResponsiveContainer width="100%" height={160}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="x" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9} domain={[0,70]}/><Tooltip contentStyle={tt}/>
      <Line dataKey="engaged" name="Engaged" stroke={P.success} strokeWidth={2} dot={false}/><Line dataKey="typical" name="Typical" stroke={P.warning} strokeWidth={2} dot={false}/><Line dataKey="atRisk" name="At-Risk" stroke={P.danger} strokeWidth={2} dot={false}/><Legend wrapperStyle={{fontSize:9}}/></LineChart></ResponsiveContainer>
  </div>);
}

function OverbookMini({color}) {
  const [cap]=useState(18),[cr,setCr]=useState(15),[ob,setOb]=useState(0);
  const res=useMemo(()=>{const N=300,sc=cap+ob;let fills=0,ov=0,ts=0;for(let i=0;i<N;i++){let sh=0;for(let j=0;j<sc;j++)if(Math.random()>cr/100)sh++;ts+=sh;if(sh>=cap)fills++;if(sh>cap)ov++;}return{fill:Math.round(fills/N*100),over:Math.round(ov/N*100),avg:Math.round(ts/N*10)/10};},[cr,ob]);
  return(<div>
    <div style={{display:"flex",gap:14,marginBottom:10,flexWrap:"wrap"}}>
      <div><span style={{fontSize:10,fontWeight:600,color:P.text}}>Cancel%</span><input type="range" min={5} max={30} value={cr} onChange={e=>setCr(+e.target.value)} style={{width:80,accentColor:P.danger,verticalAlign:"middle",marginLeft:4}}/><span style={{fontFamily:Fn.m,fontSize:10,color:P.danger,fontWeight:700,marginLeft:3}}>{cr}%</span></div>
      <div><span style={{fontSize:10,fontWeight:600,color:P.text}}>Overbook</span><input type="range" min={0} max={6} value={ob} onChange={e=>setOb(+e.target.value)} style={{width:80,accentColor:color,verticalAlign:"middle",marginLeft:4}}/><span style={{fontFamily:Fn.m,fontSize:10,color,fontWeight:700,marginLeft:3}}>+{ob}</span></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
      {[{l:"Fill Rate",v:res.fill+"%",c:res.fill>=90?P.success:P.warning},{l:"Overrun Risk",v:res.over+"%",c:res.over<=5?P.success:res.over<=15?P.warning:P.danger},{l:"Avg Show",v:res.avg,c:P.accent}].map(x=>(
        <div key={x.l} style={{textAlign:"center",background:P.surfaceAlt,borderRadius:8,padding:"8px 10px"}}><div style={{fontSize:8.5,color:P.textDim,fontFamily:Fn.m}}>{x.l}</div><div style={{fontSize:20,fontWeight:800,color:x.c,fontFamily:Fn.d}}>{x.v}</div></div>
      ))}
    </div>
  </div>);
}

function BufferMini({color}) {
  const [lam,setLam]=useState(4);
  const data=useMemo(()=>{const d=[];for(let b=0;b<=5;b++){let tw=0;const N=100;for(let t=0;t<N;t++){let wl=0;for(let w=0;w<24;w++){wl=Math.max(0,wl+poisson(lam)-Math.max(0,18-b));tw+=wl;}}d.push({buf:b,avgWl:Math.round(tw/(N*24)*10)/10,util:Math.round((18-b)/18*100)});}return d;},[lam]);
  return(<div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}><span style={{fontSize:10.5,fontWeight:600,color:P.text}}>λ</span><input type="range" min={2} max={8} value={lam} onChange={e=>setLam(+e.target.value)} style={{width:80,accentColor:color}}/><span style={{fontFamily:Fn.m,fontSize:11,color,fontWeight:700}}>{lam}</span></div>
    <ResponsiveContainer width="100%" height={140}><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="buf" stroke={P.textDim} fontSize={9}/><YAxis yAxisId="l" stroke={P.textDim} fontSize={9}/><YAxis yAxisId="r" orientation="right" stroke={P.textDim} fontSize={9} domain={[50,100]}/><Tooltip contentStyle={tt}/><Bar yAxisId="l" dataKey="avgWl" name="Avg Waitlist" fill={P.warning} radius={[3,3,0,0]} opacity={.6}/><Line yAxisId="r" dataKey="util" name="Util%" stroke={P.accent} strokeWidth={2} dot={{r:3}}/><Legend wrapperStyle={{fontSize:9}}/></ComposedChart></ResponsiveContainer>
  </div>);
}

function StudentSim({chapter,config,onBack}) {
  const [sim,setSim]=useState(initS()),[auto,setAuto]=useState(false);const ref=useRef(null);
  const sc=config.scenario;const locked=sc.lockParams;
  const [nsp,setNsp]=useState(.3),[cad,setCad]=useState("weekly"),[pri,setPri]=useState("fcfs");
  const [clin,setClin]=useState(locked?sc.fixedClin||3:3),[hrs,setHrs]=useState(locked?sc.fixedHrs||6:6),[arriv]=useState(sc.arrivals||4);
  const [buf,setBuf]=useState(0),[ob,setOb]=useState(0),[bh,setBh]=useState(1),[bf,setBf]=useState(false);
  const [attReg]=useState(()=>sc.attendance||"moderate");

  const dec={nsp,cad,pri,clin,hrs,arr:arriv,buf,dem:sc.demand||"normal",ob,bh,bf,attR:attReg};
  const hz=sc.horizon||HORIZON;
  const advance=useCallback(()=>{setSim(p=>p.w>=hz?p:simWeek(p,dec,chapter));},[dec,chapter,hz]);
  const reset=()=>{setSim(initS());setAuto(false);};
  useEffect(()=>{if(auto&&sim.w<hz)ref.current=setTimeout(advance,350);else if(sim.w>=hz)setAuto(false);return()=>clearTimeout(ref.current);},[auto,sim.w,advance,hz]);

  const m=sim.m,last=m.length?m[m.length-1]:null,prev=m.length>1?m[m.length-2]:null;
  const tr=k=>prev&&last?last[k]-prev[k]:undefined;
  const chCol=ALL_CHAPTERS[chapter-1]?.color||P.accent;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={onBack} style={{background:"none",border:`1px solid ${P.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",color:P.textMuted,fontSize:11,fontWeight:600}}>← Learn</button>
          <h2 style={{fontSize:17,fontWeight:800,margin:0,fontFamily:Fn.d}}>Week {sim.w} <span style={{color:P.textDim,fontWeight:400,fontSize:11}}>/ {hz}</span></h2>
        </div>
        <div style={{display:"flex",gap:4}}><Btn small onClick={advance} disabled={sim.w>=hz}>Advance →</Btn><Btn small variant={auto?"warning":"secondary"} onClick={()=>setAuto(!auto)}>{auto?"⏸":"▶"}</Btn><Btn small variant="ghost" onClick={reset}>↺</Btn></div>
      </div>
      <div style={{height:3,background:P.surfaceAlt,borderRadius:3,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:`${(sim.w/hz)*100}%`,background:chCol,borderRadius:3,transition:"width .3s"}}/></div>

      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16}}>
        <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:12,padding:14,height:"fit-content",position:"sticky",top:16}}>
          <div style={{fontSize:9.5,color:chCol,textTransform:"uppercase",letterSpacing:".12em",fontWeight:700,marginBottom:12,fontFamily:Fn.m}}>⚙ Decisions</div>
          <Slider label="New Start %" value={Math.round(nsp*100)} onChange={v=>setNsp(v/100)} min={10} max={70} unit="%"/>
          <Chips label="Cadence" value={cad} onChange={setCad} options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Biweekly"}]}/>
          <Chips label="Priority" value={pri} onChange={setPri} options={[{value:"fcfs",label:"FCFS"},{value:"urgency",label:"Urgency"},{value:"fairness",label:"Balanced"}]}/>
          {chapter>=2&&<><div style={{borderTop:`1px solid ${P.border}`,margin:"8px 0"}}/>
            <Slider label="Buffer" value={buf} onChange={setBuf} min={0} max={6}/></>}
          {chapter>=3&&<><Slider label="Overbook" value={ob} onChange={setOb} min={0} max={5}/><Slider label="Book Horizon" value={bh} onChange={setBh} min={1} max={4} unit="wk"/>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11.5,color:P.text,fontWeight:600,cursor:"pointer",marginBottom:10}}><input type="checkbox" checked={bf} onChange={e=>setBf(e.target.checked)} style={{accentColor:P.teal}}/>Backfill</label></>}
          {!locked&&<><div style={{borderTop:`1px solid ${P.border}`,margin:"8px 0"}}/>
            <Slider label="Clinicians" value={clin} onChange={setClin} min={1} max={8}/><Slider label="Hrs/Clin" value={hrs} onChange={setHrs} min={2} max={10} unit="h"/></>}
          <div style={{marginTop:8,padding:8,background:P.surfaceAlt,borderRadius:7}}><div style={{fontSize:9,color:P.textDim,fontFamily:Fn.m}}>Eff. Capacity</div><div style={{fontSize:16,fontWeight:800,color:chCol,fontFamily:Fn.d}}>{clin*hrs-buf}{chapter>=3&&ob>0&&<span style={{color:P.teal}}> +{ob}</span>}<span style={{fontSize:9,color:P.textDim,fontWeight:400}}> /wk</span></div></div>
        </div>

        <div>
          {!m.length?(
            <div style={{textAlign:"center",padding:"50px 30px",background:P.surface,border:`1px solid ${P.border}`,borderRadius:12}}><div style={{fontSize:30,marginBottom:8}}>🏥</div><div style={{fontSize:14,fontWeight:700,color:P.text}}>Ready</div><div style={{fontSize:11.5,color:P.textMuted}}>Click "Advance" to begin.</div></div>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fit,minmax(${chapter>=3?105:120}px,1fr))`,gap:7,marginBottom:10}}>
                <Metric label="Waitlist" value={last.wl} icon="⏳" trend={tr("wl")}/><Metric label="Active" value={last.ac} icon="🔄" trend={tr("ac")}/><Metric label="Util" value={last.ut} unit="%" icon="📊"/><Metric label="Wait" value={last.aw} unit="wk" icon="⏱" trend={tr("aw")}/>
                {chapter>=3?<><Metric label="Fill" value={last.fr} unit="%" icon="📋"/><Metric label="Overrun" value={last.or} icon="⚠"/></>:<><Metric label="Done" value={last.ct} icon="✅"/><Metric label="Drop" value={last.dt} icon="⚠"/></>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                <Card title="Caseload & Waitlist"><ResponsiveContainer width="100%" height={160}><AreaChart data={m}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="w" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9}/><Tooltip contentStyle={tt}/><Area type="monotone" dataKey="ac" name="Active" fill={P.accentSoft} stroke={P.accent} strokeWidth={2}/><Area type="monotone" dataKey="wl" name="Waitlist" fill={P.warningSoft} stroke={P.warning} strokeWidth={2}/><Legend wrapperStyle={{fontSize:9}}/></AreaChart></ResponsiveContainer></Card>
                <Card title="Utilization"><ResponsiveContainer width="100%" height={160}><ComposedChart data={m}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="w" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9} domain={[0,100]}/><Tooltip contentStyle={tt}/><ReferenceLine y={85} stroke={P.success} strokeDasharray="4 4"/><Bar dataKey="ut" fill={chCol} radius={[2,2,0,0]} opacity={.8}/></ComposedChart></ResponsiveContainer></Card>
                {chapter>=3&&<Card title="Fill & Cancel Rate"><ResponsiveContainer width="100%" height={160}><ComposedChart data={m}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="w" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9} domain={[0,100]}/><Tooltip contentStyle={tt}/><Bar dataKey="fr" name="Fill%" fill={P.teal} radius={[2,2,0,0]} opacity={.7}/><Line dataKey={e=>e.att+e.ce+e.cl+e.nsh>0?Math.round((e.ce+e.cl+e.nsh)/(e.att+e.ce+e.cl+e.nsh)*100):0} name="Cancel%" stroke={P.danger} strokeWidth={2} dot={false}/><Legend wrapperStyle={{fontSize:9}}/></ComposedChart></ResponsiveContainer></Card>}
                <Card title="Wait by Urgency"><ResponsiveContainer width="100%" height={160}><LineChart data={m}><CartesianGrid strokeDasharray="3 3" stroke={P.border}/><XAxis dataKey="w" stroke={P.textDim} fontSize={9}/><YAxis stroke={P.textDim} fontSize={9}/><Tooltip contentStyle={tt}/><Line dataKey="wbu.high" name="High" stroke={P.danger} strokeWidth={2} dot={false}/><Line dataKey="wbu.normal" name="Norm" stroke={P.warning} strokeWidth={2} dot={false}/><Line dataKey="wbu.low" name="Low" stroke={P.success} strokeWidth={2} dot={false}/><Legend wrapperStyle={{fontSize:9}}/></LineChart></ResponsiveContainer></Card>
              </div>
              {sim.w>=hz&&<div style={{marginTop:12,background:P.surface,border:`1.5px solid ${chCol}30`,borderRadius:12,padding:20,textAlign:"center"}}><div style={{fontSize:22,marginBottom:4}}>🎉</div><div style={{fontSize:16,fontWeight:800,color:P.text,fontFamily:Fn.d}}>Complete!</div><div style={{display:"flex",gap:6,justifyContent:"center",marginTop:10}}><Btn small onClick={reset}>Replay</Btn><Btn small variant="ghost" onClick={onBack}>← Learn</Btn></div></div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const defaultConfig={
  chapters:ALL_CHAPTERS.map(ch=>({id:ch.id,unlocked:ch.id<=3,showLearn:true,showSim:ch.id<=3,showAnalytics:true,enabledLabs:ch.labs||[]})),
  scenario:{demand:"normal",attendance:"moderate",arrivals:4,hideRegime:true,hideAttendance:true,allowReplay:true,requireLearn:true,lockParams:false,horizon:24},
};

export default function App() {
  const [mode,setMode]=useState("instructor");
  const [config,setConfig]=useState(defaultConfig);

  return(
    <div style={{minHeight:"100vh",background:P.bg,color:P.text,fontFamily:Fn.b}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{maxWidth:1220,margin:"0 auto",padding:"16px 24px"}}>
        
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:P.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",fontWeight:800,fontFamily:Fn.d}}>CP</div>
            <div><div style={{fontSize:14,fontWeight:800,color:P.text,fontFamily:Fn.d,lineHeight:1}}>Clinical Capacity Planning</div><div style={{fontSize:9,color:P.textDim,fontFamily:Fn.m}}>Simulation Game — SLP Single Site</div></div>
          </div>
          
          <div style={{display:"flex",background:P.surfaceAlt,borderRadius:10,padding:3,border:`1px solid ${P.border}`}}>
            {[{k:"instructor",l:"🎓 Instructor",c:P.indigo},{k:"student",l:"📖 Student",c:P.accent}].map(m=>(
              <button key={m.k} onClick={()=>setMode(m.k)} style={{
                padding:"7px 20px",borderRadius:8,border:"none",cursor:"pointer",
                background:mode===m.k?m.c:"transparent",color:mode===m.k?"#fff":P.textMuted,
                fontSize:12,fontWeight:700,transition:"all .2s",
              }}>{m.l}</button>
            ))}
          </div>
        </div>

        
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{height:1,flex:1,background:P.border}}/>
          <span style={{fontSize:10,fontFamily:Fn.m,color:mode==="instructor"?P.indigo:P.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:".12em"}}>
            {mode==="instructor"?"Instructor Dashboard":"Student View"}
          </span>
          <div style={{height:1,flex:1,background:P.border}}/>
        </div>

        {mode==="instructor"?
          <InstructorDashboard config={config} setConfig={setConfig}/>:
          <StudentSide config={config}/>
        }
      </div>
    </div>
  );
}
