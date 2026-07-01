const API_KEY = 'be669a7810223736f57370c30634d3e0';
const API_BASE = 'https://v3.football.api-sports.io';
const SQUAD_API_URL = `${API_BASE}/players/squads`;
const STANDINGS_API_URL = `${API_BASE}/standings`;
const LEAGUES_API_URL = `${API_BASE}/leagues`;
const FIXTURES_API_URL = `${API_BASE}/fixtures`;
const STANDINGS_SEASON = 2026;
const FALLBACK_WORLD_CUP_LEAGUE_ID = 1;
const FIXTURES_NEXT_COUNT = 5;
const FIXTURES_LAST_COUNT = 5;
const STANDINGS_REFRESH_MS = 3 * 60 * 1000;
const STANDINGS_RETRY_MS = 60 * 1000;

/** World Cup 2026 — Group G (final standings, source: FIFA / Wikipedia) */
const GROUP_G_WORLD_CUP = {
  groupName: 'Group G',
  teams: [
    { rank: 1, name: 'Belgium', flag: 'https://media.api-sports.io/football/teams/1.png', played: 3, win: 1, draw: 2, lose: 0, gf: 6, ga: 2, gd: 4, points: 5, form: 'WDW', qualified: true },
    { rank: 2, name: 'Egypt', flag: null, played: 3, win: 1, draw: 2, lose: 0, gf: 5, ga: 3, gd: 2, points: 5, form: 'DWD', isEgypt: true, qualified: true },
    { rank: 3, name: 'Iran', flag: 'https://media.api-sports.io/football/teams/22.png', played: 3, win: 0, draw: 3, lose: 0, gf: 3, ga: 3, gd: 0, points: 3, form: 'DDD', eliminated: true },
    { rank: 4, name: 'New Zealand', flag: 'https://media.api-sports.io/football/teams/4673.png', played: 3, win: 0, draw: 1, lose: 2, gf: 4, ga: 10, gd: -6, points: 1, form: 'DLL', eliminated: true },
  ],
  results: [
    { matchday: 1, home: 'Belgium', away: 'Egypt', score: '1–1' },
    { matchday: 1, home: 'Iran', away: 'New Zealand', score: '2–2' },
    { matchday: 2, home: 'Belgium', away: 'Iran', score: '0–0' },
    { matchday: 2, home: 'New Zealand', away: 'Egypt', score: '1–3' },
    { matchday: 3, home: 'Egypt', away: 'Iran', score: '1–1' },
    { matchday: 3, home: 'New Zealand', away: 'Belgium', score: '1–5' },
  ],
};

const GROUP_G_MAX_MATCHES = 3;

/** Egypt knockout path after qualifying 2nd in Group G */
const EGYPT_KNOCKOUT_PATH = {
  nextRound: 'Round of 32',
  nextOpponent: 'Australia',
  nextNote: 'Group D runners-up',
  winRound: 'Round of 16',
  winOpponent: 'Argentina',
};

let allClubFacts = [];
let teamsCache = [];
let activeClubView = null;
let egyptSquadData = null;
let worldCupLeagueInfo = null;
let worldLeaguesData = null;
let standingsData = null;
let egyptFixturesData = null;
let standingsRefreshTimer = null;
let standingsVisibilityHandler = null;
let lastStandingsError = null;
let standingsLastUpdated = null;
let lastEgyptStandingsSnapshot = null;

