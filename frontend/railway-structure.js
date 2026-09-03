(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RailwayStructure=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function isContinuous(line){return line?.battleFormat==='continuous-sections';}

  function sectionEncounters(line){
    if(!isContinuous(line))return [];
    return Array.from({length:Number(line.sectionCount)||0},(_,index)=>{
      const section=index+1;
      const stations=(line.stations||[]).filter(station=>station.type!=='休息'&&station.section===section);
      const lastNo=Math.max(0,...stations.map(station=>station.no));
      const next=(line.stations||[]).find(station=>station.type!=='休息'&&station.section===section+1);
      const restStop=(line.stations||[]).find(station=>station.type==='休息'&&station.no>lastNo&&(!next||station.no<next.no))||null;
      return {section,stations,restStop};
    });
  }

  function libraryItems(line){
    return isContinuous(line)
      ? sectionEncounters(line).map(encounter=>({kind:'section',...encounter}))
      : (line?.stations||[]).map(station=>({kind:'station',station}));
  }

  function editorTargets(line){
    if(isContinuous(line))return [];
    return (line?.stations||[]).map(station=>({
      value:`${station.no}. ${station.name}`,
      label:`${station.no}. ${station.name} — ${station.boss}`
    }));
  }

  function transitionRule(line,toSection){return (line?.sectionTransitions||[]).find(rule=>rule.toSection===toSection)||null;}
  function restrictionRule(line,section){return (line?.deploymentRules?.restrictions||[]).find(rule=>rule.section===section)||null;}
  function transitionText(line,toSection){
    const rule=transitionRule(line,toSection);if(!rule)return '';
    const state=rule.hpSpSource==='section-1-clear'?'HP 百分比与 SP 读取第一区结束状态':'复活并回满 HP，SP 归零';
    return `七罪资源继续继承；${state}${rule.canChangeTeam?'；可重新选择人格与 E.G.O':''}`;
  }
  const EGO_RISKS=['ZAYIN','TETH','HE','WAW','ALEPH'];
  function frontlineForDeployment(line,deployment=[]){return deployment.filter(Boolean).slice(0,Number(line?.deploymentRules?.frontline)||deployment.length);}
  function rosterTimeline(deployment=[],frontlineSize=deployment.length,turns=[]){
    const ordered=deployment.filter(Boolean),dead=new Set(),active=ordered.slice(0,frontlineSize),backup=ordered.slice(frontlineSize),timeline=[];
    for(const turn of turns){
      const entry=[...active],deaths=[...new Set(turn.deaths||[])].filter(member=>active.includes(member)),substitutions=[];
      for(const member of deaths){dead.add(member);active.splice(active.indexOf(member),1);}
      while(active.length<frontlineSize&&backup.length){const member=backup.shift();if(dead.has(member))continue;active.push(member);substitutions.push(member);}
      timeline.push({entry,deaths,substitutions,exit:[...active],backup:[...backup]});
    }
    return timeline;
  }
  function deathResourceDelta(identity,sins=['Wrath','Lust','Sloth','Gluttony','Gloom','Pride','Envy']){const delta=Object.fromEntries(sins.map(sin=>[sin,0]));for(let number=1;number<=3;number++){const skill=(identity?.skills||[]).find(item=>item.slot===`skill${number}`);if(skill&&sins.includes(skill.affinity))delta[skill.affinity]+=number;}return delta;}
  function isEgoEquipped(loadouts={},section,sinner,egoId,egoById={}){
    const ego=egoById[String(egoId)]||egoById[egoId];if(!ego||Number(ego.sinner)!==Number(sinner))return false;
    const sectionLoadout=loadouts[section]||loadouts[String(section)]||{},sinnerLoadout=sectionLoadout[sinner]||sectionLoadout[String(sinner)]||{};
    return String(sinnerLoadout[ego.rarity]||'')===String(egoId);
  }
  function line4EntrySp(buff={},identity={},baseSp=0){const minusCoin=(identity?.skills||[]).filter(skill=>/^skill[123]$/.test(skill.slot||'')).some(skill=>Number(skill.plus)<0),bonus=(Number(buff.entrySp)||0)*(minusCoin?-1:1);return Math.min(45,Math.max(-45,(Number(baseSp)||0)+bonus));}
  function deploymentLevelBonus(buff={},skill={}){return (Number(buff.level)||0)+(String(skill.slot||'').startsWith('defense')?(Number(buff.defenseLevel)||0):(Number(buff.offenseLevel)||0));}
  function line5AllowedOptions(line,station){
    const pool=line?.recordRules?.stationPools?.[station]||line?.recordRules?.stationPools?.[String(station)]||{};
    return {buffs:[...(pool.buffs||[])],trials:[...(pool.trials||[])]};
  }
  function validateLine5Choices(line,choices={}){
    if(line?.recordRules?.type!=='buff-trials')return [];
    const errors=[],usedBuffs=new Map();
    for(const station of line.recordRules.stations||[]){
      const choice=choices[station]||choices[String(station)]||{},allowed=line5AllowedOptions(line,station);
      if(!allowed.buffs.includes(choice.buff))errors.push({station,type:'invalid-buff',message:`站点 ${station} 的增益不在可选池中`});
      if(!allowed.trials.includes(choice.trial))errors.push({station,type:'invalid-trial',message:`站点 ${station} 的苦难不在可选池中`});
      if(choice.buff){if(usedBuffs.has(choice.buff))errors.push({station,type:'duplicate-buff',message:`增益“${choice.buff}”已在站点 ${usedBuffs.get(choice.buff)} 选择`});else usedBuffs.set(choice.buff,station);}
    }
    return errors;
  }
  function validateLine5TurnStations(line,turns=[]){
    if(line?.id!==5)return [];
    const errors=[],expected=(line.stations||[]).filter(station=>station.type!=='休息'),seen=new Set();let previous=0;
    for(const [index,turn] of turns.entries()){
      const station=Number(turn.station),definition=expected.find(item=>item.no===station);
      if(!definition||definition.section!==Number(turn.section)){errors.push({index,type:'invalid-station',message:`S${turn.section}-T${turn.sectionTurn||'?'} 的当前站点无效`});continue;}
      seen.add(station);if(station<previous)errors.push({index,type:'station-order',message:`站点 ${station} 不能排在站点 ${previous} 之后`});previous=Math.max(previous,station);
    }
    for(const station of expected)if(!seen.has(station.no))errors.push({station:station.no,type:'missing-station',message:`5号线缺少站点 ${station.no} 的回合记录`});
    return errors;
  }
  function line5ActiveBuffs(line,mechanics={},station=10){return (line?.recordRules?.stations||[]).filter(no=>no<Number(station)).map(no=>mechanics.buffTrials?.[no]?.buff||mechanics.buffTrials?.[String(no)]?.buff).filter(Boolean);}
  const LINE5_AFFINITY_BUFF={Wrath:'折射的暴怒',Lust:'折射的色欲',Sloth:'折射的怠惰',Gluttony:'折射的暴食',Gloom:'折射的忧郁',Pride:'折射的傲慢',Envy:'折射的嫉妒'};
  const LINE5_TYPE_BUFF={Slash:'折射的斩击',Pierce:'折射的突刺',Blunt:'折射的打击'};
  function line5BuffProfile(line,mechanics={},station,context={}){
    const buffs=new Set(line5ActiveBuffs(line,mechanics,station)),hints=[];let damageBonusPercent=0,finalPower=0,coinPowerModifier=0,maxHpPercent=0,minSpeed=0,maxSpeed=0,damageTakenPercent=0;
    if(buffs.has('生死决断'))damageBonusPercent+=30;
    if(buffs.has('高风险'))damageBonusPercent+=10;
    if(buffs.has('一息')&&String(context.mode||'').startsWith('ego'))damageBonusPercent+=30;
    if(buffs.has('弱点破坏')&&(context.targetPartDestroyed||context.targetStaggered))damageBonusPercent+=30;
    if(buffs.has('折射的沉沦')&&(Number(context.targetSp)<0||context.targetHasNoSp))damageBonusPercent+=Math.min(45,Math.max(0,Number(context.sinkingPotency)||0));
    if(buffs.has('折射的呼吸法')&&context.critical)damageBonusPercent+=Math.min(50,10+Math.max(0,Number(context.poisePotency)||0)+Math.max(0,Number(context.poiseCount)||0));
    if(buffs.has('折射的充能')&&Number(context.chargeCount)>0)damageBonusPercent+=Math.min(50,10+Math.max(0,Number(context.chargeCount))*2);
    if(buffs.has('血之庆典'))damageBonusPercent+=Math.min(30,Math.floor(Math.max(0,Number(context.bloodfeastConsumed)||0)/10));
    if(buffs.has(LINE5_AFFINITY_BUFF[context.affinity]))damageBonusPercent+=30;
    if(buffs.has('折射的破裂')&&context.isRuptureSkill)finalPower+=2;
    if(buffs.has('威力轮盘'))finalPower+=Math.min(3,Math.max(0,Number(context.rouletteFinalPower)||0));
    if(buffs.has(LINE5_TYPE_BUFF[context.skillType]))coinPowerModifier+=Number(context.coinPower)<0?-1:1;
    if(buffs.has('体力扭曲'))maxHpPercent+=25;
    if(buffs.has('安乐')){maxHpPercent+=25;minSpeed+=2;maxSpeed+=2;}
    if(buffs.has('顽强防御'))damageTakenPercent-=50;
    if(buffs.has('施加量折射'))hints.push('技能或硬币效果施加烧伤、流血、震颤、破裂、沉沦时，强度额外+1级');
    if(buffs.has('获得量折射'))hints.push('技能或硬币效果获得呼吸法或充能时，层数额外+1层');
    if(buffs.has('折射的理智'))hints.push('回合结束时使理智值最低的3名友方单位恢复8点理智值');
    if(buffs.has('折射的爆发'))hints.push('回合结束时结算烧伤伤害并触发一次震颤爆发');
    if(buffs.has('折射的流血'))hints.push('回合开始时，对满体力敌人施加5级流血强度与3层流血');
    if(buffs.has('折射的充能'))hints.push('消耗不少于8层充能的技能命中时，使目标嫉妒抗性+0.1（每技能一次，最多+0.3）');
    if(buffs.has('雾化吸入器'))hints.push('每波第一回合及傲慢共鸣可获得呼吸法');
    if(buffs.has('延续斗志'))hints.push('第7位起的替补入场时恢复理智、获得攻击威力提升与七罪资源');
    if(buffs.has('资源收获'))hints.push('以攻击或反击技能击杀敌人时获得2点对应罪孽资源');
    if(buffs.has('愤怒的反击'))hints.push('受击后下回合获得2层攻击等级提升，最多6层');
    if(buffs.has('染血宴会'))hints.push('命中并造成体力伤害时回复伤害量10%的体力；回合结束流血层数-3');
    if(buffs.has('孤独的射手'))hints.push('部署第1位速度上下限+1，技能1减少1张并增加1张技能3');
    if(buffs.has('追忆吊坠'))hints.push('战斗开始时部署顺序最前的3名友方获得10级呼吸法强度');
    if(buffs.has('凶弹倾泻'))hints.push('友方阵亡时，对敌方所有部位造成其最大体力50%的固定伤害');
    return {buffs:[...buffs],damageBonusPercent,damageMultiplier:1+damageBonusPercent/100,finalPower,coinPowerModifier,maxHpPercent,minSpeed,maxSpeed,damageTakenPercent,hints};
  }
  function line5TrialProfile(line,mechanics={},station=10){
    const trials=(line?.recordRules?.stations||[]).filter(no=>no<Number(station)).map(no=>mechanics.buffTrials?.[no]?.trial||mechanics.buffTrials?.[String(no)]?.trial).filter(Boolean),result={trials,enemyLevel:0,enemyClashPower:0,enemyDamagePercent:0,enemyDefenseLevel:0,enemyPlusCoinPower:0,enemyMaxHpPercent:0,enemyDamageTakenPercent:0,allyMaxHpPercent:0,hints:[]};
    for(const trial of trials){
      if(trial==='成长折射 I')result.enemyLevel+=1;
      else if(trial==='成长折射 II')result.enemyLevel+=2;
      else if(trial==='拼点威力折射')result.enemyClashPower+=1;
      else if(trial==='攻击性折射'){result.enemyClashPower+=1;result.enemyDamagePercent+=10;}
      else if(trial==='伤害折射')result.enemyDamagePercent+=10;
      else if(trial==='防御折射')result.enemyDefenseLevel+=3;
      else if(trial==='生死决断')result.allyMaxHpPercent-=25;
      else if(trial==='体力折射')result.enemyMaxHpPercent+=10;
      else if(trial==='顽强防御')result.enemyDamageTakenPercent-=20;
      else if(trial==='中等风险')result.enemyPlusCoinPower+=1;
      else if(trial==='高风险')result.enemyPlusCoinPower+=2;
      else if(trial==='绽放之血')result.hints.push('敌人以技能或硬币效果施加流血时，强度与层数额外+1');
      else if(trial==='资源挥发')result.hints.push('使用觉醒 E.G.O 后，从资源最多的两种罪孽中各额外消耗1点');
      else if(trial==='折射的愤怒')result.hints.push('敌人受击后，下回合随机获得攻击等级提升或防御等级提升');
      else if(trial==='威力轮盘')result.hints.push('回合开始时敌方所有技能最终威力随机+1～3');
    }
    return result;
  }
  function line6ResistanceProfile(line,mechanics={},section,skill={},basePhysical=1,baseAffinity=1){
    const choice=mechanics.resistances?.[section]||mechanics.resistances?.[String(section)]||{},modifier=Number(line?.recordRules?.resistanceModifier)||0,physicalApplied=choice.attackType===skill?.type,affinityApplied=choice.affinity===skill?.affinity,physical=Math.max(0,Number(basePhysical)||0)+(physicalApplied?modifier:0),affinity=Math.max(0,Number(baseAffinity)||0)+(affinityApplied?modifier:0);return {physical,affinity,total:physical*affinity,physicalApplied,affinityApplied};
  }
  function line6ManualTriggerTurns(turns=[]){const result={};for(const turn of turns){const section=Number(turn.section),sectionTurn=Number(turn.sectionTurn);if(turn.wayfarerTriggered&&section>0&&sectionTurn>0&&result[section]==null)result[section]=sectionTurn;}return result;}
  function validateLine6ManualTriggers(line,turns=[]){if(line?.id!==6)return [];const errors=[];for(const event of line.recordRules?.wayfarerEvents?.filter(item=>item.manualTrigger)||[]){const count=turns.filter(turn=>Number(turn.section)===event.section&&turn.wayfarerTriggered===true).length;if(count!==1)errors.push({section:event.section,type:count?'duplicate-trigger':'missing-trigger',message:`${event.label}需要且只能选择一个触发回合`});}return errors;}
  function line6WayfarerProfile(line,mechanics={},section,context={}){const selected=mechanics.wayfarerBuffs?.[section]||mechanics.wayfarerBuffs?.[String(section)],event=line?.recordRules?.wayfarerEvents?.find(item=>item.section===Number(section)),startTurn=Number(event?.startTurn||mechanics.wayfarerStartTurns?.[section]||mechanics.wayfarerStartTurns?.[String(section)]||0),active=line?.recordRules?.type==='butterfly-choices'&&startTurn>0&&Number(context.sectionTurn||1)>=startTurn,result={selected:selected||'',active,startTurn,maxHpPercent:0,maxHpCap:200,removeFirstStaggerThreshold:false,spHeal:0,spHealTargets:0,offenseLevel:0,completeResonanceDamagePercent:0};if(!active)return result;if(selected==='sap'){result.maxHpPercent=50;result.removeFirstStaggerThreshold=true;if(Number(section)===5){result.spHeal=4;result.spHealTargets=4;}}if(selected==='moth'){result.offenseLevel=Number(section)===5?Math.min(6,Math.max(0,Number(context.defeatedAllies)||0)):Math.min(4,Math.max(0,Number(context.sameFactionCount)||0));if(Number(section)===5)result.completeResonanceDamagePercent=20;}return result;}
  function line6WayfarerOffenseBonus(line,mechanics={},section,context={}){return line6WayfarerProfile(line,mechanics,section,context).offenseLevel;}
  function line6SaplingAbilities(line){return line?.id===6?[...(line.recordRules?.saplingOfLight?.abilities||[])]:[];}
  function validateLine6SaplingUses(line,turns=[]){
    if(line?.id!==6)return [];
    const rules=line.recordRules?.saplingOfLight||{},allowed=new Set((rules.abilities||[]).map(item=>item.id)),uses=turns.map((turn,index)=>({turn,index,id:String(turn.saplingAbility||'')})).filter(item=>item.id),errors=[];
    if(uses.length>Number(rules.maxUses||0))errors.push({type:'too-many',message:`6号线光之树苗能力最多使用 ${rules.maxUses} 次`});
    const seen=new Set();
    for(const use of uses){
      if(!allowed.has(use.id)){errors.push({index:use.index,type:'invalid',message:'存在无效的光之树苗能力'});continue;}
      if(rules.uniquePerAbility&&seen.has(use.id))errors.push({index:use.index,type:'duplicate',message:`${use.id.toUpperCase()} 在整条6号线中只能使用一次`});
      seen.add(use.id);
      const actions=use.turn.actions||[];
      if(use.id==='superbia'){
        const free=actions.filter(action=>action.saplingFreeEgo===true&&action.executed!==false&&['ego','ego-awakening','ego-corrosion','ego-overclock','ego-induced-corrosion'].includes(String(action.mode||'')));
        if(free.length!==1)errors.push({index:use.index,type:'superbia-target',message:'SUPERBIA 发动回合需要且只能指定一个实际发动的 E.G.O 技能免除资源'});
      }
      if(use.id==='ira'&&(!use.turn.saplingTargetMemberKey||!actions.some(action=>action.memberKey===use.turn.saplingTargetMemberKey&&action.executed!==false)))errors.push({index:use.index,type:'ira-target',message:'IRA 发动回合必须选择一名本回合可行动罪人'});
    }
    for(const [index,turn] of turns.entries())for(const action of turn.actions||[])if(action.saplingFreeEgo&&!((turn.saplingAbility||'')==='superbia'&&['ego','ego-awakening','ego-corrosion','ego-overclock','ego-induced-corrosion'].includes(String(action.mode||''))))errors.push({index,type:'invalid-free-ego',message:'只有 SUPERBIA 发动回合的 E.G.O 可免除罪孽资源'});
    return errors;
  }
  function line6SaplingProfile(line,turns=[],turnIndex=0,context={}){
    const turn=turns[turnIndex]||{},result={ability:String(turn.saplingAbility||''),pigritiaActive:false,superbiaActive:false,morositasActive:false,iraActive:false,enemySpeedMultiplier:1,normalizedLevels:false,offenseLevel:0,defenseLevel:0,coinPowerModifier:0,finalPower:0,damagePercent:0,unbreakableCoins:false,staggerImmune:false,minHp:0,healPercent:0,healCap:0};
    if(line?.id!==6)return result;
    result.pigritiaActive=result.ability==='pigritia';result.superbiaActive=result.ability==='superbia';if(result.pigritiaActive)result.enemySpeedMultiplier=0.5;
    const morositasIndex=turns.findIndex((item,index)=>index<=turnIndex&&Number(item.section)===Number(turn.section)&&item.saplingAbility==='morositas'&&Number(turn.sectionTurn)-Number(item.sectionTurn)>=0&&Number(turn.sectionTurn)-Number(item.sectionTurn)<3);
    if(morositasIndex>=0){const ability=line6SaplingAbilities(line).find(item=>item.id==='morositas')||{};result.morositasActive=true;result.normalizedLevels=true;result.offenseLevel=Number(ability.allyOffenseLevel)||3;result.defenseLevel=Number(ability.allyDefenseLevel)||6;}
    const skill=context.skill||{},basicOrCounter=context.mode==='skill'&&(/^skill[123]$/.test(String(skill.slot||''))||(skill.mechanics?.tags||[]).includes('counter'));
    result.iraActive=result.ability==='ira'&&context.memberKey===turn.saplingTargetMemberKey;
    if(result.iraActive){result.unbreakableCoins=true;result.staggerImmune=true;result.minHp=10;if(basicOrCounter){result.damagePercent=100;if(Number(skill.plus)<0)result.finalPower=1;else result.coinPowerModifier=1;result.healPercent=10;result.healCap=100;}}
    return result;
  }
  function line6DisabledPassives(line,mechanics={}){if(line?.recordRules?.type!=='butterfly-choices')return [];return (line.recordRules.sealEvents||[]).map(event=>event.options?.find(option=>option.id===mechanics.sealedPassives?.[event.key])).filter(Boolean);}
  function normalizeSinnerState(value={}){return {hpPercent:Math.min(100,Math.max(0,Number(value.hpPercent??100)||0)),sp:Math.min(45,Math.max(-45,Number(value.sp)||0))};}
  function defaultSinnerStates(){return Object.fromEntries(Array.from({length:12},(_,index)=>[index+1,{hpPercent:100,sp:0}]));}
  function sectionEntryState(line,section,sectionStates={}){
    if(section<=1)return defaultSinnerStates();
    const transition=transitionRule(line,section);
    if(transition?.hpSpSource==='section-1-clear'){
      const source=sectionStates[1]?.exit||sectionStates['1']?.exit||{};
      return Object.fromEntries(Array.from({length:12},(_,index)=>{const sinner=index+1;return [sinner,normalizeSinnerState(source[sinner]||source[String(sinner)])];}));
    }
    return defaultSinnerStates();
  }

  function validateDeployments(line,deployments={},identityByKey={}){
    if(!isContinuous(line))return [];
    const errors=[],size=Number(line.deploymentRules?.size)||12;
    for(let section=1;section<=line.sectionCount;section++){
      const team=(deployments[section]||deployments[String(section)]||[]).filter(Boolean);
      if(team.length!==size)errors.push({section,type:'size',message:`第${section}区段需要部署 ${size} 个人格（当前 ${team.length}）`});
      const sinners=team.map(key=>identityByKey[key]?.sinner).filter(Boolean),duplicates=[...new Set(sinners.filter((sinner,index)=>sinners.indexOf(sinner)!==index))];
      if(duplicates.length)errors.push({section,type:'duplicate-sinner',message:`第${section}区段存在重复罪人人格`});
      const restriction=restrictionRule(line,section);
      if(restriction){
        const excluded=new Set((deployments[restriction.excludeSection]||deployments[String(restriction.excludeSection)]||[]).filter(Boolean));
        const conflicts=team.filter(key=>excluded.has(key));
        if(conflicts.length)errors.push({section,type:'restricted-identity',keys:[...new Set(conflicts)],message:`第${section}区段有 ${new Set(conflicts).size} 个人格已在第${restriction.excludeSection}区段部署`});
      }
    }
    return errors;
  }

  return {EGO_RISKS,isContinuous,sectionEncounters,libraryItems,editorTargets,transitionRule,restrictionRule,transitionText,frontlineForDeployment,rosterTimeline,deathResourceDelta,isEgoEquipped,line4EntrySp,deploymentLevelBonus,line5AllowedOptions,validateLine5Choices,validateLine5TurnStations,line5ActiveBuffs,line5BuffProfile,line5TrialProfile,line6ResistanceProfile,line6ManualTriggerTurns,validateLine6ManualTriggers,line6WayfarerProfile,line6WayfarerOffenseBonus,line6SaplingAbilities,validateLine6SaplingUses,line6SaplingProfile,line6DisabledPassives,normalizeSinnerState,defaultSinnerStates,sectionEntryState,validateDeployments};
});
