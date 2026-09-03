const assert = require('assert');
const railways = require('../backend/data/railways.json');
const Structure = require('../frontend/railway-structure.js');

const line4 = railways.find(line => line.id === 4);
const line6 = railways.find(line => line.id === 6);
const ordered = Array.from({length:12}, (_, index) => `identity-${12-index}`);
assert.deepStrictEqual(Structure.frontlineForDeployment(line4, ordered), ordered.slice(0, 6), '4 号线首发必须取部署顺序前 6 人');
assert.deepStrictEqual(Structure.frontlineForDeployment(line6, ordered), ordered.slice(0, 7), '6 号线首发必须取部署顺序前 7 人');

const sectionOneExit = Object.fromEntries(Array.from({length:12}, (_, index) => [index + 1, {hpPercent:90-index, sp:index-6}]));
const sectionStates = {1:{exit:sectionOneExit}};
assert.deepStrictEqual(Structure.sectionEntryState(line6, 2, sectionStates)[1], {hpPercent:100,sp:0}, '6 号线二区应回满 HP、SP 归零');
assert.deepStrictEqual(Structure.sectionEntryState(line6, 5, sectionStates)[1], sectionOneExit[1], '6 号线五区必须读取一区结束状态');
assert.deepStrictEqual(Structure.sectionEntryState(line6, 5, sectionStates)[12], sectionOneExit[12], '五区状态必须按罪人继承而不是按部署槽位继承');

console.log('deployment-state: 部署顺序与 HP/SP 区段继承验证通过');