const CURATED_CLUB_FACTS = [
  { match: 'egypt', facts: [
    'Egypt has won a record 7 Africa Cup of Nations titles — more than any other nation.',
    'The Pharaohs were the first African team to play at a FIFA World Cup, in 1934.',
    'Egypt reached the AFCON final in 2021 and 2022, showing their continued dominance.',
    'Mohamed Salah is the most famous modern Pharaoh and one of the world\'s best forwards.',
    'Hossam Hassan is Egypt\'s all-time top scorer with over 70 international goals.',
    'The national team plays in red kits with the iconic eagle crest.',
    'Egypt hosted and won AFCON tournaments in 1957, 1959, 1986, 1998, 2006, 2008, and 2010.',
    'The Cairo International Stadium is among the venues used for major national team matches.',
    'Egypt has produced legends like Mohamed Aboutrika, Ahmed Hassan, and Essam El-Hadary.',
    'The Pharaohs are perennial favourites every time AFCON comes around.',
    'Egypt\'s passionate supporters fill stadiums across the country for home qualifiers.',
    'The national team represents over 100 million football-mad Egyptians worldwide.',
    'Egypt finished 2nd in World Cup 2026 Group G and qualified for the Round of 32.',
    'Next up for the Pharaohs: Australia in the Round of 32 — beat them and Egypt face Argentina in the Round of 16.',
  ]},
  { match: 'ahly', facts: [
    'Al Ahly are the most successful club in CAF Champions League history.',
    'Nicknamed "The Red Devils", Ahly were founded in 1907 in Cairo.',
    'The Cairo Derby against Zamalek is one of the fiercest rivalries in world football.',
    'Ahly have won the Egyptian Premier League more times than any other club.',
    'The club plays at the iconic Cairo International Stadium for many big matches.',
    'Ahly fans are known for creating incredible atmospheres with red flares and chants.',
    'The club has won multiple CAF Super Cup titles.',
    'Ahly\'s youth academy has produced countless Egyptian internationals.',
    'Aboutrika, Barakat, and El-Shahat are among Ahly\'s most beloved legends.',
    'Ahly regularly compete in the CAF Champions League knockout stages.',
    'The club\'s badge features the red devil symbol recognised across Africa.',
    'Ahly hold the record for most Egyptian Cup victories.',
  ]},
  { match: 'zamalek', facts: [
    'Zamalek are known as "The White Knights" and were founded in 1911.',
    'Zamalek share Cairo with rivals Al Ahly in the famous Cairo Derby.',
    'The club has won multiple Egyptian Premier League championships.',
    'Zamalek claimed CAF Confederation Cup glory in 2019.',
    'The White Knights play at the Cairo International Stadium.',
    'Zamalek have one of the largest and most passionate fanbases in Egypt.',
    'The club\'s white kit is instantly recognisable across African football.',
    'Zamalek have produced stars like Shikabala, Fawzy, and Hassan Shehata as a player.',
    'Derby day in Cairo stops the city as millions watch Ahly vs Zamalek.',
    'Zamalek have won the Egyptian Cup numerous times throughout their history.',
    'The club competed in the FIFA Club World Cup after continental success.',
    'Zamalek\'s ultras are famous for choreographed displays in the stands.',
  ]},
  { match: 'pyramids', facts: [
    'Pyramids FC rose quickly after major investment in the late 2010s.',
    'The club play at the 30 June Stadium in Cairo.',
    'Pyramids have finished near the top of the Egyptian Premier League table.',
    'The club signed high-profile players to challenge Ahly and Zamalek.',
    'Pyramids FC rebranded from their previous identity to build a new brand.',
    'The club has modern training facilities compared to many Egyptian sides.',
    'Pyramids have competed in CAF continental competitions.',
    'The name references Egypt\'s ancient pyramids, tying the club to national identity.',
    'Pyramids have been one of the biggest spenders in Egyptian football.',
    'The club aims to break the traditional duopoly of Ahly and Zamalek.',
  ]},
  { match: 'ismaily', facts: [
    'Ismaily SC are based in Ismailia on the Suez Canal.',
    'Nicknamed "The Yellow Dragons", Ismaily wear distinctive yellow kits.',
    'Ismaily won the CAF Champions League in 1969 — a historic achievement.',
    'The club has won the Egyptian Premier League multiple times.',
    'Ismaily Stadium is their fortress in the canal city.',
    'Ismaily have a fierce regional following in the Suez Canal zone.',
    'The club produced talented players who starred for the national team.',
    'Ismaily\'s golden era in the 1960s and 70s is still celebrated today.',
    'The Yellow Dragons remain one of Egypt\'s most historic clubs.',
    'Matches against Cairo giants always draw huge canal-city crowds.',
  ]},
  { match: 'smouha', facts: [
    'Smouha SC are based in Alexandria, Egypt\'s second-largest city.',
    'The club was founded in 1949 and plays at Smouha Stadium.',
    'Smouha are known for developing young Egyptian talent.',
    'The club has been a consistent Egyptian Premier League presence.',
    'Alexandria\'s coastal culture influences Smouha\'s passionate support.',
    'Smouha have competed in the Egyptian Cup knockout rounds regularly.',
    'The club\'s blue colours represent their Alexandria identity.',
    'Smouha have challenged bigger clubs in cup upsets over the years.',
    'The academy pipeline feeds players into the first team and national side.',
    'Smouha matches draw strong local crowds from across Alexandria.',
  ]},
  { match: 'gouna', facts: [
    'El Gouna FC represent the Red Sea resort town of El Gouna.',
    'The club offers a unique coastal setting in Egyptian football.',
    'El Gouna have competed in the Egyptian Premier League.',
    'The resort backing gives the club a distinctive identity.',
    'El Gouna Stadium hosts home matches near the Red Sea.',
    'The club has worked to establish itself among Egypt\'s top flight.',
    'El Gouna\'s location attracts visitors who discover Egyptian league football.',
    'The club has invested in squad building to avoid relegation battles.',
    'Red Sea communities rally behind El Gouna on matchdays.',
    'El Gouna represent tourism and sport combined in one club.',
  ]},
  { match: 'ceramica', facts: [
    'Ceramica Cleopatra FC were formed through merger and rebranding in 2020.',
    'The club plays at the New Suez Stadium.',
    'Ceramica reached the Egyptian Premier League remarkably quickly.',
    'Heavy investment helped build a competitive squad fast.',
    'The Ceramica name comes from the sponsoring ceramics company.',
    'Cleopatra in the name ties the club to Egyptian heritage.',
    'The club has aimed to establish itself as a top-tier regular.',
    'Ceramica Cleopatra have been active in the transfer market.',
    'Suez region fans have embraced the new club identity.',
    'The club represents modern corporate-backed football in Egypt.',
  ]},
  { match: 'pharco', facts: [
    'Pharco FC are based in Alexandria.',
    'The club is backed by the Pharco pharmaceutical group.',
    'Pharco play at the Alexandria Stadium.',
    'The club climbed through divisions to reach the top flight.',
    'Pharco\'s rise shows how investment can transform Egyptian clubs.',
    'Alexandria fans have welcomed another Premier League side.',
    'The club name references Egypt\'s ancient pharaohs.',
    'Pharco have focused on building a stable squad in the top division.',
    'The pharmaceutical backing provides financial stability.',
    'Pharco compete against Smouha and other Alexandria-area rivals.',
  ]},
  { match: 'national bank', facts: [
    'National Bank of Egypt FC reached the Premier League in 2021.',
    'The club is linked to Egypt\'s national banking institution.',
    'NBE FC play home matches in Cairo.',
    'Promotion was a major achievement for the banking-backed side.',
    'The club has focused on gradual squad improvement.',
    'NBE represent institutional investment in Egyptian football.',
    'The team has worked to secure their top-flight status.',
    'Young Egyptian players get opportunities at NBE.',
    'The club\'s green branding reflects the bank\'s identity.',
    'NBE matches are part of Cairo\'s busy football calendar.',
  ]},
  { match: 'masry', facts: [
    'Al Masry SC are based in Port Said on the Mediterranean.',
    'Nicknamed "The Green Eagles", Al Masry wear green kits.',
    'Port Said Stadium is one of Egypt\'s most atmospheric venues.',
    'Al Masry have a fierce fanbase in the Suez Canal region.',
    'The club has been a regular Premier League presence.',
    'Port Said\'s football culture is among the most passionate in Egypt.',
    'Al Masry have caused upsets against Cairo giants in cups.',
    'The Green Eagles represent canal-city pride.',
    'Al Masry\'s history stretches back decades in Egyptian football.',
    'Away trips to Port Said are daunting for visiting teams.',
  ]},
  { match: 'mokawloon', facts: [
    'Arab Contractors SC (Al Mokawloon) are a historic Cairo club.',
    'The club was founded in 1973.',
    'Al Mokawloon play at the Arab Contractors Stadium.',
    'The club has produced many Egyptian internationals over the years.',
    'Arab Contractors have won domestic honours in Egypt.',
    'The club is linked to Egypt\'s construction industry.',
    'Mokawloon have yo-yoed between divisions but remain respected.',
    'Their academy has developed technically gifted players.',
    'Cairo derbies against bigger clubs are always competitive.',
    'Al Mokawloon\'s green kit is recognisable in the league.',
  ]},
  { match: 'enppi', facts: [
    'ENPPI FC are based in Cairo and linked to the petroleum industry.',
    'The club is famous for its youth academy pipeline.',
    'ENPPI have won the Egyptian Premier League.',
    'Many ENPPI graduates became national team regulars.',
    'The club plays at Petrosport Stadium.',
    'ENPPI focus on developing talent before selling to bigger clubs.',
    'The petroleum backing provides structure and resources.',
    'ENPPI have competed in CAF competitions.',
    'The club\'s model influences other Egyptian sides.',
    'Technical, youthful football is ENPPI\'s trademark.',
  ]},
  { match: 'future', facts: [
    'Future FC are among the newer clubs in the Egyptian Premier League.',
    'The club has invested in reaching and staying in the top flight.',
    'Future FC aim to build a modern club structure.',
    'The name signals ambition for long-term success.',
    'Future have been active in the transfer market.',
    'The club represents new ownership in Egyptian football.',
    'Future FC matches add variety to the league fixture list.',
    'The squad blends experienced and young Egyptian players.',
    'Future are working to grow their fanbase.',
    'Every season is a step toward establishing the club\'s identity.',
  ]},
  { match: 'baladiyat', facts: [
    'Baladiyat El Mahalla represent El Mahalla El Kubra in the Nile Delta.',
    'The city is one of Egypt\'s major industrial centres.',
    'The club has strong local support in the Delta region.',
    'Baladiyat compete in Egypt\'s league pyramid.',
    'El Mahalla has a proud working-class football tradition.',
    'The club name means "Municipality of El Mahalla".',
    'Delta derbies bring intense local rivalry.',
    'Baladiyat\'s fans are known for loyalty through every division.',
    'The club represents community football far from Cairo.',
    'El Mahalla\'s textile industry history ties to the club\'s roots.',
  ]},
];

