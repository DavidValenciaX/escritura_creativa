import type { CSSProperties, ReactNode } from "react";
import {
  family,
  papers,
  contentWithLegacySignature,
  type Appearance,
  type ContentNode,
} from "@/lib/model";
import { imageBottom, imageStyle, readImageLayout } from "@/lib/image-layout";
import { letterDate } from "@/lib/sheet-layout";
import { SheetFrame } from "./sheet-frame";
const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
export function resourceUrl(id: string, token?: string) {
  return `/api/resource/${id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}
function Content({
  node,
  token,
  thumbnail = false,
}: {
  node: ContentNode;
  token?: string;
  thumbnail?: boolean;
}): ReactNode {
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const [i, mark] of (node.marks ?? []).entries()) {
      switch (mark.type) {
        case "bold":
          text = <strong key={i}>{text}</strong>;
          break;
        case "italic":
          text = <em key={i}>{text}</em>;
          break;
        case "strike":
          text = <s key={i}>{text}</s>;
          break;
        case "underline":
          text = <u key={i}>{text}</u>;
          break;
        case "code":
          text = <code key={i}>{text}</code>;
          break;
        case "link":
          if (!thumbnail && /^https?:\/\//i.test(String(mark.attrs?.href)))
            text = (
              <a
                key={i}
                href={String(mark.attrs?.href)}
                rel="noopener noreferrer"
                target="_blank"
              >
                {text}
              </a>
            );
      }
    }
    return text;
  }
  const children = node.content?.map((n, i) => (
    <Content key={i} node={n} token={token} thumbnail={thumbnail} />
  ));
  const align = node.attrs?.textAlign;
  const style: CSSProperties =
    align && ["left", "right", "center", "justify"].includes(String(align))
      ? { textAlign: align as CSSProperties["textAlign"] }
      : {};
  switch (node.type) {
    case "doc":
      return <>{children}</>;
    case "paragraph":
      return <p style={style}>{children?.length ? children : <br />}</p>;
    case "heading":
      return Number(node.attrs?.level) === 1 ? (
        <h2 style={style}>{children}</h2>
      ) : Number(node.attrs?.level) === 2 ? (
        <h3 style={style}>{children}</h3>
      ) : (
        <h4 style={style}>{children}</h4>
      );
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "hardBreak":
      return <br />;
    case "horizontalRule":
      return <hr />;
    case "image": {
      const asset = String(node.attrs?.assetId ?? "");
      const resource = String(node.attrs?.resourceId ?? "");
      const src = uuid.test(asset)
        ? `/api/media/${asset}${token ? `?token=${encodeURIComponent(token)}` : ""}`
        : uuid.test(resource)
          ? resourceUrl(resource, token)
          : null;
      const layout = readImageLayout(node.attrs?.layout);
      if (src && layout)
        return (
          <figure
            className="floating-image letter-floating-image"
            style={imageStyle(layout)}
          >
            <img
              src={src}
              alt={String(node.attrs?.alt ?? "")}
              loading="eager"
            />
          </figure>
        );
      return src ? (
        <figure>
          <img src={src} alt={String(node.attrs?.alt ?? "")} loading="eager" />
          {node.attrs?.alt ? (
            <figcaption>{String(node.attrs.alt)}</figcaption>
          ) : null}
        </figure>
      ) : null;
    }
    default:
      return null;
  }
}
export function PaperStyle({
  appearance,
  token,
}: {
  appearance: Appearance;
  token?: string;
}) {
  const keys = [...new Set([appearance.titleFont, appearance.bodyFont])].filter(
    (k) => uuid.test(k),
  );
  return (
    <>
      {keys.map((key) => (
        <style
          key={key}
        >{`@font-face{font-family:"resource-${key}";src:url("${resourceUrl(key, token)}") format("woff2");font-display:swap;}`}</style>
      ))}
    </>
  );
}
export function paperStyle(
  appearance: Appearance,
  token?: string,
): CSSProperties {
  const customPaper = uuid.test(appearance.paper);
  return {
    "--ink": appearance.ink,
    "--body-font": `"${family(appearance.bodyFont)}", Georgia, serif`,
    "--title-font": `"${family(appearance.titleFont)}", Georgia, serif`,
    "--letter-size": `${appearance.fontSize}px`,
    "--letter-leading": appearance.lineHeight,
    ...(customPaper
      ? {
          backgroundImage: `url("${resourceUrl(appearance.paper, token)}")`,
          backgroundSize: "cover",
        }
      : {}),
  } as CSSProperties;
}
export function Letter({
  title,
  content,
  appearance,
  signature,
  written_on,
  token,
  className = "",
  thumbnail = false,
}: {
  title: string;
  content: ContentNode;
  appearance: Appearance;
  signature?: string;
  written_on: string;
  token?: string;
  className?: string;
  thumbnail?: boolean;
}) {
  const date = letterDate(written_on);
  const paper = `paper-${papers.some((p) => p.key === appearance.paper) ? appearance.paper : "custom"}`;
  const Title = thumbnail ? "h3" : "h1";
  return (
    <>
      <PaperStyle appearance={appearance} token={token} />
      <SheetFrame
        className={`letter-frame ${paper}`}
        style={paperStyle(appearance, token)}
      >
        <article
          className={`letter sheet-document ${paper} ${className}`}
          style={paperStyle(appearance, token)}
        >
          <div
            className="image-sheet-extent"
            aria-hidden="true"
            style={{ height: `${imageBottom(content)}cqw` }}
          />
          <div className="letter-date">{date}</div>
          <Title className="letter-title">{title}</Title>
          <div className="letter-content">
            <Content
              node={contentWithLegacySignature(content, signature)}
              token={token}
              thumbnail={thumbnail}
            />
          </div>
          <div className="letter-end">✦</div>
        </article>
      </SheetFrame>
    </>
  );
}
