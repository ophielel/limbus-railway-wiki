const assert=require('assert');
const railways=require('../backend/data/railways.json');
const Structure=require('../frontend/railway-structure.js');
const Rules=require('../frontend/combat-rules.js');
const {normalizeLine6ActionEffects,recomputeJourneyResources}=require('../backend/server.js');
const line6=railways.find(line=>line.id===6);

// 最小复现：6号线可在整条线路中使用两种不同的光之树苗能力，旧编辑器无法记录或计算。
assert.equal(line6.recordRules.saplingOfLight.maxUses,2);
assert.deepStrictEqual(line6.recordRules.saplingOfLight.abilities.map(item=>item.id),['pigritia','superbia','morositas','ira']);
const turns=[
  {section:2,sectionTurn:2,saplingAbility:'morositas',actions:[]},
  {section:2,sectionTurn:3,saplingAbility:'',actions:[]},
  {section:5,sectionTurn:4,saplingAbility:'ira',saplingTargetMemberKey:'ryoshu',actions:[{memberKey:'ryoshu',mode:'skill',skillSlot:'skill3'}]}
];
assert.deepStrictEqual(Structure.validateLine6SaplingUses(line6,turns),[]);
assert.equal(Structure.line6SaplingProfile(line6,turns,1).morositasActive,true);
assert.equal(Structure.line6SaplingProfile(line6,turns,1).offenseLevel,3);
assert.equal(Structure.line6SaplingProfile(line6,turns,1).defenseLevel,6);
assert.equal(Structure.line6SaplingProfile(line6,turns,2,{memberKey:'ryoshu',mode:'skill',skill:{slot:'skill3',plus:4}}).iraActive,true);
assert.equal(Structure.line6SaplingProfile(line6,turns,2,{memberKey:'ryoshu',mode:'skill',skill:{slot:'skill3',plus:4}}).coinPowerModifier,1);
assert.equal(Structure.line6SaplingProfile(line6,turns,2,{memberKey:'ryoshu',mode:'skill',skill:{slot:'skill3',plus:4}}).damagePercent,100);
assert(Structure.validateLine6SaplingUses(line6,[...turns,{section:5,sectionTurn:5,saplingAbility:'pigritia',actions:[]}]).some(error=>error.type==='too-many'));
assert(Structure.validateLine6SaplingUses(line6,[turns[0],{section:3,sectionTurn:1,saplingAbility:'morositas',actions:[]}]).some(error=>error.type==='duplicate'));
assert(Structure.validateLine6SaplingUses(line6,[{section:1,sectionTurn:1,saplingAbility:'superbia',actions:[{mode:'skill'}]}]).some(error=>error.type==='superbia-target'));
assert.deepStrictEqual(Structure.validateLine6SaplingUses(line6,[{section:1,sectionTurn:1,saplingAbility:'superbia',actions:[{mode:'ego-awakening',executed:true,saplingFreeEgo:true}]}]),[]);
assert.equal(Structure.line6SaplingProfile(line6,[{section:1,sectionTurn:1,saplingAbility:'pigritia',actions:[]}],0).enemySpeedMultiplier,0.5);

// SUPERBIA 指定的单个 E.G.O 不消耗罪孽资源。
const ledger=Rules.resourceLedger({Wrath:4},[{actions:[{kind:'ego',costs:[{affinity:'Wrath',cost:4}],freeCost:true}]}]);
assert.equal(ledger.resources.Wrath,4);
const mechanics={resistances:{},wayfarerBuffs:{},wayfarerStartTurns:{}};
const iraPlan=[{section:5,sectionTurn:1,saplingAbility:'ira',saplingTargetMemberKey:'ryoshu',deaths:[],actions:[{memberKey:'ryoshu',mode:'skill',skillSlot:'skill3',heads:2,sp:0,basePowerModifier:0,coinPowerModifier:0,finalPower:0,clashPowerModifier:0,levelDifference:0,targetPhysicalResistance:1,targetAffinityResistance:1,sameFactionCount:0,rawDamage:100}]}];
normalizeLine6ActionEffects(line6,mechanics,iraPlan,{ryoshu:{skills:[{slot:'skill3',type:'Slash',affinity:'Wrath',base:5,plus:3,coins:2}]}},{});
assert.equal(iraPlan[0].actions[0].selectedPower,13,'后端必须重算 IRA 的硬币威力+1');
assert.equal(iraPlan[0].actions[0].adjustedDamage,200,'后端必须重算 IRA 的伤害+100%');
assert.equal(iraPlan[0].actions[0].iraHealing,20,'后端必须计算 IRA 的10%吸血');
const freePlan=[{section:1,saplingAbility:'superbia',deaths:[],actions:[{memberKey:'x',mode:'ego-awakening',egoId:'e',skillSlot:'awakening',executed:true,saplingFreeEgo:true}]}];
const freeJourney=recomputeJourneyResources(line6,{},freePlan,{Wrath:4},{x:{skills:[]}},{e:{costs:[{affinity:'Wrath',cost:4}],awakeningSkills:[{slot:'awakening',affinity:'Wrath'}]}});
assert.equal(freeJourney.resources.Wrath,4,'后端资源账本必须忽略 SUPERBIA 指定 E.G.O 的罪孽消耗');
console.log('line6-sapling: 光之树苗次数、楼层效果与免费 E.G.O 验证通过');