const dykText = document.getElementById('dykText');
const randomFactBtn = document.getElementById('randomFactBtn');
const exploreFactsBtn = document.getElementById('exploreFactsBtn');
const clubSearch = document.getElementById('clubSearch');
const searchResults = document.getElementById('searchResults');
const searchHint = document.getElementById('searchHint');
const clubsStat = document.getElementById('clubsStat');
const factsStat = document.getElementById('factsStat');
const clubsCategoryCount = document.getElementById('clubsCategoryCount');
const clubsCategoryBtn = document.getElementById('clubsCategoryBtn');
const standingsSection = document.getElementById('standingsSection');
const apiStatus = document.getElementById('apiStatus');
const clubPage = document.getElementById('clubPage');
const clubPageBack = document.getElementById('clubPageBack');
const clubPageHeader = document.getElementById('clubPageHeader');
const clubPageBody = document.getElementById('clubPageBody');
const homeView = document.getElementById('homeView');
const bottomNav = document.getElementById('bottomNav');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function fetchFromApi(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers: { 'x-apisports-key': API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Could not load clubs (${response.status})`);
  }

  const data = await response.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(Object.values(data.errors).join(' ') || 'API returned an error');
  }

  return data;
}

function buildStandingsUrl(leagueId) {
  return `${STANDINGS_API_URL}?league=${leagueId}&season=${STANDINGS_SEASON}`;
}

function buildEgyptNextFixturesUrl(teamId) {
  return `${FIXTURES_API_URL}?team=${teamId}&next=${FIXTURES_NEXT_COUNT}`;
}

function buildEgyptLastFixturesUrl(teamId) {
  return `${FIXTURES_API_URL}?team=${teamId}&last=${FIXTURES_LAST_COUNT}`;
}

function getRealLeagueId(leagueName = 'World Cup') {
  if (worldLeaguesData?.leagues?.length) {
    const exact = worldLeaguesData.leagues.find((item) => item.league?.name === leagueName);
    if (exact?.league?.id) return exact.league.id;
    const fuzzy = worldLeaguesData.leagues.find((item) =>
      item.league?.name?.toLowerCase().includes(leagueName.toLowerCase()),
    );
    if (fuzzy?.league?.id) return fuzzy.league.id;
  }
  if (worldCupLeagueInfo?.league?.id) return worldCupLeagueInfo.league.id;
  if (standingsData?.leagueId) return standingsData.leagueId;
  if (leagueName === 'World Cup') return FALLBACK_WORLD_CUP_LEAGUE_ID;
  return null;
}

function syncWorldCupFromWorldLeagues() {
  if (!worldLeaguesData?.leagues?.length) return;
  const entry = worldLeaguesData.leagues.find((item) => item.league?.name === 'World Cup')
    || worldLeaguesData.leagues[0];
  if (!entry) return;
  worldCupLeagueInfo = {
    league: entry.league,
    country: entry.country,
    season: STANDINGS_SEASON,
    seasons: entry.seasons || [],
    realLeagueId: entry.league.id,
  };
}

async function fetchWorldLeagues() {
  const url = `${LEAGUES_API_URL}?country=World`;
  const response = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  if (!response.ok) throw new Error(`World leagues failed (${response.status})`);
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(Object.values(data.errors).join(' '));
  }
  worldLeaguesData = { leagues: data.response || [], url };
  return worldLeaguesData;
}

async function fetchWorldCupLeague() {
  const url = `${LEAGUES_API_URL}?name=World Cup`;
  const response = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  if (!response.ok) throw new Error(`World Cup league failed (${response.status})`);
  const data = await response.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(Object.values(data.errors).join(' '));
  }
  const entry = (data.response || []).find((item) => item.league?.name === 'World Cup') || data.response?.[0];
  if (!entry) return null;
  worldCupLeagueInfo = {
    league: entry.league,
    country: entry.country,
    season: STANDINGS_SEASON,
    seasons: entry.seasons || [],
    realLeagueId: entry.league.id,
  };
  return worldCupLeagueInfo;
}

async function fetchStandings(leagueId) {
  const id = leagueId ?? getRealLeagueId('World Cup');
  if (!id) throw new Error('World Cup league ID not found');

  const url = buildStandingsUrl(id);
  const response = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  const data = await response.json();

  if (!response.ok || (data.errors && Object.keys(data.errors).length > 0)) {
    const message = data.errors ? Object.values(data.errors).join(' ') : `Standings failed (${response.status})`;
    lastStandingsError = message;
    throw new Error(message);
  }

  const block = data.response?.[0];
  if (!block?.standings?.length) {
    standingsData = null;
    lastStandingsError = 'No standings data for this season yet.';
    return null;
  }

  const rows = [];
  block.standings.forEach((group) => group.forEach((row) => rows.push(row)));

  standingsData = {
    league: block.league,
    season: STANDINGS_SEASON,
    groups: block.standings,
    rows,
    url,
    leagueId: id,
  };

  if (!findEgyptWorldCupGroup()) {
    lastStandingsError = 'Standings loaded but Egypt not found — showing backup table.';
  } else {
    lastStandingsError = null;
  }

  return standingsData;
}

async function fetchEgyptFixturesFromApi(teamId, mode) {
  const param = mode === 'last' ? 'last' : 'next';
  const count = mode === 'last' ? FIXTURES_LAST_COUNT : FIXTURES_NEXT_COUNT;
  const url = `${FIXTURES_API_URL}?team=${teamId}&${param}=${count}`;
  const response = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  const data = await response.json();
  if (!response.ok || (data.errors && Object.keys(data.errors).length > 0)) {
    throw new Error(data.errors ? Object.values(data.errors).join(' ') : 'Fixtures failed');
  }
  return { fixtures: data.response || [], url };
}

async function fetchEgyptFixtures(teamId) {
  const id = teamId ?? getEgyptNationalTeam()?.id;
  if (!id) { egyptFixturesData = null; return null; }

  let nextResult = { fixtures: [], url: buildEgyptNextFixturesUrl(id) };
  let lastResult = { fixtures: [], url: buildEgyptLastFixturesUrl(id) };

  try { nextResult = await fetchEgyptFixturesFromApi(id, 'next'); } catch (e) { console.warn('Next fixtures:', e); }
  try { lastResult = await fetchEgyptFixturesFromApi(id, 'last'); } catch (e) { console.warn('Last fixtures:', e); }

  egyptFixturesData = {
    teamId: id,
    next: nextResult.fixtures,
    last: lastResult.fixtures,
    nextUrl: nextResult.url,
    lastUrl: lastResult.url,
  };
  return egyptFixturesData;
}

async function fetchTrophyFacts(teamId) {
  const facts = [];
  try {
    const data = await fetchFromApi(`/trophies?team=${teamId}`);
    const trophies = data.response || [];
    if (trophies.length === 0) {
      facts.push('Trophy data is limited, but the club continues to compete for honours.');
      return facts;
    }
    facts.push(`Recorded ${trophies.length} trophy entries in football databases.`);
    trophies.slice(0, 12).forEach((trophy) => {
      const league = trophy.league || trophy.country || 'Competition';
      const season = trophy.season || '';
      const place = trophy.place || 'Participant';
      facts.push(`${place} — ${league}${season ? ` (${season})` : ''}.`);
    });
  } catch {
    facts.push('Trophy history spans many seasons of Egyptian and African football.');
  }
  return facts;
}

function findEgyptWorldCupGroup() {
  if (!standingsData?.groups?.length) return null;
  const egyptTeam = getEgyptNationalTeam();
  const egyptId = egyptTeam?.id;

  for (const group of standingsData.groups) {
    const egyptRow = group.find(
      (row) => row.team.id === egyptId || row.team.name.toLowerCase() === 'egypt',
    );
    if (egyptRow) {
      return { rows: group, egyptRow, groupName: egyptRow.group || GROUP_G_WORLD_CUP.groupName };
    }
  }
  return null;
}

function normalizeApiStandingsRow(row) {
  return {
    rank: row.rank,
    name: row.team.name,
    logo: row.team.logo,
    flag: row.team.logo,
    played: row.all?.played ?? 0,
    win: row.all?.win ?? 0,
    draw: row.all?.draw ?? 0,
    lose: row.all?.lose ?? 0,
    gf: row.all?.goals?.for ?? 0,
    ga: row.all?.goals?.against ?? 0,
    gd: row.goalsDiff ?? 0,
    points: row.points ?? 0,
    form: row.form || '',
    status: row.status || '',
    isEgypt: row.team.name.toLowerCase() === 'egypt',
  };
}

function getSortedGroupTeams() {
  const { teams } = getEgyptGroupTableData();
  return [...teams].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
}

function getGroupGMatchResults() {
  return GROUP_G_WORLD_CUP.results.map((m) => ({ ...m, date: null }));
}

function getGroupGOfficialTableData() {
  const egyptRow = GROUP_G_WORLD_CUP.teams.find((t) => t.isEgypt);
  const apiUrl = buildStandingsUrl(getRealLeagueId('World Cup') || FALLBACK_WORLD_CUP_LEAGUE_ID);
  return {
    groupName: GROUP_G_WORLD_CUP.groupName,
    teams: GROUP_G_WORLD_CUP.teams,
    egyptRow,
    source: 'official',
    apiUrl,
  };
}

function isOfficialGroupGTableComplete(apiTeams) {
  if (!apiTeams?.length || apiTeams.length !== 4) return false;
  const belgium = apiTeams.find((t) => t.name.toLowerCase().includes('belgium'));
  const egypt = apiTeams.find((t) => t.isEgypt);
  const iran = apiTeams.find((t) => t.name.toLowerCase().includes('iran'));
  const nz = apiTeams.find((t) => t.name.toLowerCase().includes('new zealand'));
  if (!belgium || !egypt || !iran || !nz) return false;
  if (!apiTeams.every((t) => t.played >= GROUP_G_MAX_MATCHES)) return false;
  return belgium.rank === 1 && egypt.rank === 2 && iran.rank === 3 && nz.rank === 4
    && belgium.points === 5 && egypt.points === 5;
}

function getGroupGMaxPoints() {
  const teams = getSortedGroupTeams();
  const top = Math.max(...teams.map((t) => t.points), 1);
  return Math.max(top, GROUP_G_MAX_MATCHES * 3);
}

function renderGroupGFormDots(form) {
  if (!form) return '<span class="standings-form-empty">—</span>';
  const chars = form.split('').slice(0, 5);
  return `<span class="standings-form">${chars.map((c) => {
    const cls = c === 'W' ? 'form-win' : c === 'D' ? 'form-draw' : c === 'L' ? 'form-loss' : 'form-unknown';
    return `<span class="form-dot ${cls}" title="${c}">${c}</span>`;
  }).join('')}</span>`;
}

function renderGroupGPointsChart() {
  const teams = getSortedGroupTeams();
  const maxPts = getGroupGMaxPoints();
  const egyptLogo = getEgyptNationalTeam()?.logo || 'https://media.api-sports.io/football/teams/32.png';

  const bars = teams.map((team) => {
    const pct = Math.round((team.points / maxPts) * 100);
    const logo = team.isEgypt ? (team.logo || egyptLogo) : (team.logo || team.flag);
    return `
      <div class="group-g-chart-row ${team.isEgypt ? 'group-g-chart-row-egypt' : ''}">
        <div class="group-g-chart-meta">
          <img src="${logo}" alt="" class="group-g-chart-logo">
          <span class="group-g-chart-name">${escapeHtml(team.name)}${team.isEgypt ? ' 🇪🇬' : ''}</span>
          <span class="group-g-chart-pts">${team.points} pts</span>
        </div>
        <div class="group-g-chart-track" aria-hidden="true">
          <div class="group-g-chart-bar" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="group-g-chart">
      <div class="group-g-chart-header">
        <h4 class="standings-group-label">Points chart</h4>
        <span class="group-g-chart-note">Belgium &amp; Egypt → Round of 32</span>
      </div>
      <div class="group-g-chart-rows">${bars}</div>
    </div>
  `;
}

function getEgyptGroupTableData() {
  const official = getGroupGOfficialTableData();
  const apiGroup = findEgyptWorldCupGroup();
  const apiUrl = standingsData?.url || official.apiUrl;

  if (apiGroup?.rows?.length) {
    const teams = apiGroup.rows.map(normalizeApiStandingsRow);
    if (isOfficialGroupGTableComplete(teams)) {
      return {
        groupName: apiGroup.groupName,
        teams,
        egyptRow: normalizeApiStandingsRow(apiGroup.egyptRow),
        source: 'api',
        apiUrl,
      };
    }
  }

  return official;
}

function formatStandingsUpdatedTime() {
  if (!standingsLastUpdated) return '';
  return standingsLastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getEgyptStandingsSnapshot() {
  const { egyptRow } = getEgyptGroupTableData();
  if (!egyptRow) return null;
  return `${egyptRow.rank}|${egyptRow.points}|${egyptRow.gf}|${egyptRow.ga}|${egyptRow.played}`;
}

function markStandingsUpdated() {
  standingsLastUpdated = new Date();
  const snapshot = getEgyptStandingsSnapshot();
  const changed = lastEgyptStandingsSnapshot && snapshot && snapshot !== lastEgyptStandingsSnapshot;
  lastEgyptStandingsSnapshot = snapshot;
  return changed;
}

function renderStandingsLiveBadge() {
  const { source } = getEgyptGroupTableData();
  const isLive = source === 'api';
  const isOfficial = source === 'official';
  const updated = standingsLastUpdated
    ? `Updated ${formatStandingsUpdatedTime()} · refreshes every 3 min`
    : 'Final group stage complete';

  const label = isLive
    ? '● Live from API'
    : isOfficial
      ? '● Final standings (FIFA World Cup 2026)'
      : '○ Backup data — retrying API';

  const badgeClass = isLive
    ? 'standings-live-badge-api'
    : isOfficial
      ? 'standings-live-badge-official'
      : 'standings-live-badge-fallback';

  const reason = lastStandingsError && !isOfficial
    ? `<span class="standings-live-reason">${escapeHtml(lastStandingsError)}</span>`
    : '';

  return `
    <div class="standings-live-badge ${badgeClass}">
      <span class="standings-live-label">${label}</span>
      <span class="standings-live-updated">${updated}</span>
      ${reason}
    </div>
  `;
}

function formatFixtureDate(dateStr) {
  if (!dateStr) return 'Date TBD';
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFixtureScore(fx) {
  const h = fx.goals?.home;
  const a = fx.goals?.away;
  if (h == null || a == null) return '';
  return `${h}–${a}`;
}

function renderFixturesList(fixtures, { emptyMessage, showScore = false } = {}) {
  if (!fixtures.length) return `<p class="fixtures-empty">${emptyMessage}</p>`;
  const items = fixtures.map((fx) => {
    const home = fx.teams?.home?.name || 'TBD';
    const away = fx.teams?.away?.name || 'TBD';
    const date = formatFixtureDate(fx.fixture?.date);
    const score = showScore ? formatFixtureScore(fx) : '';
    const vs = score || 'vs';
    return `
      <li class="fixture-item">
        <span class="fixture-date">${escapeHtml(date)}</span>
        <div class="fixture-match">
          <span class="fixture-team">${escapeHtml(home)}</span>
          <span class="fixture-vs ${score ? 'fixture-score' : ''}">${escapeHtml(vs)}</span>
          <span class="fixture-team">${escapeHtml(away)}</span>
        </div>
      </li>
    `;
  }).join('');
  return `<ul class="fixtures-list">${items}</ul>`;
}

function renderEgyptKnockoutBlock() {
  const egyptLogo = getEgyptNationalTeam()?.logo || 'https://media.api-sports.io/football/teams/32.png';
  const { nextRound, nextOpponent, nextNote, winRound, winOpponent } = EGYPT_KNOCKOUT_PATH;

  return `
    <div class="egypt-knockout">
      <h4 class="standings-group-label">🇪🇬 Knockout path</h4>
      <div class="knockout-path">
        <div class="knockout-step knockout-step-next">
          <span class="knockout-step-label">Next · ${escapeHtml(nextRound)}</span>
          <div class="knockout-matchup">
            <span class="knockout-team knockout-team-egypt">
              <img src="${egyptLogo}" alt="" class="knockout-team-logo"> Egypt
            </span>
            <span class="knockout-vs">vs</span>
            <span class="knockout-team">${escapeHtml(nextOpponent)}</span>
          </div>
          <span class="knockout-step-note">${escapeHtml(nextNote)}</span>
        </div>
        <div class="knockout-arrow" aria-hidden="true">↓</div>
        <div class="knockout-step knockout-step-win">
          <span class="knockout-step-label">If Egypt win · ${escapeHtml(winRound)}</span>
          <div class="knockout-matchup knockout-matchup-future">
            <span class="knockout-team knockout-team-egypt">
              <img src="${egyptLogo}" alt="" class="knockout-team-logo"> Egypt
            </span>
            <span class="knockout-vs">vs</span>
            <span class="knockout-team">${escapeHtml(winOpponent)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function rerenderStandingsUI() {
  renderStandingsSection();
  if (activeClubView?.team?.name?.toLowerCase() === 'egypt' && !clubPage.hidden) {
    clubPageBody.innerHTML = renderClubPageContent(
      activeClubView.facts,
      activeClubView.squad,
      activeClubView.team,
    );
  }
}

async function refreshEgyptGroupStandings() {
  const leagueId = getRealLeagueId('World Cup');
  if (!leagueId) return false;
  try {
    const egyptTeam = getEgyptNationalTeam();
    await Promise.all([
      fetchStandings(leagueId),
      fetchEgyptFixtures(egyptTeam?.id).catch(() => {}),
    ]);
    markStandingsUpdated();
    rerenderStandingsUI();
    return findEgyptWorldCupGroup() !== null;
  } catch (err) {
    console.error('Standings refresh failed:', err);
    rerenderStandingsUI();
    return false;
  }
}

function stopStandingsAutoRefresh() {
  if (standingsRefreshTimer) { clearTimeout(standingsRefreshTimer); standingsRefreshTimer = null; }
  if (standingsVisibilityHandler) {
    document.removeEventListener('visibilitychange', standingsVisibilityHandler);
    standingsVisibilityHandler = null;
  }
}

function scheduleNextStandingsRefresh() {
  if (standingsRefreshTimer) clearTimeout(standingsRefreshTimer);
  const delay = getEgyptGroupTableData().source === 'api' ? STANDINGS_REFRESH_MS : STANDINGS_RETRY_MS;
  standingsRefreshTimer = setTimeout(async () => {
    if (document.hidden) { scheduleNextStandingsRefresh(); return; }
    await refreshEgyptGroupStandings();
    scheduleNextStandingsRefresh();
  }, delay);
}

function startStandingsAutoRefresh() {
  stopStandingsAutoRefresh();
  scheduleNextStandingsRefresh();
  standingsVisibilityHandler = () => { if (!document.hidden) refreshEgyptGroupStandings(); };
  document.addEventListener('visibilitychange', standingsVisibilityHandler);
}

function buildSquadUrl(teamId) {
  return `${SQUAD_API_URL}?team=${teamId}`;
}

/** Squad: https://v3.football.api-sports.io/players/squads?team=TEAM_ID */
async function fetchTeamSquad(teamId) {
  const url = buildSquadUrl(teamId);
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'x-apisports-key': API_KEY },
  });

  if (!response.ok) {
    throw new Error(`Squad request failed (${response.status})`);
  }

  const data = await response.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(Object.values(data.errors).join(' ') || 'Squad API returned an error');
  }

  return data.response?.[0]?.players || [];
}

