"use strict";
let bundle = null;
let schoolCards = [];
let diffCards = [];
let activeDiffFilter = "changed";
let diffLimit = 12;
let activeTimelineFilter = "all";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined && text !== null) item.textContent = text;
  return item;
}

function formatDate(value, precision) {
  if (precision === "month") { const [year, month] = value.split("-"); return `${year}年${Number(month)}月`; }
  if (precision === "period") return value.replace("/", "〜");
  const parts = value.split("-"); return parts.length === 3 ? `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日` : value;
}

function smoothTarget(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function renderPersonas() {
  const list = $("#persona-list");
  bundle.personas.forEach((persona, index) => {
    const button = node("button", "persona-card");
    button.type = "button";
    button.dataset.persona = persona.id;
    button.append(node("span", "persona-number", String(index + 1).padStart(2, "0")));
    button.append(node("strong", "", persona.label));
    button.append(node("span", "", persona.short));
    button.addEventListener("click", () => {
      $$(".persona-card").forEach((item) => item.classList.toggle("active", item === button));
      const guide = $("#persona-guide p");
      guide.replaceChildren(node("strong", "", `${persona.label}の入口`), node("span", "", persona.prompt));
      if (persona.target === "school-impact") setTimeout(() => $("#school-search").focus({ preventScroll: true }), 500);
      smoothTarget(persona.target);
    });
    list.append(button);
  });
}

function sourceRow(source) {
  const row = node("div", "source-row");
  row.append(node("span", "", source.stage_label));
  row.append(node("small", "", `公式PDF p.${source.page}／${source.verification_status === "dual_checked" ? "二重確認済み" : source.verification_status}`));
  const link = node("a", "", "公式資料");
  link.href = source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `${source.stage_label}の公式資料を新しいタブで開く`);
  row.append(link);
  return row;
}

function schoolCard(card) {
  const article = node("article", "school-card");
  article.dataset.school = card.school_normalized.toLowerCase();
  article.dataset.action = card.action;
  article.dataset.year = card.year === null ? "none" : String(card.year);
  const top = node("div", "card-top");
  const title = node("div"); title.append(node("span", "tag", card.action_label), node("h3", "", card.school));
  top.append(title, node("span", "year-badge", card.year ? `${card.year}年度` : "年度未記載"));
  article.append(top, node("p", "card-description", card.action_text));
  const sources = node("div", "source-list"); card.sources.forEach((source) => sources.append(sourceRow(source)));
  article.append(sources);
  return article;
}

function applySchoolFilters() {
  const query = $("#school-search").value.trim().toLowerCase();
  const action = $("#school-action").value;
  const year = $("#school-year").value;
  let visible = 0;
  schoolCards.forEach((card) => {
    const show = card.dataset.school.includes(query) && (action === "all" || card.dataset.action === action) && (year === "all" || card.dataset.year === year);
    card.hidden = !show; if (show) visible += 1;
  });
  $("#school-count").textContent = `${visible}件を表示／全27件`;
  $("#school-empty").hidden = visible !== 0;
}

function renderSchools() {
  const list = $("#school-list");
  schoolCards = bundle.school_cards.map(schoolCard); schoolCards.forEach((card) => list.append(card));
  const form = $("#school-filters");
  form.addEventListener("input", applySchoolFilters); form.addEventListener("change", applySchoolFilters);
  form.addEventListener("reset", () => setTimeout(applySchoolFilters));
  applySchoolFilters();
}

function diffSide(label, text, page) {
  const side = node("div", "diff-side"); side.append(node("strong", "", `${label}${page ? `／PDF p.${page}` : ""}`)); side.append(node("span", "", text || "対応する記載なし")); return side;
}

function diffCard(card) {
  const article = node("article", "diff-card"); article.dataset.status = card.status;
  const head = node("div", "diff-head"); head.append(node("h3", "", card.summary || card.status_label), node("span", "diff-status", card.status_label)); article.append(head);
  const copy = node("div", "diff-copy"); copy.append(diffSide("素案", card.baseline_text, card.baseline_page), node("span", "diff-arrow", "→"), diffSide("最終版", card.target_text, card.target_page)); article.append(copy);
  article.append(node("p", "diff-meta", "変更理由・県民意見・県議会との因果は未確認です。"));
  return article;
}

