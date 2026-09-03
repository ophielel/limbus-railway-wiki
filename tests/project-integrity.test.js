const assert = require('assert');
const fs = require('fs');
const railways = require('../backend/data/railways.json');
const identities = require('../backend/data/identities.json');
const egos = require('../backend/data/egos.json');
const version = require('../backend/data/data-version.json');

const indexHTML = fs.readFileSync(require.resolve('../frontend/index.html'), 'utf8');
assert(!indexHTML.includes('<strong>57</strong><small>BEST RECORD</small>'), '首页仍展示伪造的 57 回合最佳记录');
assert(indexHTML.includes('id="heroBest"'), '首页最佳记录没有动态数据挂载点');

assert.equal(version.identities, identities.length, '人格版本计数不一致');
assert.equal(version.skills, identities.flatMap(identity => identity.skills).length, '技能版本计数不一致');
assert.equal(version.awakeningSkills, egos.reduce((sum, ego) => sum + (ego.awakeningSkills?.length || 0), 0), '觉醒技能版本计数不一致');
assert.equal(version.corrosionSkills, egos.reduce((sum, ego) => sum + (ego.corrosionSkills?.length || 0), 0), '侵蚀技能版本计数不一致');
assert.equal(railways.reduce((sum, line) => sum + line.stations.length, 0), 67, '路线节点总数不一致');

console.log('project-integrity: 首页记录与数据版本一致性验证通过');
