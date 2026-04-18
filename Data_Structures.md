# Redis Data Structure Definitions
College Event Planning & Budget Management Network

---

## Overview

This document describes the Redis data structures used to implement real-time RSVP and waitlist management for the College Event Planning platform. Three structures are used together per event: a Hash for metadata, a Set for confirmed attendees, and a Sorted Set for the waitlist.

---

## Structure 1: Hash for Event Metadata

To implement real-time capacity tracking I use a Redis Hash with the key event:{eventId}:meta. The fields stored are title for the event name, capacity for the maximum number of attendees, confirmed_count for the current number of confirmed RSVPs, and waitlist_count for the current number of students on the waitlist.

A Hash is the right structure here because individual numeric fields can be incremented and decremented atomically using HINCRBY without reading and rewriting the entire object. This is critical for maintaining accurate counts under concurrent load.

Example key: event:101:meta

---

## Structure 2: Set for Confirmed Attendees

To implement confirmed RSVP tracking I use a Redis Set with the key event:{eventId}:confirmed. Student IDs are stored as members of the set.

A Set is the right structure here because membership checks using SISMEMBER run in O(1) constant time regardless of how many students are confirmed. This makes duplicate RSVP detection instant even during high-traffic registration periods. SADD and SREM are both atomic operations.

Example key: event:101:confirmed

---

## Structure 3: Sorted Set for Waitlist

To implement the chronologically ordered waitlist I use a Redis Sorted Set with the key event:{eventId}:waitlist. Student IDs are stored as members scored by their Unix timestamp in milliseconds at the time they joined the waitlist.

A Sorted Set is the right structure here because the timestamp score automatically orders members from earliest to latest. ZPOPMIN atomically removes and returns the member with the lowest score, which is always the student who has been waiting the longest. This enforces first-come first-served ordering without any additional sorting logic.

Example key: event:101:waitlist

---

## CRUD Commands

The following Redis commands cover all create, read, update, and delete operations for the three structures.

Initialize and reset all data

FLUSHALL removes all keys from Redis and is used at the start of a fresh demo run.

Create a new event

HSET event:101:meta title "Spring Hackathon" capacity 3 confirmed_count 0 waitlist_count 0 creates the metadata Hash with all four fields initialized.

Confirm a student RSVP when capacity is available

SADD event:101:confirmed stu:alice adds the student to the confirmed Set.
HINCRBY event:101:meta confirmed_count 1 increments the confirmed count in the Hash.
Both commands are wrapped in a MULTI/EXEC transaction to execute atomically.

Add a student to the waitlist when the event is at capacity

ZADD event:101:waitlist 1713400000000 stu:dave adds the student to the waitlist Sorted Set scored by their registration timestamp.
HINCRBY event:101:meta waitlist_count 1 increments the waitlist count in the Hash.
Both commands are wrapped in a MULTI/EXEC transaction.

Read all event metadata

HGETALL event:101:meta returns all fields and values from the metadata Hash.

Read all confirmed attendees

SMEMBERS event:101:confirmed returns all student IDs in the confirmed Set.

Check if a specific student is confirmed

SISMEMBER event:101:confirmed stu:alice returns 1 if confirmed and 0 if not.

Read the full waitlist in first-come first-served order

ZRANGE event:101:waitlist 0 -1 returns all waitlisted student IDs ordered from earliest to latest.

Read a student's position on the waitlist

ZRANK event:101:waitlist stu:dave returns the zero-based rank of the student, so rank 0 means first in line.

Cancel a confirmed RSVP and auto-promote from the waitlist

SREM event:101:confirmed stu:bob removes the student from the confirmed Set and returns 1 if they were present.
HINCRBY event:101:meta confirmed_count -1 decrements the confirmed count.
ZPOPMIN event:101:waitlist atomically removes and returns the earliest student from the waitlist.
SADD event:101:confirmed stu:dave adds the promoted student to the confirmed Set.
HINCRBY event:101:meta confirmed_count 1 increments the confirmed count back up.
HINCRBY event:101:meta waitlist_count -1 decrements the waitlist count.

Remove a student from the waitlist

ZREM event:101:waitlist stu:eve removes the student from the waitlist Sorted Set.
HINCRBY event:101:meta waitlist_count -1 decrements the waitlist count.

Update event capacity

HSET event:101:meta capacity 5 overwrites the capacity field in the metadata Hash.

Delete all Redis data for an event

DEL event:101:meta removes the metadata Hash.
DEL event:101:confirmed removes the confirmed Set.
DEL event:101:waitlist removes the waitlist Sorted Set.
