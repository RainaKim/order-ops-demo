import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rulesRoot = path.join(repoRoot, 'labs/tools/rules');
const requiredLabHeadings = [
  '## 0. 이 랩이 끝나면',
  '## 1. 시작 전 상태 확인',
  '## 2. 실습 목표와 산출물',
  '## 3. 실습',
  '## 4. Self-check',
  '## 5. 자주 하는 실수',
  '## 6. 다음 lab으로 넘기는 것',
];
const forbiddenLabTerms = [
  '정답',
  '예시 답안',
  '모범',
  '아래를 복사',
  '강사',
  '수강생',
  '학생',
  '클립',
  '리허설',
  '녹화',
];
const forbiddenLabPatterns = [
  { pattern: /L\d{2}-C\d/g, label: '클립 ID' },
  { pattern: /\bC[1-4]\b/g, label: '클립 단계 참조' },
];

let failures = 0;
let warnings = 0;

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`WARN ${message}`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

function parseRule(lecture) {
  const rulePath = path.join(rulesRoot, `l${lecture}.json`);
  return JSON.parse(readFileSync(rulePath, 'utf8'));
}

function parseLectureNumber(rawLecture, label) {
  const number = Number(rawLecture);
  if (!Number.isInteger(number) || number < 1 || number > 20) {
    fail('lab 번호는 01부터 20 사이여야 합니다.');
    finish(label);
  }
  return number;
}

function fileFromWorktree(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return readFileSync(absolutePath, 'utf8');
}

function fileFromBranch(relativePath, branch) {
  const result = run('git', ['show', `${branch}:${relativePath}`]);
  return result.status === 0 ? result.stdout : null;
}

function readTargetFile(relativePath, branch) {
  return branch ? fileFromBranch(relativePath, branch) : fileFromWorktree(relativePath);
}

function countItems(markdown) {
  const lines = markdown.split(/\r?\n/);
  let listItems = 0;
  let tableRows = 0;

  for (const line of lines) {
    if (/^\s*[-*]\s+(?:\[[ xX]\]\s+)?\S/.test(line)) {
      listItems += 1;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && !/\|\s*:?-{3,}/.test(line)) {
      tableRows += 1;
    }
  }

  return Math.max(listItems, Math.max(0, tableRows - 1));
}

function headingIndex(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown.search(new RegExp(`^${escapedHeading}\\s*$`, 'm'));
}

