const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const RailwayStructure = require('../frontend/railway-structure.js');
const CombatRules = require('../frontend/combat-rules.js');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = path.join(__dirname, 'data');
const files = {
  axes: path.join(DATA_DIR, 'axes.json'), railways: path.join(DATA_DIR, 'railways.json'),
  identities: path.join(DATA_DIR, 'identities.json'), egos: path.join(DATA_DIR, 'egos.json'),
  dataVersion: path.join(DATA_DIR, 'data-version.json')
};
const headers = {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const send = (res, status, body) => { res.writeHead(status, headers); res.end(status === 204 ? '' : JSON.stringify(body)); };
const readJSON = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);
const cleanNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const MAX_IDENTITY_LEVEL=60;
const SINS = ['Wrath','Lust','Sloth','Gluttony','Gloom','Pride','Envy'];
const cleanResources = value => Object.fromEntries(SINS.map(sin=>[sin, cleanNumber(value?.[sin])]));
const cleanState = value => Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).slice(0,50).map(([key,val])=>[cleanText(key,50),Math.max(0,cleanNumber(val))]).filter(([key])=>key));
const cleanTeamData = value => Array.isArray(value) ? value.slice(0,12).map(item=>({key:cleanText(item?.key,80),sinner:Math.max(1,Math.min(12,cleanNumber(item?.sinner,1))),name:cleanText(item?.name,100),rarity:Math.max(1,Math.min(3,cleanNumber(item?.rarity,1))),level:Math.max(1,Math.min(MAX_IDENTITY_LEVEL,cleanNumber(item?.level,MAX_IDENTITY_LEVEL)))})) : [];
const cleanDeployments = value => Array.isArray(value) ? value.slice(0,8).map(item=>({section:Math.max(1,cleanNumber(item?.section,1)),team:Array.isArray(item?.team)?item.team.slice(0,12).map(name=>cleanText(name,100)):[],teamData:cleanTeamData(item?.teamData)})) : [];
const cleanSectionResources = value => Array.isArray(value) ? value.slice(0,8).map(item=>({section:Math.max(1,cleanNumber(item?.section,1)),entry:cleanResources(item?.entry),exit:cleanResources(item?.exit)})) : [];
const cleanSinnerStates = value => Object.fromEntries(Array.from({length:12},(_,index)=>{const sinner=index+1,state=value?.[sinner]||value?.[String(sinner)]||{};return [sinner,{hpPercent:Math.min(100,Math.max(0,cleanNumber(state.hpPercent,100))),sp:Math.min(45,Math.max(-45,cleanNumber(state.sp)))}];}));
const EGO_RISKS=['ZAYIN','TETH','HE','WAW','ALEPH'];
const EGO_MODES=['ego','ego-awakening','ego-corrosion','ego-overclock','ego-induced-corrosion','ego-forced-corrosion'];
const isIntegerValue=value=>Number.isInteger(Number(value));
const canonicalTeamData=(value,identityByKey)=>cleanTeamData(value).map(member=>{const identity=identityByKey[member.key];return identity?{key:String(identity.id),sinner:identity.sinner,name:identity.name,rarity:identity.rarity,level:member.level}:member;});
let axesWriteQueue=Promise.resolve();
const appendAxis=axis=>{
  const write=axesWriteQueue.then(async()=>{const axes=await readJSON(files.axes);axes.unshift(axis);const temporary=`${files.axes}.${process.pid}.${randomUUID()}.tmp`;try{await fs.writeFile(temporary,JSON.stringify(axes,null,2),'utf8');await fs.rename(temporary,files.axes);}catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}});
  axesWriteQueue=write.catch(()=>{});
  return write;
};
const cleanLineMechanics = (line,value={}) => {
  const rules=line?.recordRules;
  if(rules?.type==='buff-trials')return {buffTrials:Object.fromEntries(rules.stations.map(station=>{const choice=value.buffTrials?.[station]||value.buffTrials?.[String(station)]||{},allowed=RailwayStructure.line5AllowedOptions(line,station),buff=cleanText(choice.buff,100),trial=cleanText(choice.trial,100);return [station,{buff:allowed.buffs.includes(buff)?buff:'',trial:allowed.trials.includes(trial)?trial:''}];}))};
  if(rules?.type==='butterfly-choices')return {
    resistances:Object.fromEntries(rules.resistanceSections.map(section=>{const choice=value.resistances?.[section]||value.resistances?.[String(section)]||{};return [section,{attackType:rules.attackTypes.includes(choice.attackType)?choice.attackType:'',affinity:rules.affinities.includes(choice.affinity)?choice.affinity:''}];})),
    sealedPassives:Object.fromEntries(rules.sealEvents.map(event=>{const selected=cleanText(value.sealedPassives?.[event.key],30);return [event.key,event.options.some(option=>option.id===selected)?selected:''];})),
    wayfarerBuffs:Object.fromEntries(rules.wayfarerEvents.map(event=>{const selected=cleanText(value.wayfarerBuffs?.[event.section]||value.wayfarerBuffs?.[String(event.section)],20);return [event.section,rules.wayfarerOptions[event.variant].some(option=>option.id===selected)?selected:''];})),
    wayfarerStartTurns:Object.fromEntries(rules.wayfarerEvents.map(event=>[event.section,event.manualTrigger?0:event.startTurn||Math.max(0,cleanNumber(value.wayfarerStartTurns?.[event.section]||value.wayfarerStartTurns?.[String(event.section)]))]))
  };
  return {};
};
const cleanEgoLoadouts = (line,value,egoById={}) => Object.fromEntries(Array.from({length:Math.max(1,line?.sectionCount||1)},(_,index)=>{const section=index+1,source=value?.[section]||value?.[String(section)]||{};return [section,Object.fromEntries(Array.from({length:12},(_,sinnerIndex)=>{const sinner=sinnerIndex+1,loadout=source[sinner]||source[String(sinner)]||{};return [sinner,Object.fromEntries(EGO_RISKS.map(risk=>{const egoId=cleanText(loadout[risk],30),ego=egoById[egoId];return [risk,ego&&ego.sinner===sinner&&ego.rarity===risk?egoId:''];}))];}))];}));
const normalizeCommonActionEffects=(line,plan,identityByKey,egoById,deployments=[])=>{
  if([5,6].includes(line?.id))return plan;const teams=Object.fromEntries(deployments.map(item=>[item.section,item.teamData]));
  for(const turn of plan)for(const action of turn.actions){const identity=identityByKey[action.memberKey],ego=egoById[action.egoId],use=CombatRules.egoUseProfile(action.mode),skills=action.mode==='skill'?(identity?.skills||[]):use.skillKind==='awakening'?(ego?.awakeningSkills||[]):(ego?.corrosionSkills||[]),skill=skills.find(item=>item.slot===action.skillSlot);if(!skill)continue;const position=(teams[turn.section]||teams[1]||[]).findIndex(member=>member.key===action.memberKey)+1,deploymentBuff=line?.deploymentBuffs?.find(buff=>buff.position===position)||{},deploymentLevel=RailwayStructure.deploymentLevelBonus(deploymentBuff,skill),skillLevel=CombatRules.identitySkillLevel(action.identityLevel,skill,deploymentLevel).skillLevel,baseSp=ego?(use.skillKind==='awakening'?ego.sanity.awakening:ego.sanity.corrosion):0,effectiveSp=CombatRules.clamp(action.sp-(use.sanityCostApplies?Math.ceil(baseSp*use.sanityMultiplier):0),-45,45),power=CombatRules.coinProfile(skill,{heads:action.heads,faces:action.coinFaces,basePowerModifier:action.basePowerModifier,coinPowerModifier:action.coinPowerModifier,finalPower:action.finalPower+(Number(deploymentBuff.finalPower)||0),clashPowerModifier:action.clashPowerModifier+(Number(deploymentBuff.clashPower)||0),sp:effectiveSp}),level=CombatRules.clashLevelAdvantage(skillLevel-action.targetDefenseLevel+action.levelDifference);action.coinFaces=power.faces;action.selectedPower=power.selected;action.selectedClashPower=power.clashSelected+(level.side==='self'?level.bonus:0);action.powerRange=[power.min,power.max];action.skillLevel=skillLevel;action.egoUseProfile=action.mode==='skill'?null:use;}
  return plan;
};
const normalizeLine5ActionEffects = (line,lineMechanics,plan,identityByKey,egoById) => {
  if(line?.id!==5)return plan;
  for(const turn of plan){
    turn.line5TrialProfile=RailwayStructure.line5TrialProfile(line,lineMechanics,turn.station);
    for(const action of turn.actions){
      const identity=identityByKey[action.memberKey],ego=egoById[action.egoId],skills=action.mode==='skill'?(identity?.skills||[]):[...(ego?.awakeningSkills||[]),...(ego?.corrosionSkills||[])],skill=skills.find(item=>item.slot===action.skillSlot);
      action.skillType=['Slash','Pierce','Blunt'].includes(skill?.type)?skill.type:'';action.skillAffinity=SINS.includes(skill?.affinity)?skill.affinity:'';
      const profile=RailwayStructure.line5BuffProfile(line,lineMechanics,turn.station,{...action,affinity:action.skillAffinity,coinPower:skill?.plus,isRuptureSkill:(skill?.effects||[]).some(effect=>/Rupture|破裂/i.test(effect))});
      action.line5BuffProfile={buffs:profile.buffs,damageBonusPercent:profile.damageBonusPercent,finalPower:profile.finalPower,coinPowerModifier:profile.coinPowerModifier,maxHpPercent:profile.maxHpPercent,minSpeed:profile.minSpeed,maxSpeed:profile.maxSpeed,damageTakenPercent:profile.damageTakenPercent,hints:profile.hints};
      if(skill){const use=CombatRules.egoUseProfile(action.mode),baseSp=ego?(use.skillKind==='awakening'?ego.sanity.awakening:ego.sanity.corrosion):0,egoSpCost=use.sanityCostApplies?Math.ceil(baseSp*use.sanityMultiplier):0,effectiveSp=CombatRules.clamp(action.sp-egoSpCost,-45,45),power=CombatRules.coinProfile(skill,{heads:action.heads,faces:action.coinFaces,basePowerModifier:action.basePowerModifier,coinPowerModifier:action.coinPowerModifier+profile.coinPowerModifier,finalPower:action.finalPower+profile.finalPower,clashPowerModifier:action.clashPowerModifier,sp:effectiveSp}),skillLevel=CombatRules.identitySkillLevel(action.identityLevel,skill).skillLevel,level=CombatRules.clashLevelAdvantage(skillLevel-action.targetDefenseLevel+action.levelDifference-turn.line5TrialProfile.enemyLevel);action.coinFaces=power.faces;action.selectedPower=power.selected;action.selectedClashPower=power.clashSelected+(level.side==='self'?level.bonus:0);action.powerRange=[power.min,power.max];action.skillLevel=skillLevel;action.egoUseProfile=action.mode==='skill'?null:use;}
      action.damageMultiplier=profile.damageMultiplier;action.adjustedDamage=action.rawDamage>0?Math.round(action.rawDamage*action.damageMultiplier*100)/100:null;
    }
  }
  return plan;
};
const normalizeLine6ActionEffects = (line,lineMechanics,plan,identityByKey,egoById) => {
  if(line?.id!==6)return plan;const deadBySection={};
  for(const [turnIndex,turn] of plan.entries()){
    const section=turn.section;if(!deadBySection[section])deadBySection[section]=new Set();
    const wayfarerEvent=line.recordRules.wayfarerEvents.find(event=>event.section===section),wayfarerStart=wayfarerEvent?.startTurn||lineMechanics.wayfarerStartTurns?.[section]||1,wayfarer=turn.sectionTurn>=wayfarerStart?lineMechanics.wayfarerBuffs?.[section]:'';
    turn.actions.forEach(action=>{const identity=identityByKey[action.memberKey],ego=egoById[action.egoId],skills=action.mode==='skill'?(identity?.skills||[]):[...(ego?.awakeningSkills||[]),...(ego?.corrosionSkills||[])],skill=skills.find(item=>item.slot===action.skillSlot);action.skillType=['Slash','Pierce','Blunt'].includes(skill?.type)?skill.type:'';action.skillAffinity=SINS.includes(skill?.affinity)?skill.affinity:'';});
    const affinities=turn.actions.map(action=>action.skillAffinity);
    turn.actions.forEach((action,index)=>{
      const identity=identityByKey[action.memberKey],ego=egoById[action.egoId],skills=action.mode==='skill'?(identity?.skills||[]):[...(ego?.awakeningSkills||[]),...(ego?.corrosionSkills||[])],skill=skills.find(item=>item.slot===action.skillSlot);
      const choice=lineMechanics.resistances?.[section]||{},modifier=Number(line.recordRules.resistanceModifier)||0,physicalApplied=choice.attackType===action.skillType,affinityApplied=choice.affinity===action.skillAffinity,physical=action.targetPhysicalResistance+(physicalApplied?modifier:0),affinity=action.targetAffinityResistance+(affinityApplied?modifier:0);
      action.resistanceProfile={physical,affinity,total:physical*affinity,physicalApplied,affinityApplied};
      action.wayfarerProfile=RailwayStructure.line6WayfarerProfile(line,lineMechanics,section,{sectionTurn:turn.sectionTurn,defeatedAllies:deadBySection[section].size,sameFactionCount:action.sameFactionCount});
      action.wayfarerOffenseBonus=action.wayfarerProfile.offenseLevel;
      const sapling=RailwayStructure.line6SaplingProfile(line,plan,turnIndex,{memberKey:action.memberKey,mode:action.mode,skill});action.saplingProfile=sapling;
      if(skill){const use=CombatRules.egoUseProfile(action.mode),baseSp=ego?(use.skillKind==='awakening'?ego.sanity.awakening:ego.sanity.corrosion):0,egoSpCost=use.sanityCostApplies?Math.ceil(baseSp*use.sanityMultiplier):0,effectiveSp=CombatRules.clamp(action.sp-egoSpCost,-45,45),power=CombatRules.coinProfile(skill,{heads:action.heads,faces:action.coinFaces,basePowerModifier:action.basePowerModifier,coinPowerModifier:action.coinPowerModifier+sapling.coinPowerModifier,finalPower:action.finalPower+sapling.finalPower,clashPowerModifier:action.clashPowerModifier,sp:effectiveSp}),skillLevel=CombatRules.identitySkillLevel(action.identityLevel,skill).skillLevel,intrinsic=skillLevel-action.identityLevel,effectiveDifference=(sapling.morositasActive?intrinsic+sapling.offenseLevel:skillLevel-action.targetDefenseLevel)+action.levelDifference+action.wayfarerOffenseBonus,level=CombatRules.clashLevelAdvantage(effectiveDifference);action.coinFaces=power.faces;action.selectedPower=power.selected;action.selectedClashPower=power.clashSelected+(level.side==='self'?level.bonus:0);action.powerRange=[power.min,power.max];action.skillLevel=skillLevel;action.egoUseProfile=action.mode==='skill'?null:use;}
      let start=index,end=index;while(start>0&&affinities[start-1]===affinities[index])start--;while(end+1<affinities.length&&affinities[end+1]===affinities[index])end++;action.absoluteMothBonus=section===5&&wayfarer==='moth'&&affinities[index]&&end-start+1>=3;
      action.damageMultiplier=action.resistanceProfile.total*(action.absoluteMothBonus?1.2:1)*(1+sapling.damagePercent/100);action.adjustedDamage=action.rawDamage>0?Math.round(action.rawDamage*action.damageMultiplier*100)/100:null;action.iraHealing=action.adjustedDamage&&sapling.healPercent?Math.min(sapling.healCap,Math.floor(action.adjustedDamage*sapling.healPercent/100)):0;
    });
    for(const member of turn.deaths||[])deadBySection[section].add(member);
  }
  return plan;
};
const recomputeJourneyResources=(line,lineMechanics,plan,initialResources,identityByKey,egoById)=>{
  const turns=plan.map(turn=>{const resourceDelta=Object.fromEntries(SINS.map(sin=>[sin,0])),station=Number(turn.station)||line?.stations?.find(item=>item.section===turn.section)?.no||1,buffs=new Set(RailwayStructure.line5ActiveBuffs(line,lineMechanics,station)),trials=new Set(RailwayStructure.line5TrialProfile(line,lineMechanics,station).trials);for(const member of turn.deaths||[]){const delta=RailwayStructure.deathResourceDelta(identityByKey[member],SINS);for(const sin of SINS)resourceDelta[sin]+=delta[sin];}return {section:turn.section,resourceDelta,actions:(turn.actions||[]).map(action=>{const identity=identityByKey[action.memberKey],ego=egoById[action.egoId],skills=action.mode==='skill'?(identity?.skills||[]):[...(ego?.awakeningSkills||[]),...(ego?.corrosionSkills||[])],skill=skills.find(item=>item.slot===action.skillSlot);return {executed:action.executed,kind:action.mode==='skill'?'skill':'ego',affinity:skill?.affinity,costs:ego?.costs||[],freeCost:line?.id===6&&turn.saplingAbility==='superbia'&&action.saplingFreeEgo===true,resourceMultiplier:CombatRules.egoUseProfile(action.mode).resourceMultiplier,overclock:action.mode==='ego-overclock',vaporizeHighest:trials.has('资源挥发')&&(action.mode==='ego-awakening'||action.mode==='ego')?2:0,bonusResourceOnKill:buffs.has('资源收获')&&action.defeatedTarget&&(!String(skill?.slot||'').startsWith('defense')||skill?.mechanics?.tags?.includes('counter'))?2:0};})};});return CombatRules.journeyResourceLedger(initialResources,turns,Math.max(1,line?.sectionCount||1),SINS);
};
const normalizeSectionStates = (line,value) => {const submitted=Object.fromEntries((Array.isArray(value)?value:[]).slice(0,8).map(item=>[Math.max(1,cleanNumber(item?.section,1)),item])),result=[];for(let section=1;section<=Math.max(1,line?.sectionCount||1);section++){const transition=(line?.sectionTransitions||[]).find(item=>item.toSection===section),entry=transition?.hpSpSource==='section-1-clear'?(result[0]?.exit||cleanSinnerStates()):cleanSinnerStates(),exit=cleanSinnerStates(submitted[section]?.exit||entry);result.push({section,entry,exit});}return result;};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const limit=2_000_000,declared=Number(req.headers['content-length']);
    if(Number.isFinite(declared)&&declared>limit){req.resume();return reject(Object.assign(new Error('请求体过大'),{status:413}));}
    let raw='',bytes=0,settled=false;
    req.on('data', chunk => {bytes+=chunk.length;if(bytes>limit){raw='';if(!settled){settled=true;reject(Object.assign(new Error('请求体过大'),{status:413}));}}else if(!settled)raw+=chunk;});
    req.on('end', () => {if(settled)return;try{resolve(JSON.parse(raw||'{}'));}catch{reject(Object.assign(new Error('JSON 格式错误'),{status:400}));}});
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res,200,{ok:true,version:'0.14.0'});
    if (req.method === 'GET' && url.pathname === '/api/axes') return send(res, 200, await readJSON(files.axes));
    if (req.method === 'GET' && url.pathname === '/api/railways') return send(res, 200, await readJSON(files.railways));
    if (req.method === 'GET' && url.pathname === '/api/identities') return send(res, 200, await readJSON(files.identities));
    if (req.method === 'GET' && url.pathname === '/api/egos') return send(res, 200, await readJSON(files.egos));
    if (req.method === 'GET' && url.pathname === '/api/data-version') return send(res, 200, await readJSON(files.dataVersion));
    if (req.method === 'GET' && url.pathname.startsWith('/api/axes/')) {
      const axis = (await readJSON(files.axes)).find(item => item.id === decodeURIComponent(url.pathname.slice(10)));
      return axis ? send(res, 200, axis) : send(res, 404, {error:'档案不存在'});
    }
    if (req.method === 'POST' && url.pathname === '/api/axes') {
      const input = await readBody(req);
      const title=cleanText(input.title,100),author=cleanText(input.author,40),desc=cleanText(input.desc,1000);
      if(!title||!author||!desc)return send(res,400,{error:'标题、作者和说明为必填项'});
      if(!Array.isArray(input.plan)||input.plan.length<1)return send(res,400,{error:'至少需要一个回合记录'});
      if(input.plan.length>200)return send(res,400,{error:'回合记录不能超过 200 条'});
      const railwayMatch=String(input.railway||'').trim().match(/^(\d+)号线$/),lineId=Number(railwayMatch?.[1]);
      const [railways,identities,egos]=await Promise.all([readJSON(files.railways),readJSON(files.identities),readJSON(files.egos)]),line=railways.find(item=>item.id===lineId);
      if(!line)return send(res,400,{error:'轨道线不存在'});
      const identityByKey=Object.fromEntries(identities.map(item=>[String(item.id),item])),egoById=Object.fromEntries(egos.map(item=>[String(item.id),item]));
      const submittedTeams=[...(Array.isArray(input.teamData)?[input.teamData]:[]),...(Array.isArray(input.deployments)?input.deployments.map(item=>item?.teamData):[])].filter(Array.isArray);
      for(const team of submittedTeams)for(const member of team){if(!identityByKey[String(member?.key||'')])return send(res,400,{error:'队伍包含不存在的人格'});if(!isIntegerValue(member?.sinner)||!isIntegerValue(member?.level))return send(res,400,{error:'罪人编号和人格等级必须是整数'});if(Number(member.level)<1||Number(member.level)>MAX_IDENTITY_LEVEL)return send(res,400,{error:`人格等级必须在 1～${MAX_IDENTITY_LEVEL} 之间`});}
      if(SINS.some(sin=>input.initialResources?.[sin]!=null&&(!isIntegerValue(input.initialResources[sin])||Number(input.initialResources[sin])<0)))return send(res,400,{error:'七罪资源必须是非负整数'});
      for(const deployment of Array.isArray(input.deployments)?input.deployments:[])if(!isIntegerValue(deployment?.section))return send(res,400,{error:'部署区段必须是整数'});
      for(const [sectionKey,sinners] of Object.entries(input.egoLoadouts&&typeof input.egoLoadouts==='object'?input.egoLoadouts:{})){if(!isIntegerValue(sectionKey)||Number(sectionKey)<1||Number(sectionKey)>Math.max(1,line.sectionCount||1))return send(res,400,{error:'E.G.O 装备区段无效'});for(const [sinnerKey,loadout] of Object.entries(sinners&&typeof sinners==='object'?sinners:{})){if(!isIntegerValue(sinnerKey)||Number(sinnerKey)<1||Number(sinnerKey)>12)return send(res,400,{error:'E.G.O 装备罪人编号无效'});for(const [risk,egoIdValue] of Object.entries(loadout&&typeof loadout==='object'?loadout:{})){const egoId=String(egoIdValue||'');if(!egoId)continue;const ego=egoById[egoId];if(!EGO_RISKS.includes(risk)||!ego||ego.sinner!==Number(sinnerKey)||ego.rarity!==risk)return send(res,400,{error:`第 ${sectionKey} 区段包含无效的 E.G.O 装备`});}}}
      let previousSection=0;
      for(const turn of input.plan){
        if(!isIntegerValue(turn?.section))return send(res,400,{error:'回合区段必须是整数'});
        if(turn.station!=null&&!isIntegerValue(turn.station))return send(res,400,{error:'站点必须是整数'});
        const section=Number(turn.section);
        if(section<1||section>Math.max(1,line.sectionCount||1))return send(res,400,{error:'回合区段超出轨道线范围'});
        if(line.battleFormat==='continuous-sections'&&(section<previousSection||section>previousSection+1||(!previousSection&&section!==1)))return send(res,400,{error:'连续战区段顺序不合法'});
        previousSection=section;
        if((Array.isArray(turn.deaths)?turn.deaths:[]).some(memberKey=>!identityByKey[String(memberKey)]))return send(res,400,{error:'阵亡记录引用了不存在的人格'});
        if(turn.saplingTargetMemberKey&&!identityByKey[String(turn.saplingTargetMemberKey)])return send(res,400,{error:'光之树苗目标人格不存在'});
        if(!Array.isArray(turn.actions))return send(res,400,{error:'回合行动必须是数组'});
        for(const action of turn.actions){
          const identity=identityByKey[String(action?.memberKey||'')];if(!identity)return send(res,400,{error:'行动引用了不存在的人格'});
          const mode=action.mode==='ego-corrosion'?'ego-induced-corrosion':String(action.mode||'skill');if(mode!=='skill'&&!EGO_MODES.includes(mode))return send(res,400,{error:'行动模式无效'});
          const ego=mode==='skill'?null:egoById[String(action.egoId||'')],skills=mode==='skill'?(identity.skills||[]):CombatRules.egoUseProfile(mode).skillKind==='awakening'?(ego?.awakeningSkills||[]):(ego?.corrosionSkills||[]),skill=skills.find(item=>item.slot===String(action.skillSlot||''));
          if(mode!=='skill'&&(!ego||ego.sinner!==identity.sinner))return send(res,400,{error:'E.G.O 与行动罪人不匹配'});
          if(!skill)return send(res,400,{error:`人格或 E.G.O 不存在技能槽 ${String(action.skillSlot||'')}`});
          const integerFields=['heads','targetDefenseLevel','sameFactionCount','rouletteFinalPower','targetSp','sinkingPotency','poisePotency','poiseCount','chargeCount','bloodfeastConsumed','targetCount','reuse','effectiveAttackWeight','actualTargets','excessAttackWeight'];
          if(integerFields.some(key=>action[key]!=null&&!isIntegerValue(action[key])))return send(res,400,{error:'行动中的计数、等级字段必须是整数'});
          if(ego){const sanity=CombatRules.egoSanityProfile(mode,action.sp,ego.sanity);if(!sanity.valid)return send(res,400,{error:mode==='ego-forced-corrosion'?'回合开始强制侵蚀要求使用前理智值为 -45':'当前理智值不会触发意外侵蚀'});}
        }
      }
      const sectionTurnCounts={};input.plan.forEach((turn,index)=>{turn.turn=index+1;turn.sectionTurn=(sectionTurnCounts[turn.section]||0)+1;sectionTurnCounts[turn.section]=turn.sectionTurn;});
      const egoLoadouts=line.battleFormat==='continuous-sections'?cleanEgoLoadouts(line,input.egoLoadouts,egoById):{},lineMechanics=cleanLineMechanics(line,input.lineMechanics),deployments=cleanDeployments(input.deployments).map(deployment=>({...deployment,teamData:canonicalTeamData(deployment.teamData,identityByKey)}));
      if(line?.battleFormat==='continuous-sections'){const bySection=Object.fromEntries(deployments.map(item=>[item.section,item]));
        for(let section=1;section<=line.sectionCount;section++){
          const deployment=bySection[section];
          if(!deployment||deployment.teamData.length!==line.deploymentRules.size)return send(res,400,{error:`第 ${section} 区段需要完整部署 ${line.deploymentRules.size} 个人格`});
          if(deployment.teamData.some(item=>!identityByKey[item.key]||identityByKey[item.key].sinner!==item.sinner))return send(res,400,{error:`第 ${section} 区段包含无效人格数据`});
          if(new Set(deployment.teamData.map(item=>item.sinner)).size!==line.deploymentRules.size)return send(res,400,{error:`第 ${section} 区段必须为每名罪人各部署一个人格`});
        }
        for(const rule of line.deploymentRules.restrictions||[]){const current=new Set(bySection[rule.section].teamData.map(item=>item.key)),excluded=new Set(bySection[rule.excludeSection].teamData.map(item=>item.key));if([...current].some(key=>excluded.has(key)))return send(res,400,{error:`第 ${rule.section} 区段使用了第 ${rule.excludeSection} 区段已部署的人格`});}
        const sectionsWithTurns=new Set((input.plan||[]).map(turn=>Number(turn.section)||1));
        for(let section=1;section<=line.sectionCount;section++)if(!sectionsWithTurns.has(section))return send(res,400,{error:`第 ${section} 区段缺少回合记录`});
        if(line.id===5){const stationErrors=RailwayStructure.validateLine5TurnStations(line,input.plan||[]);if(stationErrors.length)return send(res,400,{error:stationErrors[0].message});}
        if(line.recordRules?.type==='buff-trials'){const errors=RailwayStructure.validateLine5Choices(line,lineMechanics.buffTrials);if(errors.length)return send(res,400,{error:`5 号线机制选择无效：${errors[0].message}`});}
        if(line.recordRules?.type==='butterfly-choices'){const saplingErrors=RailwayStructure.validateLine6SaplingUses(line,input.plan||[]);if(saplingErrors.length)return send(res,400,{error:saplingErrors[0].message});const manualTurns=RailwayStructure.line6ManualTriggerTurns(input.plan||[]);for(const event of line.recordRules.wayfarerEvents.filter(event=>event.manualTrigger))lineMechanics.wayfarerStartTurns[event.section]=manualTurns[event.section]||0;const triggerErrors=RailwayStructure.validateLine6ManualTriggers(line,input.plan||[]);if(triggerErrors.length)return send(res,400,{error:triggerErrors[0].message});}
        if(line.recordRules?.type==='butterfly-choices'&&(line.recordRules.resistanceSections.some(section=>!lineMechanics.resistances[section].attackType||!lineMechanics.resistances[section].affinity)||line.recordRules.sealEvents.some(event=>!lineMechanics.sealedPassives[event.key])||line.recordRules.wayfarerEvents.some(event=>!lineMechanics.wayfarerBuffs[event.section]||event.requiresStartTurn&&!lineMechanics.wayfarerStartTurns[event.section])))return send(res,400,{error:'6 号线需要完整记录抗性、幻蝶事件与局内增益选择'});
        const rosters={};
        for(const turn of input.plan||[]){
          const section=Math.max(1,cleanNumber(turn.section,1)),ordered=bySection[section]?.teamData.map(item=>item.key)||[];
          if(line.id===5&&!line.stations.some(station=>station.section===section&&station.no===Number(turn.station)))return send(res,400,{error:`第 ${section} 区段回合缺少有效的当前站点`});
          if(!rosters[section])rosters[section]={active:ordered.slice(0,line.deploymentRules.frontline),backup:ordered.slice(line.deploymentRules.frontline)};
          const roster=rosters[section];
          for(const action of turn.actions||[]){
            if(!roster.active.includes(String(action.memberKey)))return send(res,400,{error:`第 ${section} 区段回合包含未在场成员的行动`});
            if(['ego','ego-awakening','ego-corrosion','ego-overclock','ego-induced-corrosion','ego-forced-corrosion'].includes(String(action.mode||''))){const ego=egoById[String(action.egoId||'')],loadout=egoLoadouts[section]?.[ego?.sinner];if(!ego||String(loadout?.[ego.rarity]||'')!==String(ego.id))return send(res,400,{error:`第 ${section} 区段行动使用了未装备的 E.G.O`});const sanity=CombatRules.egoSanityProfile(action.mode,action.sp,ego.sanity);if(!sanity.valid)return send(res,400,{error:action.mode==='ego-forced-corrosion'?'回合开始强制侵蚀要求使用前理智值为 -45':'当前理智值不会触发意外侵蚀'});}
          }
          const deaths=[...new Set(Array.isArray(turn.deaths)?turn.deaths.map(String):[])];
          if(deaths.some(member=>!roster.active.includes(member)))return send(res,400,{error:`第 ${section} 区段记录了非在场成员阵亡`});
          roster.active=roster.active.filter(member=>!deaths.includes(member));while(roster.active.length<line.deploymentRules.frontline&&roster.backup.length)roster.active.push(roster.backup.shift());
        }
      }
      const plan = input.plan.map((turn,index) => ({
        turn:index+1, section:Number(turn.section), station:Math.max(0,cleanNumber(turn.station)), sectionTurn:1, wayfarerTriggered:turn.wayfarerTriggered===true, saplingAbility:cleanText(turn.saplingAbility,20), saplingTargetMemberKey:cleanText(turn.saplingTargetMemberKey,80),
        note: cleanText(turn.note, 300), stateChanges: cleanText(turn.stateChanges,500), deaths:Array.isArray(turn.deaths)?[...new Set(turn.deaths.map(value=>cleanText(value,80)).filter(Boolean))].slice(0,12):[],
        branches: Array.isArray(turn.branches) ? turn.branches.slice(0,10).map(branch=>({condition:cleanText(branch.condition,200),result:cleanText(branch.result,300)})) : [],
        actions: Array.isArray(turn.actions) ? turn.actions.slice(0, 20).map(action => ({
          memberKey: cleanText(action.memberKey, 80), member: cleanText(action.member, 100),
          mode: ['ego','ego-awakening','ego-corrosion','ego-overclock','ego-induced-corrosion','ego-forced-corrosion'].includes(action.mode) ? (action.mode==='ego-corrosion'?'ego-induced-corrosion':action.mode) : 'skill', choice: cleanText(action.choice, 200), egoId:cleanText(action.egoId,30), egoRisk:EGO_RISKS.includes(action.egoRisk)?action.egoRisk:'',
          affinity: cleanText(action.affinity, 20), target: cleanText(action.target, 100), skillSlot:cleanText(action.skillSlot,30), skillType:['Slash','Pierce','Blunt'].includes(action.skillType)?action.skillType:'', skillAffinity:SINS.includes(action.skillAffinity)?action.skillAffinity:'',
          targetPhysicalResistance:Math.min(3,Math.max(0,cleanNumber(action.targetPhysicalResistance,1))), targetAffinityResistance:Math.min(3,Math.max(0,cleanNumber(action.targetAffinityResistance,1))), sameFactionCount:Math.min(4,Math.max(0,cleanNumber(action.sameFactionCount))), rawDamage:Math.max(0,cleanNumber(action.rawDamage)),
          rouletteFinalPower:Math.min(3,Math.max(0,cleanNumber(action.rouletteFinalPower))),targetSp:Math.min(45,Math.max(-45,cleanNumber(action.targetSp))),sinkingPotency:Math.max(0,cleanNumber(action.sinkingPotency)),poisePotency:Math.max(0,cleanNumber(action.poisePotency)),poiseCount:Math.max(0,cleanNumber(action.poiseCount)),chargeCount:Math.max(0,cleanNumber(action.chargeCount)),bloodfeastConsumed:Math.max(0,cleanNumber(action.bloodfeastConsumed)),critical:action.critical===true,targetStaggered:action.targetStaggered===true,targetPartDestroyed:action.targetPartDestroyed===true,targetHasNoSp:action.targetHasNoSp===true,defeatedTarget:action.defeatedTarget===true,
          executed: action.executed !== false, saplingFreeEgo:action.saplingFreeEgo===true, heads: cleanNumber(action.heads), coinFaces:Array.isArray(action.coinFaces)?action.coinFaces.slice(0,20).map(face=>face==='H'?'H':'T'):[], identityLevel:MAX_IDENTITY_LEVEL,targetDefenseLevel:Math.max(1,Math.min(99,cleanNumber(action.targetDefenseLevel,MAX_IDENTITY_LEVEL))), sp: Math.max(-45, Math.min(45, cleanNumber(action.sp))),
          basePowerModifier: cleanNumber(action.basePowerModifier), coinPowerModifier: cleanNumber(action.coinPowerModifier),
          finalPower: cleanNumber(action.finalPower), clashPowerModifier: cleanNumber(action.clashPowerModifier),
          levelDifference: cleanNumber(action.levelDifference), attackWeightModifier: cleanNumber(action.attackWeightModifier),
          targetCount: Math.max(1, cleanNumber(action.targetCount,1)), reuse: Math.max(0, cleanNumber(action.reuse)),
          effectiveAttackWeight: Math.max(1, cleanNumber(action.effectiveAttackWeight,1)),
          actualTargets: Math.max(1, cleanNumber(action.actualTargets,1)), excessAttackWeight: Math.max(0, cleanNumber(action.excessAttackWeight)),
          selectedPower: action.selectedPower == null ? null : cleanNumber(action.selectedPower),
          selectedClashPower: action.selectedClashPower == null ? null : cleanNumber(action.selectedClashPower),
          powerRange: Array.isArray(action.powerRange) ? action.powerRange.slice(0,2).map(v=>cleanNumber(v)) : null,
          specialMechanic: action.specialMechanic ? {
            type: cleanText(action.specialMechanic.type,40), affinity: cleanText(action.specialMechanic.affinity,20),
            threshold: cleanNumber(action.specialMechanic.threshold), actual: cleanNumber(action.specialMechanic.actual),
            replacementSkill: cleanText(action.specialMechanic.replacementSkill,100), maxActivations: cleanNumber(action.specialMechanic.maxActivations,1)
          } : null
        })) : []
      }));
      const submittedTeamData=canonicalTeamData(input.teamData,identityByKey),trustedLevels=Object.fromEntries(deployments.map(item=>[item.section,Object.fromEntries(item.teamData.map(member=>[member.key,member.level]))]));
      if(!trustedLevels[1])trustedLevels[1]=Object.fromEntries(submittedTeamData.map(member=>[member.key,member.level]));
      const sectionTurns={};
      for(const turn of plan){
        turn.sectionTurn=(sectionTurns[turn.section]||0)+1;sectionTurns[turn.section]=turn.sectionTurn;
        for(const action of turn.actions){
          const identity=identityByKey[action.memberKey],mode=action.mode,ego=mode==='skill'?null:egoById[action.egoId],use=CombatRules.egoUseProfile(mode),skills=mode==='skill'?identity.skills:use.skillKind==='awakening'?ego.awakeningSkills:ego.corrosionSkills,skill=skills.find(item=>item.slot===action.skillSlot);
          action.member=`${identity.sinnerName}·${identity.name}`;action.identityName=identity.name;action.sinner=identity.sinner;action.identityLevel=trustedLevels[turn.section]?.[action.memberKey]||MAX_IDENTITY_LEVEL;
          action.choice=ego?`${ego.name} · ${skill.name}`:`${skill.name}（${skill.slot}·${skill.affinity}）`;action.affinity=skill.affinity;action.skillType=skill.type;action.skillAffinity=skill.affinity;
          action.egoId=ego?String(ego.id):'';action.egoName=ego?.name||'';action.egoRisk=ego?.rarity||'';
        }
      }
      normalizeCommonActionEffects(line,plan,identityByKey,egoById,deployments);
      normalizeLine5ActionEffects(line,lineMechanics,plan,identityByKey,egoById);
      normalizeLine6ActionEffects(line,lineMechanics,plan,identityByKey,egoById);
      const resourceLedger=recomputeJourneyResources(line,lineMechanics,plan,cleanResources(input.initialResources),identityByKey,egoById);
      const axis = {
        id: randomUUID(), title, railway:`${line.id}号线`,
        station:cleanText(input.station,100), turns:plan.length,
        author, date:new Date().toISOString().slice(0,10), likes:0, difficulty:'待验证',
        tags:Array.isArray(input.tags)?input.tags.slice(0,8).map(v=>cleanText(v,20)).filter(Boolean):[],
        team:submittedTeamData.map(item=>`${item.sinnerName||identityByKey[item.key]?.sinnerName||item.sinner}·${item.name}`),
        teamData:submittedTeamData, deployments, egoLoadouts, lineMechanics,
        desc, steps: plan.map(t=>`${input.deployments?.length?`S${t.section}-T${t.sectionTurn}`:`T${t.turn}`}：${t.note || t.actions.map(a=>`${a.member} ${a.choice}`).join('；')}`),
        plan, initialResources: cleanResources(input.initialResources), sectionResources: resourceLedger.sections, sectionStates: line?.battleFormat==='continuous-sections'?normalizeSectionStates(line,input.sectionStates):[], finalResources: resourceLedger.resources,
        initialStateText: cleanText(input.initialStateText,1000), finalState: cleanState(input.finalState)
      };
      await appendAxis(axis);
      return send(res,201,axis);
    }
    return send(res, 404, {error:'接口不存在'});
  } catch (error) {if(!error.status||error.status>=500)console.error(error);return send(res,error.status||500,{error:error.message||'服务器内部错误'});}
});
if(require.main===module)server.listen(PORT,HOST,()=>console.log(`后端 API: http://${HOST}:${PORT}`));
module.exports={server,cleanLineMechanics,normalizeCommonActionEffects,normalizeLine5ActionEffects,normalizeLine6ActionEffects,recomputeJourneyResources};
