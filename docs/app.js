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
  const school = $("#school-search").value;
  const action = $("#school-action").value;
  const year = $("#school-year").value;
  let visible = 0;
  schoolCards.forEach((card) => {
    const show = (school === "all" || card.dataset.school === school.toLowerCase()) && (action === "all" || card.dataset.action === action) && (year === "all" || card.dataset.year === year);
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

let activeCommentSchool = "all";

function addOption(select, value, label) {
  const option = node("option", "", label); option.value = value; select.append(option);
}

function syncSchoolFilters(value) {
  $$("#comment-school-filters [data-comment-school]").forEach((button) => {
    const active = button.dataset.commentSchool === value;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
}

function setupSchoolFilters(section) {
  const container = $("#comment-school-filters");
  const sections = new Map();
  section.responses.filter((item) => item.school_mentions?.length).forEach((item) => {
    const key = [...item.school_mentions].sort().join("|");
    if (!sections.has(key)) sections.set(key, { id: key, label: item.school_mentions.join("・") });
  });
  const choices = [{ id: "all", label: "学校を指定しない" }, ...sections.values()];
  choices.forEach((choice) => {
    const button = node("button", "school-filter-chip", choice.label); button.type = "button"; button.dataset.commentSchool = choice.id;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => { activeCommentSchool = choice.id; syncSchoolFilters(choice.id); renderCommentList(); });
    container.append(button);
  });
  syncSchoolFilters(activeCommentSchool);
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
  const schoolSection = new Map(section.responses.map((item) => [item.group_id, [...(item.school_mentions || [])].sort().join("|")]));
  const selected = section.opinions.filter((item) => {
    const queryMatch = !query || normalized(item.official_text).includes(query) || responseText.get(item.response_id).includes(query);
    const namedSchool = activeCommentSchool.startsWith("school:") ? activeCommentSchool.slice(7) : null;
    const schoolMatch = activeCommentSchool === "all" || (namedSchool ? (item.school_mentions || []).includes(namedSchool) : schoolSection.get(item.group_id) === activeCommentSchool);
    return queryMatch && schoolMatch && (page === "all" || String(item.source_page) === page) && (topic === "all" || item.topic_id === topic) && (group === "all" || item.group_id === group);
  });
  const ids = new Set(selected.map((item) => item.record_id)); const responseIds = new Set(selected.map((item) => item.response_id));
  const list = $("#comment-list"); list.replaceChildren(); selected.forEach((item) => list.append(commentCard(item, section)));
  const responses = $("#comment-response-list"); responses.replaceChildren(); section.responses.filter((item) => responseIds.has(item.response_id)).forEach((item) => responses.append(responseCard(item, section, ids)));
  $("#comment-count").textContent = `${selected.length}項目を表示／全${section.opinion_item_count}項目`;
  $("#comment-response-count").textContent = `${responseIds.size}回答を表示`;
  $("#comment-empty").hidden = selected.length !== 0;
  syncSchoolFilters(activeCommentSchool);
}

function setupPublicComment() {
  const section = bundle.public_comment;
  section.pages.forEach((page) => addOption($("#comment-page"), String(page), `物理p.${page}`));
  section.filters.topics.forEach((item) => addOption($("#comment-topic"), item.id, item.label));
  section.filters.groups.forEach((item) => addOption($("#comment-group"), item.id, item.label));
  setupSchoolFilters(section);
  section.reading_boundaries.forEach((text) => $("#comment-boundary-list").append(node("li", "", text)));
  const form = $("#comment-filters"); form.addEventListener("input", renderCommentList); form.addEventListener("change", renderCommentList); form.addEventListener("reset", () => setTimeout(() => { activeCommentSchool = "all"; renderCommentList(); }));
  renderCommentList();
}



function journeyDetails(label, text) {
  const details = node("details", "journey-details");
  const summary = node("summary", "", label); details.append(summary, node("p", "journey-official-text", text)); return details;
}

function journeySourceLink(source) {
  const link = node("a", "journey-source-link", `${source.stage_label}の公式PDF p.${source.page}`);
  link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; return link;
}

function journeyMissing(text) { return node("p", "journey-missing", `既存データでは確認できないこと：${text}`); }

function selectedJourneyModel() {
  const school = $("#journey-school-select").value;
  return bundle.school_question_journey.schools.find((item) => item.school === school);
}

function journeyQuestionChecks() {
  return ["#journey-question-check-school", "#journey-question-check-change", "#journey-question-check-unknown"].map((selector) => $(selector));
}

function resetJourneyQuestionChecks() { journeyQuestionChecks().forEach((item) => { item.checked = false; }); }

function updateJourneyQuestion() {
  const input = $("#journey-question-input"); const status = $("#journey-question-status");
  const text = input.value.trim(); const minimum = bundle.school_question_journey.question_minimum_length;
  const formatReady = text.length >= minimum && /[？?]$/.test(text);
  const checkedCount = journeyQuestionChecks().filter((item) => item.checked).length;
  const complete = formatReady && checkedCount === 3;
  if (!text) { status.textContent = "まだ問いは入力されていません。"; status.dataset.complete = "false"; return; }
  if (!formatReady) { status.textContent = `文章の形を確認してください。${minimum}文字以上で、最後を「？」にします。`; status.dataset.complete = "false"; return; }
  status.textContent = complete ? "3点を自分で確認しました。問いが1つできました。" : `文章の形は整いました。3点のうち${checkedCount}点を確認済みです。`;
  status.dataset.complete = String(complete);
}

function renderJourneyQuestionGuide(model) {
  $("#journey-question-change").textContent = model.question_change_text;
  $("#journey-question-unknown").textContent = model.question_unknown_text;
  resetJourneyQuestionChecks();
}

function renderJourneyChange(model, cards) {
  const content = $("#journey-change-content"); content.replaceChildren();
  cards.forEach((card) => {
    const block = node("section", "journey-record");
    block.append(node("p", "journey-record-label", card.action_label), node("p", "journey-answer", card.action_text));
    block.append(card.year_label ? node("p", "journey-year", `実施年度：${card.year_label}`) : journeyMissing("実施年度"));
    const links = node("div", "journey-source-links"); card.sources.forEach((source) => links.append(journeySourceLink(source))); block.append(links); content.append(block);
  });
}

function renderJourneyBasis(model, cards) {
  const content = $("#journey-basis-content"); content.replaceChildren();
  const explicit = cards.filter((card) => card.reason_status === "explicit_in_source");
  if (!explicit.length) content.append(journeyMissing("この学校の変更について、計画本文に明記された学校別の目的・理由"));
  explicit.forEach((card) => {
    const block = node("section", "journey-record");
    block.append(node("p", "journey-record-label", card.action_label), node("p", "journey-answer", card.action_text));
    block.append(node("p", "journey-evidence-note", "計画本文の学校別記載です。県民意見への回答を変更理由として扱ってはいません。")); content.append(block);
  });
  const related = model.response_ids.map((id) => bundle.public_comment.responses.find((item) => item.response_id === id)).filter(Boolean);
  if (related[0]) {
    content.append(journeyDetails(`この学校名が明記された県回答${related[0].group_number}を読む`, related[0].official_text));
    content.append(node("p", "journey-evidence-note", "関係する県回答として併記しています。計画変更との因果関係を示すものではありません。"));
  }
}

function renderJourneyComments(model) {
  const content = $("#journey-comment-content"); content.replaceChildren();
  const opinions = model.opinion_record_ids.map((id) => bundle.public_comment.opinions.find((item) => item.record_id === id)).filter(Boolean);
  const responses = model.response_ids.map((id) => bundle.public_comment.responses.find((item) => item.response_id === id)).filter(Boolean);
  const button = $("#journey-comments-all");
  button.hidden = true; button.textContent = "関連項目を一覧で見る";
  content.append(node("p", "journey-metric", `${opinions.length}意見項目・${responses.length}県回答`));
  if (!opinions.length && !responses.length) {
    content.append(journeyMissing("この学校名が明記された県民意見・県回答")); return;
  }
  button.textContent = `関連する${opinions.length}意見・${responses.length}回答を一覧で見る`; button.hidden = false;
  if (opinions[0]) content.append(journeyDetails(`意見項目${opinions[0].number}を読む`, opinions[0].official_text));
  const linked = opinions[0] ? bundle.public_comment.responses.find((item) => item.response_id === opinions[0].response_id) : responses[0];
  if (linked) content.append(journeyDetails(`対応する県回答${linked.group_number}を読む`, linked.official_text));
}

function accountabilityRow(label, text, tone = "") {
  const row = node("div", `journey-accountability-row ${tone}`.trim());
  row.append(node("strong", "", label), node("p", "", text));
  return row;
}

function accountabilityQuestionExample(model, cards) {
  const labels = [...new Set(cards.map((card) => card.action_label))].join("・");
  const opinionCount = model.opinion_record_ids.length;
  const responseCount = model.response_ids.length;
  const comparisonIds = [...new Set(model.cards.map((reference) => reference.comparison_id))];
  const statusLabels = [...new Set(comparisonIds.map((id) => bundle.diff_cards.find((item) => item.comparison_id === id)?.status_label).filter(Boolean))].join("・");
  if (opinionCount || responseCount) {
    return `${model.school}では、計画で「${labels}」が確認できます。学校名が明記された県民意見${opinionCount}項目・県回答${responseCount}件と、素案・最終計画の照合結果（${statusLabels}）の関係を、県はどの公式資料で説明していますか？`;
  }
  return `${model.school}では、計画で「${labels}」が確認できます。このデータでは学校名が明記された県民意見・県回答を確認できません。学校名が明記されていない意見を含め、県が計画への反映を説明した公式資料はありますか？`;
}

function renderJourneyAccountability(model, diffs) {
  const content = $("#journey-accountability-content"); content.replaceChildren();
  const opinionCount = model.opinion_record_ids.length;
  const responseCount = model.response_ids.length;
  const statusCounts = new Map();
  diffs.forEach((diff) => statusCounts.set(diff.status_label, (statusCounts.get(diff.status_label) || 0) + 1));
  const diffText = [...statusCounts].map(([label, count]) => `${label} ${count}件`).join("、");
  const commentText = opinionCount || responseCount
    ? `学校名が明記された県民意見${opinionCount}項目・県回答${responseCount}件を収録しています。`
    : "このデータでは学校名が明記された項目を確認できません。意見がなかったという意味ではありません。";
  const relationUnassessed = diffs.every((diff) => diff.public_comment_relation_status === "not_assessed");
  const relationText = relationUnassessed
    ? "差分データの県民意見との関係欄は「未評価」です。既存データでは、意見が変更・変更なしの理由になったか確認できません。"
    : "関係が明記された差分があります。原文と出典を個別に確認してください。";
  content.append(node("p", "journey-accountability-title", "意見・回答と計画差分の関係を確認"));
  content.append(accountabilityRow("県民意見・県回答", commentText));
  content.append(accountabilityRow("素案と最終計画", `${diffs.length}件を照合しました：${diffText}。`));
  content.append(accountabilityRow("意見が変更理由か", relationText, relationUnassessed ? "is-unknown" : ""));
  content.append(node("p", "journey-accountability-caution", "回答の掲載や計画差分があっても、それだけで意見が変更原因だったとは言えません。"));
}

function renderJourneyDiff(model) {
  const content = $("#journey-diff-content"); content.replaceChildren();
  const comparisonIds = [...new Set(model.cards.map((reference) => reference.comparison_id))];
  const diffs = comparisonIds.map((comparisonId) => {
    const diff = bundle.diff_cards.find((item) => item.comparison_id === comparisonId);
    if (!diff) throw new Error("school journey comparison is missing");
    const block = node("section", "journey-record");
    block.append(node("p", `journey-diff-status status-${diff.status}`, `照合結果：${diff.status_label}`), node("p", "journey-answer", diff.summary));
    const comparison = node("div", "journey-comparison");
    comparison.append(diffSide("素案", diff.baseline_text, diff.baseline_page), node("span", "diff-arrow", diff.status === "same" ? "＝" : "→"), diffSide("最終版", diff.target_text, diff.target_page));
    block.append(comparison); content.append(block);
    return diff;
  });
  renderJourneyAccountability(model, diffs);
}

function renderJourneyUnknown(model) {
  const content = $("#journey-unknown-content"); content.replaceChildren(); const list = node("ul", "journey-unknown-list");
  const messages = {
    implementation_year: "実施年度",
    school_specific_basis: "計画本文に明記された学校別の目的・理由",
    named_comments: "学校名が明記された県民意見・県回答",
  };
  model.missing_codes.forEach((code) => list.append(node("li", "", `既存データでは確認できないこと：${messages[code]}`)));
  list.append(node("li", "", "既存データでは確認できないこと：県民意見・県回答と素案差分の因果関係（差分データでは未評価）"));
  list.append(node("li", "", "このデータの公表後に、計画がどこまで実施されたかは確認していません。")); content.append(list);
}

function renderSelectedSchoolJourney() {
  const model = selectedJourneyModel(); const results = $("#journey-results"); const status = $("#journey-school-status");
  if (!model) { results.hidden = true; status.textContent = "学校を選ぶと、続く6項目を表示します。"; return; }
  const cards = model.cards.map((reference) => bundle.school_cards.find((item) => item.group_id === reference.group_id)).filter(Boolean);
  if (cards.length !== model.cards.length) throw new Error("school journey cards are incomplete");
  status.textContent = `${model.school}について、既存データから${cards.length}件の変更を確認します。`; results.hidden = false;
  renderJourneyChange(model, cards); renderJourneyBasis(model, cards); renderJourneyComments(model); renderJourneyDiff(model); renderJourneyUnknown(model); renderJourneyQuestionGuide(model);
  const question = $("#journey-question-input"); question.value = ""; updateJourneyQuestion();
}

function setupSchoolQuestionJourney() {
  const select = $("#journey-school-select");
  bundle.school_question_journey.schools.forEach((model) => addOption(select, model.school, model.school));
  select.addEventListener("change", renderSelectedSchoolJourney);
  $("#journey-comments-all").addEventListener("click", () => {
    const model = selectedJourneyModel(); if (!model) return;
    activeCommentSchool = `school:${model.school}`;
    $("#comment-search").value = ""; $("#comment-page").value = "all"; $("#comment-topic").value = "all"; $("#comment-group").value = "all";
    renderCommentList(); smoothTarget("public-comment");
  });
  const question = $("#journey-question-input"); question.addEventListener("input", updateJourneyQuestion);
  journeyQuestionChecks().forEach((item) => item.addEventListener("change", updateJourneyQuestion));
  $("#journey-question-example").addEventListener("click", () => { const model = selectedJourneyModel(); if (!model) return; question.value = model.question_example; resetJourneyQuestionChecks(); updateJourneyQuestion(); question.focus(); });
  $("#journey-question-accountability").addEventListener("click", () => {
    const model = selectedJourneyModel(); if (!model) return;
    const cards = model.cards.map((reference) => bundle.school_cards.find((item) => item.group_id === reference.group_id)).filter(Boolean);
    question.value = accountabilityQuestionExample(model, cards); resetJourneyQuestionChecks(); updateJourneyQuestion(); question.focus();
  });
  $("#journey-question-clear").addEventListener("click", () => { question.value = ""; resetJourneyQuestionChecks(); updateJourneyQuestion(); question.focus(); });
  updateJourneyQuestion();
}

async function initialize() {
  try {
    const response = await fetch("data/public_experience.json"); if (!response.ok) throw new Error(`HTTP ${response.status}`); bundle = await response.json();
    renderSchools(); setupDiffs(); setupTimeline(); setupPublicComment(); setupSchoolQuestionJourney(); renderScope();
  } catch (error) { console.error(error); $("#load-error").hidden = false; }
}

initialize();
