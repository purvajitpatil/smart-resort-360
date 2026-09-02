# StaySmart — Database

SQLAlchemy 2.0 ORM, one `Base` metadata (`app/models/base.py`). Switchable via
`DATABASE_URL`:
- SQLite (offline demo): `sqlite:///./staysmart.db`
- PostgreSQL: `postgresql+psycopg://USER:PASS@HOST:5432/staysmart`

Tables are auto-created and seeded on startup (idempotent).

## Model catalogue

| Module            | Tables                                            |
| ----------------- | ------------------------------------------------- |
| `auth`            | `users`                                           |
| `hotel`           | `hotels`, `departments`, `staff`, `rooms`, `bookings`, `stays` |
| `guest`           | `guest_profiles`, `guest_preferences`, `groups`, `group_members`, `group_votes` |
| `requests`        | `service_requests`, `request_status_history`      |
| `travel`          | `poi_categories`, `pois`, `itineraries`, `itinerary_days`, `itinerary_stops`, `recommendations`, `weather_events`, `disruption_events` |
| `chat`            | `chat_sessions`, `chat_messages`                  |
| `payments`        | `notifications`, `payments`, `feedback`           |

### Key relationships

```
users 1─┐ (user_id)
        ├── guest_profiles 1─1 guest_preferences
        │         │ 1─n bookings 1─n stays
        │         │ 1─n service_requests
        └── staff (user_id)  n─1 departments  n─1 hotels  n─1 rooms

hotels 1─n rooms / departments / staff
stays  1─n service_requests / payments / feedback
pois   1─n itinerary_stops (n─1 itinerary_days n─1 itineraries)
```

Room `status` values: `CLEAN`, `OCCUPIED`, `DEPARTED`, `DIRTY`, `MAINTENANCE`.
`rooms`: 40 seeded (floors 1–4, 10 rooms each; Deluxe / Family / Suite).
`stays`: 4 active (demo guest Priya Sharma in 302), 2 departed.
`service_requests`: 7 seeded across statuses (PENDING/ASSIGNED/IN_PROGRESS/COMPLETED).
`pois`: 57 curated Jaipur entries (heritage, museum, nature, food, shopping,
religious, adventure, entertainment, wellness, culture) from `data/pois/jaipur.json`
with hours, coords, `visit_minutes`, `weather_sensitivity`, popularity, discovery.

## Enums

- `UserRole`: GUEST, STAFF, MANAGER, ADMIN
- `RequestStatus`: PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED, REJECTED
- `RequestPriority`: LOW, MEDIUM, HIGH
- `ItineraryStop.status`: PLANNED, LOCKED, COMPLETED, REMOVED, REPLACED

## Seeding

`app/seed/seed.py` — `seed_database(db)`, idempotent by table emptiness checks.
Demo identities and credentials are read from settings; see `docs/DEMO.md`.
`SEED_DATA_FILE` overrides the POI catalogue path (required in containers).