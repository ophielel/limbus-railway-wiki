const assert = require('assert');
const fs = require('fs/promises');
const fsSync = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const identities = require('../backend/data/identities.json');
const egos = require('../backend/data/egos.json');
const officialAxesFile=path.join(__dirname,'..','backend','data','axes.json');
const tempDir=fsSync.mkdtempSync(path.join(os.tmpdir(),'railway-wiki-test-'));
const axesFile=path.join(tempDir,'axes.json');
fsSync.writeFileSync(axesFile,'[]\n');
process.env.AXES_FILE=axesFile;
const {server}=require('../backend/server.js');
const {server:frontendServer}=require('../frontend/server.js');
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

function rawRequest(port,urlPath,host='127.0.0.1'){
  return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:urlPath,headers:{Host:host}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
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

(async()=>{
  const officialAxes=await fs.readFile(officialAxesFile);
  await Promise.all([
    new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)),
    new Promise(resolve=>frontendServer.listen(0,'127.0.0.1',resolve))
  ]);
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    assert.equal(await rawRequest(frontendServer.address().port,'/%E0%A4%A'),400,'前端畸形 URL 应返回 400');
    assert.equal(await rawRequest(frontendServer.address().port,'/'),200,'畸形 URL 后前端进程应继续服务');
    assert.equal(await rawRequest(server.address().port,'/api/health','['),400,'后端畸形 URL 应返回 400');
    assert.equal(await rawRequest(server.address().port,'/api/health'),200,'畸形 URL 后后端进程应继续服务');
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
    assert.equal((await request(base,payload({plan:Array.from({length:201},()=>({section:1,actions:[]}))}))).status,400,'超过 200 回合应拒绝而不是截断');
    const validAction={memberKey:identityKey,mode:'skill',skillSlot:skill.slot},atLimit=await request(base,payload({plan:[{section:1,actions:Array.from({length:20},()=>({...validAction})),branches:Array.from({length:10},()=>({condition:'条件',result:'结果'}))}]}));
    assert.equal(atLimit.status,201);assert.equal(atLimit.body.plan[0].actions.length,20,'已验证的行动必须全部保存');assert.equal(atLimit.body.plan[0].branches.length,10,'已验证的分支必须全部保存');
    assert.equal((await request(base,payload({plan:[{section:1,actions:Array.from({length:21},()=>({...validAction}))}]}))).status,400,'单回合超过 20 个行动应拒绝而不是截断');
    assert.equal((await request(base,payload({plan:[{section:1,actions:[],branches:Array.from({length:11},()=>({condition:'条件',result:'结果'}))}]}))).status,400,'单回合超过 10 个分支应拒绝而不是截断');

    const before = JSON.parse(await fs.readFile(axesFile, 'utf8')).length;
    const concurrent = await Promise.all(Array.from({ length: 12 }, (_, index) => request(base, payload({ title: `并发-${index}` }))));
    assert(concurrent.every(result => result.status === 201), '并发保存均应成功');
    const after = JSON.parse(await fs.readFile(axesFile, 'utf8')).length;
    assert.equal(after - before, 12, '并发保存不能丢档案');
    console.log('http-integration: 后端信任边界、错误状态、原子并发保存验证通过');
  }finally{
    await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>frontendServer.close(resolve))]);
    assert.deepEqual(await fs.readFile(officialAxesFile),officialAxes,'HTTP 测试不得修改正式 axes.json');
    await fs.rm(tempDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
