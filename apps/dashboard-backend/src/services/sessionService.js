export const sessionService = {
  setUser(req, user) {
    req.session.user = {
      userId: user.userId || user.discordId,
      discordId: user.discordId,
      username: user.username,
      avatarUrl: user.avatarUrl || null,
      role: user.role,
      loginAt: new Date().toISOString(),
    };
    return req.session.user;
  },
  getUser(req) {
    return req.session?.user || null;
  },
  destroy(req) {
    return new Promise((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  },
};
