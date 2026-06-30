import {
  EMOTIONS,
  buildAssistantTurn,
  createInitialMessage
} from "./logic.js";
import { renderMarkdown } from "./markdown.js";

const STORAGE_KEYS = {
  messages: "warm-islet.messages",
  memories: "warm-islet.memories"
};

const state = {
  messages: load(STORAGE_KEYS.messages, []),
  memories: load(STORAGE_KEYS.memories, []),
  isReplying: false
};

const messageList = document.querySelector("#messageList");
const memoryList = document.querySelector("#memoryList");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const emotionBadge = document.querySelector("#emotionBadge");
const moodNote = document.querySelector("#moodNote");
const clearMemoryButton = document.querySelector("#clearMemoryButton");
const messageTemplate = document.querySelector("#messageTemplate");

if (!state.messages.length) {
  state.messages.push(createInitialMessage());
  persist();
}

render();

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || state.isReplying) return;

  state.isReplying = true;
  messageInput.value = "";
  autoresizeInput();
  setComposerState();

  const turn = buildAssistantTurn(text, state.messages, state.memories);
  state.messages.push(turn.userMessage);
  state.memories = turn.memories;
  persist();
  render();

  showTyping();
  const modelReply = await requestModelReply(turn);
  removeTyping();

  state.messages.push({
    ...turn.assistantMessage,
    content: modelReply.content || turn.assistantMessage.content,
    source: modelReply.source
  });
  state.isReplying = false;
  persist();
  render();
  setComposerState();
});

messageInput.addEventListener("input", autoresizeInput);
messageInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  chatForm.requestSubmit();
});

clearMemoryButton.addEventListener("click", () => {
  if (!state.memories.length) return;
  const confirmed = window.confirm("确认清空所有长期记忆吗？");
  if (!confirmed) return;
  state.memories = [];
  persist();
  renderMemories();
});

function render() {
  renderMessages();
  renderMemories();
  renderEmotion();
  setComposerState();
}

function renderMessages() {
  messageList.replaceChildren();
  for (const message of state.messages) {
    const node = messageTemplate.content.firstElementChild.cloneNode(true);
    node.classList.add(message.role);
    node.querySelector(".avatar").textContent = message.role === "assistant" ? "屿" : "你";
    node.querySelector(".meta").textContent = `${message.role === "assistant" ? "暖屿" : "你"} · ${formatTime(message.createdAt)}`;
    const bubble = node.querySelector(".bubble");
    if (message.role === "assistant") {
      bubble.classList.add("markdown-body");
      bubble.innerHTML = renderMarkdown(message.content);
    } else {
      bubble.textContent = message.content;
    }
    messageList.appendChild(node);
  }
  messageList.scrollTop = messageList.scrollHeight;
}

function renderMemories() {
  memoryList.replaceChildren();

  if (!state.memories.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "还没有长期记忆";
    memoryList.appendChild(empty);
    return;
  }

  for (const memory of state.memories) {
    const item = document.createElement("article");
    item.className = "memory-item";

    const content = document.createElement("p");
    content.textContent = memory.content;

    const foot = document.createElement("div");
    foot.className = "memory-foot";
    const tags = document.createElement("span");
    tags.textContent = memory.tags.join(" · ");
    const button = document.createElement("button");
    button.type = "button";
    button.title = "删除记忆";
    button.ariaLabel = "删除记忆";
    button.textContent = "×";
    button.addEventListener("click", () => deleteMemory(memory.id));

    foot.append(tags, button);
    item.append(content, foot);
    memoryList.appendChild(item);
  }
}

function renderEmotion() {
  const lastUserMessage = [...state.messages].reverse().find((message) => message.role === "user");
  const emotion = lastUserMessage?.emotion || "calm";
  const config = EMOTIONS[emotion] || EMOTIONS.calm;
  emotionBadge.textContent = `${config.label} · ${config.tone}`;
  emotionBadge.dataset.emotion = emotion;
  moodNote.textContent = config.note;
}

function deleteMemory(id) {
  state.memories = state.memories.filter((memory) => memory.id !== id);
  persist();
  renderMemories();
}

function showTyping() {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add("assistant", "typing-message");
  node.querySelector(".avatar").textContent = "屿";
  node.querySelector(".meta").textContent = "暖屿 · 正在输入中";
  node.querySelector(".bubble").innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  messageList.appendChild(node);
  messageList.scrollTop = messageList.scrollHeight;
}

function removeTyping() {
  document.querySelector(".typing-message")?.remove();
}

async function requestModelReply(turn) {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: state.messages,
        emotion: turn.emotion,
        emotionLabel: EMOTIONS[turn.emotion]?.label || "未知",
        memories: turn.relevantMemories
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      source: data.model || "model"
    };
  } catch (error) {
    console.warn("Model request failed, using local fallback.", error);
    await wait(420);
    return {
      content: "",
      source: "fallback"
    };
  }
}

function setComposerState() {
  sendButton.disabled = state.isReplying;
  messageInput.disabled = state.isReplying;
}

function autoresizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(state.messages));
  localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(state.memories));
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
