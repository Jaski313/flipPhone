"use strict";

const FRIENDS_API = "/game/api";

// ──────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────
function _headers() {
  const h = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function searchUsers(query) {
  const resp = await fetch(
    `${FRIENDS_API}/users/search?q=${encodeURIComponent(query)}`,
    { headers: _headers() }
  );
  if (!resp.ok) return [];
  return resp.json();
}

async function getFriends() {
  const resp = await fetch(`${FRIENDS_API}/friends`, { headers: _headers() });
  if (!resp.ok) return [];
  return resp.json();
}

async function getRequests() {
  const resp = await fetch(`${FRIENDS_API}/friends/requests`, {
    headers: _headers(),
  });
  if (!resp.ok) return [];
  return resp.json();
}

async function sendRequest(userId) {
  const resp = await fetch(`${FRIENDS_API}/friends/request`, {
    method: "POST",
    headers: _headers(),
    body: JSON.stringify({ user_id: userId }),
  });
  return resp.json();
}

async function acceptRequest(friendshipId) {
  const resp = await fetch(`${FRIENDS_API}/friends/accept`, {
    method: "POST",
    headers: _headers(),
    body: JSON.stringify({ friendship_id: friendshipId }),
  });
  return resp.json();
}

async function declineRequest(friendshipId) {
  const resp = await fetch(`${FRIENDS_API}/friends/decline`, {
    method: "POST",
    headers: _headers(),
    body: JSON.stringify({ friendship_id: friendshipId }),
  });
  return resp.json();
}

async function removeFriend(friendshipId) {
  const resp = await fetch(`${FRIENDS_API}/friends/${friendshipId}`, {
    method: "DELETE",
    headers: _headers(),
  });
  return resp.json();
}

// ──────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────
function _initials(user) {
  const name = user.display_name || user.username;
  return name.slice(0, 2).toUpperCase();
}

function _statsLine(user) {
  const parts = [];
  if (user.tricks_landed) parts.push(`${user.tricks_landed} tricks`);
  if (user.games_won) parts.push(`${user.games_won} W`);
  return parts.length ? parts.join(" \u00b7 ") : "New player";
}

function _el(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

// ──────────────────────────────────────────────
// Search
// ──────────────────────────────────────────────
let searchTimer = null;
const sentRequests = new Set();

function setupSearch() {
  const input = document.getElementById("friend-search-input");
  const list = document.getElementById("search-results");
  if (!input || !list) return;

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(searchTimer);
    if (q.length < 2) {
      list.innerHTML = "";
      return;
    }
    searchTimer = setTimeout(async () => {
      const users = await searchUsers(q);
      if (input.value.trim() !== q) return;
      renderSearchResults(users, list);
    }, 400);
  });
}

function renderSearchResults(users, container) {
  container.innerHTML = "";
  if (!users.length) {
    container.appendChild(_el("div", "friends-empty", "No users found"));
    return;
  }
  users.forEach((u) => {
    const row = _el("div", "friend-row");

    const avatar = _el("div", "avatar-circle", _initials(u));
    row.appendChild(avatar);

    const info = _el("div", "friend-info");
    info.appendChild(_el("div", "friend-name", u.display_name || u.username));
    const meta = _el("div", "friend-meta");
    meta.textContent = `@${u.username}`;
    const stats = ` \u00b7 ${_statsLine(u)}`;
    meta.textContent += stats;
    info.appendChild(meta);
    row.appendChild(info);

    const btn = _el("button", "friend-action-btn accent-btn");
    if (sentRequests.has(u.id)) {
      btn.textContent = "Gesendet";
      btn.disabled = true;
      btn.classList.add("disabled");
    } else {
      btn.textContent = "Anfrage";
      btn.addEventListener("click", async () => {
        btn.textContent = "Gesendet";
        btn.disabled = true;
        btn.classList.add("disabled");
        sentRequests.add(u.id);
        await sendRequest(u.id);
      });
    }
    row.appendChild(btn);

    container.appendChild(row);
  });
}

