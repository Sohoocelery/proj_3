
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
