import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const clientModule = readFileSync(new URL('./supabase-client.ts', import.meta.url), 'utf8')
const sourceProviderModule = readFileSync(new URL('./source/liquid-hr-source-provider.ts', import.meta.url), 'utf8')
const calculationRepositoryModule = readFileSync(new URL('./calculation-repository.ts', import.meta.url), 'utf8')
const syntheticCalculationServiceModule = readFileSync(new URL('./synthetic-calculation-service.ts', import.meta.url), 'utf8')
const sidebarModule = readFileSync(new URL('../../components/layout/sidebar.tsx', import.meta.url), 'utf8')
const payrollDirectory = fileURLToPath(new URL('./', import.meta.url))
const hrSuiteRoot = fileURLToPath(new URL('../../', import.meta.url))
const sourceFileCache = new Map<string, ts.SourceFile>()
const resolvedModuleCache = new Map<string, string | null>()

function getSourceFile(path: string): ts.SourceFile {
  let source = sourceFileCache.get(path)
  if (!source) {
    source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    sourceFileCache.set(path, source)
  }
  return source
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(absolutePath)
    return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [absolutePath] : []
  })
}

function resolveModulePath(importer: string, specifier: string): string | null {
  const cacheKey = `${importer}\0${specifier}`
  if (resolvedModuleCache.has(cacheKey)) return resolvedModuleCache.get(cacheKey) ?? null
  const candidate = specifier.startsWith('@/')
    ? resolve(hrSuiteRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null
  if (!candidate) {
    resolvedModuleCache.set(cacheKey, null)
    return null
  }

  const extension = extname(candidate)
  const typeScriptExtensions: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
  }
  const fileCandidates = extension
    ? [candidate, ...(typeScriptExtensions[extension] ?? []).map((typeScriptExtension) => `${candidate.slice(0, -extension.length)}${typeScriptExtension}`)]
    : ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'].map((candidateExtension) => `${candidate}${candidateExtension}`)
  const indexCandidates = extension ? [] : ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'].map((candidateExtension) => join(candidate, `index${candidateExtension}`))
  const resolvedModule = [...fileCandidates, ...indexCandidates].find((path) => existsSync(path)) ?? null
  resolvedModuleCache.set(cacheKey, resolvedModule)
  return resolvedModule
}

function collectModuleSpecifiers(source: ts.SourceFile): string[] {
  const specifiers: string[] = []
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text)
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      specifiers.push(node.moduleReference.expression.text)
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        specifiers.push(node.arguments[0].text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return specifiers
}

function collectReExportSpecifiers(source: ts.SourceFile): string[] {
  return source.statements.flatMap((statement) =>
    ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  )
}

function reExportsTarget(modulePath: string, targetPath: string, visited = new Set<string>()): boolean {
  const resolvedModule = resolve(modulePath)
  if (resolvedModule === targetPath) return true
  if (visited.has(resolvedModule)) return false
  visited.add(resolvedModule)
  const source = getSourceFile(resolvedModule)
  const isIndexBarrel = /^index\.[jt]sx?$/.test(basename(resolvedModule))
  const reExportSpecifiers = isIndexBarrel ? collectModuleSpecifiers(source) : collectReExportSpecifiers(source)
  return reExportSpecifiers.some((specifier) => {
    const reExportPath = resolveModulePath(resolvedModule, specifier)
    return reExportPath !== null && reExportsTarget(reExportPath, targetPath, visited)
  })
}

function findImporters(sourceFiles: string[], target: string): string[] {
  const resolvedTarget = resolve(payrollDirectory, target)
  return sourceFiles.filter((path) => {
    if (/\.test\.[jt]sx?$/.test(path)) return false
    return collectModuleSpecifiers(getSourceFile(path)).some((specifier) => {
      const resolvedModule = resolveModulePath(path, specifier)
      return resolvedModule !== null && reExportsTarget(resolvedModule, resolvedTarget)
    })
  }).sort()
}

describe('Payroll Lab server-only boundary', () => {
  it('marks the Payroll Supabase client as server-only and uses no public credential names', () => {
    expect(clientModule.startsWith("import 'server-only'")).toBe(true)
    expect(clientModule).toContain('PAYROLL_SUPABASE_URL')
    expect(clientModule).toContain('PAYROLL_SUPABASE_SECRET_KEY')
    expect(clientModule).not.toContain('NEXT_PUBLIC_PAYROLL')
  })

  it('keeps the Core source adapter server-only and delegates reads to existing domain services', () => {
    expect(sourceProviderModule.startsWith("import 'server-only'")).toBe(true)
    expect(sourceProviderModule).toContain("requirePermission('salary:read'")
    expect(sourceProviderModule).toContain("from '@/lib/employment/employment-service'")
    expect(sourceProviderModule).toContain("from '@/lib/employment/employment-detail-service'")
    expect(sourceProviderModule).not.toContain("from '@/lib/supabase/server'")
    expect(sourceProviderModule).not.toMatch(/\.from\(['"](employees|employments|employment_salaries|employment_schedules)['"]\)/)
  })

  it('keeps synthetic calculation and Payroll persistence server-only without Core reads', () => {
    expect(calculationRepositoryModule.startsWith("import 'server-only'")).toBe(true)
    expect(syntheticCalculationServiceModule.startsWith("import 'server-only'")).toBe(true)
    expect(syntheticCalculationServiceModule).not.toContain('@/lib/auth/')
    expect(syntheticCalculationServiceModule).not.toContain('@/lib/supabase/')
    expect(syntheticCalculationServiceModule).not.toContain('./source/liquid-hr-source-provider')
    expect(syntheticCalculationServiceModule).not.toContain("requirePermission(")
  })

  it('does not import Payroll server modules from the client sidebar', () => {
    expect(sidebarModule).not.toMatch(/@\/lib\/payroll|\.\.\/payroll/)
    expect(sidebarModule).not.toContain('PAYROLL_SUPABASE')
  })

  it('keeps repository imports behind the Payroll access service', () => {
    const sourceFiles = [
      ...collectSourceFiles(join(hrSuiteRoot, 'app')),
      ...collectSourceFiles(join(hrSuiteRoot, 'components')),
      ...collectSourceFiles(join(hrSuiteRoot, 'lib')),
      join(hrSuiteRoot, 'proxy.ts'),
    ]
    const repositoryImporters = findImporters(sourceFiles, 'repository.ts')
    const calculationRepositoryImporters = findImporters(sourceFiles, 'calculation-repository.ts')
    const supabaseClientImporters = findImporters(sourceFiles, 'supabase-client.ts')

    expect(resolveModulePath(join(payrollDirectory, 'access.ts'), './repository.js'))
      .toBe(resolve(payrollDirectory, 'repository.ts'))
    expect(repositoryImporters).toEqual([join(payrollDirectory, 'access.ts')])
    expect(calculationRepositoryImporters).toEqual([join(payrollDirectory, 'synthetic-calculation-service.ts')])
    expect(supabaseClientImporters).toEqual([
      join(payrollDirectory, 'calculation-repository.ts'),
      join(payrollDirectory, 'repository.ts'),
    ])
  }, 20_000)
})
