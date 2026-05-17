# Discord OAuth

Routes:

- `GET /api/auth/discord`
- `GET /api/auth/discord/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Flow:

1. Frontend redirects to backend `/api/auth/discord`.
2. Backend creates OAuth `state` and redirects to Discord.
3. Callback validates `state`, exchanges `code`, and fetches Discord user identity.
4. Backend resolves dashboard role from `OWNER_DISCORD_IDS` or staff data.
5. Backend stores a minimal user object in an httpOnly session cookie.
6. Logout destroys the session and clears the cookie.
