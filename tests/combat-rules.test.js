const assert=require('assert');
const Rules=require('../frontend/combat-rules.js');
const identities=require('../backend/data/identities.json');

// 正硬币：4 + 3 × 2；指定 1 个正面时为 7。
let profile=Rules.coinProfile({base:4,plus:3,coins:2},{heads:1,sp:0});
assert.deepStrictEqual({selected:profile.selected,min:profile.min,max:profile.max},{selected:7,min:4,max:10});
assert.equal(profile.expected,7);

// 负硬币：正面会降低点数，最大值来自 0 正面而不是全正面。
profile=Rules.coinProfile({base:30,plus:-12,coins:2},{heads:2,sp:45});
assert.deepStrictEqual({selected:profile.selected,min:profile.min,max:profile.max},{selected:6,min:6,max:30});
assert.equal(profile.headChance,.95);

// 基础、硬币、最终和拼点威力必须分开结算。
profile=Rules.coinProfile({base:4,plus:3,coins:2},{heads:2,basePowerModifier:1,coinPowerModifier:1,finalPower:2,clashPowerModifier:3});
assert.equal(profile.selected,15);
assert.equal(profile.clashSelected,18);

// 攻击权重：基础值、条件修正、实际目标和空余容量分开记录。
assert.deepStrictEqual(Rules.attackWeightProfile({attackWeight:1},{modifier:2,targetCount:1}),{base:1,modifier:2,effective:3,targetCount:1,excess:2});
assert.deepStrictEqual(Rules.attackWeightProfile({attackWeight:7},{modifier:0,targetCount:5}),{base:7,modifier:0,effective:7,targetCount:5,excess:2});

// 攻防等级差每满 3 级，只给等级更高的一方增加拼点威力。
assert.deepStrictEqual(Rules.clashLevelAdvantage(4),{difference:4,side:'self',bonus:1});
assert.deepStrictEqual(Rules.clashLevelAdvantage(-7),{difference:-7,side:'enemy',bonus:2});
assert.deepStrictEqual(Rules.clashLevelAdvantage(2),{difference:2,side:'none',bonus:0});

// 两段各 3 个连续嫉妒：普通共鸣 6，完全共鸣总和 6，最长单段 3。
const resonance=Rules.resonanceProfile(['Envy','Envy','Envy','Pride','Envy','Envy','Envy']);
assert.equal(resonance.counts.Envy,6);
assert.equal(resonance.absoluteTotals.Envy,6);
assert.equal(resonance.longest.Envy,3);

// 中指堂吉诃德：嫉妒完全共鸣总和 6 时触发 S3 反击，最多两次。
const middleDon=identities.find(x=>x.sinner===3&&x.name==='The Middle Little Sister');
assert(middleDon,'缺少中指堂吉诃德数据');
const counter=middleDon.skills.find(x=>x.name==='Multifold Retribution');
const special=Rules.evaluateSpecial(counter,resonance);
assert.deepStrictEqual({triggered:special.triggered,replacementSkill:special.replacementSkill,maxActivations:special.maxActivations},{triggered:true,replacementSkill:'A Just Vengeance',maxActivations:2});
assert.equal(Rules.evaluateSpecial(counter,Rules.resonanceProfile(['Envy','Envy','Envy'])).triggered,false);

// 中指辛克莱的多档反击：4 共鸣和 6 共鸣必须选择不同替换技能。
const middleSinclair=identities.find(x=>x.sinner===10&&x.name==='The Middle Little Brother');
const tieredCounter=middleSinclair.skills.find(x=>x.name==='Warmup in the East');
const at4=Rules.evaluateSpecial(tieredCounter,Rules.resonanceProfile(Array(4).fill('Envy')));
const at6=Rules.evaluateSpecial(tieredCounter,Rules.resonanceProfile(Array(6).fill('Envy')));
assert.equal(at4.replacementSkill,'Payback with Interest');
assert.equal(at6.replacementSkill,"Write 'em all down");

// 专属资源按回合累积，消耗不能降到 0 以下。
const states=Rules.customStateLedger('Hermes=0, 纠缠=2, 充能=10',[{stateChanges:'Hermes +3, 充能 -6'},{stateChanges:'Hermes +6, 纠缠 +1, 充能 -10'}]);
assert.deepStrictEqual(states,[{Hermes:3,纠缠:2,充能:4},{Hermes:9,纠缠:3,充能:0}]);

