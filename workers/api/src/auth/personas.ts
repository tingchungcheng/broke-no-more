export const DEV_PERSONAS = {
  alex: {
    sub: "dev:alex",
    email: "alex@example.com",
    name: "Alex Tan",
    pictureUrl: null,
  },
  blair: {
    sub: "dev:blair",
    email: "blair@example.com",
    name: "Blair Lim",
    pictureUrl: null,
  },
} as const;

export type DevPersonaName = keyof typeof DEV_PERSONAS;
