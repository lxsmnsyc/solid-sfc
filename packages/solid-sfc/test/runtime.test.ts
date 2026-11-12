import { describe, expect, it } from 'vitest';
import { spreadStyle } from '../src/runtime.ts';

const variables = () => ({ '--v': '1px' });

describe('spreadStyle', () => {
  it('returns a source without a style key as it is', () => {
    const source = { id: 'a' };
    expect(spreadStyle(source, variables)).toBe(source);
    expect(spreadStyle(undefined, variables)).toBe(undefined);
  });

  it('merges the style of the source with the variables', () => {
    expect(spreadStyle({ style: { color: 'red' } }, variables).style).toEqual({
      color: 'red',
      '--v': '1px',
    });
    expect(spreadStyle({ style: 'color: red' }, variables).style).toBe('color: red;--v:1px');
    expect(spreadStyle({ style: undefined }, variables).style).toEqual({ '--v': '1px' });
  });

  it('reads the style of the source when it is used', () => {
    const source = { style: { color: 'red' } };
    const result = spreadStyle(source, variables);
    source.style = { color: 'blue' };
    expect(result.style).toEqual({ color: 'blue', '--v': '1px' });
  });
});
