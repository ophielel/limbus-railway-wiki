const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const identities = require('../backend/data/identities.json');
const egos = require('../backend/data/egos.json');
const { server } = require('../backend/server.js');

const axesFile = path.join(__dirname, '..', 'backend', 'data', 'axes.json');
const identity = identities[0];
const identityKey = String(identity.id);
const skill = identity.skills[0];

function payload(overrides = {}) {
  return {
    title: ' HTTP 集成测试 ', author: ' tester ', desc: ' server validation ',
    railway: '1号线', turns: 999,
    teamData: [{ key: identityKey, sinner: identity.sinner, name: '伪造人格名', rarity: 3, level: 50 }],
    plan: [{ turn: 88, section: 1, sectionTurn: 77, actions: [{
      memberKey: identityKey, member: '伪造成员名', mode: 'skill', skillSlot: skill.slot,
      choice: '伪造技能名', affinity: 'Wrath', skillAffinity: 'Wrath', egoRisk: 'ALEPH', executed: true
    }]}],
    initialResources: {}, finalResources: { Wrath: 999 },
    ...overrides
  };
}

async function request(base, body, options = {}) {
  const response = await fetch(`${base}/api/axes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: options.raw ? body : JSON.stringify(body)
  });
  let json = {};
  try { json = await response.json(); } catch {}
  return { status: response.status, body: json };
}

function line4Payload() {
  const teamData = Array.from({ length: 12 }, (_, index) => {
    const item = identities.find(value => value.sinner === index + 1);
    return { key: String(item.id), sinner: item.sinner, name: item.name, rarity: item.rarity, level: 50 };
  });
  return payload({
    railway: '4号线',
    deployments: [1, 2, 3, 4].map(section => ({ section, teamData, team: teamData.map(item => item.name) })),
    plan: [1, 3, 2, 4].map((section, index) => ({ turn: index + 20, section, sectionTurn: 9, actions: [] }))
  });
}

(async () => {
  const originalAxes = await fs.readFile(axesFile);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const forged = await request(base, payload());
    assert.equal(forged.status, 201);
    assert.equal(forged.body.turns, 1, '总回合数必须根据 plan 计算');
    assert.equal(forged.body.plan[0].turn, 1, 'turn 必须由后端重排');
    assert.equal(forged.body.plan[0].sectionTurn, 1, 'sectionTurn 必须由后端重排');
    assert.equal(forged.body.plan[0].actions[0].member, `${identity.sinnerName}·${identity.name}`, '人格名称必须来自数据库');
    assert(forged.body.plan[0].actions[0].choice.includes(skill.name), '技能名称必须来自数据库');
    assert.equal(forged.body.plan[0].actions[0].skillAffinity, skill.affinity, '罪孽属性必须来自数据库');
    assert.equal(forged.body.finalResources[skill.affinity], 1, '七罪资源必须由真实技能重算');

    const ego=egos.find(item=>item.sinner===identity.sinner&&item.awakeningSkills?.length),egoSkill=ego.awakeningSkills[0],initial=Object.fromEntries(['Wrath','Lust','Sloth','Gluttony','Gloom','Pride','Envy'].map(sin=>[sin,10]));
    const egoSaved=await request(base,payload({initialResources:initial,plan:[{section:1,actions:[{memberKey:identityKey,mode:'ego-awakening',egoId:String(ego.id),skillSlot:egoSkill.slot,sp:45,choice:'伪造 E.G.O',egoRisk:'ALEPH'}]}]}));
    assert.equal(egoSaved.status,201);
    assert.equal(egoSaved.body.plan[0].actions[0].egoName,ego.name,'E.G.O 名称必须来自数据库');
    assert.equal(egoSaved.body.plan[0].actions[0].egoRisk,ego.rarity,'E.G.O 等级必须来自数据库');
    for(const cost of ego.costs)assert.equal(egoSaved.body.finalResources[cost.affinity],10-cost.cost,'E.G.O 资源消耗必须由后端重算');

    assert.equal((await request(base, payload({ railway: '999号线' }))).status, 400, '非法 railway 应拒绝');
    assert.equal((await request(base, payload({ plan: [{ section: 1, actions: [{ memberKey: 'missing', mode: 'skill', skillSlot: 'skill1' }] }] }))).status, 400, '非法 memberKey 应拒绝');
    assert.equal((await request(base, payload({ plan: [{ section: 1, actions: [{ memberKey: identityKey, mode: 'skill', skillSlot: 'does-not-exist' }] }] }))).status, 400, '非法 skillSlot 应拒绝');
    assert.equal((await request(base, payload({ plan: [{ section: 1, actions: [{ memberKey: identityKey, mode: 'ego-awakening', egoId: 'missing', skillSlot: 'askill', sp: 45 }] }] }))).status, 400, '非法 E.G.O 应拒绝');
    assert.equal((await request(base, line4Payload())).status, 400, '连续战区段倒退/跳跃应拒绝');
    assert.equal((await request(base, payload({ plan: [{ section: 1.5, actions: [] }] }))).status, 400, 'section 小数应拒绝');
    assert.equal((await request(base, payload({ teamData: [{ key: identityKey, sinner: 1, level: 49.5 }] }))).status, 400, '等级小数应拒绝');
    assert.equal((await request(base, payload({ title: '   ' }))).status, 400, 'trim 后空标题应拒绝');
    assert.equal((await request(base, '{bad json', { raw: true })).status, 400, '非法 JSON 应返回 400');
    assert.equal((await request(base, JSON.stringify({ data: 'x'.repeat(2_000_001) }), { raw: true })).status, 413, '过大请求体应返回 413');
    assert.equal((await request(base, payload({ plan: Array.from({ length: 201 }, () => ({ section: 1, actions: [] })) }))).status, 400, '超过 200 回合应拒绝而不是截断');

    const before = JSON.parse(await fs.readFile(axesFile, 'utf8')).length;
    const concurrent = await Promise.all(Array.from({ length: 12 }, (_, index) => request(base, payload({ title: `并发-${index}` }))));
    assert(concurrent.every(result => result.status === 201), '并发保存均应成功');
    const after = JSON.parse(await fs.readFile(axesFile, 'utf8')).length;
    assert.equal(after - before, 12, '并发保存不能丢档案');
    console.log('http-integration: 后端信任边界、错误状态、原子并发保存验证通过');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.writeFile(axesFile, originalAxes);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
