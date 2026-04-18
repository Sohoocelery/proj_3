College Event Planning & Budget Management Network
CS 3200 — Project 3: Redis In-Memory Key-Value Store
Project Overview
A student organization event platform where clubs submit events for admin approval and students RSVP to approved events. This project extends the relational database from Projects 1 and 2 with a Redis caching layer that handles real-time RSVP concurrency and waitlist management.
The Problem Redis Solves
When a popular event opens for RSVPs, multiple students can click register at the exact same moment. In a relational database, two threads can both read "seats available" before either one writes the update back, causing the event to overbook beyond its capacity. This is a race condition.
Redis solves this through atomic operations. An atomic operation is guaranteed to complete without interruption, meaning no other process can sneak in between a read and a write. This makes Redis the right tool for enforcing real-time capacity limits under concurrent load.
Redis Use Case: Real-Time RSVP and Waitlist System
Redis acts as a high-performance caching layer for live event state. The relational database still maintains permanent RSVP records and event details. Redis only holds what needs to be fast and real-time.
Three Redis data structures are used per event. See data-structures.md for full definitions and CRUD commands.
The first structure is a Hash stored at the key event:{eventId}:meta. It holds scalar metadata including title, capacity, confirmed_count, and waitlist_count. Individual fields can be incremented atomically with HINCRBY without rewriting the whole object.
The second structure is a Set stored at event:{eventId}:confirmed. It holds the student IDs of all confirmed attendees. SISMEMBER checks for duplicates in O(1) constant time regardless of how many students are in the set.
The third structure is a Sorted Set stored at event:{eventId}:waitlist. It holds waitlisted student IDs scored by Unix timestamp in milliseconds. Whoever registered first has the lowest score. ZPOPMIN always removes and returns the earliest registrant, guaranteeing FIFO ordering without any extra sorting logic.
Business Rules
Events enforce a maximum capacity on a first-come, first-served basis. RSVP operations use Redis transactions via MULTI/EXEC to prevent overbooking. The waitlist is ordered by registration timestamp so the longest-waiting student is always promoted first. Cancellations by confirmed attendees automatically trigger promotion of the next person on the waitlist. Duplicate RSVPs are rejected at the Set membership check before any writes occur.
Running the Node Script
Prerequisites are Node.js 18 or later and Redis running locally on port 6379. Start Redis with redis-server, then run npm install followed by npm start from the project directory.
The script seeds two events, RSVPs five students to a capacity-3 event with three confirmed and two waitlisted, cancels a confirmed RSVP which triggers automatic waitlist promotion, removes a waitlist entry, and deletes the event entirely. All four CRUD operations are demonstrated.
Repository Structure
rsvp.js is the Node.js Redis script implementing the full RSVP and waitlist system. package.json contains the project metadata and the redis npm dependency. data-structures.md contains the Redis data structure definitions and the full CRUD command reference for all use cases. The requirements folder contains Final_Project.pdf with the Part 1 requirements document and UML conceptual model.
AI Disclosure
Claude (Anthropic) was used to assist in generating rsvp.js and this README. All Redis data structure design decisions, business rules, and UML diagrams were authored by the project team. All generated code was reviewed and understood before submission.
