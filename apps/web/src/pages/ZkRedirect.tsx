import { useEffect } from "react";

// /zk is a static page served from public/zk/index.html. The SPA has no /zk
// route and the host doesn't rewrite /zk -> /zk/index.html, so hitting /zk
// directly (a shared link, a judge typing it) falls through to not-found.
// This bounces it to the real static ZK page.
//
// Target the file explicitly. The prod nginx serves the SPA shell for "/zk/"
// (no directory index), and react-router matches "/zk/" to this same route, so
// replacing to "/zk/" reloaded the page forever (~40 loads in 9s, measured).
export default function ZkRedirect() {
  useEffect(() => {
    window.location.replace("/zk/index.html");
  }, []);
  return null;
}
