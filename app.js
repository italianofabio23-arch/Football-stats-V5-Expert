"use strict";

// ==========================================
// FOOTBALL STATS V5 EXPERT
// BLOCCO 1 - Configurazione e controlli pagina
// ==========================================

const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultsContainer");
const resultsInfo = document.getElementById("resultsInfo");
const matchesCount = document.getElementById("matchesCount");

const presetButtons = document.querySelectorAll(".preset");
const windowButtons = document.querySelectorAll(".window-btn");
const leagueCheckboxes = document.querySelectorAll(
  '.league-grid input[type="checkbox"]'
);

let selectedStrategy = "GG / BTTS";
let selectedDays = 1;

// Selezione strategia
presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    presetButtons.forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    selectedStrategy = button.textContent.trim();
  });
});

// Selezione finestra temporale
windowButtons.forEach((button) => {
  button.addEventListener("click", () => {
    windowButtons.forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    selectedDays = Number(button.dataset.days) || 1;
  });
});

// Restituisce i campionati selezionati
function getSelectedLeagues() {
  return [...leagueCheckboxes]
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

// Conversione sicura in numero
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
                          }
// ==========================================
// BLOCCO 2 - Utility e gestione interfaccia
// ==========================================

// Protezione del testo inserito nell'HTML
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[char];
  });
}

// Limita una percentuale tra 0 e 100
function clampPercent(value) {
  return Math.max(
    0,
    Math.min(100, Math.round(safeNumber(value)))
  );
}

// Colore della percentuale
function percentClass(value) {
  const percent = clampPercent(value);

  if (percent >= 80) return "high";
  if (percent >= 65) return "medium";
  return "low";
}

// Formatta una data per la visualizzazione
function formatMatchDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Stato caricamento
function showLoading() {
  searchBtn.disabled = true;
  searchBtn.textContent = "⏳ Analisi in corso...";

  resultsInfo.textContent =
    `Analisi ${selectedStrategy} su ${selectedDays} ` +
    `${selectedDays === 1 ? "giorno" : "giorni"}...`;

  matchesCount.textContent = "0 partite";

  resultsContainer.innerHTML = `
    <div class="empty-state">
      ⏳ Analisi delle partite in corso...
    </div>
  `;
}

// Ripristina il pulsante
function stopLoading() {
  searchBtn.disabled = false;
  searchBtn.textContent = "🔎 Cerca partite";
}

// Nessun risultato
function showEmpty(message) {
  matchesCount.textContent = "0 partite";
  resultsInfo.textContent = message;

  resultsContainer.innerHTML = `
    <div class="empty-state">
      ${escapeHtml(message)}
    </div>
  `;
}

// Gestione errori
function showError(message) {
  matchesCount.textContent = "0 partite";
  resultsInfo.textContent = "Errore durante l'analisi.";

  resultsContainer.innerHTML = `
    <div class="empty-state">
      ❌ ${escapeHtml(message)}
    </div>
  `;
                             }
// ==========================================
// BLOCCO 3 - Schede risultati e percentuali
// ==========================================

function getStrategyKey() {
  const strategy = selectedStrategy.toLowerCase();

  if (strategy.includes("over")) return "over25";
  if (strategy.includes("under")) return "under25";
  if (strategy.includes("corner")) return "corners";
  if (strategy.includes("cartell")) return "cards";

  return "btts";
}

function getStrategyLabel() {
  const key = getStrategyKey();

  const labels = {
    btts: "GG / BTTS",
    over25: "Over 2.5",
    under25: "Under 2.5",
    corners: "Corner",
    cards: "Cartellini"
  };

  return labels[key] || "Pronostico";
}

function getMainProbability(match) {
  const key = getStrategyKey();

  if (!match.probabilities) return 0;

  return clampPercent(
    match.probabilities[key]
  );
}

function renderMarketBox(label, value) {
  const percent = clampPercent(value);

  return `
    <div class="market-box">
      <span>${escapeHtml(label)}</span>

      <div class="market-value ${percentClass(percent)}">
        ${percent}%
      </div>
    </div>
  `;
}

