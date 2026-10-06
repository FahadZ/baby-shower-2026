// ============================================================
//  GAME CONFIG — edit event details here. No build step needed.
// ============================================================
window.PARTY = {
  title: "Baby Loading..",
  tagline: "Player 3 has entered the game!",
  hosts: ["Fahad Al Zaman", "Fatema Tuz Zahra Oyshe"],
  hostsShort: "Fahad & Oyshe",

  // Party start/end, with explicit Toronto offset (EDT = -04:00 in October).
  start: "2026-10-17T14:00:00-04:00",
  end: "2026-10-17T18:00:00-04:00",
  timeZone: "America/Toronto",

  // RSVPs close at the end of this moment (Toronto time).
  rsvpDeadline: "2026-10-10T23:59:59-04:00",

  venueName: "",
  address: "36 Park Lawn Rd, Etobicoke, ON M8V 0E5",

  // Leave blank ("") to hide the registry "bonus level" everywhere.
  registryUrl:
    "https://www.amazon.ca/baby-reg/fahad-alzaman-december-2026-cambridge/31VHTCQIBH8EX",

  // Google Apps Script web-app URL (ends in /exec). See README → Backend.
  rsvpEndpoint: "https://script.google.com/macros/s/AKfycbwXqZhCGIl0DlD3AccbizHnMTQT5ne9F_PVpl4HHbuuBpsNC-1C5LWvfVYXQeGcw3o7/exec",

  siteUrl: "https://fahadz.github.io/baby-shower-2026/",
  maxPlayers: 5,
};
