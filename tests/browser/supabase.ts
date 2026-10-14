export function browserSupabase() {
  const record = async (name: string) => {
    document.body.dataset.authAction = name;
    return { error: null };
  };
  return {
    auth: {
      signInWithOtp: () => record("email"),
      signInWithOAuth: () => record("google"),
      updateUser: () => record("password"),
      signOut: () => record("signout"),
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: async () => {},
  };
}
