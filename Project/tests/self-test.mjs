import assert from "node:assert/strict";
import {
  buildAssistantTurn,
  createInitialMessage,
  detectEmotion,
  extractMemories,
  retrieveRelevantMemories
} from "../src/logic.js";
import { renderMarkdown } from "../src/markdown.js";

const emotionCases = [
  ["今天拿到 offer 了，特别开心", "happy"],
  ["今天又被领导批评了，真的很委屈", "angry"],
  ["我最近准备考试，总觉得复习不完，很慌", "anxious"],
  ["这周一直加班，压力很大也很累", "stressed"],
  ["晚上突然觉得很孤独，很难过", "sad"]
];

for (const [text, expected] of emotionCases) {
  assert.equal(detectEmotion(text), expected, `emotion should be ${expected}: ${text}`);
}

const initial = [createInitialMessage(new Date("2026-06-30T00:00:00.000Z"))];
const memoryTurn = buildAssistantTurn("我养了一只叫年糕的猫", initial, []);
assert.equal(memoryTurn.newMemories.length, 1, "pet memory should be created");
assert.match(memoryTurn.newMemories[0].content, /年糕/, "pet memory should contain pet name");

const duplicate = extractMemories("我养了一只叫年糕的猫", "msg_2", memoryTurn.memories);
assert.equal(duplicate.length, 0, "duplicate memories should not be created");

const recalled = retrieveRelevantMemories("今天回家有点累", memoryTurn.memories);
assert.ok(recalled.some((memory) => memory.content.includes("年糕")), "pet memory should be recalled for tired home context");

const replyTurn = buildAssistantTurn("今天回家有点累", initial.concat(memoryTurn.userMessage, memoryTurn.assistantMessage), memoryTurn.memories);
assert.match(replyTurn.assistantMessage.content, /年糕|宠物|熟悉的小生命/, "assistant should naturally reference relevant memory");
assert.equal(replyTurn.assistantMessage.emotion, "stressed", "tired context should be treated as stress");

const riskTurn = buildAssistantTurn("我不想活了", initial, []);
assert.equal(riskTurn.emotion, "risk", "self-harm expression should be high risk");
assert.match(riskTurn.assistantMessage.content, /安全|紧急|可信任/, "risk response should prioritize safety");

const markdownHtml = renderMarkdown("**先接住情绪**\n\n- 慢慢说\n- 我在听\n\n```js\n<script>alert(1)</script>\n```");
assert.match(markdownHtml, /<strong>先接住情绪<\/strong>/, "bold markdown should render");
assert.match(markdownHtml, /<ul><li>慢慢说<\/li><li>我在听<\/li><\/ul>/, "list markdown should render");
assert.match(markdownHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, "html in code blocks should be escaped");
assert.doesNotMatch(markdownHtml, /<script>/, "raw script tags should not be rendered");

console.log("Self-test passed: emotion detection, memory write, recall, markdown rendering, duplicate guard, and safety response are working.");
