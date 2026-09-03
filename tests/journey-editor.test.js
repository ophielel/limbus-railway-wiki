const assert = require('assert');
const railways = require('../backend/data/railways.json');
const Rules = require('../frontend/combat-rules.js');
const Structure = require('../frontend/railway-structure.js');

const line4 = railways.find(line => line.id === 4);
const line5 = railways.find(line => line.id === 5);
const line6 = railways.find(line => line.id === 6);

for (const line of [line4, line5, line6]) {
  assert.equal(line.deploymentRules?.size, 12, `${line.id} 号线必须按 12 人分区部署`);
  assert.equal(Structure.editorTargets(line).length, 0, `${line.id} 号线不应再拆成单独区段档案`);
  assert(line.sectionTransitions?.every(rule => rule.egoResources === 'carry'), `${line.id} 号线七罪资源必须跨区段继承`);
}
assert.deepStrictEqual(line5.deploymentRules.restrictions, [{section:2,excludeSection:1}], '5 号线二区必须禁用一区人格');
assert.deepStrictEqual(line6.deploymentRules.restrictions, [{section:3,excludeSection:2},{section:4,excludeSection:3}], '6 号线相邻区段禁用规则错误');
assert.equal(line6.sectionTransitions.find(rule=>rule.toSection===5).hpSpSource, 'section-1-clear', '6 号线第五区必须继承第一区结束状态');

const identityByKey={},team=(prefix)=>Array.from({length:12},(_,index)=>{const key=`${prefix}-${index+1}`;identityByKey[key]={sinner:index+1};return key;});
const first=team('a'),second=team('b');
assert.equal(Structure.validateDeployments(line5,{1:first,2:second,3:first},identityByKey).length,0,'5 号线合法换队被错误拦截');
assert(Structure.validateDeployments(line5,{1:first,2:first,3:first},identityByKey).some(error=>error.type==='restricted-identity'),'5 号线重复使用一区人格没有被拦截');
assert.equal(Structure.validateDeployments(line6,{1:first,2:first,3:second,4:first,5:first},identityByKey).length,0,'6 号线合法相邻换队被错误拦截');

const journey = Rules.journeyResourceLedger({Gloom:2}, [
  {section:1, actions:[{kind:'skill',affinity:'Gloom'}]},
  {section:2, actions:[{kind:'ego',costs:[{affinity:'Gloom',cost:2}]}]},
  {section:3, actions:[{kind:'skill',affinity:'Envy'}]}
], 3);
assert.equal(journey.sections[0].exit.Gloom, 3);
assert.equal(journey.sections[1].entry.Gloom, 3, '二区必须继承一区七罪资源');
assert.equal(journey.sections[1].exit.Gloom, 1);
assert.equal(journey.sections[2].entry.Gloom, 1, '三区必须继承二区七罪资源');
assert.equal(journey.resources.Envy, 1);

console.log('journey-editor: 全线区段部署与资源继承验证通过');
