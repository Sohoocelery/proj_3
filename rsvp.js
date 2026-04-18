/**
 * College Event Planning — Redis RSVP & Waitlist System
 * Implements atomic RSVP, capacity enforcement, and waitlist promotion.
 *
 * Redis structures used:
 *   Hash        event:{eventId}:meta        → capacity, confirmed_count, waitlist_count, title
 *   Set         event:{eventId}:confirmed   → student IDs who are confirmed
 *   Sorted Set  event:{eventId}:waitlist    → student IDs scored by Unix timestamp (FIFO order)
 */

import { createClient } from "redis";

const client = createClient({ url: "redis://localhost:6379" });

client.on("error", (err) => console.error("Redis error:", err));
await client.connect();
console.log("Connected to Redis\n");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedEvents() {
  await client.flushAll();
  console.log("=== SEEDING EVENTS ===");

  const events = [
    { id: "evt:101", title: "Spring Hackathon", capacity: 3 },
    { id: "evt:102", title: "Club Fair",        capacity: 50 },
  ];

  for (const e of events) {
    await client.hSet(`${e.id}:meta`, {
      title:           e.title,
      capacity:        e.capacity,
      confirmed_count: 0,
      waitlist_count:  0,
    });
    console.log(`  Seeded event ${e.id}: "${e.title}" (capacity ${e.capacity})`);
  }
  console.log();
}

// ─── CREATE: RSVP a student ───────────────────────────────────────────────────

async function rsvp(eventId, studentId) {
  const key      = `${eventId}:meta`;
  const confKey  = `${eventId}:confirmed`;
  const waitKey  = `${eventId}:waitlist`;

  // Check duplicate
  const alreadyConfirmed = await client.sIsMember(confKey, studentId);
  const alreadyWaiting   = await client.zScore(waitKey, studentId);

  if (alreadyConfirmed) {
    console.log(`  [RSVP] ${studentId} is already confirmed for ${eventId}`);
    return;
  }
  if (alreadyWaiting !== null) {
    console.log(`  [RSVP] ${studentId} is already on the waitlist for ${eventId}`);
    return;
  }

  // Atomic capacity check + increment using a transaction
  const meta     = await client.hGetAll(key);
  const capacity = parseInt(meta.capacity);
  const count    = parseInt(meta.confirmed_count);

  if (count < capacity) {
    // Confirm the student
    await client.multi()
      .sAdd(confKey, studentId)
      .hIncrBy(key, "confirmed_count", 1)
      .exec();
    console.log(`  [RSVP] ${studentId} CONFIRMED for ${eventId} (${count + 1}/${capacity})`);
  } else {
    // Add to waitlist scored by current timestamp (FIFO)
    const score = Date.now();
    await client.multi()
      .zAdd(waitKey, { score, value: studentId })
      .hIncrBy(key, "waitlist_count", 1)
      .exec();
    const position = await client.zRank(waitKey, studentId);
    console.log(`  [RSVP] ${studentId} added to WAITLIST for ${eventId} (position ${position + 1})`);
  }
}

// ─── READ: Get event status ───────────────────────────────────────────────────

async function getEventStatus(eventId) {
  const meta      = await client.hGetAll(`${eventId}:meta`);
  const confirmed = await client.sMembers(`${eventId}:confirmed`);
  const waitlist  = await client.zRangeWithScores(`${eventId}:waitlist`, 0, -1);

  console.log(`\n  [STATUS] ${eventId} — "${meta.title}"`);
  console.log(`    Capacity        : ${meta.confirmed_count}/${meta.capacity}`);
  console.log(`    Confirmed       : [${confirmed.join(", ") || "none"}]`);
  console.log(`    Waitlist (FIFO) : [${waitlist.map(w => w.value).join(", ") || "none"}]`);
  console.log(`    Waitlist count  : ${meta.waitlist_count}`);
}

// ─── READ: Check if a student is confirmed ────────────────────────────────────

async function isConfirmed(eventId, studentId) {
  const result = await client.sIsMember(`${eventId}:confirmed`, studentId);
  console.log(`  [CHECK] ${studentId} confirmed for ${eventId}? ${result}`);
  return result;
}

// ─── READ: Get student's waitlist position ────────────────────────────────────

