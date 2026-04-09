const view = document.getElementById("view");
const tabs = document.getElementById("tabs");
const search = document.getElementById("search");

let route = "grade-9";
let theatres = [];
let works = [];
let recommendations = {};

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function safeHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
        return "";
    }
}

async function loadData() {
    const [theatresRes, worksRes, recRes] = await Promise.all([
        fetch("data/theatres.json"),
        fetch("data/works.json"),
        fetch("data/recommendations.json"),
    ]);

    const [t, w, recs] = await Promise.all([
        theatresRes.json(),
        worksRes.json(),
        recRes.json(),
    ]);

    // ✅ ВАЖНО: сохраняем в глобальные переменные
    theatres = t;
    works = w;
    recommendations = recs || {};
}

function theatreById(id) {
    return theatres.find((t) => t.id === id);
}

function setActiveTab() {
    [...tabs.querySelectorAll(".tab")].forEach((b) => b.classList.remove("is-active"));
    const btn = tabs.querySelector(`.tab[data-route="${route}"]`);
    if (btn) btn.classList.add("is-active");
}

function renderWorkIntro(workId) {
    const rec = recommendations?.[workId];
    if (!rec?.intro) return "";
    return `
    <div class="work-intro">
      ${escapeHtml(rec.intro).replace(/\n/g, "<br>")}
    </div>
  `;
}

function renderTheatreRecommendation(workId, theatreId) {
    const rec = recommendations?.[workId]?.theatres?.[theatreId];
    if (!rec) return "";

    const shortText = rec.short ? escapeHtml(rec.short).replace(/\n/g, "<br>") : "";
    const fullText = rec.full ? escapeHtml(rec.full).replace(/\n/g, "<br>") : "";

    if (!shortText && !fullText) return "";

    // full нет -> просто покажем short
    if (!fullText) {
        return `
      <div class="rec-block">
        <div class="rec-title">Рекомендации</div>
        <div class="rec-short">${shortText}</div>
      </div>
    `;
    }

    return `
    <div class="rec-block">
      <div class="rec-title">Рекомендации</div>
      ${shortText ? `<div class="rec-short">${shortText}</div>` : ""}
      <details class="rec-details">
        <summary>Развернуть рекомендации</summary>
        <div class="rec-full">${fullText}</div>
      </details>
    </div>
  `;
}

function renderWorksList() {
    const q = search.value.trim().toLowerCase();
    const filtered = works
        .filter((w) => w.category === route)
        .filter((w) => {
            if (!q) return true;
            return (w.title + " " + w.author).toLowerCase().includes(q);
        });

    if (filtered.length === 0) {
        view.innerHTML = `
      <div class="card">
        <div class="card__title">Ничего не найдено</div>
        <div class="card__meta">Попробуй изменить запрос поиска или выбери другую вкладку.</div>
      </div>
    `;
        return;
    }

    view.innerHTML = filtered
        .map(
            (w) => `
      <div class="card">
        <div class="card__title">${escapeHtml(w.title)}</div>
        <div class="card__meta">${escapeHtml(w.author)}</div>
        <div style="margin-top:12px">
          <button class="tab" data-open-work="${escapeHtml(w.id)}">Открыть</button>
        </div>
      </div>
    `
        )
        .join("");
}

function renderTheatresList() {
    const q = search.value.trim().toLowerCase();

    const filtered = theatres.filter((t) => {
        if (!q) return true;
        const hay = `${t.name || ""} ${t.about || ""} ${t.details || ""}`.toLowerCase();
        return hay.includes(q);
    });

    if (filtered.length === 0) {
        view.innerHTML = `
      <div class="card">
        <div class="card__title">Ничего не найдено</div>
        <div class="card__meta">Попробуй изменить запрос поиска.</div>
      </div>
    `;
        return;
    }

    view.innerHTML = filtered
        .map(
            (t) => `
      <div class="card" id="theatre-${escapeHtml(t.id)}">
        <div class="card__title">${escapeHtml(t.name)}</div>
        <div class="card__meta">${escapeHtml(t.about || "")}</div>

        <details class="details">
          <summary class="details__summary">Подробнее о театре</summary>
          <div class="details__body">
            ${escapeHtml(t.details || "Пока нет расширенного описания.")}
          </div>
        </details>

        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          ${t.site ? `<a class="tab" href="${escapeHtml(t.site)}" target="_blank" rel="noreferrer">Сайт театра</a>` : ""}
        </div>
      </div>
    `
        )
        .join("");
}