// E.G.O 必须使用回合开始时已有资源支付；同回合稍后产生的资源不能掩盖短缺。
let ledger=Rules.resourceLedger({Gloom:3},[{actions:[{kind:'ego',costs:[{affinity:'Gloom',cost:4}]},{kind:'skill',affinity:'Gloom'}]}]);
assert.equal(ledger.warnings[0][0].shortage,1);
assert.equal(ledger.resources.Gloom,0);
ledger=Rules.resourceLedger({Gloom:6},[{actions:[{kind:'ego',overclock:true,costs:[{affinity:'Gloom',cost:4}]}]}]);
assert.equal(ledger.resources.Gloom,0);
ledger=Rules.resourceLedger({},[{actions:[{kind:'skill',affinity:'Envy',executed:false}]}]);
assert.equal(ledger.resources.Envy,0);

// DOT/状态：只按可消耗的层数触发，不允许超额结算。
assert.deepStrictEqual(Rules.resolveStatus({kind:'Burn',potency:10,count:2,turnEnds:3}),{kind:'Burn',potency:10,count:2,triggers:2,damage:20,spLoss:0,staggerRaised:0,remainingCount:0,removed:true});
assert.equal(Rules.resolveStatus({kind:'Bleed',potency:7,count:3,events:5}).damage,21);
assert.equal(Rules.resolveStatus({kind:'Rupture',potency:8,count:4,events:2}).damage,16);
assert.equal(Rules.resolveStatus({kind:'Sinking',potency:6,count:3,events:2,target:'human'}).spLoss,12);
assert.equal(Rules.resolveStatus({kind:'Sinking',potency:6,count:3,events:2,target:'abnormality'}).damage,12);
assert.equal(Rules.resolveStatus({kind:'Tremor',potency:9,count:4,events:2,turnEnds:1}).staggerRaised,18);

// 变体技能及广域机制不能在数据更新时丢失。
const indexYiSang=identities.find(x=>x.sinner===1&&x.name==='The House of Spiders: The Index Nursefather');
const furioso=indexYiSang.skills.find(x=>x.name==='Furioso-Replica');
assert(furioso,'食指李箱缺少 Furioso-Replica 变体');
assert.deepStrictEqual({slot:furioso.slot,coins:furioso.coins,attackWeight:furioso.attackWeight},{slot:'skill3-2',coins:9,attackWeight:7});
assert(furioso.mechanics.tags.includes('unfocused-volley'));
const furiosoBoosted=Rules.coinProfile(furioso,{heads:9,coinPowerModifier:1});
assert.deepStrictEqual({selected:furiosoBoosted.selected,coinPower:furiosoBoosted.coinPower,convertedFinalPower:furiosoBoosted.convertedFinalPower},{selected:35,coinPower:3,convertedFinalPower:5});
const spiderBlade=identities.find(x=>x.sinner===4&&x.name==='Blade of the House of Spiders');
assert(spiderBlade.skills.find(x=>x.slot==='skill3').mechanics.attackWeightRules.length>0,'蜘蛛巢之刃 S3 缺少攻击权重规则');
const pinky=identities.find(x=>x.sinner===10&&x.name==='The House of Spiders: The Pinky Apprentice');
assert(pinky.skills.find(x=>x.slot==='skill2').mechanics.tags.includes('unfocused-volley'),'广域乱射未识别');

// 被动与 E.G.O 双技能数据完整性。
assert(identities.every(identity=>identity.passives?.some(p=>p.type==='combat')&&identity.passives?.some(p=>p.type==='support')),'存在缺少战斗/支援被动的人格');
const egos=require('../backend/data/egos.json');
const fluidSac=egos.find(e=>e.sinner===2&&e.name==='Fluid Sac');
assert.deepStrictEqual({awakening:fluidSac.awakeningSkill.base,corrosion:fluidSac.corrosionSkill.base,corrosionCoin:fluidSac.corrosionSkill.plus,sp:fluidSac.sanity},{awakening:16,corrosion:29,corrosionCoin:-14,sp:{awakening:20,corrosion:20}});
assert.equal(fluidSac.passive.name,'Liquid Veil');
assert(egos.every(ego=>ego.awakeningSkills?.length),'存在缺少觉醒技能的 E.G.O');
assert.equal(egos.reduce((n,ego)=>n+ego.awakeningSkills.length,0),114);

// 全量数据基本约束。
for(const identity of identities)for(const skill of identity.skills){
  const p=Rules.coinProfile(skill);
  assert(p.min<=p.max,`${identity.name}/${skill.name} 点数范围反转`);
  assert(Number.isFinite(p.selected),`${identity.name}/${skill.name} 点数不是数值`);
  assert(skill.coins>=1,`${identity.name}/${skill.name} 硬币数无效`);
}
console.log(`combat-rules: ${identities.length} 个人格、${identities.flatMap(x=>x.skills).length} 个技能验证通过`);
