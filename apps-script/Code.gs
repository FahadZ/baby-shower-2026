/**
 * Baby Loading.. — RSVP backend (Google Apps Script web app)
 *
 * Script Properties (Project Settings → Script Properties):
 *   SHEET_ID       ID of the "Baby Shower 2026 RSVPs" spreadsheet (setup() fills this in)
 *   NOTIFY_EMAIL   Where host notifications go (setup() defaults it to your Google account)
 *   RSVP_DEADLINE  Optional ISO date-time; submissions after it are rejected
 *
 * Nothing personal is hard-coded here so this file can live in a public repo.
 */

var EVENT = {
  title: "Baby Loading.. — Baby Shower",
  hosts: "Fahad & Oyshe",
  dateText: "Saturday, October 17, 2026",
  timeText: "2:00 PM",
  address: "36 Park Lawn Rd, Etobicoke, ON M8V 0E5",
  siteUrl: "https://fahadz.github.io/baby-shower-2026/",
  deadlineDefault: "2026-10-10T23:59:59-04:00",
  maxGuests: 5
};

var SHEET_NAME = "RSVPs";
var SUMMARY_NAME = "Summary";
var GUESTS_NAME = "Guest List";
var HEADERS = ["Timestamp", "Name", "Email", "Attending", "Adults", "Kids", "Guest Names", "Message", "Last Updated"];

// ------------------------------------------------------------------
//  One-time setup: run this from the Apps Script editor (▶ Run).
// ------------------------------------------------------------------
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SHEET_ID");
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create("Baby Shower 2026 RSVPs");
    props.setProperty("SHEET_ID", ss.getId());
  }

  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  sheet.setName(SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight("bold").setBackground("#ead7b8");
  sheet.setFrozenRows(1);
  sheet.getRange("A:A").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.getRange("I:I").setNumberFormat("yyyy-mm-dd hh:mm");
  sheet.setColumnWidth(7, 320);
  sheet.setColumnWidth(8, 320);

  var summary = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME);
  summary.clear();
  summary.getRange("A1:B8").setValues([
    ["Stat", "Value"],
    ["Total RSVPs", "=COUNTA(RSVPs!C2:C)"],
    ["Attending RSVPs", '=COUNTIF(RSVPs!D2:D,"Yes")'],
    ["Adults attending", '=SUMIF(RSVPs!D2:D,"Yes",RSVPs!E2:E)'],
    ["Kids attending (toys & food)", '=SUMIF(RSVPs!D2:D,"Yes",RSVPs!F2:F)'],
    ["Total headcount", "=B4+B5"],
    ["Declines", '=COUNTIF(RSVPs!D2:D,"No")'],
    ["Last response", '=IF(COUNTA(RSVPs!I2:I)=0,"—",MAX(RSVPs!I2:I))']
  ]);
  summary.getRange("A1:B1").setFontWeight("bold").setBackground("#ead7b8");
  summary.getRange("B8").setNumberFormat("yyyy-mm-dd hh:mm");
  summary.setColumnWidth(1, 200);

  rebuildGuestList_();

  if (!props.getProperty("NOTIFY_EMAIL")) {
    props.setProperty("NOTIFY_EMAIL", Session.getEffectiveUser().getEmail());
  }
  if (!props.getProperty("RSVP_DEADLINE")) {
    props.setProperty("RSVP_DEADLINE", EVENT.deadlineDefault);
  }

  Logger.log("Sheet ready: " + ss.getUrl());
  Logger.log("Notifications go to: " + props.getProperty("NOTIFY_EMAIL"));
  return ss.getUrl();
}

// ------------------------------------------------------------------
//  Web app entry points
// ------------------------------------------------------------------
function doGet() {
  return json({ ok: true, service: "baby-loading-rsvp" });
}

