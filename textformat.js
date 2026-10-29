// Einfache Textformatierung für Marlehas Texte – gemeinsam genutzt von Website und Adminpanel.
//   Leerzeile       → neuer Absatz
//   ## Überschrift  → Zwischenüberschrift
//   > Zitat         → Zitat
//   **fett**  *kursiv*
// Alles andere wird als reiner Text behandelt (kein HTML möglich).
(function () {
  function schuetzen(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function zeile(s) {
    return schuetzen(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
  }
  function alsHtml(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        if (block.startsWith("## ")) return "<h4>" + zeile(block.slice(3).trim()) + "</h4>";
        const zeilen = block.split("\n");
        if (zeilen.every((z) => z.startsWith(">"))) {
          return "<blockquote>" + zeilen.map((z) => zeile(z.replace(/^>\s?/, ""))).join("<br>") + "</blockquote>";
        }
        return "<p>" + zeilen.map(zeile).join("<br>") + "</p>";
      })
      .join("");
  }
  // Reiner Text ohne Zeichen (für Vorschau-Anriss und Lesezeit)
  function alsKlartext(text) {
    return String(text || "").replace(/^##\s+|^>\s?/gm, "").replace(/\*\*|\*/g, "");
  }
  window.TextFormat = { alsHtml, alsKlartext };
})();
