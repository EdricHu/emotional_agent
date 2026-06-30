export const EMOTIONS = {
  happy: {
    label: "开心",
    tone: "轻快",
    note: "这份开心值得被认真接住。",
    starters: ["听起来这件事真的让你心里亮了一下。", "能感觉到你提到它时是带着开心的。"]
  },
  sad: {
    label: "难过",
    tone: "柔和",
    note: "先不用急着坚强，我们可以慢慢说。",
    starters: ["听起来你今天真的有点受伤。", "这件事落在你身上，确实会让人不好受。"]
  },
  anxious: {
    label: "焦虑",
    tone: "安定",
    note: "我们先把混在一起的压力一点点理开。",
    starters: ["我能感觉到你现在心里绷得很紧。", "这种担心一直悬着，真的会很消耗人。"]
  },
  angry: {
    label: "生气",
    tone: "承接",
    note: "被冒犯或不被理解时，生气是有原因的。",
    starters: ["听起来你是真的被这件事气到了。", "如果换作是我被这样对待，也很难一下子平静。"]
  },
  stressed: {
    label: "压力",
    tone: "稳住",
    note: "压力已经够重了，我们先不再给你加要求。",
    starters: ["你像是已经扛了一段时间了。", "这份压力听起来不是一两句话就能放下的。"]
  },
  calm: {
    label: "平静",
    tone: "陪伴",
    note: "我在这里，陪你把话慢慢说完整。",
    starters: ["我在听。", "你可以按自己的节奏说。"]
  },
  risk: {
    label: "高风险",
    tone: "安全",
    note: "你现在的安全比任何对话都重要。",
    starters: ["听到你这么说，我会很认真地把安全放在第一位。"]
  }
};

const emotionKeywords = [
  ["risk", ["自杀", "不想活", "结束生命", "伤害自己", "活不下去", "轻生"]],
  ["angry", ["生气", "气死", "愤怒", "火大", "委屈", "不公平", "被骂", "批评"]],
  ["anxious", ["焦虑", "慌", "担心", "害怕", "紧张", "失眠", "复习不完", "来不及"]],
  ["stressed", ["压力", "累", "撑不住", "忙不过来", "崩溃", "疲惫", "加班"]],
  ["sad", ["难过", "伤心", "低落", "孤独", "失落", "哭", "受打击", "没人懂"]],
  ["happy", ["开心", "高兴", "快乐", "顺利", "兴奋", "期待", "喜欢", "太好了"]]
];

const memoryPatterns = [
  { type: "pet", tags: ["关系", "宠物"], regex: /我(?:养了|有)(?:一只|一个)?([^，。！？\s]*(?:猫|狗|兔|鹦鹉|仓鼠))?/ },
  { type: "work", tags: ["身份", "工作"], regex: /我(?:是|是一名|做)([^，。！？\s]*(?:产品经理|设计师|工程师|老师|学生|运营|医生|律师|自由职业者))/ },
  { type: "exam", tags: ["目标", "学习"], regex: /(?:准备|备考|复习)([^，。！？\s]*(?:考研|考试|雅思|托福|公务员|面试))/ },
  { type: "travel", tags: ["计划", "生活"], regex: /(?:下个月|明天|周末|最近|准备|打算|想去)([^，。！？\s]*(?:旅行|旅游|出差|回家|搬家))/ },
  { type: "preference", tags: ["偏好"], regex: /我(?:喜欢|讨厌|不喜欢)([^，。！？]+)/ },
  { type: "relationship", tags: ["关系"], regex: /我的([^，。！？\s]*(?:妈妈|爸爸|朋友|伴侣|男朋友|女朋友|同事|领导))([^，。！？]*)/ }
];

export function createInitialMessage(now = new Date()) {
  return {
    id: cryptoId("msg"),
    role: "assistant",
    content: "你好，我是暖屿。你可以把今天的情绪、琐碎的小事，或者暂时说不出口的话放到这里。我会先听你说，不急着评判。",
    emotion: "calm",
    createdAt: now.toISOString()
  };
}

export function detectEmotion(text) {
  const normalized = text.trim();
  for (const [emotion, keywords] of emotionKeywords) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return emotion;
    }
  }
  return "calm";
}

