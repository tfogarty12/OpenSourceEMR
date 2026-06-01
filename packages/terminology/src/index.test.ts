import { describe, it, expect } from 'vitest';
import { InMemoryTerminologyProvider, CodeSystems } from './index';

function provider(): InMemoryTerminologyProvider {
  return new InMemoryTerminologyProvider()
    .addConcept({
      system: CodeSystems.RXNORM,
      code: '1049630',
      display: 'acetaminophen 325 MG Oral Tablet',
      properties: { tty: 'SCD' },
    })
    .addConcept({
      system: CodeSystems.LOINC,
      code: '718-7',
      display: 'Hemoglobin [Mass/volume] in Blood',
    });
}

describe('InMemoryTerminologyProvider', () => {
  it('validates a known code', async () => {
    const result = await provider().validateCode({
      system: CodeSystems.RXNORM,
      code: '1049630',
    });
    expect(result.valid).toBe(true);
    expect(result.coding?.display).toContain('acetaminophen');
  });

  it('rejects an unknown code', async () => {
    const result = await provider().validateCode({
      system: CodeSystems.RXNORM,
      code: '000000',
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Unknown code/);
  });

  it('reports supported systems', () => {
    const p = provider();
    expect(p.supports(CodeSystems.LOINC)).toBe(true);
    expect(p.supports(CodeSystems.CPT)).toBe(false);
  });

  it('translates codes when a mapping exists', async () => {
    const p = provider().addMapping(
      { system: CodeSystems.RXNORM, code: '1049630' },
      { system: CodeSystems.SNOMED, code: '387517004', display: 'Paracetamol' },
    );
    const translated = await p.translate(
      { system: CodeSystems.RXNORM, code: '1049630' },
      CodeSystems.SNOMED,
    );
    expect(translated).toHaveLength(1);
    expect(translated[0]?.code).toBe('387517004');
  });
});
