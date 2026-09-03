const assert=require('assert');
const railways=require('../backend/data/railways.json');
const Structure=require('../frontend/railway-structure.js');
const line6=railways.find(line=>line.id===6);

const mechanics={
  resistances:{2:{attackType:'Blunt',affinity:'Envy'},3:{attackType:'Slash',affinity:'Gluttony'},4:{attackType:'Pierce',affinity:'Pride'}},
  sealedPassives:{past:'past-1',present:'present-3',future:'future-3'},
  wayfarerBuffs:{3:'moth',4:'sap',5:'moth'},
  wayfarerStartTurns:{4:1,5:4}
};
let profile=Structure.line6ResistanceProfile(line6,mechanics,2,{type:'Blunt',affinity:'Envy'},1,1);
assert.deepStrictEqual(profile,{physical:1.25,affinity:1.25,total:1.5625,physicalApplied:true,affinityApplied:true});
profile=Structure.line6ResistanceProfile(line6,mechanics,3,{type:'Slash',affinity:'Wrath'},0.5,1);
assert.equal(profile.physical,0.75);assert.equal(profile.affinity,1);assert.equal(profile.total,0.75);
assert.equal(Structure.line6WayfarerOffenseBonus(line6,mechanics,3,{sameFactionCount:9}),4,'晚霞旅人的蛾最多提供4层攻击等级提升');
assert.equal(Structure.line6WayfarerOffenseBonus(line6,mechanics,4,{sameFactionCount:4}),0,'树液不提供攻击等级提升');
assert.equal(Structure.line6WayfarerOffenseBonus(line6,mechanics,5,{defeatedAllies:8,sectionTurn:4}),6,'终战晚霞旅人的蛾最多提供6层攻击等级提升');
const timed={...mechanics,wayfarerBuffs:{...mechanics.wayfarerBuffs,4:'moth'},wayfarerStartTurns:{4:6}};
assert.equal(Structure.line6WayfarerOffenseBonus(line6,timed,4,{sameFactionCount:4,sectionTurn:5}),0);
assert.equal(Structure.line6WayfarerOffenseBonus(line6,timed,4,{sameFactionCount:4,sectionTurn:6}),4);
const sap=Structure.line6WayfarerProfile(line6,mechanics,4,{sectionTurn:1});
assert.equal(sap.maxHpPercent,50);assert.equal(sap.removeFirstStaggerThreshold,true);assert.equal(sap.spHeal,0);
const finalSapMechanics={...mechanics,wayfarerBuffs:{...mechanics.wayfarerBuffs,5:'sap'},wayfarerStartTurns:{5:6}};
assert.equal(Structure.line6WayfarerProfile(line6,finalSapMechanics,5,{sectionTurn:5}).active,false);
const finalSap=Structure.line6WayfarerProfile(line6,finalSapMechanics,5,{sectionTurn:6});
assert.equal(finalSap.spHeal,4);assert.equal(finalSap.spHealTargets,4);
const disabled=Structure.line6DisabledPassives(line6,mechanics);
assert.deepStrictEqual(disabled.map(item=>item.id),['past-1','present-3','future-3']);
console.log('line6-effects: 鳞粉抗性、局内增益与终战封印验证通过');