function renderMatchCard(match) {
  const home = escapeHtml(match.home || "Casa");
  const away = escapeHtml(match.away || "Ospite");
  const league = escapeHtml(match.league || "Campionato");
  const date = formatMatchDate(match.date);

  const probabilities = match.probabilities || {};

  const mainProbability = getMainProbability(match);
  const mainLabel = getStrategyLabel();

  return `
    <article class="match-card">

      <div class="match-top">
        <div class="match-league">
          ${league}
        </div>

        <div class="match-date">
          ${escapeHtml(date)}
        </div>
      </div>

      <div class="teams">
        ⚽ ${home} - ${away}
      </div>

      <div class="market-grid">

        ${renderMarketBox(
          mainLabel,
          mainProbability
        )}

        ${renderMarketBox(
          "GG / BTTS",
          probabilities.btts
        )}

        ${renderMarketBox(
          "Over 2.5",
          probabilities.over25
        )}

        ${renderMarketBox(
          "Under 2.5",
          probabilities.under25
        )}

      </div>

    </article>
  `;
}
// ==========================================
// BLOCCO 4F - Collegamento xG -> Poisson
// ==========================================

async function enrichMatchWithExpertData(match) {
  try {
    // Il fixture originale API-Football è salvato in raw
    const sourceGame = match.raw || match;

    // Calcolo xG Casa / Ospite
    const xgData =
      await calculateExpectedGoals(sourceGame);

    // Se non abbiamo dati sufficienti,
    // lasciamo la partita invariata
    if (!xgData) {
      return match;
    }

    // Trasforma gli xG in probabilità Poisson
    const probabilities =
      calculatePoissonProbabilities(
        xgData.homeExpectedGoals,
        xgData.awayExpectedGoals
      );

    return {
      ...match,

      probabilities,

      xg: {
        home: xgData.homeExpectedGoals,
        away: xgData.awayExpectedGoals
      },

      expertData: xgData
    };

  } catch (error) {
    console.error(
      "Errore analisi V5:",
      error
    );

    return match;
  }
  }
async function renderMatches(matches) {
  if (!Array.isArray(matches) || !matches.length) {
    showEmpty(
      "Nessuna partita soddisfa i filtri selezionati."
    );
    return;
  }
resultsInfo.textContent = "🧠 Analisi Expert V5 in corso...";

matches = await Promise.all(
  matches.map(enrichMatchWithExpertData)
);
  matchesCount.textContent =
    `${matches.length} ${matches.length === 1 ? "partita" : "partite"}`;

  resultsInfo.textContent =
    `${getStrategyLabel()} • ${selectedDays} ` +
    `${selectedDays === 1 ? "giorno" : "giorni"} • ` +
    `${matches.length} risultati`;

  resultsContainer.innerHTML =
    matches.map(renderMatchCard).join("");
    }
// ==========================================
// BLOCCO 4A - Backend V4 e gestione date
// ==========================================

const BACKEND =
  "https://football-stats-v3.onrender.com";

const LEAGUE_NAMES = {
  SA: "Serie A",
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1"
};

// Data YYYY-MM-DD senza problemi di fuso orario
function formatApiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Crea le date da oggi fino al numero di giorni scelto
function getSearchDates() {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < selectedDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    dates.push(formatApiDate(date));
  }

  return dates;
}

// Nomi dei campionati selezionati
function getSelectedLeagueNames() {
  return getSelectedLeagues()
    .map((code) => LEAGUE_NAMES[code])
    .filter(Boolean);
}

// Scarica le partite di una singola data
async function fetchFixturesByDate(date) {
  const url =
`${BACKEND}/api/football?path=/fixtures&date=${date}`;

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Errore API ${response.status} per ${date}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.matches)
  ? data.matches
  : [];
}

// Scarica tutte le partite della finestra selezionata
async function fetchAllFixtures() {
  const dates = getSearchDates();

  const responses = await Promise.all(
    dates.map((date) => fetchFixturesByDate(date))
  );

  return responses.flat();
}

// Filtra solo i campionati scelti
function filterSelectedLeagues(games) {
  const selected = getSelectedLeagueNames();

  if (!selected.length) {
    return [];
  }

  return games.filter((game) => {
    const leagueName = String(
  game.competition?.name ||
  game.league?.name ||
  game.league ||
  ""
).trim();

    return selected.includes(leagueName);
  });
    }
// ==========================================
// BLOCCO 4B - Normalizzazione dati partite
// ==========================================

