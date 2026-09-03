(function(root,factory){
  const rules=factory();
  if(typeof module==='object'&&module.exports)module.exports=rules;
  else root.CombatRules=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const integer=value=>Math.trunc(Number(value)||0);

  function headChance(sp=0){ return clamp(50+Number(sp||0),5,95)/100; }

  function coinProfile(skill,options={}){
    const base=(Number(skill?.base)||0)+(Number(options.basePowerModifier)||0),coins=Math.max(0,integer(skill?.coins));
    const requestedCoinPowerModifier=Number(options.coinPowerModifier)||0,conversion=skill?.mechanics?.coinPowerConversion;
    const appliedCoinPowerModifier=conversion?0:requestedCoinPowerModifier;
    const convertedFinalPower=conversion?Math.max(0,requestedCoinPowerModifier)*Number(conversion.finalPowerPerNetIncrease||0):0;
    const coinPower=(Number(skill?.plus)||0)+appliedCoinPowerModifier;
    const finalPower=(Number(options.finalPower)||0)+convertedFinalPower,clashPowerModifier=Number(options.clashPowerModifier)||0;
    const suppliedFaces=Array.isArray(options.faces)&&options.faces.length===coins?options.faces.map(face=>String(face).toUpperCase()==='H'?'H':'T'):null;
    const requestedHeads=clamp(options.heads==null?(coinPower>=0?coins:0):integer(options.heads),0,coins),faces=suppliedFaces||Array.from({length:coins},(_,index)=>index<requestedHeads?'H':'T'),heads=faces.filter(face=>face==='H').length;
    let running=base+finalPower;const coinResults=faces.map(face=>{if(face==='H')running+=coinPower;return running;});
    const rolls=Array.from({length:coins+1},(_,h)=>base+coinPower*h+finalPower),selected=coinResults.length?coinResults.at(-1):base+finalPower;
    const probability=headChance(options.sp||0);
    return {
      base,coins,coinPower,heads,faces,coinResults,finalPower,clashPowerModifier,clashSelected:selected+clashPowerModifier,requestedCoinPowerModifier,appliedCoinPowerModifier,convertedFinalPower,
      selected,min:Math.min(...rolls),max:Math.max(...rolls),
      expected:Number((base+coinPower*coins*probability+finalPower).toFixed(2)),
      headChance:probability,rolls
    };
  }

  function identitySkillLevel(identityLevel=1,skill={},deploymentBonus=0){const level=Math.max(1,integer(identityLevel)||1),defense=String(skill?.slot||'').startsWith('defense'),modifier=Number(defense?(skill?.defenseLevel??skill?.offenseLevel):skill?.offenseLevel)||0;return {identityLevel:level,skillLevel:level+modifier+(Number(deploymentBonus)||0),kind:defense?'defense':'offense'};}

  function corrosionChance(spAfter=0){const sp=Number(spAfter)||0;return sp<=-45?100:sp<=-34?75:sp<=-23?25:0;}

  function egoUseProfile(mode='ego-awakening'){
    if(mode==='ego-overclock')return {skillKind:'corrosion',resourceMultiplier:1.5,sanityMultiplier:1.5,sanityCostApplies:true,controllable:true,forced:false};
    if(mode==='ego-induced-corrosion'||mode==='ego-corrosion')return {skillKind:'corrosion',resourceMultiplier:1,sanityMultiplier:1,sanityCostApplies:true,controllable:false,forced:false};
    if(mode==='ego-forced-corrosion')return {skillKind:'corrosion',resourceMultiplier:1,sanityMultiplier:0,sanityCostApplies:false,controllable:false,forced:true};
    return {skillKind:'awakening',resourceMultiplier:1,sanityMultiplier:1,sanityCostApplies:true,controllable:true,forced:false};
  }

  function egoSanityProfile(mode='ego-awakening',spBefore=0,sanity={}){const use=egoUseProfile(mode),start=clamp(Number(spBefore)||0,-45,45),base=use.skillKind==='awakening'?Number(sanity.awakening)||0:Number(sanity.corrosion)||0,cost=use.sanityCostApplies?Math.ceil(base*use.sanityMultiplier):0,after=use.forced?-45:clamp(start-cost,-45,45),chance=corrosionChance(after),valid=mode==='ego-forced-corrosion'?start<=-45:mode==='ego-induced-corrosion'||mode==='ego-corrosion'?chance>0:true;return {spBefore:start,cost,spAfter:after,corrosionChance:chance,valid};}

  function attackWeightProfile(skill,options={}){
    const base=Math.max(1,integer(skill?.attackWeight)||1),modifier=integer(options.modifier);
    const effective=Math.max(1,base+modifier),targetCount=clamp(integer(options.targetCount||effective),1,effective);
    return {base,modifier,effective,targetCount,excess:Math.max(0,effective-targetCount)};
  }

  function clashLevelAdvantage(levelDifference=0){
    const difference=integer(levelDifference),bonus=Math.floor(Math.abs(difference)/3);
    return {difference,side:difference>=3?'self':difference<=-3?'enemy':'none',bonus};
  }

  function resonanceProfile(affinities=[]){ 
    const sequence=affinities.map(x=>x||'None');
    const counts={},absoluteTotals={},longest={};
    sequence.filter(s=>s!=='None').forEach(s=>counts[s]=(counts[s]||0)+1);
    for(let i=0;i<sequence.length;){
      let j=i+1;while(j<sequence.length&&sequence[j]===sequence[i])j++;
      const length=j-i,affinity=sequence[i];
      if(affinity!=='None'){
        longest[affinity]=Math.max(longest[affinity]||0,length);
        if(length>=3)absoluteTotals[affinity]=(absoluteTotals[affinity]||0)+length;
      }
      i=j;
    }
    return {sequence,counts,longest,absoluteTotals};
  }

  function evaluateSpecial(skill,resonance){
    const special=skill?.mechanics?.special;if(!special)return null;
    if(special.type==='resonance-counter'){
      const actual=resonance.absoluteTotals[special.affinity]||0;
      const thresholds=(special.thresholds?.length?special.thresholds:[{threshold:special.threshold,replacementSkill:special.replacementSkill}]).sort((a,b)=>a.threshold-b.threshold);
      const active=[...thresholds].reverse().find(rule=>actual>=rule.threshold),next=thresholds.find(rule=>actual<rule.threshold);
      const shown=active||next||thresholds[0];
      return {...special,...shown,actual,triggered:!!active,activeRule:active||null,nextRule:next||null};
    }
    return {...special,triggered:false};
  }

  function applyStateText(state={},text=''){
    String(text).split(/[,，;；\n]/).map(v=>v.trim()).filter(Boolean).forEach(token=>{const match=token.match(/^(.+?)\s*(=|\+|-)\s*(\d+(?:\.\d+)?)$/);if(!match)return;const key=match[1].trim(),value=Number(match[3]);state[key]=match[2]==='='?value:Math.max(0,(Number(state[key])||0)+(match[2]==='+'?value:-value));});return state;
  }
  function customStateLedger(initialText='',turns=[]){const state=applyStateText({},initialText),snapshots=[];for(const turn of turns){applyStateText(state,turn.stateChanges);snapshots.push({...state});}return snapshots;}

  function resourceLedger(initial={},turns=[],sins=['Wrath','Lust','Sloth','Gluttony','Gloom','Pride','Envy']){
    const blank=()=>Object.fromEntries(sins.map(s=>[s,0]));
    const resources=Object.fromEntries(sins.map(s=>[s,Math.max(0,Number(initial[s])||0)])),deltas=[],warnings=[];
    for(const turn of turns){
      const delta=blank(),costs=blank(),turnWarnings=[];
      for(const action of turn.actions||[]){if(action.executed===false||action.kind!=='ego'||action.freeCost===true)continue;for(const item of action.costs||[])costs[item.affinity]+=Math.ceil((Number(item.cost)||0)*(Number(action.resourceMultiplier)||(action.overclock?1.5:1)));}
      for(const sin of sins){if(costs[sin]>resources[sin])turnWarnings.push({affinity:sin,shortage:costs[sin]-resources[sin]});resources[sin]-=costs[sin];delta[sin]-=costs[sin];}
      for(const action of turn.actions||[]){if(action.executed===false||action.kind!=='ego'||!action.vaporizeHighest)continue;const eligible=sins.filter(sin=>resources[sin]>1).sort((a,b)=>resources[b]-resources[a]||sins.indexOf(a)-sins.indexOf(b)).slice(0,Math.max(0,integer(action.vaporizeHighest)));for(const sin of eligible){resources[sin]--;delta[sin]--;}}
      for(const action of turn.actions||[]){if(action.executed===false)continue;if(action.kind==='skill'&&sins.includes(action.affinity)){resources[action.affinity]++;delta[action.affinity]++;}if(sins.includes(action.affinity)&&action.bonusResourceOnKill>0){const gain=integer(action.bonusResourceOnKill);resources[action.affinity]+=gain;delta[action.affinity]+=gain;}}
      for(const sin of sins){const gain=Math.max(0,integer(turn.resourceDelta?.[sin]));resources[sin]+=gain;delta[sin]+=gain;}
      deltas.push(delta);warnings.push(turnWarnings);
    }
    return {resources,deltas,warnings};
  }

  function journeyResourceLedger(initial={},turns=[],sectionCount=1,sins=['Wrath','Lust','Sloth','Gluttony','Gloom','Pride','Envy']){
    let resources=Object.fromEntries(sins.map(s=>[s,Math.max(0,Number(initial[s])||0)]));
    const deltas=Array(turns.length),warnings=Array(turns.length),sections=[];
    for(let section=1;section<=Math.max(1,integer(sectionCount));section++){
      const entry={...resources},indices=turns.map((turn,index)=>({turn,index})).filter(item=>(Number(item.turn.section)||1)===section);
      for(const {turn,index} of indices){const result=resourceLedger(resources,[turn],sins);resources=result.resources;deltas[index]=result.deltas[0];warnings[index]=result.warnings[0];}
      sections.push({section,entry,exit:{...resources}});
    }
    const blank=()=>Object.fromEntries(sins.map(s=>[s,0]));
    return {resources,deltas:deltas.map(value=>value||blank()),warnings:warnings.map(value=>value||[]),sections};
  }

  function resolveStatus({kind,potency=0,count=0,events=0,turnEnds=0,target='abnormality'}={}){
    potency=Math.max(0,integer(potency));count=Math.max(0,integer(count));events=Math.max(0,integer(events));turnEnds=Math.max(0,integer(turnEnds));
    let triggers=0,damage=0,spLoss=0,staggerRaised=0,remainingCount=count;
    if(kind==='Burn'){
      triggers=Math.min(count,turnEnds);damage=potency*triggers;remainingCount=Math.max(0,count-turnEnds);
    }else if(kind==='Bleed'||kind==='Rupture'){
      triggers=Math.min(count,events);damage=potency*triggers;remainingCount=Math.max(0,count-events);
    }else if(kind==='Sinking'){
      triggers=Math.min(count,events);remainingCount=Math.max(0,count-events);
      if(target==='abnormality')damage=potency*triggers;else spLoss=potency*triggers;
    }else if(kind==='Tremor'){
      triggers=events;staggerRaised=potency*events;remainingCount=Math.max(0,count-turnEnds);
    }
    return {kind,potency,count,triggers,damage,spLoss,staggerRaised,remainingCount,removed:remainingCount===0};
  }

  const MECHANIC_CN={
    'absolute-resonance':'完全共鸣','resonance':'共鸣','counter':'反击','unbreakable-coin':'不可破坏硬币',
    'coin-reuse':'硬币复用','coin-power':'条件硬币威力','coin-power-conversion':'硬币威力转最终威力','final-power':'条件最终威力','clash-power':'条件拼点威力',
    'attack-weight':'攻击权重变化','multi-target':'广域/多目标','unfocused-volley':'广域乱射','skill-replacement':'技能替换',
    'random-weapon':'随机武器','assist-extra-attack':'追加/协同攻击','clashable-defense':'可拼点防御','conditional':'条件效果'
  };
  const STATUS_CN={Burn:'烧伤',Bleed:'流血',Tremor:'震颤',Rupture:'破裂',Sinking:'沉沦'};
  return {clamp,headChance,coinProfile,identitySkillLevel,corrosionChance,egoUseProfile,egoSanityProfile,attackWeightProfile,clashLevelAdvantage,resonanceProfile,evaluateSpecial,applyStateText,customStateLedger,resourceLedger,journeyResourceLedger,resolveStatus,MECHANIC_CN,STATUS_CN};
});
