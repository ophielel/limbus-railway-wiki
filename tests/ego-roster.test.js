const assert = require('assert');
const Structure = require('../frontend/railway-structure.js');
const Rules = require('../frontend/combat-rules.js');

const deployment = Array.from({length:12}, (_, index) => `member-${index+1}`);
const timeline = Structure.rosterTimeline(deployment, 6, [
  {deaths:['member-2','member-5']},
  {deaths:['member-7']},
  {deaths:[]}
]);
assert.deepStrictEqual(timeline[0].entry, deployment.slice(0,6), '首回合应为前6人首发');
assert.deepStrictEqual(timeline[0].exit, ['member-1','member-3','member-4','member-6','member-7','member-8'], '阵亡后应按部署顺序补入两名替补');
assert.deepStrictEqual(timeline[1].entry, timeline[0].exit, '下一回合必须继承补位后的场上成员');
assert(timeline[1].exit.includes('member-9')&&!timeline[1].exit.includes('member-7'), '替补阵亡后应继续补入下一位');

const egoById={z1:{id:'z1',sinner:1,rarity:'ZAYIN'},h1:{id:'h1',sinner:1,rarity:'HE'},z2:{id:'z2',sinner:2,rarity:'ZAYIN'}};
const loadouts={1:{1:{ZAYIN:'z1',HE:'h1'},2:{ZAYIN:'z2'}}};
assert.equal(Structure.isEgoEquipped(loadouts,1,1,'z1',egoById),true);
assert.equal(Structure.isEgoEquipped(loadouts,1,1,'z2',egoById),false,'不能使用其他罪人的 E.G.O');
assert.equal(Structure.isEgoEquipped(loadouts,2,1,'z1',egoById),false,'E.G.O 装备不能无条件跨区段');

const deathDelta=Structure.deathResourceDelta({skills:[{slot:'skill1',affinity:'Wrath'},{slot:'skill2',affinity:'Gloom'},{slot:'skill3',affinity:'Wrath'}]});
assert.equal(deathDelta.Wrath,4);assert.equal(deathDelta.Gloom,2);
const deathLedger=Rules.journeyResourceLedger({},[{section:1,actions:[],resourceDelta:deathDelta}],1);
assert.equal(deathLedger.resources.Wrath,4,'人格阵亡应自动给予 S1×1 与 S3×3 资源');
assert.equal(deathLedger.resources.Gloom,2,'人格阵亡应自动给予 S2×2 资源');

console.log('ego-roster: 分区 E.G.O 与链式替补验证通过');
