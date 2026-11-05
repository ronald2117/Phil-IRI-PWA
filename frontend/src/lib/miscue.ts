import type { AssessmentResult, Miscue } from "@/types/assessment";

function tokenize(text: string) {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Pc}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function readingLevel(accuracy: number) {
  if (accuracy >= 97) return "Independent";
  if (accuracy >= 90) return "Instructional";
  return "Frustration";
}

export function analyzeMiscues(expectedText: string, transcript: string): AssessmentResult {
  const expected = tokenize(expectedText);
  const actual = tokenize(transcript);
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

  const miscues: Miscue[] = [];
  const aligned: Array<{ expected: string; actual: string }> = [];
  let expectedStart = 0;
  let actualStart = 0;

  function addGap(expectedEnd: number, actualEnd: number) {
    const expectedGap = expected.slice(expectedStart, expectedEnd);
    const actualGap = actual.slice(actualStart, actualEnd);
    const paired = Math.min(expectedGap.length, actualGap.length);

    for (let index = 0; index < paired; index += 1) {
      miscues.push({ expected: expectedGap[index], actual: actualGap[index], type: "Substitution" });
      aligned.push({ expected: expectedGap[index], actual: actualGap[index] });
    }
    for (const word of expectedGap.slice(paired)) {
      miscues.push({ expected: word, actual: "", type: "Omission" });
      aligned.push({ expected: word, actual: "" });
    }
    for (const word of actualGap.slice(paired)) {
      miscues.push({ expected: "", actual: word, type: "Insertion" });
      aligned.push({ expected: "", actual: word });
    }
  }

  for (const [expectedIndex, actualIndex] of matches) {
    addGap(expectedIndex, actualIndex);
    aligned.push({ expected: expected[expectedIndex], actual: actual[actualIndex] });
    expectedStart = expectedIndex + 1;
    actualStart = actualIndex + 1;
  }
  addGap(expected.length, actual.length);

  let previousActual = "";
  for (const pair of aligned) {
    const currentActual = pair.actual;
    if (currentActual && currentActual === previousActual) {
      miscues.push({
        expected: pair.expected || currentActual,
        actual: currentActual,
        type: "Repetition",
      });
    }
    if (currentActual) previousActual = currentActual;
  }

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
