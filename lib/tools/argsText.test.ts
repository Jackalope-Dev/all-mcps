import { describe, expect, it } from 'vitest';
import { formatArgsText, parseArgsText } from './argsText';

describe('parseArgsText', () => {
  it('keeps a quoted path with spaces as one argument, without the quotes', () => {
    expect(
      parseArgsText('-y @modelcontextprotocol/server-filesystem "C:/My Files"'),
    ).toEqual(['-y', '@modelcontextprotocol/server-filesystem', 'C:/My Files']);
    expect(parseArgsText("--root 'C:/My Files'")).toEqual([
      '--root',
      'C:/My Files',
    ]);
  });

  it('keeps Windows backslashes literal', () => {
    expect(parseArgsText('C:\\Users\\me "C:\\Program Files\\" x')).toEqual([
      'C:\\Users\\me',
      'C:\\Program Files\\',
      'x',
    ]);
    expect(parseArgsText('"say \\"hi\\""')).toEqual(['say "hi"']);
    expect(parseArgsText('C:\\My\\ Files')).toEqual(['C:\\My Files']);
  });

  it('joins quoted and bare text in one word, keeps empty quoted args', () => {
    expect(parseArgsText('--dir="a b" "" x')).toEqual(['--dir=a b', '', 'x']);
  });

  it('collapses extra whitespace and runs an unclosed quote to the end', () => {
    expect(parseArgsText('  a   b  ')).toEqual(['a', 'b']);
    expect(parseArgsText('a "b c')).toEqual(['a', 'b c']);
    expect(parseArgsText('')).toEqual([]);
  });
});

describe('formatArgsText', () => {
  it('round-trips every argument shape', () => {
    const cases: string[][] = [
      ['-y', '@modelcontextprotocol/server-filesystem', 'C:/My Files'],
      ['C:\\Users\\me', 'C:\\My Files\\'],
      ['say "hi"', "it's", `both "q" and 'q'`, ''],
    ];
    for (const args of cases) {
      expect(parseArgsText(formatArgsText(args))).toEqual(args);
    }
  });

  it('shows spaced args in double quotes and leaves plain ones bare', () => {
    expect(formatArgsText(['-y', 'pkg', 'C:/My Files'])).toBe(
      '-y pkg "C:/My Files"',
    );
  });
});