// ──────────────────────────────────────────────
// Requests
// ──────────────────────────────────────────────
async function loadRequests() {
  const reqs = await getRequests();
  const badge = document.getElementById("requests-badge");
  const list = document.getElementById("requests-list");
  if (!list) return;

  if (badge) {
    badge.textContent = reqs.length || "";
    badge.classList.toggle("hidden", reqs.length === 0);
  }

  list.innerHTML = "";
  if (!reqs.length) {
    list.appendChild(_el("div", "friends-empty", "Keine offenen Anfragen"));
    return;
  }

  reqs.forEach((r) => {
    const row = _el("div", "friend-row request-row");

    const avatar = _el("div", "avatar-circle", _initials(r.from_user));
    row.appendChild(avatar);

    const info = _el("div", "friend-info");
    info.appendChild(
      _el("div", "friend-name", r.from_user.display_name || r.from_user.username)
    );
    info.appendChild(_el("div", "friend-meta", `@${r.from_user.username}`));
    row.appendChild(info);

    const actions = _el("div", "request-actions");

    const acceptBtn = _el("button", "friend-action-btn accept-btn", "Annehmen");
    acceptBtn.addEventListener("click", async () => {
      row.classList.add("fade-out");
      await acceptRequest(r.friendship_id);
      setTimeout(() => {
        row.remove();
        loadFriends();
        loadRequests();
      }, 300);
    });
    actions.appendChild(acceptBtn);

    const declineBtn = _el("button", "friend-action-btn decline-btn", "Ablehnen");
    declineBtn.addEventListener("click", async () => {
      row.classList.add("fade-out");
      await declineRequest(r.friendship_id);
      setTimeout(() => {
        row.remove();
        loadRequests();
      }, 300);
    });
    actions.appendChild(declineBtn);

    row.appendChild(actions);
    list.appendChild(row);
  });
}

// ──────────────────────────────────────────────
// Friends list
// ──────────────────────────────────────────────
async function loadFriends() {
  const friends = await getFriends();
  const list = document.getElementById("friends-list");
  if (!list) return;

  list.innerHTML = "";
  if (!friends.length) {
    list.appendChild(
      _el("div", "friends-empty", "Noch keine Freunde. Suche oben nach Nutzern!")
    );
    return;
  }

  friends
    .sort((a, b) =>
      (a.user.username).localeCompare(b.user.username)
    )
    .forEach((f) => {
      const row = _el("div", "friend-row");

      const avatar = _el("div", "avatar-circle", _initials(f.user));
      row.appendChild(avatar);

      const info = _el("div", "friend-info");
      info.appendChild(
        _el("div", "friend-name", f.user.display_name || f.user.username)
      );
      const meta = _el("div", "friend-meta");
      meta.textContent = `@${f.user.username} \u00b7 ${_statsLine(f.user)}`;
      info.appendChild(meta);
      row.appendChild(info);

      const actions = _el("div", "request-actions");

      const challengeBtn = _el("button", "friend-action-btn accent-btn", "Herausfordern");
      challengeBtn.addEventListener("click", () => {
        startChallenge(f.user.id);
      });
      actions.appendChild(challengeBtn);

      const removeBtn = _el("button", "friend-action-btn decline-btn", "\u00d7");
      removeBtn.title = "Entfernen";
      removeBtn.addEventListener("click", async () => {
        if (!confirm(`${f.user.display_name || f.user.username} entfernen?`)) return;
        row.classList.add("fade-out");
        await removeFriend(f.friendship_id);
        setTimeout(() => row.remove(), 300);
      });
      actions.appendChild(removeBtn);

      row.appendChild(actions);
      list.appendChild(row);
    });
}

// Stub for Phase 3
function startChallenge(userId) {
  console.log("startChallenge", userId);
}

// ──────────────────────────────────────────────
// Polling & init
// ──────────────────────────────────────────────
let requestsPollTimer = null;

function initFriends() {
  setupSearch();
  loadRequests();
  loadFriends();

  if (requestsPollTimer) clearInterval(requestsPollTimer);
  requestsPollTimer = setInterval(loadRequests, 30000);
}

function destroyFriends() {
  if (requestsPollTimer) {
    clearInterval(requestsPollTimer);
    requestsPollTimer = null;
  }
}
