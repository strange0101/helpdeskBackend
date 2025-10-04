Helpdesk Ticket Management API

A full-featured ticket management system backend built with Node.js, Express, and PostgreSQL. Supports roles, SLA, comments, timeline logs, optimistic locking, and pagination.

Table of Contents

Features

Tech Stack

Setup

Environment Variables

Database

API Endpoints

Roles & Permissions

Error Codes

Pagination

Features

User roles: user, agent, admin

Tickets: create, read, update, search, list

Comments: add comments to tickets

Timeline logs: track actions on tickets

Optimistic locking: prevent stale updates

SLA & breached tickets: automatic due date tracking

Pagination: limit & offset

Tech Stack

Node.js & Express.js

PostgreSQL

JWT authentication

bcrypt for password hashing

Vite-compatible frontend integration (React)

Setup
# Clone repo
git clone <repo_url>
cd backend

# Install dependencies
npm install

# Run migrations
# Ensure PostgreSQL is running and configured
npx sequelize-cli db:migrate

# Start server
npm run dev

Environment Variables

Create .env:

PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/helpdesk
JWT_SECRET=your_jwt_secret

Database Tables
Users
Column	Type
id	SERIAL
name	TEXT
email	TEXT
password_hash	TEXT
role	TEXT
Tickets
Column	Type
id	SERIAL
title	TEXT
description	TEXT
status	TEXT
priority	TEXT
requester_id	INT
assignee_id	INT
sla_minutes	INT
due_at	TIMESTAMP
version	INT
created_at	TIMESTAMP
updated_at	TIMESTAMP
Comments
Column	Type
id	SERIAL
ticket_id	INT
author_id	INT
body	TEXT
created_at	TIMESTAMP
Timeline Logs
Column	Type
id	SERIAL
ticket_id	INT
actor_id	INT
action	TEXT
meta	JSON
created_at	TIMESTAMP
API Endpoints
Auth

POST /api/register
Body: { name, email, password, role }
Response: { id, name, email, role }

POST /api/login
Body: { email, password }
Response: { token }

Tickets

POST /api/tickets
Create a ticket (optional assignee_id, sla_minutes)
Headers: Idempotency-Key (optional)
Body: { title, description, priority, assignee_id?, sla_minutes? }

GET /api/tickets
Query params: query, status, assignee, limit, offset, breached
Response: { items: [...tickets], next_offset }

GET /api/tickets/:id
Returns ticket details + comments + timeline logs

PATCH /api/tickets/:id
Update ticket (optimistic locking)
Headers: If-Match: <current_version>
Allowed fields depend on role:

user: title, description (own ticket)

agent: status, priority, assignee_id (assigned ticket)

admin: all fields

Body: { title?, description?, status?, priority?, assignee_id?, sla_minutes? }

POST /api/tickets/:id/comments
Add comment to ticket
Body: { body }

GET /api/tickets/breached
Return tickets where status != closed and due_at <= NOW()

Roles & Permissions
Role	Can Create	Can Update Own Ticket	Can Update Assigned	Can Update Any
user	✅	✅ title/desc	❌	❌
agent	✅	❌	✅ status/priority	❌
admin	✅	✅ all fields	✅ all fields	✅ all fields
Error Codes
Code	Message
FIELD_REQUIRED	Required field is missing
INVALID_CREDENTIALS	Wrong email/password
NOT_FOUND	Resource not found
FORBIDDEN	Insufficient permissions
OPTIMISTIC_LOCK	Stale version, use latest version
INTERNAL_SERVER_ERROR	Unexpected server error
Pagination

Query params: limit (max 100), offset

Test user Credientials
admin
    email=admin@my
    password=Password123

agent
     email=agent@my
    password=Password123

user
    email=user@my
    password=Password123