function renderWorkDetails(workId) {
    const w = works.find((x) => x.id === workId);
    if (!w) {
        view.innerHTML = `
      <div class="card">
        <div class="card__title">Произведение не найдено</div>
      </div>
    `;
        return;
    }

    // ✅ 1 театр = 1 ссылка. Приоритет: ссылка на официальном домене театра (theatres.json -> site)
    const uniqProductions = (() => {
        const bestByTheatre = new Map();

        for (const p of w.productions || []) {
            const tid = p.theatreId || "";
            if (!tid) continue;

            const t = theatreById(tid);

            const officialHost = t?.site ? safeHost(t.site) : "";
            const linkHost = p.performanceUrl ? safeHost(p.performanceUrl) : "";

            const isOfficialLink = officialHost && linkHost === officialHost;

            const cur = bestByTheatre.get(tid);
            if (!cur) {
                bestByTheatre.set(tid, { p, isOfficialLink });
                continue;
            }

            // официальный линк > неофициальный
            if (!cur.isOfficialLink && isOfficialLink) {
                bestByTheatre.set(tid, { p, isOfficialLink });
            }
        }

        return Array.from(bestByTheatre.values()).map((x) => x.p);
    })();

    const rows = uniqProductions
        .map((p) => {
            const t = theatreById(p.theatreId);
            const theatreName = t ? t.name : p.theatreId;

            return `
        <div class="card" style="margin-top:10px">
          <div class="card__title">${escapeHtml(theatreName)}</div>

          <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <a class="tab" href="${escapeHtml(p.performanceUrl)}" target="_blank" rel="noreferrer">Открыть спектакль</a>
            <button class="tab" data-open-theatre="${escapeHtml(p.theatreId)}">Инфо о театре</button>
          </div>

          ${renderTheatreRecommendation(w.id, p.theatreId)}
        </div>
      `;
        })
        .join("");

    view.innerHTML = `
    <div class="card">
      <div class="card__title">${escapeHtml(w.title)}</div>
      <div class="card__meta">${escapeHtml(w.author)}</div>
      ${renderWorkIntro(w.id)}
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="tab" data-back>← Назад</button>
      </div>
    </div>

    ${rows || `
      <div class="card">
        <div class="card__title">Пока нет постановок</div>
        <div class="card__meta">Добавим театры и ссылки позже.</div>
      </div>
    `}
  `;
}

function renderRoute() {
    setActiveTab();

    if (route === "theatres") {
        renderTheatresList();
        return;
    }

    renderWorksList();
}

tabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-route]");
    if (!btn) return;
    route = btn.dataset.route;
    renderRoute();
});

search.addEventListener("input", () => {
    if (route === "theatres") renderTheatresList();
    else renderWorksList();
});

view.addEventListener("click", (e) => {
    const openWork = e.target.closest("[data-open-work]");
    if (openWork) {
        const id = openWork.dataset.openWork;
        renderWorkDetails(id);
        return;
    }

    const back = e.target.closest("[data-back]");
    if (back) {
        renderRoute();
        return;
    }

    const openTheatre = e.target.closest("[data-open-theatre]");
    if (openTheatre) {
        const theatreId = openTheatre.dataset.openTheatre;
        route = "theatres";
        renderRoute();

        setTimeout(() => {
            const el = document.getElementById(`theatre-${theatreId}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
    }
});

document.addEventListener("click", (e) => {
    const heroBtn = e.target.closest("[data-hero-route]");
    if (!heroBtn) return;

    route = heroBtn.dataset.heroRoute;
    renderRoute();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});

(async function init() {
    view.innerHTML = `
    <div class="card">
      <div class="card__title">Загрузка данных…</div>
      <div class="card__meta">Секунду.</div>
    </div>
  `;

    try {
        await loadData();
        renderRoute();
    } catch (err) {
        console.error(err);
        view.innerHTML = `
      <div class="card">
        <div class="card__title">Ошибка загрузки данных</div>
        <div class="card__meta">Проверь, что сервер запущен через <b>npx serve .</b> и файлы JSON валидные.</div>
      </div>
    `;
    }
})();