const assert=require('assert');
const railways=require('../backend/data/railways.json');
const Structure=require('../frontend/railway-structure.js');
const line5=railways.find(line=>line.id===5);
const line6=railways.find(line=>line.id===6);

// 最小复现：旧模型给每个站点暴露同一份全局列表，站点1可以错误选择终战增益。
assert(line5.recordRules.stationPools,'5号线缺少按站点划分的增益/苦难池');
assert(!Structure.line5AllowedOptions(line5,1).buffs.includes('折射的斩击'),'站点1错误允许终战增益“折射的斩击”');
assert(Structure.validateLine5Choices(line5,{1:{buff:'折射的斩击',trial:'成长折射 I'}}).length>0,'非法跨站点选择未被拒绝');

// 最小复现：动态事件应直接在对应回合勾选触发，而不是要求用户计算并填写回合数。
const manualTurns=[{section:4,sectionTurn:2,wayfarerTriggered:true},{section:5,sectionTurn:6,wayfarerTriggered:true}];
assert.deepStrictEqual(Structure.line6ManualTriggerTurns(manualTurns),{4:2,5:6});
assert.deepStrictEqual(Structure.validateLine6ManualTriggers(line6,manualTurns),[]);
assert(Structure.validateLine6ManualTriggers(line6,[...manualTurns,{section:5,sectionTurn:7,wayfarerTriggered:true}]).some(error=>error.type==='duplicate-trigger'));

// 终战事件不能固定在第4回合。
const finalEvent=line6.recordRules.wayfarerEvents.find(event=>event.section===5);
assert(finalEvent.requiresStartTurn&&!finalEvent.startTurn,'终战事件应由逐回合选项手动触发，不能固定为第4回合');
assert.equal(Structure.line6WayfarerOffenseBonus(line6,{wayfarerBuffs:{5:'moth'},wayfarerStartTurns:{5:6}},5,{defeatedAllies:3,sectionTurn:5}),0);
assert.equal(Structure.line6WayfarerOffenseBonus(line6,{wayfarerBuffs:{5:'moth'},wayfarerStartTurns:{5:6}},5,{defeatedAllies:3,sectionTurn:6}),3);

// 最小复现：5号线若跳过站点或把后续站点排在前面，会提前套用尚未取得的增益。
assert(Structure.validateLine5TurnStations(line5,[{section:1,station:1},{section:1,station:3},{section:1,station:2}]).length>0);
assert(Structure.validateLine5TurnStations(line5,line5.stations.map(station=>({section:station.section,station:station.no}))).length===0);

// 最小复现：4号线攻击等级增益不应错误加到防御技能，防御技能应读取防御等级。
assert.equal(Structure.deploymentLevelBonus({level:1,offenseLevel:2,defenseLevel:4},{slot:'skill1',type:'Slash'}),3);
assert.equal(Structure.deploymentLevelBonus({level:1,offenseLevel:2,defenseLevel:4},{slot:'defense',type:'Defense'}),5);
assert.equal(Structure.line4EntrySp({entrySp:15},{skills:[{slot:'skill1',plus:2}]},0),15);
assert.equal(Structure.line4EntrySp({entrySp:15},{skills:[{slot:'skill1',plus:-2}]},0),-15,'减算硬币人格应反向获得入场理智值');

console.log('line-mechanic-regressions: 4号线等级、5号线站点池与6号线动态事件回归通过');
