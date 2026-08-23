/**
 * A PAGE THIS SERVER DID NOT SERVE MUST NOT BE ABLE TO CHANGE ITS STATE.
 *
 * Listening on the loopback puts the tool out of reach of the network, not out of reach of
 * the browser. Any page the user opens can POST to `localhost`: in simple form there is no
 * preflight, and the missing CORS headers only stop the attacker reading the reply — the
 * state has already changed. A POST here changes what the screen shows and what the next reader sees.
 *
 * THE WITNESS CONNECTS THROUGH THE HOST IT ANNOUNCES, and that is not a detail. A browser
 * treats `localhost` and `127.0.0.1` as two different origins, so a test that announces one
 * while connecting to the other gets a perfectly correct 403 on a wrong test — and the next
 * person "repairs" the guard by loosening it, which puts the hole back. Every case below
 * builds its `Origin` from the host it actually dialled.
 *
 * BOTH DIRECTIONS, because only the second decides whether the guard survives contact with
 * real use: a foreign origin must be refused, AND the server's own screen must go through
 * on whatever host it happens to be served under.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const SERVEUR = fileURLToPath(new URL("./server.ts", import.meta.url));

/**
 * A PORT THE SYSTEM GAVE US, NOT ONE WE GUESSED.
 *
 * First version drew `8300 + random(600)`. Five tests, five servers, and one run in three
 * failed with a 500 that had nothing to do with the guard — two of them had landed on the
 * same port, or on one a previous test had only just released. **A flaky witness is worse
 * than no witness**: it teaches whoever sees it red to run it again rather than to look,
 * and the day it is red for a real reason nobody will look either.
 *
 * Asking the kernel for port 0 and reading back what it assigned removes the guess. There
 * is still a window between closing this socket and the server binding it, but it is a
 * window of milliseconds against a birthday collision across five draws.
 */
async function portLibre(): Promise<number> {
  const { createServer } = await import("node:net");
  return await new Promise((resolve, rejeter) => {
    const s = createServer();
    s.once("error", rejeter);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const p = typeof a === "object" && a ? a.port : 0;
      s.close(() => (p ? resolve(p) : rejeter(new Error("aucun port attribué"))));
    });
  });
}

/** Start the real server on a free port and wait until it answers. */
async function demarrer(): Promise<{ hote: string; arreter: () => void }> {
  const port = await portLibre();
  const enfant: ChildProcess = spawn(process.execPath, [SERVEUR], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const hote = `127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://${hote}/api/state`);
      return { hote, arreter: () => enfant.kill("SIGKILL") };
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  enfant.kill("SIGKILL");
  throw new Error("le serveur n'a pas répondu — rien à conclure, et surtout pas un vert");
}

test("une origine étrangère ne peut pas déclencher une écriture", async (t) => {
  const s = await demarrer();
  try {
    const r = await fetch(`http://${s.hote}/api/defaut`, {
      method: "POST",
      headers: { origin: "http://evil.example" },
    });
    assert.equal(r.status, 403, "une page d'un autre hôte doit être refusée");
    const corps = await r.json() as { erreur?: string };
    assert.equal(corps.erreur, "origine_etrangere",
      "le refus se nomme : un 403 muet envoie chercher au mauvais endroit");
  } finally { s.arreter(); }
});

test("l'écran servi par ce serveur passe, sur le port qu'on lui a donné", async (t) => {
  const s = await demarrer();
  try {
    /*
     * THE DIRECTION THAT DECIDES WHETHER THE GUARD SURVIVES. The port is whatever the
     * kernel handed out and the host is whatever we dialled — exactly the case a
     * hard-coded allow-list would refuse, and the reason this guard compares against
     * `req.headers.host` instead.
     */
    const r = await fetch(`http://${s.hote}/api/defaut`, {
      method: "POST",
      headers: { origin: `http://${s.hote}` },
    });
    assert.notEqual(r.status, 403,
      "le serveur refuse son propre écran : une garde qui mord l'usage normal se fait retirer, "
      + "et elle emporte la faille avec elle");
  } finally { s.arreter(); }
});

test("`localhost` et `127.0.0.1` sont deux origines, et le refus est juste", async (t) => {
  const s = await demarrer();
  try {
    const r = await fetch(`http://${s.hote}/api/defaut`, {
      method: "POST",
      headers: { origin: `http://localhost:${s.hote.split(":")[1]}` },
    });
    assert.equal(r.status, 403,
      "un navigateur traite ces deux-là comme deux origines : le refus est correct, et ce "
      + "cas est ici pour que personne ne le prenne pour un défaut et ne relâche la garde");
  } finally { s.arreter(); }
});

test("sans en-tête Origin, la requête passe — curl, un test, un formulaire même-origine", async (t) => {
  const s = await demarrer();
  try {
    const r = await fetch(`http://${s.hote}/api/defaut`, { method: "POST" });
    assert.notEqual(r.status, 403,
      "l'absence d'Origin n'est pas une origine étrangère : les navigateurs l'envoient sur "
      + "toute requête cross-origin, qui est le cas gardé ici");
  } finally { s.arreter(); }
});
