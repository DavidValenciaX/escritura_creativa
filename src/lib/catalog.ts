import { fonts, papers, type Resource } from "./model";
export const builtins: Resource[] = [
  ...papers.map((p) => ({
    id: p.key,
    kind: "paper" as const,
    name: p.name,
    author: "Escritura Creativa",
    source: "Diseño CSS original",
    license: "CC0",
    description: p.note,
    tags: ["papel"],
    builtin_key: p.key,
    hidden: false,
  })),
  ...fonts.map((f) => ({
    id: f.key,
    kind: "font" as const,
    name: f.name,
    author: "Catálogo de Google Fonts",
    source: `https://fonts.google.com/specimen/${f.name.replaceAll(" ", "+")}`,
    license: f.key === "elite" ? "Apache-2.0" : "OFL-1.1",
    description: f.kind,
    tags: [f.kind],
    builtin_key: f.key,
    hidden: false,
  })),
];
