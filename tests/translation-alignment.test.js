const assert=require('assert');
const fs=require('fs');
const railways=require('../backend/data/railways.json');
const line=id=>railways.find(item=>item.id===id);
const cnStation=name=>name.split(' / ')[0];

const expected={
  4:{1:'宴会',2:'井底',3:'歪曲',5:'锤钉',6:'云雾',7:'骨肉',9:'赝作',10:'梦想',12:'难关',13:'盛宴'},
  5:{1:'依恋',2:'狩猎',3:'源头',4:'喷雾',5:'击锤',6:'狂奔',7:'忘却',8:'母性',9:'反叛',10:'血罪',11:'渴望'},
  6:{1:'悬衣',2:'染污',3:'童心',4:'现象',5:'盘错',6:'沉溺',7:'蒙昧',8:'到来'}
};
for(const[id,stations]of Object.entries(expected))for(const[no,name]of Object.entries(stations))assert.equal(cnStation(line(Number(id)).stations.find(item=>item.no===Number(no)).name),name,`${id}号线站点${no}译名未与中文维基对齐`);
assert(line(6).stations[0].boss.includes('折射的罗生蝶::蛹 / Refracted Butterfly of Entangled Lives::The Pupa'));
assert(line(6).recordRules.buffNames===undefined);
assert(line(5).recordRules.buffNames.includes('施加量折射'));
assert.equal(line(5).recordRules.buffNames.length,line(5).recordRules.buffEnglishNames.length,'5号线增益的中英文对照数量不一致');
assert.equal(line(5).recordRules.trialNames.length,line(5).recordRules.trialEnglishNames.length,'5号线苦难的中英文对照数量不一致');
assert(line(6).recordRules.wayfarerOptions.standard.some(option=>option.label==='匆匆离开。'));
for(const id of [4,5,6])assert(line(id).source.includes('limbuscompany.huijiwiki.com'));

const ui=['frontend/app.js','frontend/combat-rules.js','frontend/index.html'].map(path=>fs.readFileSync(path,'utf8')).join('\n');
for(const obsolete of ['绝对共鸣','进攻等级','夕照飞蛾','>燃烧<'])assert(!ui.includes(obsolete),`仍存在未对齐术语：${obsolete}`);
console.log('translation-alignment: 4～6号线译名与灰机中文维基对齐验证通过');