export function extractMemories(text, sourceMessageId, existing = []) {
  const memories = [];
  const normalized = text.trim();

  for (const pattern of memoryPatterns) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;

    const content = buildMemoryContent(pattern.type, match, normalized);
    if (!content || isDuplicateMemory(content, existing.concat(memories))) continue;

    memories.push({
      id: cryptoId("mem"),
      content,
      tags: pattern.tags,
      sourceMessageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return memories;
}

export function retrieveRelevantMemories(text, memories, limit = 3) {
  const tokens = tokenize(text);
  return memories
    .map((memory) => ({
      memory,
      score: scoreMemory(tokens, memory)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.memory);
}

export function generateReply({ text, emotion, memories = [], history = [] }) {
  if (emotion === "risk") {
    return "听到你这么说，我会先把你的安全放在第一位。请尽快联系身边可信任的人，或拨打当地紧急电话寻求即时帮助。如果你愿意，也可以先告诉我：你现在是一个人吗？身边有没有可以马上联系的人？";
  }

  const emotionConfig = EMOTIONS[emotion] || EMOTIONS.calm;
  const starter = emotionConfig.starters[Math.min(history.length, emotionConfig.starters.length - 1)] || emotionConfig.starters[0];
  const memoryLine = memories.length ? buildMemoryReference(text, memories[0]) : "";
  const question = buildFollowUpQuestion(text, emotion, memories);
  return [starter, memoryLine, question].filter(Boolean).join(" ");
}

export function buildAssistantTurn(userText, messages, memories) {
  const emotion = detectEmotion(userText);
  const userMessage = {
    id: cryptoId("msg"),
    role: "user",
    content: userText.trim(),
    emotion,
    createdAt: new Date().toISOString()
  };
  const newMemories = extractMemories(userText, userMessage.id, memories);
  const allMemories = memories.concat(newMemories);
  const relevantMemories = retrieveRelevantMemories(userText, allMemories);
  const assistantMessage = {
    id: cryptoId("msg"),
    role: "assistant",
    content: generateReply({
      text: userText,
      emotion,
      memories: relevantMemories,
      history: messages
    }),
    emotion,
    createdAt: new Date().toISOString()
  };

  return {
    userMessage,
    assistantMessage,
    emotion,
    newMemories,
    relevantMemories,
    memories: allMemories
  };
}

function buildMemoryContent(type, match, text) {
  if (type === "pet") {
    if (text.includes("叫")) {
      const name = text.match(/叫([^，。！？\s]+)/)?.[1];
      if (name) return `用户养了一只叫${name}的宠物`;
    }
    return match[1] ? `用户养了${match[1]}` : "用户养了宠物";
  }
  if (type === "work") return `用户是${match[1]}`;
  if (type === "exam") return `用户最近在准备${match[1]}`;
  if (type === "travel") return `用户计划${match[1]}`;
  if (type === "preference") {
    const verb = text.includes("不喜欢") ? "不喜欢" : text.includes("讨厌") ? "讨厌" : "喜欢";
    return `用户${verb}${match[1].trim()}`;
  }
  if (type === "relationship") return `用户提到${match[1]}${match[2] || ""}`.trim();
  return "";
}

function buildMemoryReference(text, memory) {
  if (!memory) return "";
  if (memory.tags.includes("宠物") && /累|压力|难过|回家|孤独/.test(text)) {
    return `${memory.content.replace("用户", "你")}，也许回到熟悉的小生命身边，会让今晚稍微软一点。`;
  }
  if (memory.tags.includes("学习")) {
    return `${memory.content.replace("用户", "你")}，这件事本来就会占很多心力。`;
  }
  if (memory.tags.includes("工作")) {
    return `我记得${memory.content.replace("用户", "你")}，所以这类工作里的拉扯可能更贴近你的日常。`;
  }
  return `我还记得，${memory.content.replace("用户", "你")}。`;
}

function buildFollowUpQuestion(text, emotion, memories) {
  if (emotion === "happy") return "这份开心里，最让你想多停留一会儿的是哪一部分？";
  if (emotion === "angry") return "你愿意和我说说，最让你觉得被冒犯的是哪一句或哪一刻吗？";
  if (emotion === "anxious") return "如果把这团焦虑拆开看，最压着你的那一件事是什么？";
  if (emotion === "stressed") return "今天这些压力里，哪一块是你最希望有人帮你一起扛一会儿的？";
  if (emotion === "sad") return "如果你愿意，可以先从最难受的那个瞬间说起。";
  if (memories.length) return "现在最想被我听见的是哪一部分？";
  return "你想从哪里开始说？";
}

function tokenize(text) {
  return Array.from(new Set(text.toLowerCase().split(/[\s，。！？、,.!?]+/).filter(Boolean).concat(Array.from(text))));
}

function scoreMemory(tokens, memory) {
  let score = 0;
  const haystack = `${memory.content} ${memory.tags.join(" ")}`;
  for (const token of tokens) {
    if (token.length > 0 && haystack.includes(token)) score += token.length > 1 ? 2 : 1;
  }
  if (memory.tags.includes("宠物") && tokens.some((token) => ["累", "回家", "猫", "狗", "宠物"].includes(token))) score += 5;
  if (memory.tags.includes("学习") && tokens.some((token) => ["考试", "复习", "焦虑", "慌"].includes(token))) score += 5;
  return score;
}

function isDuplicateMemory(content, memories) {
  const normalized = content.replace(/\s/g, "");
  return memories.some((memory) => memory.content.replace(/\s/g, "") === normalized);
}

function cryptoId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
