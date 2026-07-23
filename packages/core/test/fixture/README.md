# acme-todos

A small HTTP API for managing todos. Built to be boring and reliable.

## Why

Teams needed a shared todo list with a stable API. This service owns that data
and exposes a handful of endpoints.

## Architecture

The service is a single Hono app. Requests hit route handlers that read and
write an in-memory store. There is no database yet.

## Running

Run `npm start` and the server listens on port 3000.