function matchesDiff(card, filter, query) {
  const filterMatch = filter === "changed" ? card.status !== "same" : card.status === filter;
  return filterMatch && `${card.summary} ${card.baseline_text || ""} ${card.target_text || ""}`.toLowerCase().includes(query);
}

function renderDiffs() {
  const query = $("#diff-search").value.trim().toLowerCase();
  const selected = bundle.diff_cards.filter((card) => matchesDiff(card, activeDiffFilter, query));
  const showing = selected.slice(0, diffLimit); const list = $("#diff-list"); list.replaceChildren();
  diffCards = showing.map(diffCard); diffCards.forEach((card) => list.append(card));
  $("#diff-count").textContent = `${showing.length}件を表示／該当${selected.length}件`;
  $("#diff-empty").hidden = selected.length !== 0;
  $("#diff-more").hidden = showing.length >= selected.length;
}

function setupDiffs() {
  $$('[data-diff-filter]').forEach((button) => button.addEventListener("click", () => {
    activeDiffFilter = button.dataset.diffFilter; diffLimit = 12;
    $$('[data-diff-filter]').forEach((item) => item.classList.toggle("active", item === button)); renderDiffs();
  }));
  $("#diff-search").addEventListener("input", () => { diffLimit = 12; renderDiffs(); });
  $("#diff-more").addEventListener("click", () => { diffLimit += 20; renderDiffs(); }); renderDiffs();
}

function timelineCard(event) {
  const article = node("article", "timeline-card"); article.dataset.group = event.group; article.append(node("span", "timeline-dot"));
  article.append(node("time", "timeline-date", formatDate(event.date, event.date_precision)));
  const body = node("div", "timeline-body"); body.append(node("span", "group-tag", event.group_label), node("h3", "", event.title), node("p", "", `${event.actor}｜${event.note}`), node("p", "timeline-caution", event.caution));
  const link = node("a", "", "公式資料を見る →"); link.href = event.url; link.target = "_blank"; link.rel = "noopener noreferrer"; body.append(link); article.append(body); return article;
}

function renderTimeline() {
  const selected = bundle.timeline.filter((event) => activeTimelineFilter === "all" || event.group === activeTimelineFilter); const list = $("#timeline-list"); list.replaceChildren(); selected.forEach((event) => list.append(timelineCard(event)));
  $("#timeline-count").textContent = `${selected.length}件を表示／全11件`;
}

function setupTimeline() {
  $$('[data-timeline-filter]').forEach((button) => button.addEventListener("click", () => { activeTimelineFilter = button.dataset.timelineFilter; $$('[data-timeline-filter]').forEach((item) => item.classList.toggle("active", item === button)); renderTimeline(); })); renderTimeline();
}

function renderScope() {
  bundle.known_scope.forEach((text) => $("#known-list").append(node("li", "", text)));
  bundle.limitations.forEach((text) => $("#limitation-list").append(node("li", "", text)));
  $$('[data-count]').forEach((item) => { const value = bundle.counts[item.dataset.count]; if (value !== undefined) item.textContent = String(value); });
}


function officialCommentLink(url, label, className = "") {
  const link = node("a", className, label); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; return link;
}

function normalized(value) { return String(value || "").normalize("NFKC").toLowerCase(); }

function addOption(select, value, label) {
  const option = node("option", "", label); option.value = value; select.append(option);
}

function commentCard(item, section) {
  const details = node("details", "comment-item"); details.id = `comment-opinion-${item.record_id}`;
  const summary = node("summary", "comment-summary");
  const title = node("span", "comment-summary-title");
  const meta = node("span", "comment-card-meta", `p.${item.source_page}　${item.topic_label}　回答${item.group_number}`);
  title.append(meta, node("span", "comment-number", `意見項目 ${item.number}`), node("span", "comment-preview", item.official_text));
  summary.append(title, node("span", "comment-toggle", "開く")); details.append(summary);
  details.addEventListener("toggle", () => { details.querySelector(".comment-toggle").textContent = details.open ? "閉じる" : "開く"; });
  const body = node("div", "comment-body");
  body.append(node("p", "comment-label", "公表資料に掲載された意見本文"), node("p", "comment-official-text", item.official_text));
  const actions = node("div", "comment-card-actions");
  const responseLink = node("a", "comment-answer-link", `対応する県回答${item.group_number}を見る ↓`);
  responseLink.href = `#comment-response-${item.response_id}`;
  responseLink.addEventListener("click", (event) => {
    event.preventDefault(); const target = document.getElementById(`comment-response-${item.response_id}`);
    if (target) { target.open = true; target.focus({ preventScroll: true }); smoothTarget(target.id); }
  });
  actions.append(responseLink, officialCommentLink(`${section.source.pdf_url}#page=${item.source_page}`, `公式PDF p.${item.source_page}`, "comment-source-link"));
  body.append(actions, node("p", "comment-card-note", "二重確認済み。人数・票・個別提出原文・賛否・採否を示すものではありません。"));
  details.append(body); return details;
}