function doPost(e) {
  try {
    var data = parseBody(e);

    // Honeypot: pretend success, save nothing.
    if (data.website) return json({ ok: true });

    // Party-game predictions (sent by the game server on the day; no deadline).
    if (data.kind === "prediction") return json(savePrediction_(data));

    var props = PropertiesService.getScriptProperties();
    var deadline = new Date(props.getProperty("RSVP_DEADLINE") || EVENT.deadlineDefault);
    if (new Date() > deadline) return json({ ok: false, error: "RSVPs are closed" });

    var rsvp = validate(data);
    var result = upsert(rsvp);

    // Emails shouldn't block saving if the daily quota is hit.
    try { notifyHosts(rsvp, result.updated); } catch (err) { console.error("notify failed", err); }
    try { confirmGuest(rsvp, result.updated); } catch (err) { console.error("confirm failed", err); }

    return json({ ok: true, updated: result.updated });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error("Empty request");
  var raw = e.postData.contents;
  try { return JSON.parse(raw); } catch (x) { /* fall through */ }
  return e.parameter || {};
}

function clean(v, max) {
  v = String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (v.length > max) v = v.slice(0, max);
  // Stop spreadsheet formula injection.
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v;
}

function validate(d) {
  var name = clean(d.name, 100);
  var email = String(d.email || "").trim().toLowerCase();
  var attending = String(d.attending || "").toLowerCase() === "yes" ? "Yes" : "No";
  if (!name) throw new Error("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw new Error("A valid email is required");
  var guests = 0, kids = 0, adultNames = [], kidNames = [];
  if (attending === "Yes") {
    guests = parseInt(d.guests, 10);
    if (!(guests >= 1 && guests <= EVENT.maxGuests)) guests = 1;
    kids = parseInt(d.kids, 10);
    if (!(kids >= 0)) kids = 0;
    kids = Math.min(kids, EVENT.maxGuests);
    var list = function (v, n) {
      return (Array.isArray(v) ? v : []).slice(0, n).map(function (x) { return clean(x, 100); });
    };
    adultNames = list(d.adultNames, guests - 1);
    kidNames = list(d.kidNames, kids);
    if (adultNames.length < guests - 1 || kidNames.length < kids ||
        adultNames.concat(kidNames).some(function (x) { return !x; })) {
      throw new Error("Please add a name for every guest");
    }
  }
  return {
    name: name,
    email: email,
    attending: attending,
    guests: guests,
    kids: kids,
    adultNames: adultNames,
    kidNames: kidNames,
    guestNames: attending === "Yes"
      ? [name].concat(adultNames).concat(kidNames.map(function (k) { return k + " (kid)"; })).join("; ")
      : "",
    message: clean(d.message, 1000)
  };
}

function getSheet() {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!id) throw new Error("Backend not set up — run setup() first");
  return SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
}

function upsert(r) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet();
    var now = new Date();
    var last = sheet.getLastRow();
    var rowIndex = -1;
    if (last > 1) {
      var emails = sheet.getRange(2, 3, last - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === r.email) { rowIndex = i + 2; break; }
      }
    }
    if (rowIndex > 0) {
      // Keep the original timestamp; refresh everything else.
      sheet.getRange(rowIndex, 2, 1, 8).setValues([[r.name, r.email, r.attending, r.guests, r.kids, r.guestNames, r.message, now]]);
      rebuildGuestList_();
      return { updated: true, row: rowIndex };
    }
    sheet.appendRow([now, r.name, r.email, r.attending, r.guests, r.kids, r.guestNames, r.message, now]);
    rebuildGuestList_();
    return { updated: false, row: sheet.getLastRow() };
  } finally {
    lock.releaseLock();
  }
}

