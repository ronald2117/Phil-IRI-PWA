import type { AssessmentResult, Miscue } from "@/types/assessment";

export type PassageWordStatus = "correct" | "substitution" | "omission" | "repetition";

export interface PassageAlignment {
  wordStatuses: PassageWordStatus[];
  substitutions: Map<number, string>;
  insertions: Map<number, Array<{ word: string; status: "insertion" | "repetition" }>>;
}

function tokenize(text: string) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Pc}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function findMatches(expected: string[], actual: string[]): Array<[number, number]> {
  const rows = expected.length + 1;
  const columns = actual.length + 1;
  const lcs = new Uint32Array(rows * columns);

  for (let i = expected.length - 1; i >= 0; i -= 1) {
    for (let j = actual.length - 1; j >= 0; j -= 1) {
      const index = i * columns + j;
      lcs[index] = expected[i] === actual[j]
        ? lcs[(i + 1) * columns + j + 1] + 1
        : Math.max(lcs[(i + 1) * columns + j], lcs[index + 1]);
    }
  }

  const matches: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < expected.length && j < actual.length) {
    if (expected[i] === actual[j]) {
      matches.push([i, j]);
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * columns + j] >= lcs[i * columns + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return matches;
}

function findRepeatedActualIndices(actual: string[], matches: Array<[number, number]>) {
  const matchedIndices = new Set(matches.map(([, actualIndex]) => actualIndex));
  const repeatedIndices = new Set<number>();
  let start = 0;

  while (start < actual.length) {
    let end = start + 1;
    while (end < actual.length && actual[end] === actual[start]) end += 1;
    if (end - start > 1) {
      const matchedInRun = Array.from({ length: end - start }, (_, offset) => start + offset)
        .filter((index) => matchedIndices.has(index)).length;
      const surplusIndices = Array.from({ length: end - start }, (_, offset) => start + offset)
        .filter((index) => !matchedIndices.has(index));
      const repeated = matchedInRun > 0 ? surplusIndices : surplusIndices.slice(1);
      for (const index of repeated) repeatedIndices.add(index);
    }
    start = end;
  }

  return repeatedIndices;
}

export function alignPassage(expectedText: string, transcript: string): PassageAlignment {
  const expected = tokenize(expectedText);
  const actual = tokenize(transcript);
  const wordStatuses: PassageWordStatus[] = Array(expected.length).fill("correct");
  const substitutions = new Map<number, string>();
  const insertions = new Map<number, Array<{ word: string; status: "insertion" | "repetition" }>>();
  const matches = findMatches(expected, actual);
  const repeatedActualIndices = findRepeatedActualIndices(actual, matches);
  let expectedStart = 0;
  let actualStart = 0;

  function addGap(expectedEnd: number, actualEnd: number) {
    const expectedGap = expected.slice(expectedStart, expectedEnd);
    const actualGap = actual.slice(actualStart, actualEnd);
    const paired = Math.min(expectedGap.length, actualGap.length);

    for (let index = 0; index < paired; index += 1) {
      const expectedIndex = expectedStart + index;
      const actualWord = actualGap[index];
      const isRepetition = repeatedActualIndices.has(actualStart + index);
      wordStatuses[expectedIndex] = isRepetition ? "repetition" : "substitution";
      substitutions.set(expectedIndex, actualWord);
    }
    for (let index = paired; index < expectedGap.length; index += 1) {
      const expectedIndex = expectedStart + index;
      wordStatuses[expectedIndex] = "omission";
    }
    for (const [index, word] of actualGap.slice(paired).entries()) {
      const words = insertions.get(expectedEnd) ?? [];
      words.push({
        word,
        status: repeatedActualIndices.has(actualStart + paired + index) ? "repetition" : "insertion",
      });
      insertions.set(expectedEnd, words);
    }
  }

  for (const [expectedIndex, actualIndex] of matches) {
    addGap(expectedIndex, actualIndex);
    expectedStart = expectedIndex + 1;
    actualStart = actualIndex + 1;
  }
  addGap(expected.length, actual.length);

  return { wordStatuses, substitutions, insertions };
}

function readingLevel(accuracy: number) {
  if (accuracy >= 97) return "Independent";
  if (accuracy >= 90) return "Instructional";
  return "Frustration";
}

export function analyzeMiscues(expectedText: string, transcript: string): AssessmentResult {
  const expected = tokenize(expectedText);
  const actual = tokenize(transcript);
  const matches = findMatches(expected, actual);
  const repeatedActualIndices = findRepeatedActualIndices(actual, matches);

  const miscues: Miscue[] = [];
  let expectedStart = 0;
  let actualStart = 0;

  function addAligned(expectedWord: string, actualWord: string, actualIndex?: number, type?: Miscue["type"]) {
    const miscueType = actualIndex !== undefined && repeatedActualIndices.has(actualIndex)
      ? "Repetition"
      : type;
    if (miscueType) {
      miscues.push({
        expected: miscueType === "Repetition" ? expectedWord || actualWord : expectedWord,
        actual: actualWord,
        type: miscueType,
      });
    }
  }

  function addGap(expectedEnd: number, actualEnd: number) {
    const expectedGap = expected.slice(expectedStart, expectedEnd);
    const actualGap = actual.slice(actualStart, actualEnd);
    const paired = Math.min(expectedGap.length, actualGap.length);

    for (let index = 0; index < paired; index += 1) {
      addAligned(expectedGap[index], actualGap[index], actualStart + index, "Substitution");
    }
    for (const word of expectedGap.slice(paired)) {
      addAligned(word, "");
    }
    for (const [index, word] of actualGap.slice(paired).entries()) {
      addAligned("", word, actualStart + paired + index, "Insertion");
    }
  }

  for (const [expectedIndex, actualIndex] of matches) {
    addGap(expectedIndex, actualIndex);
    addAligned(expected[expectedIndex], actual[actualIndex], actualIndex);
    expectedStart = expectedIndex + 1;
    actualStart = actualIndex + 1;
  }
  addGap(expected.length, actual.length);

  const totalWords = expected.length;
  const penalized = miscues.filter((miscue) =>
    miscue.type === "Substitution" || miscue.type === "Omission" || miscue.type === "Repetition"
  ).length;
  const correctWords = Math.max(0, totalWords - penalized);
  const accuracy = totalWords === 0 ? 0 : (correctWords / totalWords) * 100;

  return {
    transcript,
    expected_text: expectedText,
    total_words: totalWords,
    correct_words: correctWords,
    miscues,
    accuracy: Math.round(accuracy * 100) / 100,
    reading_level: readingLevel(accuracy),
  };
}