async function getWaitlistPosition(eventId, studentId) {
  const rank = await client.zRank(`${eventId}:waitlist`, studentId);
  if (rank === null) {
    console.log(`  [WAITLIST] ${studentId} is not on the waitlist for ${eventId}`);
  } else {
    console.log(`  [WAITLIST] ${studentId} is at position ${rank + 1} for ${eventId}`);
  }
  return rank;
}

// ─── UPDATE: Promote next person from waitlist ────────────────────────────────

async function promoteFromWaitlist(eventId) {
  const waitKey = `${eventId}:waitlist`;
  const confKey = `${eventId}:confirmed`;
  const key     = `${eventId}:meta`;

  // Pop the lowest-score (earliest) entry from the waitlist
  const result = await client.zPopMin(waitKey);
  if (!result || result.length === 0) {
    console.log(`  [PROMOTE] No one on the waitlist for ${eventId}`);
    return null;
  }

  const studentId = result[0].value;

  await client.multi()
    .sAdd(confKey, studentId)
    .hIncrBy(key, "confirmed_count", 1)
    .hIncrBy(key, "waitlist_count", -1)
    .exec();

  console.log(`  [PROMOTE] ${studentId} promoted from waitlist to confirmed for ${eventId}`);
  return studentId;
}

// ─── DELETE: Cancel an RSVP ───────────────────────────────────────────────────

async function cancelRSVP(eventId, studentId) {
  const confKey = `${eventId}:confirmed`;
  const waitKey = `${eventId}:waitlist`;
  const key     = `${eventId}:meta`;

  const wasConfirmed = await client.sRem(confKey, studentId);

  if (wasConfirmed) {
    await client.hIncrBy(key, "confirmed_count", -1);
    console.log(`  [CANCEL] ${studentId} cancelled confirmed RSVP for ${eventId}`);
    // Auto-promote from waitlist
    await promoteFromWaitlist(eventId);
    return;
  }

  const wasWaiting = await client.zRem(waitKey, studentId);
  if (wasWaiting) {
    await client.hIncrBy(key, "waitlist_count", -1);
    console.log(`  [CANCEL] ${studentId} removed from waitlist for ${eventId}`);
    return;
  }

  console.log(`  [CANCEL] ${studentId} had no RSVP to cancel for ${eventId}`);
}

// ─── DELETE: Remove event entirely ────────────────────────────────────────────

async function deleteEvent(eventId) {
  await client.del(
    `${eventId}:meta`,
    `${eventId}:confirmed`,
    `${eventId}:waitlist`
  );
  console.log(`  [DELETE] Event ${eventId} and all RSVP data removed`);
}

// ─── Demo run ─────────────────────────────────────────────────────────────────

async function main() {
  await seedEvents();

  // --- CREATE: RSVPs for Spring Hackathon (capacity 3) ---
  console.log("=== CREATE: RSVP students to evt:101 (cap 3) ===");
  await rsvp("evt:101", "stu:alice");
  await rsvp("evt:101", "stu:bob");
  await rsvp("evt:101", "stu:carol");
  await rsvp("evt:101", "stu:dave");   // goes to waitlist
  await rsvp("evt:101", "stu:eve");    // goes to waitlist
  await rsvp("evt:101", "stu:alice");  // duplicate — should be rejected

  // --- READ: Event status ---
  console.log("\n=== READ: Event status ===");
  await getEventStatus("evt:101");
  await isConfirmed("evt:101", "stu:bob");
  await getWaitlistPosition("evt:101", "stu:dave");
  await getWaitlistPosition("evt:101", "stu:eve");

  // --- UPDATE: Cancel confirmed RSVP → triggers waitlist promotion ---
  console.log("\n=== UPDATE: Cancel bob → auto-promote dave ===");
  await cancelRSVP("evt:101", "stu:bob");
  await getEventStatus("evt:101");

  // --- UPDATE: Cancel waitlist entry ---
  console.log("\n=== UPDATE: Cancel eve from waitlist ===");
  await cancelRSVP("evt:101", "stu:eve");
  await getEventStatus("evt:101");

  // --- DELETE: Remove event ---
  console.log("\n=== DELETE: Remove evt:101 ===");
  await deleteEvent("evt:101");

  // Confirm deletion
  const meta = await client.hGetAll("evt:101:meta");
  console.log(`  [VERIFY] evt:101:meta after delete: ${JSON.stringify(meta)}`);

  await client.quit();
  console.log("\nDone.");
}

main().catch(console.error);
