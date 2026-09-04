const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const API = 'https://limbuscompany.wiki.gg/api.php';
const OUT = path.join(__dirname, '..', 'backend', 'data');
const SINNER_ID = {
  'Yi Sang':1, 'Faust':2, 'Don Quixote':3, 'Ryōshū':4, 'Ryoshu':4,
  'Meursault':5, 'Hong Lu':6, 'Heathcliff':7, 'Ishmael':8,
  'Rodion':9, 'Sinclair':10, 'Outis':11, 'Gregor':12
};
const SIN_FIELDS = {wrathcost:'Wrath',lustcost:'Lust',slothcost:'Sloth',gluttonycost:'Gluttony',gloomcost:'Gloom',pridecost:'Pride',envycost:'Envy'};
const delay = ms => new Promise(r=>setTimeout(r,ms));

async function api(params, method='GET') {
  const all={...params,format:'json',formatversion:'2'};
  const args=['-Ls','--max-time','60','-H','User-Agent: RailwayArchive/0.2 (personal wiki data updater)'];
  if(method==='POST'){
    args.push('-X','POST',API);
    for(const [key,value] of Object.entries(all)) args.push('--data-urlencode',`${key}=${value}`);
  } else {
    args.push(`${API}?${new URLSearchParams(all)}`);
  }
  let lastError;
  for(let attempt=1;attempt<=3;attempt++){
    try {
      const {stdout}=await execFileAsync('curl',args,{maxBuffer:50*1024*1024,encoding:'utf8'});
      const json=JSON.parse(stdout); if(json.error)throw new Error(json.error.info||json.error.code);
      return json;
    } catch(error){lastError=error;if(attempt<3)await delay(800*attempt);}
  }
  throw lastError;
}

async function categoryMembers(category) {
  const result=[]; let cmcontinue;
  do {
    const json=await api({action:'query',list:'categorymembers',cmtitle:`Category:${category}`,cmtype:'page',cmlimit:'500',...(cmcontinue?{cmcontinue}:{})});
    result.push(...(json.query?.categorymembers||[]).map(x=>x.title).filter(t=>t!==category));
    cmcontinue=json.continue?.cmcontinue;
  } while(cmcontinue);
  return result;
}

async function pageSources(titles) {
  const pages=[];
  for(let i=0;i<titles.length;i+=50){
    const batch=titles.slice(i,i+50);
    const json=await api({action:'query',prop:'revisions',rvprop:'content',rvslots:'main',titles:batch.join('|')},'POST');
    for(const page of json.query?.pages||[]) pages.push({title:page.title,source:page.revisions?.[0]?.slots?.main?.content||''});
    process.stdout.write(`  ${Math.min(i+50,titles.length)}/${titles.length}\r`);
    await delay(150);
  }
  process.stdout.write('\n'); return pages;
}

