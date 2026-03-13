export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function convertToPermanentUrl(signedUrl: string): string {
  const CANONICAL_HOST = "https://images.tokopedia.net";
  const OLD_FORMAT_DATE = "1997/1/1";
  const OLD_FORMAT_BUCKET = "aphluv";

  try {
    const url = new URL(signedUrl);
    const path = url.pathname;

    const newFormatMatch = path.match(/(\/img\/.*?\.(jpg|jpeg|webp|png))(~tplv.*)?/i);
    if (newFormatMatch) {
      return `${CANONICAL_HOST}${newFormatMatch[1]}`;
    }

    const oldFormatMatch = path.match(/\/([a-f0-9]{32})(~tplv-.*)/i);
    if (oldFormatMatch) {
      return `${CANONICAL_HOST}/img/cache/1600-square/${OLD_FORMAT_BUCKET}/${OLD_FORMAT_DATE}/${oldFormatMatch[1]}~.jpeg.webp?ect=4g`;
    }

    return signedUrl;
  } catch {
    return signedUrl;
  }
}
