import {
  PUMP_PRESETS,
  costSummary,
  creatinineClearance,
  dropsFromMl,
  mlFromDrops,
  pumpUnitDose,
  pumpUnitRate,
  pumpWeightDose,
  pumpWeightRate,
  unitConcentration,
  weightConcentration,
  weightDose,
} from './calc.js'

const DRAFTS = 'wardkit:drafts'
const OPEN = 'wardkit:open'
const PAYMENTS = 'wardkit:payments'
const PANELS = ['note', 'pump', 'dose', 'cost']

const KINDS = {
  clinic: {
    label: '门诊',
    fields: [
      ['chief', '主诉'],
      ['hpi', '现病史'],
      ['pmh', '既往史'],
      ['exam', '体格检查'],
      ['aux', '辅助检查'],
      ['dx', '诊断'],
      ['plan', '处理'],
    ],
  },
  admit: {
    label: '入院记录',
    fields: [
      ['chief', '主诉'],
      ['hpi', '现病史'],
      ['pmh', '既往史'],
      ['social', '个人史'],
      ['marriage', '婚育史'],
      ['family', '家族史'],
      ['exam', '体格检查'],
      ['specialty', '专科情况'],
      ['aux', '辅助检查'],
      ['dx', '初步诊断'],
    ],
  },
  first: {
    label: '首次病程',
    fields: [
      ['features', '病例特点'],
      ['discussion', '拟诊讨论'],
      ['plan', '诊疗计划'],
    ],
  },
  daily: {
    label: '日常病程',
    fields: [
      ['time', '日期时间', 'datetime-local'],
      ['change', '病情变化'],
      ['exam', '查体'],
      ['plan', '处理'],
    ],
  },
  discharge: {
    label: '出院记录',
    fields: [
      ['inDate', '入院日期', 'date'],
      ['outDate', '出院日期', 'date'],
      ['admission', '入院情况'],
      ['course', '诊疗经过'],
      ['dx', '出院诊断'],
      ['advice', '出院医嘱'],
    ],
  },
}

let current = null
let lastField = null
let dripSource = 'ml'
let hearing = null

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  // shortcut: localStorage about 5MB, switch to IndexedDB if a draft fails to save.
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
}

function drafts() {
  const all = load(DRAFTS, [])
  return Array.isArray(all) ? all.sort((a, b) => b.updated - a.updated) : []
}

function read(id) {
  const raw = document.getElementById(id).value.trim()
  if (raw === '') return null
  return Number(raw)
}

function fmt(n) {
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n * 10000) / 10000)
}