function scalar(source,key){
  const m=source.match(new RegExp(`(?:^|\\n)\\|${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}=([^\\n]*)`));
  return m?.[1]?.trim()||'';
}
function number(value,fallback=0){ const m=String(value).replace(/,/g,'').match(/[+-]?\s*\d+(?:\.\d+)?/); return m?Number(m[0].replace(/\s/g,'')):fallback; }
function templateParams(block){
  const params=[];let current='',templates=1,links=0;
  for(let i=2;i<block.length-2;i++){
    const pair=block.slice(i,i+2);
    if(pair==='{{'){templates++;current+=pair;i++;continue;} if(pair==='}}'){templates--;current+=pair;i++;continue;}
    if(pair==='[['){links++;current+=pair;i++;continue;} if(pair===']]'){links--;current+=pair;i++;continue;}
    if(block[i]==='|'&&templates===1&&links===0){params.push(current);current='';}else current+=block[i];
  }
  params.push(current);return params;
}
function passive(source,field,type){
  const block=templateAtField(source,field);if(!block)return null;
  const parts=templateParams(block),positional=[],named={};
  for(const raw of parts.slice(1)){const eq=raw.indexOf('=');if(eq>0&&/^[\w-]+$/.test(raw.slice(0,eq).trim()))named[raw.slice(0,eq).trim()]=raw.slice(eq+1);else positional.push(raw);}
  return {slot:field,type,name:cleanWiki(positional[0])||field,affinity:normalizeAffinity(named.sin),requirement:cleanWiki(named.req),effect:cleanEffect(positional.slice(1).join(' · '))};
}
function templateAtField(source,field){
  const marker=`|${field}={{`; const start=source.indexOf(marker); if(start<0)return '';
  const braceStart=start+marker.length-2; let depth=0;
  for(let i=braceStart;i<source.length-1;i++){
    const pair=source.slice(i,i+2);
    if(pair==='{{'){depth++;i++;continue;} if(pair==='}}'){depth--;if(depth===0)return source.slice(braceStart,i+2);i++;}
  }
  return '';
}
function cleanWiki(value){
  return String(value||'').replace(/'''?/g,'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]+>/g,'').replace(/\{\{[^{}]*\}\}/g,'').replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g,'$2').replace(/\s+/g,' ').trim();
}
function cleanEffect(value){
  let text=String(value||'').replace(/'''?/g,'').replace(/<br\s*\/?\s*>/gi,' · ');
  for(let i=0;i<4;i++) text=text.replace(/\{\{SkillCon\|([^|}]+)(?:\|[^}]*)?\}\}/g,'[$1]').replace(/\{\{StatusEffect\|([^|}]+)(?:\|[^}]*)?\}\}/g,'$1').replace(/\{\{Icons?\|([^|}]+)(?:\|[^}]*)?\}\}/g,'$1').replace(/\{\{[^{}|]+\|([^{}|]+)(?:\|[^{}]*)?\}\}/g,'$1');
  return text.replace(/\{\{[^{}]*\}\}/g,'').replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g,'$2').replace(/<[^>]+>/g,'').replace(/\s*·\s*/g,' · ').replace(/\s+/g,' ').trim();
}
function normalizeAffinity(value){
  const raw=cleanWiki(value).toLowerCase();
  return {wrath:'Wrath',lust:'Lust',sloth:'Sloth',gluttony:'Gluttony',gloom:'Gloom',pride:'Pride',envy:'Envy',def:'None',none:'None'}[raw]||'None';
}
function normalizeType(value){
  const raw=cleanWiki(value).toLowerCase();
  return {slash:'Slash',pierce:'Pierce',blunt:'Blunt',guard:'Guard',evade:'Evade',counter:'Counter',defense:'Defense'}[raw]||cleanWiki(value)||'Defense';
}
function skill(source,field){
  const block=templateAtField(source,field); if(!block)return null;
  const affinity=normalizeAffinity(scalar(block,'sin'));
  const effectFields=['se',...Array.from({length:10},(_,i)=>`ce${i+1}`)];
  const effects=effectFields.map(key=>cleanEffect(scalar(block,key))).filter(Boolean);
  const statuses=[...new Set([...block.matchAll(/\{\{StatusEffect\|([^|}]+)/gi)].map(m=>cleanWiki(m[1])))];
  const attackWeight=number(scalar(block,'atkweight'),1);
  const mechanicRules=[
    ['absolute-resonance',/A-Reson/i],['resonance',/(?<!A-)Reson/i],['counter',/\bCounter\b/i],
    ['unbreakable-coin',/Unbreakable Coin/i],['coin-reuse',/Reuse(?:s|d)? (?:this )?Coin|Coin (?:is )?Reuse/i],
    ['coin-power',/Coin Power/i],['coin-power-conversion',/Coin Power does not change; instead/i],['final-power',/Final Power/i],['clash-power',/Clash Power/i],
    ['attack-weight',/Atk(?:ack)? Weight/i],['unfocused-volley',/Unfocused Volley/i],
    ['skill-replacement',/replace this Skill with|activate as ["“']|use as ["“']/i],
    ['random-weapon',/chance to produce a (?:Slash|Pierce|Blunt) weapon|random weapon/i],
    ['assist-extra-attack',/Assist Attack|use ["“'][^"”']+["”'] Skill against|as an Unopposed Attack/i],
    ['clashable-defense',/Clashable (?:Guard|Counter)/i],['conditional',/\bIf\b|At \d+\+|per \d+/i]
  ];
  const tags=mechanicRules.filter(([,pattern])=>pattern.test(block)).map(([tag])=>tag);
  if(attackWeight>1&&!tags.includes('attack-weight'))tags.push('attack-weight');
  if(attackWeight>1)tags.push('multi-target');
  const joinedEffects=effects.join(' · ');
  const attackWeightRules=effects.flatMap(effect=>effect.split(/\s*·\s*/)).filter(effect=>/Atk(?:ack)? Weight/i.test(effect));
  const conversionMatch=block.match(/Coin Power does not change; instead, for every net Coin Power increase, Final Power \+(\d+)/i);
  const coinPowerConversion=conversionMatch?{finalPowerPerNetIncrease:Number(conversionMatch[1])}:null;
  const replacements=[
    ...[...joinedEffects.matchAll(/(?:replace this Skill with|activate as|use as)\s+["“]([^"”]+)["”]/gi)].map(match=>match[1]),
    ...[...joinedEffects.matchAll(/(?:replace this Skill with|activate as|use as)\s+'([^']+)'/gi)].map(match=>match[1])
  ];
  const counterPattern=/At (\d+)\+ sum of (?:(Wrath|Lust|Sloth|Gluttony|Gloom|Pride|Envy) )?A-Reson\.?,?\s*use ['‘]([^\n]*?)['’] as Counter/gi;
  const counterThresholds=[...block.matchAll(counterPattern)].map(match=>({threshold:Number(match[1]),replacementSkill:match[3]})).sort((a,b)=>a.threshold-b.threshold);
  const counterAffinity=block.match(/sum of (Wrath|Lust|Sloth|Gluttony|Gloom|Pride|Envy) A-Reson/i)?.[1]||affinity;
  const maxActivations=number(block.match(/Activates? (\d+) times? per turn/i)?.[1]);
  const special=counterThresholds.length?{type:'resonance-counter',affinity:normalizeAffinity(counterAffinity),thresholds:counterThresholds,maxActivations:maxActivations||1}:null;
  return {
    slot:field, name:cleanWiki(scalar(block,'name'))||field,
    affinity, base:number(scalar(block,'spower')), plus:number(scalar(block,'cpower')),
    coins:number(scalar(block,'coin'),1), amount:number(scalar(block,'amt')), type:normalizeType(scalar(block,'type')),
    offenseLevel:number(scalar(block,'atkmod')), attackWeight,
    effects, mechanics:{tags:[...new Set(tags)],statuses,attackWeightRules,replacements:[...new Set(replacements)],...(coinPowerConversion?{coinPowerConversion}:{}),...(special?{special}:{})}
  };
}
function identityFrom(page){
  const source=page.source; if(!source.includes('{{IDPage'))return null;
  const sinner=cleanWiki(scalar(source,'sinner')), prefix=cleanWiki(scalar(source,'prefix'));
  const sinnerId=SINNER_ID[sinner]; if(!sinnerId||!prefix)return null;
  const skillFields=[...new Set([...source.matchAll(/^\|(skill[1-3](?:-\d+)?|defense(?:-\d+)?)=\{\{UptieSkills/gm)].map(match=>match[1]))];
  const slotOrder=slot=>{const match=slot.match(/^(skill([1-3])|defense)(?:-(\d+))?$/);return match?(match[1]==='defense'?40:Number(match[2])*10)+Number(match[3]||0):99;};
  const skills=skillFields.sort((a,b)=>slotOrder(a)-slotOrder(b)).map(field=>skill(source,field)).filter(Boolean);
  if(skills.length<3)return null;
  const passiveFields=[...new Set([...source.matchAll(/^\|(passive([12])(?:-\d+)?)=\{\{Passive/gm)].map(match=>({field:match[1],type:match[2]==='1'?'combat':'support'})))];
  const passives=passiveFields.map(item=>passive(source,item.field,item.type)).filter(Boolean);
  const catId=source.match(/\[\[Category:Identity ID\|(\d+)/)?.[1];
  return {
    id:catId||page.title, sinner:sinnerId, sinnerName:sinner, name:prefix,
    rarity:number(scalar(source,'rarity'),1), season:number(scalar(source,'season')),
    releaseDate:scalar(source,'releasedate'), world:cleanWiki(scalar(source,'world')),
    skills, passives, source:`https://limbuscompany.wiki.gg/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`
  };
}
function egoSkillVariants(source,field){
  const direct=skill(source,field);if(direct)return [direct];
  const start=source.indexOf(`|${field}=`);if(start<0)return [];
  const endMarker=`\n|${field}3=`,end=source.indexOf(endMarker,start),section=source.slice(start,end<0?source.length:end);
  const variants=[];let cursor=0,index=0;
  while((index=section.indexOf('{{Skill\n',cursor))>=0){const block=templateAtField(`|variant=${section.slice(index)}`,'variant');if(!block)break;const parsed=skill(`|variant=${block}`,'variant');if(parsed)variants.push({...parsed,slot:`${field}-${variants.length+1}`});cursor=index+block.length;}
  return variants;
}
function egoFrom(page){
  const source=page.source;if(!source.includes('{{EGPage'))return null;
  const sinner=cleanWiki(scalar(source,'sinner')), name=cleanWiki(scalar(source,'prefix'));
  const sinnerId=SINNER_ID[sinner];if(!sinnerId||!name)return null;
  const costs=Object.entries(SIN_FIELDS).map(([field,affinity])=>({affinity,cost:number(scalar(source,field))})).filter(c=>c.cost>0);
  const awakeningSkills=egoSkillVariants(source,'askill'),corrosionSkills=egoSkillVariants(source,'cskill');
  const awakeningSkill=awakeningSkills[0]||null,corrosionSkill=corrosionSkills[0]||null,egoPassive=passive(source,'passive','ego');
  const catId=source.match(/\[\[Category:E\.G\.O ID\|(\d+)/)?.[1];
  return {
    id:catId||page.title, sinner:sinnerId, sinnerName:sinner, name,
    rarity:scalar(source,'risk'), affinity:normalizeAffinity(scalar(source,'affinity')), season:number(scalar(source,'season')),
    releaseDate:scalar(source,'releasedate'), costs, sanity:{awakening:number(scalar(source,'asanity')),corrosion:number(scalar(source,'csanity'))},
    skill:awakeningSkill, awakeningSkill, corrosionSkill, awakeningSkills, corrosionSkills, passive:egoPassive,
    source:`https://limbuscompany.wiki.gg/wiki/${encodeURIComponent(page.title.replace(/ /g,'_'))}`
  };
}

function validateDataVolume(next,current,pageCount,label,{minimum,ratio=0.7,parseRatio=0.5}){
  if(next.length<minimum)throw new Error(`${label} 数据量异常：仅解析出 ${next.length} 条（最低 ${minimum}）`);
  if(current.length&&next.length<Math.ceil(current.length*ratio))throw new Error(`${label} 数据量异常：少于现有数据库的 ${Math.round(ratio*100)}%`);
  if(pageCount&&next.length<Math.ceil(pageCount*parseRatio))throw new Error(`${label} 数据量异常：Wiki 页面解析成功率低于 ${Math.round(parseRatio*100)}%`);
}

async function main(){
  console.log('读取人格目录…'); const identityTitles=await categoryMembers('Identities');
  console.log(`获取 ${identityTitles.length} 个人格页面…`); const identityPages=await pageSources(identityTitles);
  const identityParsed=identityPages.map(page=>({page,data:identityFrom(page)}));
  const identities=identityParsed.map(x=>x.data).filter(Boolean).sort((a,b)=>a.sinner-b.sinner||a.rarity-b.rarity||a.name.localeCompare(b.name));
  const skippedIdentities=identityParsed.filter(x=>!x.data).map(x=>x.page.title);
  if(skippedIdentities.length)console.warn(`跳过的人格页面 (${skippedIdentities.length}): ${skippedIdentities.join(' | ')}`);
  console.log('读取 E.G.O 目录…'); const egoTitles=await categoryMembers('E.G.O');
  console.log(`获取 ${egoTitles.length} 个 E.G.O 页面…`); const egoPages=await pageSources(egoTitles);
  const egoParsed=egoPages.map(page=>({page,data:egoFrom(page)}));
  const egos=egoParsed.map(x=>x.data).filter(Boolean).sort((a,b)=>a.sinner-b.sinner||a.name.localeCompare(b.name));
  const skippedEgos=egoParsed.filter(x=>!x.data).map(x=>x.page.title);
  if(skippedEgos.length)console.warn(`跳过的 E.G.O 页面 (${skippedEgos.length}): ${skippedEgos.join(' | ')}`);
  const [currentIdentities,currentEgos]=await Promise.all([
    fs.readFile(path.join(OUT,'identities.json'),'utf8').then(JSON.parse).catch(()=>[]),
    fs.readFile(path.join(OUT,'egos.json'),'utf8').then(JSON.parse).catch(()=>[])
  ]);
  validateDataVolume(identities,currentIdentities,identityTitles.length,'人格',{minimum:50});
  validateDataVolume(egos,currentEgos,egoTitles.length,'E.G.O',{minimum:30});
  await fs.writeFile(path.join(OUT,'identities.json'),JSON.stringify(identities,null,2),'utf8');
  await fs.writeFile(path.join(OUT,'egos.json'),JSON.stringify(egos,null,2),'utf8');
  await fs.writeFile(path.join(OUT,'data-version.json'),JSON.stringify({updatedAt:new Date().toISOString(),source:'Limbus Company Wiki.gg',identityPages:identityTitles.length,identities:identities.length,skills:identities.flatMap(identity=>identity.skills).length,variantSkills:identities.flatMap(identity=>identity.skills).filter(skill=>/-\d+$/.test(skill.slot)).length,passives:identities.flatMap(identity=>identity.passives).length,egoPages:egoTitles.length,egos:egos.length,awakeningSkills:egos.reduce((sum,ego)=>sum+ego.awakeningSkills.length,0),corrosionSkills:egos.reduce((sum,ego)=>sum+ego.corrosionSkills.length,0),egoPassives:egos.filter(ego=>ego.passive).length},null,2),'utf8');
  console.log(`完成：${identities.length} 个人格，${egos.length} 个 E.G.O`);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={validateDataVolume};