function sectionBody(markdown, heading) {
  const start = headingIndex(markdown, heading);
  if (start < 0) {
    return '';
  }
  const afterHeading = markdown.slice(start + heading.length);
  const nextHeading = afterHeading.search(/^#{1,2}\s+/m);
  return (nextHeading < 0 ? afterHeading : afterHeading.slice(0, nextHeading)).trim();
}

function sectionText(markdown, heading) {
  return sectionBody(markdown, heading)
    .replace(/[`#|\-*_[\]]/g, '')
    .trim();
}

function validateArtifact(entry, branch, level) {
  const content = readTargetFile(entry.path, branch);
  if (content === null) {
    if (level === 'required') {
      fail(`${entry.path} 파일이 없습니다.`);
    } else {
      warn(`${entry.path} 보조 산출물이 없습니다.`);
    }
    return;
  }

  pass(`${entry.path} 파일이 있습니다.`);

  let previousHeadingIndex = -1;
  for (const heading of entry.fixedHeadings ?? []) {
    const currentHeadingIndex = headingIndex(content, heading);
    if (currentHeadingIndex < 0) {
      if (level === 'required') {
        fail(`${entry.path}에 고정 헤딩 ${heading}이 없습니다.`);
      } else {
        warn(`${entry.path}에 고정 헤딩 ${heading}이 없습니다.`);
      }
      continue;
    }

    if (currentHeadingIndex < previousHeadingIndex) {
      if (level === 'required') {
        fail(`${entry.path}의 고정 헤딩 ${heading} 순서가 잘못됐습니다.`);
      } else {
        warn(`${entry.path}의 고정 헤딩 ${heading} 순서가 잘못됐습니다.`);
      }
    }
    previousHeadingIndex = currentHeadingIndex;

    if (sectionText(content, heading).length < 20) {
      if (level === 'required') {
        fail(`${entry.path}의 ${heading} 본문이 20자보다 짧습니다.`);
      } else {
        warn(`${entry.path}의 ${heading} 본문이 20자보다 짧습니다.`);
      }
    }
  }

  for (const expected of entry.contains ?? []) {
    if (!content.includes(expected)) {
      if (level === 'required') {
        fail(`${entry.path}에 '${expected}' 내용이 없습니다.`);
      } else {
        warn(`${entry.path}에 '${expected}' 내용이 없습니다.`);
      }
    }
  }

  for (const pattern of entry.patterns ?? []) {
    if (!new RegExp(pattern, 'm').test(content)) {
      if (level === 'required') {
        fail(`${entry.path}가 필수 패턴 /${pattern}/을 충족하지 않습니다.`);
      } else {
        warn(`${entry.path}가 권장 패턴 /${pattern}/을 충족하지 않습니다.`);
      }
    }
  }

  for (const section of entry.sectionMinItems ?? []) {
    const body = sectionBody(content, section.heading);
    if (countItems(body) < section.minItems) {
      if (level === 'required') {
        fail(`${entry.path}의 ${section.heading} 항목 수가 ${section.minItems}개보다 적습니다.`);
      } else {
        warn(`${entry.path}의 ${section.heading} 항목 수가 ${section.minItems}개보다 적습니다.`);
      }
    }
  }

  if (entry.minItems && countItems(content) < entry.minItems) {
    if (level === 'required') {
      fail(`${entry.path}의 항목 수가 ${entry.minItems}개보다 적습니다.`);
    } else {
      warn(`${entry.path}의 항목 수가 ${entry.minItems}개보다 적습니다.`);
    }
  }

  if (/\bTODO\b/.test(content)) {
    if (level === 'required') {
      fail(`${entry.path}에 TODO만 남은 항목이 있습니다.`);
    } else {
      warn(`${entry.path}에 TODO가 남아 있습니다.`);
    }
  }
}

function runEnvironmentCheck() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) {
    pass(`Node.js ${process.versions.node} 사용 중입니다.`);
  } else {
    fail(`Node.js 20 이상이 필요합니다. 현재 ${process.versions.node}입니다.`);
  }

  if (existsSync(path.join(repoRoot, 'node_modules')) && existsSync(path.join(repoRoot, 'node_modules/vitest'))) {
    pass('의존성이 설치돼 있습니다.');
  } else {
    fail('의존성이 없습니다. npm install을 먼저 실행하세요.');
  }

  if (failures === 0) {
    const test = run('npm', ['test'], { stdio: 'inherit' });
    if (test.status === 0) {
      pass('npm test가 통과했습니다.');
    } else {
      fail('npm test가 실패했습니다.');
    }
  }

  finish('환경 점검');
}

function checkHeadingOrder(markdown, relativePath) {
  let cursor = -1;
  for (const heading of requiredLabHeadings) {
    const index = markdown.indexOf(heading);
    if (index < 0) {
      fail(`${relativePath}에 ${heading} 헤딩이 없습니다.`);
      continue;
    }
    if (index < cursor) {
      fail(`${relativePath}의 ${heading} 순서가 잘못됐습니다.`);
    }
    cursor = index;
  }
}

function checkExercises(markdown, relativePath) {
  const exerciseMatches = [...markdown.matchAll(/^### E\d+\..*$/gm)];
  if (exerciseMatches.length === 0) {
    fail(`${relativePath}에 E 번호 실습이 없습니다.`);
    return;
  }

  for (let index = 0; index < exerciseMatches.length; index += 1) {
    const match = exerciseMatches[index];
    const end = exerciseMatches[index + 1]?.index ?? markdown.indexOf('## 4. Self-check');
    const block = markdown.slice(match.index, end);
    const designIndex = block.indexOf('#### 설계 질문');
    const executionIndex = block.indexOf('#### 실행');
    const verificationIndex = block.indexOf('#### 검증');

    if (!(designIndex >= 0 && executionIndex > designIndex && verificationIndex > executionIndex)) {
      fail(`${relativePath}의 ${match[0]}에 설계 질문 → 실행 → 검증 순서가 없습니다.`);
      continue;
    }

    const designBlock = block.slice(designIndex, executionIndex);
    const verificationBlock = block.slice(verificationIndex);
    const questionCount = (designBlock.match(/^\s*-\s+\S/gm) ?? []).length;
    const checkboxCount = (verificationBlock.match(/^\s*-\s+\[[ xX]\]\s+\S/gm) ?? []).length;
    const looseVerificationItems = (verificationBlock.match(/^\s*-\s+(?!\[[ xX]\])\S/gm) ?? []).length;

    if (questionCount < 2 || questionCount > 4) {
      fail(`${relativePath}의 ${match[0]} 설계 질문이 ${questionCount}개입니다. 2~4개여야 합니다.`);
    }
    if (checkboxCount < 3 || checkboxCount > 6) {
      fail(`${relativePath}의 ${match[0]} 검증 체크박스가 ${checkboxCount}개입니다. 3~6개여야 합니다.`);
    }
    if (looseVerificationItems > 0) {
      fail(`${relativePath}의 ${match[0]} 검증 목록은 모두 체크박스여야 합니다.`);
    }
  }
}

function checkCodeBlockLengths(markdown, relativePath) {
  const lines = markdown.split(/\r?\n/);
  let fenceStart = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('```')) {
      continue;
    }
    if (fenceStart < 0) {
      fenceStart = index;
    } else {
      const bodyLength = index - fenceStart - 1;
      if (bodyLength > 12) {
        warn(`${relativePath}:${fenceStart + 1} 코드블록이 ${bodyLength}줄입니다.`);
      }
      fenceStart = -1;
    }
  }
  if (fenceStart >= 0) {
    fail(`${relativePath}에 닫히지 않은 코드블록이 있습니다.`);
  }
}

function wildcardExists(relativePattern) {
  if (!relativePattern.includes('*')) {
    return existsSync(path.join(repoRoot, relativePattern));
  }

  const directory = path.dirname(relativePattern);
  const pattern = path.basename(relativePattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*');
  const matcher = new RegExp(`^${pattern}$`);
  const absoluteDirectory = path.join(repoRoot, directory);
  return existsSync(absoluteDirectory) && readdirSync(absoluteDirectory).some((name) => matcher.test(name));
}

function checkInstructionReferences(markdown, relativePath) {
  const assetPattern = /labs\/(?:fixtures|lecture\d{2}\/inputs)\/[A-Za-z0-9가-힣_./*-]+/g;
  const assets = new Set(markdown.match(assetPattern) ?? []);
  for (const asset of assets) {
    if (!wildcardExists(asset)) {
      fail(`${relativePath}가 참조한 ${asset} 파일이 없습니다.`);
    }
  }

  const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(?:https?:|#)/.test(link)) {
      continue;
    }
    const target = path.resolve(repoRoot, path.dirname(relativePath), link);
    if (!existsSync(target)) {
      fail(`${relativePath}의 링크 ${link} 대상이 없습니다.`);
    }
  }
}

function lintLabs() {
  for (let number = 1; number <= 20; number += 1) {
    const lecture = String(number).padStart(2, '0');
    const relativePath = `labs/lecture${lecture}/README.md`;
    const markdown = fileFromWorktree(relativePath);
    if (markdown === null) {
      fail(`${relativePath}가 없습니다.`);
      continue;
    }

    const lines = markdown.split(/\r?\n/);
    if (lines.length > 250) {
      fail(`${relativePath}가 ${lines.length}줄입니다. 250줄 이하여야 합니다.`);
    }

    checkHeadingOrder(markdown, relativePath);
    checkExercises(markdown, relativePath);
    checkCodeBlockLengths(markdown, relativePath);
    checkInstructionReferences(markdown, relativePath);

    for (const term of forbiddenLabTerms) {
      if (markdown.includes(term)) {
        fail(`${relativePath}에 금지어 '${term}'가 있습니다.`);
      }
    }

    for (const { pattern, label } of forbiddenLabPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(markdown)) {
        fail(`${relativePath}에 ${label}가 있습니다.`);
      }
    }
  }

  finish('lab lint');
}

function runAppChecks() {
  const commands = [
    ['npm', ['test']],
    ['npm', ['run', 'lint']],
    ['npm', ['run', 'typecheck']],
  ];

  for (const [command, args] of commands) {
    const result = run(command, args, { stdio: 'inherit' });
    const label = [command, ...args].join(' ');
    if (result.status === 0) {
      pass(`${label}가 통과했습니다.`);
    } else {
      fail(`${label}가 실패했습니다.`);
    }
  }
}

function auditLocation(relativePath) {
  if (relativePath === 'AGENTS.md') {
    return 'repo 진입점';
  }
  if (relativePath.startsWith('docs/')) {
    return 'docs/ 장기 기준';
  }
  if (relativePath.startsWith('notes/')) {
    return 'notes/ 작업 기록';
  }
  if (relativePath.startsWith('.github/')) {
    return '.github/ 플랫폼 설정';
  }
  if (
    relativePath.startsWith('labs/fixtures/')
    || /^labs\/lecture\d{2}\/inputs\//.test(relativePath)
  ) {
    return 'labs/ 실습 입력';
  }
  return null;
}

function normalizeReference(sourcePath, rawReference) {
  const withoutDecoration = rawReference
    .trim()
    .replace(/^<|>$/g, '')
    .split(/[?#]/, 1)[0]
    .replace(/[.,;:]+$/, '');

  if (
    withoutDecoration === ''
    || /^(?:https?:|mailto:|#)/.test(withoutDecoration)
    || withoutDecoration.includes('*')
  ) {
    return null;
  }

  const fromRepoRoot = /^(?:AGENTS\.md|docs\/|notes\/|\.github\/|labs\/|src\/|tests\/)/
    .test(withoutDecoration);
  const absoluteTarget = fromRepoRoot
    ? path.resolve(repoRoot, withoutDecoration)
    : path.resolve(repoRoot, path.dirname(sourcePath), withoutDecoration);
  const relativeTarget = path.relative(repoRoot, absoluteTarget).split(path.sep).join('/');

  if (relativeTarget.startsWith('../') || path.isAbsolute(relativeTarget)) {
    return null;
  }
  return relativeTarget;
}

function findDocumentReferences(sourcePath, markdown) {
  const references = new Set();
  const markdownLinks = [...markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)];
  for (const match of markdownLinks) {
    const target = normalizeReference(sourcePath, match[1]);
    if (target) {
      references.add(target);
    }
  }

  const filePathPattern = /(?:^|[\s`'"(@])((?:\.\.\/|\.\/)*(?:AGENTS\.md|(?:docs|notes|\.github|labs|src|tests)\/[A-Za-z0-9가-힣_.\/-]+\.(?:md|json|mjs|ts)))(?=$|[\s`'"),:;])/gm;
  for (const match of markdown.matchAll(filePathPattern)) {
    const target = normalizeReference(sourcePath, match[1]);
    if (target) {
      references.add(target);
    }
  }

  return references;
}

function auditDocuments(rawLecture) {
  const number = parseLectureNumber(rawLecture, '문서 관계 audit');
  const documentPaths = new Set();

  // --audit-docs NN은 NN 실습에 들어가기 전까지 완성된 산출물을 점검한다.
  // 예를 들어 Lab 11 E1은 Lab 01~10의 required 문서만 사용한다.
  for (let current = 1; current < number; current += 1) {
    const rule = parseRule(String(current).padStart(2, '0'));
    for (const entry of rule.required) {
      if (entry.path === 'AGENTS.md' || entry.path.endsWith('.md')) {
        documentPaths.add(entry.path);
      }
    }
  }

  const conventionsPath = 'labs/CONVENTIONS.md';
  if (!existsSync(path.join(repoRoot, conventionsPath))) {
    fail(`${conventionsPath} 위치 규약 파일이 없습니다.`);
  }

  const contents = new Map();
  for (const relativePath of [...documentPaths].sort()) {
    const content = fileFromWorktree(relativePath);
    if (content === null) {
      fail(`${relativePath} 필수 문서가 없습니다.`);
      continue;
    }

    const location = auditLocation(relativePath);
    if (location === null) {
      fail(`${relativePath}가 labs/CONVENTIONS.md의 문서 위치 규약에 속하지 않습니다.`);
      continue;
    }

    pass(`${relativePath} 파일이 있고 ${location} 위치에 있습니다. 내용 검증은 하지 않았습니다.`);
    contents.set(relativePath, content);
  }

  const relationships = new Set();
  const connectedDocuments = new Set();
  const brokenReferences = new Set();

  for (const [sourcePath, markdown] of contents) {
    for (const targetPath of findDocumentReferences(sourcePath, markdown)) {
      if (targetPath === sourcePath) {
        continue;
      }

      if (!existsSync(path.join(repoRoot, targetPath))) {
        brokenReferences.add(`${sourcePath}\u0000${targetPath}`);
        continue;
      }

      if (documentPaths.has(targetPath)) {
        relationships.add(`${sourcePath}\u0000${targetPath}`);
        connectedDocuments.add(sourcePath);
        connectedDocuments.add(targetPath);
      }
    }
  }

  for (const relationship of [...relationships].sort()) {
    const [sourcePath, targetPath] = relationship.split('\u0000');
    console.log(`REL ${sourcePath} --references--> ${targetPath}`);
  }

  for (const brokenReference of [...brokenReferences].sort()) {
    const [sourcePath, targetPath] = brokenReference.split('\u0000');
    fail(`${sourcePath}가 참조한 ${targetPath} 파일이 없습니다.`);
  }

  for (const relativePath of [...contents.keys()].sort()) {
    if (!connectedDocuments.has(relativePath)) {
      warn(`${relativePath}는 다른 기준 문서와의 연결이 보이지 않습니다. 실패가 아니며 사람이 확인할 후보입니다.`);
    }
  }

  console.log('PASS는 존재와 위치만, REL은 원문의 명시적 참조만 뜻합니다. 정책 의미·정본·중복·충돌은 판정하지 않습니다.');
  finish('문서 관계 audit');
}

function checkLecture(rawLecture, branch) {
  const number = parseLectureNumber(rawLecture, 'lab self-check');

  const lecture = String(number).padStart(2, '0');
  for (let current = 1; current <= number; current += 1) {
    const rule = parseRule(String(current).padStart(2, '0'));
    for (const entry of rule.required) {
      validateArtifact(entry, branch, 'required');
    }
    for (const entry of rule.optional) {
      validateArtifact(entry, branch, 'optional');
    }
  }

  const targetRule = parseRule(lecture);
  if (!branch && targetRule.cleanWorktreePaths) {
    const diff = run('git', ['diff', '--name-only', '--', ...targetRule.cleanWorktreePaths]);
    if (diff.status === 0 && diff.stdout.trim() === '') {
      pass(`${targetRule.cleanWorktreePaths.join(', ')} 작업 트리 변경이 없습니다.`);
    } else {
      fail(`${targetRule.cleanWorktreePaths.join(', ')}에 커밋되지 않은 변경이 있습니다.`);
    }
  }

  if (targetRule.runAppChecks) {
    if (branch) {
      warn('--branch 검사는 파일 구조만 확인합니다. 앱 검증은 해당 브랜치 checkout에서 실행하세요.');
    } else {
      runAppChecks();
    }
  }

  for (const message of targetRule.externalChecks ?? []) {
    warn(message);
  }

  console.log('PASS는 "형식을 갖췄다"는 뜻입니다. 내용이 맞는지는 사람이 봅니다.');
  console.log(`판단 기준은 labs/lecture${lecture}/README.md §3 검증 항목을 다시 읽으세요.`);
  finish(`Lab ${lecture} self-check`);
}

function finish(label) {
  console.log(`${label}: failure=${failures}, warning=${warnings}`);
  process.exit(failures === 0 ? 0 : 1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('사용법: node labs/tools/check.mjs env | --lint-labs | --audit-docs <01-20> | <01-20> [--branch <name>]');
  process.exit(2);
}

if (args[0] === 'env') {
  runEnvironmentCheck();
} else if (args[0] === '--lint-labs') {
  lintLabs();
} else if (args[0] === '--audit-docs') {
  auditDocuments(args[1]);
} else {
  const branchIndex = args.indexOf('--branch');
  const branch = branchIndex >= 0 ? args[branchIndex + 1] : undefined;
  if (branchIndex >= 0 && !branch) {
    fail('--branch 뒤에 브랜치 이름이 필요합니다.');
    finish('강별 self-check');
  }
  checkLecture(args[0], branch);
}
