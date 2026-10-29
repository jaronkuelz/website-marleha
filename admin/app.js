// Adminpanel für Marlehas Website. Ohne Framework und Build-Schritt:
// läuft direkt im Browser. Gespeichert wird direkt ins GitHub-Repo (siehe speicher.js).
(function () {
  "use strict";

  // ------------------------------------------------------------------ Helfer
  function h(tag, attrs) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      el.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }
  const app = document.getElementById("app");
  const heute = () => new Date().toISOString().slice(0, 10);

  function neueId(text) {
    const basis = String(text || "eintrag").toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "eintrag";
    const zufall = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
    return basis + "-" + zufall;
  }
  // Neu gewählte Bilder warten im Browser, bis gespeichert wird
  let neueBilder = {}; // pfad → Blob
  const vorschauen = {}; // pfad → lokale Vorschau-Adresse
  function bildAdresse(bild) {
    if (!bild) return null;
    return vorschauen[bild.pfad] || Speicher.bildAdresse(bild.pfad);
  }

  // ------------------------------------------------------------------ Foto verkleinern (im Browser)
  // Lange Seite höchstens 2400 px. Über das Neuzeichnen fallen auch alle
  // Metadaten weg (z. B. der Aufnahmeort).
  function verkleinern(datei) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp)$/.test(datei.type)) {
        reject(new Error("„" + datei.name + "“ ist kein JPG-, PNG- oder WebP-Bild.")); return;
      }
      const url = URL.createObjectURL(datei);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * s));
        c.height = Math.max(1, Math.round(img.naturalHeight * s));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => b ? resolve({ blob: b, breite: c.width, hoehe: c.height })
          : reject(new Error("„" + datei.name + "“ konnte nicht verarbeitet werden.")), "image/jpeg", 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("„" + datei.name + "“ konnte nicht gelesen werden.")); };
      img.src = url;
    });
  }
  // Bild vorbereiten; hochgeladen wird es erst beim Speichern (zusammen mit allem anderen)
  async function bildVorbereiten(datei, pfad) {
    const { blob, breite, hoehe } = await verkleinern(datei);
    neueBilder[pfad] = blob;
    vorschauen[pfad] = URL.createObjectURL(blob);
    return { pfad, breite, hoehe };
  }
  function dateiWaehlen(mehrere) {
    return new Promise((resolve) => {
      const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: mehrere || false });
      input.addEventListener("change", () => resolve(Array.from(input.files || [])));
      input.click();
    });
  }

  // ------------------------------------------------------------------ Anmeldung
  function start() {
    Speicher.fortsetzen()
      .then((weiter) => weiter ? ladeInhalt() : Speicher.zugang().then((z) => anmeldung(!z)))
      .catch((err) => { app.replaceChildren(h("div", { class: "mitte" }, h("div", { class: "meldung fehler", text: err.message }))); });
  }

  function anmeldung(einrichten) {
    const fehler = h("div", { class: "meldung fehler", hidden: true });
    const schluessel = h("input", { type: "password", id: "schluessel", autocomplete: "off" });
    const pw = h("input", { type: "password", id: "pw", autocomplete: einrichten ? "new-password" : "current-password" });
    const pw2 = h("input", { type: "password", id: "pw2", autocomplete: "new-password" });
    const knopf = h("button", { class: "knopf haupt voll", type: "submit", text: einrichten ? "Einrichten" : "Anmelden" });
    const form = h("form", {
      onsubmit(e) {
        e.preventDefault();
        knopf.disabled = true; fehler.hidden = true;
        knopf.textContent = einrichten ? "Wird eingerichtet …" : "Wird geprüft …";
        (einrichten ? Speicher.einrichten(schluessel.value, pw.value, pw2.value) : Speicher.anmelden(pw.value))
          .then(ladeInhalt)
          .catch((err) => {
            knopf.disabled = false; knopf.textContent = einrichten ? "Einrichten" : "Anmelden";
            fehler.textContent = err.message; fehler.hidden = false;
          });
      },
    },
      fehler,
      einrichten && h("div", { class: "feld" }, h("label", { for: "schluessel", text: "GitHub-Schlüssel" }), schluessel,
        h("p", { class: "hilfe", text: "Fein abgestufter Token nur für das Repo website-marleha, Recht „Contents: Read and write“. Wird verschlüsselt gespeichert." })),
      h("div", { class: "feld" }, h("label", { for: "pw", text: einrichten ? "Passwort für Marleha (mindestens 12 Zeichen)" : "Passwort" }), pw),
      einrichten && h("div", { class: "feld" }, h("label", { for: "pw2", text: "Passwort wiederholen" }), pw2),
      knopf);
    app.replaceChildren(h("div", { class: "mitte" }, h("div", { class: "karte" },
      h("div", { class: "zeichen", text: "Marleha" }),
      h("p", { class: "lead", text: einrichten
        ? "Einmalige Einrichtung: GitHub-Schlüssel eintragen und ein Passwort festlegen."
        : "Website bearbeiten – bitte anmelden." }),
      form)));
    (einrichten ? schluessel : pw).focus();
  }

  // ------------------------------------------------------------------ Zustand
  let inhalt = null;
  let ungespeichert = false;
  let bereich = "werke";
  const auswahl = { werke: "alle", texte: "alle" }; // "alle" | "ohne" | Gruppen-ID
  let offenerText = null;
  let meldungText = null;

  const ART = {
    werke: { gruppen: "galerien", feld: "galerie", gruppe: "Galerie", gruppenPlural: "Galerien", ohne: "Ohne Galerie", eintraege: "werke" },
    texte: { gruppen: "sammlungen", feld: "sammlung", gruppe: "Sammlung", gruppenPlural: "Sammlungen", ohne: "Ohne Sammlung", eintraege: "texte" },
  };

  function geaendert() { ungespeichert = true; zeigeStatus(); }
  window.addEventListener("beforeunload", (e) => { if (ungespeichert) { e.preventDefault(); e.returnValue = ""; } });

  function ladeInhalt() {
    return Speicher.ladeInhalt().then((c) => {
      inhalt = c;
      neueBilder = {};
      ungespeichert = false;
      oberflaeche();
    }).catch((err) => {
      Speicher.abmelden();
      anmeldung(false);
      const f = app.querySelector(".meldung.fehler");
      f.textContent = err.message; f.hidden = false;
    });
  }

  // ------------------------------------------------------------------ Grundgerüst
  let statusEl, speichernKnopf, hauptEl, meldungEl;

  function oberflaeche() {
    statusEl = h("span", { class: "status" });
    speichernKnopf = h("button", { class: "knopf haupt", type: "button", text: "Speichern & veröffentlichen", onclick: speichern });
    meldungEl = h("div");
    hauptEl = h("main");
    const reiter = [
      ["werke", "Kunstwerke"], ["texte", "Texte"], ["start", "Startbild & Über mich"], ["konto", "Passwort"],
    ].map(([id, name]) => h("button", { type: "button", role: "tab", "aria-selected": String(bereich === id),
      text: name, onclick() { bereich = id; meldungText = null; oberflaeche(); } }));
    app.replaceChildren(
      h("header", { class: "kopf" },
        h("span", { class: "zeichen", text: "Marleha" }),
        statusEl,
        h("a", { class: "knopf klein", href: "../", target: "_blank", rel: "noopener", text: "Website ansehen" }),
        speichernKnopf,
        h("button", { class: "knopf klein", type: "button", text: "Abmelden", onclick: abmelden })),
      h("nav", { class: "bereiche", role: "tablist" }, ...reiter),
      hauptEl);
    zeichne();
    zeigeStatus();
  }

  function zeigeStatus() {
    if (!statusEl) return;
    statusEl.textContent = ungespeichert ? "Ungespeicherte Änderungen" : "Alles gespeichert";
    statusEl.className = "status" + (ungespeichert ? " offen" : "");
    speichernKnopf.disabled = !ungespeichert;
  }

  function meldung(text, art) { meldungText = { text, art: art || "ok" }; zeigeMeldung(); }
  function zeigeMeldung() {
    meldungEl.replaceChildren(meldungText ? h("div", { class: "meldung " + meldungText.art, text: meldungText.text }) : "");
  }

  function zeichne() {
    const scrollY = window.scrollY;
    hauptEl.replaceChildren(meldungEl);
    zeigeMeldung();
    if (bereich === "werke" || bereich === "texte") zeichneListe(bereich);
    else if (bereich === "start") zeichneStart();
    else zeichneKonto();
    window.scrollTo(0, scrollY);
  }

  function pruefe() {
    for (const w of inhalt.werke) if (!w.titel.trim()) return "Jedes Bild braucht einen Titel.";
    for (const t of inhalt.texte) if (!t.titel.trim()) return "Jeder Text braucht einen Titel.";
    for (const g of inhalt.galerien.concat(inhalt.sammlungen)) if (!g.name.trim()) return "Jede Galerie und Sammlung braucht einen Namen.";
    return null;
  }

  function speichern() {
    const problem = pruefe();
    if (problem) { meldung(problem, "fehler"); return; }
    speichernKnopf.disabled = true;
    statusEl.textContent = "Wird gespeichert …";
    Speicher.speichern(inhalt, neueBilder).then(() => {
      neueBilder = {};
      ungespeichert = false;
      meldung("Gespeichert. In etwa einer Minute ist alles auf der Website zu sehen.");
      zeigeStatus();
    }).catch((err) => { meldung(err.message, "fehler"); zeigeStatus(); });
  }

  function abmelden() {
    if (ungespeichert && !confirm("Es gibt ungespeicherte Änderungen. Trotzdem abmelden?")) return;
    Speicher.abmelden();
    ungespeichert = false;
    anmeldung(false);
  }

  // ------------------------------------------------------------------ Kunstwerke / Texte
  function zeichneListe(art) {
    const a = ART[art];
    const gruppen = inhalt[a.gruppen];
    const alle = inhalt[a.eintraege];
    let gewaehlt = auswahl[art];
    if (gewaehlt !== "alle" && gewaehlt !== "ohne" && !gruppen.some((g) => g.id === gewaehlt)) gewaehlt = auswahl[art] = "alle";

    hauptEl.append(h("p", { class: "einleitung", text: art === "werke"
      ? "Wähle oben eine Galerie. Neue Bilder landen in der gewählten Galerie. Unter „Ohne Galerie“ liegen Einzelwerke."
      : "Wähle oben eine Sammlung. Neue Texte landen in der gewählten Sammlung. Neue Texte sind zuerst verborgen, bis du „Auf der Website zeigen“ anhakst." }));

    // Gruppen-Leiste
    const zahl = (fn) => alle.filter(fn).length;
    const chip = (id, name, n, extra) => h("button", { type: "button", "aria-pressed": String(gewaehlt === id), class: extra || "",
      onclick() { auswahl[art] = id; offenerText = null; zeichne(); } }, name, h("span", { class: "zahl", text: "(" + n + ")" }));
    hauptEl.append(h("div", { class: "gruppen" },
      chip("alle", "Alle", alle.length),
      ...gruppen.map((g) => chip(g.id, g.name, zahl((e) => e[a.feld] === g.id), g.sichtbar ? "" : "verborgen")),
      chip("ohne", a.ohne, zahl((e) => e[a.feld] === null)),
      h("button", { type: "button", class: "neu", text: "+ Neue " + a.gruppe, onclick() {
        const name = prompt("Name der neuen " + a.gruppe + ":");
        if (!name || !name.trim()) return;
        const g = { id: neueId(name), name: name.trim(), beschreibung: "", sichtbar: true };
        gruppen.push(g);
        auswahl[art] = g.id;
        geaendert(); zeichne();
      } })));

    // Einstellungen der gewählten Gruppe
    const gruppe = gruppen.find((g) => g.id === gewaehlt);
    if (gruppe) hauptEl.append(gruppenKasten(art, gruppe));

    // Werkzeuge
    const zielGruppe = gruppe ? gruppe.id : null;
    const fortschritt = h("span", { class: "fortschritt" });
    if (art === "werke") {
      hauptEl.append(h("div", { class: "werkzeug" },
        h("button", { class: "knopf haupt", type: "button", text: "+ Bilder hinzufügen", async onclick(e) {
          const dateien = await dateiWaehlen(true);
          if (!dateien.length) return;
          const knopf = e.target; knopf.disabled = true;
          const fehler = [];
          for (let i = 0; i < dateien.length; i++) {
            fortschritt.textContent = "Bild " + (i + 1) + " von " + dateien.length + " wird vorbereitet …";
            try {
              const titel = dateien[i].name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Ohne Titel";
              const id = neueId(titel);
              const bild = await bildVorbereiten(dateien[i], "bilder/werke/" + id + ".jpg");
              inhalt.werke.push({ id, titel, text: "", galerie: zielGruppe, bild, sichtbar: true });
              geaendert();
            } catch (err) { fehler.push(err.message); }
          }
          knopf.disabled = false;
          if (fehler.length) meldung(fehler.join(" "), "fehler");
          else meldung(dateien.length + (dateien.length === 1 ? " Bild" : " Bilder") + " hinzugefügt. Titel anpassen und dann „Speichern & veröffentlichen“.", "info");
          zeichne();
        } }),
        fortschritt,
        h("span", { class: "hilfe", text: gruppe ? "→ landen in „" + gruppe.name + "“" : "→ landen unter „Ohne Galerie“" })));
    } else {
      hauptEl.append(h("div", { class: "werkzeug" },
        h("button", { class: "knopf haupt", type: "button", text: "+ Neuer Text", onclick() {
          const t = { id: neueId("text"), titel: "Neuer Text", datum: heute(), sammlung: zielGruppe, inhalt: "", sichtbar: false };
          inhalt.texte.unshift(t);
          offenerText = t.id;
          geaendert(); zeichne();
        } }),
        h("span", { class: "hilfe", text: gruppe ? "→ landet in „" + gruppe.name + "“" : "→ landet unter „Ohne Sammlung“" })));
    }

    // Einträge
    const sichtbare = alle.filter((e) => gewaehlt === "alle" || (gewaehlt === "ohne" ? e[a.feld] === null : e[a.feld] === gewaehlt));
    if (!sichtbare.length) {
      hauptEl.append(h("div", { class: "leer-hinweis", text: art === "werke" ? "Hier sind noch keine Bilder." : "Hier sind noch keine Texte." }));
      return;
    }
    hauptEl.append(h("div", { class: "eintraege" },
      ...sichtbare.map((e, i) => art === "werke" ? werkKarte(e, i, sichtbare) : textKarte(e, i, sichtbare))));
  }

  function gruppenKasten(art, g) {
    const a = ART[art];
    const gruppen = inhalt[a.gruppen];
    const pos = gruppen.indexOf(g);
    const verschiebe = (r) => { gruppen.splice(pos, 1); gruppen.splice(pos + r, 0, g); geaendert(); zeichne(); };
    return h("div", { class: "kasten" },
      h("h2", { text: a.gruppe + " bearbeiten" }),
      h("div", { class: "feld" }, h("label", { text: "Name" }),
        h("input", { type: "text", value: g.name, maxlength: 120, oninput(e) { g.name = e.target.value; geaendert(); } })),
      h("div", { class: "feld" }, h("label", { text: "Beschreibung (optional)" }),
        h("textarea", { value: g.beschreibung, maxlength: 2000, oninput(e) { g.beschreibung = e.target.value; geaendert(); } }),
        h("p", { class: "hilfe", text: "Erscheint auf der Website unter dem Namen der " + a.gruppe + "." })),
      h("div", { class: "zeile" },
        h("label", { class: "haken" }, h("input", { type: "checkbox", checked: g.sichtbar, onchange(e) { g.sichtbar = e.target.checked; geaendert(); zeichne(); } }), "Auf der Website zeigen"),
        h("span", { style: "flex:1" }),
        h("button", { class: "knopf klein", type: "button", text: "← Nach vorne", disabled: pos === 0, onclick() { verschiebe(-1); } }),
        h("button", { class: "knopf klein", type: "button", text: "Nach hinten →", disabled: pos === gruppen.length - 1, onclick() { verschiebe(1); } }),
        h("button", { class: "knopf klein gefahr", type: "button", text: a.gruppe + " löschen", onclick() {
          const n = inhalt[a.eintraege].filter((e) => e[a.feld] === g.id).length;
          if (!confirm("„" + g.name + "“ löschen?" + (n ? "\n\nDie " + n + " Einträge darin bleiben erhalten und landen unter „" + a.ohne + "“." : ""))) return;
          inhalt[a.eintraege].forEach((e) => { if (e[a.feld] === g.id) e[a.feld] = null; });
          gruppen.splice(pos, 1);
          auswahl[art] = "alle";
          geaendert(); zeichne();
        } })));
  }

  // Verschiebt einen Eintrag innerhalb der gerade angezeigten Liste
  function verschiebeEintrag(liste, sichtbare, i, richtung) {
    const ziel = sichtbare[i + richtung];
    const a = liste.indexOf(sichtbare[i]);
    const b = liste.indexOf(ziel);
    [liste[a], liste[b]] = [liste[b], liste[a]];
    geaendert(); zeichne();
  }

  function gruppenAuswahl(art, eintrag) {
    const a = ART[art];
    const sel = h("select", { onchange(e) { eintrag[a.feld] = e.target.value || null; geaendert(); zeichne(); } },
      h("option", { value: "", text: a.ohne }),
      ...inhalt[a.gruppen].map((g) => h("option", { value: g.id, text: g.name })));
    sel.value = eintrag[a.feld] || "";
    return sel;
  }

  function werkKarte(w, i, sichtbare) {
    const src = bildAdresse(w.bild);
    return h("div", { class: "eintrag" + (w.sichtbar ? "" : " verborgen") },
      h("div", {},
        h("div", { class: "vorschau" }, src ? h("img", { src, alt: "" }) : h("span", { class: "leer", text: "Noch kein Bild (Platzhalter)" })),
        h("div", { class: "knoepfe" },
          h("button", { class: "knopf klein", type: "button", text: src ? "Bild ersetzen" : "Bild wählen", async onclick(e) {
            const [datei] = await dateiWaehlen(false);
            if (!datei) return;
            e.target.disabled = true; e.target.textContent = "Lädt …";
            try { w.bild = await bildVorbereiten(datei, "bilder/werke/" + neueId(w.titel) + ".jpg"); delete w.platzhalter; geaendert(); }
            catch (err) { meldung(err.message, "fehler"); }
            zeichne();
          } }))),
      h("div", {},
        h("div", { class: "raster2" },
          h("div", { class: "feld" }, h("label", { text: "Titel" }),
            h("input", { type: "text", value: w.titel, maxlength: 200, oninput(e) { w.titel = e.target.value; geaendert(); } })),
          h("div", { class: "feld" }, h("label", { text: "Galerie" }), gruppenAuswahl("werke", w))),
        h("div", { class: "feld" }, h("label", { text: "Kleiner Text (optional)" }),
          h("textarea", { value: w.text, maxlength: 3000, rows: 2, oninput(e) { w.text = e.target.value; geaendert(); } })),
        h("div", { class: "zeile" },
          h("label", { class: "haken" }, h("input", { type: "checkbox", checked: w.sichtbar, onchange(e) { w.sichtbar = e.target.checked; geaendert(); zeichne(); } }), "Auf der Website zeigen"),
          !w.sichtbar && h("span", { class: "marke", text: "Verborgen" }),
          h("span", { style: "flex:1" }),
          h("button", { class: "knopf klein", type: "button", text: "↑", title: "Nach oben", "aria-label": "Nach oben", disabled: i === 0,
            onclick() { verschiebeEintrag(inhalt.werke, sichtbare, i, -1); } }),
          h("button", { class: "knopf klein", type: "button", text: "↓", title: "Nach unten", "aria-label": "Nach unten", disabled: i === sichtbare.length - 1,
            onclick() { verschiebeEintrag(inhalt.werke, sichtbare, i, 1); } }),
          h("button", { class: "knopf klein gefahr", type: "button", text: "Löschen", onclick() {
            if (!confirm("„" + w.titel + "“ wirklich löschen?")) return;
            inhalt.werke.splice(inhalt.werke.indexOf(w), 1);
            geaendert(); zeichne();
          } }))));
  }

  function editor(wert, onChange) {
    const feld = h("textarea", { class: "lang", value: wert, oninput(e) { onChange(e.target.value); } });
    const vorschau = h("div", { class: "lesevorschau", hidden: true });
    // Markierten Text umschließen bzw. Zeilen mit einem Zeichen beginnen lassen
    function umschliessen(zeichen) {
      const { selectionStart: s, selectionEnd: e, value: v } = feld;
      const auswahlText = v.slice(s, e) || "Text";
      feld.value = v.slice(0, s) + zeichen + auswahlText + zeichen + v.slice(e);
      feld.setSelectionRange(s + zeichen.length, s + zeichen.length + auswahlText.length);
      feld.focus(); onChange(feld.value);
    }
    function zeilenAnfang(zeichen) {
      const { selectionStart: s, selectionEnd: e, value: v } = feld;
      const anfang = v.lastIndexOf("\n", s - 1) + 1;
      const block = v.slice(anfang, e).split("\n").map((z) => z.startsWith(zeichen) ? z : zeichen + z).join("\n");
      feld.value = v.slice(0, anfang) + block + v.slice(e);
      feld.focus(); onChange(feld.value);
    }
    const vorschauKnopf = h("button", { type: "button", text: "Vorschau", onclick() {
      const an = vorschau.hidden;
      vorschau.innerHTML = TextFormat.alsHtml(feld.value) || "<p><em>Noch leer.</em></p>";
      vorschau.hidden = !an; feld.hidden = an;
      vorschauKnopf.textContent = an ? "Bearbeiten" : "Vorschau";
    } });
    return h("div", { class: "feld" },
      h("div", { class: "leiste" },
        h("button", { type: "button", onclick() { umschliessen("**"); } }, h("strong", { text: "Fett" })),
        h("button", { type: "button", onclick() { umschliessen("*"); } }, h("em", { text: "Kursiv" })),
        h("button", { type: "button", text: "Zwischenüberschrift", onclick() { zeilenAnfang("## "); } }),
        h("button", { type: "button", text: "Zitat", onclick() { zeilenAnfang("> "); } }),
        vorschauKnopf),
      feld, vorschau,
      h("p", { class: "hilfe", text: "Leerzeile = neuer Absatz. Text markieren und dann „Fett“ oder „Kursiv“ drücken." }));
  }

  function textKarte(t, i, sichtbare) {
    const offen = offenerText === t.id;
    return h("div", { class: "eintrag text" + (t.sichtbar ? "" : " verborgen") },
      h("div", {},
        h("div", { class: "raster2" },
          h("div", { class: "feld" }, h("label", { text: "Titel" }),
            h("input", { type: "text", value: t.titel, maxlength: 200, oninput(e) { t.titel = e.target.value; geaendert(); } })),
          h("div", { class: "raster2" },
            h("div", { class: "feld" }, h("label", { text: "Datum" }),
              h("input", { type: "date", value: t.datum, required: true, onchange(e) { if (e.target.value) { t.datum = e.target.value; geaendert(); } } })),
            h("div", { class: "feld" }, h("label", { text: "Sammlung" }), gruppenAuswahl("texte", t)))),
        offen && editor(t.inhalt, (v) => { t.inhalt = v; geaendert(); }),
        h("div", { class: "zeile" },
          h("button", { class: "knopf klein", type: "button", text: offen ? "Text zuklappen" : "Text bearbeiten",
            onclick() { offenerText = offen ? null : t.id; zeichne(); } }),
          h("label", { class: "haken" }, h("input", { type: "checkbox", checked: t.sichtbar, onchange(e) { t.sichtbar = e.target.checked; geaendert(); zeichne(); } }), "Auf der Website zeigen"),
          !t.sichtbar && h("span", { class: "marke", text: "Entwurf" }),
          h("span", { style: "flex:1" }),
          h("button", { class: "knopf klein", type: "button", text: "↑", title: "Nach oben", "aria-label": "Nach oben", disabled: i === 0,
            onclick() { verschiebeEintrag(inhalt.texte, sichtbare, i, -1); } }),
          h("button", { class: "knopf klein", type: "button", text: "↓", title: "Nach unten", "aria-label": "Nach unten", disabled: i === sichtbare.length - 1,
            onclick() { verschiebeEintrag(inhalt.texte, sichtbare, i, 1); } }),
          h("button", { class: "knopf klein gefahr", type: "button", text: "Löschen", onclick() {
            if (!confirm("„" + t.titel + "“ wirklich löschen?")) return;
            inhalt.texte.splice(inhalt.texte.indexOf(t), 1);
            geaendert(); zeichne();
          } }))));
  }

  // ------------------------------------------------------------------ Startbild & Über mich
  function zeichneStart() {
    const sb = inhalt.startbild;
    hauptEl.append(
      h("div", { class: "kasten" },
        h("h2", { text: "Startbild" }),
        h("p", { class: "hilfe", style: "margin:-6px 0 14px", text: "Das Foto oben auf der Startseite. Es wird immer vollständig gezeigt, nichts wird abgeschnitten." }),
        h("div", { class: "startbild" }, h("img", { src: bildAdresse(sb), alt: "" })),
        h("div", { class: "zeile" },
          h("button", { class: "knopf", type: "button", text: "Anderes Foto wählen", async onclick(e) {
            const [datei] = await dateiWaehlen(false);
            if (!datei) return;
            e.target.disabled = true; e.target.textContent = "Lädt …";
            try { Object.assign(sb, await bildVorbereiten(datei, "bilder/" + neueId("start") + ".jpg")); geaendert(); meldung("Neues Startbild gewählt. Zum Veröffentlichen „Speichern & veröffentlichen“ drücken.", "info"); }
            catch (err) { meldung(err.message, "fehler"); }
            zeichne();
          } })),
        h("div", { class: "feld", style: "margin-top:16px" }, h("label", { text: "Bildbeschreibung (für Blinde und Suchmaschinen)" }),
          h("input", { type: "text", value: sb.alt || "", maxlength: 300, oninput(e) { sb.alt = e.target.value; geaendert(); } }))),
      h("div", { class: "kasten" },
        h("h2", { text: "Über mich" }),
        editor(inhalt.ueber, (v) => { inhalt.ueber = v; geaendert(); })));
  }

  // ------------------------------------------------------------------ Passwort
  function zeichneKonto() {
    const alt = h("input", { type: "password", autocomplete: "current-password" });
    const n1 = h("input", { type: "password", autocomplete: "new-password" });
    const n2 = h("input", { type: "password", autocomplete: "new-password" });
    hauptEl.append(h("div", { class: "kasten", style: "max-width:480px" },
      h("h2", { text: "Passwort ändern" }),
      h("form", { onsubmit(e) {
        e.preventDefault();
        if (ungespeichert) { meldung("Bitte erst die offenen Änderungen speichern.", "fehler"); return; }
        Speicher.passwortAendern(alt.value, n1.value, n2.value).then(() => {
          alt.value = n1.value = n2.value = "";
          meldung("Das Passwort wurde geändert.");
        }).catch((err) => meldung(err.message, "fehler"));
      } },
        h("div", { class: "feld" }, h("label", { text: "Aktuelles Passwort" }), alt),
        h("div", { class: "feld" }, h("label", { text: "Neues Passwort (mindestens 12 Zeichen)" }), n1),
        h("div", { class: "feld" }, h("label", { text: "Neues Passwort wiederholen" }), n2),
        h("button", { class: "knopf haupt", type: "submit", text: "Passwort ändern" }))));
  }

  start();
})();
