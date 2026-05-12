// GET /api/changelog - Auto-generated changelog from git commits
import { execSync } from 'child_process'
import { jsonResponse } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  try {
    // Get git log with conventional commits
    const gitLog = execSync('git log --pretty=format:"%H|%s|%an|%ad" --date=iso', {
      cwd: process.cwd(),
      encoding: 'utf-8'
    })

    const commits = gitLog.trim().split('\n').map(line => {
      const parts = line.split('|')
      if (parts.length < 4) return null
      const [hash, message, author, date] = parts
      return { hash, message, author, date }
    }).filter(Boolean) as Array<{ hash: string; message: string; author: string; date: string }>

    // Categorize commits by type
    const categorized: Record<string, Array<{ hash: string; message: string; author: string; date: string; type: string; scope: string | null; description: string }>> = {
      feat: [],
      fix: [],
      chore: [],
      docs: [],
      style: [],
      refactor: [],
      perf: [],
      test: [],
      build: [],
      ci: [],
      other: []
    }

    for (const commit of commits) {
      const match = commit.message.match(/^(feat|fix|chore|docs|style|refactor|perf|test|build|ci)(\(.+\))?:\s*(.+)/)
      if (match) {
        const [, type, scope, description] = match
        if (type && categorized[type]) {
          categorized[type].push({
            ...commit,
            type,
            scope: scope?.replace(/[()]/g, '') || null,
            description: description || ''
          })
        }
      } else {
        if (categorized.other) {
          categorized.other.push({
            ...commit,
            type: 'other',
            scope: null,
            description: commit.message
          })
        }
      }
    }

    return jsonResponse({
      commits: categorized,
      total: commits.length,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    return jsonResponse({ error: 'Failed to generate changelog', details: String(error) }, { status: 500 })
  }
})
