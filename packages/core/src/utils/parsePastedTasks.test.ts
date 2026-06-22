import { describe, it, expect } from 'vitest';
import { parsePastedTimerTasks } from './parsePastedTasks.js';

describe('parsePastedTimerTasks', () => {
  it('parses a basic integer duration', () => {
    const { tasks, skippedLines } = parsePastedTimerTasks('Do something (30)');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual({ title: 'Do something', durationMinutes: 30, durationSeconds: 1800 });
    expect(skippedLines).toHaveLength(0);
  });

  it('parses a decimal duration', () => {
    const { tasks } = parsePastedTimerTasks('Quick email review (7.5)');
    expect(tasks[0]?.durationMinutes).toBe(7.5);
    expect(tasks[0]?.durationSeconds).toBe(450);
  });

  it('preserves parentheses inside the task title', () => {
    const { tasks } = parsePastedTimerTasks(
      'Ryan Linvill - Company and process (also make this a template) (20)',
    );
    expect(tasks[0]?.title).toBe('Ryan Linvill - Company and process (also make this a template)');
    expect(tasks[0]?.durationMinutes).toBe(20);
  });

  it('ignores blank lines', () => {
    const input = 'Task A (10)\n\n   \nTask B (5)';
    const { tasks } = parsePastedTimerTasks(input);
    expect(tasks).toHaveLength(2);
  });

  it('skips lines with no duration', () => {
    const { tasks, skippedLines } = parsePastedTimerTasks('No duration here');
    expect(tasks).toHaveLength(0);
    expect(skippedLines).toHaveLength(1);
    expect(skippedLines[0]?.line).toBe('No duration here');
  });

  it('skips lines where duration is zero', () => {
    const { tasks, skippedLines } = parsePastedTimerTasks('Bad task (0)');
    expect(tasks).toHaveLength(0);
    expect(skippedLines[0]?.reason).toMatch(/positive/i);
  });

  it('converts decimal < 1 minute to seconds correctly', () => {
    // (0.5) = 0.5 min = 30 seconds
    const { tasks } = parsePastedTimerTasks('Short task (0.5)');
    expect(tasks[0]?.durationMinutes).toBe(0.5);
    expect(tasks[0]?.durationSeconds).toBe(30);
  });

  it('parses multiple tasks from a pasted block', () => {
    const input = [
      "Finalize Bobbi's Canada Passport (30)",
      'Ryan Linvill -w- Cameron Agreement (45)',
      'Gabe Wax -w- Fey Fili Producer Agreement (20)',
      'Ryan Linvill -w- Sawyer Hill Lender - Company and process (also make this a template) (20)',
      'Process Milli -w- Taydex Agreement (6)',
      'Quick email review (7.5)',
    ].join('\n');
    const { tasks, skippedLines } = parsePastedTimerTasks(input);
    expect(tasks).toHaveLength(6);
    expect(skippedLines).toHaveLength(0);
    expect(tasks[3]?.title).toBe(
      'Ryan Linvill -w- Sawyer Hill Lender - Company and process (also make this a template)',
    );
    expect(tasks[5]?.durationSeconds).toBe(450);
  });
});
