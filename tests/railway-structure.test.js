const assert = require('assert');
const railways = require('../backend/data/railways.json');
const RailwayStructure = require('../frontend/railway-structure.js');

const expectedSections = {
  4: [[1, 2, 3], [5, 6, 7], [9, 10], [12, 13]],
  5: [[1, 2, 3, 4], [5, 6, 7], [8, 9, 10, 11]],
  6: [[1], [2], [3, 4], [5, 6, 7], [8]]
};

for (const line of railways.filter(item => item.id <= 3)) {
  assert.equal(RailwayStructure.libraryItems(line).length, line.stationCount, `${line.id} 号线不应被连续战分组影响`);
}

for (const [lineId, expected] of Object.entries(expectedSections)) {
  const line = railways.find(item => item.id === Number(lineId));
  assert(line, `缺少 ${lineId} 号线`);
  assert.equal(line.battleFormat, 'continuous-sections', `${lineId} 号线未标记为区段连续战`);
  assert.equal(line.sectionCount, expected.length, `${lineId} 号线区段数错误`);
  const actual = Array.from({length: line.sectionCount}, (_, index) =>
    line.stations.filter(station => station.type !== '休息' && station.section === index + 1).map(station => station.no)
  );
  assert.deepStrictEqual(actual, expected, `${lineId} 号线站点没有归入正确的连续战区段`);
  assert.equal(RailwayStructure.libraryItems(line).length, expected.length, `${lineId} 号线图鉴仍把每批敌人显示成独立战斗`);
  assert.equal(RailwayStructure.editorTargets(line).length, 0, `${lineId} 号线编辑器仍把全线拆成单独区段档案`);
  const expectedRestStops=Number(lineId)===4?[4,8,11,null]:Array(expected.length).fill(null);
  assert.deepStrictEqual(RailwayStructure.sectionEncounters(line).map(item=>item.restStop?.no||null),expectedRestStops,`${lineId} 号线区段边界/休息站归属错误`);
}

console.log('railway-structure: 4～6 号线连续战区段验证通过');
