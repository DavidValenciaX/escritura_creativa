type Page = {
  element: HTMLElement;
  parents: Map<HTMLElement, HTMLElement>;
  hasContent: boolean;
};

// Paginate actual DOM content, never a clipped/translated full document.
export function paginateLetter(
  letter: HTMLElement,
  pageHeight: number,
  margin = 55,
) {
  const pages: Page[] = [];
  let page: Page;
  const continued = new Set<HTMLElement>();
  const width = letter.getBoundingClientRect().width;
  const host = letter.parentElement!;
  const safety = 6;
  function tidy() {
    for (const element of Array.from(page.parents.values()).reverse()) {
      if (!element.hasChildNodes()) element.remove();
    }
  }
  function nextPage() {
    if (page) tidy();
    if (pages.length === 10)
      throw new Error(
        "El escrito supera el máximo de diez imágenes. Comparte el enlace completo o crea una versión más breve.",
      );
    const element = letter.cloneNode(false) as HTMLElement;
    Object.assign(element.style, {
      width: `${width}px`,
      height: `${pageHeight}px`,
      minHeight: `${pageHeight}px`,
      padding: `${margin}px 60px`,
      transform: "none",
    });
    host.appendChild(element);
    page = { element, parents: new Map(), hasContent: false };
    pages.push(page);
  }
  function parent(path: HTMLElement[]) {
    let target = page.element;
    for (const source of path) {
      let clone = page.parents.get(source);
      if (!clone) {
        clone = cloneBlock(source);
        clone.replaceChildren();
        if (source.tagName === "LI" && continued.has(source))
          clone.style.listStyleType = "none";
        target.appendChild(clone);
        page.parents.set(source, clone);
      }
      target = clone;
    }
    return target;
  }
  function fits(element: HTMLElement) {
    const bottom =
      page.element.getBoundingClientRect().bottom - margin - safety;
    return element.getBoundingClientRect().bottom <= bottom;
  }
  function cloneBlock(source: HTMLElement) {
    const clone = source.cloneNode(true) as HTMLElement;
    // Explicit values preserve numbered lists when their items span pages.
    if (source.tagName === "LI" && source.parentElement?.tagName === "OL") {
      const list = source.parentElement as HTMLOListElement;
      const items = Array.from(list.children) as HTMLLIElement[];
      let value = list.hasAttribute("start")
        ? list.start
        : list.reversed
          ? items.length
          : 1;
      for (const item of items) {
        if (item.hasAttribute("value")) value = item.value;
        if (item === source) break;
        value += list.reversed ? -1 : 1;
      }
      (clone as HTMLLIElement).value = value;
    }
    if (source.tagName === "LI" && continued.has(source))
      clone.style.listStyleType = "none";
    return clone;
  }
  function accepted(source: HTMLElement) {
    page.hasContent = true;
    continued.add(source);
    for (const [original, clone] of page.parents)
      if (clone.hasChildNodes()) continued.add(original);
  }
  function splitText(source: HTMLElement, path: HTMLElement[]) {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const text = nodes.map((node) => node.data).join("");
    if (!text.trim() || source.querySelector("img"))
      throw new Error(
        "Un elemento es demasiado alto para una imagen. Reduce su tamaño e inténtalo de nuevo.",
      );
    const words = Array.from(
      text.matchAll(/\s+/g),
      (match) => match.index! + match[0].length,
    );
    words.push(text.length);
    const characters: number[] = [];
    let offset = 0;
    for (const character of text) {
      offset += character.length;
      characters.push(offset);
    }
    function point(position: number): [Node, number] {
      let index = 0;
      for (const node of nodes) {
        if (position <= index + node.length) return [node, position - index];
        index += node.length;
      }
      return [source, source.childNodes.length];
    }
    function fragment(start: number, end: number) {
      const range = document.createRange();
      if (start === 0) range.setStart(source, 0);
      else range.setStart(...point(start));
      if (end === text.length) range.setEnd(source, source.childNodes.length);
      else range.setEnd(...point(end));
      const clone = cloneBlock(source);
      clone.replaceChildren(range.cloneContents());
      return clone;
    }
    let start = 0;
    while (start < text.length) {
      const target = parent(path);
      function best(boundaries: number[]) {
        const candidates = boundaries.filter((end) => end > start);
        let low = 0,
          high = candidates.length - 1,
          result = start;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const trial = fragment(start, candidates[middle]);
          target.appendChild(trial);
          const ok = fits(trial);
          trial.remove();
          if (ok) {
            result = candidates[middle];
            low = middle + 1;
          } else high = middle - 1;
        }
        return result;
      }
      let end = best(words);
      if (end === start) end = best(characters);
      if (end === start) {
        if (!page.hasContent)
          throw new Error(
            "El texto no cabe en una imagen con el tamaño de fuente elegido.",
          );
        nextPage();
        continue;
      }
      target.appendChild(fragment(start, end));
      accepted(source);
      start = end;
      if (start < text.length) nextPage();
    }
  }
  function flow(source: HTMLElement, path: HTMLElement[]) {
    const target = parent(path);
    const clone = cloneBlock(source);
    target.appendChild(clone);
    if (fits(clone)) {
      accepted(source);
      return;
    }
    const height = clone.getBoundingClientRect().height;
    clone.remove();
    const container = ["UL", "OL", "BLOCKQUOTE"].includes(source.tagName);
    if (
      !container &&
      height <= pageHeight - margin * 2 - safety &&
      page.hasContent
    ) {
      nextPage();
      const moved = cloneBlock(source);
      parent(path).appendChild(moved);
      if (fits(moved)) {
        accepted(source);
        return;
      }
      moved.remove();
    }
    if (
      container ||
      (source.tagName === "LI" && source.querySelector("p,ul,ol"))
    ) {
      for (const child of Array.from(source.children))
        flow(child as HTMLElement, [...path, source]);
      return;
    }
    splitText(source, path);
  }
  try {
    nextPage();
    for (const child of Array.from(letter.children)) {
      const element = child as HTMLElement;
      if (element.classList.contains("letter-content")) {
        for (const block of Array.from(element.children))
          flow(block as HTMLElement, [element]);
      } else flow(element, []);
    }
    tidy();
    return pages.map((p) => p.element);
  } catch (error) {
    pages.forEach((p) => p.element.remove());
    throw error;
  }
}
