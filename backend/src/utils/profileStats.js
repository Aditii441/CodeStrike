const DAY=86400000;
function dayKey(date){return new Date(new Date(date).getTime()+330*60000).toISOString().slice(0,10);}
function summarize(problems, groups, activity, recent, now=new Date()){
 const solved=new Set(groups.filter(g=>g._id.status==='accepted').map(g=>String(g._id.problemId)));
 const difficulty={}, topics={}, languages={}, verdicts={};
 for(const p of problems){for(const [map,key] of [[difficulty,p.difficulty],[topics,p.tags==='linked list'?'linkedList':p.tags]]){const v=map[key]??={total:0,solved:0};v.total++;if(solved.has(String(p._id)))v.solved++;}}
 let total=0,accepted=0,rejected=0;
 for(const g of groups){const {status,language}=g._id;total+=g.count;verdicts[status]=(verdicts[status]||0)+g.count;const lang=language==='c++'?'cpp':language;languages[lang]=(languages[lang]||0)+g.count;if(status==='accepted')accepted+=g.count;if(status==='rejected')rejected+=g.count;}
 const today=dayKey(now), end=Date.parse(today), days=new Map(activity.filter(a=>a._id<=today).map(a=>[a._id,a.count]));
 let longest=0,run=0,prev=null;for(const key of [...days.keys()].sort()){const t=Date.parse(key);run=prev!==null&&t-prev===DAY?run+1:1;longest=Math.max(longest,run);prev=t;}
 let current=0,t=end;if(!days.has(today))t-=DAY;while(days.has(new Date(t).toISOString().slice(0,10))){current++;t-=DAY;}
 return {total,accepted,acceptanceRate:accepted+rejected?Math.round(1000*accepted/(accepted+rejected))/10:null,solved:problems.filter(p=>solved.has(String(p._id))).length,libraryTotal:problems.length,difficulty,topics,languages,verdicts,currentStreak:current,longestStreak:longest,activity:Array.from({length:365},(_,i)=>{const date=new Date(end-(364-i)*DAY).toISOString().slice(0,10);return {date,count:days.get(date)||0};}),recent};
}
module.exports={summarize,dayKey};
