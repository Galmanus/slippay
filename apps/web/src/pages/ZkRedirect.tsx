import { useEffect } from "react";

// /zk is a static page served from public/zk/index.html. The SPA has no /zk
// route and the host doesn't rewrite /zk -> /zk/index.html, so hitting /zk
// directly (a shared link, a judge typing it) falls through to not-found.
// This bounces it to the real static ZK page.
export default function ZkRedirect() {
  useEffect(() => {
    window.location.replace("/zk/");
  }, []);
  return null;
}
