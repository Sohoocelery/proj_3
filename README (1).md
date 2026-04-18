# College Event Planning & Budget Management Network
**CS 3200 — Project 3: Redis In-Memory Key-Value Store**

> **Video walkthrough:** _(add your Zoom link here)_

---

## Project Overview

A student organization event platform where clubs submit events for admin approval and students RSVP to approved events. This project extends the relational database from Projects 1–2 with a **Redis caching layer** that handles real-time RSVP concurrency and waitlist management.

---

## Redis Use Case: Real-Time RSVP & Waitlist System

### Why Redis?

Popular events face a race condition when multiple students attempt to register simultaneously, risking overbooking beyond capacity. Redis solves this with **atomic operations** that enforce capacity in a thread-safe way without locking an entire relational table.

### What Gets Stored in Redis

| Key Pattern                  | Structure    | Purpose                                      |
|------------------------------|--------------|----------------------------------------------|
| `event:{id}:meta`            | Hash         | title, capacity, confirmed\_count, waitlist\_count |
| `event:{id}:confirmed`       | Set          | Student IDs with confirmed RSVPs             |
| `event:{id}:waitlist`        | Sorted Set   | Student IDs scored by Unix timestamp (FIFO)  |

---

## Redis Data Structures

### 1. Hash — `event:{eventId}:meta`
Stores scalar metadata for each event. Chosen because individual fields can be incremented atomically with `HINCRBY`, avoiding the need to read-then-write the whole object.

```
HSET event:101:meta title "Spring Hackathon" capacity 3 confirmed_count 0 waitlist_count 0
```

### 2. Set — `event:{eventId}:confirmed`
Stores confirmed student IDs. `SISMEMBER` provides O(1) duplicate checking, and `SADD`/`SREM` are atomic.

```
SADD event:101:confirmed stu:alice
```

### 3. Sorted Set — `event:{eventId}:waitlist`
Stores waitlisted student IDs scored by Unix timestamp. `ZPOPMIN` always removes and returns the earliest entry, guaranteeing FIFO promotion.

```
ZADD event:101:waitlist 1713400000000 stu:dave
```

---

## Redis Commands (Full CRUD)

### Initialize / Reset
```
FLUSHALL
```

### CREATE

**Seed a new event:**
```
HSET event:101:meta title "Spring Hackathon" capacity 3 confirmed_count 0 waitlist_count 0
```

**Confirm an RSVP (capacity available):**
```
SADD   event:101:confirmed stu:alice
HINCRBY event:101:meta confirmed_count 1
```

**Add to waitlist (at capacity):**
```
ZADD    event:101:waitlist 1713400000000 stu:dave
HINCRBY event:101:meta waitlist_count 1
```

### READ

**Get all event metadata:**
```
HGETALL event:101:meta
```

**Get all confirmed attendees:**
```
SMEMBERS event:101:confirmed
```

**Check if a student is confirmed (O(1)):**
```
SISMEMBER event:101:confirmed stu:alice
```

**Get full waitlist in FIFO order:**
```
ZRANGE event:101:waitlist 0 -1
```

**Get a student's waitlist position:**
```
ZRANK event:101:waitlist stu:dave
```

**Get waitlist with timestamps:**
```
ZRANGE event:101:waitlist 0 -1 WITHSCORES
```

### UPDATE

**Cancel a confirmed RSVP and promote next from waitlist:**
```
SREM    event:101:confirmed stu:alice
HINCRBY event:101:meta confirmed_count -1

ZPOPMIN event:101:waitlist
SADD    event:101:confirmed stu:dave
HINCRBY event:101:meta confirmed_count 1
HINCRBY event:101:meta waitlist_count -1
```

**Remove a student from the waitlist:**
```
ZREM    event:101:waitlist stu:eve
HINCRBY event:101:meta waitlist_count -1
```

**Update event capacity:**
```
HSET event:101:meta capacity 5
```

### DELETE

**Cancel any RSVP (confirmed or waitlist):**
```
SREM event:101:confirmed stu:alice
ZREM event:101:waitlist stu:dave
```

**Delete all Redis data for an event:**
```
DEL event:101:meta
DEL event:101:confirmed
DEL event:101:waitlist
```

---

## Running the Node Script (Part 5)

### Prerequisites
- Node.js 18+
- Redis running locally on port 6379 (`redis-server`)

### Setup
```bash
npm install
npm start
```

### Expected Output
The script seeds two events, RSVPs five students to a capacity-3 event (three confirmed, two waitlisted), cancels a confirmed RSVP triggering an auto-promotion, removes a waitlist entry, and deletes the event — demonstrating all CRUD operations.

---

## Repository Structure

```
.
├── rsvp.js          # Node.js Redis script (Part 5)
├── package.json
├── requirements/
│   └── Final_Project.pdf   # Parts 1–3: requirements + UML + data structure descriptions
└── README.md
```

---

## AI Disclosure

Claude (Anthropic) was used to assist in generating the Node.js script (`rsvp.js`) and this README. All Redis data structure design decisions, business rules, and UML diagrams were authored by the project team. The generated code was reviewed and understood before submission.

---

## Team Members
- _(your name)_
- _(partner name if applicable)_
