const assert = require('assert');
const railways = require('../backend/data/railways.json');

const line4=railways.find(line=>line.id===4),line5=railways.find(line=>line.id===5),line6=railways.find(line=>line.id===6);
assert.equal(line4.deploymentBuffs.length,12);
assert.equal(line4.deploymentBuffs[6].clashPower,1);
assert.equal(line4.deploymentBuffs[10].finalPower,1);
assert.equal(line4.deploymentBuffs[11].entrySp,30);

assert.equal(line5.recordRules.type,'buff-trials');
assert.deepStrictEqual(line5.recordRules.stations,[1,2,3,4,5,6,7,8,9,10],'5号线应记录终点前十次 Buff/Trial 选择');
assert.equal(new Set(line5.recordRules.buffNames).size,line5.recordRules.buffNames.length,'Buff 名称不能重复');
assert(line5.recordRules.buffNames.includes('折射的嫉妒')&&line5.recordRules.trialNames.includes('攻击性折射'));
assert.deepStrictEqual(line5.recordRules.stations.map(station=>line5.recordRules.stationPools[station].buffs.length),[3,9,9,3,6,6,4,24,24,5]);
assert.deepStrictEqual(line5.recordRules.stations.map(station=>line5.recordRules.stationPools[station].trials.length),[1,2,2,2,5,5,1,10,10,3]);

assert.equal(line6.recordRules.type,'butterfly-choices');
assert.deepStrictEqual(line6.recordRules.resistanceSections,[2,3,4]);
assert.deepStrictEqual(line6.recordRules.attackTypes,['Slash','Pierce','Blunt']);
assert.equal(line6.recordRules.affinities.length,7);
assert.equal(line6.recordRules.resistanceModifier,0.25);
assert.deepStrictEqual(line6.recordRules.sealEvents.map(event=>event.key),['past','present','future']);
assert(line6.recordRules.sealEvents.every(event=>event.options.length===3));
assert.deepStrictEqual(line6.recordRules.wayfarerEvents.map(event=>event.section),[3,4,5]);
assert.deepStrictEqual(line6.recordRules.wayfarerEvents.filter(event=>event.manualTrigger).map(event=>event.section),[4,5]);
assert.deepStrictEqual(line6.recordRules.wayfarerOptions.standard.map(option=>option.id),['sap','moth','refuse']);

console.log('line-mechanics: 5/6号线专属路线选择验证通过');
