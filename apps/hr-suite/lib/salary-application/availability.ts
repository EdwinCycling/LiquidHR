export function resolveSalaryStructureIntersection(
  administrationStructureIds: readonly string[],
  laborConditionStructureIds?: readonly string[],
): string[] {
  const administrationIds = [...new Set(administrationStructureIds)]
  if (!laborConditionStructureIds || laborConditionStructureIds.length === 0) return administrationIds

  const laborConditionIds = new Set(laborConditionStructureIds)
  return administrationIds.filter((structureId) => laborConditionIds.has(structureId))
}

export function hasLaborConditionStructureFilter(
  laborConditionStructureIds?: readonly string[],
): boolean {
  return Boolean(laborConditionStructureIds && laborConditionStructureIds.length > 0)
}