// Predictions from the party games: one row per player, upserted by player id.
var PREDICTIONS_NAME = "Predictions";
var PREDICTION_HEADERS = ["Saved", "Player", "Player id", "Due date", "Weight (lbs)", "Looks like", "First word", "Hair at birth"];
function savePrediction_(d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
    var sheet = ss.getSheetByName(PREDICTIONS_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(PREDICTIONS_NAME);
      sheet.getRange(1, 1, 1, PREDICTION_HEADERS.length).setValues([PREDICTION_HEADERS]).setFontWeight("bold").setBackground("#ead7b8");
      sheet.setFrozenRows(1);
    }
    var pid = clean(d.playerId, 40);
    if (!pid) throw new Error("Missing player id");
    var row = [new Date(), clean(d.player, 40), pid, clean(d.dueDate, 40), clean(d.weight, 20), clean(d.looksLike, 20), clean(d.firstWord, 60), clean(d.hair, 60)];
    var last = sheet.getLastRow();
    if (last > 1) {
      var ids = sheet.getRange(2, 3, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === pid) { sheet.getRange(i + 2, 1, 1, row.length).setValues([row]); return { ok: true, updated: true }; }
      }
    }
    sheet.appendRow(row);
    return { ok: true, updated: false };
  } finally {
    lock.releaseLock();
  }
}

// One row per person attending, rebuilt from the RSVPs tab after every save.
function rebuildGuestList_() {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID"));
  var src = ss.getSheetByName(SHEET_NAME);
  var out = ss.getSheetByName(GUESTS_NAME) || ss.insertSheet(GUESTS_NAME);
  var rows = [];
  var last = src.getLastRow();
  if (last > 1) {
    src.getRange(2, 1, last - 1, HEADERS.length).getValues().forEach(function (row) {
      if (row[3] !== "Yes") return;
      String(row[6] || row[1]).split(/;\s*/).forEach(function (g) {
        if (!g) return;
        var kid = / \(kid\)$/.test(g);
        rows.push([g.replace(/ \(kid\)$/, "").replace(/^'/, ""), kid ? "Kid" : "Adult", String(row[1]).replace(/^'/, ""), row[2]]);
      });
    });
  }
  out.clear();
  out.getRange(1, 1, 1, 4).setValues([["Guest", "Type", "RSVP'd by", "RSVP email"]])
    .setFontWeight("bold").setBackground("#ead7b8");
  out.setFrozenRows(1);
  if (rows.length) out.getRange(2, 1, rows.length, 4).setValues(rows);
  out.getRange(rows.length + 3, 1, 3, 2).setValues([
    ["Adults", '=COUNTIF(B2:B' + (rows.length + 1) + ',"Adult")'],
    ["Kids", '=COUNTIF(B2:B' + (rows.length + 1) + ',"Kid")'],
    ["Total guests", rows.length]
  ]).setFontWeight("bold");
  out.setColumnWidth(1, 220); out.setColumnWidth(3, 220); out.setColumnWidth(4, 220);
}

