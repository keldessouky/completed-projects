---
title: "MECCHA CHAMELEON (LAN) — Product Brief"
status: draft
created: 2026-06-27
updated: 2026-06-27
---

# MECCHA CHAMELEON (LAN) — Product Brief

## Context

This brief covers a browser-based, **local-network multiplayer** remake of the
viral Steam game *MECCHA CHAMELEON* (LEMORION, 2026): an asymmetric hide-and-seek
where **Hiders** paint their plain white chameleon to camouflage into the stage
while a **Seeker** hunts them within a time limit. The defining mechanic is
*paint-to-blend* built on three pillars — **Position, Pose, Painting** — plus a
scoring twist that rewards hiding in plain sight if your camouflage is good
enough.

The goal: a self-contained game that one person on a LAN runs (`npm start`),
which prints a URL like `http://192.168.x.x:3000`; everyone else on the same
network opens it in a browser and plays together — no accounts, no internet, no
app store.

## Problem / Need

The real game is 3D and online; we want a lightweight, hackable, zero-setup
party version for a room full of people on the same Wi-Fi. It must be trivial to
launch and join, run entirely on the local network, and faithfully capture the
*paint-to-camouflage* loop that makes the original fun.

## Target Players

A small co-located group (2–10 ideal, up to ~16) on one LAN: friends, an office,
a classroom. They want a 5-minute pick-up party game on their own laptops/phones.

## Core Gameplay (MVP)

A match is a sequence of short rounds. Each round:

1. **Lobby** — players join with a name on the host's URL; host starts the match.
   One player is the **Seeker**, the rest are **Hiders** (auto-assigned, rotates
   each round).
2. **Hide phase** (timer, ~45s) — Hiders move around a 2D stage of colored
   surfaces/props, lock a **pose**, and **paint** their chameleon using a palette
   + **eyedropper** (sample the surface color). The closer the body matches the
   backdrop behind it, the better the **blend score**.
3. **Seek phase** (timer, ~60s) — the Seeker scans the stage and **tags** shapes
   they believe are Hiders. Correct tags eliminate that Hider; wrong tags cost
   the Seeker.
4. **Results** — points awarded; roles rotate; next round.

**Scoring (faithful to the original):**
- Hiders earn points over time for *staying hidden*, scaled by **blend quality**.
- **Risk bonus:** extra points while sitting inside the Seeker's line of sight —
  hiding in the open pays more, if your camouflage holds.
- Seeker earns points for correct tags, loses points/time for wrong ones.

## What Makes It Work

The heart is a **real, computed camouflage score**: compare the pixels of a
Hider's painted chameleon against the stage pixels directly behind it (color
distance). This is faithful to the source, is genuinely skill-based, and — unlike
3D netcode — is fully buildable and testable in a browser on a LAN.

## Scope

**In (MVP):**
- LAN host server + browser clients; lobby/join by URL; no accounts.
- One stage, 2D; movement; pose selection; palette + eyedropper painting.
- Pixel-based blend scoring; Seeker tagging; line-of-sight risk bonus.
- Round state machine (lobby → hide → seek → results), role rotation, a
  scoreboard, multiple rounds.

**Out (later epics):**
- Internet/matchmaking (this is LAN-only by design).
- Multiple/complex stages, 3D, advanced art, voice, persistence/accounts.
- Anti-cheat (trusted LAN party context).
- Mobile-optimized touch painting (works, but desktop-first).

## Constraints & Assumptions

- **Tech:** browser client (HTML5 Canvas + TypeScript) + Node/TypeScript server
  (single process serves the static client and the realtime socket). One
  `npm install && npm start`. *(decided)*
- **LAN trust model:** server is authoritative for round state and scoring; no
  hardening against malicious peers — acceptable for a local party game.
  *[ASSUMPTION]*
- **Players:** desktop/laptop browsers first; mouse for painting. *[ASSUMPTION]*
- **2D, not 3D:** a stylized 2D stage preserves the paint-to-blend loop while
  staying achievable and verifiable. *[ASSUMPTION]*

## Success

A group on one network can, within a minute of the host running `npm start`,
all join from their browsers and play a full round where painting well visibly
improves survival and score, and the Seeker has a real "spot the anomaly"
challenge.
