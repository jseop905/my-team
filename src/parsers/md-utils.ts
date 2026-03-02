/**
 * ## 섹션명 하위 텍스트를 추출한다.
 * 다음 ## 이나 파일 끝까지를 범위로 한다.
 */
export function extractSection(content: string, sectionName: string): string {
  const pattern = new RegExp(
    `^##\\s+${escapeRegex(sectionName)}\\s*$`,
    "m",
  );
  const match = pattern.exec(content);
  if (!match) return "";

  const start = match.index + match[0].length;
  const nextSection = content.indexOf("\n## ", start);
  const end = nextSection === -1 ? content.length : nextSection;

  return content.slice(start, end).trim();
}

/**
 * ## 섹션 내부의 코드 블록(```)을 추출한다.
 */
export function extractCodeBlock(
  content: string,
  sectionName: string,
): string {
  const section = extractSection(content, sectionName);
  if (!section) return "";

  const match = section.match(/```[\s\S]*?\n([\s\S]*?)```/);
  return match ? match[1].trim() : "";
}

/**
 * H1 제목 바로 다음에 오는 설명 문단을 추출한다.
 */
export function extractDescription(content: string): string {
  const lines = content.split("\n");
  const descLines: string[] = [];
  let pastTitle = false;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      pastTitle = true;
      continue;
    }
    if (!pastTitle) continue;

    // 다음 섹션이 시작되면 중단
    if (line.startsWith("## ")) break;

    descLines.push(line);
  }

  return descLines.join("\n").trim();
}

/**
 * 에이전트 표시명을 파일명(kebab-case)으로 정규화한다.
 * - 백틱 제거
 * - "Tech Architect" → "tech-architect"
 */
export function normalizeAgentName(raw: string): string {
  return raw
    .replace(/`/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * 마크다운 테이블을 파싱하여 행별 객체 배열로 반환한다.
 */
export function parseMarkdownTable(
  section: string,
): Record<string, string>[] {
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));

  if (lines.length < 2) return [];

  // 첫 줄: 헤더
  const headers = parseCells(lines[0]);

  // 두 번째 줄: 구분선 (건너뜀)
  // 나머지: 데이터 행
  const rows: Record<string, string>[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseCells(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
