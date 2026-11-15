import { APP_NAME } from "@/lib/config";

export const seo = (title: string, description: string) => ({
  meta: [
    { title: `${title} · ${APP_NAME}` }, { name: "description", content: description },
    { property: "og:title", content: `${title} · ${APP_NAME}` }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ],
});