async function fetchEgyptSquad(teamId) {
  const id = teamId ?? getEgyptNationalTeam()?.id;
  if (!id) {
    egyptSquadData = null;
    return null;
  }

  try {
    const players = await fetchTeamSquad(id);
    egyptSquadData = { teamId: id, players };
    return egyptSquadData;
  } catch (err) {
    console.error('Egypt squad unavailable:', err);
    egyptSquadData = { teamId: id, players: [] };
    return egyptSquadData;
  }
}

function buildSquadFacts(squad, teamName) {
  const facts = [];

  if (squad.length === 0) {
    facts.push(`${teamName}'s squad features players from across Egypt and abroad.`);
    return facts;
  }

  facts.push(`${teamName} squad lists ${squad.length} players.`);

  squad.slice(0, 8).forEach((player) => {
    const number = player.number ? `#${player.number} ` : '';
    const position = player.position ? ` (${player.position})` : '';
    facts.push(`${number}${player.name}${position}.`);
  });

  return facts;
}

function renderSquadSection(players, teamName) {
  if (players.length === 0) return '';

  const cards = players.map((player) => `
    <article class="squad-player">
      <div class="squad-player-photo">
        ${player.photo
          ? `<img src="${player.photo}" alt="${escapeHtml(player.name)}" loading="lazy">`
          : '<span class="squad-player-placeholder">👤</span>'}
        ${player.number ? `<span class="squad-player-number">${player.number}</span>` : ''}
      </div>
      <h4 class="squad-player-name">${escapeHtml(player.name)}</h4>
      <p class="squad-player-position">${escapeHtml(player.position || 'Player')}</p>
      ${player.age ? `<p class="squad-player-age">Age ${player.age}</p>` : ''}
    </article>
  `).join('');

  return `
    <section class="squad-section">
      <h3 class="club-block-title">Squad <span class="club-facts-count">${players.length}</span></h3>
      <div class="squad-grid">${cards}</div>
    </section>
  `;
}

