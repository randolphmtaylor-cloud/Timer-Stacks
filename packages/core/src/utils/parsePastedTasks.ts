// Regex: captures everything before the final (number) group
const DURATION_RE = /^(.*?)\s*\((\d+(?:\.\d+)?)\)\s*$/;

export interface ParsedTask {
  title: string;
  durationMinutes: number;
  durationSeconds: number;
}

export interface SkippedLine {
  line: string;
  reason: string;
}

export interface ParsePastedTasksResult {
  tasks: ParsedTask[];
  skippedLines: SkippedLine[];
}

export function parsePastedTimerTasks(input: string): ParsePastedTasksResult {
  const tasks: ParsedTask[] = [];
  const skippedLines: SkippedLine[] = [];

  for (const raw of input.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const match = DURATION_RE.exec(line);
    if (!match) {
      skippedLines.push({ line, reason: 'No duration found at end of line' });
      continue;
    }

    const title = match[1]!.trim();
    const durationMinutes = parseFloat(match[2]!);

    if (!isFinite(durationMinutes) || durationMinutes <= 0) {
      skippedLines.push({ line, reason: 'Duration must be a positive number' });
      continue;
    }

    if (!title) {
      skippedLines.push({ line, reason: 'Task title is empty' });
      continue;
    }

    const durationSeconds = Math.round(durationMinutes * 60);
    tasks.push({ title, durationMinutes, durationSeconds });
  }

  return { tasks, skippedLines };
}