function normalizeFixture(game) {
  return {
    raw: game,

    home:
      game.homeTeam?.name ||
      game.teams?.home?.name ||
      game.home ||
      "Casa",

    away:
      game.awayTeam?.name ||
      game.teams?.away?.name ||
      game.away ||
      "Ospite",

    league:
      game.competition?.name ||
      game.league?.name ||
      game.league ||
      "Campionato",

    date:
      game.utcDate ||
      game.fixture?.date ||
      game.date ||
      "",

    status:
      game.status ||
      game.fixture?.status?.short ||
      ""
  };
}

function normalizeFixtures(games) {
  if (!Array.isArray(games)) {
    return [];
  }

  return games.map(normalizeFixture);
}
// ==========================================
// BLOCCO 4C - Motore matematico Poisson
// ==========================================

// Fattoriale
function factorial(n) {
  if (n <= 1) return 1;

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

// Probabilità di segnare esattamente N gol
function poissonProbability(goals, lambda) {
  return (
    Math.exp(-lambda) *
    Math.pow(lambda, goals) /
    factorial(goals)
  );
}

// Calcolo completo delle probabilità
function calculatePoissonProbabilities(
  homeExpectedGoals,
  awayExpectedGoals
) {
  const homeLambda = Math.max(
    0.05,
    Math.min(6, safeNumber(homeExpectedGoals))
  );

  const awayLambda = Math.max(
    0.05,
    Math.min(6, safeNumber(awayExpectedGoals))
  );

  const totalLambda = homeLambda + awayLambda;

  // GG / BTTS
  const bttsProbability =
    1 -
    Math.exp(-homeLambda) -
    Math.exp(-awayLambda) +
    Math.exp(-totalLambda);

  // Under 1.5
  const under15Probability =
    Math.exp(-totalLambda) *
    (1 + totalLambda);

  // Under 2.5
  const under25Probability =
    Math.exp(-totalLambda) *
    (
      1 +
      totalLambda +
      Math.pow(totalLambda, 2) / 2
    );

  const over15Probability =
    1 - under15Probability;

  const over25Probability =
    1 - under25Probability;

  // 1X2
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  const MAX_GOALS = 10;

  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
    const homeProbability =
      poissonProbability(homeGoals, homeLambda);

    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
      const awayProbability =
        poissonProbability(awayGoals, awayLambda);

      const probability =
        homeProbability * awayProbability;

      if (homeGoals > awayGoals) {
        homeWin += probability;
      } else if (homeGoals === awayGoals) {
        draw += probability;
      } else {
        awayWin += probability;
      }
    }
  }

  const resultTotal =
    homeWin + draw + awayWin;

  if (resultTotal > 0) {
    homeWin /= resultTotal;
    draw /= resultTotal;
    awayWin /= resultTotal;
  }

  return {
    homeExpectedGoals: homeLambda,
    awayExpectedGoals: awayLambda,

    btts: clampPercent(
      bttsProbability * 100
    ),

    over15: clampPercent(
      over15Probability * 100
    ),

    over25: clampPercent(
      over25Probability * 100
    ),

    under25: clampPercent(
      under25Probability * 100
    ),

    homeWin: clampPercent(
      homeWin * 100
    ),

    draw: clampPercent(
      draw * 100
    ),

    awayWin: clampPercent(
      awayWin * 100
    )
  };
}
// ==========================================
// BLOCCO 4D - Classifica e forma squadre
// ==========================================

const standingsCache = {};

// Scarica la classifica del campionato
async function fetchStandings(leagueId, season) {
  if (!leagueId || !season) {
    return [];
  }

  const key = `${leagueId}-${season}`;

  if (standingsCache[key]) {
    return standingsCache[key];
  }

  const url =
    `${BACKEND}/api/football?path=/standings` +
    `&league=${leagueId}&season=${season}`;

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

const standings =
  data.response?.[0]?.league?.standings?.[0] || [];

  standingsCache[key] = standings;

  return standings;
}


// Converte la forma recente in valore 0-1
function calculateFormScore(form) {
  const results = String(form || "")
    .replace(/,/g, "")
    .slice(-5);

  if (!results) {
    return 0.5;
  }

  let points = 0;

  for (const result of results) {
    if (result === "W") {
      points += 3;
    } else if (result === "D") {
      points += 1;
    }
  }

  return points / (results.length * 3);
}