function getEgyptNationalTeam() {
  return teamsCache.find((item) => isNationalTeam(item.team))?.team || null;
}

function isNationalTeam(team) {
  return team.name.toLowerCase() === 'egypt' || team.national === true;
}

function getCuratedFacts(teamName) {
  const normalized = teamName.toLowerCase();
  const facts = [];

  CURATED_CLUB_FACTS.forEach(({ match, facts: clubFacts }) => {
    if (normalized.includes(match)) {
      facts.push(...clubFacts);
    }
  });

  return facts;
}

function buildApiFacts(team, venue) {
  const facts = [];

  if (team.founded) {
    facts.push(`Founded in ${team.founded} — over ${new Date().getFullYear() - team.founded} years of football history.`);
  }

  if (venue?.name) {
    let venueFact = `Home ground: ${venue.name}`;
    if (venue.city) venueFact += `, ${venue.city}`;
    if (venue.capacity) venueFact += ` — capacity ${venue.capacity.toLocaleString()} fans`;
    facts.push(`${venueFact}.`);
  }

  if (team.country) {
    facts.push(`Represents ${team.country} in official competitions.`);
  }

  if (isNationalTeam(team)) {
    facts.push('Egypt\'s senior national team — the Pharaohs.');
  } else {
    facts.push('Competes in the Egyptian Premier League and domestic cups.');
  }

  return facts;
}

