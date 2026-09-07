import { relative } from 'node:path'
import type { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter'

const calendarStages = new Set([
  'calendar: sign in', 'calendar: load calendar', 'calendar: load next month',
  'calendar: edit date range', 'calendar: save date range', 'calendar: verify persisted range',
  'calendar: verify public availability', 'calendar: append month', 'calendar: configure final seat',
  'calendar: claim final seat', 'calendar: verify final seat',
])
const apiActions = [
  ['GET', 'apiRequestContext.get'], ['POST', 'apiRequestContext.post'],
  ['PUT', 'apiRequestContext.put'], ['PATCH', 'apiRequestContext.patch'],
  ['DELETE', 'apiRequestContext.delete'], ['Navigate to', 'page.goto'],
  ['Reload', 'page.reload'], ['Wait for event "response"', 'page.waitForResponse'],
  ['Fill', 'locator.fill'], ['Click', 'locator.click'],
  ['Scroll into view', 'locator.scrollIntoViewIfNeeded'], ['Get bounding box', 'locator.boundingBox'],
  ['Move mouse', 'mouse.move'], ['Mouse down', 'mouse.down'], ['Mouse up', 'mouse.up'],
]
type Breadcrumb = {
  action: string
  startedAt: string
  durationMs?: number
  status: 'running' | 'passed' | 'failed'
  line?: number
}

export default class ProgressReporter implements Reporter {
  private recent = new Map<TestResult, Breadcrumb[]>()
  private steps = new WeakMap<TestStep, Breadcrumb>()

  onTestBegin(test: TestCase, result: TestResult) {
    this.recent.set(result, [])
    console.log('[e2e-test]', JSON.stringify({
      event: 'start', timestamp: result.startTime.toISOString(), testId: test.id,
      file: relative(process.cwd(), test.location.file), line: test.location.line,
      retry: result.retry, worker: result.workerIndex,
    }))
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    const stage = step.category === 'test.step' && calendarStages.has(step.title)
    const action = stage ? step.title : step.category === 'pw:api'
      ? apiActions.find(([prefix, name]) => step.title === prefix || step.title.startsWith(`${prefix} `)
        || step.title === name || step.title.startsWith(`${name}(`))?.[1] ?? 'playwright API'
      : step.category === 'expect' ? 'assertion' : 'step'
    const breadcrumb: Breadcrumb = {
      action, startedAt: step.startTime.toISOString(), status: 'running', line: step.location?.line,
    }
    this.steps.set(step, breadcrumb)
    const recent = this.recent.get(result)!
    recent.push(breadcrumb)
    if (recent.length > 24) recent.shift()
    if (stage) console.log('[e2e-stage]', JSON.stringify({
      event: 'start', timestamp: breadcrumb.startedAt, testId: test.id, action,
    }))
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep) {
    const breadcrumb = this.steps.get(step)!
    breadcrumb.durationMs = step.duration
    breadcrumb.status = step.error ? 'failed' : 'passed'
    if (step.category === 'test.step' && calendarStages.has(step.title)) {
      console.log('[e2e-stage]', JSON.stringify({
        event: 'end', timestamp: new Date().toISOString(), testId: test.id, ...breadcrumb,
      }))
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    console.log('[e2e-test]', JSON.stringify({
      event: 'end', timestamp: new Date().toISOString(), testId: test.id,
      status: result.status, durationMs: result.duration,
      ...(result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted'
        ? { recentSteps: this.recent.get(result) } : {}),
    }))
    this.recent.delete(result)
  }
}
