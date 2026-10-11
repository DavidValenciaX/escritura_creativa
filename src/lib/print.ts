"use client";
export async function printLetter() {
  await document.fonts.ready;
  await Promise.all(
    Array.from(document.querySelectorAll<HTMLImageElement>(".letter img")).map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, 10000);
              const done = () => {
                clearTimeout(timer);
                resolve();
              };
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
    ),
  );
  window.print();
}