// Media corretta con smoothing
function smoothGoalRate(
  value,
  played,
  leagueAverage,
  priorGames = 5
) {
  return (
    safeNumber(value) +
    leagueAverage * priorGames
  ) / (
    safeNumber(played) + priorGames
  );
                           }
// ==========================================
// BLOCCO 4E - Calcolo xG Casa / Ospite
// ==========================================

// Normalizza il nome di una squadra
function normalizeTeamName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}


// Trova una squadra nella classifica
function findStandingTeam(standings, team) {
  if (!Array.isArray(standings) || !team) {
    return null;
  }

  const teamId = safeNumber(team.id);
  const teamName = normalizeTeamName(team.name);

  return standings.find((row) => {
    const rowId = safeNumber(row.team?.id);
    const rowName = normalizeTeamName(row.team?.name);

    if (teamId && rowId === teamId) {
      return true;
    }

    return teamName && rowName === teamName;
  }) || null;
}


// Media gol del campionato
function calculateLeagueGoalAverage(standings) {
  let totalGoals = 0;
  let totalPlayed = 0;

  for (const row of standings) {
    totalGoals += safeNumber(
      row.all?.goals?.for
    );

    totalPlayed += safeNumber(
      row.all?.played
    );
  }

  if (!totalPlayed) {
    return 1.35;
  }

  const average =
    totalGoals / totalPlayed;

  return Math.max(
    0.8,
    Math.min(2.2, average)
  );
}


// Calcola gli Expected Goals
async function calculateExpectedGoals(game) {

  const leagueId =
    game.league?.id;

  const season =
    game.league?.season;

  const homeTeam =
    game.teams?.home;

  const awayTeam =
    game.teams?.away;

  if (
    !leagueId ||
    !season ||
    !homeTeam ||
    !awayTeam
  ) {
    return null;
  }

  const standings =
    await fetchStandings(
      leagueId,
      season
    );

  if (!standings.length) {
    return null;
  }

  const homeRow =
    findStandingTeam(
      standings,
      homeTeam
    );

  const awayRow =
    findStandingTeam(
      standings,
      awayTeam
    );

  if (!homeRow || !awayRow) {
    return null;
  }

  const leagueAverage =
    calculateLeagueGoalAverage(
      standings
    );


  // CASA
  const homePlayed =
    safeNumber(
      homeRow.all?.played
    );

  const homeGF =
    safeNumber(
      homeRow.all?.goals?.for
    );

  const homeGA =
    safeNumber(
      homeRow.all?.goals?.against
    );


  // OSPITE
  const awayPlayed =
    safeNumber(
      awayRow.all?.played
    );

  const awayGF =
    safeNumber(
      awayRow.all?.goals?.for
    );

  const awayGA =
    safeNumber(
      awayRow.all?.goals?.against
    );


  // Medie con smoothing
  const homeAttack =
    smoothGoalRate(
      homeGF,
      homePlayed,
      leagueAverage
    );

  const homeDefense =
    smoothGoalRate(
      homeGA,
      homePlayed,
      leagueAverage
    );

  const awayAttack =
    smoothGoalRate(
      awayGF,
      awayPlayed,
      leagueAverage
    );

  const awayDefense =
    smoothGoalRate(
      awayGA,
      awayPlayed,
      leagueAverage
    );


  // Forma ultime 5
  const homeForm =
    calculateFormScore(
      homeRow.form
    );

  const awayForm =
    calculateFormScore(
      awayRow.form
    );


  const homeFormFactor =
    0.90 + homeForm * 0.20;

  const awayFormFactor =
    0.90 + awayForm * 0.20;


  // xG stimati
  let homeExpectedGoals =
    leagueAverage *
    (homeAttack / leagueAverage) *
    (awayDefense / leagueAverage) *
    1.12 *
    homeFormFactor;

  let awayExpectedGoals =
    leagueAverage *
    (awayAttack / leagueAverage) *
    (homeDefense / leagueAverage) *
    0.88 *
    awayFormFactor;


  // Limiti di sicurezza
  homeExpectedGoals =
    Math.max(
      0.15,
      Math.min(4.5, homeExpectedGoals)
    );

  awayExpectedGoals =
    Math.max(
      0.15,
      Math.min(4.5, awayExpectedGoals)
    );


  return {
    homeExpectedGoals,
    awayExpectedGoals,
    homeForm,
    awayForm,
    leagueAverage
  };
      }
