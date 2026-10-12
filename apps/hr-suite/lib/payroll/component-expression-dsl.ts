import type { PayrollExpression } from '@liquid-hr/payroll-engine'

type Token = {
  readonly kind: 'identifier' | 'number' | 'string' | 'symbol'
  readonly value: string
}

export class ComponentExpressionParseError extends Error {
  constructor() {
    super('PAYROLL_COMPONENT_FORMULA_INVALID')
    this.name = 'ComponentExpressionParseError'
  }
}

function tokenize(source: string): readonly Token[] {
  if (source.length > 1200) throw new ComponentExpressionParseError()
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const current = source[index]!
    if (/\s/.test(current)) {
      index += 1
      continue
    }

    if (current === '"') {
      const start = index
      index += 1
      let escaped = false
      while (index < source.length) {
        const char = source[index]!
        index += 1
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') break
      }
      const raw = source.slice(start, index)
      try {
        const value: unknown = JSON.parse(raw)
        if (typeof value !== 'string') throw new ComponentExpressionParseError()
        tokens.push({ kind: 'string', value })
      } catch {
        throw new ComponentExpressionParseError()
      }
      continue
    }

    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(index))
    if (number) {
      tokens.push({ kind: 'number', value: number[0] })
      index += number[0].length
      continue
    }

    const identifier = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(source.slice(index))
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier[0] })
      index += identifier[0].length
      continue
    }

    const operator = ['>=', '<=', '!='].find((candidate) => source.startsWith(candidate, index))
    if (operator) {
      tokens.push({ kind: 'symbol', value: operator })
      index += operator.length
      continue
    }

    if ('+-*/=><(),.'.includes(current)) {
      tokens.push({ kind: 'symbol', value: current })
      index += 1
      continue
    }

    throw new ComponentExpressionParseError()
  }

  if (tokens.length === 0 || tokens.length > 256) throw new ComponentExpressionParseError()
  return tokens
}

