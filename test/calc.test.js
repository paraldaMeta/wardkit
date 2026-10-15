import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pumpWeightRate,
  pumpWeightDose,
  pumpUnitRate,
  pumpUnitDose,
  weightDose,
  creatinineClearance,
  dropsFromMl,
  mlFromDrops,
  costSummary,
  PUMP_PRESETS,
} from '../public/js/calc.js'

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`)

test('微泵按体重：8mg/50ml，60kg，0.1 mcg/kg/min = 2.25 ml/h', () => {
  const rate = pumpWeightRate({ weightKg: 60, mcgPerKgMin: 0.1, drugMg: 8, volumeMl: 50 })
  near(rate.concentrationMcgPerMl, 160)
  near(rate.mlPerHour, 2.25)
  assert.match(rate.formula, /2\.25 ml\/h/)
  const dose = pumpWeightDose({ weightKg: 60, mlPerHour: 2.25, drugMg: 8, volumeMl: 50 })
  near(dose.mcgPerKgMin, 0.1)
})

test('剂量为 0 时速度为 0；液体为 0 或体重为负则拒绝', () => {
  const rate = pumpWeightRate({ weightKg: 60, mcgPerKgMin: 0, drugMg: 8, volumeMl: 50 })
  near(rate.mlPerHour, 0)
  assert.throws(() => pumpWeightRate({ weightKg: 60, mcgPerKgMin: 0.1, drugMg: 8, volumeMl: 0 }), /液体要大于 0/)
  assert.throws(() => pumpWeightRate({ weightKg: -1, mcgPerKgMin: 0.1, drugMg: 8, volumeMl: 50 }), /体重要大于 0/)
  assert.throws(() => pumpWeightRate({ weightKg: 60, mcgPerKgMin: Number.NaN, drugMg: 8, volumeMl: 50 }), /剂量要填数字/)
})

test('按单位：胰岛素 50U/50ml，2 U/h = 2 ml/h，可反算', () => {
  const rate = pumpUnitRate({ dosePerHour: 2, amount: 50, volumeMl: 50, unit: 'U' })
  near(rate.concentrationPerMl, 1)
  near(rate.mlPerHour, 2)
  const dose = pumpUnitDose({ mlPerHour: 2, amount: 50, volumeMl: 50, unit: 'U' })
  near(dose.dosePerHour, 2)
  const mg = pumpUnitRate({ dosePerHour: 5, amount: 100, volumeMl: 50, unit: 'mg' })
  near(mg.mlPerHour, 2.5)
  assert.throws(() => pumpUnitRate({ dosePerHour: 1, amount: 50, volumeMl: 50, unit: 'g' }), /单位只能是 U 或 mg/)
})

test('预设只有配液，没有剂量', () => {
  assert.ok(PUMP_PRESETS.length >= 2)
  for (const preset of PUMP_PRESETS) {
    assert.ok(preset.volumeMl > 0)
    assert.equal(preset.mcgPerKgMin, undefined)
    assert.equal(preset.dosePerHour, undefined)
  }
  assert.equal(PUMP_PRESETS.find((preset) => preset.name === '胰岛素').mode, 'unit')
})

test('按体重剂量', () => {
  const result = weightDose({ perKg: 5, weightKg: 20, unit: 'mg' })
  near(result.total, 100)
  assert.match(result.formula, /100 mg/)
  assert.throws(() => weightDose({ perKg: -1, weightKg: 20, unit: 'mg' }), /不能为负/)
})

test('肌酐清除率：单位切换与女性系数', () => {
  const male = creatinineClearance({ age: 40, weightKg: 70, scr: 1, sex: 'male', scrUnit: 'mg' })
  near(male.mlPerMin, (100 * 70) / 72)
  const female = creatinineClearance({ age: 40, weightKg: 70, scr: 1, sex: 'female', scrUnit: 'mg' })
  near(female.mlPerMin, male.mlPerMin * 0.85)
  const umol = creatinineClearance({ age: 40, weightKg: 70, scr: 88.4, sex: 'male', scrUnit: 'umol' })
  near(umol.mlPerMin, male.mlPerMin)
  near(umol.scrMgDl, 1)
  assert.throws(() => creatinineClearance({ age: 40, weightKg: 70, scr: 0, sex: 'male', scrUnit: 'mg' }), /肌酐要大于 0/)
  assert.throws(() => creatinineClearance({ age: 140, weightKg: 70, scr: 1, sex: 'male', scrUnit: 'mg' }), /年龄要小于 140/)
})

test('滴速来回换算，滴系数为 0 则拒绝', () => {
  const drops = dropsFromMl({ mlPerHour: 60, dropFactor: 20 })
  near(drops.dropsPerMin, 20)
  const ml = mlFromDrops({ dropsPerMin: 20, dropFactor: 20 })
  near(ml.mlPerHour, 60)
  const other = dropsFromMl({ mlPerHour: 90, dropFactor: 15 })
  near(other.dropsPerMin, 22.5)
  assert.throws(() => dropsFromMl({ mlPerHour: 60, dropFactor: 0 }), /滴系数要大于 0/)
  assert.throws(() => mlFromDrops({ dropsPerMin: -1, dropFactor: 20 }), /不能为负/)
})

test('费用结余、超支，合计为 0 时占比不是 NaN', () => {
  const under = costSummary({ payment: 100, drug: 40, material: 10, exam: 10, other: 10 })
  near(under.total, 70)
  near(under.balance, 30)
  near(under.drugRatio, 40 / 70)
  near(under.materialRatio, 10 / 70)
  assert.match(under.formula, /结余/)
  const over = costSummary({ payment: 100, drug: 80, material: 30, exam: 10, other: 0 })
  near(over.balance, -20)
  assert.match(over.formula, /超支/)
  const empty = costSummary({ payment: 50, drug: 0, material: 0, exam: 0, other: 0 })
  near(empty.balance, 50)
  assert.equal(empty.drugRatio, 0)
  assert.equal(empty.materialRatio, 0)
  assert.equal(Number.isNaN(empty.drugRatio), false)
  assert.throws(() => costSummary({ payment: -1, drug: 0, material: 0, exam: 0, other: 0 }), /支付标准不能为负/)
})

test('分位刚好对齐时记结余，不因浮点记成超支', () => {
  const even = costSummary({ payment: 100.05, drug: 50.02, material: 25.01, exam: 15.01, other: 10.01 })
  assert.equal(even.balanceCents, 0)
  assert.match(even.formula, /结余/)
  assert.doesNotMatch(even.formula, /超支/)
})