function buildStandingsFacts(teamName) {
  if (teamName.toLowerCase() !== 'egypt') return [];

  const { groupName, egyptRow, teams } = getEgyptGroupTableData();
  if (!egyptRow) return [];

  return [
    `Egypt finished 2nd in ${groupName} at the FIFA World Cup ${STANDINGS_SEASON} with ${egyptRow.points} points — qualified for the Round of 32.`,
    `Final table: ${teams.map((t) => `${t.rank}. ${t.name} (${t.points} pts)`).join(', ')}.`,
    `Egypt record: ${egyptRow.gf} GF, ${egyptRow.ga} GA — ${egyptRow.win}W-${egyptRow.draw}D-${egyptRow.lose}L from ${egyptRow.played} played.`,
    `Belgium won the group on goal difference (+4 vs Egypt +2). Iran 3rd (3 pts), New Zealand 4th (1 pt).`,
    `Next: Egypt vs ${EGYPT_KNOCKOUT_PATH.nextOpponent} (${EGYPT_KNOCKOUT_PATH.nextRound}). Win and the Pharaohs play ${EGYPT_KNOCKOUT_PATH.winOpponent} in the ${EGYPT_KNOCKOUT_PATH.winRound}.`,
  ];
}

function buildFixturesFacts(teamName) {
  if (teamName.toLowerCase() !== 'egypt') return [];
  const facts = [];

  (egyptFixturesData?.next || []).slice(0, FIXTURES_NEXT_COUNT).forEach((fx) => {
    const home = fx.teams?.home?.name || 'TBD';
    const away = fx.teams?.away?.name || 'TBD';
    const date = formatFixtureDate(fx.fixture?.date);
    facts.push(`Upcoming: ${home} vs ${away} (${date}).`);
  });

  (egyptFixturesData?.last || []).slice(0, FIXTURES_LAST_COUNT).forEach((fx) => {
    const home = fx.teams?.home?.name || 'TBD';
    const away = fx.teams?.away?.name || 'TBD';
    const date = formatFixtureDate(fx.fixture?.date);
    const score = formatFixtureScore(fx);
    facts.push(`Recent: ${home} vs ${away}${score ? ` ${score}` : ''} (${date}).`);
  });

  return facts;
}

function buildGlobalStandingsFacts() {
  const { groupName, egyptRow, teams } = getEgyptGroupTableData();
  if (!egyptRow) return [];

  return [
    `Egypt finished 2nd in World Cup ${STANDINGS_SEASON} ${groupName} with ${egyptRow.points} points — Round of 32.`,
    `Egypt: ${egyptRow.gf} GF, ${egyptRow.ga} GA, ${egyptRow.win}W-${egyptRow.draw}D-${egyptRow.lose}L.`,
    `Final group: ${teams.map((t) => `${t.rank}. ${t.name}`).join(', ')}.`,
    `Knockout: Egypt vs ${EGYPT_KNOCKOUT_PATH.nextOpponent} next — beat them to face ${EGYPT_KNOCKOUT_PATH.winOpponent}.`,
  ];
}

async function buildSquadFactsAsync(squad, teamName) {
  const facts = buildSquadFacts(squad, teamName);
  if (squad.length > 8) {
    squad.slice(8, 16).forEach((player) => {
      const number = player.number ? `#${player.number} ` : '';
      facts.push(`${number}${player.name} (${player.position || 'Player'}).`);
    });
  }
  return facts;
}

async function loadAllFactsForTeam(team, venue, squad = []) {
  const curated = getCuratedFacts(team.name);
  const apiFacts = buildApiFacts(team, venue);
  const generic = curated.length === 0
    ? [`${team.name} is part of Egypt's rich football landscape.`]
    : [];
  const standingsFacts = buildStandingsFacts(team.name);
  const fixturesFacts = buildFixturesFacts(team.name);
  const squadFacts = await buildSquadFactsAsync(squad, team.name);
  const trophyFacts = await fetchTrophyFacts(team.id);

  return [...new Set([...curated, ...apiFacts, ...generic, ...standingsFacts, ...fixturesFacts, ...squadFacts, ...trophyFacts])];
}

function seedAllClubFactsFromCache() {
  teamsCache.forEach((item) => {
    const facts = loadAllFactsForTeamSync(item.team, item.venue);
    facts.forEach((fact) => {
      allClubFacts.push({ team: item.team.name, fact, logo: item.team.logo });
    });
  });
}

function loadAllFactsForTeamSync(team, venue, squad = []) {
  const curated = getCuratedFacts(team.name);
  const apiFacts = buildApiFacts(team, venue);
  const generic = curated.length === 0
    ? [`${team.name} is part of Egypt's rich football landscape.`]
    : [];
  const standingsFacts = buildStandingsFacts(team.name);
  const squadFacts = buildSquadFacts(squad, team.name);
  return [...new Set([...curated, ...apiFacts, ...generic, ...standingsFacts, ...squadFacts])];
}

function renderGroupGTableRows() {
  const teams = getSortedGroupTeams();
  const egyptLogo = getEgyptNationalTeam()?.logo || 'https://media.api-sports.io/football/teams/32.png';
  const hasForm = teams.some((t) => t.form);

  return teams.map((team) => {
    const logo = team.isEgypt ? (team.logo || egyptLogo) : (team.logo || team.flag);
    const qualClass = team.qualified ? 'standings-row-qualify' : team.eliminated ? 'standings-row-out' : '';
    const egyptClass = team.isEgypt ? 'standings-row-egypt' : '';
    const qualBadge = team.qualified
      ? '<span class="standings-qual-badge">Q</span>'
      : team.eliminated
        ? '<span class="standings-out-badge">OUT</span>'
        : team.rank <= 2
          ? '<span class="standings-qual-badge">R16</span>'
          : '';
    return `
      <tr class="${qualClass} ${egyptClass}">
        <td class="standings-rank">${team.rank}</td>
        <td class="standings-team">
          <img src="${logo}" alt="" class="standings-team-logo">
          <span>${escapeHtml(team.name)}${team.isEgypt ? ' 🇪🇬' : ''}</span>
          ${qualBadge}
        </td>
        <td>${team.played}</td>
        <td>${team.win}</td>
        <td>${team.draw}</td>
        <td>${team.lose}</td>
        <td>${team.gf}</td>
        <td>${team.ga}</td>
        <td>${team.gd > 0 ? '+' : ''}${team.gd}</td>
        ${hasForm ? `<td class="standings-form-cell">${renderGroupGFormDots(team.form)}</td>` : ''}
        <td class="standings-points">${team.points}</td>
      </tr>
    `;
  }).join('');
}

