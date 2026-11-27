// Deterministic ranking; scores are heuristics, not measured mastery.
function recommend(problems, groups, limit=4){
 const stats=new Map(), topics=new Map();
 for(const g of groups){const id=String(g._id.problemId);const s=stats.get(id)||{accepted:0,rejected:0};if(g._id.status==='accepted'||g._id.status==='rejected')s[g._id.status]+=g.count;stats.set(id,s);}
 const tag=p=>p.tags==='linked list'?'linkedList':p.tags;
 let solved=0;
 for(const p of problems){const t=topics.get(tag(p))||{accepted:0,rejected:0};const s=stats.get(String(p._id));if(s){t.accepted+=s.accepted;t.rejected+=s.rejected;if(s.accepted)solved++;}topics.set(tag(p),t);}
 return problems.filter(p=>!stats.get(String(p._id))?.accepted).map(p=>{const s=stats.get(String(p._id))||{rejected:0};const t=topics.get(tag(p));const attempts=t.accepted+t.rejected;const weakness=attempts?t.rejected/attempts:0.5;const fit=p.difficulty==='easy'?(solved<3?1:.65):p.difficulty==='medium'?(solved>=3?1:.3):(solved>=7?.8:.05);const score=35*weakness+35*fit+20*Math.min(s.rejected/3,1)+10*(attempts===0?1:0);return {id:String(p._id),title:p.title,difficulty:p.difficulty,tags:tag(p),score:Math.round(score*10)/10,reason:s.rejected?'Revisit an unsuccessful attempt':attempts&&weakness>=.5?'Practice a challenging topic':!attempts?'Explore a new topic':'Continue your difficulty progression'};}).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,limit);
}
module.exports={recommend};
