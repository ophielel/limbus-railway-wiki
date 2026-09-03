const assert=require('assert');
const railways=require('../backend/data/railways.json');
const Structure=require('../frontend/railway-structure.js');
const Rules=require('../frontend/combat-rules.js');
const {recomputeJourneyResources,normalizeLine5ActionEffects}=require('../backend/server.js');
const identities=require('../backend/data/identities.json');
const egos=require('../backend/data/egos.json');
const line5=railways.find(line=>line.id===5);
const choices={buffTrials:{
  1:{buff:'施加量折射',trial:'成长折射 I'},
  2:{buff:'折射的呼吸法',trial:'绽放之血'},
  3:{buff:'折射的沉沦',trial:'成长折射 I'},
  4:{buff:'一息',trial:'成长折射 II'},
  5:{buff:'生死决断',trial:'生死决断'},
  6:{buff:'体力扭曲',trial:'体力折射'},
  7:{buff:'血之庆典',trial:'伤害折射'},
  8:{buff:'折射的暴怒',trial:'攻击性折射'},
  9:{buff:'威力轮盘',trial:'威力轮盘'},
  10:{buff:'折射的斩击',trial:'中等风险'}
}};
assert.deepStrictEqual(Structure.validateLine5Choices(line5,choices.buffTrials),[]);
assert.deepStrictEqual(Structure.line5AllowedOptions(line5,1).buffs,['施加量折射','获得量折射','折射的理智']);
assert(Structure.line5AllowedOptions(line5,10).buffs.includes('安乐'));
const duplicate=JSON.parse(JSON.stringify(choices.buffTrials));duplicate[3].buff='折射的呼吸法';
assert(Structure.validateLine5Choices(line5,duplicate).some(error=>error.type==='duplicate-buff'));

assert.deepStrictEqual(Structure.line5ActiveBuffs(line5,choices,1),[],'站点1通关后取得的增益不能在站点1战斗中提前生效');
const profile=Structure.line5BuffProfile(line5,choices,11,{mode:'ego-awakening',skillType:'Slash',affinity:'Wrath',coinPower:2,critical:true,poisePotency:12,poiseCount:8,targetSp:-10,sinkingPotency:20,bloodfeastConsumed:150,rouletteFinalPower:2});
assert.equal(profile.damageBonusPercent,155,'E.G.O、呼吸法、沉沦、生死决断、血餐与暴怒伤害加成应累计');
assert.equal(profile.damageMultiplier,2.55);
assert.equal(profile.finalPower,2);
assert.equal(profile.coinPowerModifier,1);
assert.equal(profile.maxHpPercent,25);
const negativeCoin=Structure.line5BuffProfile(line5,choices,11,{skillType:'Slash',affinity:'Pride',coinPower:-3});
assert.equal(negativeCoin.coinPowerModifier,-1,'折射的斩击应让减算硬币威力-1');
const trials=Structure.line5TrialProfile(line5,choices,11);
assert.equal(trials.enemyLevel,4);
assert.equal(trials.enemyClashPower,1);
assert.equal(trials.enemyDamagePercent,20);
assert.equal(trials.allyMaxHpPercent,-25);
const vaporized=Rules.resourceLedger({Wrath:8,Lust:2,Sloth:5,Gluttony:0,Gloom:0,Pride:0,Envy:0},[{actions:[{kind:'ego',executed:true,costs:[{affinity:'Wrath',cost:2}],vaporizeHighest:2}]}]);
assert.equal(vaporized.resources.Wrath,5,'觉醒E.G.O扣费后应再从剩余最多的资源扣1');
assert.equal(vaporized.resources.Sloth,4,'资源挥发应额外扣除第二种高资源');
const reaped=Rules.resourceLedger({},[{actions:[{kind:'skill',executed:true,affinity:'Envy',bonusResourceOnKill:2}]}]);
assert.equal(reaped.resources.Envy,3,'技能自身+1后，资源收获应在击杀时再获得2点同属性资源');
const identity=identities[0],skill=identity.skills.find(item=>item.slot==='skill1'),backendChoices={buffTrials:{5:{buff:'资源收获',trial:'资源挥发'}}};
const backendLedger=recomputeJourneyResources(line5,backendChoices,[{section:2,station:7,deaths:[],actions:[{memberKey:String(identity.id),mode:'skill',skillSlot:skill.slot,executed:true,defeatedTarget:true}]}],{},Object.fromEntries(identities.map(item=>[String(item.id),item])),Object.fromEntries(egos.map(item=>[String(item.id),item])));
assert.equal(backendLedger.resources[skill.affinity],3,'后端必须依据真实技能重新计算资源收获');
const normalizedPlan=[{section:3,station:11,line5TrialProfile:null,actions:[{memberKey:String(identity.id),mode:'skill',skillSlot:skill.slot,heads:skill.coins,sp:0,basePowerModifier:0,coinPowerModifier:0,finalPower:0,clashPowerModifier:0,levelDifference:0,rawDamage:100,targetPhysicalResistance:1,targetAffinityResistance:1,selectedPower:999}]}];
normalizeLine5ActionEffects(line5,choices,normalizedPlan,Object.fromEntries(identities.map(item=>[String(item.id),item])),Object.fromEntries(egos.map(item=>[String(item.id),item])));
assert.notEqual(normalizedPlan[0].actions[0].selectedPower,999,'后端不能信任客户端提交的伪造威力');
assert.equal(normalizedPlan[0].actions[0].damageMultiplier,1+normalizedPlan[0].actions[0].line5BuffProfile.damageBonusPercent/100,'后端与前端应使用同一增益倍率');
console.log('line5-effects: 站点池、永久累积、行动与资源修正验证通过');