function renderEgyptPointsBanner() {
  const { egyptRow } = getEgyptGroupTableData();
  const egyptLogo = getEgyptNationalTeam()?.logo || 'https://media.api-sports.io/football/teams/32.png';
  if (!egyptRow) return '';

  return `
    <div class="egypt-points-banner">
      <img src="${egyptLogo}" alt="Egypt" class="egypt-points-logo">
      <div class="egypt-points-info">
        <span class="egypt-points-label">Egypt · Qualified</span>
        <span class="egypt-points-value">${egyptRow.points} <small>pts · 2nd</small></span>
      </div>
      <div class="egypt-points-stats">
        <div class="egypt-stat"><span class="egypt-stat-val">${egyptRow.rank}</span><span class="egypt-stat-lbl">Rank</span></div>
        <div class="egypt-stat"><span class="egypt-stat-val">${egyptRow.gf}-${egyptRow.ga}</span><span class="egypt-stat-lbl">GF-GA</span></div>
        <div class="egypt-stat"><span class="egypt-stat-val">${egyptRow.win}-${egyptRow.draw}-${egyptRow.lose}</span><span class="egypt-stat-lbl">W-D-L</span></div>
      </div>
    </div>
  `;
}

function renderGroupGResultsList() {
  const results = getGroupGMatchResults();
  const matchdays = [1, 2, 3];

  return matchdays.map((md) => {
    const mdResults = results.filter((m) => m.matchday === md);
    if (!mdResults.length) return '';
    return `
      <div class="group-g-matchday">
        <h5 class="group-g-matchday-label">Matchday ${md}</h5>
        <ul class="group-g-results-list">
          ${mdResults.map((m) => `
            <li class="group-g-result">
              <div class="group-g-result-match">
                <span>${escapeHtml(m.home)}</span>
                <strong>${m.score}</strong>
                <span>${escapeHtml(m.away)}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }).join('');
}

function renderGroupGTableMarkup(compact = false) {
  const teams = getSortedGroupTeams();
  const hasForm = teams.some((t) => t.form);

  return `
    ${compact ? '' : renderGroupGPointsChart()}
    ${renderEgyptPointsBanner()}
    <div class="standings-table-wrap">
      <table class="standings-table ${compact ? 'standings-table-compact' : ''}">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            ${hasForm ? '<th>Form</th>' : ''}
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>${renderGroupGTableRows()}</tbody>
      </table>
    </div>
    <div class="group-g-results">
      <h4 class="standings-group-label">Group G — all results</h4>
      ${renderGroupGResultsList()}
    </div>
  `;
}

function renderGroupGWorldCupTable() {
  const season = STANDINGS_SEASON;
  const { groupName } = getEgyptGroupTableData();

  return `
    <div class="standings-card standings-card-wc group-g-card">
      <div class="standings-header">
        <div>
          <h3 class="standings-title">🏆 World Cup ${season} — ${escapeHtml(groupName)}</h3>
          <p class="standings-subtitle">Final table — Belgium &amp; Egypt qualified · Iran &amp; New Zealand out</p>
        </div>
      </div>
      ${renderStandingsLiveBadge()}
      ${renderGroupGTableMarkup()}
      ${renderEgyptKnockoutBlock()}
    </div>
  `;
}

function renderStandingsSection() {
  standingsSection.innerHTML = renderGroupGWorldCupTable();
}

function renderClubPageContent(facts, squad, team) {
  const isEgypt = team.name.toLowerCase() === 'egypt';

  return `
    ${renderSquadSection(squad, team.name)}
    ${isEgypt ? `
      <section class="club-block">
        <h3 class="club-block-title">🏆 World Cup Group G</h3>
        <div class="standings-card group-g-card group-g-card-compact">
          ${renderStandingsLiveBadge()}
          ${renderGroupGTableMarkup(true)}
        </div>
      </section>
      <section class="club-block">
        <h3 class="club-block-title">Knockout path</h3>
        ${renderEgyptKnockoutBlock()}
      </section>
    ` : ''}
    <section class="club-block">
      <h3 class="club-block-title">⚡ Club Facts <span class="club-facts-count">${facts.length}</span></h3>
      <ul class="club-facts club-facts-page">
        ${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')}
      </ul>
    </section>
  `;
}

function openClubPage(team, venue) {
  const tagClass = isNationalTeam(team) ? 'tag-national' : 'tag-club';
  const tagLabel = isNationalTeam(team) ? 'NATIONAL TEAM' : 'CLUB';

  clubPageHeader.innerHTML = `
    <div class="club-page-hero">
      <div class="club-page-logo">
        <img src="${team.logo}" alt="${escapeHtml(team.name)}">
      </div>
      <div class="club-page-hero-info">
        <span class="fact-tag ${tagClass}">${tagLabel}</span>
        <h1 class="club-page-title">${escapeHtml(team.name)}</h1>
        ${venue?.name ? `<p class="club-page-meta">${escapeHtml(venue.name)}${venue.city ? ` · ${escapeHtml(venue.city)}` : ''}</p>` : ''}
        ${team.founded ? `<p class="club-page-meta">Founded ${team.founded}</p>` : ''}
      </div>
    </div>
  `;

  clubPageBody.innerHTML = `
    <div class="club-page-loading">
      <div class="loading-spinner"></div>
      <p>Loading squad, API data &amp; facts…</p>
    </div>
  `;

  homeView.hidden = true;
  clubPage.hidden = false;
  if (bottomNav) bottomNav.hidden = true;
  window.scrollTo({ top: 0, behavior: 'instant' });

  fetchTeamSquad(team.id)
    .then(async (squad) => {
      const facts = await loadAllFactsForTeam(team, venue, squad);
      facts.forEach((fact) => allClubFacts.push({ team: team.name, fact, logo: team.logo }));
      activeClubView = { team, venue, squad, facts };
      clubPageBody.innerHTML = renderClubPageContent(facts, squad, team);
    })
    .catch(async () => {
      const squad = [];
      const facts = await loadAllFactsForTeam(team, venue, squad);
      activeClubView = { team, venue, squad, facts };
      clubPageBody.innerHTML = renderClubPageContent(facts, squad, team);
    });
}

