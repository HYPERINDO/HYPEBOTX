export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function fail(res, status, message, details = undefined) {
  return res.status(status).json({
    success: false,
    message,
    ...(details === undefined ? {} : { details }),
  });
}
