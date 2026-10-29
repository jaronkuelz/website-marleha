// Inhalte kommen aus daten/inhalt.json (das Adminpanel speichert sie direkt ins GitHub-Repo)
const $ = (sel, wurzel = document) => wurzel.querySelector(sel);
const el = (tag, klasse, text) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};

// ---------- Linienblumen ----------
const vorlage = $("#blume-vorlage");
document.querySelectorAll("[data-blume]").forEach((platz, i) => {
  const svg = vorlage.content.firstElementChild.cloneNode(true);
  svg.querySelector("linearGradient").id = "linie-" + i;
  svg.querySelector("g").setAttribute("stroke", "url(#linie-" + i + ")");
  platz.replaceWith(svg);
});
const beobachter = new IntersectionObserver((eintraege) => eintraege.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("sichtbar"); beobachter.unobserve(e.target); }
}), { threshold: 0.2 });
document.querySelectorAll(".blume").forEach((b) => beobachter.observe(b));

$("#jahr").textContent = new Date().getFullYear();

// ---------- Bild oder Platzhalter (immer das ganze Bild, nie beschnitten) ----------
const bildAdresse = (bild) => bild && bild.pfad;

function bildFuer(werk) {
  if (werk.bild) {
    const img = el("img", "bild");
    img.src = bildAdresse(werk.bild);
    img.alt = werk.titel;
    img.width = werk.bild.breite;
    img.height = werk.bild.hoehe;
    img.loading = "lazy";
    return img;
  }
  const platz = el("div", "bild");
  const p = werk.platzhalter || {};
  const [a, b] = p.farbe || ["#F2E3CB", "#D9BF9C"];
  platz.style.background = `linear-gradient(160deg, ${a}, ${b})`;
  platz.style.aspectRatio = p.format || "4 / 5";
  platz.setAttribute("role", "img");
  platz.setAttribute("aria-label", werk.titel);
  return platz;
}

const datum = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
function lesezeit(text) {
  const woerter = TextFormat.alsKlartext(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(woerter / 200));
}
function anriss(text) {
  const klar = TextFormat.alsKlartext(text).replace(/\s+/g, " ").trim();
  return klar.length > 180 ? klar.slice(0, 180).replace(/\s+\S*$/, "") + " …" : klar;
}

// ---------- Großansicht ----------
const gross = $("#gross");
const grossInhalt = $(".gross-inhalt", gross);
$(".schliessen", gross).addEventListener("click", () => gross.close());
gross.addEventListener("click", (e) => { if (e.target === gross) gross.close(); });

function zeigeWerk(werk, gruppenName) {
  const box = el("div", "werk-gross");
  box.append(bildFuer(werk));
  const angaben = el("div", "angaben");
  if (gruppenName) angaben.append(el("p", "etikett", gruppenName));
  angaben.append(el("h3", "", werk.titel));
  if (werk.text) angaben.append(el("p", "", werk.text));
  box.append(angaben);
  grossInhalt.replaceChildren(box);
  gross.showModal();
}

function zeigeText(text) {
  const box = el("article", "text-gross");
  box.append(el("p", "etikett", datum(text.datum) + " · " + lesezeit(text.inhalt) + " Min. Lesezeit"), el("h3", "", text.titel));
  const koerper = el("div", "text-koerper");
  koerper.innerHTML = TextFormat.alsHtml(text.inhalt); // TextFormat schützt vor HTML im Text
  box.append(koerper, el("p", "ende schwung tief", "Marleha"));
  grossInhalt.replaceChildren(box);
  gross.showModal();
  box.scrollTop = 0;
}

