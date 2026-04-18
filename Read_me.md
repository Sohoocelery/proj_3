README.md
markdown
# College Event RSVP System with Redis

Real-time event RSVP and waitlist management using Redis for atomic operations and race condition prevention.

## Features

- Atomic RSVP capacity enforcement
- Automated waitlist with FIFO ordering
- Instant promotion when attendees cancel
- O(1) duplicate checking

## Redis Data Structures

**Hash** - `event:{id}:stats` - Tracks confirmed_count, waitlisted_count, capacity

**Sorted Set** - `event:{id}:waitlist` - Chronological waitlist (timestamp scores)

**Set** - `event:{id}:confirmed` - Confirmed attendee IDs

**Set** - `active:events` - Events with active Redis data

## CRUD Examples

```redis
# CREATE - RSVP
SADD event:101:confirmed student_123
HINCRBY event:101:stats confirmed_count 1

# READ - Check status
HGETALL event:101:stats

# UPDATE - Promote from waitlist
ZREM event:101:waitlist student_456
SADD event:101:confirmed student_456

# DELETE - Cancel RSVP
SREM event:101:confirmed student_123
```

## Video Demo

[Watch Demo](https://youtu.be/your-link)

## Team

**[Your Name]** - Redis design, CRUD operations, documentation

**[Member 2]** - Express app, video

## AI Disclosure

Claude assisted with Redis structure design and documentation. All implementation by team.

## Tech Stack

Node.js • Express • Redis • PostgreSQL • EJS

GitHub About
Description:
Real-time event RSVP with Redis waitlist management
Topics:
redis, nodejs, express, rsvp-system, database-systems

Commit Messages
Add Redis event statistics hash
Add waitlist sorted set
Add confirmed attendees set
Implement RSVP CRUD operations
Add auto-promotion logic
Fix capacity race condition
Update README
Add video link

Project Title
College Event RSVP System with Redis
