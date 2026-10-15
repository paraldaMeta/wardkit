function num(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name}要填数字`)
  }
}

function positive(name, value) {
  num(name, value)
  if (value <= 0) throw new Error(`${name}要大于 0`)
}

function nonNegative(name, value) {
  num(name, value)
  if (value < 0) throw new Error(`${name}不能为负`)
}

function round(value, digits) {
  const p = 10 ** digits
  return Math.round((value + Number.EPSILON) * p) / p
}

function show(value, digits = 4) {
  return String(round(value, digits))
}

export function weightConcentration(drugMg, volumeMl) {
  nonNegative('药量', drugMg)
  positive('液体', volumeMl)
  const concentrationMcgPerMl = (drugMg * 1000) / volumeMl
  if (concentrationMcgPerMl <= 0) throw new Error('浓度要大于 0')
  return concentrationMcgPerMl
}

export function unitConcentration(amount, volumeMl) {
  nonNegative('药量', amount)
  positive('液体', volumeMl)
  const concentrationPerMl = amount / volumeMl
  if (concentrationPerMl <= 0) throw new Error('浓度要大于 0')
  return concentrationPerMl
}

export function pumpWeightRate({ weightKg, mcgPerKgMin, drugMg, volumeMl }) {
  positive('体重', weightKg)
  nonNegative('剂量', mcgPerKgMin)
  const concentrationMcgPerMl = weightConcentration(drugMg, volumeMl)
  const mlPerHour = (mcgPerKgMin * weightKg * 60) / concentrationMcgPerMl
  const formula = `${show(mcgPerKgMin)} mcg/kg/min × ${show(weightKg)} kg × 60 ÷ ${show(concentrationMcgPerMl)} mcg/ml = ${show(mlPerHour)} ml/h`
  return { concentrationMcgPerMl, mlPerHour, formula }
}

export function pumpWeightDose({ weightKg, mlPerHour, drugMg, volumeMl }) {
  positive('体重', weightKg)
  nonNegative('速度', mlPerHour)
  const concentrationMcgPerMl = weightConcentration(drugMg, volumeMl)
  const mcgPerKgMin = (mlPerHour * concentrationMcgPerMl) / (weightKg * 60)
  const formula = `${show(mlPerHour)} ml/h × ${show(concentrationMcgPerMl)} mcg/ml ÷ (${show(weightKg)} kg × 60) = ${show(mcgPerKgMin)} mcg/kg/min`
  return { concentrationMcgPerMl, mcgPerKgMin, formula }
}

function unitLabel(unit) {
  if (unit === 'U' || unit === 'mg') return unit
  throw new Error('单位只能是 U 或 mg')
}

export function pumpUnitRate({ dosePerHour, amount, volumeMl, unit }) {
  nonNegative('剂量', dosePerHour)
  const u = unitLabel(unit)
  const concentrationPerMl = unitConcentration(amount, volumeMl)
  const mlPerHour = dosePerHour / concentrationPerMl
  const formula = `${show(dosePerHour)} ${u}/h ÷ (${show(amount)} ${u} ÷ ${show(volumeMl)} ml) = ${show(mlPerHour)} ml/h`
  return { concentrationPerMl, mlPerHour, unit: u, formula }
}

export function pumpUnitDose({ mlPerHour, amount, volumeMl, unit }) {
  nonNegative('速度', mlPerHour)
  const u = unitLabel(unit)
  const concentrationPerMl = unitConcentration(amount, volumeMl)
  const dosePerHour = mlPerHour * concentrationPerMl
  const formula = `${show(mlPerHour)} ml/h × (${show(amount)} ${u} ÷ ${show(volumeMl)} ml) = ${show(dosePerHour)} ${u}/h`
  return { concentrationPerMl, dosePerHour, unit: u, formula }
}

export function weightDose({ perKg, weightKg, unit = 'mg' }) {
  nonNegative('每公斤剂量', perKg)
  positive('体重', weightKg)
  const u = String(unit || 'mg').trim().slice(0, 12) || 'mg'
  const total = perKg * weightKg
  const formula = `${show(perKg)} ${u}/kg × ${show(weightKg)} kg = ${show(total)} ${u}`
  return { total, unit: u, formula }
}

const UMOL_PER_MG_DL = 88.4

export function creatinineClearance({ age, weightKg, scr, sex, scrUnit }) {
  positive('年龄', age)
  if (age >= 140) throw new Error('年龄要小于 140')
  positive('体重', weightKg)
  positive('肌酐', scr)
  if (sex !== 'male' && sex !== 'female') throw new Error('性别要选男或女')
  if (scrUnit !== 'umol' && scrUnit !== 'mg') throw new Error('肌酐单位要选 μmol/L 或 mg/dL')
  const scrMgDl = scrUnit === 'umol' ? scr / UMOL_PER_MG_DL : scr
  const factor = sex === 'female' ? 0.85 : 1
  const mlPerMin = ((140 - age) * weightKg * factor) / (72 * scrMgDl)
  const sexText = sex === 'female' ? ' × 0.85' : ''
  const scrText = scrUnit === 'umol'
    ? `${show(scr)} μmol/L ÷ 88.4 = ${show(scrMgDl)} mg/dL`
    : `${show(scrMgDl)} mg/dL`
  const formula = `(140 − ${show(age)}) × ${show(weightKg)} kg${sexText} ÷ (72 × ${show(scrMgDl)} mg/dL) = ${show(mlPerMin)} ml/min；肌酐 ${scrText}`
  return { mlPerMin, scrMgDl, formula }
}

export function dropsFromMl({ mlPerHour, dropFactor }) {
  nonNegative('速度', mlPerHour)
  positive('滴系数', dropFactor)
  const dropsPerMin = (mlPerHour * dropFactor) / 60
  const formula = `${show(mlPerHour)} ml/h × ${show(dropFactor)} ÷ 60 = ${show(dropsPerMin)} 滴/分`
  return { dropsPerMin, formula }
}

export function mlFromDrops({ dropsPerMin, dropFactor }) {
  nonNegative('滴速', dropsPerMin)
  positive('滴系数', dropFactor)
  const mlPerHour = (dropsPerMin * 60) / dropFactor
  const formula = `${show(dropsPerMin)} 滴/分 × 60 ÷ ${show(dropFactor)} = ${show(mlPerHour)} ml/h`
  return { mlPerHour, formula }
}

function toCents(value) {
  return Math.round(value * 100)
}

function centsText(cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function costSummary({ payment, drug, material, exam, other }) {
  nonNegative('支付标准', payment)
  nonNegative('药品', drug)
  nonNegative('耗材', material)
  nonNegative('检查', exam)
  nonNegative('其他', other)
  const paymentCents = toCents(payment)
  const drugCents = toCents(drug)
  const materialCents = toCents(material)
  const examCents = toCents(exam)
  const otherCents = toCents(other)
  const totalCents = drugCents + materialCents + examCents + otherCents
  const balanceCents = paymentCents - totalCents
  const drugRatio = totalCents === 0 ? 0 : drugCents / totalCents
  const materialRatio = totalCents === 0 ? 0 : materialCents / totalCents
  const word = balanceCents < 0 ? '超支' : '结余'
  const formula = `${centsText(paymentCents)} − ${centsText(totalCents)} = ${centsText(balanceCents)}（${word}）`
  return {
    total: totalCents / 100,
    balance: balanceCents / 100,
    totalCents,
    balanceCents,
    drugRatio,
    materialRatio,
    formula,
  }
}

export const PUMP_PRESETS = [
  { name: '去甲肾上腺素', mode: 'weight', drugMg: 8, volumeMl: 50 },
  { name: '多巴胺', mode: 'weight', drugMg: 200, volumeMl: 50 },
  { name: '多巴酚丁胺', mode: 'weight', drugMg: 100, volumeMl: 50 },
  { name: '硝酸甘油', mode: 'weight', drugMg: 10, volumeMl: 50 },
  { name: '硝普钠', mode: 'weight', drugMg: 50, volumeMl: 50 },
  { name: '胰岛素', mode: 'unit', unit: 'U', amount: 50, volumeMl: 50 },
]