// ---------- Reiter: Alle · Gruppen · Einzelne ----------
// art: { feld, gruppen, eintraege, panel, alleName, ohneName, karte }
function baueBereich(art) {
  const panel = $(art.panel);
  const reiter = $(".reiter", panel);
  const kopf = $(".galerie-kopf", panel);
  const liste = $(art.liste, panel);

  const reiterListe = [{ id: "alle", name: "Alle", titel: art.alleName, beschreibung: "", eintraege: art.eintraege }];
  art.gruppen.forEach((g) => {
    const drin = art.eintraege.filter((e) => e[art.feld] === g.id);
    if (drin.length) reiterListe.push({ id: g.id, name: g.name, titel: g.name, beschreibung: g.beschreibung, eintraege: drin });
  });
  const ohne = art.eintraege.filter((e) => e[art.feld] === null);
  if (ohne.length) reiterListe.push({ id: "ohne", name: art.ohneName, titel: art.ohneName, beschreibung: "", eintraege: ohne });

  const name = (e) => (art.gruppen.find((g) => g.id === e[art.feld]) || {}).name || "";

  function zeige(id) {
    const r = reiterListe.find((x) => x.id === id) || reiterListe[0];
    reiter.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === r.id));
    $("h3", kopf).textContent = r.titel;
    $(".beschreibung", kopf).textContent = r.beschreibung;
    if (!r.eintraege.length) { liste.replaceChildren(el("li", "leer", "Hier kommt bald etwas.")); return; }
    liste.replaceChildren(...r.eintraege.map((e) => art.karte(e, name(e))));
    liste.classList.remove("erscheint"); void liste.offsetWidth; liste.classList.add("erscheint");
  }

  reiter.replaceChildren(...reiterListe.map((r) => {
    const b = el("button", "", r.name);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.id = r.id;
    b.addEventListener("click", () => zeige(r.id));
    return b;
  }));
  reiter.hidden = reiterListe.length < 2;
  zeige("alle");
}

function werkKarte(werk, gruppenName) {
  const li = el("li", "werk");
  const knopf = el("button");
  knopf.type = "button";
  knopf.append(bildFuer(werk), el("h4", "", werk.titel));
  if (werk.text) knopf.append(el("p", "", werk.text));
  knopf.addEventListener("click", () => zeigeWerk(werk, gruppenName));
  li.append(knopf);
  return li;
}

function textKarte(text) {
  const li = el("li", "text-karte");
  const knopf = el("button");
  knopf.type = "button";
  knopf.append(
    el("span", "etikett", datum(text.datum) + " · " + lesezeit(text.inhalt) + " Min."),
    el("h3", "", text.titel),
    el("p", "", anriss(text.inhalt)),
    el("span", "lesen", "Weiterlesen →")
  );
  knopf.addEventListener("click", () => zeigeText(text));
  li.append(knopf);
  return li;
}

// ---------- Umschalter Kunstwerke | Texte ----------
function waehle(bereich) {
  ["kunstwerke", "texte"].forEach((b) => {
    const aktiv = b === bereich;
    $("#tab-" + b).setAttribute("aria-selected", aktiv);
    const feld = $("#" + b);
    feld.hidden = !aktiv;
    if (aktiv) { feld.classList.remove("erscheint"); void feld.offsetWidth; feld.classList.add("erscheint"); }
  });
}
$("#tab-kunstwerke").addEventListener("click", () => waehle("kunstwerke"));
$("#tab-texte").addEventListener("click", () => waehle("texte"));

// Menülinks „Kunstwerke“ / „Texte“ schalten um und springen zur Auswahl
function folgeAdresse() {
  const ziel = location.hash.slice(1);
  if (ziel === "kunstwerke" || ziel === "texte") {
    waehle(ziel);
    $(".auswahl").scrollIntoView();
  }
}
window.addEventListener("hashchange", folgeAdresse);

// no-cache: Browser fragt nach, ob es eine neuere Fassung gibt (GitHub Pages speichert sonst 10 Min. zwischen)
fetch("daten/inhalt.json", { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((c) => {

    const sb = $("#startbild");
    if (bildAdresse(c.startbild) !== sb.getAttribute("src")) {
      sb.src = bildAdresse(c.startbild);
      sb.width = c.startbild.breite;
      sb.height = c.startbild.hoehe;
    }
    sb.alt = c.startbild.alt || "Marleha";

    $(".ueber-text").innerHTML = TextFormat.alsHtml(c.ueber);

    baueBereich({ panel: "#kunstwerke", liste: ".werke", feld: "galerie", gruppen: c.galerien, eintraege: c.werke,
      alleName: "Alle Werke", ohneName: "Einzelwerke", karte: werkKarte });
    baueBereich({ panel: "#texte", liste: ".texte", feld: "sammlung", gruppen: c.sammlungen, eintraege: c.texte,
      alleName: "Alle Texte", ohneName: "Einzeltexte", karte: textKarte });
    folgeAdresse();
  })
  .catch(() => {
    $(".werke").replaceChildren(el("li", "leer", "Die Werke konnten gerade nicht geladen werden."));
  });