function closeClubPage() {
  activeClubView = null;
  clubPage.hidden = true;
  homeView.hidden = false;
  if (bottomNav) bottomNav.hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function focusClubSearch() {
  document.getElementById('teamsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => clubSearch.focus(), 400);
}

function updateSearchHint() {
  if (teamsCache.length === 0) {
    searchHint.textContent = 'No clubs loaded';
    return;
  }
  searchHint.textContent = `${teamsCache.length} clubs — type to search`;
}

function renderSearchResults(matches, query) {
  if (!query.trim()) {
    searchResults.innerHTML = '';
    searchResults.classList.remove('is-visible');
    updateSearchHint();
    return;
  }

  searchResults.classList.add('is-visible');
  searchHint.textContent = matches.length === 1 ? '1 club found' : `${matches.length} clubs found`;

  if (matches.length === 0) {
    searchResults.innerHTML = `<p class="search-empty">No clubs found for "<strong>${escapeHtml(query)}</strong>"</p>`;
    return;
  }

  searchResults.innerHTML = matches.map((item) => {
    const team = item.team;
    const tagClass = isNationalTeam(team) ? 'tag-national' : 'tag-club';
    const tagLabel = isNationalTeam(team) ? 'NATIONAL' : 'CLUB';
    return `
      <button type="button" class="search-result-item" data-team-id="${team.id}">
        <img src="${team.logo}" alt="" class="search-result-logo">
        <div class="search-result-info">
          <span class="search-result-name">${escapeHtml(team.name)}</span>
          ${item.venue?.city ? `<span class="search-result-meta">${escapeHtml(item.venue.city)}</span>` : ''}
        </div>
        <span class="fact-tag ${tagClass} search-result-tag">${tagLabel}</span>
        <svg class="search-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
    `;
  }).join('');

  searchResults.querySelectorAll('.search-result-item').forEach((btn) => {
    const id = Number(btn.dataset.teamId);
    const item = teamsCache.find((t) => t.team.id === id);
    if (item) {
      btn.addEventListener('click', () => openClubPage(item.team, item.venue));
    }
  });
}

function handleClubSearch() {
  const query = clubSearch.value;
  const q = query.trim().toLowerCase();

  if (!q) {
    renderSearchResults([], query);
    return;
  }

  const matches = teamsCache.filter((item) => {
    const name = item.team.name.toLowerCase();
    const city = item.venue?.city?.toLowerCase() || '';
    const code = item.team.code?.toLowerCase() || '';
    return name.includes(q) || city.includes(q) || code.includes(q);
  });

  renderSearchResults(matches, query);
}

function showTeamsError(message) {
  searchHint.textContent = 'Could not load clubs';
  searchResults.innerHTML = `
    <div class="api-error">
      <p>Could not load clubs. Check your connection and try again.</p>
      <p class="api-error-detail">${escapeHtml(message)}</p>
      <button class="btn btn-primary" id="retryTeamsBtn">Try Again</button>
    </div>
  `;
  searchResults.classList.add('is-visible');
  document.getElementById('retryTeamsBtn')?.addEventListener('click', loadEgyptTeams);
}

function showRandomClubFact() {
  if (allClubFacts.length === 0) return;

  const pick = allClubFacts[Math.floor(Math.random() * allClubFacts.length)];
  const html = `<strong>${escapeHtml(pick.team)}:</strong> ${escapeHtml(pick.fact)}`;

  dykText.style.opacity = '0';
  dykText.style.transform = 'translateY(6px)';

  setTimeout(() => {
    dykText.innerHTML = html;
    dykText.style.transition = 'opacity 0.3s, transform 0.3s';
    dykText.style.opacity = '1';
    dykText.style.transform = 'translateY(0)';
  }, 200);

  document.querySelector('.did-you-know').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadEgyptTeams() {
  allClubFacts = [];
  teamsCache = [];
  egyptSquadData = null;
  egyptFixturesData = null;
  standingsData = null;
  worldCupLeagueInfo = null;
  worldLeaguesData = null;
  lastStandingsError = null;
  standingsLastUpdated = null;
  lastEgyptStandingsSnapshot = null;
  stopStandingsAutoRefresh();
  activeClubView = null;
  apiStatus.textContent = 'Loading…';
  apiStatus.classList.remove('api-status-success', 'api-status-error');
  clubSearch.value = '';
  searchResults.innerHTML = '';
  searchResults.classList.remove('is-visible');
  searchHint.textContent = 'Loading clubs…';
  standingsSection.innerHTML = '<div class="standings-skeleton"></div>';

  try {
    const teamsResult = await fetchFromApi('/teams?country=Egypt');

    await fetchWorldLeagues().catch((err) => console.warn('World leagues:', err));
    syncWorldCupFromWorldLeagues();
    await fetchWorldCupLeague().catch((err) => console.warn('World Cup league:', err));

    const teams = teamsResult.response || [];

    if (teams.length === 0) {
      searchHint.textContent = 'No clubs found';
      renderStandingsSection();
      return;
    }

    teams.sort((a, b) => {
      const aNational = isNationalTeam(a.team) ? 0 : 1;
      const bNational = isNationalTeam(b.team) ? 0 : 1;
      if (aNational !== bNational) return aNational - bNational;
      return a.team.name.localeCompare(b.team.name);
    });

    teamsCache = teams;
    updateSearchHint();

    const egyptTeam = getEgyptNationalTeam();
    const leagueId = getRealLeagueId('World Cup');

    await fetchStandings(leagueId).catch((err) => console.error('Standings:', err));
    if (findEgyptWorldCupGroup()) markStandingsUpdated();

    await Promise.all([
      fetchEgyptFixtures(egyptTeam?.id).catch((err) => console.error('Fixtures:', err)),
      fetchEgyptSquad(egyptTeam?.id),
    ]);

    renderStandingsSection();
    startStandingsAutoRefresh();

    seedAllClubFactsFromCache();

    buildGlobalStandingsFacts().forEach((fact) => {
      allClubFacts.push({ team: 'Egypt', fact, logo: getEgyptNationalTeam()?.logo || '' });
    });

    if (egyptTeam) {
      buildStandingsFacts(egyptTeam.name).forEach((fact) => {
        allClubFacts.push({ team: egyptTeam.name, fact, logo: egyptTeam.logo });
      });
      buildFixturesFacts(egyptTeam.name).forEach((fact) => {
        allClubFacts.push({ team: egyptTeam.name, fact, logo: egyptTeam.logo });
      });
      buildSquadFacts(egyptSquadData?.players || [], egyptTeam.name).forEach((fact) => {
        allClubFacts.push({ team: egyptTeam.name, fact, logo: egyptTeam.logo });
      });
    }

    clubsStat.textContent = String(teams.length);
    factsStat.textContent = `${allClubFacts.length}+`;
    clubsCategoryCount.textContent = `${teams.length} Clubs`;

    const standingsLabel = standingsData ? ' · standings loaded' : '';
    apiStatus.textContent = `${teams.length} clubs — search to explore${standingsLabel}`;
    apiStatus.classList.add('api-status-success');

    if (allClubFacts.length > 0) {
      const first = allClubFacts[0];
      dykText.innerHTML = `<strong>${escapeHtml(first.team)}:</strong> ${escapeHtml(first.fact)}`;
    }
  } catch (error) {
    console.error('Error fetching teams:', error);
    clubsStat.textContent = '—';
    factsStat.textContent = '—';
    clubsCategoryCount.textContent = 'Unavailable';
    apiStatus.textContent = 'Error';
    apiStatus.classList.add('api-status-error');
    renderStandingsSection();
    showTeamsError(error.message);
  }
}

clubPageBack.addEventListener('click', closeClubPage);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !clubPage.hidden) closeClubPage();
});
clubSearch.addEventListener('input', handleClubSearch);
randomFactBtn.addEventListener('click', showRandomClubFact);
exploreFactsBtn.addEventListener('click', focusClubSearch);
clubsCategoryBtn.addEventListener('click', focusClubSearch);

document.querySelector('.did-you-know')?.addEventListener('click', showRandomClubFact);

loadEgyptTeams();