function money(n) {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function selected(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`)
  return el ? el.value : ''
}

function showPanel(name) {
  const panel = PANELS.includes(name) ? name : 'note'
  for (const id of PANELS) {
    document.getElementById(`panel-${id}`).hidden = id !== panel
    const button = document.querySelector(`nav [data-panel="${id}"]`)
    if (id === panel) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  if (location.hash !== `#${panel}`) history.replaceState(null, '', `#${panel}`)
}

function nowLocal() {
  const date = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function blank(kind) {
  const fields = {}
  for (const [key, , type] of KINDS[kind].fields) {
    fields[key] = type === 'datetime-local' ? nowLocal() : ''
  }
  return { id: uid(), kind, fields, updated: Date.now() }
}

function snippetOf(draft) {
  const spec = KINDS[draft.kind]
  if (!spec) return ''
  for (const [key] of spec.fields) {
    const text = (draft.fields[key] || '').trim()
    if (text) return text.slice(0, 18)
  }
  return ''
}

function when(ts) {
  return new Date(ts).toLocaleString('zh-CN', {
    hour12: false,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function noteError(text) {
  document.getElementById('note-error').textContent = text
}

function persistDraft(draft) {
  const all = load(DRAFTS, [])
  const list = Array.isArray(all) ? all : []
  const index = list.findIndex((item) => item.id === draft.id)
  if (index === -1) list.unshift(draft)
  else list[index] = draft
  const ok = save(DRAFTS, list)
  save(OPEN, draft.id)
  document.getElementById('save-state').textContent = ok
    ? '已存在这台设备'
    : '存不下，浏览器拦了本地存储'
  renderList()
}

function renderFields(draft) {
  const box = document.getElementById('note-fields')
  box.replaceChildren()
  const spec = KINDS[draft.kind]
  for (const [key, label, type] of spec.fields) {
    const wrap = document.createElement('label')
    wrap.append(document.createTextNode(label))
    const input = document.createElement(type ? 'input' : 'textarea')
    if (type) input.type = type
    else input.rows = 3
    input.autocomplete = 'off'
    input.value = draft.fields[key] || ''
    input.addEventListener('focus', () => { lastField = input })
    input.addEventListener('input', () => {
      draft.fields[key] = input.value
      draft.updated = Date.now()
      noteError('')
      persistDraft(draft)
    })
    wrap.append(input)
    box.append(wrap)
  }
}

function renderList() {
  const list = document.getElementById('draft-list')
  list.replaceChildren()
  const all = drafts()
  if (all.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'hint'
    empty.textContent = '还没有草稿。选类型后新建。'
    list.append(empty)
    return
  }
  for (const draft of all) {
    const row = document.createElement('div')
    row.className = 'draft'
    const open = document.createElement('button')
    open.type = 'button'
    open.className = 'ghost grow'
    const spec = KINDS[draft.kind]
    const snippet = snippetOf(draft)
    open.textContent = `${spec ? spec.label : draft.kind} · ${when(draft.updated)}${snippet ? ` · ${snippet}` : ''}`
    open.addEventListener('click', () => openDraft(draft.id))
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'ghost'
    del.textContent = '删除'
    del.addEventListener('click', () => removeDraft(draft.id))
    row.append(open, del)
    list.append(row)
  }
}

function openDraft(id) {
  const draft = drafts().find((item) => item.id === id)
  if (!draft || !KINDS[draft.kind]) return
  current = draft
  save(OPEN, id)
  document.getElementById('note-title').textContent = KINDS[draft.kind].label
  noteError('')
  renderFields(current)
}

function removeDraft(id) {
  const draft = drafts().find((item) => item.id === id)
  if (!draft) return
  const label = KINDS[draft.kind] ? KINDS[draft.kind].label : '草稿'
  if (!confirm(`删掉这份${label}？`)) return
  const all = load(DRAFTS, [])
  save(DRAFTS, (Array.isArray(all) ? all : []).filter((item) => item.id !== id))
  if (current && current.id === id) {
    current = null
    lastField = null
    document.getElementById('note-title').textContent = ''
    document.getElementById('note-fields').replaceChildren()
    document.getElementById('save-state').textContent = ''
    localStorage.removeItem(OPEN)
  }
  renderList()
}

function draftText(draft) {
  const spec = KINDS[draft.kind]
  const lines = [spec.label]
  for (const [key, label] of spec.fields) {
    lines.push(`${label}：${draft.fields[key] || ''}`)
  }
  return lines.join('\n')
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.append(area)
    area.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    area.remove()
    return ok
  }
}

function clearBox(outId, formulaId, errorId) {
  document.getElementById(outId).textContent = ''
  document.getElementById(outId).classList.remove('over', 'under')
  document.getElementById(formulaId).textContent = ''
  document.getElementById(errorId).textContent = ''
}

function showError(errorId, error) {
  document.getElementById(errorId).textContent = error instanceof Error ? error.message : '算不了'
}

function pumpVisibility() {
  const weight = selected('pump-mode') === 'weight'
  const wantRate = selected('pump-way') === 'rate'
  document.getElementById('pump-weight-row').hidden = !weight
  document.getElementById('pump-drug-row').hidden = !weight
  document.getElementById('pump-unit-row').hidden = weight
  document.getElementById('pump-mcg-row').hidden = !weight || !wantRate
  document.getElementById('pump-hour-row').hidden = weight || !wantRate
  document.getElementById('pump-ml-row').hidden = wantRate
  const hour = document.getElementById('pump-hour-row')
  const text = [...hour.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)
  if (text) text.textContent = `剂量（${document.getElementById('pump-unit').value}/h）`
}

function pumpCalc() {
  clearBox('pump-out', 'pump-formula', 'pump-error')
  const mode = selected('pump-mode')
  const way = selected('pump-way')
  const volumeMl = read('pump-volume')
  try {
    if (mode === 'weight') {
      const drugMg = read('pump-drug')
      const weightKg = read('pump-weight')
      if (drugMg == null || volumeMl == null) return
      const conc = weightConcentration(drugMg, volumeMl)
      if (way === 'rate') {
        const mcgPerKgMin = read('pump-mcg')
        if (mcgPerKgMin == null || weightKg == null) {
          document.getElementById('pump-formula').textContent = `浓度 ${fmt(conc)} mcg/ml。填体重和剂量后算出速度。`
          return
        }
        const result = pumpWeightRate({ weightKg, mcgPerKgMin, drugMg, volumeMl })
        document.getElementById('pump-out').textContent = `${fmt(result.mlPerHour)} ml/h`
        document.getElementById('pump-formula').textContent = result.formula
        return
      }
      const mlPerHour = read('pump-ml')
      if (mlPerHour == null || weightKg == null) {
        document.getElementById('pump-formula').textContent = `浓度 ${fmt(conc)} mcg/ml。填体重和速度后反算剂量。`
        return
      }
      const result = pumpWeightDose({ weightKg, mlPerHour, drugMg, volumeMl })
      document.getElementById('pump-out').textContent = `${fmt(result.mcgPerKgMin)} mcg/kg/min`
      document.getElementById('pump-formula').textContent = result.formula
      return
    }
    const amount = read('pump-amount')
    const unit = document.getElementById('pump-unit').value
    if (amount == null || volumeMl == null) return
    const conc = unitConcentration(amount, volumeMl)
    if (way === 'rate') {
      const dosePerHour = read('pump-hour')
      if (dosePerHour == null) {
        document.getElementById('pump-formula').textContent = `浓度 ${fmt(conc)} ${unit}/ml。填每小时剂量后算出速度。`
        return
      }
      const result = pumpUnitRate({ dosePerHour, amount, volumeMl, unit })
      document.getElementById('pump-out').textContent = `${fmt(result.mlPerHour)} ml/h`
      document.getElementById('pump-formula').textContent = result.formula
      return
    }
    const mlPerHour = read('pump-ml')
    if (mlPerHour == null) {
      document.getElementById('pump-formula').textContent = `浓度 ${fmt(conc)} ${unit}/ml。填速度后反算剂量。`
      return
    }
    const result = pumpUnitDose({ mlPerHour, amount, volumeMl, unit })
    document.getElementById('pump-out').textContent = `${fmt(result.dosePerHour)} ${result.unit}/h`
    document.getElementById('pump-formula').textContent = result.formula
  } catch (error) {
    showError('pump-error', error)
  }
}

function applyPreset(preset) {
  document.querySelector(`input[name="pump-mode"][value="${preset.mode}"]`).checked = true
  document.getElementById('pump-mcg').value = ''
  document.getElementById('pump-hour').value = ''
  document.getElementById('pump-ml').value = ''
  document.getElementById('pump-volume').value = String(preset.volumeMl)
  if (preset.mode === 'weight') {
    document.getElementById('pump-drug').value = String(preset.drugMg)
  } else {
    document.getElementById('pump-amount').value = String(preset.amount)
    document.getElementById('pump-unit').value = preset.unit
  }
  pumpVisibility()
  pumpCalc()
}

function doseCalc() {
  clearBox('dose-out', 'dose-formula', 'dose-error')
  const perKg = read('dose-perkg')
  const weightKg = read('dose-weight')
  if (perKg == null || weightKg == null) return
  try {
    const result = weightDose({
      perKg,
      weightKg,
      unit: document.getElementById('dose-unit').value,
    })
    document.getElementById('dose-out').textContent = `${fmt(result.total)} ${result.unit}`
    document.getElementById('dose-formula').textContent = result.formula
  } catch (error) {
    showError('dose-error', error)
  }
}

function crclCalc() {
  clearBox('crcl-out', 'crcl-formula', 'crcl-error')
  const age = read('crcl-age')
  const weightKg = read('crcl-weight')
  const scr = read('crcl-scr')
  if (age == null || weightKg == null || scr == null) return
  try {
    const result = creatinineClearance({
      age,
      weightKg,
      scr,
      sex: document.getElementById('crcl-sex').value,
      scrUnit: document.getElementById('crcl-unit').value,
    })
    document.getElementById('crcl-out').textContent = `${fmt(result.mlPerMin)} ml/min`
    document.getElementById('crcl-formula').textContent = result.formula
  } catch (error) {
    showError('crcl-error', error)
  }
}

function dripCalc() {
  const formula = document.getElementById('drip-formula')
  const mlInput = document.getElementById('drip-ml')
  const dropsInput = document.getElementById('drip-drops')
  const derived = dripSource === 'drops' ? mlInput : dropsInput
  formula.textContent = ''
  document.getElementById('drip-error').textContent = ''
  const dropFactor = read('drip-factor')
  if (dropFactor == null) {
    derived.value = ''
    return
  }
  try {
    if (dripSource === 'drops') {
      const dropsPerMin = read('drip-drops')
      if (dropsPerMin == null) {
        mlInput.value = ''
        return
      }
      const result = mlFromDrops({ dropsPerMin, dropFactor })
      mlInput.value = fmt(result.mlPerHour)
      formula.textContent = result.formula
      return
    }
    const mlPerHour = read('drip-ml')
    if (mlPerHour == null) {
      dropsInput.value = ''
      return
    }
    const result = dropsFromMl({ mlPerHour, dropFactor })
    dropsInput.value = fmt(result.dropsPerMin)
    formula.textContent = result.formula
  } catch (error) {
    derived.value = ''
    showError('drip-error', error)
  }
}

function costCalc() {
  clearBox('cost-out', 'cost-formula', 'cost-error')
  const payment = read('cost-payment')
  if (payment == null) return
  const value = (id) => {
    const n = read(id)
    return n == null ? 0 : n
  }
  try {
    const result = costSummary({
      payment,
      drug: value('cost-drug'),
      material: value('cost-material'),
      exam: value('cost-exam'),
      other: value('cost-other'),
    })
    const word = result.balanceCents < 0 ? '超支' : '结余'
    const out = document.getElementById('cost-out')
    out.textContent = `合计 ${money(result.total)} 元\n${word} ${money(Math.abs(result.balance))} 元\n药占比 ${(result.drugRatio * 100).toFixed(1)}%\n耗占比 ${(result.materialRatio * 100).toFixed(1)}%`
    out.classList.add(result.balanceCents < 0 ? 'over' : 'under')
    document.getElementById('cost-formula').textContent = result.formula
  } catch (error) {
    showError('cost-error', error)
  }
}

function renderPayments() {
  const list = document.getElementById('pay-list')
  list.replaceChildren()
  const all = load(PAYMENTS, [])
  if (!Array.isArray(all)) return
  for (const item of all) {
    const row = document.createElement('div')
    row.className = 'draft'
    const open = document.createElement('button')
    open.type = 'button'
    open.className = 'ghost grow'
    open.textContent = `${item.name} · ${money(item.payment)} 元`
    open.addEventListener('click', () => {
      document.getElementById('cost-payment').value = String(item.payment)
      document.getElementById('cost-name').value = item.name
      costCalc()
    })
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'ghost'
    del.textContent = '删除'
    del.addEventListener('click', () => {
      if (!confirm(`删掉「${item.name}」？`)) return
      const next = load(PAYMENTS, [])
      save(PAYMENTS, (Array.isArray(next) ? next : []).filter((row) => row.id !== item.id))
      renderPayments()
    })
    row.append(open, del)
    list.append(row)
  }
}

function savePayment() {
  const name = document.getElementById('cost-name').value.trim()
  const payment = read('cost-payment')
  const error = document.getElementById('cost-error')
  if (!name) {
    error.textContent = '先写病组名'
    return
  }
  if (payment == null) {
    error.textContent = '先填支付标准'
    return
  }
  try {
    costSummary({ payment, drug: 0, material: 0, exam: 0, other: 0 })
  } catch (caught) {
    showError('cost-error', caught)
    return
  }
  const all = load(PAYMENTS, [])
  const list = Array.isArray(all) ? all : []
  const existing = list.find((item) => item.name === name)
  if (existing) existing.payment = payment
  else list.push({ id: uid(), name, payment })
  if (!save(PAYMENTS, list)) {
    error.textContent = '存不下，浏览器拦了本地存储'
    return
  }
  error.textContent = ''
  renderPayments()
}

function bindVoice() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition
  const button = document.getElementById('voice')
  if (!Speech) return
  button.hidden = false
  button.addEventListener('click', () => {
    if (!current) {
      noteError('先新建一份')
      return
    }
    if (!lastField || !document.getElementById('note-fields').contains(lastField)) {
      noteError('先点一个格子')
      return
    }
    if (hearing) {
      hearing.stop()
      return
    }
    const rec = new Speech()
    const field = lastField
    const draftId = current.id
    hearing = rec
    rec.lang = 'zh-CN'
    button.textContent = '在听…'
    rec.onresult = (event) => {
      if (!field.isConnected || !current || current.id !== draftId) return
      const said = event.results[0][0].transcript
      const prefix = field.value === '' || /\s$/.test(field.value) ? '' : ' '
      field.value += prefix + said
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }
    rec.onerror = () => noteError('语音没听成，再试一次')
    rec.onend = () => {
      hearing = null
      button.textContent = '语音追加'
    }
    noteError('')
    rec.start()
  })
}

function boot() {
  for (const id of ['pump-form', 'dose-form', 'crcl-form', 'drip-form', 'cost-form']) {
    document.getElementById(id).addEventListener('submit', (event) => event.preventDefault())
  }
  document.querySelectorAll('nav [data-panel]').forEach((button) => {
    button.addEventListener('click', () => showPanel(button.dataset.panel))
  })
  window.addEventListener('hashchange', () => showPanel(location.hash.slice(1)))
  showPanel(location.hash.slice(1))

  document.getElementById('new-note').addEventListener('click', () => {
    const kind = document.getElementById('note-kind').value
    if (!KINDS[kind]) return
    current = blank(kind)
    document.getElementById('note-title').textContent = KINDS[kind].label
    noteError('')
    renderFields(current)
    persistDraft(current)
    const first = document.querySelector('#note-fields textarea, #note-fields input')
    if (first) first.focus()
  })
  document.getElementById('delete-note').addEventListener('click', () => {
    if (!current) {
      noteError('先新建一份')
      return
    }
    removeDraft(current.id)
  })
  document.getElementById('copy-note').addEventListener('click', async () => {
    if (!current) {
      noteError('先新建一份')
      return
    }
    const button = document.getElementById('copy-note')
    const old = button.textContent
    const ok = await copyText(draftText(current))
    button.textContent = ok ? '已复制' : '复制失败'
    setTimeout(() => { button.textContent = old }, 1600)
  })
  bindVoice()
  const openId = load(OPEN, null)
  if (typeof openId === 'string') openDraft(openId)
  renderList()

  const presets = document.getElementById('pump-presets')
  for (const preset of PUMP_PRESETS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ghost chip'
    button.textContent = preset.name
    button.addEventListener('click', () => applyPreset(preset))
    presets.append(button)
  }
  document.getElementById('pump-form').addEventListener('input', () => {
    pumpVisibility()
    pumpCalc()
  })
  pumpVisibility()

  document.getElementById('dose-form').addEventListener('input', doseCalc)
  document.getElementById('crcl-form').addEventListener('input', crclCalc)
  document.getElementById('drip-ml').addEventListener('input', () => {
    dripSource = 'ml'
    dripCalc()
  })
  document.getElementById('drip-drops').addEventListener('input', () => {
    dripSource = 'drops'
    dripCalc()
  })
  document.getElementById('drip-factor').addEventListener('input', dripCalc)
  document.getElementById('cost-form').addEventListener('input', costCalc)
  document.getElementById('save-payment').addEventListener('click', savePayment)
  renderPayments()

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
}

boot()
