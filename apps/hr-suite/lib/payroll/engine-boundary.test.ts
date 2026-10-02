import { readdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const engineSource = fileURLToPath(new URL('../../../../packages/payroll-engine/src', import.meta.url))

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listSourceFiles(path) : entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [path] : []
  })
}

function collectModuleSpecifiers(source: string, path: string): string[] {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text)
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text)
    }
    if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text)
    }
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const [firstArgument] = node.arguments
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if ((isDynamicImport || isRequire) && firstArgument && ts.isStringLiteral(firstArgument)) specifiers.push(firstArgument.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

function collectBrowserGlobals(source: string, path: string): string[] {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const forbidden = new Set(['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch'])
  const matches: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) matches.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return matches
}

describe('payroll-engine package boundary', () => {
  it('contains only local imports and exports', () => {
    const files = listSourceFiles(engineSource)
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const modulePaths = collectModuleSpecifiers(source, file)
      expect(modulePaths.every((modulePath) => {
        if (!modulePath.startsWith('.')) return false
        const resolved = resolve(dirname(file), modulePath)
        return !isAbsolute(modulePath) && (resolved === engineSource || resolved.startsWith(`${engineSource}${sep}`))
      })).toBe(true)
      expect(collectBrowserGlobals(source, file)).toEqual([])
    }

    const manifestPath = fileURLToPath(new URL('../../../../packages/payroll-engine/package.json', import.meta.url))
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      bundledDependencies?: string[]
    }
    expect(manifest.dependencies ?? {}).toEqual({})
    expect(manifest.devDependencies ?? {}).toEqual({})
    expect(manifest.optionalDependencies ?? {}).toEqual({})
    expect(manifest.peerDependencies ?? {}).toEqual({})
    expect(manifest.bundledDependencies ?? []).toEqual([])
  })

  it('keeps rule and engine versions on input sets, not source snapshots', () => {
    const contracts = readFileSync(join(engineSource, 'domain', 'payroll-contracts.ts'), 'utf8')
    const snapshotBlock = contracts.match(/interface PayrollSourceSnapshot \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const inputSetBlock = contracts.match(/interface CalculationInputSet \{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(snapshotBlock).not.toMatch(/engineVersion|rulePackageCompositionId/)
    expect(inputSetBlock).toMatch(/engineVersion/)
    expect(inputSetBlock).toMatch(/rulePackageCompositionId/)
  })
})