// ------------------------------------------------------------------
//  Email
// ------------------------------------------------------------------
function esc(s) {
  return String(s == null ? "" : s).replace(/^'/, "").replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function mapUrl() {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(EVENT.address);
}

function notifyHosts(r, updated) {
  var to = PropertiesService.getScriptProperties().getProperty("NOTIFY_EMAIL");
  if (!to) return;
  var yes = r.attending === "Yes";
  var subject = (updated ? "🔁 Updated RSVP: " : "🎮 New RSVP: ") + r.name.replace(/^'/, "") +
    (yes ? " — " + r.guests + (r.guests === 1 ? " player" : " players") + (r.kids ? " + " + r.kids + (r.kids === 1 ? " kid" : " kids") : "") : " can't make it");
  var sheetUrl = "https://docs.google.com/spreadsheets/d/" + PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  var rows = [
    ["Name", r.name], ["Email", r.email], ["Attending", r.attending],
    ["Adults", yes ? r.guests : "—"], ["Kids", yes ? r.kids : "—"],
    ["Guests", yes ? r.guestNames : "—"], ["Message", r.message || "—"]
  ];
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px">' +
    "<p><b>" + (updated ? "An RSVP was updated." : "A new RSVP just came in!") + "</b></p>" +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    rows.map(function (x) {
      return '<tr><td style="background:#ead7b8;border:1px solid #ccc"><b>' + x[0] + "</b></td>" +
        '<td style="border:1px solid #ccc">' + esc(x[1]) + "</td></tr>";
    }).join("") + "</table>" +
    '<p><a href="' + sheetUrl + '">Open the RSVP sheet</a></p></div>';
  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    body: rows.map(function (x) { return x[0] + ": " + String(x[1]).replace(/^'/, ""); }).join("\n") + "\n\n" + sheetUrl,
    name: "Baby Loading.. RSVPs",
    replyTo: r.email
  });
}

function confirmGuest(r, updated) {
  var yes = r.attending === "Yes";
  var first = r.name.replace(/^'/, "").split(/\s+/)[0];
  var subject = yes
    ? "🎮 You're in! Baby shower on Oct 17 — see you on Level 17"
    : "💛 Thanks for letting us know — Baby Loading..";
  var intro = yes
    ? "Your RSVP is saved" + (updated ? " (updated)" : "") + " for <b>" + r.guests + (r.guests === 1 ? " player" : " players") +
      (r.kids ? " + " + r.kids + (r.kids === 1 ? " kid" : " kids") : "") + "</b>. Player 3 can't wait to meet you!"
    : "Sorry you can't make it" + (updated ? " (we've updated your RSVP)" : "") + " — thank you for the love. Your message has been saved to the high score board. 💛";
  var details = yes
    ? "<p style=\"background:#ead7b8;border:3px solid #1d1b18;padding:12px\">" +
      "📅 <b>" + EVENT.dateText + "</b><br>🕑 <b>" + EVENT.timeText + "</b><br>📍 <b>" + EVENT.address + "</b><br>" +
      '<a href="' + mapUrl() + '">Open in Google Maps</a></p>' +
      "<p><b>Your party:</b> " + esc(r.guestNames) + "</p>" +
      "<p><b>Optional side quest:</b> come dressed as any character you love — games, movies, TV, anime, cartoons &amp; beyond.</p>"
    : "";
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1b18;max-width:520px">' +
    "<h2 style=\"font-family:'Courier New',monospace;letter-spacing:2px\">" + (yes ? "THANKS FOR PLAYING!" : "GAME OVER… BUT THANKS ♥") + "</h2>" +
    "<p>Hi " + esc(first) + ",</p><p>" + intro + "</p>" + details +
    '<p>Need to change your answer? Just submit again at <a href="' + EVENT.siteUrl + '">' + EVENT.siteUrl + "</a> with this same email.</p>" +
    "<p>— " + EVENT.hosts + "</p></div>";
  var text = "Hi " + first + ",\n\n" + intro.replace(/<[^>]+>/g, "") + "\n\n" +
    (yes ? EVENT.dateText + " at " + EVENT.timeText + "\n" + EVENT.address + "\n" + mapUrl() + "\n\n" : "") +
    "Need to change your answer? Submit again at " + EVENT.siteUrl + " with this same email.\n\n— " + EVENT.hosts;
  MailApp.sendEmail({ to: r.email, subject: subject, htmlBody: html, body: text, name: EVENT.hosts });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------
//  Manual test helpers (run from the editor)
// ------------------------------------------------------------------
function testSubmit() {
  var email = Session.getEffectiveUser().getEmail();
  var send = function (d) { return doPost({ postData: { contents: JSON.stringify(d) } }).getContent(); };
  Logger.log(send({ name: "Test Attending", email: email, attending: "yes", guests: 3, kids: 1, adultNames: ["Test Partner", "Test Friend"], kidNames: ["Test Kid"], message: "Test RSVP" }));
  Logger.log(send({ name: "Test Decline", email: "decline+test@example.com", attending: "no", message: "Test decline" }));
  Logger.log(send({ name: "Test Attending (edited)", email: email, attending: "yes", guests: 2, adultNames: ["Test Partner"], message: "Updated" }));
}

function removeTestRows() {
  var sheet = getSheet();
  for (var r = sheet.getLastRow(); r >= 2; r--) {
    if (/^Test /.test(String(sheet.getRange(r, 2).getValue()))) sheet.deleteRow(r);
  }
}
