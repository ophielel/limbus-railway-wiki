const assert=require('assert');
const Rules=require('../frontend/combat-rules.js');
const {normalizeCommonActionEffects}=require('../backend/server.js');
const fs=require('fs');

// 最小复现1：旧计算器只能填“正面数”，不能保留逐枚硬币的正/反顺序。
let profile=Rules.coinProfile({base:4,plus:3,coins:3},{faces:['H','T','H'],sp:0});
assert.deepStrictEqual(profile.faces,['H','T','H']);
assert.deepStrictEqual(profile.coinResults,[7,7,10]);
assert.equal(profile.heads,2);

// 最小复现2：旧编辑器没有人格等级，技能等级也无法由人格等级与技能修正得到。
assert.deepStrictEqual(Rules.identitySkillLevel(55,{slot:'skill2',offenseLevel:3},2),{identityLevel:55,skillLevel:60,kind:'offense'});
assert.deepStrictEqual(Rules.identitySkillLevel(50,{slot:'defense',defenseLevel:-2},3),{identityLevel:50,skillLevel:51,kind:'defense'});

// 最小复现3：旧模型不能区分正常觉醒、主动侵蚀（超频）、选用后意外侵蚀与回合开始强制侵蚀。
assert.deepStrictEqual(Rules.egoUseProfile('ego-awakening'),{skillKind:'awakening',resourceMultiplier:1,sanityMultiplier:1,sanityCostApplies:true,controllable:true,forced:false});
assert.deepStrictEqual(Rules.egoUseProfile('ego-overclock'),{skillKind:'corrosion',resourceMultiplier:1.5,sanityMultiplier:1.5,sanityCostApplies:true,controllable:true,forced:false});
assert.deepStrictEqual(Rules.egoUseProfile('ego-induced-corrosion'),{skillKind:'corrosion',resourceMultiplier:1,sanityMultiplier:1,sanityCostApplies:true,controllable:false,forced:false});
assert.deepStrictEqual(Rules.egoUseProfile('ego-forced-corrosion'),{skillKind:'corrosion',resourceMultiplier:1,sanityMultiplier:0,sanityCostApplies:false,controllable:false,forced:true});
assert.deepStrictEqual([-22,-23,-34,-45].map(Rules.corrosionChance),[0,25,75,100]);
assert.equal(Rules.egoSanityProfile('ego-induced-corrosion',0,{corrosion:20}).valid,false);
assert.deepStrictEqual(Rules.egoSanityProfile('ego-forced-corrosion',-45,{corrosion:20}),{spBefore:-45,cost:0,spAfter:-45,corrosionChance:100,valid:true});

// 后端必须依据可信部署等级与逐枚硬币重新计算，不能接受客户端伪造结果。
const plan=[{section:1,actions:[{memberKey:'id',mode:'skill',skillSlot:'skill1',identityLevel:50,targetDefenseLevel:55,coinFaces:['H','T'],heads:0,sp:0,basePowerModifier:0,coinPowerModifier:0,finalPower:0,clashPowerModifier:0,levelDifference:0,selectedPower:999}]}];
normalizeCommonActionEffects({id:4,deploymentBuffs:[{position:1,offenseLevel:2}]},plan,{id:{skills:[{slot:'skill1',base:4,plus:3,coins:2,offenseLevel:3}]}},{},[{section:1,teamData:[{key:'id',level:50}]}]);
assert.equal(plan[0].actions[0].skillLevel,55);
assert.equal(plan[0].actions[0].selectedPower,7);
assert.deepStrictEqual(plan[0].actions[0].coinFaces,['H','T']);
const appSource=fs.readFileSync(require.resolve('../frontend/app.js'),'utf8');
for(const marker of ['data-identity-level','data-action-coin-face','ego-awakening','ego-overclock','ego-induced-corrosion','ego-forced-corrosion'])assert(appSource.includes(marker),`编辑器界面缺少 ${marker}`);
const overclock=Rules.resourceLedger({Wrath:5},[{actions:[{kind:'ego',resourceMultiplier:1.5,costs:[{affinity:'Wrath',cost:3}]}]}]);
assert.equal(overclock.resources.Wrath,0,'主动侵蚀/超频应逐项向上取整消耗1.5倍资源');
console.log('editor-completeness: 逐枚硬币、人格等级与四种 E.G.O 释放路径验证通过');
