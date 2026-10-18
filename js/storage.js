// storage.js — LocalStorage persistence for QuestLog
const STORAGE_KEY = "questlog_state_v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("loadState failed", e);
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("saveState failed", e);
  }
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questlog-save.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
