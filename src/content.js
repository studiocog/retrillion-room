// Reads the page's plain HTML (the same markup the no-WebGL visitor sees) into the data the room draws.
// Keeping content in HTML means a CMS, a static site generator, or a hand-edited file can all feed the room.
export function readContent(root = document) {
  const text = el => (el?.textContent || "").replace(/\s+/g, " ").trim();
  return {
    name: text(root.querySelector("[data-site-name]")) || document.title,
    tagline: text(root.querySelector("[data-tagline]")),
    about: [...root.querySelectorAll("#about p")].map(text).filter(Boolean),
    work: [...root.querySelectorAll("#work li")].map((li, i) => ({
      id: li.dataset.id || `item-${i + 1}`,
      title: text(li.querySelector("h3")),
      years: li.dataset.years || "",
      blurb: text(li.querySelector("p")),
      href: li.querySelector("a[href]")?.href || null,
      color: li.dataset.color || "#c4562f",
    })),
  };
}
