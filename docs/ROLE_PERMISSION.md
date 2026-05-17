# Role Permission

Owner has full dashboard control except raw secret viewing. Admin handles store operations. Penjoki only handles assigned or available joki work.

The shared permission matrix lives in:

`packages/shared/src/permissions/permissionMatrix.js`

Security rules:

- All protected API routes require a valid session.
- Role restricted routes use `requireRole`.
- Penjoki routes must not expose payment, stock, settings, or full customer data.
- No dashboard role receives raw env, token, API key, or payment secret values.