function responseCard(item, section, matchedOpinionIds) {
  const details = node("details", "comment-response-card"); details.id = `comment-response-${item.response_id}`; details.tabIndex = -1;
  const matched = item.linked_opinion_record_ids.filter((id) => matchedOpinionIds.has(id)).length;
  const summary = node("summary", "comment-response-summary");
  const title = node("span", "comment-summary-title");
  title.append(node("span", "comment-card-meta", `p.${item.source_page}　${item.topic_label}`), node("strong", "", `県回答 ${item.group_number}`), node("span", "", `${matched}項目に対応（全${item.opinion_count}項目）`));
  summary.append(title, node("span", "comment-toggle", "回答を開く")); details.append(summary);
  details.addEventListener("toggle", () => { details.querySelector(".comment-toggle").textContent = details.open ? "閉じる" : "回答を開く"; });
  const body = node("div", "comment-response-body");
  body.append(node("p", "comment-official-text", item.official_text));
  const actions = node("div", "comment-source-actions");
  actions.append(officialCommentLink(`${section.source.pdf_url}#page=${item.source_page}`, `公式PDF p.${item.source_page}を開く`, "button button-primary"));
  const landing = officialCommentLink(section.source.landing_url, "県の公表ページを見る", "text-button"); actions.append(landing); body.append(actions); details.append(body); return details;
}

function renderCommentList() {
  const section = bundle.public_comment;
  const query = normalized($("#comment-search").value.trim());
  const page = $("#comment-page").value; const topic = $("#comment-topic").value; const group = $("#comment-group").value;
  const responseText = new Map(section.responses.map((item) => [item.response_id, normalized(item.official_text)]));
  const selected = section.opinions.filter((item) => {
    const queryMatch = !query || normalized(item.official_text).includes(query) || responseText.get(item.response_id).includes(query);
    return queryMatch && (page === "all" || String(item.source_page) === page) && (topic === "all" || item.topic_id === topic) && (group === "all" || item.group_id === group);
  });
  const ids = new Set(selected.map((item) => item.record_id)); const responseIds = new Set(selected.map((item) => item.response_id));
  const list = $("#comment-list"); list.replaceChildren(); selected.forEach((item) => list.append(commentCard(item, section)));
  const responses = $("#comment-response-list"); responses.replaceChildren(); section.responses.filter((item) => responseIds.has(item.response_id)).forEach((item) => responses.append(responseCard(item, section, ids)));
  $("#comment-count").textContent = `${selected.length}項目を表示／全${section.opinion_item_count}項目`;
  $("#comment-response-count").textContent = `${responseIds.size}回答を表示`;
  $("#comment-empty").hidden = selected.length !== 0;
}

function setupPublicComment() {
  const section = bundle.public_comment;
  section.pages.forEach((page) => addOption($("#comment-page"), String(page), `物理p.${page}`));
  section.filters.topics.forEach((item) => addOption($("#comment-topic"), item.id, item.label));
  section.filters.groups.forEach((item) => addOption($("#comment-group"), item.id, item.label));
  section.reading_boundaries.forEach((text) => $("#comment-boundary-list").append(node("li", "", text)));
  const form = $("#comment-filters"); form.addEventListener("input", renderCommentList); form.addEventListener("change", renderCommentList); form.addEventListener("reset", () => setTimeout(renderCommentList));
  renderCommentList();
}

async function initialize() {
  try {
    const response = await fetch("data/public_experience.json"); if (!response.ok) throw new Error(`HTTP ${response.status}`); bundle = await response.json();
    renderPersonas(); renderSchools(); setupDiffs(); setupTimeline(); setupPublicComment(); renderScope();
  } catch (error) { console.error(error); $("#load-error").hidden = false; }
}

initialize();
