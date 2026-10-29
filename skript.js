// Inhalte kommen aus inhalt.json (später pflegt Marleha sie über ein Adminpanel)
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

// ---------- Bild oder Platzhalter ----------
function bildFuer(werk) {
  if (werk.bild) {
    const img = el("img", "bild");
    img.src = werk.bild;
    img.alt = werk.titel;
    img.loading = "lazy";
    return img;
  }
  const platz = el("div", "bild");
  const [a, b] = werk.farbe || ["#F2E3CB", "#D9BF9C"];
  platz.style.background = `linear-gradient(160deg, ${a}, ${b})`;
  platz.style.aspectRatio = werk.format || "4 / 5"; // Platzhalter im Format des späteren Bildes
  platz.setAttribute("role", "img");
  platz.setAttribute("aria-label", werk.titel);
  return platz;
}

// ---------- Großansicht ----------
const gross = $("#gross");
const grossInhalt = $(".gross-inhalt", gross);
$(".schliessen", gross).addEventListener("click", () => gross.close());
gross.addEventListener("click", (e) => { if (e.target === gross) gross.close(); });

function zeigeWerk(werk, galerie) {
  const box = el("div", "werk-gross");
  box.append(bildFuer(werk));
  const angaben = el("div", "angaben");
  angaben.append(el("p", "etikett", galerie.name + " · " + galerie.art), el("h3", "", werk.titel));
  if (werk.text) angaben.append(el("p", "", werk.text));
  box.append(angaben);
  grossInhalt.replaceChildren(box);
  gross.showModal();
}

function zeigeText(text) {
  const box = el("article", "text-gross");
  box.append(el("p", "etikett", datum(text.datum) + " · " + text.minuten + " Min. Lesezeit"), el("h3", "", text.titel));
  text.absaetze.forEach((a) => box.append(el("p", "", a)));
  box.append(el("p", "ende schwung tief", "Marleha"));
  grossInhalt.replaceChildren(box);
  gross.showModal();
  box.scrollTop = 0;
}

const datum = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

// ---------- Kunstwerke ----------
let inhalt;

function zeigeGalerie(id) {
  const galerie = inhalt.galerien.find((g) => g.id === id) || inhalt.galerien[0];
  document.querySelectorAll(".reiter button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === galerie.id));
  $(".galerie-kopf h3").textContent = galerie.name;
  const liste = $(".werke");
  liste.replaceChildren(...galerie.werke.map((werk) => {
    const li = el("li", "werk");
    const knopf = el("button");
    knopf.type = "button";
    knopf.append(bildFuer(werk), el("h4", "", werk.titel));
    if (werk.text) knopf.append(el("p", "", werk.text));
    knopf.addEventListener("click", () => zeigeWerk(werk, galerie));
    li.append(knopf);
    return li;
  }));
  liste.classList.remove("erscheint"); void liste.offsetWidth; liste.classList.add("erscheint");
}

function baueKunstwerke() {
  const reiter = $(".reiter");
  inhalt.galerien.forEach((g) => {
    const b = el("button", "", g.name);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.dataset.id = g.id;
    b.append(el("small", "", g.art));
    b.addEventListener("click", () => zeigeGalerie(g.id));
    reiter.append(b);
  });
  zeigeGalerie(inhalt.galerien[0].id);
}

// ---------- Texte ----------
function baueTexte() {
  $(".texte").replaceChildren(...inhalt.texte.map((text) => {
    const li = el("li", "text-karte");
    const knopf = el("button");
    knopf.type = "button";
    knopf.append(
      el("span", "etikett", datum(text.datum) + " · " + text.minuten + " Min."),
      el("h3", "", text.titel),
      el("p", "", text.anriss),
      el("span", "lesen", "Weiterlesen →")
    );
    knopf.addEventListener("click", () => zeigeText(text));
    li.append(knopf);
    return li;
  }));
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

fetch("inhalt.json")
  .then((r) => r.json())
  .then((daten) => {
    inhalt = daten;
    baueKunstwerke();
    baueTexte();
    folgeAdresse();
  })
  .catch(() => {
    $(".werke").replaceChildren(el("li", "", "Die Werke konnten gerade nicht geladen werden."));
  });
