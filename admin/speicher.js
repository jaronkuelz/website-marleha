// Speichern ohne eigenen Server: Das Adminpanel schreibt direkt ins GitHub-Repo,
// GitHub Pages veröffentlicht die Änderung danach (dauert etwa eine Minute).
//
// Zugang: Ein GitHub-Schlüssel (fein abgestufter Token, nur für dieses Repo,
// Recht „Contents: Read and write“) liegt verschlüsselt in daten/zugang.json.
// Entschlüsselt wird er im Browser mit Marlehas Passwort (PBKDF2 + AES-GCM).
// Verborgenes (Entwürfe) liegt ebenfalls verschlüsselt in daten/entwuerfe.json,
// damit es nicht im öffentlichen Repo lesbar ist.
(function (global) {
  "use strict";

  const REPO = "jaronkuelz/website-marleha";
  const API = "https://api.github.com/repos/" + REPO;
  const ITERATIONEN = 600000;
  const PFAD = { inhalt: "daten/inhalt.json", entwuerfe: "daten/entwuerfe.json", zugang: "daten/zugang.json" };
  const GRUPPEN = { werke: ["galerien", "galerie"], texte: ["sammlungen", "sammlung"] };

  let zweig = "main";
  let token = null;
  let schluessel = null; // CryptoKey für AES-GCM
  let schluesselRoh = null; // dieselben Bytes, für sessionStorage

  // ---------------------------------------------------------------- Kodierung
  const b64 = (bytes) => { let s = ""; new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
  const ausB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const utf8 = new TextEncoder();
  const vonUtf8 = new TextDecoder();
  const zufall = (n) => crypto.getRandomValues(new Uint8Array(n));

  // ---------------------------------------------------------------- Verschlüsselung
  async function schluesselAusPasswort(passwort, salz, iterationen) {
    const basis = await crypto.subtle.importKey("raw", utf8.encode(passwort), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salz, iterations: iterationen }, basis, 256);
    return new Uint8Array(bits);
  }
  async function setzeSchluessel(roh) {
    schluesselRoh = roh;
    schluessel = await crypto.subtle.importKey("raw", roh, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  async function verschluesseln(text, key) {
    const iv = zufall(12);
    const daten = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key || schluessel, utf8.encode(text));
    return { iv: b64(iv), daten: b64(daten) };
  }
  async function entschluesseln(paket, key) {
    const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ausB64(paket.iv) }, key || schluessel, ausB64(paket.daten));
    return vonUtf8.decode(klar);
  }

  // ---------------------------------------------------------------- GitHub
  async function gh(pfad, opts, mitToken) {
    opts = opts || {};
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (mitToken !== false && token) headers.Authorization = "Bearer " + token;
    if (opts.body) headers["Content-Type"] = "application/json";
    let r;
    try {
      r = await fetch(API + pfad, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" });
    } catch (e) {
      throw new Error("Keine Verbindung zu GitHub. Bitte Internet prüfen.");
    }
    if (r.status === 404 && opts.leerBei404) return null;
    const daten = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) throw new Error("Der GitHub-Schlüssel ist abgelaufen oder ungültig. Bitte Jaron Bescheid geben.");
      if (r.status === 403 && /rate limit/i.test(daten.message || "")) throw new Error("GitHub bremst gerade (zu viele Anfragen). Bitte in ein paar Minuten nochmal.");
      if (r.status === 403 && /not accessible/i.test(daten.message || "")) throw new Error("Dem GitHub-Schlüssel fehlt ein Recht: Er braucht für das Repo website-marleha „Contents: Read and write“.");
      if (r.status === 422 && /fast forward/i.test(daten.message || "")) throw new Error("Die Website wurde in der Zwischenzeit woanders geändert. Bitte die Seite neu laden.");
      throw new Error("GitHub meldet: " + (daten.message || r.status));
    }
    return daten;
  }

  async function leseDatei(pfad, mitToken) {
    const d = await gh("/contents/" + pfad + "?ref=" + zweig, { leerBei404: true }, mitToken);
    if (!d) return null;
    return vonUtf8.decode(ausB64(d.content.replace(/\n/g, "")));
  }

  // ---------------------------------------------------------------- Anmeldung
  async function zugang() {
    const text = await leseDatei(PFAD.zugang, false);
    return text ? JSON.parse(text) : null;
  }

  // Prüft nur, ob der Schlüssel das Repo sieht. Ob er schreiben darf, zeigt erst das Speichern
  // (GitHub meldet bei "permissions" die Rechte des Kontos, nicht die des Schlüssels).
  async function pruefeToken(t) {
    token = t;
    try { await gh(""); }
    catch (e) { token = null; throw e; }
  }

  async function anmelden(passwort) {
    const z = await zugang();
    if (!z) throw new Error("Das Adminpanel ist noch nicht eingerichtet.");
    const roh = await schluesselAusPasswort(passwort, ausB64(z.salz), z.iterationen);
    await setzeSchluessel(roh);
    let t;
    try { t = await entschluesseln(z.token); }
    catch (e) { schluessel = schluesselRoh = null; throw new Error("Das Passwort ist nicht richtig."); }
    await pruefeToken(t);
    merken();
  }

  function passwortProblem(pw, pw2) {
    if (typeof pw !== "string" || pw.length < 12) return "Das Passwort muss mindestens 12 Zeichen lang sein.";
    if (pw !== pw2) return "Die beiden Passwörter sind nicht gleich.";
    return null;
  }

  // Erstellt daten/zugang.json für ein neues Passwort (Token wird damit verschlüsselt)
  async function zugangFuer(passwort) {
    const salz = zufall(16);
    const roh = await schluesselAusPasswort(passwort, salz, ITERATIONEN);
    const key = await crypto.subtle.importKey("raw", roh, "AES-GCM", false, ["encrypt", "decrypt"]);
    const datei = { hinweis: "Verschlüsselter Zugang für das Adminpanel – ohne Passwort nutzlos.", salz: b64(salz), iterationen: ITERATIONEN, token: await verschluesseln(token, key) };
    return { roh, datei };
  }

  async function einrichten(t, passwort, passwort2) {
    const p = passwortProblem(passwort, passwort2);
    if (p) throw new Error(p);
    if (await zugang()) throw new Error("Das Adminpanel ist bereits eingerichtet.");
    await pruefeToken(String(t || "").trim());
    const { roh, datei } = await zugangFuer(passwort);
    await setzeSchluessel(roh);
    // Nur der öffentliche Stand: alte Entwürfe (falls neu eingerichtet wird) lassen sich ohne altes Passwort nicht lesen
    const inhalt = await ladeInhalt(true);
    await speichern(inhalt, {}, { [PFAD.zugang]: JSON.stringify(datei, null, 2) + "\n" }, "Adminpanel eingerichtet");
    merken();
  }

  async function passwortAendern(alt, neu, neu2) {
    const p = passwortProblem(neu, neu2);
    if (p) throw new Error(p);
    const z = await zugang();
    const altKey = await crypto.subtle.importKey("raw", await schluesselAusPasswort(alt, ausB64(z.salz), z.iterationen), "AES-GCM", false, ["decrypt"]);
    try { await entschluesseln(z.token, altKey); } catch (e) { throw new Error("Das aktuelle Passwort ist nicht richtig."); }
    // Gespeicherten Stand (nicht den gerade bearbeiteten) mit dem neuen Schlüssel neu verschlüsseln
    const gespeichert = await ladeInhalt();
    const { roh, datei } = await zugangFuer(neu);
    await setzeSchluessel(roh);
    await speichern(gespeichert, {}, { [PFAD.zugang]: JSON.stringify(datei, null, 2) + "\n" }, "Passwort geändert");
    merken();
  }

  // Sitzung nur für diesen Browser-Tab (verschwindet beim Schließen)
  function merken() {
    try { sessionStorage.setItem("marleha-admin", JSON.stringify({ token, schluessel: b64(schluesselRoh) })); } catch (e) {}
  }
  async function fortsetzen() {
    let s = null;
    try { s = JSON.parse(sessionStorage.getItem("marleha-admin")); } catch (e) {}
    if (!s) return false;
    token = s.token;
    await setzeSchluessel(ausB64(s.schluessel));
    return true;
  }
  function abmelden() {
    token = schluessel = schluesselRoh = null;
    try { sessionStorage.removeItem("marleha-admin"); } catch (e) {}
  }

  // ---------------------------------------------------------------- Inhalt
  // Öffentliche Datei + verschlüsselte Entwürfe → ein vollständiger Inhalt (Reihenfolge bleibt erhalten)
  async function ladeInhalt(nurOeffentlich) {
    const oeffentlich = JSON.parse(await leseDatei(PFAD.inhalt));
    const paket = nurOeffentlich ? null : await leseDatei(PFAD.entwuerfe);
    if (!paket) return oeffentlich;
    const entwurf = JSON.parse(await entschluesseln(JSON.parse(paket)));
    const voll = Object.assign({}, oeffentlich);
    ["galerien", "sammlungen", "werke", "texte"].forEach((liste) => {
      const alle = new Map(oeffentlich[liste].concat(entwurf.verborgen[liste]).map((e) => [e.id, e]));
      const ordnung = entwurf.reihenfolge[liste].filter((id) => alle.has(id));
      alle.forEach((e, id) => { if (!ordnung.includes(id)) ordnung.push(id); });
      voll[liste] = ordnung.map((id) => alle.get(id));
    });
    return voll;
  }

  // Vollständiger Inhalt → was öffentlich sein darf + was verborgen bleibt
  function aufteilen(inhalt) {
    const oeffentlich = Object.assign({}, inhalt);
    const verborgen = {};
    const reihenfolge = {};
    const sichtbareGruppen = {};
    ["galerien", "sammlungen"].forEach((liste) => {
      oeffentlich[liste] = inhalt[liste].filter((g) => g.sichtbar);
      verborgen[liste] = inhalt[liste].filter((g) => !g.sichtbar);
      sichtbareGruppen[liste] = new Set(oeffentlich[liste].map((g) => g.id));
    });
    Object.entries(GRUPPEN).forEach(([liste, [gruppen, feld]]) => {
      const zeigen = (e) => e.sichtbar && (e[feld] === null || sichtbareGruppen[gruppen].has(e[feld]));
      oeffentlich[liste] = inhalt[liste].filter(zeigen);
      verborgen[liste] = inhalt[liste].filter((e) => !zeigen(e));
    });
    ["galerien", "sammlungen", "werke", "texte"].forEach((liste) => { reihenfolge[liste] = inhalt[liste].map((e) => e.id); });
    return { oeffentlich, entwurf: { verborgen, reihenfolge } };
  }

  // Alle Bildpfade, auf die der Inhalt verweist
  function bildPfade(inhalt) {
    const pfade = new Set([inhalt.startbild.pfad]);
    inhalt.werke.forEach((w) => { if (w.bild) pfade.add(w.bild.pfad); });
    return pfade;
  }

  const blobAlsB64 = async (blob) => b64(await blob.arrayBuffer());

  // Ein Commit mit allem: Inhalt, Entwürfe, neue Bilder; nicht mehr benutzte Bilder werden entfernt.
  // neueBilder: { pfad: Blob }, extra: { pfad: Text }
  async function speichern(inhalt, neueBilder, extra, nachricht) {
    const { oeffentlich, entwurf } = aufteilen(inhalt);
    const ref = await gh("/git/ref/heads/" + zweig);
    const kopf = await gh("/git/commits/" + ref.object.sha);
    const baum = await gh("/git/trees/" + kopf.tree.sha + "?recursive=1");

    const benutzt = bildPfade(inhalt);
    const eintraege = [];
    for (const [pfad, blob] of Object.entries(neueBilder || {})) {
      if (!benutzt.has(pfad)) continue; // inzwischen wieder entfernt
      const b = await gh("/git/blobs", { method: "POST", body: { content: await blobAlsB64(blob), encoding: "base64" } });
      eintraege.push({ path: pfad, mode: "100644", type: "blob", sha: b.sha });
    }
    baum.tree
      .filter((e) => e.type === "blob" && /^bilder\/(werke\/|start-)/.test(e.path) && !benutzt.has(e.path))
      .forEach((e) => eintraege.push({ path: e.path, mode: "100644", type: "blob", sha: null }));
    const dateien = Object.assign({
      [PFAD.inhalt]: JSON.stringify(oeffentlich, null, 2) + "\n",
      [PFAD.entwuerfe]: JSON.stringify(await verschluesseln(JSON.stringify(entwurf)), null, 2) + "\n",
    }, extra || {});
    Object.entries(dateien).forEach(([pfad, text]) => eintraege.push({ path: pfad, mode: "100644", type: "blob", content: text }));

    const neuerBaum = await gh("/git/trees", { method: "POST", body: { base_tree: kopf.tree.sha, tree: eintraege } });
    const commit = await gh("/git/commits", { method: "POST", body: { message: (nachricht || "Inhalt über das Adminpanel geändert"), tree: neuerBaum.sha, parents: [ref.object.sha] } });
    await gh("/git/refs/heads/" + zweig, { method: "PATCH", body: { sha: commit.sha } });
    return commit.sha;
  }

  // Bildadresse fürs Panel: direkt aus dem Repo, damit neue Bilder sofort sichtbar sind
  const bildAdresse = (pfad) => "https://raw.githubusercontent.com/" + REPO + "/" + zweig + "/" + pfad;

  const Speicher = {
    zugang, anmelden, einrichten, passwortAendern, fortsetzen, abmelden, ladeInhalt, speichern, bildAdresse,
    // nur für Tests
    _intern: { aufteilen, setzeZweig: (z) => { zweig = z; }, setzeToken: (t) => { token = t; }, setzeSchluessel },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Speicher;
  else global.Speicher = Speicher;
})(typeof window !== "undefined" ? window : globalThis);