class ExpressionParser {
  private index = 0

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): PayrollExpression {
    const expression = this.parseOr(0)
    if (this.index !== this.tokens.length) throw new ComponentExpressionParseError()
    return expression
  }

  private current(): Token | undefined {
    return this.tokens[this.index]
  }

  private consume(value?: string): Token {
    const token = this.current()
    if (!token || (value !== undefined && token.value.toUpperCase() !== value)) {
      throw new ComponentExpressionParseError()
    }
    this.index += 1
    return token
  }

  private take(value: string): boolean {
    if (this.current()?.value.toUpperCase() !== value) return false
    this.index += 1
    return true
  }

  private parseOr(depth: number): PayrollExpression {
    let left = this.parseAnd(depth + 1)
    while (this.take('OR')) {
      left = { kind: 'binary', operator: 'OR', left, right: this.parseAnd(depth + 1) }
    }
    return left
  }

  private parseAnd(depth: number): PayrollExpression {
    let left = this.parseComparison(depth + 1)
    while (this.take('AND')) {
      left = { kind: 'binary', operator: 'AND', left, right: this.parseComparison(depth + 1) }
    }
    return left
  }

  private parseComparison(depth: number): PayrollExpression {
    let left = this.parseAdditive(depth + 1)
    while (['=', '!=', '>', '>=', '<', '<='].includes(this.current()?.value ?? '')) {
      const operator = this.consume().value as '=' | '!=' | '>' | '>=' | '<' | '<='
      left = { kind: 'binary', operator, left, right: this.parseAdditive(depth + 1) }
    }
    return left
  }

  private parseAdditive(depth: number): PayrollExpression {
    let left = this.parseMultiplicative(depth + 1)
    while (this.current()?.value === '+' || this.current()?.value === '-') {
      const operator = this.consume().value as '+' | '-'
      left = { kind: 'binary', operator, left, right: this.parseMultiplicative(depth + 1) }
    }
    return left
  }

  private parseMultiplicative(depth: number): PayrollExpression {
    let left = this.parseUnary(depth + 1)
    while (this.current()?.value === '*' || this.current()?.value === '/') {
      const operator = this.consume().value as '*' | '/'
      left = { kind: 'binary', operator, left, right: this.parseUnary(depth + 1) }
    }
    return left
  }

  private parseUnary(depth: number): PayrollExpression {
    this.assertDepth(depth)
    if (this.take('NOT')) return { kind: 'unary', operator: 'NOT', operand: this.parseUnary(depth + 1) }
    if (this.current()?.value === '-' && this.tokens[this.index + 1]?.kind === 'number') {
      this.consume('-')
      const value = this.consume().value
      return { kind: 'literal', valueType: 'DECIMAL', value: `-${value}` }
    }
    return this.parsePrimary(depth + 1)
  }

  private parsePrimary(depth: number): PayrollExpression {
    this.assertDepth(depth)
    if (this.take('(')) {
      const expression = this.parseOr(depth + 1)
      this.consume(')')
      return expression
    }

    const token = this.current()
    if (!token) throw new ComponentExpressionParseError()
    if (token.kind === 'number') {
      this.index += 1
      return { kind: 'literal', valueType: 'DECIMAL', value: token.value }
    }
    if (token.kind === 'string') {
      this.index += 1
      return { kind: 'string', value: token.value }
    }
    if (token.kind !== 'identifier') throw new ComponentExpressionParseError()

    this.index += 1
    const name = token.value
    const upperName = name.toUpperCase()
    if (upperName === 'TRUE' || upperName === 'FALSE') return { kind: 'boolean', value: upperName === 'TRUE' }

    if (this.take('.')) {
      const member = this.consume()
      if (member.kind !== 'identifier') throw new ComponentExpressionParseError()
      if (name === 'input') return { kind: 'input', name: member.value }
      if (name === 'parameter') return { kind: 'parameter', name: member.value }
      return { kind: 'output', componentCode: name, outputName: member.value }
    }

    if (!this.take('(')) throw new ComponentExpressionParseError()
    const args: PayrollExpression[] = []
    if (!this.take(')')) {
      do {
        args.push(this.parseOr(depth + 1))
      } while (this.take(','))
      this.consume(')')
    }

    if (['MONEY', 'DECIMAL', 'PERCENTAGE'].includes(upperName)) {
      if (args.length !== 1 || args[0]?.kind !== 'literal' || args[0].valueType !== 'DECIMAL') {
        throw new ComponentExpressionParseError()
      }
      return { ...args[0], valueType: upperName as 'MONEY' | 'DECIMAL' | 'PERCENTAGE' }
    }
    if (upperName === 'IF') {
      if (args.length !== 3) throw new ComponentExpressionParseError()
      return { kind: 'if', condition: args[0]!, then: args[1]!, else: args[2]! }
    }
    if (upperName === 'RATIO') {
      if (args.length !== 3 || args[2]?.kind !== 'string' || args[2].value.length === 0) {
        throw new ComponentExpressionParseError()
      }
      return { kind: 'ratio', numerator: args[0]!, denominator: args[1]!, roundingDefinitionId: args[2].value }
    }
    if (upperName === 'NOT' || upperName === 'ABS') {
      if (args.length !== 1) throw new ComponentExpressionParseError()
      return { kind: 'unary', operator: upperName, operand: args[0]! }
    }
    if (['MIN', 'MAX', 'ROUND'].includes(upperName) && args.length > 0) {
      return { kind: 'call', operator: upperName as 'MIN' | 'MAX' | 'ROUND', arguments: args }
    }
    throw new ComponentExpressionParseError()
  }

  private assertDepth(depth: number): void {
    if (depth > 48) throw new ComponentExpressionParseError()
  }
}

export function parsePayrollExpression(source: string): PayrollExpression {
  return new ExpressionParser(tokenize(source)).parse()
}

export function formatPayrollExpression(expression: PayrollExpression): string {
  switch (expression.kind) {
    case 'literal': return `${expression.valueType}(${expression.value})`
    case 'boolean': return String(expression.value)
    case 'string': return JSON.stringify(expression.value)
    case 'input': return `input.${expression.name}`
    case 'output': return `${expression.componentCode}.${expression.outputName}`
    case 'parameter': return `parameter.${expression.name}`
    case 'unary': return `${expression.operator}(${formatPayrollExpression(expression.operand)})`
    case 'binary': return `(${formatPayrollExpression(expression.left)} ${expression.operator} ${formatPayrollExpression(expression.right)})`
    case 'ratio': return `RATIO(${formatPayrollExpression(expression.numerator)}, ${formatPayrollExpression(expression.denominator)}, ${JSON.stringify(expression.roundingDefinitionId)})`
    case 'if': return `IF(${formatPayrollExpression(expression.condition)}, ${formatPayrollExpression(expression.then)}, ${formatPayrollExpression(expression.else)})`
    case 'call': return `${expression.operator}(${expression.arguments.map(formatPayrollExpression).join(', ')})`
  }
}
